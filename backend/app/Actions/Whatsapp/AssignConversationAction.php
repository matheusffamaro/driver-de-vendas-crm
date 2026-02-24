<?php

namespace App\Actions\Whatsapp;

use App\Models\User;
use App\Models\WhatsappConversation;
use App\Services\Whatsapp\WhatsappConversationService;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

/**
 * Action to assign a conversation to a user
 * 
 * Handles the complex logic of assigning conversations, including:
 * - Authorization checks
 * - Global session handling
 * - Race condition prevention
 * - Notification triggering
 */
class AssignConversationAction
{
    public function __construct(
        private WhatsappConversationService $conversationService
    ) {}

    /**
     * Execute the action to assign a conversation
     * 
     * @param WhatsappConversation $conversation Conversation to assign
     * @param User $requestingUser User requesting the assignment
     * @param User|null $targetUser User to assign to (null for self-assignment)
     * @return array Result with success status and updated conversation
     */
    public function execute(
        WhatsappConversation $conversation,
        User $requestingUser,
        ?User $targetUser = null
    ): array {
        try {
            DB::beginTransaction();

            // If no target user specified, assign to requesting user
            $targetUserId = $targetUser ? $targetUser->id : $requestingUser->id;

            // Validate assignment is allowed
            $validation = $this->validateAssignment($conversation, $requestingUser, $targetUser);
            if (!$validation['allowed']) {
                return [
                    'success' => false,
                    'message' => $validation['message'],
                    'conversation' => null,
                ];
            }

            // Perform assignment through service
            $result = $this->conversationService->assignConversation(
                $conversation,
                $requestingUser,
                $targetUserId
            );

            if (!$result['success']) {
                DB::rollBack();
                return $result;
            }

            // Log assignment
            Log::info('Conversation assigned', [
                'conversation_id' => $conversation->id,
                'requesting_user_id' => $requestingUser->id,
                'target_user_id' => $targetUserId,
            ]);

            // TODO: Send notification to assigned user
            // $this->notifyUserOfAssignment($targetUser, $conversation);

            DB::commit();

            return [
                'success' => true,
                'message' => 'Conversa atribuída com sucesso.',
                'conversation' => $result['conversation'],
            ];

        } catch (\Exception $e) {
            DB::rollBack();

            Log::error('Error assigning conversation', [
                'error' => $e->getMessage(),
                'conversation_id' => $conversation->id,
                'requesting_user_id' => $requestingUser->id,
            ]);

            return [
                'success' => false,
                'message' => 'Erro ao atribuir conversa: ' . $e->getMessage(),
                'conversation' => null,
            ];
        }
    }

    /**
     * Validate if assignment is allowed
     */
    private function validateAssignment(
        WhatsappConversation $conversation,
        User $requestingUser,
        ?User $targetUser
    ): array {
        // Check tenant isolation
        if ($conversation->session?->tenant_id !== $requestingUser->tenant_id) {
            return [
                'allowed' => false,
                'message' => 'Acesso negado. Conversa pertence a outro tenant.',
            ];
        }

        // Check if conversation is already assigned
        if ($conversation->assigned_user_id) {
            // Only admins/managers can reassign
            if (!$requestingUser->isAdmin() && !$requestingUser->isManager()) {
                return [
                    'allowed' => false,
                    'message' => 'Esta conversa já está atribuída. Apenas administradores podem reatribuir.',
                ];
            }
        }

        // Sales users can only self-assign from global sessions
        if (!$requestingUser->isAdmin() && !$requestingUser->isManager()) {
            if ($targetUser && $targetUser->id !== $requestingUser->id) {
                return [
                    'allowed' => false,
                    'message' => 'Você só pode atribuir conversas a si mesmo.',
                ];
            }

            if ($conversation->session?->user_id !== null) {
                return [
                    'allowed' => false,
                    'message' => 'Somente sessões globais podem ser assumidas por vendedores.',
                ];
            }
        }

        // Verify target user is in same tenant
        if ($targetUser && $targetUser->tenant_id !== $requestingUser->tenant_id) {
            return [
                'allowed' => false,
                'message' => 'Não é possível atribuir a um usuário de outro tenant.',
            ];
        }

        return ['allowed' => true];
    }

    /**
     * Bulk assign conversations to a user
     */
    public function bulkAssign(array $conversationIds, User $requestingUser, User $targetUser): array
    {
        $results = [
            'success' => [],
            'failed' => [],
        ];

        foreach ($conversationIds as $conversationId) {
            try {
                $conversation = WhatsappConversation::findOrFail($conversationId);
                $result = $this->execute($conversation, $requestingUser, $targetUser);

                if ($result['success']) {
                    $results['success'][] = $conversationId;
                } else {
                    $results['failed'][] = [
                        'id' => $conversationId,
                        'error' => $result['message'],
                    ];
                }
            } catch (\Exception $e) {
                $results['failed'][] = [
                    'id' => $conversationId,
                    'error' => $e->getMessage(),
                ];
            }
        }

        return [
            'success' => true,
            'message' => sprintf(
                '%d conversas atribuídas com sucesso, %d falharam.',
                count($results['success']),
                count($results['failed'])
            ),
            'results' => $results,
        ];
    }

    /**
     * Unassign a conversation
     */
    public function unassign(WhatsappConversation $conversation, User $requestingUser): array
    {
        if (!$requestingUser->isAdmin() && !$requestingUser->isManager()) {
            return [
                'success' => false,
                'message' => 'Apenas administradores e gerentes podem remover atribuições.',
                'conversation' => null,
            ];
        }

        try {
            $conversation->update(['assigned_user_id' => null]);

            Log::info('Conversation unassigned', [
                'conversation_id' => $conversation->id,
                'requesting_user_id' => $requestingUser->id,
            ]);

            return [
                'success' => true,
                'message' => 'Atribuição removida com sucesso.',
                'conversation' => $conversation->fresh(),
            ];
        } catch (\Exception $e) {
            Log::error('Error unassigning conversation', [
                'error' => $e->getMessage(),
                'conversation_id' => $conversation->id,
            ]);

            return [
                'success' => false,
                'message' => 'Erro ao remover atribuição.',
                'conversation' => null,
            ];
        }
    }
}
