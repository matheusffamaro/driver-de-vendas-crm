<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TenantController extends Controller
{
    /**
     * Get current tenant details (alias for show).
     */
    public function current(Request $request): JsonResponse
    {
        return $this->show($request);
    }

    /**
     * Get current tenant details.
     */
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        $tenant = $user->tenant;
        
        if (!$tenant) {
            return response()->json([
                'success' => false,
                'message' => 'Tenant não encontrado',
            ], 404);
        }
        
        $tenant->load('subscription.plan');
        
        return response()->json([
            'success' => true,
            'data' => [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'slug' => $tenant->slug,
                'document' => $tenant->document,
                'email' => $tenant->email,
                'phone' => $tenant->phone,
                'logo_url' => $tenant->logo_url,
                'address' => $tenant->address,
                'settings' => $tenant->settings,
                'is_active' => $tenant->is_active,
                'created_at' => $tenant->created_at,
                'email_addon_enabled' => $tenant->email_addon_enabled ?? false,
                'email_addon_activated_at' => $tenant->email_addon_activated_at,
                'email_addon_tier' => $tenant->email_addon_tier,
                'pipelines_addon_enabled' => $tenant->pipelines_addon_enabled ?? false,
                'pipelines_addon_activated_at' => $tenant->pipelines_addon_activated_at,
                'pipelines_count' => $tenant->pipelines_count ?? 0,
                'pipelines_limit' => $tenant->getPipelinesLimit(),
                'email_campaigns_addon_enabled' => $tenant->email_campaigns_addon_enabled ?? false,
                'email_campaigns_addon_activated_at' => $tenant->email_campaigns_addon_activated_at ?? null,
                'email_campaigns_addon_leads_tier' => $tenant->email_campaigns_addon_leads_tier ?? null,
                'ai_addon_enabled' => $tenant->ai_addon_enabled ?? false,
                'ai_addon_activated_at' => $tenant->ai_addon_activated_at,
                'subscription' => $tenant->subscription ? [
                    'plan' => [
                        'id' => $tenant->subscription->plan->id ?? null,
                        'name' => $tenant->subscription->plan->name ?? 'Free',
                        'slug' => $tenant->subscription->plan->slug ?? 'free',
                    ],
                    'status' => $tenant->subscription->status,
                    'trial_ends_at' => $tenant->subscription->trial_ends_at,
                    'ends_at' => $tenant->subscription->ends_at,
                ] : null,
                'limits' => $tenant->getUsageStats(),
            ],
        ]);
    }

    /**
     * Update tenant details.
     */
    public function update(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'sometimes|string|max:255',
            'document' => 'sometimes|nullable|string|max:20',
            'email' => 'sometimes|email|max:255',
            'phone' => 'sometimes|nullable|string|max:20',
            'address' => 'sometimes|nullable|array',
            'address.street' => 'sometimes|string|max:255',
            'address.number' => 'sometimes|string|max:20',
            'address.complement' => 'sometimes|nullable|string|max:100',
            'address.neighborhood' => 'sometimes|string|max:100',
            'address.city' => 'sometimes|string|max:100',
            'address.state' => 'sometimes|string|max:2',
            'address.zip_code' => 'sometimes|string|max:10',
            'settings' => 'sometimes|array',
            'settings.timezone' => 'sometimes|string',
            'settings.locale' => 'sometimes|string|max:10',
            'settings.currency' => 'sometimes|string|max:3',
            'settings.date_format' => 'sometimes|string|max:20',
        ]);
        
        $user = $request->user();
        $tenant = $user->tenant;
        
        if (!$tenant) {
            return response()->json([
                'success' => false,
                'message' => 'Tenant não encontrado',
            ], 404);
        }
        
        // Merge settings
        if ($request->has('settings')) {
            $currentSettings = $tenant->settings ?? [];
            $request->merge([
                'settings' => array_merge($currentSettings, $request->settings),
            ]);
        }
        
        $tenant->update($request->only([
            'name', 'document', 'email', 'phone', 'address', 'settings'
        ]));
        
        return response()->json([
            'success' => true,
            'data' => $tenant,
            'message' => 'Configurações atualizadas com sucesso',
        ]);
    }

    /**
     * Upload tenant logo.
     */
    public function uploadLogo(Request $request): JsonResponse
    {
        $request->validate([
            'logo' => 'required|image|mimes:jpeg,png,jpg,gif,webp|max:2048',
        ]);
        
        $user = $request->user();
        $tenant = $user->tenant;
        
        if (!$tenant) {
            return response()->json([
                'success' => false,
                'message' => 'Tenant não encontrado',
            ], 404);
        }
        
        // Store new logo
        $path = $request->file('logo')->store("tenants/{$tenant->id}/logo", 'public');
        $url = asset('storage/' . $path);
        
        $tenant->update(['logo_url' => $url]);
        
        return response()->json([
            'success' => true,
            'data' => [
                'logo_url' => $url,
            ],
            'message' => 'Logo atualizado com sucesso',
        ]);
    }

    /**
     * Delete tenant logo.
     */
    public function deleteLogo(Request $request): JsonResponse
    {
        $user = $request->user();
        $tenant = $user->tenant;
        
        if (!$tenant) {
            return response()->json([
                'success' => false,
                'message' => 'Tenant não encontrado',
            ], 404);
        }
        
        $tenant->update(['logo_url' => null]);
        
        return response()->json([
            'success' => true,
            'message' => 'Logo removido com sucesso',
        ]);
    }

    /**
     * Get current usage statistics.
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

        $tenant->load('subscription.plan');
        $usageStats = $tenant->getUsageStats();
        
        return response()->json([
            'success' => true,
            'data' => [
                'tenant' => [
                    'id' => $tenant->id,
                    'name' => $tenant->name,
                ],
                'plan' => $tenant->plan ? [
                    'id' => $tenant->plan->id,
                    'name' => $tenant->plan->name,
                    'slug' => $tenant->plan->slug,
                ] : [
                    'id' => null,
                    'name' => 'Free',
                    'slug' => 'free',
                ],
                'usage' => $usageStats,
                'trial_ends_at' => $tenant->subscription?->trial_ends_at,
                'is_trial' => $tenant->subscription?->status === 'trial',
            ],
        ]);
    }

    /**
     * Get subscription status (14-day trial info).
     */
    public function subscriptionStatus(Request $request): JsonResponse
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
            return response()->json([
                'success' => true,
                'data' => [
                    'has_subscription' => false,
                    'message' => 'Nenhuma assinatura ativa encontrada',
                ],
            ]);
        }

        $subscription->load('plan');

        return response()->json([
            'success' => true,
            'data' => [
                'has_subscription' => true,
                'subscription' => [
                    'id' => $subscription->id,
                    'status' => $subscription->status,
                    'trial_ends_at' => $subscription->trial_ends_at,
                    'trial_days_remaining' => $subscription->trialDaysRemaining(),
                    'is_on_trial' => $subscription->onTrial(),
                    'trial_expired' => $subscription->trialExpired(),
                    'has_access' => $subscription->hasAccess(),
                    'starts_at' => $subscription->starts_at,
                    'ends_at' => $subscription->ends_at,
                ],
                'plan' => [
                    'id' => $subscription->plan->id,
                    'name' => $subscription->plan->name,
                    'slug' => $subscription->plan->slug,
                ],
                'message' => $subscription->onTrial() 
                    ? "Você está no trial de 14 dias. Restam {$subscription->trialDaysRemaining()} dias."
                    : 'Assinatura ativa',
            ],
        ]);
    }

    /**
     * Get plan limits for the current tenant.
     */
    public function limits(Request $request): JsonResponse
    {
        $user = $request->user();
        $tenant = $user->tenant;

        if (!$tenant) {
            return response()->json([
                'success' => false,
                'message' => 'Tenant não encontrado',
            ], 404);
        }

        $tenant->load('subscription.plan');
        
        $plan = $tenant->plan;
        $resources = ['users', 'clients', 'products', 'transactions'];
        $limits = [];
        
        foreach ($resources as $resource) {
            $limitCheck = $tenant->checkLimit($resource);
            $limits[$resource] = [
                'current' => $limitCheck['current'],
                'limit' => $limitCheck['limit'],
                'remaining' => $limitCheck['remaining'],
                'percentage' => $limitCheck['percentage'],
                'can_add' => $limitCheck['can_add'],
                'label' => Tenant::getResourceLabel($resource),
            ];
        }
        
        // Check available features
        $features = [];
        if ($plan) {
            $planFeatures = $plan->planFeatures()->get();
            foreach ($planFeatures as $feature) {
                $features[$feature->feature_key] = [
                    'name' => $feature->feature_name,
                    'value' => $feature->value,
                    'enabled' => $feature->value === 'true' || $feature->value === 'unlimited',
                ];
            }
        }
        
        return response()->json([
            'success' => true,
            'data' => [
                'plan' => $plan ? [
                    'id' => $plan->id,
                    'name' => $plan->name,
                    'slug' => $plan->slug,
                    'has_dynamic_pricing' => $plan->has_dynamic_pricing,
                ] : null,
                'limits' => $limits,
                'features' => $features,
                'upgrade_available' => $plan?->slug !== 'enterprise',
                'upgrade_url' => '/settings?tab=system-plan',
            ],
        ]);
    }
}
