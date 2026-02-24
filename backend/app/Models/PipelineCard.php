<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class PipelineCard extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'pipeline_id',
        'stage_id',
        'contact_id',
        'assigned_to',
        'title',
        'description',
        'value',
        'position',
        'priority',
        'expected_close_date',
        'won_at',
        'lost_at',
        'lost_reason',
        'custom_fields',
        'metadata',
        'is_archived',
        'archived_at',
    ];

    protected function casts(): array
    {
        return [
            'value' => 'decimal:2',
            'position' => 'integer',
            'expected_close_date' => 'date',
            'won_at' => 'datetime',
            'lost_at' => 'datetime',
            'custom_fields' => 'array',
            'metadata' => 'array',
            'is_archived' => 'boolean',
            'archived_at' => 'datetime',
        ];
    }

    public function pipeline()
    {
        return $this->belongsTo(Pipeline::class);
    }

    public function stage()
    {
        return $this->belongsTo(PipelineStage::class, 'stage_id');
    }

    public function contact()
    {
        return $this->belongsTo(Client::class, 'contact_id');
    }

    public function assignedTo()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function products()
    {
        return $this->hasMany(PipelineCardProduct::class, 'card_id');
    }

    public function tasks()
    {
        return $this->hasMany(CrmTask::class, 'card_id');
    }

    public function history()
    {
        return $this->hasMany(PipelineCardHistory::class, 'card_id')->orderByDesc('created_at');
    }

    public function comments()
    {
        return $this->hasMany(PipelineCardComment::class, 'card_id')->orderByDesc('created_at');
    }

    public function attachments()
    {
        return $this->hasMany(PipelineCardAttachment::class, 'card_id')->orderByDesc('created_at');
    }

    public function archive(): void
    {
        $this->update([
            'is_archived' => true,
            'archived_at' => now(),
        ]);
    }

    public function unarchive(): void
    {
        $this->update([
            'is_archived' => false,
            'archived_at' => null,
        ]);
    }

    public function scopeArchived($query)
    {
        return $query->where('is_archived', true);
    }

    public function scopeNotArchived($query)
    {
        return $query->where('is_archived', false);
    }
}
