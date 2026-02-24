<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Scopes\TenantScope;

class CrmTask extends Model
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
        'card_id',
        'contact_id',
        'assigned_to',
        'created_by',
        'title',
        'description',
        'type',
        'status',
        'priority',
        'scheduled_at',
        'completed_at',
        'reminder_at',
        'duration_minutes',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_at' => 'datetime',
            'completed_at' => 'datetime',
            'reminder_at' => 'datetime',
            'duration_minutes' => 'integer',
        ];
    }

    public function card()
    {
        return $this->belongsTo(PipelineCard::class, 'card_id');
    }

    public function contact()
    {
        return $this->belongsTo(Client::class, 'contact_id');
    }

    public function assignedTo()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function attachments()
    {
        return $this->hasMany(CrmTaskAttachment::class, 'task_id');
    }

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function scopeForTenant($query, $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    public function isOwnedBy($tenantId): bool
    {
        return $this->tenant_id === $tenantId;
    }
}
