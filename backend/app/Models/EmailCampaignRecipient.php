<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EmailCampaignRecipient extends Model
{
    use HasUuids;

    public const STATUS_PENDING = 'pending';
    public const STATUS_SENT = 'sent';
    public const STATUS_DELIVERED = 'delivered';
    public const STATUS_FAILED = 'failed';
    public const STATUS_OPENED = 'opened';
    public const STATUS_CLICKED = 'clicked';

    protected $fillable = [
        'email_campaign_id',
        'client_id',
        'email',
        'name',
        'status',
        'tracking_token',
        'sent_at',
        'opened_at',
        'clicked_at',
        'error_message',
    ];

    protected function casts(): array
    {
        return [
            'sent_at' => 'datetime',
            'opened_at' => 'datetime',
            'clicked_at' => 'datetime',
        ];
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(EmailCampaign::class, 'email_campaign_id');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function trackingLinks(): HasMany
    {
        return $this->hasMany(EmailCampaignTrackingLink::class, 'email_campaign_recipient_id');
    }
}
