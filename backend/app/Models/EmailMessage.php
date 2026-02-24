<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class EmailMessage extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'email_thread_id',
        'email_account_id',
        'tenant_id',
        'message_id',
        'from_email',
        'from_name',
        'to',
        'cc',
        'bcc',
        'subject',
        'body_text',
        'body_html',
        'attachments',
        'is_draft',
        'is_sent',
        'is_read',
        'sent_at',
        'received_at',
        'sent_by_user_id',
        'tracking',
    ];

    protected function casts(): array
    {
        return [
            'to' => 'array',
            'cc' => 'array',
            'bcc' => 'array',
            'attachments' => 'array',
            'tracking' => 'array',
            'is_draft' => 'boolean',
            'is_sent' => 'boolean',
            'is_read' => 'boolean',
            'sent_at' => 'datetime',
            'received_at' => 'datetime',
        ];
    }

    public function thread(): BelongsTo
    {
        return $this->belongsTo(EmailThread::class, 'email_thread_id');
    }

    public function emailAccount(): BelongsTo
    {
        return $this->belongsTo(EmailAccount::class);
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function sentByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_by_user_id');
    }

    /**
     * Check if message has been tracked as opened
     */
    public function wasOpened(): bool
    {
        return isset($this->tracking['opened_at']) && $this->tracking['opened_at'] !== null;
    }

    /**
     * Check if message has tracked clicks
     */
    public function hasClicks(): bool
    {
        return isset($this->tracking['clicks_count']) && $this->tracking['clicks_count'] > 0;
    }

    /**
     * Get drafts
     */
    public function scopeDrafts($query)
    {
        return $query->where('is_draft', true);
    }

    /**
     * Get sent messages
     */
    public function scopeSent($query)
    {
        return $query->where('is_sent', true);
    }
}
