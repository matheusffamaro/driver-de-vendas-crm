<?php

namespace App\Services\Email;

use App\Models\EmailAccount;

class CampaignSendService
{
    /**
     * Send one email (e.g. one campaign recipient) via the given account.
     * Does not create inbox thread/message.
     *
     * @param  array{email: string, name?: string}  $to
     */
    public function sendOne(EmailAccount $account, array $to, string $subject, string $bodyHtml, string $fromName): bool
    {
        $messageData = [
            'subject' => $subject,
            'from_name' => $fromName,
            'to' => [$to],
            'body_html' => $bodyHtml,
            'body_text' => strip_tags($bodyHtml),
        ];

        if ($account->isOAuthProvider()) {
            return $this->sendViaOAuth($account, $messageData);
        }

        $imapService = new ImapEmailService();
        $imapService->account = $account;

        return $imapService->sendMessage($messageData);
    }

    protected function sendViaOAuth(EmailAccount $account, array $messageData): bool
    {
        $oauthService = new OAuthEmailService();

        if ($account->provider === 'gmail') {
            $gmail = $oauthService->getGmailService($account);
            $rawMessage = $this->buildRawMessage($account->email, $messageData);
            $message = new \Google_Service_Gmail_Message();
            $message->setRaw($rawMessage);
            $gmail->users_messages->send('me', $message);

            return true;
        }

        if ($account->provider === 'outlook') {
            $graph = $oauthService->getGraphClient($account);
            $outlookMessage = [
                'subject' => $messageData['subject'],
                'body' => [
                    'contentType' => 'HTML',
                    'content' => $messageData['body_html'] ?? $messageData['body_text'],
                ],
                'toRecipients' => array_map(fn ($t) => [
                    'emailAddress' => [
                        'address' => $t['email'],
                        'name' => $t['name'] ?? null,
                    ],
                ], $messageData['to']),
            ];
            $graph->createRequest('POST', '/me/sendMail')
                ->attachBody(['message' => $outlookMessage])
                ->execute();

            return true;
        }

        return false;
    }

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
}
