<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class WhatsappConversation extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'session_id',
        'remote_jid',
        'is_group',
        'group_name',
        'contact_phone',
        'contact_name',
        'profile_picture',
        'contact_id',
        'assigned_user_id',
        'is_pinned',
        'is_archived',
        'unread_count',
        'last_message_at',
    ];

    protected function casts(): array
    {
        return [
            'is_group' => 'boolean',
            'is_pinned' => 'boolean',
            'is_archived' => 'boolean',
            'unread_count' => 'integer',
            'last_message_at' => 'datetime',
        ];
    }

    public function session()
    {
        return $this->belongsTo(WhatsappSession::class, 'session_id');
    }

    public function contact()
    {
        return $this->belongsTo(Client::class, 'contact_id');
    }

    public function assignedUser()
    {
        return $this->belongsTo(User::class, 'assigned_user_id');
    }

    public function messages()
    {
        return $this->hasMany(WhatsappMessage::class, 'conversation_id');
    }

    public function lastMessage()
    {
        return $this->hasOne(WhatsappMessage::class, 'conversation_id')->latest('created_at');
    }
}
