<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EmailAccount;
use App\Models\EmailAddonUsage;
use App\Models\PipelineCard;
use App\Models\PipelineCardEmail;
use App\Services\Email\OAuthEmailService;
use App\Services\Email\ImapEmailService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class PipelineCardEmailController extends Controller
{
    /**
     * SECURITY: Get card for tenant (prevents cross-tenant access)
     */
    private function getCardForTenant(string $cardId, string $tenantId): PipelineCard
    {
        return PipelineCard::whereHas('pipeline', fn($q) => $q->where('tenant_id', $tenantId))
            ->where('id', $cardId)
            ->firstOrFail();
    }

    /**
     * List emails for a card
     */
    public function index(Request $request, string $pipelineId, string $cardId): JsonResponse
    {
        $card = $this->getCardForTenant($cardId, $request->user()->tenant_id);
        
        $emails = PipelineCardEmail::where('pipeline_card_id', $cardId)
            ->with('user:id,name,email')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $emails,
        ]);
    }

    /**
     * Send and store an email
     */
    public function store(Request $request, string $pipelineId, string $cardId): JsonResponse
    {
        $card = $this->getCardForTenant($cardId, $request->user()->tenant_id);

        $tenant = $request->user()->tenant;
        if (!$tenant->email_addon_enabled) {
            return response()->json([
                'success' => false,
                'message' => 'Para enviar propostas por email, você precisa ativar o módulo de Email.',
                'error_code' => 'EMAIL_ADDON_REQUIRED',
                'addon_url' => '/settings?tab=plan',
            ], 403);
        }

        $validated = $request->validate([
            'account_id' => 'nullable|uuid',
            'to' => 'required|email',
            'cc' => 'nullable|string',
            'bcc' => 'nullable|string',
            'subject' => 'required|string|max:255',
            'body' => 'required|string',
        ]);

        try {
            $account = $this->resolveEmailAccount($request, $validated['account_id'] ?? null);

            if (!$account) {
                return response()->json([
                    'success' => false,
                    'message' => 'Nenhuma conta de email conectada. Conecte uma conta em Configurações > Email.',
                    'error_code' => 'NO_EMAIL_ACCOUNT',
                ], 422);
            }

            $messageData = [
                'subject' => $validated['subject'],
                'from_name' => $account->account_name,
                'to' => [['email' => $validated['to']]],
                'cc' => $validated['cc'] ? array_map(fn($e) => ['email' => trim($e)], explode(',', $validated['cc'])) : null,
                'bcc' => $validated['bcc'] ? array_map(fn($e) => ['email' => trim($e)], explode(',', $validated['bcc'])) : null,
                'body_html' => $validated['body'],
                'body_text' => strip_tags($validated['body']),
            ];

            $sent = $this->sendViaAccount($account, $messageData);

            $email = PipelineCardEmail::create([
                'id' => Str::uuid(),
                'pipeline_card_id' => $cardId,
                'user_id' => auth()->id(),
                'to' => $validated['to'],
                'cc' => $validated['cc'] ?? null,
                'bcc' => $validated['bcc'] ?? null,
                'subject' => $validated['subject'],
                'body' => $validated['body'],
                'status' => $sent ? 'sent' : 'failed',
                'sent_at' => $sent ? now() : null,
            ]);

            if ($sent) {
                $usage = EmailAddonUsage::getCurrentMonthUsage($account->tenant_id);
                $usage->incrementSent();
            }

            return response()->json([
                'success' => $sent,
                'message' => $sent ? 'Email enviado com sucesso' : 'Email salvo mas falha no envio',
                'data' => $email->load('user:id,name,email'),
            ], $sent ? 201 : 207);
        } catch (\Exception $e) {
            Log::error('PipelineCardEmail send error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Erro ao enviar email: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete an email record
     */
    public function destroy(Request $request, string $pipelineId, string $cardId, string $emailId): JsonResponse
    {
        $card = $this->getCardForTenant($cardId, $request->user()->tenant_id);
        
        $email = PipelineCardEmail::where('pipeline_card_id', $cardId)
            ->where('id', $emailId)
            ->firstOrFail();

        $email->delete();

        return response()->json([
            'success' => true,
            'message' => 'Email removido',
        ]);
    }

    private function resolveEmailAccount(Request $request, ?string $accountId): ?EmailAccount
    {
        $tenantId = $request->user()->tenant_id;

        if ($accountId) {
            return EmailAccount::where('id', $accountId)
                ->where('tenant_id', $tenantId)
                ->where('is_active', true)
                ->first();
        }

        return EmailAccount::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->orderBy('created_at', 'asc')
            ->first();
    }

    private function sendViaAccount(EmailAccount $account, array $messageData): bool
    {
        if ($account->isOAuthProvider()) {
            return $this->sendViaOAuth($account, $messageData);
        }

        return $this->sendViaImap($account, $messageData);
    }

    private function sendViaOAuth(EmailAccount $account, array $messageData): bool
    {
        $oauthService = new OAuthEmailService();

        if ($account->provider === 'gmail') {
            $gmail = $oauthService->getGmailService($account);

            $to = implode(', ', array_map(fn($t) => isset($t['name']) ? "\"{$t['name']}\" <{$t['email']}>" : $t['email'], $messageData['to']));
            $raw = "From: {$account->email}\r\nTo: {$to}\r\nSubject: {$messageData['subject']}\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=utf-8\r\n\r\n" . ($messageData['body_html'] ?? $messageData['body_text']);

            $message = new \Google_Service_Gmail_Message();
            $message->setRaw(base64_encode($raw));
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
                'toRecipients' => array_map(fn($t) => [
                    'emailAddress' => ['address' => $t['email'], 'name' => $t['name'] ?? null],
                ], $messageData['to']),
            ];

            if (!empty($messageData['cc'])) {
                $outlookMessage['ccRecipients'] = array_map(fn($c) => [
                    'emailAddress' => ['address' => $c['email'], 'name' => $c['name'] ?? null],
                ], $messageData['cc']);
            }

            $graph->createRequest('POST', '/me/sendMail')
                ->attachBody(['message' => $outlookMessage])
                ->execute();

            return true;
        }

        return false;
    }

    private function sendViaImap(EmailAccount $account, array $messageData): bool
    {
        $imapService = new ImapEmailService();
        $imapService->connect($account);

        try {
            return $imapService->sendMessage($messageData);
        } finally {
            $imapService->disconnect();
        }
    }
}
