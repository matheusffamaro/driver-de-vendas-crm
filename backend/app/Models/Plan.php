<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Plan extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'price_monthly',
        'price_yearly',
        'base_price_monthly',
        'base_price_yearly',
        'max_users',
        'max_clients',
        'max_transactions',
        'included_users',
        'included_clients',
        'included_products',
        'included_transactions',
        'has_dynamic_pricing',
        'trial_days',
        'sort_order',
        'features',
        'is_active',
        'paypal_plan_id_monthly',
        'paypal_plan_id_yearly',
    ];

    protected $casts = [
        'price_monthly' => 'decimal:2',
        'price_yearly' => 'decimal:2',
        'base_price_monthly' => 'decimal:2',
        'base_price_yearly' => 'decimal:2',
        'max_users' => 'integer',
        'max_clients' => 'integer',
        'max_transactions' => 'integer',
        'included_users' => 'integer',
        'included_clients' => 'integer',
        'included_products' => 'integer',
        'included_transactions' => 'integer',
        'has_dynamic_pricing' => 'boolean',
        'trial_days' => 'integer',
        'sort_order' => 'integer',
        'features' => 'array',
        'is_active' => 'boolean',
    ];

    /**
     * Default plans for the system.
     * 
     * ANÁLISE DE MERCADO CRM BRASIL 2026:
     * - RD Station CRM: R$79-299/mês
     * - Pipedrive: R$59-199/mês  
     * - HubSpot: R$0-399/mês
     * - Agendor: R$49-149/mês
     * - Ploomes: R$99-249/mês
     * 
     * DIFERENCIAL: Integração WhatsApp + IA incluídos em todos os planos
     * 
     * Estratégia: 3 planos principais (Essential, Business, Enterprise)
     */
    public const PLANS = [
        'essential' => [
            'name' => 'Essential',
            'slug' => 'essential',
            'description' => 'Para pequenos negócios que estão começando a crescer.',
            'price_monthly' => 49.90,
            'price_yearly' => 478.80, // 2 meses grátis
            'max_users' => 3,
            'max_clients' => 300,
            'max_transactions' => 1000,
            'included_users' => 3,
            'included_clients' => 300,
            'included_products' => 100,
            'included_transactions' => 1000,
            'trial_days' => 7,
            'features' => [
                'dashboard_basic' => true,
                'dashboard_advanced' => true,
                'pipeline_kanban' => true,
                'pipeline_reports' => true,
                'export_csv' => true,
                'export_pdf' => true,
                'api_access' => false,
                'custom_reports' => false,
                'priority_support' => false,
                'white_label' => false,
                'multi_currency' => false,
                'whatsapp_integration' => true,
                'whatsapp_sessions' => 2,
                'ai_agent' => true,
                'ai_tokens_month' => 50000,
                'ai_learning' => true,
                'ai_custom_training' => false,
            ],
            'is_active' => true,
        ],
        'business' => [
            'name' => 'Business',
            'slug' => 'business',
            'description' => 'Para empresas em crescimento acelerado com múltiplas equipes.',
            'price_monthly' => 199.90,
            'price_yearly' => 1918.80, // 2 meses grátis
            'max_users' => 30,
            'max_clients' => 10000,
            'max_transactions' => 20000,
            'included_users' => 30,
            'included_clients' => 10000,
            'included_products' => 2000,
            'included_transactions' => 20000,
            'trial_days' => 7,
            'features' => [
                'dashboard_basic' => true,
                'dashboard_advanced' => true,
                'pipeline_kanban' => true,
                'pipeline_reports' => true,
                'export_csv' => true,
                'export_pdf' => true,
                'api_access' => true,
                'custom_reports' => true,
                'priority_support' => true,
                'white_label' => false,
                'multi_currency' => true,
                'whatsapp_integration' => true,
                'whatsapp_sessions' => 15,
                'ai_agent' => true,
                'ai_tokens_month' => 500000,
                'ai_learning' => true,
                'ai_custom_training' => true,
                'ai_knowledge_base' => true,
                'ai_analytics' => true,
            ],
            'is_active' => true,
        ],
        'enterprise' => [
            'name' => 'Enterprise',
            'slug' => 'enterprise',
            'description' => 'Solução completa para grandes operações. Recursos ilimitados + suporte dedicado.',
            'price_monthly' => 399.90,
            'price_yearly' => 3838.80, // 2 meses grátis
            'max_users' => -1,
            'max_clients' => -1,
            'max_transactions' => -1,
            'included_users' => -1,
            'included_clients' => -1,
            'included_products' => -1,
            'included_transactions' => -1,
            'trial_days' => 14,
            'features' => [
                'dashboard_basic' => true,
                'dashboard_advanced' => true,
                'pipeline_kanban' => true,
                'pipeline_reports' => true,
                'export_csv' => true,
                'export_pdf' => true,
                'api_access' => true,
                'custom_reports' => true,
                'priority_support' => true,
                'white_label' => true,
                'multi_currency' => true,
                'whatsapp_integration' => true,
                'whatsapp_sessions' => -1, // Ilimitado
                'ai_agent' => true,
                'ai_tokens_month' => -1, // Ilimitado
                'ai_learning' => true,
                'ai_custom_training' => true,
                'ai_knowledge_base' => true,
                'ai_analytics' => true,
                'dedicated_support' => true,
                'sla_guarantee' => true,
                'custom_integrations' => true,
            ],
            'is_active' => true,
        ],
    ];

    /**
     * Subscriptions for this plan.
     */
    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    /**
     * Plan features (detailed feature records).
     */
    public function planFeatures(): HasMany
    {
        return $this->hasMany(PlanFeature::class)->orderBy('sort_order');
    }

    /**
     * Get plan by slug.
     */
    public static function getBySlug(string $slug): ?self
    {
        return static::where('slug', $slug)->first();
    }

    /**
     * Get free plan.
     */
    public static function free(): ?self
    {
        return static::getBySlug('free');
    }

    /**
     * Check if plan has a feature.
     */
    public function hasFeature(string $feature): bool
    {
        return $this->features[$feature] ?? false;
    }

    /**
     * Check if limit is unlimited.
     */
    public function isUnlimited(string $resource): bool
    {
        $limit = match($resource) {
            'users' => $this->max_users,
            'clients' => $this->max_clients,
            'transactions' => $this->max_transactions,
            default => 0,
        };
        
        return $limit === -1;
    }

    /**
     * Get yearly discount percentage.
     */
    public function getYearlyDiscountAttribute(): float
    {
        if ($this->price_monthly == 0) {
            return 0;
        }
        
        $yearlyFromMonthly = $this->price_monthly * 12;
        
        return round((($yearlyFromMonthly - $this->price_yearly) / $yearlyFromMonthly) * 100, 1);
    }

    /**
     * Scope to filter active plans.
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
