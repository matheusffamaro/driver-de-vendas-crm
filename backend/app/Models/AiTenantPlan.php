<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Support\Str;

class AiTenantPlan extends Model
{
    use HasUuids;

    protected $table = 'ai_tenant_plans';

    protected $fillable = [
        'tenant_id',
        'plan_id',
        'started_at',
        'expires_at',
        'status',
        'custom_monthly_limit',
        'custom_daily_limit',
        'tokens_used_this_month',
        'tokens_used_today',
        'last_reset_date',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'expires_at' => 'datetime',
        'last_reset_date' => 'date',
        'custom_monthly_limit' => 'integer',
        'custom_daily_limit' => 'integer',
        'tokens_used_this_month' => 'integer',
        'tokens_used_today' => 'integer',
    ];

    public function plan()
    {
        return $this->belongsTo(AiPlan::class, 'plan_id');
    }

    /**
     * Get effective monthly limit (custom or plan default)
     */
    public function getMonthlyLimit(): int
    {
        return $this->custom_monthly_limit ?? $this->plan->monthly_token_limit ?? 10000;
    }

    /**
     * Get effective daily limit (custom or plan default)
     */
    public function getDailyLimit(): int
    {
        return $this->custom_daily_limit ?? $this->plan->daily_token_limit ?? 1000;
    }

    /**
     * Check if tenant can use more tokens
     */
    public function canUseTokens(int $tokensNeeded = 1): array
    {
        // Reset counters if needed
        $this->resetCountersIfNeeded();

        $monthlyLimit = $this->getMonthlyLimit();
        $dailyLimit = $this->getDailyLimit();

        // Check monthly limit
        if ($this->tokens_used_this_month + $tokensNeeded > $monthlyLimit) {
            return [
                'allowed' => false,
                'reason' => 'monthly_limit_exceeded',
                'message' => "Limite mensal de {$monthlyLimit} tokens atingido.",
                'used' => $this->tokens_used_this_month,
                'limit' => $monthlyLimit,
            ];
        }

        // Check daily limit
        if ($this->tokens_used_today + $tokensNeeded > $dailyLimit) {
            return [
                'allowed' => false,
                'reason' => 'daily_limit_exceeded',
                'message' => "Limite diário de {$dailyLimit} tokens atingido.",
                'used' => $this->tokens_used_today,
                'limit' => $dailyLimit,
            ];
        }

        // Check if plan is active
        if ($this->status !== 'active') {
            return [
                'allowed' => false,
                'reason' => 'plan_inactive',
                'message' => 'Plano inativo ou suspenso.',
            ];
        }

        // Check expiration
        if ($this->expires_at && $this->expires_at->isPast()) {
            return [
                'allowed' => false,
                'reason' => 'plan_expired',
                'message' => 'Plano expirado.',
            ];
        }

        return [
            'allowed' => true,
            'monthly_remaining' => $monthlyLimit - $this->tokens_used_this_month,
            'daily_remaining' => $dailyLimit - $this->tokens_used_today,
        ];
    }

    /**
     * Record token usage
     */
    public function recordUsage(int $tokens): void
    {
        $this->resetCountersIfNeeded();
        
        // Use direct DB query to avoid model caching issues
        \DB::table('ai_tenant_plans')
            ->where('id', $this->id)
            ->increment('tokens_used_this_month', $tokens);
            
        \DB::table('ai_tenant_plans')
            ->where('id', $this->id)
            ->increment('tokens_used_today', $tokens);
            
        // Refresh model values
        $this->refresh();
    }

    /**
     * Reset counters if day/month changed
     */
    private function resetCountersIfNeeded(): void
    {
        $today = now()->toDateString();
        $currentMonth = now()->format('Y-m');
        
        // Refresh to get latest values
        $this->refresh();
        
        $lastResetDate = $this->last_reset_date ? $this->last_reset_date->toDateString() : null;
        $lastResetMonth = $this->last_reset_date ? $this->last_reset_date->format('Y-m') : null;

        // Reset daily counter if day changed
        if ($lastResetDate !== $today) {
            $updates = ['last_reset_date' => $today, 'tokens_used_today' => 0];
            
            // Reset monthly counter if month changed
            if ($lastResetMonth !== $currentMonth) {
                $updates['tokens_used_this_month'] = 0;
            }
            
            \DB::table('ai_tenant_plans')
                ->where('id', $this->id)
                ->update($updates);
                
            $this->refresh();
        }
    }

    /**
     * Get usage statistics
     */
    public function getUsageStats(): array
    {
        $this->resetCountersIfNeeded();
        
        $monthlyLimit = $this->getMonthlyLimit();
        $dailyLimit = $this->getDailyLimit();

        return [
            'plan_name' => $this->plan->name ?? 'Unknown',
            'plan' => [
                'id' => $this->plan->id ?? null,
                'name' => $this->plan->name ?? 'Unknown',
                'slug' => $this->plan->slug ?? 'unknown',
                'price' => $this->plan->price_monthly ?? 0,
                'is_active' => true,
            ],
            'monthly' => [
                'used' => $this->tokens_used_this_month,
                'limit' => $monthlyLimit,
                'remaining' => max(0, $monthlyLimit - $this->tokens_used_this_month),
                'percentage' => $monthlyLimit > 0 ? round(($this->tokens_used_this_month / $monthlyLimit) * 100, 1) : 0,
            ],
            'daily' => [
                'used' => $this->tokens_used_today,
                'limit' => $dailyLimit,
                'remaining' => max(0, $dailyLimit - $this->tokens_used_today),
                'percentage' => $dailyLimit > 0 ? round(($this->tokens_used_today / $dailyLimit) * 100, 1) : 0,
            ],
            'status' => $this->status,
            'expires_at' => $this->expires_at?->toIso8601String(),
        ];
    }

    /**
     * Get or create tenant plan (default to free)
     */
    public static function getOrCreateForTenant(?string $tenantId = null): self
    {
        if (!$tenantId) {
            throw new \InvalidArgumentException('Tenant ID is required for AI plan management');
        }

        $tenantPlan = self::where('tenant_id', $tenantId)->first();

        if (!$tenantPlan) {
            // Get free plan or first available
            $freePlan = AiPlan::where('slug', 'free')->first() 
                ?? AiPlan::active()->ordered()->first();

            if (!$freePlan) {
                // Create a default Free plan if none exist (prevents hard 500s on fresh installs)
                $freePlan = AiPlan::create([
                    'id' => Str::uuid(),
                    'name' => 'Free',
                    'slug' => 'free',
                    'description' => 'Plano padrão gratuito (auto-criado).',
                    // defaults cover limits/features/pricing
                    'sort_order' => 0,
                    'is_active' => true,
                    'is_featured' => false,
                ]);
            }

            $tenantPlan = self::create([
                'tenant_id' => $tenantId,
                'plan_id' => $freePlan->id,
                'status' => 'active',
                'started_at' => now(),
                'last_reset_date' => now()->toDateString(),
            ]);
        }

        return $tenantPlan;
    }
}
