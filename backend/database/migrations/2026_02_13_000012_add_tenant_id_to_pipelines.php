<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Models\Pipeline;
use App\Models\PipelineCard;
use App\Models\Tenant;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Step 1: Add nullable tenant_id column
        Schema::table('pipelines', function (Blueprint $table) {
            $table->uuid('tenant_id')->nullable()->after('id');
        });

        // Step 2: Backfill tenant_id
        $pipelines = Pipeline::all();
        $defaultTenantId = Tenant::where('is_active', true)->first()?->id;
        
        foreach ($pipelines as $pipeline) {
            // Try to get tenant from first card in this pipeline
            $tenantId = PipelineCard::where('pipeline_id', $pipeline->id)
                ->first()?->tenant_id;
            
            // If no cards, use default active tenant
            if (!$tenantId) {
                $tenantId = $defaultTenantId;
            }
            
            // Always update, even if null (will fail migration if all tenants are deleted)
            $pipeline->update(['tenant_id' => $tenantId]);
        }
        
        // Ensure no nulls remain by using first tenant if somehow still null
        DB::statement("
            UPDATE pipelines
            SET tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1)
            WHERE tenant_id IS NULL
        ");

        // Step 3: Make tenant_id required and add constraints
        Schema::table('pipelines', function (Blueprint $table) {
            $table->uuid('tenant_id')->nullable(false)->change();
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->index(['tenant_id', 'is_active']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('pipelines', function (Blueprint $table) {
            $table->dropForeign(['tenant_id']);
            $table->dropIndex(['tenant_id', 'is_active']);
            $table->dropColumn('tenant_id');
        });
    }
};
