<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Scopes\TenantScope;

class WhatsappSession extends Model
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
        'tenant_id',
        'user_id',
        'phone_number',
        'session_name',
        'status',
        'qr_code',
        'connected_at',
        'last_activity_at',
    ];

    protected function casts(): array
    {
        return [
            'connected_at' => 'datetime',
            'last_activity_at' => 'datetime',
        ];
    }

    public function conversations()
    {
        return $this->hasMany(WhatsappConversation::class, 'session_id');
    }

    public function tenant()
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function quickReplies()
    {
        return $this->hasMany(WhatsappQuickReply::class, 'session_id');
    }

    public function assignmentQueues()
    {
        return $this->hasMany(WhatsappAssignmentQueue::class, 'session_id');
    }
}
