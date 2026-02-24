<?php

namespace App\Policies;

use App\Models\User;
use App\Models\WhatsappSession;

/**
 * Policy for WhatsApp Session authorization
 * 
 * Centralizes all authorization logic for WhatsApp sessions.
 */
class WhatsappSessionPolicy
{
    /**
     * Determine if user can view any sessions
     */
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('whatsapp.view');
    }

    /**
     * Determine if user can view a specific session
     */
    public function view(User $user, WhatsappSession $session): bool
    {
        // Must have permission
        if (!$user->hasPermission('whatsapp.view')) {
            return false;
        }

        // Must be same tenant
        if ($session->tenant_id !== $user->tenant_id) {
            return false;
        }

        // Admins and Managers can view all sessions in their tenant
        if ($user->isAdmin() || $user->isManager()) {
            return true;
        }

        // Sales users can only view their own sessions
        return $session->user_id === $user->id;
    }

    /**
     * Determine if user can create sessions
     */
    public function create(User $user): bool
    {
        return $user->hasPermission('whatsapp.create');
    }

    /**
     * Determine if user can create global sessions
     */
    public function createGlobal(User $user): bool
    {
        return ($user->isAdmin() || $user->isManager()) 
            && $user->hasPermission('whatsapp.create');
    }

    /**
     * Determine if user can update a session
     */
    public function update(User $user, WhatsappSession $session): bool
    {
        // Must have permission
        if (!$user->hasPermission('whatsapp.edit')) {
            return false;
        }

        // Must be same tenant
        if ($session->tenant_id !== $user->tenant_id) {
            return false;
        }

        // Admins and Managers can update all sessions
        if ($user->isAdmin() || $user->isManager()) {
            return true;
        }

        // Sales users can only update their own sessions
        return $session->user_id === $user->id;
    }

    /**
     * Determine if user can delete a session
     */
    public function delete(User $user, WhatsappSession $session): bool
    {
        // Must have permission
        if (!$user->hasPermission('whatsapp.delete')) {
            return false;
        }

        // Must be same tenant
        if ($session->tenant_id !== $user->tenant_id) {
            return false;
        }

        // Admins and Managers can delete all sessions
        if ($user->isAdmin() || $user->isManager()) {
            return true;
        }

        // Sales users can only delete their own sessions
        return $session->user_id === $user->id;
    }

    /**
     * Determine if user can reconnect a session
     */
    public function reconnect(User $user, WhatsappSession $session): bool
    {
        return $this->update($user, $session);
    }

    /**
     * Determine if user can clear session data
     */
    public function clearData(User $user, WhatsappSession $session): bool
    {
        // Only admins and managers can clear data
        return ($user->isAdmin() || $user->isManager())
            && $session->tenant_id === $user->tenant_id
            && $user->hasPermission('whatsapp.edit');
    }

    /**
     * Determine if user can access session conversations
     */
    public function accessConversations(User $user, WhatsappSession $session): bool
    {
        return $this->view($user, $session);
    }

    /**
     * Determine if user can send messages in this session
     */
    public function sendMessages(User $user, WhatsappSession $session): bool
    {
        // Must have permission
        if (!$user->hasPermission('whatsapp.send')) {
            return false;
        }

        // Must be same tenant
        if ($session->tenant_id !== $user->tenant_id) {
            return false;
        }

        // Admins and Managers can send in all sessions
        if ($user->isAdmin() || $user->isManager()) {
            return true;
        }

        // Sales users can only send in their own sessions
        return $session->user_id === $user->id;
    }
}
