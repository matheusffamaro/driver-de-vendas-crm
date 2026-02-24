<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PricingTier extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'resource_type',
        'min_quantity',
        'max_quantity',
        'price_per_unit',
        'flat_price',
        'is_active',
    ];

    protected $casts = [
        'min_quantity' => 'integer',
        'max_quantity' => 'integer',
        'price_per_unit' => 'decimal:2',
        'flat_price' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    /**
     * Resource types.
     */
    public const TYPE_USERS = 'users';
    public const TYPE_CLIENTS = 'clients';
    public const TYPE_PRODUCTS = 'products';
    public const TYPE_TRANSACTIONS = 'transactions';

    /**
     * Scope to filter by resource type.
     */
    public function scopeOfType($query, string $type)
    {
        return $query->where('resource_type', $type);
    }

    /**
     * Scope to filter active tiers.
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Check if quantity falls within this tier.
     */
    public function containsQuantity(int $quantity): bool
    {
        if ($quantity < $this->min_quantity) {
            return false;
        }

        if ($this->max_quantity === -1) {
            return true;
        }

        return $quantity <= $this->max_quantity;
    }

    /**
     * Get the range label.
     */
    public function getRangeLabelAttribute(): string
    {
        if ($this->max_quantity === -1) {
            return "{$this->min_quantity}+";
        }

        return "{$this->min_quantity} - {$this->max_quantity}";
    }
}
