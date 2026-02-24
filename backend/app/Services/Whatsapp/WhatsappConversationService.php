<?php

namespace App\Services\Whatsapp;

use App\Models\WhatsappConversation;
use App\Models\WhatsappSession;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Illuminate\Database\Eloquent\Builder;

class WhatsappConversationService
{
    /**
     * List conversations with proper filtering
     */
    public function listConversations(
        WhatsappSession $session,
        User $user,
        array $filters = []
    ): Collection {
        $query = WhatsappConversation::where('session_id', $session->id)
            ->with(['contact', 'assignedUser', 'lastMessage']);

        // Filter archived conversations
        if (!($filters['include_archived'] ?? false)) {
            $query->where('is_archived', false);
        }

        // Apply role-based filtering
        $this->applyRoleBasedFiltering($query, $user, $filters);

        // Apply search filter
        if (!empty($filters['search'])) {
            $this->applySearchFilter($query, $filters['search']);
        }

        return $query->orderByDesc('is_pinned')
            ->orderByDesc('last_message_at')
            ->get();
    }

    /**
     * Apply role-based filtering for conversations
     */
    private function applyRoleBasedFiltering(Builder $query, User $user, array $filters): void
    {
        if (!$user->isAdmin() && !$user->isManager()) {
            // Sales users only see their assigned conversations
            $query->where('assigned_user_id', $user->id);
            return;
        }

        // Admins/Managers can filter by specific user
        if (!empty($filters['assigned_to'])) {
            $query->where('assigned_user_id', $filters['assigned_to']);
            return;
        }

        // Filter by seller signature (admins/managers only)
        if (!empty($filters['assigned_signature'])) {
            $signature = strtoupper($filters['assigned_signature']);
            $query->whereHas('assignedUser', function ($q) use ($signature) {
                $q->where('signature', $signature);
            });
        }

        // "My conversations" filter for admins/managers
        if (($filters['my_conversations'] ?? false)) {
            $query->where('assigned_user_id', $user->id);
        }
    }

    /**
     * Apply search filter to conversations
     */
    private function applySearchFilter(Builder $query, string $search): void
    {
        $query->where(function ($q) use ($search) {
            $q->where('contact_name', 'ilike', "%{$search}%")
                ->orWhere('contact_phone', 'ilike', "%{$search}%");
        });
    }

    /**
     * Start a new conversation
     */
    public function startConversation(
        WhatsappSession $session,
        string $phoneNumber,
        User $user,
        ?string $contactName = null
    ): WhatsappConversation {
        $phoneNumber = preg_replace('/\D/', '', $phoneNumber);
        $remoteJid = "{$phoneNumber}@s.whatsapp.net";

        $assignedUserId = null;
        if (!$user->isAdmin() && !$user->isManager()) {
            $assignedUserId = $user->id;
        }

        return WhatsappConversation::firstOrCreate(
            [
                'session_id' => $session->id,
                'remote_jid' => $remoteJid,
            ],
            [
                'id' => Str::uuid(),
                'contact_phone' => $phoneNumber,
                'contact_name' => $contactName,
                'last_message_at' => now(),
                'assigned_user_id' => $assignedUserId,
            ]
        );
    }

    /**
     * Link contact to conversation
     */
    public function linkContact(WhatsappConversation $conversation, string $contactId): WhatsappConversation
    {
        $conversation->update(['contact_id' => $contactId]);
        return $conversation->fresh()->load('contact');
    }

    /**
     * Assign conversation to user
     */
    public function assignConversation(
        WhatsappConversation $conversation,
        User $requestingUser,
        ?string $userId = null
    ): array {
        // Sales users can only self-assign unassigned conversations from global sessions
        if (!$requestingUser->isAdmin() && !$requestingUser->isManager()) {
            return $this->handleSalesUserAssignment($conversation, $requestingUser);
        }

        // Admins/Managers can assign to any user
        $conversation->update(['assigned_user_id' => $userId]);

        return [
            'success' => true,
            'conversation' => $conversation->fresh()->load('assignedUser'),
        ];
    }

    /**
     * Handle assignment for sales users
     */
    private function handleSalesUserAssignment(
        WhatsappConversation $conversation,
        User $user
    ): array {
        // Can only self-assign
        if ($conversation->session?->user_id !== null) {
            return [
                'success' => false,
                'message' => 'Somente sessões globais podem ser assumidas por vendedores.',
            ];
        }

        // Try to assign (atomic operation to prevent race conditions)
        $updated = WhatsappConversation::where('id', $conversation->id)
            ->whereNull('assigned_user_id')
            ->update(['assigned_user_id' => $user->id]);

        if ($updated === 0) {
            return [
                'success' => false,
                'message' => 'Conversa já foi atribuída a outro vendedor.',
            ];
        }

        return [
            'success' => true,
            'conversation' => $conversation->fresh()->load(['contact', 'assignedUser']),
        ];
    }

    /**
     * Toggle pin status
     */
    public function togglePin(WhatsappConversation $conversation): WhatsappConversation
    {
        $conversation->update(['is_pinned' => !$conversation->is_pinned]);
        return $conversation;
    }

    /**
     * Archive conversation
     */
    public function archiveConversation(WhatsappConversation $conversation): void
    {
        $conversation->update(['is_archived' => true]);
    }

    /**
     * Mark conversation as read
     */
    public function markAsRead(WhatsappConversation $conversation): void
    {
        $conversation->update(['unread_count' => 0]);
    }

    /**
     * Update conversation metadata
     */
    public function updateConversation(WhatsappConversation $conversation, array $data): WhatsappConversation
    {
        $conversation->update($data);
        return $conversation;
    }

    /**
     * Check if user can access conversation
     */
    public function canUserAccessConversation(User $user, WhatsappConversation $conversation): array
    {
        // Check tenant isolation
        if ($conversation->session?->tenant_id !== $user->tenant_id) {
            return [
                'allowed' => false,
                'message' => 'Acesso negado.',
            ];
        }

        // Admins and Managers can access all conversations
        if ($user->isAdmin() || $user->isManager()) {
            return ['allowed' => true];
        }

        // Sales users can only access their own session's conversations
        if ($conversation->session?->user_id !== $user->id) {
            return [
                'allowed' => false,
                'message' => 'Acesso negado. Você só pode acessar conversas de suas próprias sessões.',
            ];
        }

        // Auto-assign if unassigned
        if ($conversation->assigned_user_id === null) {
            $conversation->update(['assigned_user_id' => $user->id]);
            return ['allowed' => true];
        }

        // Check if conversation is assigned to user
        if ($conversation->assigned_user_id !== $user->id) {
            return [
                'allowed' => false,
                'message' => 'Acesso negado. Esta conversa está atribuída a outro usuário.',
            ];
        }

        return ['allowed' => true];
    }

    /**
     * Get conversations by user (for admins/managers)
     */
    public function getConversationsByUser(
        User $requestingUser,
        array $filters = []
    ): array {
        $query = WhatsappConversation::with([
            'contact',
            'assignedUser:id,name,email,avatar',
            'lastMessage',
        ])->whereHas('session', function ($q) use ($requestingUser) {
            $q->where('tenant_id', $requestingUser->tenant_id);
        });

        // Filter by multiple users
        if (!empty($filters['user_ids']) && is_array($filters['user_ids'])) {
            $query->whereIn('assigned_user_id', $filters['user_ids']);
        }

        // Search filter
        if (!empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('contact_name', 'ilike', "%{$search}%")
                    ->orWhere('contact_phone', 'like', "%{$search}%")
                    ->orWhereHas('contact', function ($q2) use ($search) {
                        $q2->where('name', 'ilike', "%{$search}%");
                    });
            });
        }

        // Unread only filter
        if ($filters['unread_only'] ?? false) {
            $query->where('unread_count', '>', 0);
        }

        $conversations = $query->orderByDesc('is_pinned')
            ->orderByDesc('last_message_at')
            ->paginate($filters['per_page'] ?? 50);

        // Get available users for filter
        $availableUsers = User::where('tenant_id', $requestingUser->tenant_id)
            ->where('is_active', true)
            ->whereHas('whatsappConversations', function ($q) use ($requestingUser) {
                $q->whereHas('session', function ($q2) use ($requestingUser) {
                    $q2->where('tenant_id', $requestingUser->tenant_id);
                });
            })
            ->select('id', 'name', 'email', 'avatar')
            ->orderBy('name')
            ->get();

        return [
            'conversations' => $conversations,
            'available_users' => $availableUsers,
        ];
    }
}
