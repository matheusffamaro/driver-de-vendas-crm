<?php

namespace App\Services\Whatsapp;

use App\Models\WhatsappSession;
use App\Models\WhatsappConversation;
use App\Services\Whatsapp\WhatsappConversationService;
use App\Services\Whatsapp\WhatsappMessageService;
use App\Services\Whatsapp\WhatsappAIAgentService;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class WhatsappWebhookService
{
    public function __construct(
        private WhatsappConversationService $conversationService,
        private WhatsappMessageService $messageService,
        private WhatsappAIAgentService $aiAgentService
    ) {}

    /**
     * Handle webhook event
     */
    public function handleWebhook(array $data): array
    {
        $event = $data['event'] ?? null;
        $sessionId = $data['sessionId'] ?? null;

        if (!$sessionId) {
            return [
                'success' => false,
                'message' => 'Session ID required',
            ];
        }

        Log::info("WhatsApp webhook: {$event}", ['sessionId' => $sessionId]);

        $session = WhatsappSession::withTrashed()->find($sessionId);

        if (!$session) {
            return [
                'success' => false,
                'message' => 'Session not found',
            ];
        }

        if ($session->trashed()) {
            return [
                'success' => true,
                'message' => 'Session deleted, ignoring webhook',
            ];
        }

        match($event) {
            'qr_code' => $this->handleQRCodeEvent($session, $data),
            'connected' => $this->handleConnectedEvent($session, $data),
            'disconnected', 'logged_out' => $this->handleDisconnectedEvent($session),
            'message' => $this->handleMessageEvent($session, $data),
            'message_status' => $this->handleMessageStatusEvent($data),
            default => Log::warning("Unknown webhook event: {$event}"),
        };

        return ['success' => true];
    }

    /**
     * Handle QR code event
     */
    private function handleQRCodeEvent(WhatsappSession $session, array $data): void
    {
        $session->update([
            'status' => 'qr_code',
            'qr_code' => $data['qrCode'] ?? $data['qr'] ?? null,
        ]);
    }

    /**
     * Handle connected event
     */
    private function handleConnectedEvent(WhatsappSession $session, array $data): void
    {
        $session->update([
            'status' => 'connected',
            'phone_number' => $data['phoneNumber'] ?? $session->phone_number,
            'qr_code' => null,
            'connected_at' => now(),
            'last_activity_at' => now(),
        ]);
    }

    /**
     * Handle disconnected event
     */
    private function handleDisconnectedEvent(WhatsappSession $session): void
    {
        $session->update([
            'status' => 'disconnected',
            'qr_code' => null,
        ]);
    }

    /**
     * Handle incoming message event
     */
    private function handleMessageEvent(WhatsappSession $session, array $data): void
    {
        $messageType = $data['type'] ?? 'unknown';

        // Skip system messages
        if ($this->messageService->shouldSkipMessage($messageType)) {
            Log::debug('Skipping system message', ['type' => $messageType]);
            return;
        }

        $fromMe = $data['fromMe'] ?? false;
        $remoteJid = $data['from'];
        $isGroup = $data['isGroup'] ?? str_ends_with($remoteJid, '@g.us');

        Log::info('Processing message', [
            'sessionId' => $session->id,
            'from' => $remoteJid,
            'fromMe' => $fromMe,
            'isGroup' => $isGroup,
            'type' => $messageType,
        ]);

        // Extract contact information
        $contactData = $this->extractContactData($data, $isGroup, $fromMe, $remoteJid);

        // Find or create conversation
        $conversation = $this->findOrCreateConversation(
            $session,
            $remoteJid,
            $isGroup,
            $contactData
        );

        if (!$conversation) {
            return;
        }

        // Create message record
        $message = $this->messageService->createIncomingMessage($conversation, $data);

        if (!$message) {
            return; // Message already exists or creation failed
        }

        Log::info('Message saved successfully', [
            'conversationId' => $conversation->id,
            'messageId' => $data['messageId'] ?? $data['id'],
            'direction' => $fromMe ? 'outgoing' : 'incoming',
        ]);

        // Process AI Agent auto-response if applicable
        if ($this->shouldProcessAIResponse($data, $fromMe, $isGroup)) {
            $this->aiAgentService->processAutoResponse(
                $session,
                $conversation,
                $data['text'] ?? $data['body'] ?? ''
            );
        }
    }

    /**
     * Extract contact data from message
     */
    private function extractContactData(
        array $data,
        bool $isGroup,
        bool $fromMe,
        string $remoteJid
    ): array {
        if ($isGroup) {
            return [
                'phone_number' => $data['senderPhone'] ?? 
                    preg_replace('/@(s\.whatsapp\.net|c\.us)$/', '', $data['participant'] ?? ''),
                'contact_name' => !$fromMe ? ($data['senderName'] ?? $data['pushName'] ?? null) : null,
                'group_name' => $data['groupName'] ?? 'Grupo',
            ];
        }

        return [
            'phone_number' => preg_replace('/@(s\.whatsapp\.net|c\.us)$/', '', $remoteJid),
            'contact_name' => !$fromMe ? ($data['pushName'] ?? null) : null,
        ];
    }

    /**
     * Find or create conversation with proper error handling
     */
    private function findOrCreateConversation(
        WhatsappSession $session,
        string $remoteJid,
        bool $isGroup,
        array $contactData
    ): ?WhatsappConversation {
        try {
            $conversation = WhatsappConversation::withTrashed()
                ->where('session_id', $session->id)
                ->where('remote_jid', $remoteJid)
                ->first();

            if (!$conversation) {
                return $this->createNewConversation($session, $remoteJid, $isGroup, $contactData);
            }

            if ($conversation->trashed()) {
                return $this->restoreConversation($conversation, $session, $isGroup, $contactData);
            }

            return $this->updateExistingConversation($conversation, $session, $isGroup, $contactData);

        } catch (\Illuminate\Database\UniqueConstraintViolationException $e) {
            return $this->handleRaceCondition($session, $remoteJid);
        }
    }

    /**
     * Create new conversation
     */
    private function createNewConversation(
        WhatsappSession $session,
        string $remoteJid,
        bool $isGroup,
        array $contactData
    ): WhatsappConversation {
        return WhatsappConversation::create([
            'id' => Str::uuid(),
            'session_id' => $session->id,
            'remote_jid' => $remoteJid,
            'is_group' => $isGroup,
            'group_name' => $isGroup ? $contactData['group_name'] : null,
            'contact_phone' => !$isGroup ? $contactData['phone_number'] : null,
            'contact_name' => !$isGroup ? $contactData['contact_name'] : null,
            'profile_picture' => $contactData['profile_picture'] ?? null,
            'assigned_user_id' => $session->user_id, // Auto-assign to session owner
            'last_message_at' => now(),
            'unread_count' => 1,
        ]);
    }

    /**
     * Restore trashed conversation
     */
    private function restoreConversation(
        WhatsappConversation $conversation,
        WhatsappSession $session,
        bool $isGroup,
        array $contactData
    ): WhatsappConversation {
        $conversation->restore();

        $updateData = [
            'is_group' => $isGroup,
            'group_name' => $isGroup ? $contactData['group_name'] : null,
            'contact_phone' => !$isGroup ? $contactData['phone_number'] : null,
            'contact_name' => !$isGroup ? $contactData['contact_name'] : null,
            'profile_picture' => $contactData['profile_picture'] ?? null,
            'last_message_at' => now(),
            'unread_count' => 1,
            'is_archived' => false,
        ];

        // Auto-assign if not assigned
        if (!$conversation->assigned_user_id && $session->user_id) {
            $updateData['assigned_user_id'] = $session->user_id;
        }

        $conversation->update($updateData);
        return $conversation;
    }

    /**
     * Update existing conversation
     */
    private function updateExistingConversation(
        WhatsappConversation $conversation,
        WhatsappSession $session,
        bool $isGroup,
        array $contactData
    ): WhatsappConversation {
        $updateData = [
            'last_message_at' => now(),
            'unread_count' => $conversation->unread_count + 1,
        ];

        // Auto-assign if not assigned
        if (!$conversation->assigned_user_id && $session->user_id) {
            $updateData['assigned_user_id'] = $session->user_id;
        }

        // Update group name or contact name
        if ($isGroup && !empty($contactData['group_name'])) {
            $updateData['group_name'] = $contactData['group_name'];
        } elseif (!$isGroup && !empty($contactData['contact_name'])) {
            $updateData['contact_name'] = $contactData['contact_name'];
        }

        // Update profile picture if provided
        if (!empty($contactData['profile_picture']) && 
            $contactData['profile_picture'] !== $conversation->profile_picture) {
            $updateData['profile_picture'] = $contactData['profile_picture'];
        }

        $conversation->update($updateData);
        return $conversation;
    }

    /**
     * Handle race condition when creating conversation
     */
    private function handleRaceCondition(
        WhatsappSession $session,
        string $remoteJid
    ): ?WhatsappConversation {
        $conversation = WhatsappConversation::withTrashed()
            ->where('session_id', $session->id)
            ->where('remote_jid', $remoteJid)
            ->first();

        if ($conversation?->trashed()) {
            $conversation->restore();
        }

        if (!$conversation) {
            Log::error('Failed to find conversation after unique constraint violation', [
                'sessionId' => $session->id,
                'remoteJid' => $remoteJid,
            ]);
            return null;
        }

        // Update unread count
        $conversation->increment('unread_count');
        $conversation->update(['last_message_at' => now()]);

        return $conversation;
    }

    /**
     * Handle message status event
     */
    private function handleMessageStatusEvent(array $data): void
    {
        $messageId = $data['messageId'] ?? null;
        $status = $data['status'] ?? null;

        if ($messageId && $status) {
            $this->messageService->updateMessageStatus($messageId, $status);
        }
    }

    /**
     * Check if AI response should be processed
     */
    private function shouldProcessAIResponse(array $data, bool $fromMe, bool $isGroup): bool
    {
        if ($fromMe || $isGroup) {
            return false;
        }

        if (($data['type'] ?? 'text') !== 'text') {
            return false;
        }

        // Skip historical messages
        if ($data['isHistory'] ?? false) {
            return false;
        }

        // Check if message is recent (within last 5 minutes)
        $messageTimestamp = $data['timestamp'] ?? null;
        if ($messageTimestamp) {
            $messageTime = is_numeric($messageTimestamp) ? $messageTimestamp : strtotime($messageTimestamp);
            $isRecent = (time() - $messageTime) < config('whatsapp.ai_agent.message_recent_threshold_seconds');
            
            if (!$isRecent) {
                return false;
            }
        }

        return true;
    }
}
