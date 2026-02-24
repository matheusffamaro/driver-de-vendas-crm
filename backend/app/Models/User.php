<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\Scopes\TenantScope;

class User extends Authenticatable
{
    use HasFactory, Notifiable, HasUuids;

    /**
     * The "booted" method of the model.
     */
    protected static function booted(): void
    {
        static::addGlobalScope(new TenantScope);
    }

    protected $fillable = [
        'name',
        'email',
        'password',
        'role_id', // New role system
        'avatar',
        'phone',
        'signature',
        'tenant_id', // Allow mass-assignment for registration
        'is_active', // Allow setting active status on creation
        // Note: is_super_admin, suspended_at, suspended_reason
        // are NOT mass-assignable for security reasons. Use explicit setters.
    ];

    /**
     * Fields that should never be mass-assigned for security.
     */
    protected $guarded = [
        'id',
        'is_super_admin',
        'suspended_at',
        'suspended_reason',
        'role', // Legacy field - will be removed
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'is_super_admin' => 'boolean',
            'suspended_at' => 'datetime',
        ];
    }

    /**
     * Check if user is a Super Admin (owner of Driver de Vendas).
     */
    public function isSuperAdmin(): bool
    {
        return $this->is_super_admin ?? false;
    }

    /**
     * Get the role associated with the user.
     */
    public function roleRelation(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'role_id');
    }

    /**
     * Get the user's role (supports both old and new systems).
     */
    public function getRole(): ?Role
    {
        // Try new role system first
        if ($this->role_id) {
            return $this->roleRelation;
        }
        
        // Fall back to legacy role field
        if ($this->role) {
            return Role::getBySlug($this->role);
        }
        
        return null;
    }

    /**
     * Check if user has a specific role.
     */
    public function hasRole(array|string $roles): bool
    {
        $currentRole = $this->getRole();
        
        if (!$currentRole) {
            return false;
        }
        
        $roles = is_array($roles) ? $roles : [$roles];
        
        return in_array($currentRole->slug, $roles);
    }

    /**
     * Check if user has a specific permission.
     */
    public function hasPermission(string $permission): bool
    {
        $role = $this->getRole();
        
        if (!$role) {
            return false;
        }
        
        return $role->hasPermission($permission);
    }

    /**
     * Check if user has any of the given permissions.
     */
    public function hasAnyPermission(array $permissions): bool
    {
        $role = $this->getRole();
        
        if (!$role) {
            return false;
        }
        
        return $role->hasAnyPermission($permissions);
    }

    /**
     * Check if user has all of the given permissions.
     */
    public function hasAllPermissions(array $permissions): bool
    {
        $role = $this->getRole();
        
        if (!$role) {
            return false;
        }
        
        return $role->hasAllPermissions($permissions);
    }

    /**
     * Check if user is admin.
     */
    public function isAdmin(): bool
    {
        return $this->hasRole('admin');
    }

    /**
     * Check if user is manager or higher.
     */
    public function isManager(): bool
    {
        return $this->hasRole(['admin', 'manager']);
    }

    /**
     * Check if user can manage another user.
     */
    public function canManageUser(User $user): bool
    {
        // Can't manage yourself
        if ($this->id === $user->id) {
            return false;
        }
        
        $myRole = $this->getRole();
        $theirRole = $user->getRole();
        
        if (!$myRole || !$theirRole) {
            return $this->isAdmin();
        }
        
        return $myRole->isHigherOrEqual($theirRole);
    }

    /**
     * Get all permissions for this user.
     */
    public function getAllPermissions(): array
    {
        $role = $this->getRole();
        
        if (!$role) {
            return [];
        }
        
        return $role->getAllPermissionKeys();
    }

    /**
     * Check if user is suspended.
     */
    public function isSuspended(): bool
    {
        return !$this->is_active || $this->suspended_at !== null;
    }

    /**
     * Suspend the user.
     */
    public function suspend(?string $reason = null): void
    {
        $this->update([
            'is_active' => false,
            'suspended_at' => now(),
            'suspended_reason' => $reason,
        ]);
    }

    /**
     * Activate the user.
     */
    public function activate(): void
    {
        $this->update([
            'is_active' => true,
            'suspended_at' => null,
            'suspended_reason' => null,
        ]);
    }

    // Relationships

    public function clients(): HasMany
    {
        return $this->hasMany(Client::class, 'created_by');
    }

    public function pipelineCards(): HasMany
    {
        return $this->hasMany(PipelineCard::class, 'assigned_to');
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(CrmTask::class, 'assigned_to');
    }

    public function invitationsSent(): HasMany
    {
        return $this->hasMany(UserInvitation::class, 'invited_by');
    }

    /**
     * Get the tenant that the user belongs to.
     */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function whatsappConversations(): HasMany
    {
        return $this->hasMany(WhatsappConversation::class, 'assigned_user_id');
    }
}
