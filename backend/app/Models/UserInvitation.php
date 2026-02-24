<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Scopes\TenantScope;

class UserInvitation extends Model
{
    use HasFactory, HasUuids;

    /**
     * The "booted" method of the model.
     */
    protected static function booted(): void
    {
        static::addGlobalScope(new TenantScope);
    }

    protected $fillable = [
        'tenant_id',
        'email',
        'name',
        'role', // Legacy field
        'role_id', // New role system
        'token',
        'invited_by',
        'expires_at',
        'accepted_at',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'accepted_at' => 'datetime',
        ];
    }

    /**
     * User who sent the invitation.
     */
    public function inviter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invited_by');
    }

    /**
     * Role for this invitation.
     */
    public function roleRelation(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'role_id');
    }

    /**
     * Tenant for this invitation.
     */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    /**
     * Get the role (supports both old and new systems).
     */
    public function getRole(): ?Role
    {
        if ($this->role_id) {
            return $this->roleRelation;
        }
        
        if ($this->role) {
            return Role::getBySlug($this->role);
        }
        
        return null;
    }

    public function isExpired(): bool
    {
        return $this->expires_at && $this->expires_at->isPast();
    }

    public function isAccepted(): bool
    {
        return $this->accepted_at !== null;
    }

    public function isPending(): bool
    {
        return !$this->isAccepted() && !$this->isExpired();
    }

    public function isValid(): bool
    {
        return $this->isPending();
    }

    /**
     * Accept the invitation.
     */
    public function accept(): void
    {
        $this->update(['accepted_at' => now()]);
    }

    /**
     * Find invitation by token.
     */
    public static function findByToken(string $token): ?self
    {
        return static::where('token', $token)->first();
    }

    /**
     * Scope pending invitations.
     */
    public function scopePending($query)
    {
        return $query->whereNull('accepted_at')
            ->where('expires_at', '>', now());
    }

    /**
     * Scope expired invitations.
     */
    public function scopeExpired($query)
    {
        return $query->whereNull('accepted_at')
            ->where('expires_at', '<=', now());
    }
}
