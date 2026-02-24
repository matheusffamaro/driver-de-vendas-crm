<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AiKnowledgeDocument extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'agent_id',
        'name',
        'file_path',
        'file_type',
        'file_size',
        'content',
        'embedding',
    ];

    public function agent()
    {
        return $this->belongsTo(AiChatAgent::class, 'agent_id');
    }
}
