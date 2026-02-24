<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Scopes\TenantScope;

class Client extends Model
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
        'name',
        'tenant_id',
        'email',
        'phone',
        'document',
        'document_type',
        'address',
        'city',
        'state',
        'zip_code',
        'country',
        'notes',
        'created_by',
        'responsible_user_id', // Sales representative responsible for this client
        'tags',
        'custom_fields',
        'company_name',
        'status',
        'type',
    ];

    protected function casts(): array
    {
        return [
            'tags' => 'array',
            'custom_fields' => 'array',
        ];
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Sales representative responsible for this client
     */
    public function responsibleUser()
    {
        return $this->belongsTo(User::class, 'responsible_user_id');
    }

    public function pipelineCards()
    {
        return $this->hasMany(PipelineCard::class, 'contact_id');
    }

    public function tasks()
    {
        return $this->hasMany(CrmTask::class, 'contact_id');
    }

    /**
     * Scope to filter clients by responsible user (for sales role)
     */
    public function scopeForUser($query, User $user)
    {
        // Admin and Manager see all clients
        if ($user->isAdmin() || $user->isManager()) {
            return $query;
        }

        // Sales only see their own clients
        return $query->where('responsible_user_id', $user->id);
    }
}
