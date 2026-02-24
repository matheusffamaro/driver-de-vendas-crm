<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminAuditLog;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Subscription;
use App\Models\Plan;
use App\Models\Role;
use App\Models\AiTenantPlan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Carbon\Carbon;

class SuperAdminController extends Controller
{
    // ==========================================
    // DASHBOARD OVERVIEW
    // ==========================================

    /**
     * Dashboard principal com métricas globais.
     */
    public function dashboard(): JsonResponse
    {
        try {
            AdminAuditLog::log('view_dashboard');
        } catch (\Exception $e) {
            // Ignore audit log errors
        }

        // Métricas de tenants
        $totalTenants = Tenant::count();
        $activeTenants = Tenant::where('is_active', true)->count();
        $newTenantsThisMonth = Tenant::whereMonth('created_at', now()->month)->count();
        $newTenantsLastMonth = Tenant::whereMonth('created_at', now()->subMonth()->month)->count();
        
        // Métricas de usuários
        $totalUsers = User::count();
        $activeUsers = User::where('is_active', true)->count();
        $newUsersThisMonth = User::whereMonth('created_at', now()->month)->count();
        
        // Métricas de receita (subscriptions) - com tratamento de erro
        $activeSubscriptions = 0;
        $monthlyRevenue = 0;
        try {
            $activeSubscriptions = Subscription::whereIn('status', ['active', 'trial'])->count();
            $monthlyRevenue = Subscription::whereIn('status', ['active'])
                ->join('plans', 'subscriptions.plan_id', '=', 'plans.id')
                ->sum('plans.price');
        } catch (\Exception $e) {
            // Tabela ou coluna pode não existir
        }
        
        // Métricas de uso de IA - com tratamento de erro
        $aiUsageToday = 0;
        $aiUsageMonth = 0;
        try {
            $aiUsageToday = (int) DB::table('ai_token_usage')
                ->where('usage_date', now()->toDateString())
                ->sum('total_tokens');
            $aiUsageMonth = (int) DB::table('ai_token_usage')
                ->where('year_month', (int) now()->format('Ym'))
                ->sum('total_tokens');
        } catch (\Exception $e) {
            // Tabela pode não existir
        }
        $aiCostMonth = $this->calculateAICost($aiUsageMonth);
        
        // Crescimento
        $tenantGrowth = $newTenantsLastMonth > 0 
            ? round((($newTenantsThisMonth - $newTenantsLastMonth) / $newTenantsLastMonth) * 100, 1)
            : ($newTenantsThisMonth > 0 ? 100 : 0);

        return response()->json([
            'success' => true,
            'data' => [
                'tenants' => [
                    'total' => $totalTenants,
                    'active' => $activeTenants,
                    'inactive' => $totalTenants - $activeTenants,
                    'new_this_month' => $newTenantsThisMonth,
                    'growth_percent' => $tenantGrowth,
                ],
                'users' => [
                    'total' => $totalUsers,
                    'active' => $activeUsers,
                    'new_this_month' => $newUsersThisMonth,
                ],
                'subscriptions' => [
                    'active' => $activeSubscriptions,
                    'monthly_revenue' => $monthlyRevenue,
                    'monthly_revenue_formatted' => 'R$ ' . number_format($monthlyRevenue ?? 0, 2, ',', '.'),
                ],
                'ai_usage' => [
                    'tokens_today' => $aiUsageToday,
                    'tokens_month' => $aiUsageMonth,
                    'cost_month_usd' => $aiCostMonth,
                    'cost_month_brl' => $aiCostMonth * 5, // Aproximado
                ],
                'updated_at' => now()->toISOString(),
            ],
        ]);
    }

    /**
     * Gráfico de crescimento de tenants.
     */
    public function tenantsGrowthChart(Request $request): JsonResponse
    {
        $period = $request->get('period', '30'); // 7, 30, 90 dias
        
        $data = Tenant::select(
            DB::raw('DATE(created_at) as date'),
            DB::raw('COUNT(*) as count')
        )
            ->where('created_at', '>=', now()->subDays($period))
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    /**
     * Gráfico de uso de IA ao longo do tempo.
     */
    public function aiUsageChart(Request $request): JsonResponse
    {
        $period = $request->get('period', '30');
        
        $data = DB::table('ai_token_usage')
            ->select(
                DB::raw('usage_date as date'),
                DB::raw('SUM(prompt_tokens) as input_tokens'),
                DB::raw('SUM(completion_tokens) as output_tokens'),
                DB::raw('SUM(total_tokens) as total_tokens'),
                DB::raw('COUNT(*) as requests')
            )
            ->where('usage_date', '>=', now()->subDays($period)->toDateString())
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        // Calcular custo por dia
        $dataWithCost = $data->map(function ($day) {
            $day->cost_usd = $this->calculateAICostDetailed($day->input_tokens ?? 0, $day->output_tokens ?? 0);
            return $day;
        });

        return response()->json([
            'success' => true,
            'data' => $dataWithCost,
        ]);
    }

    // ==========================================
    // TENANTS MANAGEMENT
    // ==========================================

    /**
     * Listar todos os tenants com métricas.
     */
    public function listTenants(Request $request): JsonResponse
    {
        try {
            AdminAuditLog::log('list_tenants');
        } catch (\Exception $e) {
            // Ignore audit log errors
        }

        $query = Tenant::with(['subscription.plan']);

        // Search
        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                    ->orWhere('email', 'ilike', "%{$search}%")
                    ->orWhere('document', 'ilike', "%{$search}%");
            });
        }

        // Filter by status
        if ($request->has('status') && $request->status !== 'all') {
            $query->where('is_active', $request->status === 'active');
        }

        // Filter by plan
        if ($request->has('plan_id')) {
            $query->whereHas('subscription', function ($q) use ($request) {
                $q->where('plan_id', $request->plan_id);
            });
        }

        // Sort
        $sortField = $request->get('sort', 'created_at');
        $sortDir = $request->get('direction', 'desc');
        $query->orderBy($sortField, $sortDir);

        $tenants = $query->paginate($request->get('per_page', 20));

        // Adicionar métricas a cada tenant de forma segura
        $tenants->getCollection()->transform(function ($tenant) {
            try {
                $usersCount = $tenant->users()->count();
            } catch (\Exception $e) {
                $usersCount = 0;
            }
            
            try {
                $clientsCount = $tenant->clients()->count();
            } catch (\Exception $e) {
                $clientsCount = 0;
            }
            
            try {
                $pipelineCount = $tenant->pipelineCards()->count();
            } catch (\Exception $e) {
                $pipelineCount = 0;
            }
            
            $tenant->metrics = [
                'users_count' => $usersCount,
                'clients_count' => $clientsCount,
                'pipeline_cards_count' => $pipelineCount,
                'ai_tokens_used' => $this->getTenantAIUsage($tenant->id),
            ];
            
            // Add computed status fields
            $tenant->computed_status = $this->getTenantStatus($tenant);
            $tenant->subscription_status_label = $this->getSubscriptionStatusLabel($tenant);
            
            return $tenant;
        });

        return response()->json([
            'success' => true,
            'data' => $tenants->items(),
            'meta' => [
                'current_page' => $tenants->currentPage(),
                'last_page' => $tenants->lastPage(),
                'per_page' => $tenants->perPage(),
                'total' => $tenants->total(),
            ],
        ]);
    }

    /**
     * Detalhes completos de um tenant.
     */
    public function showTenant(string $id): JsonResponse
    {
        $tenant = Tenant::with([
            'subscription.plan',
            'subscriptions.plan',  // Load all subscriptions for history
            'users' => fn($q) => $q->limit(10),
        ])->findOrFail($id);

        AdminAuditLog::log('view_tenant', 'tenant', $id);

        // Métricas detalhadas
        $adminRoleId = Role::where('name', 'admin')->first()?->id;
        
        $metrics = [
            'users' => [
                'total' => $tenant->users()->count(),
                'active' => $tenant->users()->where('is_active', true)->count(),
                'admins' => $adminRoleId 
                    ? $tenant->users()->where('role_id', $adminRoleId)->count()
                    : 0,
            ],
            'clients' => [
                'total' => $tenant->clients()->count(),
                'this_month' => $tenant->clients()->whereMonth('created_at', now()->month)->count(),
            ],
            'pipeline' => [
                'total_cards' => $tenant->pipelineCards()->count(),
                'this_month' => $tenant->pipelineCards()->whereMonth('created_at', now()->month)->count(),
            ],
            'ai_usage' => $this->getTenantAIUsageDetailed($id),
        ];

        // Últimas atividades
        $recentActivity = DB::table('ai_usage_logs')
            ->where('tenant_id', $id)
            ->orderByDesc('created_at')
            ->limit(10)
            ->get();

        // Add computed status fields to tenant object
        $tenant->computed_status = $this->getTenantStatus($tenant);
        $tenant->subscription_status_label = $this->getSubscriptionStatusLabel($tenant);

        return response()->json([
            'success' => true,
            'data' => [
                'tenant' => $tenant,
                'metrics' => $metrics,
                'recent_activity' => $recentActivity,
            ],
        ]);
    }

    /**
     * Atualizar status/configurações do tenant.
     */
    public function updateTenant(Request $request, string $id): JsonResponse
    {
        $tenant = Tenant::findOrFail($id);

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email',
            'is_active' => 'sometimes|boolean',
        ]);

        $oldValues = $tenant->toArray();
        $tenant->update($request->only(['name', 'email', 'is_active']));

        AdminAuditLog::log('update_tenant', 'tenant', $id, $oldValues, $tenant->fresh()->toArray());

        return response()->json([
            'success' => true,
            'message' => 'Tenant atualizado com sucesso.',
            'data' => $tenant->fresh(),
        ]);
    }

    /**
     * Suspender tenant.
     */
    public function suspendTenant(Request $request, string $id): JsonResponse
    {
        $tenant = Tenant::with('subscriptions')->findOrFail($id);

        // Atualizar tenant (is_active é guarded, então usamos atribuição direta)
        $tenant->is_active = false;
        $tenant->save();

        // Atualizar subscription status para 'suspended' (armazenar status anterior)
        // Usar subscriptions() para pegar TODAS, não apenas active/trial
        $activeSubscription = $tenant->subscriptions()->whereIn('status', ['active', 'trial'])->first();
        
        if ($activeSubscription) {
            $previousStatus = $activeSubscription->status;
            
            $activeSubscription->update([
                'status' => Subscription::STATUS_SUSPENDED,
                'metadata' => array_merge(
                    $activeSubscription->metadata ?? [],
                    [
                        'suspended_at' => now()->toISOString(),
                        'previous_status' => $previousStatus,
                        'suspension_reason' => $request->reason,
                    ]
                ),
            ]);
        }

        // Suspender todos os usuários do tenant
        $tenant->users()->update([
            'is_active' => false,
            'suspended_at' => now(),
            'suspended_reason' => $request->reason ?? 'Tenant suspenso pelo administrador',
        ]);

        // Enviar email para os administradores do tenant
        $adminRoleId = Role::where('name', 'admin')->first()?->id;
        if ($adminRoleId) {
            $admins = $tenant->users()->where('role_id', $adminRoleId)->get();
            
            foreach ($admins as $admin) {
                if ($admin->email) {
                    \Mail::to($admin->email)->send(new \App\Mail\TenantSuspensionMail($tenant, $request->reason));
                }
            }
        }

        AdminAuditLog::log('suspend_tenant', 'tenant', $id, null, ['reason' => $request->reason]);

        return response()->json([
            'success' => true,
            'message' => 'Tenant suspenso com sucesso. Emails de notificação enviados.',
        ]);
    }

    /**
     * Reativar tenant.
     */
    public function activateTenant(string $id): JsonResponse
    {
        $tenant = Tenant::with('subscriptions')->findOrFail($id);

        // Atualizar tenant (is_active é guarded, então usamos atribuição direta)
        $tenant->is_active = true;
        $tenant->save();

        // Restaurar subscription status (se estava suspensa)
        // IMPORTANTE: Usar subscriptions() para pegar TODAS, incluindo suspended
        $suspendedSubscription = $tenant->subscriptions()->where('status', Subscription::STATUS_SUSPENDED)->first();
        
        if ($suspendedSubscription) {
            $metadata = $suspendedSubscription->metadata ?? [];
            $previousStatus = $metadata['previous_status'] ?? Subscription::STATUS_ACTIVE;
            
            // Verificar se estava em trial e já expirou
            if ($previousStatus === Subscription::STATUS_TRIAL) {
                $trialEndsAt = $suspendedSubscription->trial_ends_at;
                if ($trialEndsAt && $trialEndsAt->isPast()) {
                    $previousStatus = Subscription::STATUS_EXPIRED;
                }
            }
            
            // Verificar se estava ativa mas expirou
            if ($previousStatus === Subscription::STATUS_ACTIVE) {
                $endsAt = $suspendedSubscription->ends_at;
                if ($endsAt && $endsAt->isPast()) {
                    $previousStatus = Subscription::STATUS_EXPIRED;
                }
            }
            
            // Limpar metadata de suspensão
            unset($metadata['suspended_at']);
            unset($metadata['previous_status']);
            unset($metadata['suspension_reason']);
            
            $suspendedSubscription->update([
                'status' => $previousStatus,
                'metadata' => $metadata,
            ]);
        }

        // Reativar usuários do tenant
        $tenant->users()->update([
            'is_active' => true,
            'suspended_at' => null,
            'suspended_reason' => null,
        ]);

        AdminAuditLog::log('activate_tenant', 'tenant', $id);

        return response()->json([
            'success' => true,
            'message' => 'Tenant reativado com sucesso.',
        ]);
    }

    // ==========================================
    // AI COSTS & USAGE
    // ==========================================

    /**
     * Métricas detalhadas de uso de IA por tenant.
     */
    public function aiUsageByTenant(Request $request): JsonResponse
    {
        $period = $request->get('period', 'month'); // day, week, month, year
        
        $startDate = match($period) {
            'day' => now()->startOfDay(),
            'week' => now()->startOfWeek(),
            'month' => now()->startOfMonth(),
            'year' => now()->startOfYear(),
            default => now()->startOfMonth(),
        };

        $usage = DB::table('ai_token_usage')
            ->select(
                'tenant_id',
                DB::raw('SUM(prompt_tokens) as input_tokens'),
                DB::raw('SUM(completion_tokens) as output_tokens'),
                DB::raw('SUM(total_tokens) as total_tokens'),
                DB::raw('COUNT(*) as total_requests'),
                DB::raw('SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) as cache_hits')
            )
            ->where('usage_date', '>=', $startDate->toDateString())
            ->groupBy('tenant_id')
            ->orderByDesc('total_tokens')
            ->get();

        // Enriquecer com dados do tenant
        $usage = $usage->map(function ($item) {
            $tenant = Tenant::find($item->tenant_id);
            $item->tenant_name = $tenant?->name ?? 'Desconhecido';
            $item->tenant_email = $tenant?->email;
            $item->cost_usd = $this->calculateAICostDetailed($item->input_tokens, $item->output_tokens);
            $item->cost_brl = round($item->cost_usd * 5, 2);
            $item->cache_rate = $item->total_requests > 0 
                ? round(($item->cache_hits / $item->total_requests) * 100, 1) 
                : 0;
            return $item;
        });

        // Totais
        $totals = [
            'input_tokens' => $usage->sum('input_tokens'),
            'output_tokens' => $usage->sum('output_tokens'),
            'total_tokens' => $usage->sum('total_tokens'),
            'total_requests' => $usage->sum('total_requests'),
            'total_cost_usd' => $usage->sum('cost_usd'),
            'total_cost_brl' => $usage->sum('cost_brl'),
            'avg_cache_rate' => round($usage->avg('cache_rate'), 1),
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'tenants' => $usage,
                'totals' => $totals,
                'period' => $period,
                'start_date' => $startDate->toISOString(),
            ],
        ]);
    }

    /**
     * Projeção de custos futuros.
     */
    public function aiCostProjection(): JsonResponse
    {
        // Uso dos últimos 30 dias
        $last30Days = DB::table('ai_usage_logs')
            ->where('created_at', '>=', now()->subDays(30))
            ->select(
                DB::raw('SUM(prompt_tokens) as input_tokens'),
                DB::raw('SUM(completion_tokens) as output_tokens'),
                DB::raw('COUNT(*) as requests')
            )
            ->first();

        $dailyAvgInput = ($last30Days->input_tokens ?? 0) / 30;
        $dailyAvgOutput = ($last30Days->output_tokens ?? 0) / 30;
        $dailyAvgRequests = ($last30Days->requests ?? 0) / 30;

        // Projeção mensal
        $monthlyInput = $dailyAvgInput * 30;
        $monthlyOutput = $dailyAvgOutput * 30;
        $monthlyCost = $this->calculateAICostDetailed($monthlyInput, $monthlyOutput);

        // Projeção com crescimento (assumindo 10% de crescimento mensal)
        $growthRate = 1.10;
        $projections = [];
        
        for ($i = 1; $i <= 6; $i++) {
            $factor = pow($growthRate, $i);
            $projections[] = [
                'month' => now()->addMonths($i)->format('M/Y'),
                'input_tokens' => round($monthlyInput * $factor),
                'output_tokens' => round($monthlyOutput * $factor),
                'cost_usd' => round($monthlyCost * $factor, 2),
                'cost_brl' => round($monthlyCost * $factor * 5, 2),
            ];
        }

        return response()->json([
            'success' => true,
            'data' => [
                'current_month' => [
                    'input_tokens' => round($monthlyInput),
                    'output_tokens' => round($monthlyOutput),
                    'requests' => round($dailyAvgRequests * 30),
                    'cost_usd' => round($monthlyCost, 2),
                    'cost_brl' => round($monthlyCost * 5, 2),
                ],
                'daily_average' => [
                    'input_tokens' => round($dailyAvgInput),
                    'output_tokens' => round($dailyAvgOutput),
                    'requests' => round($dailyAvgRequests),
                ],
                'projections' => $projections,
            ],
        ]);
    }

    /**
     * Top recursos mais usados de IA.
     */
    public function aiTopFeatures(Request $request): JsonResponse
    {
        $period = $request->get('period', 'month');
        
        $startDate = match($period) {
            'day' => now()->startOfDay(),
            'week' => now()->startOfWeek(),
            'month' => now()->startOfMonth(),
            default => now()->startOfMonth(),
        };

        $features = DB::table('ai_token_usage')
            ->select(
                'feature',
                DB::raw('SUM(total_tokens) as total_tokens'),
                DB::raw('COUNT(*) as requests'),
                DB::raw('AVG(response_time_ms) as avg_response_time')
            )
            ->where('usage_date', '>=', $startDate->toDateString())
            ->groupBy('feature')
            ->orderByDesc('total_tokens')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $features,
        ]);
    }

    // ==========================================
    // SUBSCRIPTIONS MANAGEMENT
    // ==========================================

    /**
     * Listar todas as subscriptions.
     */
    public function listSubscriptions(Request $request): JsonResponse
    {
        $query = Subscription::with(['tenant', 'plan']);

        if ($request->has('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->whereHas('tenant', function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                    ->orWhere('email', 'ilike', "%{$search}%");
            });
        }

        $subscriptions = $query->orderByDesc('created_at')
            ->paginate($request->get('per_page', 20));

        // Calcular totais
        $total = Subscription::count();
        $active = Subscription::where('status', 'active')->count();
        $trial = Subscription::where('status', 'trial')->count();
        $cancelled = Subscription::where('status', 'cancelled')->count();
        
        $monthlyRevenue = 0;
        try {
            $monthlyRevenue = Subscription::where('status', 'active')
                ->join('plans', 'subscriptions.plan_id', '=', 'plans.id')
                ->sum('plans.price');
        } catch (\Exception $e) {
            // Ignore if price column doesn't exist
        }

        // Transformar dados para incluir tenant_name e plan_name
        $data = $subscriptions->getCollection()->map(function ($sub) {
            return [
                'id' => $sub->id,
                'tenant_id' => $sub->tenant_id,
                'tenant_name' => $sub->tenant?->name ?? 'Desconhecido',
                'plan_name' => $sub->plan?->name ?? 'Free',
                'price' => $sub->plan?->price ?? 0,
                'status' => $sub->status,
                'started_at' => $sub->starts_at,
                'expires_at' => $sub->expires_at,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $data,
            'totals' => [
                'total' => $total,
                'active' => $active,
                'trial' => $trial,
                'cancelled' => $cancelled,
                'monthly_revenue' => $monthlyRevenue,
            ],
            'meta' => [
                'current_page' => $subscriptions->currentPage(),
                'last_page' => $subscriptions->lastPage(),
                'per_page' => $subscriptions->perPage(),
                'total' => $subscriptions->total(),
            ],
        ]);
    }

    /**
     * Alterar plano de um tenant manualmente.
     */
    public function changeTenantPlan(Request $request, string $tenantId): JsonResponse
    {
        $request->validate([
            'plan_id' => 'required|uuid|exists:plans,id',
        ]);

        $tenant = Tenant::findOrFail($tenantId);
        $newPlan = Plan::findOrFail($request->plan_id);

        $oldSubscription = $tenant->subscription;
        $oldPlan = $oldSubscription?->plan;

        // Cancelar subscription antiga
        if ($oldSubscription) {
            $oldSubscription->update(['status' => 'cancelled', 'cancelled_at' => now()]);
        }

        // Criar nova subscription
        $subscription = Subscription::create([
            'tenant_id' => $tenant->id,
            'plan_id' => $newPlan->id,
            'status' => 'active',
            'starts_at' => now(),
            'expires_at' => now()->addMonth(),
        ]);

        AdminAuditLog::log('change_plan', 'tenant', $tenantId, 
            ['old_plan' => $oldPlan?->name], 
            ['new_plan' => $newPlan->name]
        );

        return response()->json([
            'success' => true,
            'message' => "Plano alterado para {$newPlan->name}.",
            'data' => $subscription->load('plan'),
        ]);
    }

    // ==========================================
    // AUDIT LOGS
    // ==========================================

    /**
     * Listar logs de auditoria.
     */
    public function auditLogs(Request $request): JsonResponse
    {
        $query = AdminAuditLog::with('user:id,name,email');

        if ($request->has('action') && $request->action !== 'all') {
            $query->where('action', $request->action);
        }

        if ($request->has('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('action', 'ilike', "%{$search}%")
                    ->orWhereHas('user', function ($u) use ($search) {
                        $u->where('name', 'ilike', "%{$search}%");
                    });
            });
        }

        $logs = $query->orderByDesc('created_at')
            ->paginate($request->get('per_page', 50));

        // Transformar dados para incluir user_name
        $data = $logs->getCollection()->map(function ($log) {
            return [
                'id' => $log->id,
                'user_id' => $log->user_id,
                'user_name' => $log->user?->name ?? 'Sistema',
                'action' => $log->action,
                'entity_type' => $log->entity_type,
                'entity_id' => $log->entity_id,
                'old_values' => $log->old_values,
                'new_values' => $log->new_values,
                'ip_address' => $log->ip_address,
                'created_at' => $log->created_at,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $data,
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'total' => $logs->total(),
            ],
        ]);
    }

    // ==========================================
    // SUPER ADMIN MANAGEMENT
    // ==========================================

    /**
     * Listar super admins.
     */
    public function listSuperAdmins(): JsonResponse
    {
        $admins = User::where('is_super_admin', true)->get();

        return response()->json([
            'success' => true,
            'data' => $admins,
        ]);
    }

    /**
     * Adicionar super admin.
     */
    public function addSuperAdmin(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email|exists:users,email',
        ]);

        $user = User::where('email', $request->email)->firstOrFail();
        $user->update(['is_super_admin' => true]);

        AdminAuditLog::log('add_super_admin', 'user', $user->id);

        return response()->json([
            'success' => true,
            'message' => "{$user->name} agora é um Super Admin.",
        ]);
    }

    /**
     * Remover super admin.
     */
    public function removeSuperAdmin(string $userId): JsonResponse
    {
        $user = User::findOrFail($userId);

        // Não permitir remover o último super admin
        $superAdminCount = User::where('is_super_admin', true)->count();
        if ($superAdminCount <= 1) {
            return response()->json([
                'success' => false,
                'message' => 'Não é possível remover o último Super Admin.',
            ], 400);
        }

        $user->update(['is_super_admin' => false]);

        AdminAuditLog::log('remove_super_admin', 'user', $user->id);

        return response()->json([
            'success' => true,
            'message' => "{$user->name} não é mais um Super Admin.",
        ]);
    }

    // ==========================================
    // HELPER METHODS
    // ==========================================

    private function calculateAICost(int $tokens): float
    {
        // Média entre input e output (assumindo distribuição 60/40)
        $inputTokens = $tokens * 0.6;
        $outputTokens = $tokens * 0.4;
        
        return $this->calculateAICostDetailed($inputTokens, $outputTokens);
    }

    private function calculateAICostDetailed(float $inputTokens, float $outputTokens): float
    {
        // Preços Groq llama-3.3-70b-versatile
        $inputPricePerMillion = 0.59;
        $outputPricePerMillion = 0.79;

        $inputCost = ($inputTokens / 1_000_000) * $inputPricePerMillion;
        $outputCost = ($outputTokens / 1_000_000) * $outputPricePerMillion;

        return round($inputCost + $outputCost, 4);
    }

    private function getTenantAIUsage(string $tenantId): int
    {
        try {
            return (int) DB::table('ai_token_usage')
                ->where('tenant_id', $tenantId)
                ->where('year_month', (int) now()->format('Ym'))
                ->sum('total_tokens');
        } catch (\Exception $e) {
            return 0;
        }
    }

    private function getTenantAIUsageDetailed(string $tenantId): array
    {
        $usage = DB::table('ai_token_usage')
            ->where('tenant_id', $tenantId)
            ->where('year_month', (int) now()->format('Ym'))
            ->select(
                DB::raw('SUM(prompt_tokens) as input_tokens'),
                DB::raw('SUM(completion_tokens) as output_tokens'),
                DB::raw('SUM(total_tokens) as total_tokens'),
                DB::raw('COUNT(*) as requests'),
                DB::raw('SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) as cache_hits')
            )
            ->first();

        $inputTokens = $usage->input_tokens ?? 0;
        $outputTokens = $usage->output_tokens ?? 0;

        return [
            'input_tokens' => $inputTokens,
            'output_tokens' => $outputTokens,
            'total_tokens' => $usage->total_tokens ?? 0,
            'requests' => $usage->requests ?? 0,
            'cache_hits' => $usage->cache_hits ?? 0,
            'cost_usd' => $this->calculateAICostDetailed($inputTokens, $outputTokens),
        ];
    }

    /**
     * Get tenant computed status for display.
     */
    private function getTenantStatus(Tenant $tenant): string
    {
        // Suspended manually by admin
        if ($tenant->suspended_at !== null) {
            return 'suspended';
        }

        // Not active
        if (!$tenant->is_active) {
            return 'suspended';
        }

        // Check subscription
        $subscription = $tenant->subscription;
        if (!$subscription) {
            return 'no_subscription';
        }

        // Suspended subscription
        if ($subscription->status === Subscription::STATUS_SUSPENDED) {
            return 'suspended';
        }

        // Active subscription
        if ($subscription->status === Subscription::STATUS_ACTIVE) {
            return 'active';
        }

        // Trial subscription
        if ($subscription->status === Subscription::STATUS_TRIAL) {
            return 'trial';
        }

        // Expired/other
        return 'expired';
    }

    /**
     * Get subscription status label for display.
     */
    private function getSubscriptionStatusLabel(Tenant $tenant): string
    {
        $subscription = $tenant->subscription;

        if (!$subscription) {
            return 'Sem assinatura';
        }

        if ($subscription->status === 'trial') {
            $daysRemaining = $subscription->trialDaysRemaining();
            return "Trial ({$daysRemaining} dias restantes)";
        }

        if ($subscription->status === 'active') {
            return 'Ativo';
        }

        if ($subscription->status === 'expired') {
            return 'Expirado';
        }

        return ucfirst($subscription->status);
    }
}
