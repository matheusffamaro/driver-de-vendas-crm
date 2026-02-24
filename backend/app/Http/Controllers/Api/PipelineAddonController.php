<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PipelineAddonUsage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PipelineAddonController extends Controller
{
    /**
     * Activate pipeline addon for the tenant.
     */
    public function activate(Request $request): JsonResponse
    {
        $tenant = $request->user()->tenant;
        $tenant->pipelines_addon_enabled = true;
        $tenant->pipelines_addon_activated_at = now();
        
        // Update pipelines count
        $tenant->updatePipelinesCount();
        
        // Create/update usage record
        $usage = PipelineAddonUsage::getCurrentMonthUsage($tenant->id);
        $usage->pipelines_count = $tenant->pipelines_count;
        $usage->additional_pipelines = max(0, $tenant->pipelines_count - 1);
        $usage->updateCost();
        
        return response()->json([
            'success' => true,
            'message' => 'Pipeline add-on activated successfully',
            'data' => [
                'pipelines_count' => $tenant->pipelines_count,
                'additional_pipelines' => $usage->additional_pipelines,
                'calculated_cost' => $usage->calculated_cost,
            ]
        ]);
    }

    /**
     * Deactivate pipeline addon for the tenant.
     */
    public function deactivate(Request $request): JsonResponse
    {
        $tenant = $request->user()->tenant;
        
        // Check if tenant has more than 1 pipeline
        if ($tenant->pipelines_count > 1) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot deactivate. You have ' . $tenant->pipelines_count . ' pipelines. Please delete extra pipelines first (keep only 1).',
            ], 400);
        }
        
        $tenant->pipelines_addon_enabled = false;
        $tenant->save();
        
        return response()->json([
            'success' => true,
            'message' => 'Pipeline add-on deactivated successfully',
        ]);
    }

    /**
     * Get current month usage.
     */
    public function currentUsage(Request $request): JsonResponse
    {
        $usage = PipelineAddonUsage::getCurrentMonthUsage($request->user()->tenant_id);
        
        return response()->json([
            'success' => true,
            'data' => $usage,
        ]);
    }

    /**
     * Get usage history.
     */
    public function usageHistory(Request $request): JsonResponse
    {
        $history = PipelineAddonUsage::where('tenant_id', $request->user()->tenant_id)
            ->orderBy('year', 'desc')
            ->orderBy('month', 'desc')
            ->limit(12)
            ->get();
        
        return response()->json([
            'success' => true,
            'data' => $history,
        ]);
    }
}
