<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Services\PricingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PricingController extends Controller
{
    public function __construct(
        protected PricingService $pricingService
    ) {}

    /**
     * Get all available plans with features.
     */
    public function plans(): JsonResponse
    {
        $plans = $this->pricingService->getPlanComparison();

        return response()->json([
            'success' => true,
            'data' => $plans,
        ]);
    }

    /**
     * Get pricing tiers.
     */
    public function tiers(): JsonResponse
    {
        $tiers = $this->pricingService->getPricingTiers();

        return response()->json([
            'success' => true,
            'data' => $tiers,
        ]);
    }

    /**
     * Calculate price for a plan with resources.
     */
    public function calculate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'plan_id' => 'required|uuid|exists:plans,id',
            'users' => 'required|integer|min:1',
            'clients' => 'required|integer|min:0',
            'products' => 'required|integer|min:0',
            'transactions' => 'required|integer|min:0',
            'billing_cycle' => 'sometimes|string|in:monthly,yearly',
        ]);

        $plan = Plan::findOrFail($validated['plan_id']);

        $price = $this->pricingService->calculatePrice(
            $plan,
            $validated['users'],
            $validated['clients'],
            $validated['products'],
            $validated['transactions'],
            $validated['billing_cycle'] ?? 'monthly'
        );

        return response()->json([
            'success' => true,
            'data' => [
                'plan' => [
                    'id' => $plan->id,
                    'name' => $plan->name,
                    'slug' => $plan->slug,
                ],
                'pricing' => $price,
            ],
        ]);
    }

    /**
     * Get current usage and limits for authenticated tenant.
     */
    public function usage(Request $request): JsonResponse
    {
        $user = $request->user();
        $tenant = $user->tenant;

        if (!$tenant) {
            return response()->json([
                'success' => false,
                'message' => 'Tenant não encontrado',
            ], 404);
        }

        $limits = $this->pricingService->checkLimits($tenant);

        return response()->json([
            'success' => true,
            'data' => $limits,
        ]);
    }

    /**
     * Simulate upgrade to a new plan.
     */
    public function simulateUpgrade(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'plan_id' => 'required|uuid|exists:plans,id',
            'users' => 'required|integer|min:1',
            'clients' => 'required|integer|min:0',
            'products' => 'required|integer|min:0',
            'transactions' => 'required|integer|min:0',
            'billing_cycle' => 'sometimes|string|in:monthly,yearly',
        ]);

        $user = $request->user();
        $tenant = $user->tenant;

        if (!$tenant) {
            return response()->json([
                'success' => false,
                'message' => 'Tenant não encontrado',
            ], 404);
        }

        $newPlan = Plan::findOrFail($validated['plan_id']);

        $simulation = $this->pricingService->simulateUpgrade(
            $tenant,
            $newPlan,
            $validated['users'],
            $validated['clients'],
            $validated['products'],
            $validated['transactions'],
            $validated['billing_cycle'] ?? 'monthly'
        );

        return response()->json([
            'success' => true,
            'data' => $simulation,
        ]);
    }

    /**
     * Get recommended plan based on usage.
     */
    public function recommend(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'users' => 'required|integer|min:1',
            'clients' => 'required|integer|min:0',
            'products' => 'required|integer|min:0',
            'transactions' => 'required|integer|min:0',
        ]);

        $plan = $this->pricingService->getRecommendedPlan(
            $validated['users'],
            $validated['clients'],
            $validated['products'],
            $validated['transactions']
        );

        if (!$plan) {
            return response()->json([
                'success' => false,
                'message' => 'Nenhum plano adequado encontrado',
            ], 404);
        }

        $price = $this->pricingService->calculatePrice(
            $plan,
            $validated['users'],
            $validated['clients'],
            $validated['products'],
            $validated['transactions'],
            'monthly'
        );

        return response()->json([
            'success' => true,
            'data' => [
                'plan' => [
                    'id' => $plan->id,
                    'name' => $plan->name,
                    'slug' => $plan->slug,
                    'description' => $plan->description,
                ],
                'pricing' => $price,
            ],
        ]);
    }
}
