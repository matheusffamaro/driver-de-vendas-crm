<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\Scopes\TenantScope;

class EmailCampaign extends Model
{
    use HasUuids;

    public const STATUS_DRAFT = 'draft';
    public const STATUS_SCHEDULED = 'scheduled';
    public const STATUS_SENDING = 'sending';
    public const STATUS_SENT = 'sent';

    protected static function booted(): void
    {
        static::addGlobalScope(new TenantScope);
    }

    protected $fillable = [
        'tenant_id',
        'name',
        'email_template_id',
        'subject',
        'body_html',
        'email_account_id',
        'status',
        'scheduled_at',
        'sent_at',
        'created_by',
        'recipients_count',
        'delivered_count',
        'opened_count',
        'clicked_count',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_at' => 'datetime',
            'sent_at' => 'datetime',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(EmailTemplate::class, 'email_template_id');
    }

    public function emailAccount(): BelongsTo
    {
        return $this->belongsTo(EmailAccount::class);
    }

    public function createdByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function recipients(): HasMany
    {
        return $this->hasMany(EmailCampaignRecipient::class, 'email_campaign_id');
    }

    public function getOpenRateAttribute(): ?float
    {
        if ($this->delivered_count <= 0) {
            return null;
        }
        return round((float) $this->opened_count / $this->delivered_count * 100, 2);
    }

    public function getClickRateAttribute(): ?float
    {
        if ($this->delivered_count <= 0) {
            return null;
        }
        return round((float) $this->clicked_count / $this->delivered_count * 100, 2);
    }
}
