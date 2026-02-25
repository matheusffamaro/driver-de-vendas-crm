<?php

namespace App\Models;

use App\Models\Scopes\TenantScope;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AiKnowledgeDocument extends Model
{
    use HasFactory, HasUuids;

    protected static function booted(): void
    {
        static::addGlobalScope(new TenantScope);
    }

    protected $fillable = [
        'tenant_id',
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
