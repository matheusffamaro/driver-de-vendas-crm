<?php

namespace App\Services\Email;

use App\Models\EmailAccount;
use App\Models\EmailThread;
use App\Models\EmailMessage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class ImapEmailService
{
    protected $connection;
    protected EmailAccount $account;

    /**
     * Connect to IMAP server
     */
    public function connect(EmailAccount $account): bool
    {
        $this->account = $account;

        if (!$account->isImapProvider()) {
            throw new \Exception("Account is not an IMAP provider");
        }

        $config = $account->imap_config;
        
        $host = $config['host'] ?? '';
        $port = $config['port'] ?? 993;
        $encryption = $config['encryption'] ?? 'ssl';
        $username = $config['username'] ?? $account->email;
        $password = decrypt($account->password);

        // Build connection string
        $flags = '';
        if ($encryption === 'ssl') {
            $flags = '/ssl';
        } elseif ($encryption === 'tls') {
            $flags = '/tls';
        }
        
        $flags .= '/novalidate-cert'; // For self-signed certificates
        
        $connectionString = "{{$host}:{$port}/imap{$flags}}INBOX";

        try {
            $this->connection = @imap_open($connectionString, $username, $password);
            
            if (!$this->connection) {
                $error = imap_last_error();
                throw new \Exception("IMAP connection failed: {$error}");
            }

            return true;
        } catch (\Exception $e) {
            Log::error("IMAP connection error for account {$account->id}: " . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Fetch recent messages
     */
    public function fetchMessages(int $limit = 50, ?string $since = null): array
    {
        if (!$this->connection) {
            throw new \Exception("Not connected to IMAP server");
        }

        $messages = [];
        
        // Get message count
        $mailbox = imap_check($this->connection);
        $totalMessages = $mailbox->Nmsgs;

        // Calculate range
        $start = max(1, $totalMessages - $limit + 1);
        $end = $totalMessages;

        // Fetch messages in reverse order (newest first)
        for ($i = $end; $i >= $start; $i--) {
            try {
                $message = $this->fetchMessage($i);
                if ($message) {
                    $messages[] = $message;
                }
            } catch (\Exception $e) {
                Log::warning("Error fetching message {$i}: " . $e->getMessage());
                continue;
            }
        }

        return $messages;
    }

    /**
     * Fetch a single message
     */
    protected function fetchMessage(int $messageNumber): ?array
    {
        $header = imap_headerinfo($this->connection, $messageNumber);
        $structure = imap_fetchstructure($this->connection, $messageNumber);
        
        if (!$header) {
            return null;
        }

        // Get message body
        $body = $this->getMessageBody($messageNumber, $structure);
        
        // Parse recipients
        $to = $this->parseAddresses($header->to ?? []);
        $cc = $this->parseAddresses($header->cc ?? []);
        $bcc = $this->parseAddresses($header->bcc ?? []);
        
        // Parse from
        $from = $header->from[0] ?? null;
        $fromEmail = $from->mailbox . '@' . $from->host;
        $fromName = $from->personal ?? null;

        // Get attachments
        $attachments = $this->getAttachments($messageNumber, $structure);

        return [
            'message_id' => $header->message_id ?? 'imap-' . $messageNumber . '-' . time(),
            'subject' => $this->decodeMimeStr($header->subject ?? 'No Subject'),
            'from_email' => $fromEmail,
            'from_name' => $fromName ? $this->decodeMimeStr($fromName) : null,
            'to' => $to,
            'cc' => $cc,
            'bcc' => $bcc,
            'body_text' => $body['text'] ?? null,
            'body_html' => $body['html'] ?? null,
            'sent_at' => isset($header->date) ? date('Y-m-d H:i:s', strtotime($header->date)) : now(),
            'received_at' => now(),
            'is_read' => $header->Recent == 0 && $header->Unseen == 0,
            'attachments' => $attachments,
        ];
    }

    /**
     * Get message body (text and HTML)
     */
    protected function getMessageBody(int $messageNumber, $structure): array
    {
        $body = ['text' => null, 'html' => null];

        if (!isset($structure->parts)) {
            // Simple message (not multipart)
            $body['text'] = imap_body($this->connection, $messageNumber);
            
            if ($structure->encoding == 3) { // Base64
                $body['text'] = base64_decode($body['text']);
            } elseif ($structure->encoding == 4) { // Quoted-printable
                $body['text'] = quoted_printable_decode($body['text']);
            }
            
            return $body;
        }

        // Multipart message
        foreach ($structure->parts as $partNumber => $part) {
            $data = imap_fetchbody($this->connection, $messageNumber, $partNumber + 1);
            
            // Decode based on encoding
            if ($part->encoding == 3) {
                $data = base64_decode($data);
            } elseif ($part->encoding == 4) {
                $data = quoted_printable_decode($data);
            }

            // Determine content type
            $mimeType = $this->getMimeType($part);

            if ($mimeType === 'text/plain') {
                $body['text'] = $data;
            } elseif ($mimeType === 'text/html') {
                $body['html'] = $data;
            }
        }

        return $body;
    }

    /**
     * Get attachments from message
     */
    protected function getAttachments(int $messageNumber, $structure): array
    {
        $attachments = [];

        if (!isset($structure->parts)) {
            return $attachments;
        }

        foreach ($structure->parts as $partNumber => $part) {
            if (isset($part->disposition) && strtolower($part->disposition) === 'attachment') {
                $filename = null;
                
                // Get filename
                if (isset($part->dparameters)) {
                    foreach ($part->dparameters as $param) {
                        if (strtolower($param->attribute) === 'filename') {
                            $filename = $this->decodeMimeStr($param->value);
                            break;
                        }
                    }
                }
                
                if (!$filename && isset($part->parameters)) {
                    foreach ($part->parameters as $param) {
                        if (strtolower($param->attribute) === 'name') {
                            $filename = $this->decodeMimeStr($param->value);
                            break;
                        }
                    }
                }

                if ($filename) {
                    $attachments[] = [
                        'name' => $filename,
                        'size' => $part->bytes ?? 0,
                        'type' => $this->getMimeType($part),
                        'part_number' => $partNumber + 1,
                    ];
                }
            }
        }

        return $attachments;
    }

    /**
     * Get MIME type from part
     */
    protected function getMimeType($part): string
    {
        $mimeTypes = [
            0 => 'text',
            1 => 'multipart',
            2 => 'message',
            3 => 'application',
            4 => 'audio',
            5 => 'image',
            6 => 'video',
            7 => 'other',
        ];

        $primaryType = $mimeTypes[$part->type] ?? 'application';
        $subType = strtolower($part->subtype ?? 'octet-stream');

        return "{$primaryType}/{$subType}";
    }

    /**
     * Parse email addresses
     */
    protected function parseAddresses(array $addresses): array
    {
        $result = [];
        
        foreach ($addresses as $address) {
            $result[] = [
                'email' => $address->mailbox . '@' . $address->host,
                'name' => isset($address->personal) ? $this->decodeMimeStr($address->personal) : null,
            ];
        }

        return $result;
    }

    /**
     * Decode MIME encoded strings
     */
    protected function decodeMimeStr(string $string): string
    {
        $decoded = imap_mime_header_decode($string);
        $result = '';
        
        foreach ($decoded as $element) {
            $result .= $element->text;
        }
        
        return $result;
    }

    /**
     * Send email via SMTP
     */
    public function sendMessage(array $messageData): bool
    {
        $smtpConfig = $this->account->smtp_config;
        
        if (!$smtpConfig) {
            throw new \Exception("SMTP configuration not found");
        }

        $host = $smtpConfig['host'] ?? '';
        $port = $smtpConfig['port'] ?? 587;
        $encryption = $smtpConfig['encryption'] ?? 'tls';
        $username = $smtpConfig['username'] ?? $this->account->email;
        $password = decrypt($this->account->password);

        // Use Laravel's mail transport
        $transport = new \Swift_SmtpTransport($host, $port, $encryption);
        $transport->setUsername($username);
        $transport->setPassword($password);

        $mailer = new \Swift_Mailer($transport);

        // Create message
        $message = new \Swift_Message($messageData['subject']);
        $message->setFrom([$this->account->email => $messageData['from_name'] ?? $this->account->account_name]);
        
        // Set recipients
        $to = is_array($messageData['to']) ? $messageData['to'] : [$messageData['to']];
        foreach ($to as $recipient) {
            if (is_array($recipient)) {
                $message->addTo($recipient['email'], $recipient['name'] ?? null);
            } else {
                $message->addTo($recipient);
            }
        }

        // Set CC
        if (!empty($messageData['cc'])) {
            $cc = is_array($messageData['cc']) ? $messageData['cc'] : [$messageData['cc']];
            foreach ($cc as $recipient) {
                if (is_array($recipient)) {
                    $message->addCc($recipient['email'], $recipient['name'] ?? null);
                } else {
                    $message->addCc($recipient);
                }
            }
        }

        // Set BCC
        if (!empty($messageData['bcc'])) {
            $bcc = is_array($messageData['bcc']) ? $messageData['bcc'] : [$messageData['bcc']];
            foreach ($bcc as $recipient) {
                if (is_array($recipient)) {
                    $message->addBcc($recipient['email'], $recipient['name'] ?? null);
                } else {
                    $message->addBcc($recipient);
                }
            }
        }

        // Set body
        if (!empty($messageData['body_html'])) {
            $message->setBody($messageData['body_html'], 'text/html');
            if (!empty($messageData['body_text'])) {
                $message->addPart($messageData['body_text'], 'text/plain');
            }
        } else {
            $message->setBody($messageData['body_text'] ?? '', 'text/plain');
        }

        // Add attachments
        if (!empty($messageData['attachments'])) {
            foreach ($messageData['attachments'] as $attachment) {
                if (isset($attachment['path'])) {
                    $message->attach(\Swift_Attachment::fromPath($attachment['path']));
                }
            }
        }

        try {
            $result = $mailer->send($message);
            return $result > 0;
        } catch (\Exception $e) {
            Log::error("SMTP send error: " . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Close IMAP connection
     */
    public function disconnect(): void
    {
        if ($this->connection) {
            imap_close($this->connection);
            $this->connection = null;
        }
    }

    /**
     * Destructor to ensure connection is closed
     */
    public function __destruct()
    {
        $this->disconnect();
    }
}
