<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WhatsappSession;
use App\Models\WhatsappConversation;
use App\Models\WhatsappMessage;
use App\Models\WhatsappQuickReply;
use App\Models\WhatsappAssignmentQueue;
use App\Models\Client;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class WhatsappController extends Controller
{
    private string $serviceUrl;
    private int $timeout = 30;

    public function __construct()
    {
        $this->serviceUrl = config('services.whatsapp.url', 'http://whatsapp:3001');
    }

    /**
     * SECURITY: Get session for tenant (prevents cross-tenant access)
     */
    private function getSessionForTenant(string $sessionId, string $tenantId): WhatsappSession
    {
        return WhatsappSession::where('id', $sessionId)
            ->where('tenant_id', $tenantId)
            ->firstOrFail();
    }

    // ==========================================
    // SESSIONS
    // ==========================================

    /**
     * List all sessions.
     */
    public function listSessions(): JsonResponse
    {
        $user = auth()->user();
        $tenantId = $user?->tenant_id;

        $query = WhatsappSession::query()
            ->when($tenantId, fn($q) => $q->where('tenant_id', $tenantId));

        // SECURITY: Sales users see only their own sessions
        // Admins and Managers see all sessions
        if ($user && !$user->isAdmin() && !$user->isManager()) {
            $query->where('user_id', $user->id);
        }

        $sessions = $query->orderByDesc('connected_at')->get();

        return response()->json([
            'success' => true,
            'data' => $sessions,
        ]);
    }

    /**
     * Create a new session.
     */
    public function createSession(Request $request): JsonResponse
    {
        $request->validate([
            'phone_number' => 'required|string',
            'session_name' => 'nullable|string',
            'is_global' => 'nullable|boolean',
        ]);

        $user = $request->user();
        $tenantId = $user?->tenant_id;

        // Check if session already exists (scoped by tenant when available)
        $existing = WhatsappSession::withTrashed()
            ->where('phone_number', $request->phone_number)
            ->when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
            ->first();

        if ($existing) {
            if ($existing->trashed()) {
                $existing->restore();
            }
            $session = $existing;
            $updates = [
                'session_name' => $request->session_name ?? $existing->session_name,
                'status' => 'connecting',
            ];
            $isGlobal = $request->boolean('is_global', $existing->user_id === null);
            $updates['user_id'] = $isGlobal ? null : ($request->user()?->id ?? $existing->user_id);
            $session->update($updates);
        } else {
            // SECURITY: Only admins/managers can create global sessions
            // Sales users always create sessions assigned to themselves
            $isGlobal = false;
            $userId = $user ? $user->id : null;

            if ($user && ($user->isAdmin() || $user->isManager())) {
                $isGlobal = $request->boolean('is_global', false);
                $userId = $isGlobal ? null : $user->id;
            }

            $session = WhatsappSession::create([
                'id' => Str::uuid(),
                'tenant_id' => $tenantId,
                'user_id' => $userId,
                'phone_number' => $request->phone_number,
                'session_name' => $request->session_name,
                'status' => 'connecting',
            ]);
        }

        try {
            $response = Http::timeout($this->timeout)->post("{$this->serviceUrl}/sessions", [
                'sessionId' => $session->id,
                'phoneNumber' => $session->phone_number,
            ]);

            if ($response->successful()) {
                return response()->json([
                    'success' => true,
                    'message' => 'Sessão iniciada com sucesso. Aguardando QR Code.',
                    'data' => ['session' => $session],
                ]);
            } else {
                $session->update(['status' => 'failed']);
                return response()->json([
                    'success' => false,
                    'message' => 'Erro ao iniciar sessão no serviço WhatsApp.',
                ], $response->status());
            }
        } catch (\Exception $e) {
            Log::error('WhatsApp session creation error', [
                'message' => $e->getMessage(),
                'session_id' => $session->id,
                'service_url' => $this->serviceUrl,
            ]);
            $session->update(['status' => 'failed']);
            $message = 'Erro de comunicação com o serviço WhatsApp.';
            if (config('app.debug')) {
                $message .= ' Detalhe: ' . $e->getMessage();
                $message .= '. Verifique se o serviço está rodando e se WHATSAPP_SERVICE_URL no .env está correto (ex.: http://localhost:3002 se a API rodar fora do Docker).';
            }
            return response()->json([
                'success' => false,
                'message' => $message,
            ], 500);
        }
    }

    /**
     * Get QR Code for a session.
     */
    public function getQRCode(Request $request, string $sessionId): JsonResponse
    {
        // SECURITY: Verify tenant ownership
        $session = $this->getSessionForTenant($sessionId, $request->user()->tenant_id);

        if ($session->status === 'connected') {
            return response()->json([
                'success' => true,
                'data' => [
                    'status' => 'connected',
                    'message' => 'Sessão já está conectada.',
                ],
            ]);
        }

        if ($session->qr_code) {
            return response()->json([
                'success' => true,
                'data' => [
                    'status' => $session->status,
                    'qr_code' => $session->qr_code,
                ],
            ]);
        }

        try {
            $response = Http::timeout($this->timeout)->get("{$this->serviceUrl}/sessions/{$sessionId}/qr-code");

            if ($response->successful()) {
                $data = $response->json();
                if (isset($data['data']['qrCode'])) {
                    $session->update(['qr_code' => $data['data']['qrCode']]);
                }
                return response()->json([
                    'success' => true,
                    'data' => [
                        'status' => $data['data']['status'] ?? $session->status,
                        'qr_code' => $data['data']['qrCode'] ?? null,
                    ],
                ]);
            }
        } catch (\Exception $e) {
            Log::error('WhatsApp QR code error: ' . $e->getMessage());
        }

        return response()->json([
            'success' => true,
            'data' => [
                'status' => $session->status,
                'qr_code' => null,
                'message' => 'QR Code não disponível.',
            ],
        ]);
    }

    /**
     * Get session status.
     */
    public function getSessionStatus(Request $request, string $sessionId): JsonResponse
    {
        // SECURITY: Verify tenant ownership
        $session = $this->getSessionForTenant($sessionId, $request->user()->tenant_id);

        return response()->json([
            'success' => true,
            'data' => [
                'status' => $session->status,
                'phone_number' => $session->phone_number,
                'connected_at' => $session->connected_at,
            ],
        ]);
    }

    /**
     * Update session (owner / global). Only admins/managers.
     * Use to set "não global" and link the number to a specific seller (user_id).
     */
    public function updateSession(Request $request, string $sessionId): JsonResponse
    {
        $user = $request->user();
        $session = $this->getSessionForTenant($sessionId, $user?->tenant_id);

        if (!$user || (!$user->isAdmin() && !$user->isManager())) {
            return response()->json([
                'success' => false,
                'message' => 'Apenas administradores ou gerentes podem alterar a sessão.',
            ], 403);
        }

        $request->validate([
            'user_id' => 'nullable|uuid|exists:users,id',
            'is_global' => 'nullable|boolean',
        ]);

        $userId = $request->has('is_global') && $request->boolean('is_global')
            ? null
            : ($request->input('user_id', $session->user_id));
        $session->update([
            'user_id' => $userId,
        ]);

        if ($userId !== null) {
            WhatsappConversation::where('session_id', $session->id)
                ->update(['assigned_user_id' => $userId]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Sessão atualizada. Conversas vinculadas ao dono da sessão.',
            'data' => $session->fresh(),
        ]);
    }

    /**
     * Disconnect a session.
     */
    public function disconnectSession(Request $request, string $sessionId): JsonResponse
    {
        // SECURITY: Verify tenant ownership
        $session = $this->getSessionForTenant($sessionId, $request->user()->tenant_id);

        try {
            Http::timeout($this->timeout)->post("{$this->serviceUrl}/sessions/{$sessionId}/disconnect");
        } catch (\Exception $e) {
            Log::error('WhatsApp disconnect error: ' . $e->getMessage());
        }

        $session->update(['status' => 'disconnected', 'qr_code' => null]);

        return response()->json([
            'success' => true,
            'message' => 'Sessão desconectada.',
        ]);
    }

    /**
     * Delete a session.
     */
    public function deleteSession(string $sessionId): JsonResponse
    {
        $user = auth()->user();
        $session = WhatsappSession::findOrFail($sessionId);

        if ($user && $session->tenant_id && $session->tenant_id !== $user->tenant_id) {
            return response()->json([
                'success' => false,
                'message' => 'Acesso negado.',
            ], 403);
        }

        if ($user && !$user->isManager() && !$user->isSuperAdmin() && $session->user_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Acesso negado.',
            ], 403);
        }

        try {
            Http::timeout($this->timeout)->delete("{$this->serviceUrl}/sessions/{$sessionId}");
        } catch (\Exception $e) {
            Log::error('WhatsApp delete error: ' . $e->getMessage());
        }

        $session->delete();

        return response()->json([
            'success' => true,
            'message' => 'Sessão excluída.',
        ]);
    }

    /**
     * Clear all messages and conversations for a session.
     */
    public function clearSessionData(Request $request, string $sessionId): JsonResponse
    {
        // SECURITY: Verify tenant ownership
        $session = $this->getSessionForTenant($sessionId, $request->user()->tenant_id);

        // Get all conversations for this session
        $conversationIds = WhatsappConversation::where('session_id', $sessionId)->pluck('id');

        // Delete all messages for these conversations
        WhatsappMessage::whereIn('conversation_id', $conversationIds)->delete();

        // Delete all conversations
        WhatsappConversation::where('session_id', $sessionId)->delete();

        // Clear session QR code
        $session->update(['qr_code' => null]);

        return response()->json([
            'success' => true,
            'message' => 'Dados da sessão limpos com sucesso.',
            'data' => [
                'conversations_deleted' => count($conversationIds),
            ],
        ]);
    }

    /**
     * Reconnect a session (disconnect, clear data, and reconnect fresh).
     */
    public function reconnectSession(string $sessionId): JsonResponse
    {
        $session = WhatsappSession::findOrFail($sessionId);

        // 1. Disconnect the current session on WhatsApp service
        try {
            Http::timeout($this->timeout)->delete("{$this->serviceUrl}/sessions/{$sessionId}");
        } catch (\Exception $e) {
            Log::warning('Error disconnecting session: ' . $e->getMessage());
        }

        // 2. Clear old data
        $conversationIds = WhatsappConversation::where('session_id', $sessionId)->pluck('id');
        WhatsappMessage::whereIn('conversation_id', $conversationIds)->delete();
        WhatsappConversation::where('session_id', $sessionId)->delete();

        // 3. Reset session status
        $session->update([
            'status' => 'pending',
            'qr_code' => null,
            'connected_at' => null,
        ]);

        // 4. Create new session on WhatsApp service
        try {
            $response = Http::timeout($this->timeout)->post("{$this->serviceUrl}/sessions", [
                'sessionId' => $session->id,
                'phoneNumber' => $session->phone_number,
            ]);

            if ($response->successful()) {
                return response()->json([
                    'success' => true,
                    'message' => 'Sessão reiniciada. Aguardando novo QR Code.',
                    'data' => ['session' => $session->fresh()],
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Error reconnecting session: ' . $e->getMessage());
        }

        return response()->json([
            'success' => false,
            'message' => 'Erro ao reconectar sessão.',
        ], 500);
    }

    /**
     * Refresh profile pictures for all conversations of a session.
     */
    public function refreshProfilePictures(Request $request, string $sessionId): JsonResponse
    {
        // SECURITY: Verify tenant ownership
        $session = $this->getSessionForTenant($sessionId, $request->user()->tenant_id);

        if ($session->status !== 'connected') {
            return response()->json([
                'success' => false,
                'message' => 'Sessão não está conectada.',
            ], 400);
        }

        // Get all conversations without profile pictures
        $conversations = WhatsappConversation::where('session_id', $sessionId)
            ->whereNull('profile_picture')
            ->orWhere('profile_picture', '')
            ->get();

        if ($conversations->isEmpty()) {
            return response()->json([
                'success' => true,
                'message' => 'Todas as conversas já possuem foto de perfil.',
                'updated' => 0,
            ]);
        }

        // Get JIDs
        $jids = $conversations->pluck('remote_jid')->toArray();

        try {
            // Call WhatsApp service to get profile pictures
            $response = Http::timeout(30)->post("{$this->serviceUrl}/sessions/{$sessionId}/profile-pictures", [
                'jids' => $jids,
            ]);

            if ($response->successful()) {
                $pictures = $response->json('data') ?? [];
                $updatedCount = 0;

                foreach ($conversations as $conversation) {
                    if (isset($pictures[$conversation->remote_jid])) {
                        $conversation->update(['profile_picture' => $pictures[$conversation->remote_jid]]);
                        $updatedCount++;
                    }
                }

                return response()->json([
                    'success' => true,
                    'message' => "Fotos de perfil atualizadas.",
                    'updated' => $updatedCount,
                ]);
            }

            return response()->json([
                'success' => false,
                'message' => 'Erro ao buscar fotos de perfil.',
            ], 500);
        } catch (\Exception $e) {
            Log::error('WhatsApp refresh profile pictures error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Erro ao buscar fotos de perfil: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Refresh group names for all group conversations of a session.
     */
    public function refreshGroupNames(Request $request, string $sessionId): JsonResponse
    {
        // SECURITY: Verify tenant ownership
        $session = $this->getSessionForTenant($sessionId, $request->user()->tenant_id);

        if ($session->status !== 'connected') {
            return response()->json([
                'success' => false,
                'message' => 'Sessão não está conectada.',
            ], 400);
        }

        // Get all group conversations
        $conversations = WhatsappConversation::where('session_id', $sessionId)
            ->where('is_group', true)
            ->get();

        if ($conversations->isEmpty()) {
            return response()->json([
                'success' => true,
                'message' => 'Nenhum grupo encontrado.',
                'updated' => 0,
            ]);
        }

        // Get JIDs
        $jids = $conversations->pluck('remote_jid')->toArray();

        try {
            // Call WhatsApp service to get group names
            $response = Http::timeout(60)->post("{$this->serviceUrl}/sessions/{$sessionId}/groups", [
                'jids' => $jids,
            ]);

            if ($response->successful()) {
                $names = $response->json('data') ?? [];
                $updatedCount = 0;

                foreach ($conversations as $conversation) {
                    if (isset($names[$conversation->remote_jid])) {
                        $conversation->update(['group_name' => $names[$conversation->remote_jid]]);
                        $updatedCount++;
                    }
                }

                return response()->json([
                    'success' => true,
                    'message' => "Nomes de grupos atualizados.",
                    'updated' => $updatedCount,
                ]);
            }

            return response()->json([
                'success' => false,
                'message' => 'Erro ao buscar nomes de grupos.',
            ], 500);
        } catch (\Exception $e) {
            Log::error('WhatsApp refresh group names error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Erro ao buscar nomes de grupos: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Webhook for WhatsApp service events.
     */
    public function webhook(Request $request): JsonResponse
    {
        $event = $request->input('event');
        $sessionId = $request->input('sessionId');
        $allData = $request->all();

        Log::info("WhatsApp webhook: {$event}", ['sessionId' => $sessionId]);

        $session = WhatsappSession::withTrashed()->find($sessionId);
        if (!$session) {
            return response()->json(['success' => false, 'message' => 'Session not found'], 404);
        }

        if ($session->trashed()) {
            return response()->json(['success' => true, 'message' => 'Session deleted, ignoring webhook']);
        }

        switch ($event) {
            case 'qr_code':
                $session->update([
                    'status' => 'qr_code',
                    'qr_code' => $allData['qrCode'] ?? $allData['qr'] ?? null,
                ]);
                break;
            case 'connected':
                $session->update([
                    'status' => 'connected',
                    'phone_number' => $allData['phoneNumber'] ?? $session->phone_number,
                    'qr_code' => null,
                    'connected_at' => now(),
                    'last_activity_at' => now(),
                ]);
                break;
            case 'disconnected':
            case 'logged_out':
                $session->update([
                    'status' => 'disconnected',
                    'qr_code' => null,
                ]);
                break;
            case 'message':
                $this->handleIncomingMessage($session, $allData);
                break;
            case 'message_status':
                $this->handleMessageStatus($allData);
                break;
        }

        return response()->json(['success' => true]);
    }

    /**
     * Handle incoming message (both received and sent).
     */
    private function handleIncomingMessage(WhatsappSession $session, array $data): void
    {
        $messageType = $data['type'] ?? 'unknown';
        
        // Skip system/internal messages
        $systemMessageTypes = [
            'messageContextInfo',
            'senderKeyDistributionMessage', 
            'protocolMessage',
            'reactionMessage',
            'ephemeralMessage',
            'viewOnceMessage',
            'deviceSentMessage',
            'encReactionMessage',
            'unknown',
        ];
        
        if (in_array($messageType, $systemMessageTypes)) {
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
        
        // For groups, extract phone from participant; for individuals, from remoteJid
        if ($isGroup) {
            $phoneNumber = $data['senderPhone'] ?? preg_replace('/@(s\.whatsapp\.net|c\.us)$/', '', $data['participant'] ?? '');
            // Only get sender name for incoming messages (not fromMe)
            $contactName = !$fromMe ? ($data['senderName'] ?? $data['pushName'] ?? null) : null;
        } else {
            // Strip @s.whatsapp.net, @c.us, @lid so we don't store "number@lid" as contact_phone
            $phoneNumber = preg_replace('/@(s\.whatsapp\.net|c\.us|lid)$/i', '', $remoteJid);
            $phoneNumber = trim($phoneNumber);
            // IMPORTANT: Only use pushName for INCOMING messages
            // For outgoing messages (fromMe), pushName is OUR name, not the contact's name
            $contactName = !$fromMe ? ($data['pushName'] ?? null) : null;
        }

        // Find or create conversation using try-catch to handle race conditions
        // Use withTrashed() to find soft deleted conversations and restore them
        $dedupApplied = false;
        try {
            $conversation = WhatsappConversation::withTrashed()
                ->where('session_id', $session->id)
                ->where('remote_jid', $remoteJid)
                ->first();

            // Deduplicate: same contact can appear with different jids (e.g. @s.whatsapp.net vs @lid). Prefer existing conversation with same contact_name.
            if (!$conversation && !$isGroup && $contactName !== null && trim((string) $contactName) !== '') {
                $nameForMatch = trim((string) $contactName);
                $existingByName = WhatsappConversation::withTrashed()
                    ->where('session_id', $session->id)
                    ->where('is_group', false)
                    ->where('contact_name', $nameForMatch)
                    ->first();
                if ($existingByName) {
                    $conversation = $existingByName;
                    $dedupApplied = true;
                    // Consolidate: use this conversation and update remote_jid so future messages with this jid find it directly
                    $updatePayload = [
                        'remote_jid' => $remoteJid,
                        'contact_phone' => $isGroup ? null : $phoneNumber,
                        'contact_name' => $contactName,
                        'profile_picture' => $data['profilePicture'] ?? $conversation->profile_picture,
                        'last_message_at' => now(),
                    ];
                    // Non-global session: keep conversation assigned to session owner, not another seller
                    if ($session->user_id !== null) {
                        $updatePayload['assigned_user_id'] = $session->user_id;
                    }
                    $conversation->update($updatePayload);
                    if ($conversation->trashed()) {
                        $conversation->restore();
                        $conversation->update(['unread_count' => 1, 'is_archived' => false]);
                    } else {
                        $conversation->increment('unread_count');
                    }
                }
            }
            
            // NEW: For fromMe messages (contactName=null), try to find existing conversation by normalized phone
            if (!$conversation && !$isGroup && $fromMe && $phoneNumber) {
                $normalizedPhone = preg_replace('/\D/', '', $phoneNumber);
                
                if (strlen($normalizedPhone) >= 10) {
                    // Try to find conversation by matching normalized phone in contact_phone
                    $existingByPhone = WhatsappConversation::withTrashed()
                        ->where('session_id', $session->id)
                        ->where('is_group', false)
                        ->get()
                        ->first(function($conv) use ($normalizedPhone) {
                            $convPhone = preg_replace('/\D/', '', $conv->contact_phone ?? '');
                            // Match last 8-10 digits (flexible matching)
                            if (strlen($convPhone) >= 8 && strlen($normalizedPhone) >= 8) {
                                $convLast10 = substr($convPhone, -10);
                                $phoneLast10 = substr($normalizedPhone, -10);
                                return $convLast10 === $phoneLast10;
                            }
                            return false;
                        });
                    
                    if ($existingByPhone) {
                        $conversation = $existingByPhone;
                        $dedupApplied = true;
                        
                        // Update with correct JID for future matches
                        $updatePayload = [
                            'remote_jid' => $remoteJid,
                            'contact_phone' => $phoneNumber,
                            'last_message_at' => now(),
                        ];
                        
                        if ($session->user_id !== null) {
                            $updatePayload['assigned_user_id'] = $session->user_id;
                        }
                        
                        $conversation->update($updatePayload);
                        
                        if ($conversation->trashed()) {
                            $conversation->restore();
                            $conversation->update(['unread_count' => 1, 'is_archived' => false]);
                        } else {
                            $conversation->increment('unread_count');
                        }
                    }
                }
            }

            if (!$conversation) {
                // For groups, use groupName (from metadata), not pushName (sender's name)
                $groupDisplayName = $isGroup ? ($data['groupName'] ?? 'Grupo') : null;
                
                // SECURITY: Auto-assign conversation to session owner
                $assignedUserId = $session->user_id; // If session has user_id, assign to that user
                
                $conversation = WhatsappConversation::create([
                    'id' => Str::uuid(),
                    'session_id' => $session->id,
                    'remote_jid' => $remoteJid,
                    'is_group' => $isGroup,
                    'group_name' => $groupDisplayName,
                    'contact_phone' => $isGroup ? null : $phoneNumber,
                    'contact_name' => $isGroup ? null : $contactName,
                    'profile_picture' => $data['profilePicture'] ?? null,
                    'assigned_user_id' => $assignedUserId, // Auto-assign to session owner
                    'last_message_at' => now(),
                    'unread_count' => 1,
                ]);
            } else if ($conversation->trashed()) {
                // Restore soft deleted conversation
                $conversation->restore();
                
                // SECURITY: Auto-assign to session owner if not already assigned
                $updateData = [
                    'is_group' => $isGroup,
                    'group_name' => $isGroup ? ($data['groupName'] ?? 'Grupo') : null,
                    'contact_phone' => $isGroup ? null : $phoneNumber,
                    'contact_name' => $isGroup ? null : $contactName,
                    'profile_picture' => $data['profilePicture'] ?? null,
                    'last_message_at' => now(),
                    'unread_count' => 1,
                    'is_archived' => false,
                ];
                
                // If conversation not assigned but session has owner, assign it
                if (!$conversation->assigned_user_id && $session->user_id) {
                    $updateData['assigned_user_id'] = $session->user_id;
                }
                
                $conversation->update($updateData);
            } else if (!$dedupApplied) {
                // Update conversation with new data (skip if we already updated in dedup block)
                $updateData = [
                    'last_message_at' => now(),
                    'unread_count' => $conversation->unread_count + 1,
                ];

                // SECURITY: Auto-assign to session owner if not already assigned
                if (!$conversation->assigned_user_id && $session->user_id) {
                    $updateData['assigned_user_id'] = $session->user_id;
                }

                // For groups, update group name from metadata; for individuals, update contact name
                if ($isGroup) {
                    // Use groupName from metadata if available
                    if (!empty($data['groupName'])) {
                        $updateData['group_name'] = $data['groupName'];
                    }
                } else {
                    // ONLY update contact_name from INCOMING messages (not fromMe)
                    // Otherwise, our own pushName would overwrite the contact's name
                    if (!$fromMe && !empty($contactName)) {
                        $updateData['contact_name'] = $contactName;
                    }
                }

                // Update profile picture if provided and different
                if (!empty($data['profilePicture']) && $data['profilePicture'] !== $conversation->profile_picture) {
                    $updateData['profile_picture'] = $data['profilePicture'];
                }

                $conversation->update($updateData);
            }
        } catch (\Illuminate\Database\UniqueConstraintViolationException $e) {
            // Race condition - conversation was created by another request, fetch it (including trashed)
            $conversation = WhatsappConversation::withTrashed()
                ->where('session_id', $session->id)
                ->where('remote_jid', $remoteJid)
                ->first();
            
            // If it was trashed, restore it
            if ($conversation && $conversation->trashed()) {
                $conversation->restore();
            }
            
            if (!$conversation) {
                Log::error('Failed to find conversation after unique constraint violation', [
                    'sessionId' => $session->id,
                    'remoteJid' => $remoteJid,
                ]);
                return;
            }
            
            // Update unread count
            $conversation->increment('unread_count');
            $conversation->update(['last_message_at' => now()]);
        }

        // Check if message already exists (avoid duplicates)
        $existingMessage = WhatsappMessage::where('message_id', $data['messageId'] ?? $data['id'] ?? null)->first();
        if ($existingMessage) {
            Log::info('Message already exists, skipping', ['messageId' => $data['messageId'] ?? $data['id']]);
            return;
        }

        // Create message with sender info (important for groups)
        WhatsappMessage::create([
            'id' => Str::uuid(),
            'conversation_id' => $conversation->id,
            'message_id' => $data['messageId'] ?? $data['id'] ?? null,
            'direction' => $fromMe ? 'outgoing' : 'incoming',
            'type' => $data['type'] ?? 'text',
            'content' => $data['text'] ?? $data['body'] ?? null,
            'media_url' => $data['mediaUrl'] ?? null,
            'media_filename' => $data['mediaFilename'] ?? null,
            'status' => $fromMe ? 'sent' : 'delivered',
            'sender_name' => $fromMe ? null : ($data['senderName'] ?? $data['pushName'] ?? null),
            'sender_phone' => $fromMe ? null : ($data['senderPhone'] ?? $phoneNumber),
        ]);

        Log::info('Message saved successfully', [
            'conversationId' => $conversation->id,
            'messageId' => $data['messageId'] ?? $data['id'],
            'direction' => $fromMe ? 'outgoing' : 'incoming',
        ]);

        // AI Agent Auto-Response: Only for incoming messages, not from groups
        $isHistorical = $data['isHistory'] ?? false;
        $messageTimestamp = $data['timestamp'] ?? null;
        
        // Check if message is recent (within last 5 minutes) - skip historical messages
        $isRecent = true;
        if ($messageTimestamp) {
            $messageTime = is_numeric($messageTimestamp) ? $messageTimestamp : strtotime($messageTimestamp);
            $isRecent = (time() - $messageTime) < 300; // 5 minutes
        }
        
        // Log AI Agent eligibility check
        if (!$fromMe && !$isGroup && ($data['type'] ?? 'text') === 'text') {
            Log::info('AI Agent eligibility check', [
                'isHistorical' => $isHistorical,
                'isRecent' => $isRecent,
                'timestamp' => $messageTimestamp,
                'message' => substr($data['text'] ?? $data['body'] ?? '', 0, 50),
            ]);
        }
        
        if (!$fromMe && !$isGroup && ($data['type'] ?? 'text') === 'text' && !$isHistorical && $isRecent) {
            $this->processAiAgentResponse($session, $conversation, $data['text'] ?? $data['body'] ?? '');
        }
    }

    /**
     * Process AI Agent automatic response
     */
    private function processAiAgentResponse(WhatsappSession $session, WhatsappConversation $conversation, string $messageText): void
    {
        
        try {
            // Global rate limit - max 30 AI requests per minute per session (Groq allows 30 RPM)
            $globalRateKey = "ai_agent_global:{$session->id}";
            $globalCount = \Cache::get($globalRateKey, 0);
            if ($globalCount >= 30) {
                Log::debug('AI Agent: Global rate limit reached', ['sessionId' => $session->id, 'count' => $globalCount]);
                return;
            }
            
            // Short debounce - wait 2 seconds to allow multiple messages to arrive
            // This groups rapid consecutive messages together
            $debounceKey = "ai_agent_debounce:{$conversation->id}";
            $lastProcessed = \Cache::get($debounceKey);
            $timeSinceLastResponse = $lastProcessed ? (now()->timestamp - $lastProcessed) : 999;
            
            // If we responded less than 2 seconds ago, skip (let messages accumulate)
            if ($timeSinceLastResponse < 2) {
                Log::debug('AI Agent: Debouncing, waiting for more messages', ['conversationId' => $conversation->id]);
                return;
            }

            // HANDOFF: Verificar se há mensagem humana recente (últimos 30min)
            // Se sim, humano assumiu e IA não deve responder
            // Refresh conversation para garantir dados atualizados
            $conversation->refresh();
            
            $hasHumanMessage = WhatsappMessage::where('conversation_id', $conversation->id)
                ->where('direction', 'outgoing')
                ->where('created_at', '>=', now()->subMinutes(30))
                ->where(function ($q) {
                    $q->whereNull('sender_name')
                        ->orWhere('sender_name', '!=', 'AI Agent');
                })
                ->exists();

            if ($hasHumanMessage) {
                Log::info('AI Agent: Human takeover detected, skipping response', [
                    'conversationId' => $conversation->id,
                    'sessionId' => $session->id,
                ]);
                return;
            }

            // Check if AI Agent is active for this session
            // 1) Match this session OR global (null). Also accept legacy value 'default'.
            // 2) If nothing matches, fallback to any active agent (useful when session was recreated).
            $aiAgent = \App\Models\AiChatAgent::with('documents')
                ->where('is_active', true)
                ->where(function ($q) use ($session) {
                    $q->where('whatsapp_session_id', $session->id)
                        ->orWhereNull('whatsapp_session_id')
                        ->orWhere('whatsapp_session_id', 'default');
                })
                ->first();


            if (!$aiAgent) {
                $aiAgent = \App\Models\AiChatAgent::with('documents')
                    ->where('is_active', true)
                    ->first();
                
            }

            if (!$aiAgent) {
                Log::debug('AI Agent not active for session', ['sessionId' => $session->id]);
                return;
            }

            // Check if message is empty
            if (empty(trim($messageText))) {
                Log::debug('AI Agent: Empty message, skipping');
                return;
            }

            // Get recent unanswered messages from customer (last 60 seconds)
            $recentMessages = WhatsappMessage::where('conversation_id', $conversation->id)
                ->where('direction', 'incoming')
                ->where('created_at', '>=', now()->subSeconds(60))
                ->orderBy('created_at', 'asc')
                ->pluck('content')
                ->filter()
                ->unique()
                ->values()
                ->toArray();
            
            // Combine messages if multiple exist
            if (count($recentMessages) > 1) {
                $messageText = implode("\n", $recentMessages);
                Log::info('AI Agent: Combined multiple messages', [
                    'conversationId' => $conversation->id,
                    'messageCount' => count($recentMessages),
                ]);
            }

            // Set rate limit and debounce locks
            \Cache::put($debounceKey, now()->timestamp, 60);
            \Cache::put($globalRateKey, $globalCount + 1, 60);


            Log::info('AI Agent processing message', [
                'sessionId' => $session->id,
                'conversationId' => $conversation->id,
                'agentId' => $aiAgent->id,
                'agentName' => $aiAgent->name,
                'message' => substr($messageText, 0, 100),
            ]);

            // Build context from knowledge base
            $knowledgeBase = '';
            $docsCount = 0;
            foreach ($aiAgent->documents ?? [] as $doc) {
                if ($doc->content) {
                    $knowledgeBase .= "\n\n--- {$doc->name} ---\n{$doc->content}";
                    $docsCount++;
                }
            }

            Log::debug('AI Agent knowledge base loaded', ['documentsCount' => $docsCount]);

            // Build instructions
            $instructions = [
                'function_definition' => $aiAgent->function_definition,
                'company_info' => $aiAgent->company_info,
                'tone' => $aiAgent->tone,
                'knowledge_guidelines' => $aiAgent->knowledge_guidelines,
            ];

            $context = [
                'knowledge_base' => $knowledgeBase,
            ];

            // Generate AI response - use tenant_id for token tracking/learning.
            $tenantId = $session->tenant_id ?? (\DB::table('tenants')->orderBy('created_at')->value('id'));
            $aiService = new \App\Services\AIService($tenantId);
            
            // Check if AI service is configured
            if (!$aiService->isConfigured()) {
                Log::error('AI Agent: Groq API key not configured');
                return;
            }

            $result = $aiService->generateChatResponse($messageText, $context, $instructions, $conversation->id);

            if (!$result['success'] || empty($result['response'])) {
                Log::warning('AI Agent failed to generate response', [
                    'sessionId' => $session->id,
                    'conversationId' => $conversation->id,
                    'error' => $result['message'] ?? 'Unknown error',
                    'reason' => $result['reason'] ?? null,
                    'upgrade_required' => $result['upgrade_required'] ?? false,
                ]);
                return;
            }

            $aiResponse = $result['response'];

            Log::info('AI Agent generated response', [
                'conversationId' => $conversation->id,
                'responseLength' => strlen($aiResponse),
                'response' => substr($aiResponse, 0, 100),
            ]);

            // Send response via WhatsApp service (correct endpoint)
            $response = Http::timeout(30)->post("{$this->serviceUrl}/messages/send/text", [
                'sessionId' => $session->id,
                'to' => $conversation->remote_jid,
                'text' => $aiResponse,
            ]);

            if ($response->successful()) {
                // Save AI response as outgoing message
                WhatsappMessage::create([
                    'id' => Str::uuid(),
                    'conversation_id' => $conversation->id,
                    'message_id' => $response->json('data.messageId') ?? Str::uuid()->toString(),
                    'direction' => 'outgoing',
                    'type' => 'text',
                    'content' => $aiResponse,
                    'status' => 'sent',
                    'sender_name' => 'AI Agent',
                ]);

                // Update conversation
                $conversation->update([
                    'last_message_at' => now(),
                    'unread_count' => 0,
                ]);

                // ============================================
                // AI LEARNING INTEGRATION
                // Record the interaction for learning purposes
                // ============================================
                try {
                    // Use the session tenant_id (fallback to first tenant only if missing)
                    $learningTenantId = $tenantId ?? (\DB::table('tenants')->orderBy('created_at')->value('id'));
                    if (!$learningTenantId) {
                        throw new \RuntimeException('Tenant not found for AI Learning');
                    }

                    $learningService = new \App\Services\AILearningService($learningTenantId);
                    
                    // Classify intent for smarter learning decisions
                    $intent = $this->detectIntent($messageText);
                    $keywords = $this->extractKeywordsForLearning($messageText);
                    $allowedFaqIntents = [
                        'price_inquiry',
                        'availability',
                        'support',
                        'scheduling',
                        'info',
                        'order',
                        'payment',
                        'delivery',
                    ];
                    $canStoreFaq = in_array($intent, $allowedFaqIntents, true)
                        && mb_strlen(trim($messageText)) >= 15
                        && count($keywords) >= 2;

                    // 1. Create/Update FAQ entry only when intent is meaningful
                    if ($canStoreFaq) {
                        $learningService->createOrUpdateFAQ($messageText, $aiResponse, false);
                    }
                    
                    // 2. Update conversation context for better future responses
                    $learningService->updateConversationContext(
                        $conversation->id,
                        $messageText,
                        $aiResponse,
                        null // sentiment will be analyzed later
                    );
                    
                    // 3. Learn pattern from this successful interaction
                    if (!empty($keywords) && $intent !== 'general') {
                        $learningService->learnPattern(
                            intent: $intent,
                            triggerKeywords: $keywords,
                            responseTemplate: $aiResponse,
                            wasSuccessful: true
                        );
                    }
                    
                    // 4. Record automatic feedback as neutral (can be corrected by user later)
                    $learningService->recordFeedback(
                        $messageText,
                        $aiResponse,
                        'neutral', // Will be updated based on customer response
                        'whatsapp_auto',
                        [
                            'conversation_id' => $conversation->id,
                            'session_id' => $session->id,
                            'agent_id' => $aiAgent->id,
                            'intent' => $intent,
                            'keywords' => $keywords,
                        ]
                    );
                    
                    Log::info('AI Learning: Interaction recorded', [
                        'conversationId' => $conversation->id,
                        'messageLength' => strlen($messageText),
                        'responseLength' => strlen($aiResponse),
                        'tenantId' => $learningTenantId,
                    ]);
                } catch (\Exception $e) {
                    // Don't fail the response if learning fails
                    Log::warning('AI Learning: Failed to record interaction', [
                        'error' => $e->getMessage(),
                        'conversationId' => $conversation->id,
                    ]);
                }

                Log::info('AI Agent response sent successfully', [
                    'conversationId' => $conversation->id,
                    'remoteJid' => $conversation->remote_jid,
                ]);
            } else {
                Log::error('Failed to send AI Agent response via WhatsApp', [
                    'sessionId' => $session->id,
                    'conversationId' => $conversation->id,
                    'statusCode' => $response->status(),
                    'error' => $response->body(),
                ]);
            }
        } catch (\InvalidArgumentException $e) {
            Log::error('AI Agent configuration error', [
                'sessionId' => $session->id,
                'error' => $e->getMessage(),
            ]);
        } catch (\Exception $e) {
            Log::error('AI Agent unexpected error', [
                'sessionId' => $session->id,
                'conversationId' => $conversation->id,
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);
        }
    }

    /**
     * Extract keywords from message for learning
     */
    private function extractKeywordsForLearning(string $text): array
    {
        $stopWords = ['o', 'a', 'os', 'as', 'um', 'uma', 'de', 'da', 'do', 'em', 'no', 'na', 'para', 'com', 'por', 'que', 'qual', 'como', 'quando', 'onde', 'é', 'são', 'foi', 'ser', 'ter', 'eu', 'você', 'ele', 'ela', 'nós', 'eles', 'meu', 'seu', 'isso', 'este', 'esta', 'esse', 'essa', 'oi', 'olá', 'bom', 'boa', 'dia', 'tarde', 'noite', 'obrigado', 'obrigada', 'por favor', 'sim', 'não'];
        
        $words = preg_split('/\s+/', mb_strtolower(trim($text)));
        $keywords = [];

        foreach ($words as $word) {
            $word = preg_replace('/[^\p{L}\p{N}]/u', '', $word);
            if (strlen($word) >= 3 && !in_array($word, $stopWords)) {
                $keywords[] = $word;
            }
        }

        return array_unique(array_slice($keywords, 0, 10));
    }

    /**
     * Detect intent from message
     */
    private function detectIntent(string $message): string
    {
        $message = mb_strtolower($message);
        
        // Common intents
        $intents = [
            'greeting' => ['oi', 'olá', 'bom dia', 'boa tarde', 'boa noite', 'hello', 'hi'],
            'price_inquiry' => ['preço', 'valor', 'quanto custa', 'custo', 'orçamento', 'budget'],
            'availability' => ['disponível', 'tem', 'existe', 'vocês tem', 'disponibilidade'],
            'support' => ['ajuda', 'suporte', 'problema', 'erro', 'não funciona', 'bug'],
            'scheduling' => ['agendar', 'marcar', 'horário', 'agenda', 'reservar', 'appointment'],
            'info' => ['informação', 'info', 'saber', 'conhecer', 'mais sobre', 'explicar'],
            'complaint' => ['reclamação', 'insatisfeito', 'ruim', 'péssimo', 'problema'],
            'thanks' => ['obrigado', 'obrigada', 'agradeço', 'valeu', 'thanks'],
            'goodbye' => ['tchau', 'até mais', 'bye', 'adeus', 'até logo'],
            'order' => ['pedido', 'comprar', 'quero', 'pedir', 'encomendar'],
            'payment' => ['pagamento', 'pagar', 'pix', 'cartão', 'boleto', 'transferência'],
            'delivery' => ['entrega', 'frete', 'envio', 'prazo', 'chegada'],
        ];
        
        foreach ($intents as $intent => $keywords) {
            foreach ($keywords as $keyword) {
                if (str_contains($message, $keyword)) {
                    return $intent;
                }
            }
        }
        
        return 'general';
    }

    /**
     * Handle message status update.
     */
    private function handleMessageStatus(array $data): void
    {
        $messageId = $data['messageId'] ?? null;
        if (!$messageId) return;

        $message = WhatsappMessage::where('message_id', $messageId)->first();
        if ($message) {
            $message->update([
                'status' => $data['status'],
                'delivered_at' => $data['status'] === 'delivered' ? now() : $message->delivered_at,
                'read_at' => $data['status'] === 'read' ? now() : $message->read_at,
            ]);
        }
    }

    // ==========================================
    // CONVERSATIONS
    // ==========================================

    /**
     * List conversations.
     */
    public function listConversations(Request $request, string $sessionId): JsonResponse
    {
        $user = $request->user();

        $session = WhatsappSession::where('id', $sessionId)
            ->where('tenant_id', $user?->tenant_id)
            ->firstOrFail();

        // SECURITY: Sales users can only access their own sessions
        if ($user && !$user->isAdmin() && !$user->isManager() && $session->user_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Acesso negado.',
            ], 403);
        }

        // Non-global session: ensure all conversations are assigned to the session owner (not to another seller)
        if ($session->user_id !== null) {
            WhatsappConversation::where('session_id', $session->id)
                ->where(function ($q) use ($session) {
                    $q->whereNull('assigned_user_id')->orWhere('assigned_user_id', '!=', $session->user_id);
                })
                ->update(['assigned_user_id' => $session->user_id]);
        }

        $query = WhatsappConversation::where('session_id', $session->id)
            ->with(['contact', 'assignedUser', 'lastMessage']);

        // Filter archived
        if (!$request->boolean('include_archived', false)) {
            $query->where('is_archived', false);
        }

        // SECURITY: Sales users only see conversations assigned to them
        // Admins and Managers see all conversations
        if ($user && !$user->isAdmin() && !$user->isManager()) {
            $query->where('assigned_user_id', $user->id);
        } elseif ($user && ($user->isAdmin() || $user->isManager()) && $request->filled('assigned_to')) {
            // Admins/Managers can filter by assigned user
            $query->where('assigned_user_id', $request->assigned_to);
        }

        // Admins/Managers can filter by seller signature
        if ($user && ($user->isAdmin() || $user->isManager()) && $request->filled('assigned_signature')) {
            $signature = strtoupper($request->assigned_signature);
            $query->whereHas('assignedUser', function ($q) use ($signature) {
                $q->where('signature', $signature);
            });
        }

        // Explicit "my conversations" filter (for admins/managers)
        if ($request->boolean('my_conversations') && $user && ($user->isAdmin() || $user->isManager())) {
            $query->where('assigned_user_id', $user->id);
        }

        // Search filter
        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('contact_name', 'ilike', "%{$search}%")
                  ->orWhere('contact_phone', 'ilike', "%{$search}%");
            });
        }

        $conversations = $query->orderByDesc('is_pinned')
            ->orderByDesc('last_message_at')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $conversations,
        ]);
    }

    /**
     * Start a new conversation.
     */
    public function startConversation(Request $request, string $sessionId): JsonResponse
    {
        $user = $request->user();
        $session = WhatsappSession::where('id', $sessionId)
            ->where('tenant_id', $user?->tenant_id)
            ->firstOrFail();

        $request->validate([
            'phone_number' => 'required|string',
            'contact_name' => 'nullable|string',
        ]);

        $phoneNumber = preg_replace('/\D/', '', $request->phone_number);
        $remoteJid = "{$phoneNumber}@s.whatsapp.net";

        $conversation = WhatsappConversation::firstOrCreate(
            [
                'session_id' => $sessionId,
                'remote_jid' => $remoteJid,
            ],
            [
                'id' => Str::uuid(),
                'contact_phone' => $phoneNumber,
                'contact_name' => $request->contact_name,
                'last_message_at' => now(),
                'assigned_user_id' => $user && !$user->isManager() && !$user->isSuperAdmin() ? $user->id : null,
            ]
        );

        return response()->json([
            'success' => true,
            'data' => $conversation->load(['contact', 'assignedUser']),
        ]);
    }

    // ==========================================
    // MESSAGES
    // ==========================================

    /**
     * List messages.
     */
    public function listMessages(Request $request, string $conversationId): JsonResponse
    {
        $user = $request->user();
        $conversation = WhatsappConversation::with('session')->findOrFail($conversationId);

        // Ensure tenant isolation
        if ($user && $conversation->session?->tenant_id !== $user->tenant_id) {
            return response()->json([
                'success' => false,
                'message' => 'Acesso negado.',
            ], 403);
        }

        // SECURITY: Sales users can only access conversations from their own sessions
        if ($user && !$user->isAdmin() && !$user->isManager()) {
            // Check if session belongs to the user
            if ($conversation->session?->user_id !== $user->id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Acesso negado. Você só pode acessar conversas de suas próprias sessões.',
                ], 403);
            }

            // Auto-assign conversation to user if unassigned
            if ($conversation->assigned_user_id === null) {
                $conversation->update(['assigned_user_id' => $user->id]);
            }

            // Verify conversation is assigned to the user
            if ($conversation->assigned_user_id !== $user->id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Acesso negado. Esta conversa está atribuída a outro usuário.',
                ], 403);
            }
        } else {
            // Non-global session: conversation must stay assigned to session owner (not to admin/manager who opened it)
            if ($conversation->session?->user_id !== null && $conversation->assigned_user_id !== $conversation->session->user_id) {
                $conversation->update(['assigned_user_id' => $conversation->session->user_id]);
            }
        }

        // Mark as read
        $conversation->update(['unread_count' => 0]);

        $messages = WhatsappMessage::where('conversation_id', $conversationId)
            ->with('sender:id,name')
            ->orderByDesc('created_at')
            ->limit($request->get('limit', 100))
            ->get();

        return response()->json([
            'success' => true,
            'data' => $messages,
        ]);
    }

    /**
     * Send a message (text or media).
     */
    public function sendMessage(Request $request, string $conversationId): JsonResponse
    {
        $user = $request->user();
        $conversation = WhatsappConversation::with('session')->findOrFail($conversationId);

        // Ensure tenant isolation
        if ($user && $conversation->session?->tenant_id !== $user->tenant_id) {
            return response()->json([
                'success' => false,
                'message' => 'Acesso negado.',
            ], 403);
        }

        // SECURITY: Sales users can only send messages in their own session's conversations
        if ($user && !$user->isAdmin() && !$user->isManager()) {
            // Check if session belongs to the user
            if ($conversation->session?->user_id !== $user->id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Acesso negado. Você só pode enviar mensagens em sessões próprias.',
                ], 403);
            }

            // Auto-assign conversation to sender if unassigned
            if ($conversation->assigned_user_id === null) {
                $conversation->update(['assigned_user_id' => $user->id]);
            }

            // Verify conversation is assigned to the user
            if ($conversation->assigned_user_id !== $user->id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Acesso negado. Esta conversa está atribuída a outro usuário.',
                ], 403);
            }
        } else {
            if ($conversation->session?->user_id !== null && $conversation->assigned_user_id !== $conversation->session->user_id) {
                $conversation->update(['assigned_user_id' => $conversation->session->user_id]);
            } elseif ($conversation->assigned_user_id === null) {
                $conversation->update(['assigned_user_id' => $user->id]);
            }
        }
        $session = $conversation->session;
        if (!$session) {
            return response()->json([
                'success' => false,
                'message' => 'Sessão WhatsApp não encontrada para esta conversa.',
            ], 404);
        }

        $sessionId = $session->id;

        $request->validate([
            'type' => 'required|string|in:text,image,video,audio,document',
            'content' => 'nullable|string',
            'media' => 'nullable|file|max:50000', // 50MB max
        ]);

        try {
            $messageType = $request->type;
            $content = $request->content;
            $response = null;

            if ($messageType === 'text') {
                // Send text message
                $payload = [
                    'sessionId' => $sessionId,
                    'to' => $conversation->remote_jid,
                    'text' => $content,
                ];
                $response = Http::timeout($this->timeout)->post("{$this->serviceUrl}/messages/send/text", $payload);
            } else {
                // Send media message
                $file = $request->file('media');
                if (!$file) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Arquivo é obrigatório para mensagens de mídia.',
                    ], 422);
                }

                // Read file and convert to base64
                $fileContent = file_get_contents($file->getRealPath());
                $base64 = base64_encode($fileContent);
                $mimetype = $file->getMimeType();
                $filename = $file->getClientOriginalName();

                $payload = [
                    'sessionId' => $sessionId,
                    'to' => $conversation->remote_jid,
                    'type' => $messageType,
                    'media' => $base64,
                    'mimetype' => $mimetype,
                    'filename' => $filename,
                    'caption' => $content,
                ];

                $response = Http::timeout(60)->post("{$this->serviceUrl}/messages/send/media", $payload);
            }

            if ($response && $response->successful()) {
                $message = WhatsappMessage::create([
                    'id' => Str::uuid(),
                    'conversation_id' => $conversation->id,
                    'message_id' => $response->json('data.messageId'),
                    'direction' => 'outgoing',
                    'type' => $messageType,
                    'content' => $messageType === 'text' ? $content : ($content ?: $request->file('media')?->getClientOriginalName()),
                    'status' => 'sent',
                    'sender_id' => auth()->id(),
                    'sender_name' => auth()->user()?->name ?? 'Humano',
                    'sent_at' => now(),
                ]);

                $conversation->update(['last_message_at' => now()]);

                return response()->json([
                    'success' => true,
                    'data' => $message,
                ]);
            }

            Log::error('WhatsApp send message failed', [
                'response' => $response?->body(),
                'status' => $response?->status(),
            ]);
        } catch (\Exception $e) {
            Log::error('WhatsApp send message error: ' . $e->getMessage());
        }

        return response()->json([
            'success' => false,
            'message' => 'Erro ao enviar mensagem.',
        ], 500);
    }

    /**
     * Union-find helper: find root id.
     */
    private function mergeFind(array &$parent, string $id): string
    {
        while (($parent[$id] ?? $id) !== $id) {
            $id = $parent[$id];
        }
        return $id;
    }

    private function mergeUnion(array &$parent, string $a, string $b): void
    {
        $pa = $this->mergeFind($parent, $a);
        $pb = $this->mergeFind($parent, $b);
        if ($pa !== $pb) {
            $parent[$pa] = $pb;
        }
    }

    /**
     * Merge duplicate conversations in a session (same contact_name, same phone, or sender_name in messages = other's contact_name).
     * Keeps the conversation with @s.whatsapp.net jid or the one with most messages; moves messages and deletes duplicates.
     */
    private function mergeDuplicateConversationsInSession(string $sessionId): int
    {
        $conversations = WhatsappConversation::where('session_id', $sessionId)
            ->where('is_group', false)
            ->get();
        
        
        if ($conversations->isEmpty()) {
            return 0;
        }
        $parent = [];
        foreach ($conversations as $c) {
            $parent[$c->id] = $c->id;
        }

        // Group by contact_name
        $byName = [];
        foreach ($conversations as $c) {
            $nameKey = trim((string) $c->contact_name);
            if ($nameKey !== '') {
                $byName[$nameKey] = $byName[$nameKey] ?? [];
                $byName[$nameKey][] = $c;
            }
        }
        foreach ($byName as $list) {
            for ($i = 1; $i < count($list); $i++) {
                $this->mergeUnion($parent, $list[0]->id, $list[$i]->id);
            }
        }

        // Group by normalized phone
        $byPhone = [];
        foreach ($conversations as $c) {
            $digits = preg_replace('/\D/', '', (string) $c->contact_phone);
            if ($digits !== '') {
                $byPhone[$digits] = $byPhone[$digits] ?? [];
                $byPhone[$digits][] = $c;
            }
        }
        foreach ($byPhone as $list) {
            for ($i = 1; $i < count($list); $i++) {
                $this->mergeUnion($parent, $list[0]->id, $list[$i]->id);
            }
        }

        // Unify when a conversation has messages with sender_name equal to another conversation's contact_name (same person, different jid)
        $convIds = $conversations->pluck('id')->all();
        $contactNamesSet = $conversations->pluck('contact_name')->map(fn ($n) => trim((string) $n))->filter()->unique()->flip()->all();
        $messagesWithSender = WhatsappMessage::whereIn('conversation_id', $convIds)
            ->whereNotNull('sender_name')
            ->where('sender_name', '!=', '')
            ->select('conversation_id', 'sender_name')
            ->get()
            ->unique(fn ($m) => $m->conversation_id . '|' . trim((string) $m->sender_name));
        foreach ($messagesWithSender as $row) {
            $senderName = trim((string) $row->sender_name);
            if ($senderName === '' || !isset($contactNamesSet[$senderName])) {
                continue;
            }
            $convsWithThisName = $conversations->where('contact_name', $senderName)->values();
            $convWithMessage = $conversations->firstWhere('id', $row->conversation_id);
            if ($convWithMessage && $convsWithThisName->isNotEmpty()) {
                foreach ($convsWithThisName as $other) {
                    if ($other->id !== $convWithMessage->id) {
                        $this->mergeUnion($parent, $convWithMessage->id, $other->id);
                    }
                }
            }
        }

        // Build sets by root
        $byRoot = [];
        foreach ($conversations as $c) {
            $root = $this->mergeFind($parent, $c->id);
            $byRoot[$root] = $byRoot[$root] ?? [];
            $byRoot[$root][] = $c;
        }

        $merged = 0;
        foreach ($byRoot as $list) {
            if (count($list) < 2) {
                continue;
            }
            usort($list, function ($a, $b) {
                $aPreferred = str_ends_with($a->remote_jid ?? '', '@s.whatsapp.net') ? 1 : 0;
                $bPreferred = str_ends_with($b->remote_jid ?? '', '@s.whatsapp.net') ? 1 : 0;
                if ($aPreferred !== $bPreferred) {
                    return $bPreferred - $aPreferred;
                }
                $aCount = $a->messages()->count();
                $bCount = $b->messages()->count();
                return $bCount - $aCount;
            });
            $keep = $list[0];
            $toRemove = array_slice($list, 1);
            foreach ($toRemove as $dup) {
                WhatsappMessage::where('conversation_id', $dup->id)->update(['conversation_id' => $keep->id]);
                $dup->forceDelete();
                $merged++;
            }
            // Non-global session: ensure merged conversation stays assigned to session owner
            $session = WhatsappSession::find($sessionId);
            if ($session && $session->user_id !== null) {
                $keep->update(['assigned_user_id' => $session->user_id]);
            }
        }
        
        
        return $merged;
    }

    /**
     * Trigger sync for a session.
     */
    public function syncSession(Request $request, string $sessionId): JsonResponse
    {
        // SECURITY: Verify tenant ownership
        $session = $this->getSessionForTenant($sessionId, $request->user()->tenant_id);


        try {
            $response = Http::post(config('services.whatsapp.url') . "/sessions/{$sessionId}/sync");

            if (!$response->successful()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to sync session',
                    'error' => $response->json(),
                ], 500);
            }

            $merged = $this->mergeDuplicateConversationsInSession($sessionId);
            $data = $response->json();
            if (is_array($data)) {
                $data['duplicates_merged'] = $merged;
            }

            return response()->json([
                'success' => true,
                'message' => $merged > 0 ? "Sincronização iniciada. {$merged} conversa(s) duplicada(s) unificada(s)." : 'Sync initiated',
                'data' => $data,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error syncing session: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Fetch conversation history from WhatsApp.
     */
    public function fetchConversationHistory(Request $request, string $conversationId): JsonResponse
    {
        $conversation = WhatsappConversation::findOrFail($conversationId);
        
        // SECURITY: Verify tenant ownership through session
        $session = $this->getSessionForTenant($conversation->session_id, $request->user()->tenant_id);
        
        $count = $request->get('count', 50);

        try {
            $response = Http::post(config('services.whatsapp.url') . "/sessions/{$session->id}/fetch-history", [
                'jid' => $conversation->remote_jid,
                'count' => $count,
            ]);

            if (!$response->successful()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to fetch history',
                    'error' => $response->json(),
                ], 500);
            }

            $messages = $response->json('data') ?? [];
            $savedCount = 0;

            // Save fetched messages to database
            foreach ($messages as $messageData) {
                $existingMessage = WhatsappMessage::where('message_id', $messageData['messageId'] ?? null)->first();
                
                if (!$existingMessage && !empty($messageData['messageId'])) {
                    WhatsappMessage::create([
                        'conversation_id' => $conversation->id,
                        'message_id' => $messageData['messageId'],
                        'direction' => ($messageData['fromMe'] ?? false) ? 'outgoing' : 'incoming',
                        'type' => $messageData['type'] ?? 'text',
                        'content' => $messageData['text'] ?? null,
                        'media_url' => $messageData['mediaUrl'] ?? null,
                        'status' => 'delivered',
                    ]);
                    $savedCount++;
                }
            }

            // Update last_message_at
            $lastMessage = $conversation->messages()->latest('created_at')->first();
            if ($lastMessage) {
                $conversation->update(['last_message_at' => $lastMessage->created_at]);
            }

            return response()->json([
                'success' => true,
                'message' => "Fetched {$savedCount} new messages",
                'data' => [
                    'total_fetched' => count($messages),
                    'new_saved' => $savedCount,
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error fetching history: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Link contact to conversation.
     */
    public function linkContact(Request $request, string $conversationId): JsonResponse
    {
        $conversation = WhatsappConversation::findOrFail($conversationId);

        $request->validate([
            'contact_id' => 'required|uuid|exists:clients,id',
        ]);

        $conversation->update(['contact_id' => $request->contact_id]);

        return response()->json([
            'success' => true,
            'data' => $conversation->fresh()->load('contact'),
        ]);
    }

    /**
     * Assign conversation to user.
     */
    public function assignConversation(Request $request, string $conversationId): JsonResponse
    {
        $user = $request->user();
        $conversation = WhatsappConversation::with('session')->findOrFail($conversationId);

        // Sellers can only self-assign unassigned conversations from global sessions.
        if ($user && !$user->isManager() && !$user->isSuperAdmin()) {
            if ($request->user_id !== $user->id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Você só pode atribuir a conversa a si mesmo.',
                ], 403);
            }

            if ($conversation->session?->user_id !== null) {
                return response()->json([
                    'success' => false,
                    'message' => 'Somente sessões globais podem ser assumidas por vendedores.',
                ], 403);
            }

            $updated = WhatsappConversation::where('id', $conversationId)
                ->whereNull('assigned_user_id')
                ->update(['assigned_user_id' => $user->id]);

            if ($updated === 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Conversa já foi atribuída a outro vendedor.',
                ], 409);
            }

            return response()->json([
                'success' => true,
                'data' => $conversation->fresh()->load(['contact', 'assignedUser']),
            ]);
        }

        $request->validate([
            'user_id' => 'nullable|uuid|exists:users,id',
        ]);

        $conversation->update(['assigned_user_id' => $request->user_id]);

        return response()->json([
            'success' => true,
            'data' => $conversation->fresh()->load('assignedUser'),
        ]);
    }

    /**
     * Toggle pin conversation.
     */
    public function togglePin(string $conversationId): JsonResponse
    {
        $conversation = WhatsappConversation::findOrFail($conversationId);
        $conversation->update(['is_pinned' => !$conversation->is_pinned]);

        return response()->json([
            'success' => true,
            'data' => $conversation,
        ]);
    }

    /**
     * Archive conversation.
     */
    public function archiveConversation(string $conversationId): JsonResponse
    {
        $conversation = WhatsappConversation::findOrFail($conversationId);
        $conversation->update(['is_archived' => true]);

        return response()->json([
            'success' => true,
            'message' => 'Conversa arquivada.',
        ]);
    }

    /**
     * Whether a string looks like a raw lid/ID or plain number (no real name).
     */
    private function looksLikeLidOrRawNumber(?string $s): bool
    {
        $s = trim((string) $s);
        if ($s === '') {
            return false;
        }
        return preg_match('/@lid\s*$/i', $s) === 1
            || preg_match('/@s\.whatsapp\.net\s*$/i', $s) === 1
            || preg_match('/^\d+$/', $s) === 1
            || preg_match('/^\+?\d+$/', $s) === 1;
    }

    /**
     * Whether a string is already our formatted number (+XX XX XXXXX-XXXX).
     */
    private function isFormattedNumber(?string $s): bool
    {
        $s = trim((string) $s);
        return $s !== '' && preg_match('/^\+\d{2}\s\d{2}\s\d{4,5}-\d{4,}$/', $s) === 1;
    }

    /**
     * Format digits as +XX XX XXXXX-XXXX (or shorter if fewer digits).
     */
    private function formatPhoneFromDigits(string $digits): ?string
    {
        $digits = preg_replace('/\D/', '', $digits);
        if ($digits === '') {
            return null;
        }
        if (strlen($digits) >= 10) {
            return '+' . substr($digits, 0, 2) . ' ' . substr($digits, 2, 2) . ' ' . substr($digits, 4, 5) . '-' . substr($digits, 9);
        }
        return '+' . $digits;
    }

    /**
     * Fix incorrect contact names.
     * When we send messages, the pushName is OUR name, which incorrectly overwrites contact names.
     * This method tries multiple strategies to fix names.
     */
    public function fixContactNames(string $sessionId): JsonResponse
    {
        $session = WhatsappSession::findOrFail($sessionId);
        
        $ownerPushName = null;
        try {
            $response = Http::timeout(10)->get("{$this->serviceUrl}/sessions/{$sessionId}/status");
            if ($response->successful()) {
                $data = $response->json();
                $ownerPushName = $data['data']['pushName'] ?? null;
                Log::info('Session owner pushName', ['pushName' => $ownerPushName]);
            }
        } catch (\Exception $e) {
            Log::warning('Failed to get session owner pushName', ['error' => $e->getMessage()]);
        }
        
        $conversations = WhatsappConversation::where('session_id', $session->id)
            ->where('is_group', false)
            ->get();
        
        $fixed = 0;
        $skipped = 0;
        $cleared = 0;
        $alreadyOk = 0;
        
        foreach ($conversations as $conversation) {
            $currentName = $conversation->contact_name !== null ? trim((string) $conversation->contact_name) : null;
            $phoneRaw = $conversation->contact_phone !== null ? trim((string) $conversation->contact_phone) : '';
            $remoteJid = $conversation->remote_jid !== null ? trim((string) $conversation->remote_jid) : '';
            
            // Strategy 1: Name is the session owner's name → wrong
            if ($ownerPushName && $currentName === $ownerPushName) {
                $incomingMessage = WhatsappMessage::where('conversation_id', $conversation->id)
                    ->where('direction', 'incoming')
                    ->whereNotNull('sender_name')
                    ->where('sender_name', '!=', '')
                    ->orderByDesc('created_at')
                    ->first();
                $correctName = $incomingMessage ? trim((string) $incomingMessage->sender_name) : null;
                if ($correctName && $correctName !== $ownerPushName && !$this->looksLikeLidOrRawNumber($correctName) && !$this->isFormattedNumber($correctName)) {
                    Log::info('Fixing contact name from incoming (was owner name)', [
                        'conversationId' => $conversation->id,
                        'newName' => $correctName,
                    ]);
                    $conversation->update(['contact_name' => $correctName]);
                    $fixed++;
                    continue;
                }
                Log::info('Clearing incorrect contact name (was owner name)', ['conversationId' => $conversation->id]);
                $conversation->update(['contact_name' => null]);
                $cleared++;
                continue;
            }
            
            // Strategy 2: Get real name from last incoming message (if not lid/formatted number)
            if (!$currentName || $this->looksLikeLidOrRawNumber($currentName) || $this->isFormattedNumber($currentName)) {
                $incomingMessage = WhatsappMessage::where('conversation_id', $conversation->id)
                    ->where('direction', 'incoming')
                    ->whereNotNull('sender_name')
                    ->where('sender_name', '!=', '')
                    ->orderByDesc('created_at')
                    ->first();
                if ($incomingMessage) {
                    $correctName = trim((string) $incomingMessage->sender_name);
                    if ($correctName && $correctName !== $currentName
                        && (!$ownerPushName || $correctName !== $ownerPushName)
                        && !$this->looksLikeLidOrRawNumber($correctName)
                        && !$this->isFormattedNumber($correctName)) {
                        Log::info('Fixing contact name from incoming message', [
                            'conversationId' => $conversation->id,
                            'oldName' => $currentName,
                            'newName' => $correctName,
                        ]);
                        $conversation->update(['contact_name' => $correctName]);
                        $fixed++;
                        continue;
                    }
                }
            }
            
            // Strategy 2b: Fetch real contact name from WhatsApp service (by remote_jid) when we only have number/lid
            if ($remoteJid !== '' && (!$currentName || $this->looksLikeLidOrRawNumber($currentName) || $this->isFormattedNumber($currentName))) {
                try {
                    $response = Http::timeout(5)->post("{$this->serviceUrl}/sessions/{$sessionId}/contact-info", [
                        'jid' => $conversation->remote_jid,
                    ]);
                    if ($response->successful()) {
                        $data = $response->json('data', []);
                        $realName = trim((string) ($data['pushName'] ?? $data['name'] ?? ''));
                        if ($realName !== ''
                            && (!$ownerPushName || $realName !== $ownerPushName)
                            && !$this->looksLikeLidOrRawNumber($realName)
                            && !$this->isFormattedNumber($realName)) {
                            Log::info('Fixing contact name from WhatsApp service (contact-info)', [
                                'conversationId' => $conversation->id,
                                'old' => $currentName,
                                'new' => $realName,
                            ]);
                            $conversation->update(['contact_name' => $realName]);
                            $fixed++;
                            continue;
                        }
                    }
                } catch (\Exception $e) {
                    Log::debug('Contact-info request failed for conversation ' . $conversation->id . ': ' . $e->getMessage());
                }
            }
            
            // Strategy 3: Name/phone/remote_jid is lid or raw number → set name (and phone if needed) to formatted number
            $sourceForLid = $currentName ?: $phoneRaw ?: $remoteJid;
            if ($sourceForLid !== '' && $this->looksLikeLidOrRawNumber($sourceForLid)) {
                $formatted = $this->formatPhoneFromDigits($sourceForLid);
                if ($formatted && $formatted !== $currentName) {
                    Log::info('Setting contact name/phone to formatted number (was lid/raw)', [
                        'conversationId' => $conversation->id,
                        'old' => $currentName,
                        'new' => $formatted,
                    ]);
                    $updates = ['contact_name' => $formatted];
                    if ($phoneRaw !== '' && $this->looksLikeLidOrRawNumber($phoneRaw)) {
                        $updates['contact_phone'] = $formatted;
                    }
                    $conversation->update($updates);
                    $fixed++;
                    continue;
                }
                if ($currentName === $sourceForLid && $formatted) {
                    $conversation->update(['contact_name' => $formatted, 'contact_phone' => $formatted]);
                    $fixed++;
                    continue;
                }
            }
            
            // Strategy 4: Name already formatted but phone still has @lid → normalize phone
            $phoneHasLid = $phoneRaw !== '' && $this->looksLikeLidOrRawNumber($phoneRaw);
            if ($phoneHasLid && $currentName !== null && $this->isFormattedNumber($currentName)) {
                Log::info('Normalizing contact_phone (was @lid)', ['conversationId' => $conversation->id]);
                $conversation->update(['contact_phone' => $currentName]);
                $fixed++;
                continue;
            }
            
            // Already in good shape: name is formatted or a real name, phone has no @lid
            if (($currentName !== null && $currentName !== '') && !$this->looksLikeLidOrRawNumber($currentName)) {
                $alreadyOk++;
                continue;
            }
            if ($currentName !== null && $this->isFormattedNumber($currentName) && !$phoneHasLid) {
                $alreadyOk++;
                continue;
            }
            
            $skipped++;
        }
        
        return response()->json([
            'success' => true,
            'message' => "Nomes corrigidos: {$fixed}, limpos: {$cleared}, já corretos: {$alreadyOk}, ignorados: {$skipped}",
            'data' => [
                'fixed' => $fixed,
                'cleared' => $cleared,
                'already_ok' => $alreadyOk,
                'skipped' => $skipped,
            ],
        ]);
    }

    // ==========================================
    // QUICK REPLIES
    // ==========================================

    /**
     * List quick replies.
     */
    public function listQuickReplies(): JsonResponse
    {
        $replies = WhatsappQuickReply::where('is_active', true)->orderBy('shortcut')->get();

        return response()->json([
            'success' => true,
            'data' => $replies,
        ]);
    }

    /**
     * Create quick reply.
     */
    public function createQuickReply(Request $request): JsonResponse
    {
        $request->validate([
            'shortcut' => 'required|string|max:50',
            'title' => 'required|string|max:255',
            'content' => 'required|string',
        ]);

        $reply = WhatsappQuickReply::create([
            'id' => Str::uuid(),
            'shortcut' => $request->shortcut,
            'title' => $request->title,
            'content' => $request->content,
            'is_active' => true,
        ]);

        return response()->json([
            'success' => true,
            'data' => $reply,
        ], 201);
    }

    /**
     * Update quick reply.
     */
    public function updateQuickReply(Request $request, string $id): JsonResponse
    {
        $reply = WhatsappQuickReply::findOrFail($id);

        $request->validate([
            'shortcut' => 'sometimes|string|max:50',
            'title' => 'sometimes|string|max:255',
            'content' => 'sometimes|string',
            'is_active' => 'sometimes|boolean',
        ]);

        $reply->update($request->all());

        return response()->json([
            'success' => true,
            'data' => $reply->fresh(),
        ]);
    }

    /**
     * Delete quick reply.
     */
    public function deleteQuickReply(string $id): JsonResponse
    {
        $reply = WhatsappQuickReply::findOrFail($id);
        $reply->delete();

        return response()->json([
            'success' => true,
            'message' => 'Resposta rápida excluída.',
        ]);
    }

    // ==========================================
    // ASSIGNMENT QUEUES
    // ==========================================

    /**
     * List assignment queues.
     */
    public function listAssignmentQueues(string $sessionId): JsonResponse
    {
        $queues = WhatsappAssignmentQueue::where('session_id', $sessionId)->get();

        return response()->json([
            'success' => true,
            'data' => $queues,
        ]);
    }

    /**
     * Create assignment queue.
     */
    public function createAssignmentQueue(Request $request, string $sessionId): JsonResponse
    {
        $session = WhatsappSession::findOrFail($sessionId);

        $request->validate([
            'name' => 'required|string|max:255',
            'user_ids' => 'required|array',
            'user_ids.*' => 'uuid|exists:users,id',
        ]);

        $queue = WhatsappAssignmentQueue::create([
            'id' => Str::uuid(),
            'session_id' => $sessionId,
            'name' => $request->name,
            'user_ids' => $request->user_ids,
            'is_active' => true,
        ]);

        return response()->json([
            'success' => true,
            'data' => $queue,
        ], 201);
    }

    /**
     * Update assignment queue.
     */
    public function updateAssignmentQueue(Request $request, string $id): JsonResponse
    {
        $queue = WhatsappAssignmentQueue::findOrFail($id);

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'user_ids' => 'sometimes|array',
            'user_ids.*' => 'uuid|exists:users,id',
            'is_active' => 'sometimes|boolean',
        ]);

        $queue->update($request->all());

        return response()->json([
            'success' => true,
            'data' => $queue->fresh(),
        ]);
    }

    /**
     * Delete assignment queue.
     */
    public function deleteAssignmentQueue(string $id): JsonResponse
    {
        $queue = WhatsappAssignmentQueue::findOrFail($id);
        $queue->delete();

        return response()->json([
            'success' => true,
            'message' => 'Fila excluída.',
        ]);
    }

    /**
     * Proxy media files from WhatsApp service.
     * This endpoint serves media files (images, videos, audio, documents) 
     * that were downloaded from WhatsApp messages.
     */
    public function proxyMedia(string $filename)
    {
        try {
            // Sanitize filename to prevent directory traversal
            $filename = basename($filename);
            
            // Get the media from the WhatsApp service
            $response = Http::timeout(60)->get("{$this->serviceUrl}/media/{$filename}");

            if (!$response->successful()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Media not found',
                ], 404);
            }

            // Get content type from response or infer from extension
            $contentType = $response->header('Content-Type') ?? 'application/octet-stream';
            
            // If content type is not set properly, try to infer from extension
            if ($contentType === 'application/octet-stream') {
                $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
                $mimeTypes = [
                    'jpg' => 'image/jpeg',
                    'jpeg' => 'image/jpeg',
                    'png' => 'image/png',
                    'gif' => 'image/gif',
                    'webp' => 'image/webp',
                    'mp4' => 'video/mp4',
                    'ogg' => 'audio/ogg',
                    'mp3' => 'audio/mpeg',
                    'pdf' => 'application/pdf',
                ];
                $contentType = $mimeTypes[$extension] ?? 'application/octet-stream';
            }

            return response($response->body())
                ->header('Content-Type', $contentType)
                ->header('Cache-Control', 'public, max-age=604800') // Cache for 7 days
                ->header('Content-Disposition', 'inline; filename="' . $filename . '"');

        } catch (\Exception $e) {
            Log::error('Error proxying media: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error fetching media',
            ], 500);
        }
    }
    /**
     * Get conversations filtered by user (for managers/admins).
     * Supports multiple user_ids for multi-select filtering.
     *
     * Query params:
     * - user_ids: array of user IDs (optional)
     * - search: search term (optional)
     * - unread_only: boolean (optional)
     */
    public function getConversationsByUser(Request $request): JsonResponse
    {
        $user = $request->user();

        // SECURITY: Only managers and admins can filter by user
        if (!$user->isAdmin() && !$user->isManager()) {
            return response()->json([
                'success' => false,
                'message' => 'Acesso negado. Apenas gestores e administradores podem filtrar conversas por vendedor.',
            ], 403);
        }

        $request->validate([
            'user_ids' => 'nullable|array',
            'user_ids.*' => 'uuid|exists:users,id',
            'search' => 'nullable|string|max:255',
            'unread_only' => 'nullable|boolean',
        ]);

        $query = WhatsappConversation::with([
            'contact',
            'assignedUser:id,name,email,avatar',
            'lastMessage',
        ])->whereHas('session', function ($q) use ($user) {
            $q->where('tenant_id', $user->tenant_id);
        });

        // Filter by multiple users (if provided)
        if ($request->filled('user_ids') && count($request->user_ids) > 0) {
            $query->whereIn('assigned_user_id', $request->user_ids);
        }

        // Search filter
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('contact_name', 'ilike', "%{$search}%")
                  ->orWhere('contact_phone', 'like', "%{$search}%")
                  ->orWhereHas('contact', function ($q2) use ($search) {
                      $q2->where('name', 'ilike', "%{$search}%");
                  });
            });
        }

        // Unread only filter
        if ($request->boolean('unread_only')) {
            $query->where('unread_count', '>', 0);
        }

        $conversations = $query->orderByDesc('is_pinned')
            ->orderByDesc('last_message_at')
            ->paginate($request->get('per_page', 50));

        // Add user list for filter dropdown
        $availableUsers = User::where('tenant_id', $user->tenant_id)
            ->where('is_active', true)
            ->whereHas('whatsappConversations', function ($q) use ($user) {
                $q->whereHas('session', function ($q2) use ($user) {
                    $q2->where('tenant_id', $user->tenant_id);
                });
            })
            ->select('id', 'name', 'email', 'avatar')
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $conversations,
            'meta' => [
                'available_users' => $availableUsers,
            ],
        ]);
    }
}
