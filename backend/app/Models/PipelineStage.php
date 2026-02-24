<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PipelineStage extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'pipeline_id',
        'name',
        'color',
        'position',
        'is_won',
        'is_lost',
    ];

    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'is_won' => 'boolean',
            'is_lost' => 'boolean',
        ];
    }

    public function pipeline()
    {
        return $this->belongsTo(Pipeline::class);
    }

    public function cards()
    {
        return $this->hasMany(PipelineCard::class, 'stage_id')->orderBy('position');
    }
}
