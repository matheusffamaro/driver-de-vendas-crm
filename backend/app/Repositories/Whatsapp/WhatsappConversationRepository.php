<?php

namespace App\Repositories\Whatsapp;

use App\Models\WhatsappConversation;
use App\Models\WhatsappSession;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * Repository for WhatsApp Conversation data access
 */
class WhatsappConversationRepository
{
    /**
     * Find conversation by ID
     */
    public function findById(string $conversationId): ?WhatsappConversation
    {
        return WhatsappConversation::find($conversationId);
    }

    /**
     * Find conversation by ID with relations
     */
    public function findByIdWithRelations(string $conversationId, array $relations = []): ?WhatsappConversation
    {
        return WhatsappConversation::with($relations)->find($conversationId);
    }

    /**
     * Find conversation by remote JID and session
     */
    public function findByRemoteJid(string $sessionId, string $remoteJid): ?WhatsappConversation
    {
        return WhatsappConversation::where('session_id', $sessionId)
            ->where('remote_jid', $remoteJid)
            ->first();
    }

    /**
     * Find conversation by remote JID (including trashed)
     */
    public function findByRemoteJidWithTrashed(string $sessionId, string $remoteJid): ?WhatsappConversation
    {
        return WhatsappConversation::withTrashed()
            ->where('session_id', $sessionId)
            ->where('remote_jid', $remoteJid)
            ->first();
    }

    /**
     * Get all conversations for a session
     */
    public function getAllForSession(
        WhatsappSession $session,
        bool $includeArchived = false
    ): Collection {
        $query = WhatsappConversation::where('session_id', $session->id)
            ->with(['contact', 'assignedUser', 'lastMessage']);

        if (!$includeArchived) {
            $query->where('is_archived', false);
        }

        return $query->orderByDesc('is_pinned')
            ->orderByDesc('last_message_at')
            ->get();
    }

    /**
     * Get conversations assigned to a user
     */
    public function getAssignedToUser(User $user, bool $includeArchived = false): Collection
    {
        $query = WhatsappConversation::where('assigned_user_id', $user->id)
            ->whereHas('session', function ($q) use ($user) {
                $q->where('tenant_id', $user->tenant_id);
            })
            ->with(['contact', 'session', 'lastMessage']);

        if (!$includeArchived) {
            $query->where('is_archived', false);
        }

        return $query->orderByDesc('is_pinned')
            ->orderByDesc('last_message_at')
            ->get();
    }

    /**
     * Get unassigned conversations for a session
     */
    public function getUnassignedForSession(WhatsappSession $session): Collection
    {
        return WhatsappConversation::where('session_id', $session->id)
            ->whereNull('assigned_user_id')
            ->where('is_archived', false)
            ->orderByDesc('last_message_at')
            ->get();
    }

    /**
     * Get conversations with unread messages
     */
    public function getUnread(string $tenantId, ?string $userId = null): Collection
    {
        $query = WhatsappConversation::where('unread_count', '>', 0)
            ->whereHas('session', function ($q) use ($tenantId) {
                $q->where('tenant_id', $tenantId);
            })
            ->with(['contact', 'session', 'lastMessage']);

        if ($userId) {
            $query->where('assigned_user_id', $userId);
        }

        return $query->orderByDesc('last_message_at')->get();
    }

    /**
     * Paginate conversations for tenant
     */
    public function paginateForTenant(
        string $tenantId,
        int $perPage = 50,
        array $filters = []
    ): LengthAwarePaginator {
        $query = WhatsappConversation::whereHas('session', function ($q) use ($tenantId) {
            $q->where('tenant_id', $tenantId);
        })->with(['contact', 'assignedUser', 'lastMessage', 'session']);

        // Apply filters
        if (!empty($filters['assigned_user_id'])) {
            $query->where('assigned_user_id', $filters['assigned_user_id']);
        }

        if (!empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('contact_name', 'ilike', "%{$search}%")
                  ->orWhere('contact_phone', 'like', "%{$search}%");
            });
        }

        if ($filters['unread_only'] ?? false) {
            $query->where('unread_count', '>', 0);
        }

        if (!($filters['include_archived'] ?? false)) {
            $query->where('is_archived', false);
        }

        return $query->orderByDesc('is_pinned')
            ->orderByDesc('last_message_at')
            ->paginate($perPage);
    }

    /**
     * Create a new conversation
     */
    public function create(array $data): WhatsappConversation
    {
        return WhatsappConversation::create($data);
    }

    /**
     * First or create conversation
     */
    public function firstOrCreate(array $attributes, array $values = []): WhatsappConversation
    {
        return WhatsappConversation::firstOrCreate($attributes, $values);
    }

    /**
     * Update conversation
     */
    public function update(WhatsappConversation $conversation, array $data): bool
    {
        return $conversation->update($data);
    }

    /**
     * Delete conversation
     */
    public function delete(WhatsappConversation $conversation): bool
    {
        return $conversation->delete();
    }

    /**
     * Restore conversation
     */
    public function restore(WhatsappConversation $conversation): bool
    {
        return $conversation->restore();
    }

    /**
     * Assign conversation to user
     */
    public function assignToUser(WhatsappConversation $conversation, string $userId): bool
    {
        return $conversation->update(['assigned_user_id' => $userId]);
    }

    /**
     * Unassign conversation
     */
    public function unassign(WhatsappConversation $conversation): bool
    {
        return $conversation->update(['assigned_user_id' => null]);
    }

    /**
     * Mark conversation as read
     */
    public function markAsRead(WhatsappConversation $conversation): bool
    {
        return $conversation->update(['unread_count' => 0]);
    }

    /**
     * Increment unread count
     */
    public function incrementUnreadCount(WhatsappConversation $conversation, int $amount = 1): bool
    {
        return $conversation->increment('unread_count', $amount);
    }

    /**
     * Toggle pin status
     */
    public function togglePin(WhatsappConversation $conversation): bool
    {
        return $conversation->update(['is_pinned' => !$conversation->is_pinned]);
    }

    /**
     * Archive conversation
     */
    public function archive(WhatsappConversation $conversation): bool
    {
        return $conversation->update(['is_archived' => true]);
    }

    /**
     * Unarchive conversation
     */
    public function unarchive(WhatsappConversation $conversation): bool
    {
        return $conversation->update(['is_archived' => false]);
    }

    /**
     * Update last message timestamp
     */
    public function touchLastMessage(WhatsappConversation $conversation): bool
    {
        return $conversation->update(['last_message_at' => now()]);
    }

    /**
     * Link contact to conversation
     */
    public function linkContact(WhatsappConversation $conversation, string $contactId): bool
    {
        return $conversation->update(['contact_id' => $contactId]);
    }

    /**
     * Bulk update conversations
     */
    public function bulkUpdate(array $conversationIds, array $data): int
    {
        return WhatsappConversation::whereIn('id', $conversationIds)->update($data);
    }

    /**
     * Bulk assign conversations
     */
    public function bulkAssign(array $conversationIds, string $userId): int
    {
        return WhatsappConversation::whereIn('id', $conversationIds)
            ->update(['assigned_user_id' => $userId]);
    }
}
