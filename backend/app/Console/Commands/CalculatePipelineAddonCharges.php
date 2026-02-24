<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Tenant;
use App\Models\PipelineAddonUsage;

class CalculatePipelineAddonCharges extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'pipeline-addon:calculate-charges {--month=} {--year=}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Calculate monthly pipeline addon charges for all tenants';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $month = $this->option('month') ?? now()->month;
        $year = $this->option('year') ?? now()->year;
        
        $this->info("Calculating pipeline addon charges for {$year}-{$month}...");
        
        $tenants = Tenant::where('pipelines_addon_enabled', true)->get();
        
        $totalCharged = 0;
        $processedCount = 0;
        
        foreach ($tenants as $tenant) {
            $pipelinesCount = $tenant->pipelines()->count();
            $additionalPipelines = max(0, $pipelinesCount - 1);
            // Fixed price of R$ 29.90/month for unlimited pipelines
            $cost = $additionalPipelines > 0 ? 29.90 : 0;
            
            $usage = PipelineAddonUsage::updateOrCreate(
                [
                    'tenant_id' => $tenant->id,
                    'year' => $year,
                    'month' => $month,
                ],
                [
                    'pipelines_count' => $pipelinesCount,
                    'additional_pipelines' => $additionalPipelines,
                    'calculated_cost' => $cost,
                ]
            );
            
            $this->info("  Tenant {$tenant->name}: {$pipelinesCount} pipelines, " . ($additionalPipelines > 0 ? "unlimited" : "free") . " = R$ " . number_format($cost, 2, ',', '.'));
            
            $totalCharged += $cost;
            $processedCount++;
        }
        
        $this->info('');
        $this->info("✓ Done!");
        $this->info("  Processed: {$processedCount} tenants");
        $this->info("  Total charged: R$ " . number_format($totalCharged, 2, ',', '.'));
        
        return Command::SUCCESS;
    }
}
