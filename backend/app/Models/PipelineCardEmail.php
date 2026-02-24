<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class PipelineCardEmail extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'pipeline_card_id',
        'user_id',
        'to',
        'cc',
        'bcc',
        'subject',
        'body',
        'status',
        'attachments',
        'sent_at',
    ];

    protected function casts(): array
    {
        return [
            'attachments' => 'array',
            'sent_at' => 'datetime',
        ];
    }

    public function card()
    {
        return $this->belongsTo(PipelineCard::class, 'pipeline_card_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
