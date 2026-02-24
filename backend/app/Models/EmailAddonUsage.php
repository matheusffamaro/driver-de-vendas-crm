<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmailAddonUsage extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'email_addon_usage';

    protected $fillable = [
        'tenant_id',
        'year',
        'month',
        'emails_sent',
        'emails_received',
        'total_emails',
        'calculated_cost',
    ];

    protected function casts(): array
    {
        return [
            'year' => 'integer',
            'month' => 'integer',
            'emails_sent' => 'integer',
            'emails_received' => 'integer',
            'total_emails' => 'integer',
            'calculated_cost' => 'decimal:2',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    /**
     * Get or create usage record for current month
     */
    public static function getCurrentMonthUsage($tenantId)
    {
        return static::firstOrCreate([
            'tenant_id' => $tenantId,
            'year' => now()->year,
            'month' => now()->month,
        ]);
    }

    /**
     * Increment sent emails count
     */
    public function incrementSent(int $count = 1): void
    {
        $this->increment('emails_sent', $count);
        $this->increment('total_emails', $count);
    }

    /**
     * Increment received emails count
     */
    public function incrementReceived(int $count = 1): void
    {
        $this->increment('emails_received', $count);
        $this->increment('total_emails', $count);
    }

    /**
     * Calculate cost based on total emails
     */
    public function calculateCost(): float
    {
        $total = $this->total_emails;

        if ($total <= 1000) {
            return 39.90;
        } elseif ($total <= 5000) {
            return 79.90;
        } elseif ($total <= 15000) {
            return 149.90;
        } else {
            return 249.90;
        }
    }

    /**
     * Update calculated cost
     */
    public function updateCalculatedCost(): void
    {
        $this->update(['calculated_cost' => $this->calculateCost()]);
    }
}
