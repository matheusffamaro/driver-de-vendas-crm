<?php

namespace App\Services;

use App\Models\AiPlan;
use App\Models\AiTokenUsage;
use App\Models\AiTenantPlan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class TokenService
{
    private ?string $tenantId;
    private ?string $userId;
    private ?AiTenantPlan $tenantPlan = null;

    public function __construct(?string $tenantId = null, ?string $userId = null)
    {
        $this->tenantId = $tenantId;
        $this->userId = $userId;
    }

    /**
     * Set tenant context
     */
    public function forTenant(string $tenantId): self
    {
        $this->tenantId = $tenantId;
        $this->tenantPlan = null; // Reset cached plan
        return $this;
    }

    /**
     * Set user context
     */
    public function forUser(string $userId): self
    {
        $this->userId = $userId;
        return $this;
    }

    /**
     * Get tenant's plan
     */
    public function getTenantPlan(): AiTenantPlan
    {
        if (!$this->tenantId) {
            throw new \InvalidArgumentException('Tenant ID is required for token management');
        }
        
        if (!$this->tenantPlan) {
            $this->tenantPlan = AiTenantPlan::getOrCreateForTenant($this->tenantId);
            $this->tenantPlan->load('plan');
        }
        return $this->tenantPlan;
    }

    /**
     * Check if feature is allowed
     */
    public function canUseFeature(string $feature): array
    {
        $plan = $this->getTenantPlan()->plan;
        
        if (!$plan) {
            return ['allowed' => false, 'reason' => 'no_plan', 'message' => 'Nenhum plano configurado.'];
        }

        if (!$plan->isFeatureEnabled($feature)) {
            return [
                'allowed' => false,
                'reason' => 'feature_disabled',
                'message' => "Recurso '{$feature}' não disponível no plano {$plan->name}.",
                'upgrade_required' => true,
            ];
        }

        return ['allowed' => true];
    }

    /**
     * Check if can use tokens (combines feature + limit checks)
     */
    public function canUseTokens(string $feature, int $estimatedTokens = 500): array
    {
        // Check feature access
        $featureCheck = $this->canUseFeature($feature);
        if (!$featureCheck['allowed']) {
            return $featureCheck;
        }

        // Check token limits
        return $this->getTenantPlan()->canUseTokens($estimatedTokens);
    }

    /**
     * Record token usage after successful API call
     */
    public function recordUsage(
        string $feature,
        int $promptTokens,
        int $completionTokens,
        ?string $model = null,
        bool $cacheHit = false,
        ?int $responseTimeMs = null
    ): void {
        $totalTokens = $promptTokens + $completionTokens;

        // Record detailed usage
        AiTokenUsage::record(
            feature: $feature,
            promptTokens: $promptTokens,
            completionTokens: $completionTokens,
            model: $model,
            cacheHit: $cacheHit,
            responseTimeMs: $responseTimeMs,
            tenantId: $this->tenantId,
            userId: $this->userId
        );

        // Update tenant counters
        $this->getTenantPlan()->recordUsage($totalTokens);

        Log::info('Token usage recorded', [
            'tenant' => $this->tenantId,
            'feature' => $feature,
            'tokens' => $totalTokens,
            'cache_hit' => $cacheHit,
        ]);
    }

    /**
     * Get usage statistics for tenant
     */
    public function getUsageStats(): array
    {
        $tenantPlan = $this->getTenantPlan();
        $stats = $tenantPlan->getUsageStats();
        
        // Add feature breakdown
        $stats['by_feature'] = AiTokenUsage::getUsageByFeature($this->tenantId);
        
        // Add daily history (last 7 days)
        $stats['daily_history'] = AiTokenUsage::getDailyHistory($this->tenantId, 7);

        return $stats;
    }

    /**
     * Get all available plans
     */
    public static function getAvailablePlans(): array
    {
        return AiPlan::active()
            ->ordered()
            ->get()
            ->map(function ($plan) {
                return [
                    'id' => $plan->id,
                    'name' => $plan->name,
                    'slug' => $plan->slug,
                    'description' => $plan->description,
                    'price_monthly' => $plan->price_monthly,
                    'price_formatted' => $plan->formatted_price,
                    'monthly_tokens' => $plan->monthly_token_limit,
                    'daily_tokens' => $plan->daily_token_limit,
                    'features' => [
                        'chat' => $plan->ai_chat_enabled,
                        'autofill' => $plan->ai_autofill_enabled,
                        'summarize' => $plan->ai_summarize_enabled,
                        'lead_analysis' => $plan->ai_lead_analysis_enabled,
                        'email_draft' => $plan->ai_email_draft_enabled,
                        'knowledge_base' => $plan->knowledge_base_enabled,
                    ],
                    'is_featured' => $plan->is_featured,
                ];
            })
            ->toArray();
    }

    /**
     * Change tenant's plan
     */
    public function changePlan(string $planId): array
    {
        $newPlan = AiPlan::find($planId);
        
        if (!$newPlan || !$newPlan->is_active) {
            return ['success' => false, 'message' => 'Plano inválido ou inativo.'];
        }

        $tenantPlan = $this->getTenantPlan();
        $tenantPlan->plan_id = $planId;
        $tenantPlan->started_at = now();
        $tenantPlan->status = 'active';
        
        // Reset custom limits when changing plans
        $tenantPlan->custom_monthly_limit = null;
        $tenantPlan->custom_daily_limit = null;
        
        $tenantPlan->save();
        $tenantPlan->load('plan');

        return [
            'success' => true,
            'message' => "Plano alterado para {$newPlan->name}.",
            'plan' => $newPlan,
        ];
    }

    /**
     * Estimate tokens for a prompt (rough estimate)
     */
    public static function estimateTokens(string $text): int
    {
        // Rough estimate: ~4 characters per token for Portuguese
        return (int) ceil(strlen($text) / 4);
    }

    /**
     * Check rate limit per minute
     */
    public function checkRateLimit(): array
    {
        $plan = $this->getTenantPlan()->plan;
        $limit = $plan->request_limit_per_minute ?? 10;
        
        $cacheKey = "rate_limit:{$this->tenantId}";
        $count = Cache::get($cacheKey, 0);

        if ($count >= $limit) {
            return [
                'allowed' => false,
                'reason' => 'rate_limited',
                'message' => "Limite de {$limit} requisições/minuto atingido.",
                'retry_after' => 60,
            ];
        }

        return ['allowed' => true, 'remaining' => $limit - $count];
    }

    /**
     * Increment rate limit counter
     */
    public function incrementRateLimit(): void
    {
        $cacheKey = "rate_limit:{$this->tenantId}";
        $count = Cache::get($cacheKey, 0);
        Cache::put($cacheKey, $count + 1, 60);
    }
}
