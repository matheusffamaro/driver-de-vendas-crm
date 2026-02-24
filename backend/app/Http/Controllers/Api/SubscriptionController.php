<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Models\Subscription;
use App\Services\PayPalService;
use App\Services\PricingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class SubscriptionController extends Controller
{
    public function __construct(
        protected PricingService $pricingService,
        protected PayPalService $payPalService,
    ) {}

    /**
     * List all available plans.
     */
    public function listPlans(): JsonResponse
    {
        $plans = Plan::active()
            ->orderBy('sort_order')
            ->get();
        
        // If no plans exist, seed defaults
        if ($plans->isEmpty()) {
            $sortOrder = 1;
            foreach (Plan::PLANS as $slug => $planData) {
                Plan::create(array_merge($planData, [
                    'slug' => $slug,
                    'sort_order' => $sortOrder++,
                ]));
            }
            $plans = Plan::active()->orderBy('sort_order')->get();
        }

        $plans = $plans->map(function ($plan) {
            return [
                'id' => $plan->id,
                'name' => $plan->name,
                'slug' => $plan->slug,
                'description' => $plan->description,
                'price_monthly' => $plan->price_monthly,
                'price_yearly' => $plan->price_yearly,
                'max_users' => $plan->max_users,
                'max_clients' => $plan->max_clients,
                'max_transactions' => $plan->max_transactions,
                'included_products' => $plan->included_products,
                'features' => $plan->features,
                'yearly_discount' => $plan->yearly_discount,
                'includes_ai' => $plan->includes_ai ?? false,
                'has_dynamic_pricing' => $plan->has_dynamic_pricing ?? false,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $plans,
        ]);
    }

    /**
     * Get current subscription.
     */
    public function current(Request $request): JsonResponse
    {
        $user = $request->user();
        $tenant = $user->tenant;

        if (!$tenant) {
            return response()->json([
                'success' => false,
                'message' => 'Tenant não encontrado',
            ], 404);
        }

        $subscription = $tenant->subscription;

        if (!$subscription) {
            // Return free plan as default
            $freePlan = Plan::where('slug', 'free')->first();
            
            return response()->json([
                'success' => true,
                'data' => [
                    'id' => null,
                    'status' => 'active',
                    'trial_ends_at' => null,
                    'starts_at' => null,
                    'ends_at' => null,
                    'billing_cycle' => 'monthly',
                    'current_users' => $tenant->users()->count(),
                    'current_clients' => $tenant->clients()->count(),
                    'current_products' => $tenant->products()->count(),
                    'current_transactions' => $tenant->pipelineCards()->whereMonth('created_at', now()->month)->count(),
                    'calculated_price' => 0,
                    'is_trial_expired' => false,
                    'days_remaining' => null,
                    'plan' => $freePlan ? [
                        'id' => $freePlan->id,
                        'name' => $freePlan->name,
                        'slug' => $freePlan->slug,
                        'description' => $freePlan->description,
                        'price_monthly' => $freePlan->price_monthly,
                        'price_yearly' => $freePlan->price_yearly,
                        'max_users' => $freePlan->max_users,
                        'max_clients' => $freePlan->max_clients,
                        'max_transactions' => $freePlan->max_transactions,
                        'included_products' => $freePlan->included_products,
                        'features' => $freePlan->features,
                    ] : [
                        'id' => null,
                        'name' => 'Free',
                        'slug' => 'free',
                        'description' => 'Plano gratuito',
                        'price_monthly' => 0,
                        'price_yearly' => 0,
                        'max_users' => 3,
                        'max_clients' => 100,
                        'max_transactions' => 500,
                        'features' => [],
                    ],
                ],
            ]);
        }

        $subscription->load('plan');

        // Check trial status
        $isTrialExpired = false;
        $daysRemaining = null;

        if ($subscription->status === 'trial' && $subscription->trial_ends_at) {
            $trialEndsAt = \Carbon\Carbon::parse($subscription->trial_ends_at);
            $isTrialExpired = $trialEndsAt->isPast();
            $daysRemaining = $isTrialExpired ? 0 : now()->diffInDays($trialEndsAt);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $subscription->id,
                'status' => $subscription->status,
                'trial_ends_at' => $subscription->trial_ends_at,
                'starts_at' => $subscription->starts_at,
                'ends_at' => $subscription->ends_at,
                'billing_cycle' => $subscription->billing_cycle ?? 'monthly',
                'current_users' => $subscription->current_users ?? $tenant->users()->count(),
                'current_clients' => $subscription->current_clients ?? $tenant->clients()->count(),
                'current_products' => $subscription->current_products ?? $tenant->products()->count(),
                'current_transactions' => $subscription->current_transactions ?? $tenant->pipelineCards()->whereMonth('created_at', now()->month)->count(),
                'calculated_price' => $subscription->calculated_price,
                'is_trial_expired' => $isTrialExpired,
                'days_remaining' => $daysRemaining,
                'plan' => $subscription->plan ? [
                    'id' => $subscription->plan->id,
                    'name' => $subscription->plan->name,
                    'slug' => $subscription->plan->slug,
                    'description' => $subscription->plan->description,
                    'price_monthly' => $subscription->plan->price_monthly,
                    'price_yearly' => $subscription->plan->price_yearly,
                    'max_users' => $subscription->plan->max_users,
                    'max_clients' => $subscription->plan->max_clients,
                    'max_transactions' => $subscription->plan->max_transactions,
                    'included_products' => $subscription->plan->included_products,
                    'features' => $subscription->plan->features,
                ] : null,
            ],
        ]);
    }

    /**
     * Upgrade subscription.
     */
    public function upgrade(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'plan_id' => 'required|uuid|exists:plans,id',
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
        $subscription = $tenant->subscription;

        if (!$subscription) {
            // Create new subscription
            $subscription = Subscription::create([
                'tenant_id' => $tenant->id,
                'plan_id' => $newPlan->id,
                'status' => 'active',
                'starts_at' => now(),
                'billing_cycle' => $validated['billing_cycle'] ?? 'monthly',
            ]);
        } else {
            // Update existing subscription
            $subscription->update([
                'plan_id' => $newPlan->id,
                'status' => 'active',
                'billing_cycle' => $validated['billing_cycle'] ?? $subscription->billing_cycle ?? 'monthly',
            ]);
        }

        $subscription->load('plan');

        return response()->json([
            'success' => true,
            'message' => 'Plano atualizado com sucesso',
            'data' => $subscription,
        ]);
    }

    /**
     * Cancel subscription.
     */
    public function cancel(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reason' => 'nullable|string|max:500',
        ]);

        $user = $request->user();
        $tenant = $user->tenant;

        if (!$tenant) {
            return response()->json([
                'success' => false,
                'message' => 'Tenant não encontrado',
            ], 404);
        }

        $subscription = $tenant->subscription;

        if (!$subscription) {
            return response()->json([
                'success' => false,
                'message' => 'Nenhuma assinatura ativa encontrada',
            ], 404);
        }

        $reason = $validated['reason'] ?? 'Cancelado pelo usuário';

        // Cancel PayPal subscription if exists
        if ($subscription->paypal_subscription_id) {
            try {
                $this->payPalService->cancelSubscription(
                    $subscription->paypal_subscription_id,
                    $reason
                );
            } catch (\Exception $e) {
                Log::error('Falha ao cancelar assinatura PayPal', [
                    'subscription_id' => $subscription->id,
                    'paypal_id' => $subscription->paypal_subscription_id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // Downgrade to free plan
        $freePlan = Plan::free();

        $cancelData = [
            'cancelled_at' => now(),
            'metadata' => array_merge($subscription->metadata ?? [], [
                'cancellation_reason' => $reason,
                'cancelled_by' => $user->id,
            ]),
        ];

        if ($freePlan) {
            $subscription->update(array_merge($cancelData, [
                'plan_id' => $freePlan->id,
                'status' => 'active',
            ]));
        } else {
            $subscription->update(array_merge($cancelData, [
                'status' => 'cancelled',
            ]));
        }

        // Disable all add-ons
        $tenant->update([
            'ai_addon_enabled' => false,
            'email_addon_enabled' => false,
            'pipelines_addon_enabled' => false,
            'email_campaigns_addon_enabled' => false,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Assinatura cancelada com sucesso. Você foi movido para o plano gratuito.',
        ]);
    }

    /**
     * Get invoices.
     */
    public function invoices(Request $request): JsonResponse
    {
        $user = $request->user();
        $tenant = $user->tenant;

        if (!$tenant) {
            return response()->json([
                'success' => false,
                'message' => 'Tenant não encontrado',
            ], 404);
        }

        $payments = $tenant->payments()
            ->where('status', 'completed')
            ->orderByDesc('created_at')
            ->paginate(10);

        return response()->json([
            'success' => true,
            'data' => $payments->items(),
            'meta' => [
                'current_page' => $payments->currentPage(),
                'total' => $payments->total(),
                'last_page' => $payments->lastPage(),
            ],
        ]);
    }
}
