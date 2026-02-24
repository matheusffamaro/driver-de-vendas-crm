<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\Product;
use App\Models\PipelineCard;
use App\Models\CrmTask;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    /**
     * Apply user filter for sales role
     */
    private function applyUserFilter($query, $user, string $userField = 'assigned_to')
    {
        // Admin and Manager see all data
        if ($user->isAdmin() || $user->isManager()) {
            return $query;
        }

        // Sales only see their own data
        return $query->where($userField, $user->id);
    }

    public function dashboard(Request $request): JsonResponse
    {
        $period = $request->get('period', 'month');
        $startDate = $this->getStartDate($period);
        
        // SECURITY: Get tenant
        $user = $request->user();
        $tenantId = $user->tenant_id;

        // Cards metrics - filter by tenant through pipeline AND by user for sales
        $cardsWonQuery = PipelineCard::whereHas('pipeline', fn($q) => $q->where('tenant_id', $tenantId))
            ->whereNotNull('won_at')
            ->where('won_at', '>=', $startDate);
        $cardsWon = $this->applyUserFilter(clone $cardsWonQuery, $user)->count();

        $cardsLostQuery = PipelineCard::whereHas('pipeline', fn($q) => $q->where('tenant_id', $tenantId))
            ->whereNotNull('lost_at')
            ->where('lost_at', '>=', $startDate);
        $cardsLost = $this->applyUserFilter(clone $cardsLostQuery, $user)->count();

        $totalValueQuery = PipelineCard::whereHas('pipeline', fn($q) => $q->where('tenant_id', $tenantId))
            ->whereNotNull('won_at')
            ->where('won_at', '>=', $startDate);
        $totalValue = $this->applyUserFilter(clone $totalValueQuery, $user)->sum('value');

        $activeCardsQuery = PipelineCard::whereHas('pipeline', fn($q) => $q->where('tenant_id', $tenantId))
            ->whereNull('won_at')
            ->whereNull('lost_at');
        $activeCards = $this->applyUserFilter(clone $activeCardsQuery, $user)->count();

        // Clients - filter by tenant AND by responsible_user_id for sales
        $newClientsQuery = Client::where('tenant_id', $tenantId)
            ->where('created_at', '>=', $startDate);
        $newClients = $this->applyUserFilter(clone $newClientsQuery, $user, 'responsible_user_id')->count();

        $totalClientsQuery = Client::where('tenant_id', $tenantId);
        $totalClients = $this->applyUserFilter(clone $totalClientsQuery, $user, 'responsible_user_id')->count();

        // Tasks - filter by assigned_to for sales
        $pendingTasksQuery = CrmTask::where('status', 'pending')
            ->where(function($q) use ($tenantId) {
                $q->whereHas('card.pipeline', fn($p) => $p->where('tenant_id', $tenantId))
                  ->orWhereHas('contact', fn($c) => $c->where('tenant_id', $tenantId));
            });
        $pendingTasks = $this->applyUserFilter(clone $pendingTasksQuery, $user, 'assigned_to')->count();

        $completedTasksQuery = CrmTask::where('status', 'completed')
            ->where('completed_at', '>=', $startDate)
            ->where(function($q) use ($tenantId) {
                $q->whereHas('card.pipeline', fn($p) => $p->where('tenant_id', $tenantId))
                  ->orWhereHas('contact', fn($c) => $c->where('tenant_id', $tenantId));
            });
        $completedTasks = $this->applyUserFilter(clone $completedTasksQuery, $user, 'assigned_to')->count();

        return response()->json([
            'success' => true,
            'data' => [
                'cards' => [
                    'won' => $cardsWon,
                    'lost' => $cardsLost,
                    'active' => $activeCards,
                    'total_value' => $totalValue,
                ],
                'clients' => [
                    'new' => $newClients,
                    'total' => $totalClients,
                ],
                'tasks' => [
                    'pending' => $pendingTasks,
                    'completed' => $completedTasks,
                ],
            ],
        ]);
    }

    public function sales(Request $request): JsonResponse
    {
        $startDate = $request->get('start_date', Carbon::now()->startOfMonth()->toDateString());
        $endDate = $request->get('end_date', Carbon::now()->toDateString());
        
        // SECURITY: Get tenant
        $user = $request->user();
        $tenantId = $user->tenant_id;

        // Sales by day - filter by user for sales role
        $salesByDayQuery = PipelineCard::whereHas('pipeline', fn($q) => $q->where('tenant_id', $tenantId))
            ->whereNotNull('won_at')
            ->whereBetween('won_at', [$startDate, $endDate]);
        $salesByDay = $this->applyUserFilter(clone $salesByDayQuery, $user)
            ->selectRaw('DATE(won_at) as date, COUNT(*) as count, SUM(value) as total')
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        // Sales by stage - filter by user for sales role
        $salesByStageQuery = DB::table('pipeline_cards')
            ->join('pipeline_stages', 'pipeline_cards.stage_id', '=', 'pipeline_stages.id')
            ->join('pipelines', 'pipeline_stages.pipeline_id', '=', 'pipelines.id')
            ->where('pipelines.tenant_id', $tenantId)
            ->whereNull('pipeline_cards.deleted_at');
        
        if (!$user->isAdmin() && !$user->isManager()) {
            $salesByStageQuery->where('pipeline_cards.assigned_to', $user->id);
        }
        
        $salesByStage = $salesByStageQuery
            ->selectRaw('pipeline_stages.name as stage, COUNT(*) as count, SUM(pipeline_cards.value) as total')
            ->groupBy('pipeline_stages.id', 'pipeline_stages.name')
            ->get();

        // Top sellers - only show for admin/manager
        // Sales users don't see ranking of other sellers
        $topSellers = [];
        if ($user->isAdmin() || $user->isManager()) {
            $topSellers = PipelineCard::whereHas('pipeline', fn($q) => $q->where('tenant_id', $tenantId))
                ->whereNotNull('won_at')
                ->whereBetween('won_at', [$startDate, $endDate])
                ->with('assignedTo:id,name')
                ->selectRaw('assigned_to, COUNT(*) as count, SUM(value) as total')
                ->groupBy('assigned_to')
                ->orderByDesc('total')
                ->limit(10)
                ->get();
        }

        return response()->json([
            'success' => true,
            'data' => [
                'by_day' => $salesByDay,
                'by_stage' => $salesByStage,
                'top_sellers' => $topSellers, // Empty for sales role
            ],
        ]);
    }

    public function clients(Request $request): JsonResponse
    {
        $startDate = $request->get('start_date', Carbon::now()->startOfMonth()->toDateString());
        $endDate = $request->get('end_date', Carbon::now()->toDateString());
        
        // SECURITY: Get tenant
        $user = $request->user();
        $tenantId = $user->tenant_id;

        // Clients by day - filter by responsible_user_id for sales
        $clientsByDayQuery = Client::where('tenant_id', $tenantId)
            ->whereBetween('created_at', [$startDate, $endDate]);
        $clientsByDay = $this->applyUserFilter(clone $clientsByDayQuery, $user, 'responsible_user_id')
            ->selectRaw('DATE(created_at) as date, COUNT(*) as count')
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        // Top clients - filter by responsible_user_id for sales
        $topClientsQuery = Client::where('tenant_id', $tenantId);
        $topClients = $this->applyUserFilter(clone $topClientsQuery, $user, 'responsible_user_id')
            ->withCount('pipelineCards')
            ->withSum(['pipelineCards' => function ($q) {
                $q->whereNotNull('won_at');
            }], 'value')
            ->orderByDesc('pipeline_cards_sum_value')
            ->limit(10)
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'by_day' => $clientsByDay,
                'top_clients' => $topClients,
            ],
        ]);
    }

    public function products(Request $request): JsonResponse
    {
        $startDate = $request->get('start_date', Carbon::now()->startOfMonth()->toDateString());
        $endDate = $request->get('end_date', Carbon::now()->toDateString());
        
        // SECURITY: Get tenant
        $user = $request->user();
        $tenantId = $user->tenant_id;

        // Top products - filter by assigned cards for sales
        $topProductsQuery = DB::table('pipeline_card_products')
            ->join('products', 'pipeline_card_products.product_id', '=', 'products.id')
            ->join('pipeline_cards', 'pipeline_card_products.card_id', '=', 'pipeline_cards.id')
            ->join('pipeline_stages', 'pipeline_cards.stage_id', '=', 'pipeline_stages.id')
            ->join('pipelines', 'pipeline_stages.pipeline_id', '=', 'pipelines.id')
            ->where('pipelines.tenant_id', $tenantId)
            ->where('products.tenant_id', $tenantId)
            ->whereNotNull('pipeline_cards.won_at')
            ->whereBetween('pipeline_cards.won_at', [$startDate, $endDate]);
        
        // Sales only see products from their cards
        if (!$user->isAdmin() && !$user->isManager()) {
            $topProductsQuery->where('pipeline_cards.assigned_to', $user->id);
        }
        
        $topProducts = $topProductsQuery
            ->selectRaw('products.id, products.name, SUM(pipeline_card_products.quantity) as quantity, SUM(pipeline_card_products.total) as total')
            ->groupBy('products.id', 'products.name')
            ->orderByDesc('total')
            ->limit(10)
            ->get();

        // Products by category - everyone sees all categories (catalog view)
        $productsByCategory = DB::table('products')
            ->leftJoin('product_categories', 'products.category_id', '=', 'product_categories.id')
            ->where('products.tenant_id', $tenantId)
            ->whereNull('products.deleted_at')
            ->selectRaw('COALESCE(product_categories.name, \'Sem categoria\') as category, COUNT(*) as count')
            ->groupBy('product_categories.id', 'product_categories.name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'top_products' => $topProducts, // Filtered for sales
                'by_category' => $productsByCategory, // All products
            ],
        ]);
    }

    private function getStartDate(string $period): Carbon
    {
        return match ($period) {
            'week' => Carbon::now()->startOfWeek(),
            'month' => Carbon::now()->startOfMonth(),
            'quarter' => Carbon::now()->startOfQuarter(),
            'year' => Carbon::now()->startOfYear(),
            default => Carbon::now()->startOfMonth(),
        };
    }
}
