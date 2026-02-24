<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiPlan;
use App\Models\AiTenantPlan;
use App\Models\AiTokenUsage;
use App\Services\TokenService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AiPlanController extends Controller
{
    /**
     * List all available plans
     */
    public function index(): JsonResponse
    {
        $plans = TokenService::getAvailablePlans();

        return response()->json([
            'success' => true,
            'data' => $plans,
        ]);
    }

    /**
     * Get current tenant's plan and usage
     */
    public function current(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id ?? $request->user()->id;
        $tokenService = new TokenService($tenantId, $request->user()->id ?? null);

        $stats = $tokenService->getUsageStats();

        return response()->json([
            'success' => true,
            'data' => $stats,
        ]);
    }

    /**
     * Get detailed usage statistics
     */
    public function usage(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id ?? $request->user()->id;
        $days = $request->input('days', 30);

        $dailyHistory = AiTokenUsage::getDailyHistory($tenantId, $days);
        $byFeature = AiTokenUsage::getUsageByFeature($tenantId);
        $todayUsage = AiTokenUsage::getTodayUsage($tenantId);
        $monthlyUsage = AiTokenUsage::getMonthlyUsage($tenantId);

        return response()->json([
            'success' => true,
            'data' => [
                'today' => $todayUsage,
                'this_month' => $monthlyUsage,
                'by_feature' => $byFeature,
                'daily_history' => $dailyHistory,
            ],
        ]);
    }

    /**
     * Change tenant's plan
     */
    public function changePlan(Request $request): JsonResponse
    {
        $request->validate([
            'plan_id' => 'required|uuid|exists:ai_plans,id',
        ]);

        $tenantId = $request->user()->tenant_id ?? $request->user()->id;
        $tokenService = new TokenService($tenantId);

        $result = $tokenService->changePlan($request->input('plan_id'));

        return response()->json($result);
    }

    /**
     * Admin: Create a new plan
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:100',
            'slug' => 'required|string|max:50|unique:ai_plans,slug',
            'description' => 'nullable|string|max:500',
            'monthly_token_limit' => 'required|integer|min:0',
            'daily_token_limit' => 'required|integer|min:0',
            'request_limit_per_minute' => 'required|integer|min:1',
            'price_monthly' => 'required|numeric|min:0',
        ]);

        $plan = AiPlan::create($request->all());

        return response()->json([
            'success' => true,
            'message' => 'Plano criado com sucesso.',
            'data' => $plan,
        ], 201);
    }

    /**
     * Admin: Update a plan
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $plan = AiPlan::findOrFail($id);

        $request->validate([
            'name' => 'sometimes|string|max:100',
            'description' => 'nullable|string|max:500',
            'monthly_token_limit' => 'sometimes|integer|min:0',
            'daily_token_limit' => 'sometimes|integer|min:0',
            'request_limit_per_minute' => 'sometimes|integer|min:1',
            'price_monthly' => 'sometimes|numeric|min:0',
        ]);

        $plan->update($request->all());

        return response()->json([
            'success' => true,
            'message' => 'Plano atualizado com sucesso.',
            'data' => $plan,
        ]);
    }

    /**
     * Admin: Delete a plan
     */
    public function destroy(string $id): JsonResponse
    {
        $plan = AiPlan::findOrFail($id);

        // Check if plan is in use
        $inUse = AiTenantPlan::where('plan_id', $id)->exists();
        if ($inUse) {
            return response()->json([
                'success' => false,
                'message' => 'Este plano está sendo usado e não pode ser excluído.',
            ], 400);
        }

        $plan->delete();

        return response()->json([
            'success' => true,
            'message' => 'Plano excluído com sucesso.',
        ]);
    }

    /**
     * Admin: Assign custom limits to a tenant
     */
    public function setCustomLimits(Request $request): JsonResponse
    {
        $request->validate([
            'tenant_id' => 'required|string',
            'custom_monthly_limit' => 'nullable|integer|min:0',
            'custom_daily_limit' => 'nullable|integer|min:0',
        ]);

        $tenantPlan = AiTenantPlan::where('tenant_id', $request->input('tenant_id'))->first();

        if (!$tenantPlan) {
            return response()->json([
                'success' => false,
                'message' => 'Tenant não encontrado.',
            ], 404);
        }

        $tenantPlan->update([
            'custom_monthly_limit' => $request->input('custom_monthly_limit'),
            'custom_daily_limit' => $request->input('custom_daily_limit'),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Limites customizados atualizados.',
            'data' => $tenantPlan,
        ]);
    }

    /**
     * Get plan comparison table
     */
    public function compare(): JsonResponse
    {
        $plans = AiPlan::active()->ordered()->get();

        $comparison = [
            'features' => [
                ['key' => 'ai_chat_enabled', 'name' => 'Chat com IA', 'description' => 'Respostas automáticas via WhatsApp'],
                ['key' => 'ai_autofill_enabled', 'name' => 'Auto-preenchimento', 'description' => 'Sugestões automáticas de campos'],
                ['key' => 'ai_summarize_enabled', 'name' => 'Resumo de Conversas', 'description' => 'Resumo automático de atendimentos'],
                ['key' => 'ai_lead_analysis_enabled', 'name' => 'Análise de Leads', 'description' => 'Qualificação automática de leads'],
                ['key' => 'ai_email_draft_enabled', 'name' => 'Rascunhos de Email', 'description' => 'Geração de emails com IA'],
                ['key' => 'knowledge_base_enabled', 'name' => 'Base de Conhecimento', 'description' => 'Upload de documentos para contexto'],
            ],
            'plans' => $plans->map(function ($plan) {
                return [
                    'id' => $plan->id,
                    'name' => $plan->name,
                    'price' => $plan->price_monthly,
                    'price_formatted' => $plan->formatted_price,
                    'monthly_tokens' => number_format($plan->monthly_token_limit),
                    'daily_tokens' => number_format($plan->daily_token_limit),
                    'is_featured' => $plan->is_featured,
                    'features' => [
                        'ai_chat_enabled' => $plan->ai_chat_enabled,
                        'ai_autofill_enabled' => $plan->ai_autofill_enabled,
                        'ai_summarize_enabled' => $plan->ai_summarize_enabled,
                        'ai_lead_analysis_enabled' => $plan->ai_lead_analysis_enabled,
                        'ai_email_draft_enabled' => $plan->ai_email_draft_enabled,
                        'knowledge_base_enabled' => $plan->knowledge_base_enabled,
                    ],
                ];
            }),
        ];

        return response()->json([
            'success' => true,
            'data' => $comparison,
        ]);
    }
}
