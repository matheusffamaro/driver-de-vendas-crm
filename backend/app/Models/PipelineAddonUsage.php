<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class PipelineAddonUsage extends Model
{
    use HasUuids;

    protected $table = 'pipeline_addon_usage';
    
    protected $fillable = [
        'tenant_id',
        'year',
        'month',
        'pipelines_count',
        'additional_pipelines',
        'calculated_cost'
    ];

    protected $casts = [
        'year' => 'integer',
        'month' => 'integer',
        'pipelines_count' => 'integer',
        'additional_pipelines' => 'integer',
        'calculated_cost' => 'decimal:2',
    ];

    /**
     * Get or create usage record for current month
     */
    public static function getCurrentMonthUsage($tenantId)
    {
        return self::firstOrCreate([
            'tenant_id' => $tenantId,
            'year' => now()->year,
            'month' => now()->month,
        ]);
    }

    /**
     * Update calculated cost - Fixed price of R$ 29.90/month for unlimited pipelines
     */
    public function updateCost()
    {
        // Fixed price when addon is enabled and has additional pipelines
        $this->calculated_cost = $this->additional_pipelines > 0 ? 29.90 : 0;
        $this->save();
    }

    /**
     * Get tenant relationship
     */
    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }
}
