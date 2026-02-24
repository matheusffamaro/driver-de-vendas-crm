<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class EmailThread extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'email_account_id',
        'tenant_id',
        'thread_id',
        'subject',
        'snippet',
        'participants',
        'linked_contact_id',
        'linked_pipeline_card_id',
        'is_read',
        'is_archived',
        'is_starred',
        'labels',
        'last_message_at',
    ];

    protected function casts(): array
    {
        return [
            'participants' => 'array',
            'labels' => 'array',
            'is_read' => 'boolean',
            'is_archived' => 'boolean',
            'is_starred' => 'boolean',
            'last_message_at' => 'datetime',
        ];
    }

    public function emailAccount(): BelongsTo
    {
        return $this->belongsTo(EmailAccount::class);
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(EmailMessage::class)->orderBy('sent_at', 'asc');
    }

    public function linkedContact(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'linked_contact_id');
    }

    public function linkedPipelineCard(): BelongsTo
    {
        return $this->belongsTo(PipelineCard::class, 'linked_pipeline_card_id');
    }

    /**
     * Get the latest message in the thread
     */
    public function latestMessage()
    {
        return $this->hasOne(EmailMessage::class)->latestOfMany('sent_at');
    }

    /**
     * Get unread count
     */
    public function scopeUnread($query)
    {
        return $query->where('is_read', false);
    }

    /**
     * Get starred threads
     */
    public function scopeStarred($query)
    {
        return $query->where('is_starred', true);
    }

    /**
     * Get archived threads
     */
    public function scopeArchived($query)
    {
        return $query->where('is_archived', true);
    }

    /**
     * Get inbox threads (not archived)
     */
    public function scopeInbox($query)
    {
        return $query->where('is_archived', false);
    }
}
