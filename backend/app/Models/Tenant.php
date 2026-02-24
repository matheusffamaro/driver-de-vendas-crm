<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Tenant extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'name',
        'slug',
        'document',
        'email',
        'phone',
        'logo_url',
        'address',
        'settings',
        // Note: is_active is NOT mass-assignable for security (only super admins can change)
    ];

    /**
     * Fields that should never be mass-assigned for security.
     */
    protected $guarded = [
        'id',
        'is_active', // Only super admins can activate/deactivate tenants
    ];

    protected $casts = [
        'address' => 'array',
        'settings' => 'array',
        'is_active' => 'boolean',
    ];

    protected $hidden = [
        'created_at',
        'updated_at',
    ];

    /**
     * Default settings for new tenants.
     */
    public static function defaultSettings(): array
    {
        return [
            'timezone' => 'America/Sao_Paulo',
            'locale' => 'pt-BR',
            'currency' => 'BRL',
            'date_format' => 'DD/MM/YYYY',
            'fiscal_year_start' => '01-01',
            'notifications' => [
                'email' => true,
                'push' => false,
            ],
            'features' => [
                'dark_mode' => true,
                'export_csv' => true,
            ],
        ];
    }

    /**
     * Users that belong to this tenant.
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /**
     * Clients of this tenant.
     */
    public function clients(): HasMany
    {
        return $this->hasMany(Client::class);
    }

    /**
     * Products of this tenant.
     */
    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    /**
     * Pipeline cards of this tenant.
     */
    public function pipelineCards(): HasMany
    {
        return $this->hasMany(PipelineCard::class);
    }

    /**
     * Pipelines of this tenant.
     */
    public function pipelines(): HasMany
    {
        return $this->hasMany(Pipeline::class);
    }

    /**
     * Active subscription (includes active and trial status).
     */
    public function subscription(): HasOne
    {
        return $this->hasOne(Subscription::class)->whereIn('status', ['active', 'trial']);
    }

    /**
     * All subscriptions.
     */
    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    /**
     * PayPal payments of this tenant.
     */
    public function payments(): HasMany
    {
        return $this->hasMany(PaypalPayment::class);
    }

    /**
     * User invitations.
     */
    public function invitations(): HasMany
    {
        return $this->hasMany(UserInvitation::class);
    }

    /**
     * Get the current plan.
     */
    public function getPlanAttribute(): ?Plan
    {
        return $this->subscription?->plan;
    }

    /**
     * Check if tenant has a specific feature.
     */
    public function hasFeature(string $feature): bool
    {
        $plan = $this->plan;
        
        if (!$plan) {
            return false;
        }
        
        return $plan->features[$feature] ?? false;
    }

    /**
     * Get limit for a resource.
     */
    public function getLimit(string $resource): int
    {
        $plan = $this->plan;
        
        // Default limits for Free plan if no plan is set
        $defaultLimits = [
            'users' => 3,
            'clients' => 100,
            'products' => 50,
            'transactions' => 500,
        ];
        
        if (!$plan) {
            return $defaultLimits[$resource] ?? 0;
        }
        
        return match($resource) {
            'users' => $plan->max_users ?? $plan->included_users ?? $defaultLimits['users'],
            'clients' => $plan->max_clients ?? $plan->included_clients ?? $defaultLimits['clients'],
            'products' => $plan->included_products ?? $defaultLimits['products'],
            'transactions' => $plan->max_transactions ?? $plan->included_transactions ?? $defaultLimits['transactions'],
            default => 0,
        };
    }

    /**
     * Get current usage for a resource.
     */
    public function getCurrentUsage(string $resource): int
    {
        return match($resource) {
            'users' => $this->users()->count(),
            'clients' => $this->clients()->count(),
            'products' => $this->products()->count(),
            'transactions' => $this->pipelineCards()->whereMonth('created_at', now()->month)->count(),
            default => 0,
        };
    }

    /**
     * Check if tenant can add more of a resource.
     */
    public function canAdd(string $resource): bool
    {
        $limit = $this->getLimit($resource);
        
        if ($limit === -1) { // Unlimited
            return true;
        }
        
        $current = $this->getCurrentUsage($resource);
        
        return $current < $limit;
    }

    /**
     * Check limit and return detailed info.
     */
    public function checkLimit(string $resource): array
    {
        $limit = $this->getLimit($resource);
        $current = $this->getCurrentUsage($resource);
        $canAdd = $limit === -1 || $current < $limit;
        
        return [
            'resource' => $resource,
            'current' => $current,
            'limit' => $limit === -1 ? 'unlimited' : $limit,
            'can_add' => $canAdd,
            'remaining' => $limit === -1 ? 'unlimited' : max(0, $limit - $current),
            'percentage' => $limit === -1 ? 0 : ($limit > 0 ? round(($current / $limit) * 100, 1) : 100),
        ];
    }

    /**
     * Get usage stats.
     */
    public function getUsageStats(): array
    {
        return [
            'users' => $this->checkLimit('users'),
            'clients' => $this->checkLimit('clients'),
            'products' => $this->checkLimit('products'),
            'transactions' => $this->checkLimit('transactions'),
        ];
    }

    /**
     * Check if a specific feature is available in the plan.
     */
    public function canUseFeature(string $featureKey): bool
    {
        $plan = $this->plan;
        
        if (!$plan) {
            return false;
        }

        // Check in JSON features first
        if (isset($plan->features[$featureKey])) {
            return (bool) $plan->features[$featureKey];
        }

        // Check in plan_features table
        $feature = $plan->planFeatures()->where('feature_key', $featureKey)->first();
        
        return $feature ? $feature->value === 'true' : false;
    }

    /**
     * Get resource label in Portuguese.
     */
    public static function getResourceLabel(string $resource): string
    {
        return match($resource) {
            'users' => 'usuários',
            'clients' => 'clientes',
            'products' => 'produtos',
            'transactions' => 'transações',
            default => $resource,
        };
    }

    /**
     * Check if tenant can add a new pipeline.
     */
    public function canAddPipeline(): array
    {
        if (!$this->pipelines_addon_enabled) {
            $currentCount = $this->pipelines()->count();
            if ($currentCount >= 1) {
                return [
                    'allowed' => false,
                    'message' => 'Pipeline add-on is not enabled. You have 1 free pipeline. Activate the add-on to create more pipelines.'
                ];
            }
        }
        
        // No limit if addon is enabled
        return ['allowed' => true];
    }

    /**
     * Get pipelines limit for this tenant.
     */
    public function getPipelinesLimit(): int
    {
        return $this->pipelines_addon_enabled ? -1 : 1; // -1 = unlimited
    }

    /**
     * Update cached pipelines count.
     */
    public function updatePipelinesCount(): void
    {
        $this->pipelines_count = $this->pipelines()->count();
        $this->save();
    }
}
