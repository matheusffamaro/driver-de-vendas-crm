<?php

namespace App\Services\Whatsapp;

use App\Models\WhatsappMessage;
use App\Models\WhatsappConversation;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Support\Collection;
use Illuminate\Http\UploadedFile;

class WhatsappMessageService
{
    private string $serviceUrl;
    private int $timeout;
    private int $mediaTimeout;

    public function __construct()
    {
        $this->serviceUrl = config('whatsapp.service.url');
        $this->timeout = config('whatsapp.service.timeout');
        $this->mediaTimeout = config('whatsapp.service.media_timeout');
    }

    /**
     * List messages for a conversation
     */
    public function listMessages(
        WhatsappConversation $conversation,
        int $limit = 100
    ): Collection {
        return WhatsappMessage::where('conversation_id', $conversation->id)
            ->with('sender:id,name')
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get();
    }

    /**
     * Send text message
     */
    public function sendTextMessage(
        WhatsappConversation $conversation,
        string $content,
        User $sender
    ): array {
        $session = $conversation->session;

        if (!$session) {
            return [
                'success' => false,
                'message' => 'Sessão WhatsApp não encontrada para esta conversa.',
            ];
        }

        try {
            $sendToJid = $this->resolveSendJid($conversation);
            if (!$sendToJid) {
                return [
                    'success' => false,
                    'message' => 'Não foi possível enviar: contato com identificador temporário (LID) sem número de telefone válido.',
                ];
            }

            $response = Http::timeout($this->timeout)
                ->post("{$this->serviceUrl}/messages/send/text", [
                    'sessionId' => $session->id,
                    'to' => $sendToJid,
                    'text' => $content,
                ]);

            if (!$response->successful()) {
                Log::error('WhatsApp send text message failed', [
                    'conversation_id' => $conversation->id,
                    'status' => $response->status(),
                    'response' => $response->body(),
                ]);

                return [
                    'success' => false,
                    'message' => 'Erro ao enviar mensagem.',
                ];
            }

            $message = $this->createOutgoingMessage(
                $conversation,
                'text',
                $content,
                $sender,
                $response->json('data.messageId')
            );

            $conversation->update(['last_message_at' => now()]);

            return [
                'success' => true,
                'message' => $message,
            ];
        } catch (\Exception $e) {
            Log::error('WhatsApp send message error', [
                'error' => $e->getMessage(),
                'conversation_id' => $conversation->id,
            ]);

            return [
                'success' => false,
                'message' => 'Erro ao enviar mensagem.',
            ];
        }
    }

    /**
     * Send media message
     */
    public function sendMediaMessage(
        WhatsappConversation $conversation,
        UploadedFile $file,
        string $messageType,
        User $sender,
        ?string $caption = null
    ): array {
        $session = $conversation->session;

        if (!$session) {
            return [
                'success' => false,
                'message' => 'Sessão WhatsApp não encontrada para esta conversa.',
            ];
        }

        try {
            $sendToJid = $this->resolveSendJid($conversation);
            if (!$sendToJid) {
                return [
                    'success' => false,
                    'message' => 'Não foi possível enviar: contato com identificador temporário (LID) sem número de telefone válido.',
                ];
            }

            // Read file and convert to base64
            $fileContent = file_get_contents($file->getRealPath());
            $base64 = base64_encode($fileContent);

            $response = Http::timeout($this->mediaTimeout)
                ->post("{$this->serviceUrl}/messages/send/media", [
                    'sessionId' => $session->id,
                    'to' => $sendToJid,
                    'type' => $messageType,
                    'media' => $base64,
                    'mimetype' => $file->getMimeType(),
                    'filename' => $file->getClientOriginalName(),
                    'caption' => $caption,
                ]);

            if (!$response->successful()) {
                Log::error('WhatsApp send media message failed', [
                    'conversation_id' => $conversation->id,
                    'status' => $response->status(),
                    'response' => $response->body(),
                ]);

                return [
                    'success' => false,
                    'message' => 'Erro ao enviar mídia.',
                ];
            }

            $message = $this->createOutgoingMessage(
                $conversation,
                $messageType,
                $caption ?: $file->getClientOriginalName(),
                $sender,
                $response->json('data.messageId')
            );

            $conversation->update(['last_message_at' => now()]);

            return [
                'success' => true,
                'message' => $message,
            ];
        } catch (\Exception $e) {
            Log::error('WhatsApp send media error', [
                'error' => $e->getMessage(),
                'conversation_id' => $conversation->id,
            ]);

            return [
                'success' => false,
                'message' => 'Erro ao enviar mídia.',
            ];
        }
    }

    /**
     * Create outgoing message record
     */
    private function createOutgoingMessage(
        WhatsappConversation $conversation,
        string $type,
        string $content,
        User $sender,
        ?string $messageId = null
    ): WhatsappMessage {
        return WhatsappMessage::create([
            'id' => Str::uuid(),
            'conversation_id' => $conversation->id,
            'message_id' => $messageId,
            'direction' => 'outgoing',
            'type' => $type,
            'content' => $content,
            'status' => 'sent',
            'sender_id' => $sender->id,
            'sent_at' => now(),
        ]);
    }

    /**
     * Create incoming message record
     */
    public function createIncomingMessage(
        WhatsappConversation $conversation,
        array $data
    ): ?WhatsappMessage {
        // Check if message already exists
        $messageId = $data['messageId'] ?? $data['id'] ?? null;
        if ($messageId && WhatsappMessage::where('message_id', $messageId)->exists()) {
            Log::info('Message already exists, skipping', ['messageId' => $messageId]);
            return null;
        }

        return WhatsappMessage::create([
            'id' => Str::uuid(),
            'conversation_id' => $conversation->id,
            'message_id' => $messageId,
            'direction' => ($data['fromMe'] ?? false) ? 'outgoing' : 'incoming',
            'type' => $data['type'] ?? 'text',
            'content' => $data['text'] ?? $data['body'] ?? null,
            'media_url' => $data['mediaUrl'] ?? null,
            'media_filename' => $data['mediaFilename'] ?? null,
            'status' => ($data['fromMe'] ?? false) ? 'sent' : 'delivered',
            'sender_name' => !($data['fromMe'] ?? false) 
                ? ($data['senderName'] ?? $data['pushName'] ?? null) 
                : null,
            'sender_phone' => !($data['fromMe'] ?? false) 
                ? ($data['senderPhone'] ?? null) 
                : null,
        ]);
    }

    /**
     * Update message status
     */
    public function updateMessageStatus(string $messageId, string $status): void
    {
        $message = WhatsappMessage::where('message_id', $messageId)->first();

        if (!$message) {
            return;
        }

        $updateData = ['status' => $status];

        if ($status === 'delivered') {
            $updateData['delivered_at'] = now();
        }

        if ($status === 'read') {
            $updateData['read_at'] = now();
        }

        $message->update($updateData);
    }

    /**
     * Fetch conversation history from WhatsApp
     */
    public function fetchConversationHistory(
        WhatsappConversation $conversation,
        int $count = 50
    ): array {
        $session = $conversation->session;

        try {
            $response = Http::timeout($this->timeout)
                ->post("{$this->serviceUrl}/sessions/{$session->id}/fetch-history", [
                    'jid' => $conversation->remote_jid,
                    'count' => $count,
                ]);

            if (!$response->successful()) {
                return [
                    'success' => false,
                    'message' => 'Failed to fetch history',
                    'error' => $response->json(),
                ];
            }

            $messages = $response->json('data') ?? [];
            $savedCount = 0;

            // Save fetched messages
            foreach ($messages as $messageData) {
                if ($this->createIncomingMessage($conversation, $messageData)) {
                    $savedCount++;
                }
            }

            // Update last_message_at
            $lastMessage = $conversation->messages()->latest('created_at')->first();
            if ($lastMessage) {
                $conversation->update(['last_message_at' => $lastMessage->created_at]);
            }

            return [
                'success' => true,
                'message' => "Fetched {$savedCount} new messages",
                'total_fetched' => count($messages),
                'new_saved' => $savedCount,
            ];
        } catch (\Exception $e) {
            Log::error('Error fetching conversation history', [
                'error' => $e->getMessage(),
                'conversation_id' => $conversation->id,
            ]);

            return [
                'success' => false,
                'message' => 'Error fetching history: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Resolve the JID to use for sending, handling LID JIDs by falling back to contact_phone.
     */
    private function resolveSendJid(WhatsappConversation $conversation): ?string
    {
        $jid = $conversation->remote_jid;

        if (!str_ends_with($jid, '@lid')) {
            return $jid;
        }

        $contactPhone = preg_replace('/\D/', '', $conversation->contact_phone ?? '');
        if (strlen($contactPhone) >= 10) {
            $resolved = $contactPhone . '@s.whatsapp.net';
            Log::info('Resolved LID to phone for sending', [
                'conversationId' => $conversation->id,
                'originalJid' => $jid,
                'resolvedJid' => $resolved,
            ]);
            return $resolved;
        }

        Log::error('Cannot send to LID JID - no valid phone number available', [
            'conversationId' => $conversation->id,
            'remoteJid' => $jid,
            'contactPhone' => $conversation->contact_phone,
        ]);
        return null;
    }

    /**
     * Check if message should be skipped (system messages)
     */
    public function shouldSkipMessage(string $messageType): bool
    {
        $systemMessageTypes = config('whatsapp.system_message_types');
        return in_array($messageType, $systemMessageTypes);
    }

    /**
     * Check if user can send message in conversation
     */
    public function canUserSendMessage(User $user, WhatsappConversation $conversation): array
    {
        // Check tenant isolation
        if ($conversation->session?->tenant_id !== $user->tenant_id) {
            return [
                'allowed' => false,
                'message' => 'Acesso negado.',
            ];
        }

        // Admins and Managers can send in all conversations
        if ($user->isAdmin() || $user->isManager()) {
            return ['allowed' => true];
        }

        // Sales users: Check session ownership
        if ($conversation->session?->user_id !== $user->id) {
            return [
                'allowed' => false,
                'message' => 'Acesso negado. Você só pode enviar mensagens em sessões próprias.',
            ];
        }

        // Auto-assign if unassigned
        if ($conversation->assigned_user_id === null) {
            $conversation->update(['assigned_user_id' => $user->id]);
        }

        // Check conversation assignment
        if ($conversation->assigned_user_id !== $user->id) {
            return [
                'allowed' => false,
                'message' => 'Acesso negado. Esta conversa está atribuída a outro usuário.',
            ];
        }

        return ['allowed' => true];
    }
}
