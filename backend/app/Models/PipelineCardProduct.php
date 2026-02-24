<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PipelineCardProduct extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'card_id',
        'product_id',
        'quantity',
        'unit_price',
        'discount',
        'total',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'unit_price' => 'decimal:2',
            'discount' => 'decimal:2',
            'total' => 'decimal:2',
        ];
    }

    public function card()
    {
        return $this->belongsTo(PipelineCard::class, 'card_id');
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
