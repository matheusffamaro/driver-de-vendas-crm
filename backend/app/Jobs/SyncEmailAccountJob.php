<?php

namespace App\Jobs;

use App\Models\EmailAccount;
use App\Models\EmailThread;
use App\Models\EmailMessage;
use App\Models\EmailAddonUsage;
use App\Models\Client;
use App\Models\PipelineCard;
use App\Services\Email\OAuthEmailService;
use App\Services\Email\ImapEmailService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class SyncEmailAccountJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 300; // 5 minutes
    public $tries = 3;

    protected EmailAccount $account;

    /**
     * Create a new job instance.
     */
    public function __construct(EmailAccount $account)
    {
        $this->account = $account;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        try {
            // Update sync status
            $this->account->update(['sync_status' => 'syncing']);

            Log::info("Starting email sync for account: {$this->account->email}");

            if ($this->account->isOAuthProvider()) {
                $this->syncOAuthAccount();
            } elseif ($this->account->isImapProvider()) {
                $this->syncImapAccount();
            } else {
                throw new \Exception("Unknown provider type: {$this->account->provider}");
            }

            // Update successful sync
            $this->account->update([
                'sync_status' => 'synced',
                'last_sync_at' => now(),
                'sync_error' => null,
            ]);

            Log::info("Email sync completed for account: {$this->account->email}");
        } catch (\Exception $e) {
            Log::error("Email sync error for account {$this->account->email}: " . $e->getMessage());
            
            $this->account->update([
                'sync_status' => 'error',
                'sync_error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    /**
     * Sync OAuth account (Gmail/Outlook)
     */
    protected function syncOAuthAccount(): void
    {
        $oauthService = new OAuthEmailService();

        if ($this->account->provider === 'gmail') {
            $this->syncGmail($oauthService);
        } elseif ($this->account->provider === 'outlook') {
            $this->syncOutlook($oauthService);
        }
    }

    /**
     * Sync Gmail messages (with pagination; prefer messages after last_sync_at when set)
     */
    protected function syncGmail(OAuthEmailService $oauthService): void
    {
        $gmail = $oauthService->getGmailService($this->account);

        // Prefer fetching only messages newer than last sync; otherwise last 30 days
        $afterDate = $this->account->last_sync_at
            ? $this->account->last_sync_at->subMinutes(5)->format('Y/m/d') // small overlap to avoid gaps
            : now()->subDays(30)->format('Y/m/d');
        $query = 'after:' . $afterDate;

        $pageToken = null;
        $maxPages = 20; // cap at ~1000 messages per sync
        $page = 0;
        do {
            $params = ['q' => $query, 'maxResults' => 100];
            if ($pageToken) {
                $params['pageToken'] = $pageToken;
            }
            $response = $gmail->users_messages->listUsersMessages('me', $params);
            $messages = $response->getMessages();
            if ($messages === null) {
                break;
            }
            foreach ($messages as $messageRef) {
                try {
                    $message = $gmail->users_messages->get('me', $messageRef->getId(), ['format' => 'full']);
                    $this->processGmailMessage($message);
                } catch (\Exception $e) {
                    Log::warning("Error processing Gmail message {$messageRef->getId()}: " . $e->getMessage());
                    continue;
                }
            }
            $pageToken = $response->getNextPageToken();
            $page++;
        } while ($pageToken && $page < $maxPages);
    }

    /**
     * Process Gmail message and store in database
     */
    protected function processGmailMessage($gmailMessage): void
    {
        $headers = [];
        foreach ($gmailMessage->getPayload()->getHeaders() as $header) {
            $headers[$header->getName()] = $header->getValue();
        }

        $messageId = $headers['Message-ID'] ?? 'gmail-' . $gmailMessage->getId();
        
        // Check if message already exists
        $existingMessage = EmailMessage::where('message_id', $messageId)
            ->where('email_account_id', $this->account->id)
            ->first();

        if ($existingMessage) {
            return; // Skip duplicate
        }

        // Extract message data
        $subject = $headers['Subject'] ?? 'No Subject';
        $from = $this->parseEmailAddress($headers['From'] ?? '');
        $to = $this->parseEmailAddressList($headers['To'] ?? '');
        $cc = $this->parseEmailAddressList($headers['Cc'] ?? '');

        // Get body
        $body = $this->extractGmailBody($gmailMessage->getPayload());

        // Create or get thread
        $threadId = $gmailMessage->getThreadId();
        $thread = $this->getOrCreateThread($threadId, $subject, array_merge([$from], $to));

        // Create message
        $messageData = [
            'email_thread_id' => $thread->id,
            'email_account_id' => $this->account->id,
            'tenant_id' => $this->account->tenant_id,
            'message_id' => $messageId,
            'from_email' => $from['email'],
            'from_name' => $from['name'],
            'to' => $to,
            'cc' => $cc,
            'subject' => $subject,
            'body_text' => $body['text'] ?? null,
            'body_html' => $body['html'] ?? null,
            'sent_at' => isset($headers['Date']) ? date('Y-m-d H:i:s', strtotime($headers['Date'])) : now(),
            'received_at' => now(),
            'is_sent' => false,
            'is_read' => !in_array('UNREAD', $gmailMessage->getLabelIds() ?? []),
        ];

        $message = EmailMessage::create($messageData);

        // Update thread last message time
        $thread->update(['last_message_at' => $message->sent_at]);

        // Auto-link to contact and opportunity
        $this->autoLinkMessage($thread, $from['email']);

        // Track usage
        $this->trackEmailReceived();
    }

    /**
     * Extract body from Gmail message
     */
    protected function extractGmailBody($payload): array
    {
        $body = ['text' => null, 'html' => null];
        $mainBody = $payload->getBody();
        if ($mainBody !== null && $mainBody->getSize() > 0) {
            $data = $mainBody->getData();
            $decoded = base64_decode(strtr($data, '-_', '+/'));
            
            if ($payload->getMimeType() === 'text/plain') {
                $body['text'] = $decoded;
            } elseif ($payload->getMimeType() === 'text/html') {
                $body['html'] = $decoded;
            }
        }

        // Check parts for multipart messages
        if ($payload->getParts()) {
            foreach ($payload->getParts() as $part) {
                $partBody = $part->getBody();
                if ($partBody === null || $partBody->getSize() <= 0) {
                    continue;
                }
                if ($part->getMimeType() === 'text/plain') {
                    $data = $partBody->getData();
                    $body['text'] = base64_decode(strtr($data, '-_', '+/'));
                } elseif ($part->getMimeType() === 'text/html') {
                    $data = $partBody->getData();
                    $body['html'] = base64_decode(strtr($data, '-_', '+/'));
                }
            }
        }

        return $body;
    }

    /**
     * Sync Outlook messages
     */
    protected function syncOutlook(OAuthEmailService $oauthService): void
    {
        $graph = $oauthService->getGraphClient($this->account);
        
        $messages = $graph->createRequest('GET', '/me/messages')
            ->addHeaders(['Prefer' => 'outlook.body-content-type="html"'])
            ->setReturnType(\Microsoft\Graph\Model\Message::class)
            ->setTop(50)
            ->execute();

        foreach ($messages as $message) {
            try {
                $this->processOutlookMessage($message);
            } catch (\Exception $e) {
                Log::warning("Error processing Outlook message {$message->getId()}: " . $e->getMessage());
                continue;
            }
        }
    }

    /**
     * Process Outlook message and store in database
     */
    protected function processOutlookMessage($outlookMessage): void
    {
        $messageId = $outlookMessage->getInternetMessageId() ?? 'outlook-' . $outlookMessage->getId();
        
        // Check if message already exists
        $existingMessage = EmailMessage::where('message_id', $messageId)
            ->where('email_account_id', $this->account->id)
            ->first();

        if ($existingMessage) {
            return;
        }

        // Extract data
        $from = [
            'email' => $outlookMessage->getFrom()->getEmailAddress()->getAddress(),
            'name' => $outlookMessage->getFrom()->getEmailAddress()->getName(),
        ];

        $to = [];
        foreach ($outlookMessage->getToRecipients() as $recipient) {
            $to[] = [
                'email' => $recipient->getEmailAddress()->getAddress(),
                'name' => $recipient->getEmailAddress()->getName(),
            ];
        }

        // Create or get thread
        $threadId = $outlookMessage->getConversationId();
        $thread = $this->getOrCreateThread($threadId, $outlookMessage->getSubject(), array_merge([$from], $to));

        // Create message
        $messageData = [
            'email_thread_id' => $thread->id,
            'email_account_id' => $this->account->id,
            'tenant_id' => $this->account->tenant_id,
            'message_id' => $messageId,
            'from_email' => $from['email'],
            'from_name' => $from['name'],
            'to' => $to,
            'subject' => $outlookMessage->getSubject(),
            'body_html' => $outlookMessage->getBody()->getContent(),
            'sent_at' => $outlookMessage->getSentDateTime(),
            'received_at' => $outlookMessage->getReceivedDateTime() ?? now(),
            'is_sent' => false,
            'is_read' => $outlookMessage->getIsRead(),
        ];

        $message = EmailMessage::create($messageData);

        // Update thread
        $thread->update(['last_message_at' => $message->sent_at]);

        // Auto-link
        $this->autoLinkMessage($thread, $from['email']);

        // Track usage
        $this->trackEmailReceived();
    }

    /**
     * Sync IMAP account
     */
    protected function syncImapAccount(): void
    {
        $imapService = new ImapEmailService();
        
        try {
            $imapService->connect($this->account);
            $messages = $imapService->fetchMessages(50);

            foreach ($messages as $messageData) {
                try {
                    $this->processImapMessage($messageData);
                } catch (\Exception $e) {
                    Log::warning("Error processing IMAP message: " . $e->getMessage());
                    continue;
                }
            }
        } finally {
            $imapService->disconnect();
        }
    }

    /**
     * Process IMAP message
     */
    protected function processImapMessage(array $messageData): void
    {
        // Check if message already exists
        $existingMessage = EmailMessage::where('message_id', $messageData['message_id'])
            ->where('email_account_id', $this->account->id)
            ->first();

        if ($existingMessage) {
            return;
        }

        // Create or get thread
        $threadId = md5($messageData['subject'] . implode('', array_column($messageData['to'], 'email')));
        $participants = array_merge(
            [['email' => $messageData['from_email'], 'name' => $messageData['from_name']]],
            $messageData['to']
        );
        $thread = $this->getOrCreateThread($threadId, $messageData['subject'], $participants);

        // Create message
        $messageData['email_thread_id'] = $thread->id;
        $messageData['email_account_id'] = $this->account->id;
        $messageData['tenant_id'] = $this->account->tenant_id;
        $messageData['is_sent'] = false;

        $message = EmailMessage::create($messageData);

        // Update thread
        $thread->update(['last_message_at' => $message->sent_at]);

        // Auto-link
        $this->autoLinkMessage($thread, $messageData['from_email']);

        // Track usage
        $this->trackEmailReceived();
    }

    /**
     * Get or create email thread
     */
    protected function getOrCreateThread(string $threadId, string $subject, array $participants): EmailThread
    {
        $thread = EmailThread::where('thread_id', $threadId)
            ->where('email_account_id', $this->account->id)
            ->first();

        if (!$thread) {
            // Extract email addresses for participants
            $participantEmails = array_map(function ($p) {
                return $p['email'] ?? $p;
            }, $participants);

            $thread = EmailThread::create([
                'email_account_id' => $this->account->id,
                'tenant_id' => $this->account->tenant_id,
                'thread_id' => $threadId,
                'subject' => $subject,
                'participants' => $participantEmails,
                'last_message_at' => now(),
            ]);
        }

        return $thread;
    }

    /**
     * Auto-link thread to contact and opportunity
     */
    protected function autoLinkMessage(EmailThread $thread, string $email): void
    {
        if ($thread->linked_contact_id) {
            return; // Already linked
        }

        // Find contact by email
        $contact = Client::where('tenant_id', $this->account->tenant_id)
            ->where('email', $email)
            ->first();

        if ($contact) {
            $thread->update(['linked_contact_id' => $contact->id]);

            // Find active opportunity for this contact
            $activeCard = PipelineCard::where('contact_id', $contact->id)
                ->whereNull('archived_at')
                ->orderBy('created_at', 'desc')
                ->first();

            if ($activeCard) {
                $thread->update(['linked_pipeline_card_id' => $activeCard->id]);
            }
        }
    }

    /**
     * Track received email in usage
     */
    protected function trackEmailReceived(): void
    {
        $usage = EmailAddonUsage::getCurrentMonthUsage($this->account->tenant_id);
        $usage->incrementReceived();
    }

    /**
     * Parse email address from string
     */
    protected function parseEmailAddress(string $address): array
    {
        if (preg_match('/(.*)<(.+)>/', $address, $matches)) {
            return ['name' => trim($matches[1], '" '), 'email' => $matches[2]];
        }
        
        return ['name' => null, 'email' => $address];
    }

    /**
     * Parse list of email addresses
     */
    protected function parseEmailAddressList(string $addresses): array
    {
        $list = [];
        $parts = explode(',', $addresses);
        
        foreach ($parts as $address) {
            $address = trim($address);
            if ($address) {
                $list[] = $this->parseEmailAddress($address);
            }
        }
        
        return $list;
    }
}
