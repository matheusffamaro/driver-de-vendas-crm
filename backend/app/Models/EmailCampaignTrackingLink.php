<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmailCampaignTrackingLink extends Model
{
    use HasUuids;

    protected $fillable = [
        'email_campaign_recipient_id',
        'link_hash',
        'original_url',
    ];

    public function recipient(): BelongsTo
    {
        return $this->belongsTo(EmailCampaignRecipient::class, 'email_campaign_recipient_id');
    }
}
