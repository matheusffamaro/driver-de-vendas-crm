<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PipelineCardHistory extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'card_id',
        'user_id',
        'action',
        'from_stage_id',
        'to_stage_id',
        'changes',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'changes' => 'array',
        ];
    }

    public function card()
    {
        return $this->belongsTo(PipelineCard::class, 'card_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function fromStage()
    {
        return $this->belongsTo(PipelineStage::class, 'from_stage_id');
    }

    public function toStage()
    {
        return $this->belongsTo(PipelineStage::class, 'to_stage_id');
    }
}
