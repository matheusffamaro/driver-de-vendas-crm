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

        // #region agent log H1,H2,H3,H5
        $logData = json_encode(['sessionId'=>'09ce68','location'=>'WhatsappWebhookService.php:115','message'=>'handleMessageEvent','data'=>['session_id'=>$session->id,'session_phone'=>$session->phone_number,'remote_jid'=>$remoteJid,'fromMe'=>$fromMe,'isGroup'=>$isGroup,'type'=>$messageType,'pushName'=>$data['pushName']??null,'senderName'=>$data['senderName']??null],'timestamp'=>round(microtime(true)*1000),'hypothesisId'=>'H1,H2,H3,H5'],JSON_UNESCAPED_SLASHES)."\n";@file_put_contents('/var/www/html/storage/logs/debug-09ce68.log',$logData,FILE_APPEND);
        // #endregion

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
        
        // #region agent log H1,H2,H4
        $logData2 = json_encode(['sessionId'=>'09ce68','location'=>'WhatsappWebhookService.php:136','message'=>'Conversation found/created','data'=>['conversation_id'=>$conversation?->id,'conversation_contact'=>$conversation?->contact_name,'conversation_phone'=>$conversation?->contact_phone,'conversation_jid'=>$conversation?->remote_jid,'fromMe'=>$fromMe,'created_new'=>false],'timestamp'=>round(microtime(true)*1000),'hypothesisId'=>'H1,H2,H4'],JSON_UNESCAPED_SLASHES)."\n";@file_put_contents('/var/www/html/storage/logs/debug-09ce68.log',$logData2,FILE_APPEND);
        // #endregion

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

    private function isLidJid(string $jid): bool
    {
        return str_ends_with($jid, '@lid');
    }

    private function stripJidSuffix(string $jid): string
    {
        return preg_replace('/@(s\.whatsapp\.net|c\.us|lid|g\.us)$/', '', $jid);
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
                'phone_number' => $data['senderPhone'] ?? $this->stripJidSuffix($data['participant'] ?? ''),
                'contact_name' => !$fromMe ? ($data['senderName'] ?? $data['pushName'] ?? null) : null,
                'group_name' => $data['groupName'] ?? 'Grupo',
            ];
        }

        return [
            'phone_number' => $data['senderPhone'] ?? $this->stripJidSuffix($remoteJid),
            'contact_name' => !$fromMe ? ($data['pushName'] ?? null) : null,
            'is_lid' => $data['isLid'] ?? $this->isLidJid($remoteJid),
            'original_lid_jid' => $data['originalLidJid'] ?? null,
            'profile_picture' => $data['profilePicture'] ?? null,
        ];
    }

    /**
     * Find or create conversation with proper error handling.
     * Handles LID JIDs by matching on lid_jid, contact_phone, or original LID JID
     * to prevent duplicate conversations for the same contact.
     */
    private function findOrCreateConversation(
        WhatsappSession $session,
        string $remoteJid,
        bool $isGroup,
        array $contactData
    ): ?WhatsappConversation {
        try {
            // 1) Exact JID match
            $conversation = WhatsappConversation::withTrashed()
                ->where('session_id', $session->id)
                ->where('remote_jid', $remoteJid)
                ->first();

            // 2) If not found and not a group, try LID-based matching
            if (!$conversation && !$isGroup) {
                $isLid = $contactData['is_lid'] ?? $this->isLidJid($remoteJid);
                $originalLid = $contactData['original_lid_jid'] ?? null;

                if ($isLid) {
                    // Current JID is a LID - look for conversation with this LID stored
                    $conversation = WhatsappConversation::withTrashed()
                        ->where('session_id', $session->id)
                        ->where('lid_jid', $remoteJid)
                        ->first();
                } elseif ($originalLid) {
                    // Node.js resolved LID to phone JID - look for conv with the original LID as remote_jid
                    $conversation = WhatsappConversation::withTrashed()
                        ->where('session_id', $session->id)
                        ->where('remote_jid', $originalLid)
                        ->first();

                    if ($conversation) {
                        // Update remote_jid from LID to resolved phone JID
                        $conversation->update([
                            'remote_jid' => $remoteJid,
                            'lid_jid' => $originalLid,
                        ]);
                        Log::info('Conversation JID updated from LID to phone', [
                            'lid' => $originalLid,
                            'phone_jid' => $remoteJid,
                        ]);
                    }
                }

                // 3) Fallback: match by contact_phone (normalized digits only)
                if (!$conversation) {
                    $phone = $contactData['phone_number'] ?? $this->stripJidSuffix($remoteJid);
                    $normalizedPhone = preg_replace('/\D/', '', $phone); // Remove tudo exceto dígitos
                    
                    if (!empty($normalizedPhone) && strlen($normalizedPhone) >= 10 && strlen($normalizedPhone) <= 15) {
                        // Buscar TODAS as conversas com esse telefone
                        $candidates = WhatsappConversation::withTrashed()
                            ->where('session_id', $session->id)
                            ->where('is_group', false)
                            ->get()
                            ->filter(function ($conv) use ($normalizedPhone) {
                                $convPhone = preg_replace('/\D/', '', $conv->contact_phone ?? '');
                                return $convPhone === $normalizedPhone;
                            });

                        if ($candidates->isNotEmpty()) {
                            // Se múltiplas, pegar a melhor
                            $conversation = $this->selectBestConversation($candidates);
                            
                            Log::info('Conversation matched by normalized phone', [
                                'normalizedPhone' => $normalizedPhone,
                                'candidatesFound' => $candidates->count(),
                                'selected' => $conversation->id,
                                'existing_jid' => $conversation->remote_jid,
                                'new_jid' => $remoteJid,
                            ]);
                            
                            // Se encontrou mais de 1, mesclar duplicatas em background
                            if ($candidates->count() > 1) {
                                $this->mergeDuplicateConversations($candidates, $conversation);
                            }
                        }
                    }
                }
            }

            if (!$conversation) {
                // #region agent log H1,H4
                $logData = json_encode(['sessionId'=>'09ce68','location'=>'WhatsappWebhookService.php:295','message'=>'Creating NEW conversation','data'=>['session_id'=>$session->id,'remote_jid'=>$remoteJid,'contact_phone'=>$contactData['phone_number']??null,'contact_name'=>$contactData['contact_name']??null,'DUPLICATE_CREATED'=>true],'timestamp'=>round(microtime(true)*1000),'hypothesisId'=>'H1,H4'],JSON_UNESCAPED_SLASHES)."\n";@file_put_contents('/var/www/html/storage/logs/debug-09ce68.log',$logData,FILE_APPEND);
                // #endregion
                return $this->createNewConversation($session, $remoteJid, $isGroup, $contactData);
            }

            if ($conversation->trashed()) {
                return $this->restoreConversation($conversation, $session, $isGroup, $contactData);
            }

            // #region agent log H1,H4
            $logData2 = json_encode(['sessionId'=>'09ce68','location'=>'WhatsappWebhookService.php:303','message'=>'Updating EXISTING conversation','data'=>['conversation_id'=>$conversation->id,'conversation_contact'=>$conversation->contact_name,'conversation_phone'=>$conversation->contact_phone,'conversation_jid'=>$conversation->remote_jid],'timestamp'=>round(microtime(true)*1000),'hypothesisId'=>'H1,H4'],JSON_UNESCAPED_SLASHES)."\n";@file_put_contents('/var/www/html/storage/logs/debug-09ce68.log',$logData2,FILE_APPEND);
            // #endregion
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
        $isLid = $contactData['is_lid'] ?? $this->isLidJid($remoteJid);
        $lidJid = $isLid ? $remoteJid : ($contactData['original_lid_jid'] ?? null);

        return WhatsappConversation::create([
            'id' => Str::uuid(),
            'session_id' => $session->id,
            'remote_jid' => $remoteJid,
            'lid_jid' => $lidJid,
            'is_group' => $isGroup,
            'group_name' => $isGroup ? ($contactData['group_name'] ?? 'Grupo') : null,
            'contact_phone' => $isGroup
                ? ($contactData['phone_number'] ?? $this->stripJidSuffix($remoteJid))
                : ($contactData['phone_number'] ?? null),
            'contact_name' => $isGroup
                ? ($contactData['group_name'] ?? 'Grupo')
                : ($contactData['contact_name'] ?? null),
            'profile_picture' => $contactData['profile_picture'] ?? null,
            'assigned_user_id' => $session->user_id,
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
            'group_name' => $isGroup ? ($contactData['group_name'] ?? 'Grupo') : null,
            'contact_phone' => $isGroup
                ? ($contactData['phone_number'] ?? preg_replace('/@.*$/', '', $conversation->remote_jid))
                : ($contactData['phone_number'] ?? null),
            'contact_name' => $isGroup
                ? ($contactData['group_name'] ?? 'Grupo')
                : ($contactData['contact_name'] ?? null),
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

        if (!$conversation->assigned_user_id && $session->user_id) {
            $updateData['assigned_user_id'] = $session->user_id;
        }

        if ($isGroup && !empty($contactData['group_name'])) {
            $updateData['group_name'] = $contactData['group_name'];
        } elseif (!$isGroup && !empty($contactData['contact_name'])) {
            $updateData['contact_name'] = $contactData['contact_name'];
        }

        if (!empty($contactData['profile_picture']) && 
            $contactData['profile_picture'] !== $conversation->profile_picture) {
            $updateData['profile_picture'] = $contactData['profile_picture'];
        }

        // Store LID JID for future cross-reference
        $originalLid = $contactData['original_lid_jid'] ?? null;
        if ($originalLid && !$conversation->lid_jid) {
            $updateData['lid_jid'] = $originalLid;
        }

        // If the current contact_phone is empty but we have one, set it
        if (!$isGroup && empty($conversation->contact_phone) && !empty($contactData['phone_number'])) {
            $updateData['contact_phone'] = $contactData['phone_number'];
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

    /**
     * Select the best conversation from multiple candidates
     * Priority: @s.whatsapp.net > most messages > most recent
     */
    private function selectBestConversation($conversations): WhatsappConversation
    {
        return $conversations->sortByDesc(function ($conv) {
            $score = 0;
            
            // Preferir @s.whatsapp.net (JID de telefone padrão)
            if (str_ends_with($conv->remote_jid, '@s.whatsapp.net')) {
                $score += 1000000;
            }
            
            // Quantidade de mensagens
            $msgCount = WhatsappMessage::where('conversation_id', $conv->id)->count();
            $score += $msgCount * 100;
            
            // Mais recente
            if ($conv->last_message_at) {
                $score += $conv->last_message_at->timestamp;
            }
            
            return $score;
        })->first();
    }

    /**
     * Merge duplicate conversations into the selected one
     * Moves messages and deletes duplicates
     */
    private function mergeDuplicateConversations($candidates, $keepConversation): void
    {
        try {
            $duplicates = $candidates->filter(fn($c) => $c->id !== $keepConversation->id);
            
            foreach ($duplicates as $duplicate) {
                // Mover todas as mensagens para a conversa principal
                WhatsappMessage::where('conversation_id', $duplicate->id)
                    ->update(['conversation_id' => $keepConversation->id]);
                
                Log::info('Merged duplicate conversation', [
                    'kept' => $keepConversation->id,
                    'duplicate' => $duplicate->id,
                    'duplicateJid' => $duplicate->remote_jid,
                ]);
                
                // Deletar a duplicata
                $duplicate->delete();
            }
            
            Log::info('Duplicate conversations merged successfully', [
                'kept' => $keepConversation->id,
                'merged_count' => $duplicates->count(),
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to merge duplicate conversations', [
                'error' => $e->getMessage(),
                'kept' => $keepConversation->id,
            ]);
        }
    }
}
