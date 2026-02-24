<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Scopes\TenantScope;

class Product extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    /**
     * The "booted" method of the model.
     */
    protected static function booted(): void
    {
        static::addGlobalScope(new TenantScope);
    }

    protected $fillable = [
        'name',
        'type',
        'description',
        'sku',
        'price',
        'cost',
        'stock',
        'min_stock',
        'category_id',
        'unit',
        'is_active',
        'images',
        'attributes',
        'tenant_id',
    ];

    protected $appends = ['stock_quantity', 'track_stock'];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'cost' => 'decimal:2',
            'stock' => 'integer',
            'min_stock' => 'integer',
            'is_active' => 'boolean',
            'images' => 'array',
            'attributes' => 'array',
            'type' => 'string',
        ];
    }

    // Alias for stock (compatibility with frontend)
    public function getStockQuantityAttribute(): int
    {
        return $this->stock ?? 0;
    }

    // Track stock is always true for simplicity
    public function getTrackStockAttribute(): bool
    {
        return $this->min_stock > 0;
    }

    public function category()
    {
        return $this->belongsTo(ProductCategory::class, 'category_id');
    }

    public function pipelineCardProducts()
    {
        return $this->hasMany(PipelineCardProduct::class);
    }
}
