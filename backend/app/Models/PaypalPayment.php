<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaypalPayment extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'tenant_id',
        'subscription_id',
        'paypal_order_id',
        'paypal_subscription_id',
        'paypal_payer_id',
        'paypal_payer_email',
        'type',
        'status',
        'amount',
        'currency',
        'paypal_response',
        'paid_at',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'paypal_response' => 'array',
        'paid_at' => 'datetime',
    ];

    /**
     * Get the tenant.
     */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    /**
     * Get the subscription.
     */
    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class);
    }

    /**
     * Scope for completed payments.
     */
    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }

    /**
     * Scope for pending payments.
     */
    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    /**
     * Mark as completed.
     */
    public function markAsCompleted(array $paypalResponse = []): void
    {
        $this->update([
            'status' => 'completed',
            'paid_at' => now(),
            'paypal_response' => array_merge($this->paypal_response ?? [], $paypalResponse),
        ]);
    }

    /**
     * Mark as failed.
     */
    public function markAsFailed(array $paypalResponse = []): void
    {
        $this->update([
            'status' => 'failed',
            'paypal_response' => array_merge($this->paypal_response ?? [], $paypalResponse),
        ]);
    }
}
