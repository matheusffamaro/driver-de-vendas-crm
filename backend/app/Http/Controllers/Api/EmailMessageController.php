<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EmailAccount;
use App\Models\EmailThread;
use App\Models\EmailMessage;
use App\Models\EmailAddonUsage;
use App\Services\Email\OAuthEmailService;
use App\Services\Email\ImapEmailService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class EmailMessageController extends Controller
{
    /**
     * Send new email
     */
    public function send(Request $request)
    {
        // Check if email addon is enabled
        if (!$request->user()->tenant->email_addon_enabled) {
            return response()->json(['error' => 'Email addon is not enabled'], 403);
        }

        $validator = Validator::make($request->all(), [
            'account_id' => 'required|uuid|exists:email_accounts,id',
            'to' => 'required|array|min:1',
            'to.*.email' => 'required|email',
            'to.*.name' => 'nullable|string',
            'cc' => 'nullable|array',
            'cc.*.email' => 'required_with:cc|email',
            'cc.*.name' => 'nullable|string',
            'bcc' => 'nullable|array',
            'bcc.*.email' => 'required_with:bcc|email',
            'bcc.*.name' => 'nullable|string',
            'subject' => 'required|string|max:255',
            'body_html' => 'nullable|string',
            'body_text' => 'nullable|string',
            'track_opens' => 'nullable|boolean',
            'track_clicks' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $account = EmailAccount::where('id', $request->account_id)
                ->where('tenant_id', $request->user()->tenant_id)
                ->firstOrFail();

            // Prepare message data
            $messageData = [
                'subject' => $request->subject,
                'from_name' => $account->account_name,
                'to' => $request->to,
                'cc' => $request->cc,
                'bcc' => $request->bcc,
                'body_html' => $request->body_html,
                'body_text' => $request->body_text,
            ];

            // Add tracking if enabled
            if ($request->track_opens || $request->track_clicks) {
                $messageData['body_html'] = $this->addTracking(
                    $messageData['body_html'] ?? '',
                    $request->track_opens,
                    $request->track_clicks
                );
            }

            // Send via appropriate service
            if ($account->isOAuthProvider()) {
                $sent = $this->sendViaOAuth($account, $messageData);
            } else {
                $sent = $this->sendViaImap($account, $messageData);
            }

            if (!$sent) {
                return response()->json(['error' => 'Failed to send email'], 500);
            }

            // Create thread and message record
            $thread = $this->createSentThread($account, $messageData, $request->user()->id);

            // Track usage
            $usage = EmailAddonUsage::getCurrentMonthUsage($account->tenant_id);
            $usage->incrementSent();

            return response()->json([
                'message' => 'Email sent successfully',
                'thread' => $thread->load('messages'),
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Reply to an email
     */
    public function reply(Request $request, string $messageId)
    {
        // Check if email addon is enabled
        if (!$request->user()->tenant->email_addon_enabled) {
            return response()->json(['error' => 'Email addon is not enabled'], 403);
        }

        $validator = Validator::make($request->all(), [
            'body_html' => 'nullable|string',
            'body_text' => 'nullable|string',
            'reply_all' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $originalMessage = EmailMessage::where('id', $messageId)
                ->where('tenant_id', $request->user()->tenant_id)
                ->with('thread', 'emailAccount')
                ->firstOrFail();

            // Build reply recipients
            $to = [['email' => $originalMessage->from_email, 'name' => $originalMessage->from_name]];
            $cc = [];

            if ($request->reply_all) {
                // Add all original recipients except the current account
                foreach ($originalMessage->to as $recipient) {
                    if ($recipient['email'] !== $originalMessage->emailAccount->email) {
                        $cc[] = $recipient;
                    }
                }
                if ($originalMessage->cc) {
                    $cc = array_merge($cc, $originalMessage->cc);
                }
            }

            // Prepare reply message
            $messageData = [
                'subject' => 'Re: ' . preg_replace('/^Re:\s*/i', '', $originalMessage->subject),
                'from_name' => $originalMessage->emailAccount->account_name,
                'to' => $to,
                'cc' => !empty($cc) ? $cc : null,
                'body_html' => $request->body_html,
                'body_text' => $request->body_text,
            ];

            // Send
            $account = $originalMessage->emailAccount;
            if ($account->isOAuthProvider()) {
                $sent = $this->sendViaOAuth($account, $messageData);
            } else {
                $sent = $this->sendViaImap($account, $messageData);
            }

            if (!$sent) {
                return response()->json(['error' => 'Failed to send reply'], 500);
            }

            // Create message record in same thread
            $message = EmailMessage::create([
                'email_thread_id' => $originalMessage->email_thread_id,
                'email_account_id' => $account->id,
                'tenant_id' => $account->tenant_id,
                'message_id' => 'sent-' . Str::uuid(),
                'from_email' => $account->email,
                'from_name' => $account->account_name,
                'to' => $to,
                'cc' => $cc,
                'subject' => $messageData['subject'],
                'body_html' => $request->body_html,
                'body_text' => $request->body_text,
                'is_sent' => true,
                'sent_at' => now(),
                'sent_by_user_id' => $request->user()->id,
            ]);

            // Update thread
            $originalMessage->thread->update(['last_message_at' => $message->sent_at]);

            // Track usage
            $usage = EmailAddonUsage::getCurrentMonthUsage($account->tenant_id);
            $usage->incrementSent();

            return response()->json([
                'message' => 'Reply sent successfully',
                'email_message' => $message,
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Forward an email
     */
    public function forward(Request $request, string $messageId)
    {
        // Check if email addon is enabled
        if (!$request->user()->tenant->email_addon_enabled) {
            return response()->json(['error' => 'Email addon is not enabled'], 403);
        }

        $validator = Validator::make($request->all(), [
            'to' => 'required|array|min:1',
            'to.*.email' => 'required|email',
            'to.*.name' => 'nullable|string',
            'body_html' => 'nullable|string',
            'body_text' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $originalMessage = EmailMessage::where('id', $messageId)
                ->where('tenant_id', $request->user()->tenant_id)
                ->with('emailAccount')
                ->firstOrFail();

            // Prepare forwarded message
            $forwardedBody = $request->body_html ?? '';
            $forwardedBody .= "\n\n---------- Forwarded message ---------\n";
            $forwardedBody .= "From: {$originalMessage->from_name} <{$originalMessage->from_email}>\n";
            $forwardedBody .= "Date: {$originalMessage->sent_at}\n";
            $forwardedBody .= "Subject: {$originalMessage->subject}\n\n";
            $forwardedBody .= $originalMessage->body_html ?? $originalMessage->body_text;

            $messageData = [
                'subject' => 'Fwd: ' . preg_replace('/^Fwd:\s*/i', '', $originalMessage->subject),
                'from_name' => $originalMessage->emailAccount->account_name,
                'to' => $request->to,
                'body_html' => $forwardedBody,
                'body_text' => strip_tags($forwardedBody),
            ];

            // Send
            $account = $originalMessage->emailAccount;
            if ($account->isOAuthProvider()) {
                $sent = $this->sendViaOAuth($account, $messageData);
            } else {
                $sent = $this->sendViaImap($account, $messageData);
            }

            if (!$sent) {
                return response()->json(['error' => 'Failed to forward email'], 500);
            }

            // Create new thread for forwarded message
            $thread = $this->createSentThread($account, $messageData, $request->user()->id);

            // Track usage
            $usage = EmailAddonUsage::getCurrentMonthUsage($account->tenant_id);
            $usage->incrementSent();

            return response()->json([
                'message' => 'Email forwarded successfully',
                'thread' => $thread->load('messages'),
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Send email via OAuth (Gmail/Outlook)
     */
    protected function sendViaOAuth(EmailAccount $account, array $messageData): bool
    {
        $oauthService = new OAuthEmailService();

        if ($account->provider === 'gmail') {
            $gmail = $oauthService->getGmailService($account);
            
            // Build raw email message
            $rawMessage = $this->buildRawMessage($account->email, $messageData);
            $message = new \Google_Service_Gmail_Message();
            $message->setRaw($rawMessage);

            $gmail->users_messages->send('me', $message);
            return true;
        } elseif ($account->provider === 'outlook') {
            $graph = $oauthService->getGraphClient($account);
            
            $outlookMessage = [
                'subject' => $messageData['subject'],
                'body' => [
                    'contentType' => 'HTML',
                    'content' => $messageData['body_html'] ?? $messageData['body_text'],
                ],
                'toRecipients' => array_map(function ($to) {
                    return [
                        'emailAddress' => [
                            'address' => $to['email'],
                            'name' => $to['name'] ?? null,
                        ],
                    ];
                }, $messageData['to']),
            ];

            if (!empty($messageData['cc'])) {
                $outlookMessage['ccRecipients'] = array_map(function ($cc) {
                    return [
                        'emailAddress' => [
                            'address' => $cc['email'],
                            'name' => $cc['name'] ?? null,
                        ],
                    ];
                }, $messageData['cc']);
            }

            $graph->createRequest('POST', '/me/sendMail')
                ->attachBody(['message' => $outlookMessage])
                ->execute();

            return true;
        }

        return false;
    }

    /**
     * Send email via IMAP/SMTP
     */
    protected function sendViaImap(EmailAccount $account, array $messageData): bool
    {
        $imapService = new ImapEmailService();
        $imapService->account = $account;
        
        return $imapService->sendMessage($messageData);
    }

    /**
     * Build raw email message for Gmail
     */
    protected function buildRawMessage(string $from, array $messageData): string
    {
        $to = implode(', ', array_map(function ($t) {
            $name = $t['name'] ?? null;
            return $name ? "\"{$name}\" <{$t['email']}>" : $t['email'];
        }, $messageData['to']));

        $message = "From: {$from}\r\n";
        $message .= "To: {$to}\r\n";
        $message .= "Subject: {$messageData['subject']}\r\n";
        $message .= "MIME-Version: 1.0\r\n";
        $message .= "Content-Type: text/html; charset=utf-8\r\n\r\n";
        $message .= $messageData['body_html'] ?? $messageData['body_text'];

        return base64_encode($message);
    }

    /**
     * Create thread and message for sent email
     */
    protected function createSentThread(EmailAccount $account, array $messageData, string $userId): EmailThread
    {
        // Create thread
        $participants = array_map(function ($t) {
            return $t['email'];
        }, $messageData['to']);
        $participants[] = $account->email;

        $thread = EmailThread::create([
            'email_account_id' => $account->id,
            'tenant_id' => $account->tenant_id,
            'thread_id' => 'sent-' . Str::uuid(),
            'subject' => $messageData['subject'],
            'participants' => $participants,
            'last_message_at' => now(),
            'is_read' => true,
        ]);

        // Create message
        EmailMessage::create([
            'email_thread_id' => $thread->id,
            'email_account_id' => $account->id,
            'tenant_id' => $account->tenant_id,
            'message_id' => 'sent-' . Str::uuid(),
            'from_email' => $account->email,
            'from_name' => $messageData['from_name'],
            'to' => $messageData['to'],
            'cc' => $messageData['cc'] ?? null,
            'bcc' => $messageData['bcc'] ?? null,
            'subject' => $messageData['subject'],
            'body_html' => $messageData['body_html'],
            'body_text' => $messageData['body_text'],
            'is_sent' => true,
            'sent_at' => now(),
            'sent_by_user_id' => $userId,
        ]);

        return $thread;
    }

    /**
     * Add tracking pixels and links to email body
     */
    protected function addTracking(string $body, bool $trackOpens, bool $trackClicks): string
    {
        // Add tracking pixel for opens
        if ($trackOpens) {
            $trackingId = Str::uuid();
            $trackingPixel = "<img src=\"" . url("/api/email/track/{$trackingId}/open") . "\" width=\"1\" height=\"1\" />";
            $body .= $trackingPixel;
        }

        // TODO: Implement click tracking by replacing links

        return $body;
    }
}
