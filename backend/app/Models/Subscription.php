<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Subscription extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'tenant_id',
        'plan_id',
        'status',
        'trial_ends_at',
        'starts_at',
        'ends_at',
        'cancelled_at',
        'payment_method',
        'billing_cycle',
        'paypal_subscription_id',
        'current_users',
        'current_clients',
        'current_products',
        'current_transactions',
        'calculated_price',
        'metadata',
    ];

    protected $casts = [
        'trial_ends_at' => 'datetime',
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'cancelled_at' => 'datetime',
        'current_users' => 'integer',
        'current_clients' => 'integer',
        'current_products' => 'integer',
        'current_transactions' => 'integer',
        'calculated_price' => 'decimal:2',
        'metadata' => 'array',
    ];

    /**
     * Subscription statuses.
     */
    public const STATUS_ACTIVE = 'active';
    public const STATUS_TRIAL = 'trial';
    public const STATUS_CANCELLED = 'cancelled';
    public const STATUS_EXPIRED = 'expired';
    public const STATUS_SUSPENDED = 'suspended';

    /**
     * Tenant this subscription belongs to.
     */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    /**
     * Plan of this subscription.
     */
    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    /**
     * Check if subscription is active.
     */
    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE || $this->status === self::STATUS_TRIAL;
    }

    /**
     * Check if subscription is on trial.
     */
    public function onTrial(): bool
    {
        return $this->status === self::STATUS_TRIAL && 
               $this->trial_ends_at && 
               $this->trial_ends_at->isFuture();
    }

    /**
     * Check if subscription is cancelled.
     */
    public function isCancelled(): bool
    {
        return $this->status === self::STATUS_CANCELLED;
    }

    /**
     * Check if subscription is expired.
     */
    public function isExpired(): bool
    {
        if ($this->status === self::STATUS_EXPIRED) {
            return true;
        }
        
        return $this->ends_at && $this->ends_at->isPast();
    }

    /**
     * Check if trial has expired.
     */
    public function trialExpired(): bool
    {
        if ($this->status === self::STATUS_TRIAL) {
            return $this->trial_ends_at && $this->trial_ends_at->isPast();
        }
        
        return false;
    }

    /**
     * Check if subscription has access (active or on valid trial).
     */
    public function hasAccess(): bool
    {
        if ($this->status === self::STATUS_ACTIVE) {
            return !$this->isExpired();
        }
        
        if ($this->status === self::STATUS_TRIAL) {
            return !$this->trialExpired();
        }
        
        return false;
    }

    /**
     * Days remaining in trial.
     */
    public function trialDaysRemaining(): int
    {
        if (!$this->onTrial()) {
            return 0;
        }
        
        return (int) now()->diffInDays($this->trial_ends_at, false);
    }

    /**
     * Days remaining in subscription.
     */
    public function daysRemaining(): int
    {
        if (!$this->ends_at || $this->ends_at->isPast()) {
            return 0;
        }
        
        return (int) now()->diffInDays($this->ends_at, false);
    }

    /**
     * Cancel subscription.
     */
    public function cancel(): void
    {
        $this->update([
            'status' => self::STATUS_CANCELLED,
            'cancelled_at' => now(),
        ]);
    }

    /**
     * Resume cancelled subscription.
     */
    public function resume(): void
    {
        if ($this->ends_at && $this->ends_at->isFuture()) {
            $this->update([
                'status' => self::STATUS_ACTIVE,
                'cancelled_at' => null,
            ]);
        }
    }

    /**
     * Scope to filter active subscriptions.
     */
    public function scopeActive($query)
    {
        return $query->whereIn('status', [self::STATUS_ACTIVE, self::STATUS_TRIAL]);
    }

    /**
     * Scope to filter by status.
     */
    public function scopeOfStatus($query, string $status)
    {
        return $query->where('status', $status);
    }
}
