<?php

namespace App\Services\Whatsapp;

use App\Models\WhatsappSession;
use App\Models\WhatsappConversation;
use App\Models\WhatsappMessage;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Support\Collection;

class WhatsappSessionService
{
    private string $serviceUrl;
    private int $timeout;

    public function __construct()
    {
        $this->serviceUrl = config('whatsapp.service.url');
        $this->timeout = config('whatsapp.service.timeout');
    }

    /**
     * Get session for tenant with security check
     */
    public function getSessionForTenant(string $sessionId, string $tenantId): WhatsappSession
    {
        return WhatsappSession::where('id', $sessionId)
            ->where('tenant_id', $tenantId)
            ->firstOrFail();
    }

    /**
     * List sessions with proper filtering by user role
     */
    public function listSessions(User $user): Collection
    {
        $query = WhatsappSession::query()
            ->when($user->tenant_id, fn($q) => $q->where('tenant_id', $user->tenant_id));

        // SECURITY: Sales users see only their own sessions
        if (!$user->isAdmin() && !$user->isManager()) {
            $query->where('user_id', $user->id);
        }

        return $query->orderByDesc('connected_at')->get();
    }

    /**
     * Create or restore a WhatsApp session
     */
    public function createSession(
        string $phoneNumber,
        User $user,
        ?string $sessionName = null,
        bool $isGlobal = false
    ): array {
        $tenantId = $user->tenant_id;

        // Check if session already exists
        $existing = WhatsappSession::withTrashed()
            ->where('phone_number', $phoneNumber)
            ->when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
            ->first();

        if ($existing) {
            if ($existing->trashed()) {
                $existing->restore();
            }
            $session = $existing;
            $session->update([
                'session_name' => $sessionName ?? $existing->session_name,
                'status' => 'connecting',
            ]);
        } else {
            $userId = $this->determineSessionOwner($user, $isGlobal);

            $session = WhatsappSession::create([
                'id' => Str::uuid(),
                'tenant_id' => $tenantId,
                'user_id' => $userId,
                'phone_number' => $phoneNumber,
                'session_name' => $sessionName,
                'status' => 'connecting',
            ]);
        }

        // Call WhatsApp service to initiate session
        $result = $this->initiateSessionOnService($session);

        return [
            'success' => $result['success'],
            'message' => $result['message'],
            'session' => $session,
        ];
    }

    /**
     * Determine session owner based on user role and global flag
     */
    private function determineSessionOwner(User $user, bool $isGlobal): ?string
    {
        // Sales users always create sessions assigned to themselves
        if (!$user->isAdmin() && !$user->isManager()) {
            return $user->id;
        }

        // Admins/Managers can create global sessions
        return $isGlobal ? null : $user->id;
    }

    /**
     * Initiate session on WhatsApp service
     */
    private function initiateSessionOnService(WhatsappSession $session): array
    {
        try {
            $response = Http::timeout($this->timeout)->post("{$this->serviceUrl}/sessions", [
                'sessionId' => $session->id,
                'phoneNumber' => $session->phone_number,
            ]);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'message' => 'Sessão iniciada com sucesso. Aguardando QR Code.',
                ];
            }

            $session->update(['status' => 'failed']);
            return [
                'success' => false,
                'message' => 'Erro ao iniciar sessão no serviço WhatsApp.',
            ];
        } catch (\Exception $e) {
            Log::error('WhatsApp session creation error', [
                'error' => $e->getMessage(),
                'session_id' => $session->id,
            ]);

            $session->update(['status' => 'failed']);
            return [
                'success' => false,
                'message' => 'Erro de comunicação com o serviço WhatsApp.',
            ];
        }
    }

    /**
     * Get QR Code for session
     */
    public function getQRCode(WhatsappSession $session): array
    {
        if ($session->status === 'connected') {
            return [
                'success' => true,
                'status' => 'connected',
                'message' => 'Sessão já está conectada.',
                'qr_code' => null,
            ];
        }

        if ($session->qr_code) {
            return [
                'success' => true,
                'status' => $session->status,
                'qr_code' => $session->qr_code,
            ];
        }

        return $this->fetchQRCodeFromService($session);
    }

    /**
     * Fetch QR Code from WhatsApp service
     */
    private function fetchQRCodeFromService(WhatsappSession $session): array
    {
        try {
            $response = Http::timeout($this->timeout)
                ->get("{$this->serviceUrl}/sessions/{$session->id}/qr-code");

            if ($response->successful()) {
                $data = $response->json();
                if (isset($data['data']['qrCode'])) {
                    $session->update(['qr_code' => $data['data']['qrCode']]);
                }
                return [
                    'success' => true,
                    'status' => $data['data']['status'] ?? $session->status,
                    'qr_code' => $data['data']['qrCode'] ?? null,
                ];
            }
        } catch (\Exception $e) {
            Log::error('WhatsApp QR code error', [
                'error' => $e->getMessage(),
                'session_id' => $session->id,
            ]);
        }

        return [
            'success' => true,
            'status' => $session->status,
            'qr_code' => null,
            'message' => 'QR Code não disponível.',
        ];
    }

    /**
     * Disconnect session
     */
    public function disconnectSession(WhatsappSession $session): void
    {
        try {
            Http::timeout($this->timeout)
                ->post("{$this->serviceUrl}/sessions/{$session->id}/disconnect");
        } catch (\Exception $e) {
            Log::error('WhatsApp disconnect error', [
                'error' => $e->getMessage(),
                'session_id' => $session->id,
            ]);
        }

        $session->update([
            'status' => 'disconnected',
            'qr_code' => null,
        ]);
    }

    /**
     * Delete session and clean up data
     */
    public function deleteSession(WhatsappSession $session): void
    {
        try {
            Http::timeout($this->timeout)
                ->delete("{$this->serviceUrl}/sessions/{$session->id}");
        } catch (\Exception $e) {
            Log::error('WhatsApp delete error', [
                'error' => $e->getMessage(),
                'session_id' => $session->id,
            ]);
        }

        $session->delete();
    }

    /**
     * Clear all session data (conversations and messages)
     */
    public function clearSessionData(WhatsappSession $session): int
    {
        $conversationIds = WhatsappConversation::where('session_id', $session->id)
            ->pluck('id');

        WhatsappMessage::whereIn('conversation_id', $conversationIds)->delete();
        WhatsappConversation::where('session_id', $session->id)->delete();

        $session->update(['qr_code' => null]);

        return $conversationIds->count();
    }

    /**
     * Reconnect session (disconnect, clear data, and reconnect)
     */
    public function reconnectSession(WhatsappSession $session): array
    {
        // 1. Disconnect on service
        try {
            Http::timeout($this->timeout)
                ->delete("{$this->serviceUrl}/sessions/{$session->id}");
        } catch (\Exception $e) {
            Log::warning('Error disconnecting session for reconnect', [
                'error' => $e->getMessage(),
                'session_id' => $session->id,
            ]);
        }

        // 2. Clear old data
        $this->clearSessionData($session);

        // 3. Reset session status
        $session->update([
            'status' => 'pending',
            'qr_code' => null,
            'connected_at' => null,
        ]);

        // 4. Create new session on service
        return $this->initiateSessionOnService($session);
    }

    /**
     * Sync session with WhatsApp service
     */
    public function syncSession(WhatsappSession $session): array
    {
        try {
            $response = Http::timeout($this->timeout)
                ->post("{$this->serviceUrl}/sessions/{$session->id}/sync");

            if (!$response->successful()) {
                return [
                    'success' => false,
                    'message' => 'Failed to sync session',
                    'error' => $response->json(),
                ];
            }

            return [
                'success' => true,
                'message' => 'Sync initiated',
                'data' => $response->json(),
            ];
        } catch (\Exception $e) {
            Log::error('Error syncing session', [
                'error' => $e->getMessage(),
                'session_id' => $session->id,
            ]);

            return [
                'success' => false,
                'message' => 'Error syncing session: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Get session status from WhatsApp service
     */
    public function getSessionStatus(WhatsappSession $session): array
    {
        return [
            'status' => $session->status,
            'phone_number' => $session->phone_number,
            'connected_at' => $session->connected_at,
        ];
    }

    /**
     * Check if user can access session
     */
    public function canUserAccessSession(User $user, WhatsappSession $session): bool
    {
        // Admin and Manager can access all sessions in their tenant
        if ($user->isAdmin() || $user->isManager()) {
            return $session->tenant_id === $user->tenant_id;
        }

        // Sales users can only access their own sessions
        return $session->user_id === $user->id 
            && $session->tenant_id === $user->tenant_id;
    }
}
