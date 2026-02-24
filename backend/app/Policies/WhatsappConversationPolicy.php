<?php

namespace App\Policies;

use App\Models\User;
use App\Models\WhatsappConversation;

/**
 * Policy for WhatsApp Conversation authorization
 */
class WhatsappConversationPolicy
{
    /**
     * Determine if user can view any conversations
     */
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('whatsapp.view');
    }

    /**
     * Determine if user can view a specific conversation
     */
    public function view(User $user, WhatsappConversation $conversation): bool
    {
        // Must have permission
        if (!$user->hasPermission('whatsapp.view')) {
            return false;
        }

        // Must be same tenant
        if ($conversation->session?->tenant_id !== $user->tenant_id) {
            return false;
        }

        // Admins and Managers can view all conversations
        if ($user->isAdmin() || $user->isManager()) {
            return true;
        }

        // Sales users can only view conversations from their own sessions
        if ($conversation->session?->user_id !== $user->id) {
            return false;
        }

        // And only if assigned to them
        return $conversation->assigned_user_id === $user->id;
    }

    /**
     * Determine if user can update a conversation
     */
    public function update(User $user, WhatsappConversation $conversation): bool
    {
        // Must have permission
        if (!$user->hasPermission('whatsapp.edit')) {
            return false;
        }

        // Must be same tenant
        if ($conversation->session?->tenant_id !== $user->tenant_id) {
            return false;
        }

        // Admins and Managers can update all conversations
        if ($user->isAdmin() || $user->isManager()) {
            return true;
        }

        // Sales users can only update conversations from their own sessions and assigned to them
        return $conversation->session?->user_id === $user->id
            && $conversation->assigned_user_id === $user->id;
    }

    /**
     * Determine if user can delete a conversation
     */
    public function delete(User $user, WhatsappConversation $conversation): bool
    {
        // Only admins and managers can delete conversations
        return ($user->isAdmin() || $user->isManager())
            && $conversation->session?->tenant_id === $user->tenant_id
            && $user->hasPermission('whatsapp.delete');
    }

    /**
     * Determine if user can assign a conversation
     */
    public function assign(User $user, WhatsappConversation $conversation): bool
    {
        // Must be same tenant
        if ($conversation->session?->tenant_id !== $user->tenant_id) {
            return false;
        }

        // Admins and Managers can assign any conversation
        if ($user->isAdmin() || $user->isManager()) {
            return true;
        }

        // Sales users can only self-assign unassigned conversations from global sessions
        return $conversation->session?->user_id === null
            && $conversation->assigned_user_id === null;
    }

    /**
     * Determine if user can send messages in this conversation
     */
    public function sendMessage(User $user, WhatsappConversation $conversation): bool
    {
        // Must have permission
        if (!$user->hasPermission('whatsapp.send')) {
            return false;
        }

        // Must be same tenant
        if ($conversation->session?->tenant_id !== $user->tenant_id) {
            return false;
        }

        // Admins and Managers can send in all conversations
        if ($user->isAdmin() || $user->isManager()) {
            return true;
        }

        // Sales users: session must be theirs
        if ($conversation->session?->user_id !== $user->id) {
            return false;
        }

        // And conversation must be assigned to them
        return $conversation->assigned_user_id === $user->id;
    }

    /**
     * Determine if user can archive a conversation
     */
    public function archive(User $user, WhatsappConversation $conversation): bool
    {
        return $this->update($user, $conversation);
    }

    /**
     * Determine if user can pin a conversation
     */
    public function pin(User $user, WhatsappConversation $conversation): bool
    {
        return $this->update($user, $conversation);
    }

    /**
     * Determine if user can link a contact to conversation
     */
    public function linkContact(User $user, WhatsappConversation $conversation): bool
    {
        return $this->update($user, $conversation);
    }
}
