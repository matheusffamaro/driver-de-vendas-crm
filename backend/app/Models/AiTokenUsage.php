<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class AiTokenUsage extends Model
{
    use HasUuids;

    protected $table = 'ai_token_usage';

    protected $fillable = [
        'tenant_id',
        'user_id',
        'feature',
        'prompt_tokens',
        'completion_tokens',
        'total_tokens',
        'model',
        'cache_hit',
        'response_time_ms',
        'usage_date',
        'year_month',
    ];

    protected $casts = [
        'prompt_tokens' => 'integer',
        'completion_tokens' => 'integer',
        'total_tokens' => 'integer',
        'cache_hit' => 'boolean',
        'response_time_ms' => 'integer',
        'usage_date' => 'date',
    ];

    /**
     * Get usage for today
     */
    public static function getTodayUsage(?string $tenantId = null): int
    {
        return self::where('usage_date', now()->toDateString())
            ->when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
            ->sum('total_tokens');
    }

    /**
     * Get usage for current month
     */
    public static function getMonthlyUsage(?string $tenantId = null): int
    {
        $yearMonth = (int) now()->format('Ym');
        return self::where('year_month', $yearMonth)
            ->when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
            ->sum('total_tokens');
    }

    /**
     * Get usage by feature for current month
     */
    public static function getUsageByFeature(?string $tenantId = null): array
    {
        $yearMonth = (int) now()->format('Ym');
        return self::where('year_month', $yearMonth)
            ->when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
            ->selectRaw('feature, SUM(total_tokens) as tokens, COUNT(*) as requests')
            ->groupBy('feature')
            ->get()
            ->keyBy('feature')
            ->toArray();
    }

    /**
     * Record token usage
     */
    public static function record(
        string $feature,
        int $promptTokens,
        int $completionTokens,
        ?string $model = null,
        bool $cacheHit = false,
        ?int $responseTimeMs = null,
        ?string $tenantId = null,
        ?string $userId = null
    ): self {
        return self::create([
            'tenant_id' => $tenantId,
            'user_id' => $userId,
            'feature' => $feature,
            'prompt_tokens' => $promptTokens,
            'completion_tokens' => $completionTokens,
            'total_tokens' => $promptTokens + $completionTokens,
            'model' => $model,
            'cache_hit' => $cacheHit,
            'response_time_ms' => $responseTimeMs,
            'usage_date' => now()->toDateString(),
            'year_month' => (int) now()->format('Ym'),
        ]);
    }

    /**
     * Get daily usage history for last N days
     */
    public static function getDailyHistory(?string $tenantId = null, int $days = 30): array
    {
        $startDate = now()->subDays($days)->toDateString();
        
        return self::where('usage_date', '>=', $startDate)
            ->when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
            ->selectRaw('usage_date, SUM(total_tokens) as tokens, COUNT(*) as requests')
            ->groupBy('usage_date')
            ->orderBy('usage_date')
            ->get()
            ->toArray();
    }
}
