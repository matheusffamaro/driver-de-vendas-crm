<?php

namespace App\Models;

use App\Models\Scopes\TenantScope;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AiChatLog extends Model
{
    use HasFactory, HasUuids;

    protected static function booted(): void
    {
        static::addGlobalScope(new TenantScope);
    }

    protected $fillable = [
        'tenant_id',
        'agent_id',
        'whatsapp_conversation_id',
        'contact_phone',
        'contact_name',
        'user_message',
        'ai_response',
        'escalated_to_human',
        'escalation_reason',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'escalated_to_human' => 'boolean',
            'metadata' => 'array',
        ];
    }

    public function agent()
    {
        return $this->belongsTo(AiChatAgent::class, 'agent_id');
    }
}
