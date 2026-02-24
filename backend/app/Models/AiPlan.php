<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class AiPlan extends Model
{
    use HasUuids;

    protected $table = 'ai_plans';

    protected $fillable = [
        'name',
        'slug',
        'description',
        'monthly_token_limit',
        'daily_token_limit',
        'request_limit_per_minute',
        'ai_chat_enabled',
        'ai_autofill_enabled',
        'ai_summarize_enabled',
        'ai_lead_analysis_enabled',
        'ai_email_draft_enabled',
        'knowledge_base_enabled',
        'knowledge_base_docs_limit',
        'price_monthly',
        'price_yearly',
        'currency',
        'sort_order',
        'is_active',
        'is_featured',
    ];

    protected $casts = [
        'monthly_token_limit' => 'integer',
        'daily_token_limit' => 'integer',
        'request_limit_per_minute' => 'integer',
        'ai_chat_enabled' => 'boolean',
        'ai_autofill_enabled' => 'boolean',
        'ai_summarize_enabled' => 'boolean',
        'ai_lead_analysis_enabled' => 'boolean',
        'ai_email_draft_enabled' => 'boolean',
        'knowledge_base_enabled' => 'boolean',
        'knowledge_base_docs_limit' => 'integer',
        'price_monthly' => 'decimal:2',
        'price_yearly' => 'decimal:2',
        'is_active' => 'boolean',
        'is_featured' => 'boolean',
    ];

    public function tenantPlans()
    {
        return $this->hasMany(AiTenantPlan::class, 'plan_id');
    }

    /**
     * Check if a feature is enabled
     */
    public function isFeatureEnabled(string $feature): bool
    {
        $featureMap = [
            'chat' => 'ai_chat_enabled',
            'autofill' => 'ai_autofill_enabled',
            'summarize' => 'ai_summarize_enabled',
            'lead_analysis' => 'ai_lead_analysis_enabled',
            'email_draft' => 'ai_email_draft_enabled',
            'knowledge_base' => 'knowledge_base_enabled',
        ];

        $column = $featureMap[$feature] ?? null;
        return $column ? (bool) $this->$column : false;
    }

    /**
     * Get formatted price
     */
    public function getFormattedPriceAttribute(): string
    {
        if ($this->price_monthly == 0) {
            return 'Grátis';
        }
        return 'R$ ' . number_format($this->price_monthly, 2, ',', '.');
    }

    /**
     * Scope for active plans
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope ordered by sort_order
     */
    public function scopeOrdered($query)
    {
        return $query->orderBy('sort_order')->orderBy('price_monthly');
    }
}
