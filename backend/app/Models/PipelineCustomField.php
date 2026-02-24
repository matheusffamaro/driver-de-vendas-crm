<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PipelineCustomField extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'pipeline_id',
        'name',
        'field_key',
        'type',
        'options',
        'is_required',
        'position',
    ];

    protected function casts(): array
    {
        return [
            'options' => 'array',
            'is_required' => 'boolean',
            'position' => 'integer',
        ];
    }

    public function pipeline()
    {
        return $this->belongsTo(Pipeline::class);
    }
}
