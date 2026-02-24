<?php

namespace App\Actions\Whatsapp;

use App\Models\User;
use App\Models\WhatsappSession;
use App\Services\Whatsapp\WhatsappSessionService;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

/**
 * Action to create a new WhatsApp session
 * 
 * This action encapsulates the complex logic of creating a session,
 * including validation, authorization, and external service communication.
 */
class CreateSessionAction
{
    public function __construct(
        private WhatsappSessionService $sessionService
    ) {}

    /**
     * Execute the action to create a WhatsApp session
     * 
     * @param string $phoneNumber Phone number for the session
     * @param User $user User creating the session
     * @param string|null $sessionName Optional session name
     * @param bool $isGlobal Whether this should be a global session
     * @return array Result with success status, message, and session data
     */
    public function execute(
        string $phoneNumber,
        User $user,
        ?string $sessionName = null,
        bool $isGlobal = false
    ): array {
        try {
            // Begin database transaction
            DB::beginTransaction();

            // Validate user permissions for global sessions
            if ($isGlobal && !$this->canCreateGlobalSession($user)) {
                return [
                    'success' => false,
                    'message' => 'Você não tem permissão para criar sessões globais.',
                    'session' => null,
                ];
            }

            // Normalize phone number
            $phoneNumber = $this->normalizePhoneNumber($phoneNumber);

            // Check if user already has too many sessions
            if (!$this->canCreateMoreSessions($user)) {
                return [
                    'success' => false,
                    'message' => 'Limite de sessões atingido para seu plano.',
                    'session' => null,
                ];
            }

            // Create session using service
            $result = $this->sessionService->createSession(
                $phoneNumber,
                $user,
                $sessionName,
                $isGlobal
            );

            if (!$result['success']) {
                DB::rollBack();
                return $result;
            }

            // Log session creation
            Log::info('WhatsApp session created', [
                'user_id' => $user->id,
                'phone_number' => $phoneNumber,
                'session_id' => $result['session']->id,
                'is_global' => $isGlobal,
            ]);

            DB::commit();

            return [
                'success' => true,
                'message' => 'Sessão criada com sucesso. Aguardando QR Code.',
                'session' => $result['session'],
            ];

        } catch (\Exception $e) {
            DB::rollBack();
            
            Log::error('Error creating WhatsApp session', [
                'error' => $e->getMessage(),
                'user_id' => $user->id,
                'phone_number' => $phoneNumber,
            ]);

            return [
                'success' => false,
                'message' => 'Erro ao criar sessão: ' . $e->getMessage(),
                'session' => null,
            ];
        }
    }

    /**
     * Check if user can create global sessions
     */
    private function canCreateGlobalSession(User $user): bool
    {
        return $user->isAdmin() || $user->isManager();
    }

    /**
     * Normalize phone number (remove non-numeric characters)
     */
    private function normalizePhoneNumber(string $phoneNumber): string
    {
        return preg_replace('/\D/', '', $phoneNumber);
    }

    /**
     * Check if user can create more sessions based on their plan
     */
    private function canCreateMoreSessions(User $user): bool
    {
        // Get user's plan limits
        $plan = $user->tenant->subscription?->plan;
        
        if (!$plan) {
            return true; // No plan restrictions
        }

        // Count active sessions for this user
        $activeSessionsCount = WhatsappSession::where('user_id', $user->id)
            ->where('tenant_id', $user->tenant_id)
            ->whereIn('status', ['connected', 'connecting', 'qr_code'])
            ->count();

        // For now, allow unlimited sessions
        // In the future, add plan limits here
        return true;
    }
}
