<?php

namespace App\Repositories\Whatsapp;

use App\Models\WhatsappSession;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Repository for WhatsApp Session data access
 * 
 * Centralizes all database queries related to WhatsApp sessions,
 * providing a clean abstraction layer between services and models.
 */
class WhatsappSessionRepository
{
    /**
     * Find session by ID
     */
    public function findById(string $sessionId): ?WhatsappSession
    {
        return WhatsappSession::find($sessionId);
    }

    /**
     * Find session by ID including soft deleted
     */
    public function findByIdWithTrashed(string $sessionId): ?WhatsappSession
    {
        return WhatsappSession::withTrashed()->find($sessionId);
    }

    /**
     * Find session by phone number and tenant
     */
    public function findByPhoneNumber(string $phoneNumber, string $tenantId): ?WhatsappSession
    {
        return WhatsappSession::where('phone_number', $phoneNumber)
            ->where('tenant_id', $tenantId)
            ->first();
    }

    /**
     * Find session by phone number and tenant (including trashed)
     */
    public function findByPhoneNumberWithTrashed(string $phoneNumber, string $tenantId): ?WhatsappSession
    {
        return WhatsappSession::withTrashed()
            ->where('phone_number', $phoneNumber)
            ->where('tenant_id', $tenantId)
            ->first();
    }

    /**
     * Get all active sessions for a user
     */
    public function getActiveForUser(User $user): Collection
    {
        return WhatsappSession::where('user_id', $user->id)
            ->where('tenant_id', $user->tenant_id)
            ->whereIn('status', ['connected', 'connecting', 'qr_code'])
            ->orderByDesc('connected_at')
            ->get();
    }

    /**
     * Get all sessions for a tenant
     */
    public function getAllForTenant(string $tenantId): Collection
    {
        return WhatsappSession::where('tenant_id', $tenantId)
            ->orderByDesc('connected_at')
            ->get();
    }

    /**
     * Get connected sessions for a tenant
     */
    public function getConnectedForTenant(string $tenantId): Collection
    {
        return WhatsappSession::where('tenant_id', $tenantId)
            ->where('status', 'connected')
            ->orderByDesc('connected_at')
            ->get();
    }

    /**
     * Count active sessions for a user
     */
    public function countActiveForUser(User $user): int
    {
        return WhatsappSession::where('user_id', $user->id)
            ->where('tenant_id', $user->tenant_id)
            ->whereIn('status', ['connected', 'connecting', 'qr_code'])
            ->count();
    }

    /**
     * Get sessions by status
     */
    public function getByStatus(string $status, ?string $tenantId = null): Collection
    {
        $query = WhatsappSession::where('status', $status);

        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        return $query->orderByDesc('updated_at')->get();
    }

    /**
     * Get stale sessions (not active for X hours)
     */
    public function getStale Sessions(int $hours = 24): Collection
    {
        return WhatsappSession::where('status', 'connected')
            ->where('last_activity_at', '<', now()->subHours($hours))
            ->get();
    }

    /**
     * Create a new session
     */
    public function create(array $data): WhatsappSession
    {
        return WhatsappSession::create($data);
    }

    /**
     * Update a session
     */
    public function update(WhatsappSession $session, array $data): bool
    {
        return $session->update($data);
    }

    /**
     * Delete a session (soft delete)
     */
    public function delete(WhatsappSession $session): bool
    {
        return $session->delete();
    }

    /**
     * Force delete a session
     */
    public function forceDelete(WhatsappSession $session): bool
    {
        return $session->forceDelete();
    }

    /**
     * Restore a soft deleted session
     */
    public function restore(WhatsappSession $session): bool
    {
        return $session->restore();
    }

    /**
     * Update session status
     */
    public function updateStatus(WhatsappSession $session, string $status): bool
    {
        return $session->update(['status' => $status]);
    }

    /**
     * Mark session as connected
     */
    public function markAsConnected(WhatsappSession $session, ?string $phoneNumber = null): bool
    {
        return $session->update([
            'status' => 'connected',
            'phone_number' => $phoneNumber ?? $session->phone_number,
            'qr_code' => null,
            'connected_at' => now(),
            'last_activity_at' => now(),
        ]);
    }

    /**
     * Mark session as disconnected
     */
    public function markAsDisconnected(WhatsappSession $session): bool
    {
        return $session->update([
            'status' => 'disconnected',
            'qr_code' => null,
        ]);
    }

    /**
     * Update QR code
     */
    public function updateQRCode(WhatsappSession $session, ?string $qrCode): bool
    {
        return $session->update([
            'status' => 'qr_code',
            'qr_code' => $qrCode,
        ]);
    }

    /**
     * Update last activity timestamp
     */
    public function touchActivity(WhatsappSession $session): bool
    {
        return $session->update(['last_activity_at' => now()]);
    }
}
