<?php

namespace App\Services;

use App\Models\Plan;
use App\Models\PricingTier;
use App\Models\Subscription;
use App\Models\Tenant;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

class PricingService
{
    /**
     * Calculate the price for a plan based on resource quantities.
     */
    public function calculatePrice(
        Plan $plan,
        int $users,
        int $clients,
        int $products,
        int $transactions,
        string $billingCycle = 'monthly'
    ): array {
        // Se o plano não tem precificação dinâmica, retorna preço fixo
        if (!$plan->has_dynamic_pricing) {
            $basePrice = $billingCycle === 'yearly' 
                ? $plan->price_yearly 
                : $plan->price_monthly;
            
            return [
                'base_price' => $basePrice,
                'additional_users' => 0,
                'additional_clients' => 0,
                'additional_products' => 0,
                'additional_transactions' => 0,
                'subtotal' => $basePrice,
                'discount' => 0,
                'total' => $basePrice,
                'billing_cycle' => $billingCycle,
                'breakdown' => [],
            ];
        }

        // Preço base do plano
        $basePrice = $billingCycle === 'yearly' 
            ? $plan->base_price_yearly 
            : $plan->base_price_monthly;

        // Calcular adicionais por recurso
        $usersExtra = max(0, $users - $plan->included_users);
        $clientsExtra = max(0, $clients - $plan->included_clients);
        $productsExtra = max(0, $products - $plan->included_products);
        $transactionsExtra = max(0, $transactions - $plan->included_transactions);

        $additionalUsers = $this->calculateResourcePrice('users', $usersExtra, $plan->included_users);
        $additionalClients = $this->calculateResourcePrice('clients', $clientsExtra, $plan->included_clients);
        $additionalProducts = $this->calculateResourcePrice('products', $productsExtra, $plan->included_products);
        $additionalTransactions = $this->calculateResourcePrice('transactions', $transactionsExtra, $plan->included_transactions);

        $subtotal = $basePrice + $additionalUsers + $additionalClients + $additionalProducts + $additionalTransactions;

        // Desconto para plano anual (2 meses grátis)
        $discount = 0;
        if ($billingCycle === 'yearly') {
            $monthlyEquivalent = ($basePrice + $additionalUsers + $additionalClients + $additionalProducts + $additionalTransactions);
            // Já está calculado como anual, então não aplica desconto adicional
        }

        $total = $subtotal - $discount;

        return [
            'base_price' => round($basePrice, 2),
            'additional_users' => round($additionalUsers, 2),
            'additional_clients' => round($additionalClients, 2),
            'additional_products' => round($additionalProducts, 2),
            'additional_transactions' => round($additionalTransactions, 2),
            'subtotal' => round($subtotal, 2),
            'discount' => round($discount, 2),
            'total' => round($total, 2),
            'billing_cycle' => $billingCycle,
            'breakdown' => [
                'users' => [
                    'included' => $plan->included_users,
                    'requested' => $users,
                    'extra' => $usersExtra,
                    'price' => round($additionalUsers, 2),
                ],
                'clients' => [
                    'included' => $plan->included_clients,
                    'requested' => $clients,
                    'extra' => $clientsExtra,
                    'price' => round($additionalClients, 2),
                ],
                'products' => [
                    'included' => $plan->included_products,
                    'requested' => $products,
                    'extra' => $productsExtra,
                    'price' => round($additionalProducts, 2),
                ],
                'transactions' => [
                    'included' => $plan->included_transactions,
                    'requested' => $transactions,
                    'extra' => $transactionsExtra,
                    'price' => round($additionalTransactions, 2),
                ],
            ],
        ];
    }

    /**
     * Calculate price for extra resources based on tiers.
     */
    protected function calculateResourcePrice(string $resourceType, int $extraQuantity, int $startFrom = 0): float
    {
        if ($extraQuantity <= 0) {
            return 0;
        }

        $tiers = $this->getTiers($resourceType);
        
        // If no tiers configured, use default pricing
        if ($tiers->isEmpty()) {
            $defaultPrices = [
                'users' => 10.00,
                'clients' => 0.50,
                'products' => 0.30,
                'transactions' => 0.10,
            ];
            return $extraQuantity * ($defaultPrices[$resourceType] ?? 1.00);
        }

        $totalPrice = 0;
        $remaining = $extraQuantity;
        $currentPosition = $startFrom + 1;

        foreach ($tiers as $tier) {
            if ($remaining <= 0) break;

            if ($tier->max_quantity !== -1 && $currentPosition > $tier->max_quantity) {
                continue;
            }

            $tierStart = max($tier->min_quantity, $currentPosition);
            $tierEnd = $tier->max_quantity === -1 
                ? $currentPosition + $remaining - 1 
                : min($tier->max_quantity, $currentPosition + $remaining - 1);

            $quantityInTier = max(0, $tierEnd - $tierStart + 1);
            
            if ($quantityInTier > 0) {
                $totalPrice += ($quantityInTier * $tier->price_per_unit) + $tier->flat_price;
                $remaining -= $quantityInTier;
                $currentPosition += $quantityInTier;
            }
        }

        return $totalPrice;
    }

    /**
     * Get pricing tiers for a resource type.
     */
    protected function getTiers(string $resourceType): Collection
    {
        return Cache::remember("pricing_tiers:{$resourceType}", 3600, function () use ($resourceType) {
            return PricingTier::where('resource_type', $resourceType)
                ->where('is_active', true)
                ->orderBy('min_quantity')
                ->get();
        });
    }

    /**
     * Get all available plans with features.
     */
    public function getPlans(): Collection
    {
        return Cache::remember('plans:all', 3600, function () {
            $plans = Plan::where('is_active', true)
                ->orderBy('sort_order')
                ->get();
            
            // If no plans exist, create default ones
            if ($plans->isEmpty()) {
                $this->seedDefaultPlans();
                $plans = Plan::where('is_active', true)->orderBy('sort_order')->get();
            }
            
            return $plans->load('planFeatures');
        });
    }

    /**
     * Seed default plans if none exist.
     */
    protected function seedDefaultPlans(): void
    {
        $sortOrder = 1;
        foreach (Plan::PLANS as $slug => $planData) {
            Plan::create(array_merge($planData, [
                'slug' => $slug,
                'sort_order' => $sortOrder++,
            ]));
        }
    }

    /**
     * Get plan comparison data.
     */
    public function getPlanComparison(): array
    {
        $plans = $this->getPlans();
        
        return $plans->map(function ($plan) {
            return [
                'id' => $plan->id,
                'name' => $plan->name,
                'slug' => $plan->slug,
                'description' => $plan->description,
                'price_monthly' => $plan->price_monthly,
                'price_yearly' => $plan->price_yearly,
                'base_price_monthly' => $plan->base_price_monthly,
                'base_price_yearly' => $plan->base_price_yearly,
                'has_dynamic_pricing' => $plan->has_dynamic_pricing,
                'trial_days' => $plan->trial_days,
                'yearly_discount' => $plan->yearly_discount,
                'includes_ai' => false, // Plans don't include AI by default (AI is a separate addon)
                // Include limits at root level for frontend compatibility
                'max_users' => $plan->max_users,
                'max_clients' => $plan->max_clients,
                'max_transactions' => $plan->max_transactions,
                'included_users' => $plan->included_users,
                'included_clients' => $plan->included_clients,
                'included_products' => $plan->included_products,
                'included_transactions' => $plan->included_transactions,
                // Also keep nested structure for backward compatibility
                'limits' => [
                    'users' => $plan->included_users ?? $plan->max_users,
                    'clients' => $plan->included_clients ?? $plan->max_clients,
                    'products' => $plan->included_products,
                    'transactions' => $plan->included_transactions ?? $plan->max_transactions,
                ],
                'features' => $plan->features ?? [],
            ];
        })->toArray();
    }

    /**
     * Get pricing tiers for display.
     */
    public function getPricingTiers(): array
    {
        $tiers = PricingTier::where('is_active', true)
            ->orderBy('resource_type')
            ->orderBy('min_quantity')
            ->get();

        return $tiers->groupBy('resource_type')
            ->map(function ($group, $type) {
                return [
                    'type' => $type,
                    'label' => $this->getResourceLabel($type),
                    'tiers' => $group->map(fn($tier) => [
                        'min' => $tier->min_quantity,
                        'max' => $tier->max_quantity,
                        'price_per_unit' => $tier->price_per_unit,
                        'flat_price' => $tier->flat_price,
                    ])->toArray(),
                ];
            })->values()->toArray();
    }

    /**
     * Get resource label.
     */
    protected function getResourceLabel(string $type): string
    {
        return match($type) {
            'users' => 'Usuários',
            'clients' => 'Clientes',
            'products' => 'Produtos',
            'transactions' => 'Transações/mês',
            default => ucfirst($type),
        };
    }

    /**
     * Check if tenant has reached any limit.
     */
    public function checkLimits(Tenant $tenant): array
    {
        $subscription = $tenant->subscription;
        
        if (!$subscription || !$subscription->plan) {
            // Return default free limits in frontend-friendly format
            $currentUsers = $tenant->users()->count();
            $currentClients = $tenant->clients()->count();
            $currentProducts = $tenant->products()->count();
            $currentTransactions = $tenant->pipelineCards()->whereMonth('created_at', now()->month)->count();
            
            return [
                'has_limits' => true,
                'users' => [
                    'current' => $currentUsers,
                    'limit' => 3,
                ],
                'clients' => [
                    'current' => $currentClients,
                    'limit' => 100,
                ],
                'products' => [
                    'current' => $currentProducts,
                    'limit' => 50,
                ],
                'transactions' => [
                    'current' => $currentTransactions,
                    'limit' => 500,
                ],
                'exceeded' => [],
            ];
        }

        $plan = $subscription->plan;
        
        // Contar uso atual
        $currentUsers = $tenant->users()->count();
        $currentClients = $tenant->clients()->count();
        $currentProducts = $tenant->products()->count();
        $currentTransactions = $tenant->pipelineCards()
            ->whereMonth('created_at', now()->month)
            ->count();

        $limits = [
            'users' => $plan->max_users === -1 ? PHP_INT_MAX : $plan->max_users,
            'clients' => $plan->max_clients === -1 ? PHP_INT_MAX : $plan->max_clients,
            'products' => $plan->included_products === -1 ? PHP_INT_MAX : $plan->included_products,
            'transactions' => $plan->max_transactions === -1 ? PHP_INT_MAX : $plan->max_transactions,
        ];

        $usage = [
            'users' => $currentUsers,
            'clients' => $currentClients,
            'products' => $currentProducts,
            'transactions' => $currentTransactions,
        ];

        $exceeded = [];
        foreach ($limits as $key => $limit) {
            if ($usage[$key] >= $limit && $limit !== PHP_INT_MAX) {
                $exceeded[$key] = [
                    'limit' => $limit,
                    'current' => $usage[$key],
                    'overage' => $usage[$key] - $limit,
                ];
            }
        }

        // Atualizar contagem na subscription
        $subscription->update([
            'current_users' => $currentUsers,
            'current_clients' => $currentClients,
            'current_products' => $currentProducts,
            'current_transactions' => $currentTransactions,
        ]);

        // Return in frontend-friendly format
        return [
            'has_limits' => !$plan->has_dynamic_pricing,
            'users' => [
                'current' => $usage['users'],
                'limit' => $limits['users'] === PHP_INT_MAX ? -1 : $limits['users'],
            ],
            'clients' => [
                'current' => $usage['clients'],
                'limit' => $limits['clients'] === PHP_INT_MAX ? -1 : $limits['clients'],
            ],
            'products' => [
                'current' => $usage['products'],
                'limit' => $limits['products'] === PHP_INT_MAX ? -1 : $limits['products'],
            ],
            'transactions' => [
                'current' => $usage['transactions'],
                'limit' => $limits['transactions'] === PHP_INT_MAX ? -1 : $limits['transactions'],
            ],
            'exceeded' => $exceeded,
            'can_upgrade' => !empty($exceeded),
        ];
    }

    /**
     * Get recommended plan based on usage.
     */
    public function getRecommendedPlan(int $users, int $clients, int $products, int $transactions): ?Plan
    {
        $plans = $this->getPlans();

        foreach ($plans as $plan) {
            $meetsUsers = $plan->max_users === -1 || $plan->max_users >= $users;
            $meetsClients = $plan->max_clients === -1 || $plan->max_clients >= $clients;
            $meetsTransactions = $plan->max_transactions === -1 || $plan->max_transactions >= $transactions;

            if ($meetsUsers && $meetsClients && $meetsTransactions) {
                return $plan;
            }
        }

        // Se nenhum plano atende, retorna o Enterprise
        return $plans->last();
    }

    /**
     * Simulate upgrade from current plan.
     */
    public function simulateUpgrade(
        Tenant $tenant,
        Plan $newPlan,
        int $users,
        int $clients,
        int $products,
        int $transactions,
        string $billingCycle = 'monthly'
    ): array {
        $currentSubscription = $tenant->subscription;
        $currentPlan = $currentSubscription?->plan;

        $newPrice = $this->calculatePrice($newPlan, $users, $clients, $products, $transactions, $billingCycle);

        $currentPrice = 0;
        if ($currentPlan) {
            $currentPriceData = $this->calculatePrice(
                $currentPlan,
                $currentSubscription->current_users ?? 0,
                $currentSubscription->current_clients ?? 0,
                $currentSubscription->current_products ?? 0,
                $currentSubscription->current_transactions ?? 0,
                $currentSubscription->billing_cycle ?? 'monthly'
            );
            $currentPrice = $currentPriceData['total'];
        }

        $isUpgrade = $newPrice['total'] > $currentPrice;
        $difference = $newPrice['total'] - $currentPrice;

        return [
            'current_plan' => $currentPlan?->name ?? 'Nenhum',
            'current_price' => round($currentPrice, 2),
            'new_plan' => $newPlan->name,
            'new_price' => $newPrice,
            'is_upgrade' => $isUpgrade,
            'price_difference' => round($difference, 2),
            'effective_date' => now()->format('Y-m-d'),
        ];
    }

    /**
     * Clear pricing cache.
     */
    public function clearCache(): void
    {
        Cache::forget('plans:all');
        foreach (['users', 'clients', 'products', 'transactions'] as $type) {
            Cache::forget("pricing_tiers:{$type}");
        }
    }
}
