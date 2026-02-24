<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlanFeature extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'plan_id',
        'feature_key',
        'feature_name',
        'description',
        'value_type',
        'value',
        'sort_order',
        'is_active',
    ];

    protected $casts = [
        'sort_order' => 'integer',
        'is_active' => 'boolean',
    ];

    /**
     * Plan this feature belongs to.
     */
    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    /**
     * Check if feature is enabled.
     */
    public function isEnabled(): bool
    {
        if ($this->value_type === 'boolean') {
            return $this->value === 'true' || $this->value === '1';
        }

        return !empty($this->value);
    }

    /**
     * Get typed value.
     */
    public function getTypedValueAttribute()
    {
        return match($this->value_type) {
            'boolean' => $this->value === 'true' || $this->value === '1',
            'number' => (int) $this->value,
            default => $this->value,
        };
    }
}
