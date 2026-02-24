<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class EmailAccount extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'user_id',
        'tenant_id',
        'email',
        'provider',
        'account_name',
        'access_token',
        'refresh_token',
        'token_expires_at',
        'imap_config',
        'smtp_config',
        'password',
        'is_active',
        'last_sync_at',
        'sync_status',
        'sync_error',
    ];

    protected $hidden = [
        'access_token',
        'refresh_token',
        'password',
    ];

    protected function casts(): array
    {
        return [
            'imap_config' => 'array',
            'smtp_config' => 'array',
            'token_expires_at' => 'datetime',
            'last_sync_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function threads(): HasMany
    {
        return $this->hasMany(EmailThread::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(EmailMessage::class);
    }

    /**
     * Check if token is expired
     */
    public function isTokenExpired(): bool
    {
        if (!$this->token_expires_at) {
            return false;
        }

        return now()->isAfter($this->token_expires_at);
    }

    /**
     * Check if this is an OAuth provider
     */
    public function isOAuthProvider(): bool
    {
        return in_array($this->provider, ['gmail', 'outlook']);
    }

    /**
     * Check if this is an IMAP provider
     */
    public function isImapProvider(): bool
    {
        return $this->provider === 'imap';
    }
}
