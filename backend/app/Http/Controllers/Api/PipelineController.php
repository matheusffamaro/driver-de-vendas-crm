<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pipeline;
use App\Models\PipelineStage;
use App\Models\PipelineCard;
use App\Models\PipelineCardAttachment;
use App\Models\PipelineCardComment;
use App\Models\PipelineCardHistory;
use App\Models\PipelineCardProduct;
use App\Models\PipelineCustomField;
use App\Services\AIService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class PipelineController extends Controller
{
    /**
     * List all pipelines.
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;
        
        // Auto-create default pipeline if none exists for this tenant
        if (Pipeline::forTenant($tenantId)->count() === 0) {
            $this->createDefaultPipeline($tenantId);
        }
        
        $pipelines = Pipeline::query()
            ->forTenant($tenantId)
            ->with([
                'stages' => fn($q) => $q->orderBy('position')->withCount('cards'),
                'customFields' => fn($q) => $q->orderBy('position'),
            ])
            ->withCount('cards')
            ->when($request->has('active_only'), fn($q) => $q->where('is_active', true))
            ->orderBy('is_default', 'desc')
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $pipelines,
        ]);
    }
    
    /**
     * Create default pipeline.
     */
    private function createDefaultPipeline(string $tenantId): Pipeline
    {
        if (!$tenantId) {
            throw new \Exception('tenant_id is required');
        }
        
        DB::beginTransaction();
        try {
            $pipeline = Pipeline::create([
                'id' => Str::uuid(),
                'tenant_id' => $tenantId,
                'name' => 'Funil de Vendas',
                'description' => 'Funil de vendas padrão',
                'is_default' => true,
                'is_active' => true,
            ]);

            $stages = [
                ['name' => 'Novo contato', 'color' => '#10B981', 'position' => 0],
                ['name' => 'Em contato', 'color' => '#3B82F6', 'position' => 1],
                ['name' => 'Apresentação', 'color' => '#8B5CF6', 'position' => 2],
                ['name' => 'Negociação', 'color' => '#F59E0B', 'position' => 3],
                ['name' => 'Ganho', 'color' => '#22C55E', 'position' => 4, 'is_won' => true],
                ['name' => 'Perdido', 'color' => '#EF4444', 'position' => 5, 'is_lost' => true],
            ];

            foreach ($stages as $stage) {
                PipelineStage::create([
                    'id' => Str::uuid(),
                    'pipeline_id' => $pipeline->id,
                    ...$stage,
                ]);
            }

            DB::commit();
            return $pipeline;
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Store a new pipeline.
     */
    public function store(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;
        $tenant = \App\Models\Tenant::find($tenantId);
        
        // Check addon limit
        $canAdd = $tenant->canAddPipeline();
        if (!$canAdd['allowed']) {
            return response()->json([
                'success' => false,
                'message' => $canAdd['message'],
            ], 403);
        }
        
        $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'is_default' => 'boolean',
        ]);

        DB::beginTransaction();
        try {
            if ($request->boolean('is_default')) {
                Pipeline::forTenant($tenantId)
                    ->where('is_default', true)
                    ->update(['is_default' => false]);
            }

            $pipeline = Pipeline::create([
                'id' => Str::uuid(),
                'tenant_id' => $tenantId,
                'name' => $request->name,
                'description' => $request->description,
                'is_default' => $request->boolean('is_default'),
                'is_active' => true,
            ]);

            // Create default stages
            $stages = [
                ['name' => 'Novo', 'color' => '#10B981', 'position' => 0],
                ['name' => 'Em andamento', 'color' => '#3B82F6', 'position' => 1],
                ['name' => 'Ganho', 'color' => '#22C55E', 'position' => 2, 'is_won' => true],
                ['name' => 'Perdido', 'color' => '#EF4444', 'position' => 3, 'is_lost' => true],
            ];

            foreach ($stages as $stage) {
                PipelineStage::create([
                    'id' => Str::uuid(),
                    'pipeline_id' => $pipeline->id,
                    ...$stage,
                ]);
            }

            // Update usage
            $tenant->updatePipelinesCount();
            $usage = \App\Models\PipelineAddonUsage::getCurrentMonthUsage($tenantId);
            $usage->pipelines_count = $tenant->pipelines_count;
            $usage->additional_pipelines = max(0, $tenant->pipelines_count - 1);
            $usage->updateCost();

            DB::commit();

            return response()->json([
                'success' => true,
                'data' => $pipeline->load('stages'),
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Show a pipeline.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $pipeline = Pipeline::with([
            'stages' => fn($q) => $q->orderBy('position'),
            'customFields' => fn($q) => $q->orderBy('position'),
        ])->findOrFail($id);

        // Check ownership
        if (!$pipeline->isOwnedBy($request->user()->tenant_id)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        return response()->json([
            'success' => true,
            'data' => $pipeline,
        ]);
    }

    /**
     * Update a pipeline.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $pipeline = Pipeline::findOrFail($id);

        // Check ownership
        if (!$pipeline->isOwnedBy($request->user()->tenant_id)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'sometimes|nullable|string',
            'is_default' => 'sometimes|boolean',
            'is_active' => 'sometimes|boolean',
        ]);

        if ($request->boolean('is_default') && !$pipeline->is_default) {
            Pipeline::forTenant($request->user()->tenant_id)
                ->where('is_default', true)
                ->update(['is_default' => false]);
        }

        $pipeline->update($request->only(['name', 'description', 'is_default', 'is_active']));

        return response()->json([
            'success' => true,
            'data' => $pipeline->fresh()->load('stages'),
        ]);
    }

    /**
     * Delete a pipeline.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $pipeline = Pipeline::findOrFail($id);

        // Check ownership
        if (!$pipeline->isOwnedBy($request->user()->tenant_id)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        if ($pipeline->is_default) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete default pipeline',
            ], 400);
        }

        $tenant = $pipeline->tenant;
        $pipeline->delete();
        
        // Update usage
        $tenant->updatePipelinesCount();
        $usage = \App\Models\PipelineAddonUsage::getCurrentMonthUsage($tenant->id);
        $usage->pipelines_count = $tenant->pipelines_count;
        $usage->additional_pipelines = max(0, $tenant->pipelines_count - 1);
        $usage->updateCost();

        return response()->json([
            'success' => true,
            'message' => 'Pipeline deleted successfully',
        ]);
    }

    /**
     * Update pipeline stages.
     */
    public function updateStages(Request $request, string $id): JsonResponse
    {
        $pipeline = Pipeline::findOrFail($id);

        $request->validate([
            'stages' => 'required|array',
            'stages.*.id' => 'nullable|uuid',
            'stages.*.name' => 'required|string|max:255',
            'stages.*.color' => 'nullable|string|max:7',
            'stages.*.position' => 'required|integer|min:0',
            'stages.*.is_won' => 'boolean',
            'stages.*.is_lost' => 'boolean',
        ]);

        DB::beginTransaction();
        try {
            $existingIds = [];

            foreach ($request->stages as $stageData) {
                if (!empty($stageData['id'])) {
                    $stage = PipelineStage::find($stageData['id']);
                    if ($stage) {
                        $stage->update([
                            'name' => $stageData['name'],
                            'color' => $stageData['color'] ?? $stage->color,
                            'position' => $stageData['position'],
                            'is_won' => $stageData['is_won'] ?? false,
                            'is_lost' => $stageData['is_lost'] ?? false,
                        ]);
                        $existingIds[] = $stage->id;
                    }
                } else {
                    $stage = PipelineStage::create([
                        'id' => Str::uuid(),
                        'pipeline_id' => $pipeline->id,
                        'name' => $stageData['name'],
                        'color' => $stageData['color'] ?? '#6B7280',
                        'position' => $stageData['position'],
                        'is_won' => $stageData['is_won'] ?? false,
                        'is_lost' => $stageData['is_lost'] ?? false,
                    ]);
                    $existingIds[] = $stage->id;
                }
            }

            // Delete removed stages
            PipelineStage::where('pipeline_id', $pipeline->id)
                ->whereNotIn('id', $existingIds)
                ->delete();

            DB::commit();

            return response()->json([
                'success' => true,
                'data' => $pipeline->fresh()->load('stages'),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Update pipeline custom fields.
     */
    public function updateCustomFields(Request $request, string $id): JsonResponse
    {
        $pipeline = Pipeline::findOrFail($id);

        \Log::info('updateCustomFields called', [
            'pipeline_id' => $id,
            'fields_count' => count($request->fields ?? []),
            'fields' => $request->fields,
        ]);

        $request->validate([
            'fields' => 'present|array',
            'fields.*.id' => 'nullable|string',
            'fields.*.name' => 'required|string|max:255',
            'fields.*.field_key' => 'required|string|max:255',
            'fields.*.type' => 'required|string|in:text,textarea,number,money,date,select,multiselect,checkbox,phone,email,url',
            'fields.*.options' => 'nullable|array',
            'fields.*.is_required' => 'boolean',
            'fields.*.position' => 'integer|min:0',
        ]);

        DB::beginTransaction();
        try {
            $existingIds = [];

            foreach ($request->fields as $fieldData) {
                $fieldId = $fieldData['id'] ?? null;
                
                // Check if it's a valid UUID (not temporary ID)
                $isValidUuid = $fieldId && !str_starts_with($fieldId, 'temp-') && 
                               preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $fieldId);
                
                if ($isValidUuid) {
                    $field = PipelineCustomField::find($fieldId);
                    if ($field) {
                        $field->update([
                            'name' => $fieldData['name'],
                            'field_key' => $fieldData['field_key'],
                            'type' => $fieldData['type'],
                            'options' => $fieldData['options'] ?? null,
                            'is_required' => $fieldData['is_required'] ?? false,
                            'position' => $fieldData['position'] ?? 0,
                        ]);
                        $existingIds[] = $field->id;
                    }
                } else {
                    // Create new field
                    $field = PipelineCustomField::create([
                        'id' => Str::uuid(),
                        'pipeline_id' => $pipeline->id,
                        'name' => $fieldData['name'],
                        'field_key' => $fieldData['field_key'],
                        'type' => $fieldData['type'],
                        'options' => $fieldData['options'] ?? null,
                        'is_required' => $fieldData['is_required'] ?? false,
                        'position' => $fieldData['position'] ?? 0,
                    ]);
                    $existingIds[] = $field->id;
                }
            }

            PipelineCustomField::where('pipeline_id', $pipeline->id)
                ->whereNotIn('id', $existingIds)
                ->delete();

            DB::commit();

            $pipeline->load('customFields');
            
            return response()->json([
                'success' => true,
                'data' => $pipeline,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Error updating custom fields', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Erro ao salvar campos: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get pipeline report.
     * Query params: start_date, end_date, assigned_to (filter by vendedor), by_salesperson (1 = include breakdown per salesperson, admin/manager only).
     */
    public function report(Request $request, string $id): JsonResponse
    {
        $pipeline = Pipeline::with(['stages' => fn($q) => $q->orderBy('position')])->findOrFail($id);

        if (!$pipeline->isOwnedBy($request->user()->tenant_id)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $user = $request->user();
        $assignedTo = $request->get('assigned_to'); // filter by vendedor (user id)
        $bySalesperson = $request->boolean('by_salesperson'); // admin/manager: return per-salesperson breakdown

        // Only admin/manager can filter by another user or request by_salesperson
        if (!$user->isAdmin() && !$user->isManager()) {
            $assignedTo = $user->id;
            $bySalesperson = false;
        }

        $baseQuery = fn() => PipelineCard::where('pipeline_id', $id);
        $applyAssigned = function ($q) use ($assignedTo) {
            if ($assignedTo) {
                $q->where('assigned_to', $assignedTo);
            }
            return $q;
        };

        // Get date range (default to all time if not specified)
        $startDate = $request->get('start_date');
        $endDate = $request->get('end_date');

        // Count cards by stage
        $cardsByStageQuery = $baseQuery();
        $applyAssigned($cardsByStageQuery);
        $cardsByStage = $cardsByStageQuery
            ->selectRaw('stage_id, COUNT(*) as count, COALESCE(SUM(value), 0) as total_value')
            ->groupBy('stage_id')
            ->get()
            ->keyBy('stage_id');

        $totalCardsQuery = $baseQuery();
        $applyAssigned($totalCardsQuery);
        $totalCards = $totalCardsQuery->count();

        $wonStageIds = $pipeline->stages->where('is_won', true)->pluck('id');
        $lostStageIds = $pipeline->stages->where('is_lost', true)->pluck('id');

        $wonCardsQuery = $baseQuery()->whereIn('stage_id', $wonStageIds);
        $applyAssigned($wonCardsQuery);
        $lostCardsQuery = $baseQuery()->whereIn('stage_id', $lostStageIds);
        $applyAssigned($lostCardsQuery);

        if ($startDate && $endDate) {
            $wonCardsQuery->whereBetween('updated_at', [$startDate, $endDate]);
            $lostCardsQuery->whereBetween('updated_at', [$startDate, $endDate]);
        }

        $wonCards = $wonCardsQuery->count();
        $lostCards = $lostCardsQuery->count();

        $wonValueQuery = $baseQuery()->whereIn('stage_id', $wonStageIds);
        $applyAssigned($wonValueQuery);
        $wonValue = $wonValueQuery->sum('value') ?? 0;

        $totalPipelineValueQuery = $baseQuery();
        $applyAssigned($totalPipelineValueQuery);
        $totalPipelineValue = $totalPipelineValueQuery->sum('value') ?? 0;

        $stageDistribution = $pipeline->stages->map(function ($stage) use ($cardsByStage) {
            $stageData = $cardsByStage->get($stage->id);
            return [
                'id' => $stage->id,
                'name' => $stage->name,
                'color' => $stage->color,
                'is_won' => $stage->is_won,
                'is_lost' => $stage->is_lost,
                'cards_count' => $stageData?->count ?? 0,
                'total_value' => (float) ($stageData?->total_value ?? 0),
            ];
        });

        $data = [
            'pipeline' => $pipeline,
            'by_stage' => $cardsByStage,
            'stage_distribution' => $stageDistribution,
            'total_cards' => $totalCards,
            'won_cards' => $wonCards,
            'lost_cards' => $lostCards,
            'total_value' => (float) $wonValue,
            'total_pipeline_value' => (float) $totalPipelineValue,
            'conversion_rate' => $totalCards > 0
                ? round(($wonCards / $totalCards) * 100, 2)
                : 0,
        ];

        if ($bySalesperson && ($user->isAdmin() || $user->isManager())) {
            $data['by_salesperson'] = $this->reportBySalesperson($id, $pipeline, $startDate, $endDate);
        }

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    /**
     * Build per-salesperson report for the pipeline (admin/manager only).
     */
    private function reportBySalesperson(string $pipelineId, Pipeline $pipeline, ?string $startDate, ?string $endDate): array
    {
        $wonStageIds = $pipeline->stages->where('is_won', true)->pluck('id')->all();
        $lostStageIds = $pipeline->stages->where('is_lost', true)->pluck('id')->all();
        $wonOrLostIds = array_unique(array_merge($wonStageIds, $lostStageIds));

        $query = PipelineCard::where('pipeline_id', $pipelineId)
            ->select('assigned_to', 'stage_id', 'value');

        if ($startDate && $endDate) {
            $query->whereBetween('updated_at', [$startDate, $endDate]);
        }

        $cards = $query->get();
        $byUser = $cards->groupBy('assigned_to');

        $userIds = $byUser->keys()->filter()->unique()->values()->all();
        $users = $userIds ? \App\Models\User::whereIn('id', $userIds)->get()->keyBy('id') : collect();

        $result = [];
        foreach ($byUser as $userId => $userCards) {
            $won = $userCards->whereIn('stage_id', $wonStageIds)->count();
            $lost = $userCards->whereIn('stage_id', $lostStageIds)->count();
            $inProgress = $userCards->whereNotIn('stage_id', $wonOrLostIds)->count();
            $total = $userCards->count();
            $wonValue = $userCards->whereIn('stage_id', $wonStageIds)->sum('value');
            $totalValue = $userCards->sum('value');
            $result[] = [
                'user_id' => $userId,
                'user_name' => $userId ? ($users->get($userId)?->name ?? 'Sem vendedor') : 'Sem vendedor',
                'total_cards' => $total,
                'won_cards' => $won,
                'lost_cards' => $lost,
                'in_progress_cards' => $inProgress,
                'won_value' => (float) $wonValue,
                'total_value' => (float) $totalValue,
                'conversion_rate' => $total > 0 ? round(($won / $total) * 100, 2) : 0,
            ];
        }

        usort($result, fn($a, $b) => $b['won_value'] <=> $a['won_value']);
        return $result;
    }

    // ==========================================
    // CARDS
    // ==========================================

    /**
     * List cards for a pipeline.
     */
    public function listCards(Request $request, string $pipelineId): JsonResponse
    {
        $pipeline = Pipeline::with(['stages' => fn($q) => $q->orderBy('position')])->findOrFail($pipelineId);

        // Check ownership
        if (!$pipeline->isOwnedBy($request->user()->tenant_id)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $query = PipelineCard::where('pipeline_id', $pipelineId)
            ->with(['stage', 'contact', 'assignedTo', 'products.product']);

        // SECURITY: Sales users can only see their own cards
        // Admins and Managers can see all cards
        $user = $request->user();
        if (!$user->isAdmin() && !$user->isManager()) {
            $query->where('assigned_to', $user->id);
        }

        if ($request->has('contact_id')) {
            $query->where('contact_id', $request->contact_id);
        }

        if ($request->has('assigned_to')) {
            $query->where('assigned_to', $request->assigned_to);
        }

        if ($request->has('priority')) {
            $query->where('priority', $request->priority);
        }

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'ilike', "%{$search}%")
                  ->orWhereHas('contact', fn($q) => $q->where('name', 'ilike', "%{$search}%"));
            });
        }

        $cards = $query->orderBy('position')->get();

        // Group cards by stage
        $cardsByStage = $cards->groupBy('stage_id');

        // Build stages array with cards
        $stages = $pipeline->stages->map(function ($stage) use ($cardsByStage) {
            $stageCards = $cardsByStage->get($stage->id, collect());
            return [
                'id' => $stage->id,
                'name' => $stage->name,
                'color' => $stage->color,
                'type' => $stage->is_won ? 'won' : ($stage->is_lost ? 'lost' : 'open'),
                'position' => $stage->position,
                'is_won' => $stage->is_won,
                'is_lost' => $stage->is_lost,
                'cards' => $stageCards->values(),
                'cards_count' => $stageCards->count(),
                'total_value' => $stageCards->sum('value'),
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'stages' => $stages,
                'totals' => [
                    'cards' => $cards->count(),
                    'value' => $cards->sum('value'),
                ],
            ],
        ]);
    }

    /**
     * List cards in list view.
     */
    public function listCardsView(Request $request, string $pipelineId): JsonResponse
    {
        $pipeline = Pipeline::findOrFail($pipelineId);
        
        // Check ownership
        if (!$pipeline->isOwnedBy($request->user()->tenant_id)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }
        
        $query = PipelineCard::where('pipeline_id', $pipelineId)
            ->with(['stage', 'contact', 'assignedTo']);

        // SECURITY: Sales users can only see their own cards
        // Admins and Managers can see all cards
        $user = $request->user();
        if (!$user->isAdmin() && !$user->isManager()) {
            $query->where('assigned_to', $user->id);
        }

        if ($request->has('stage_id')) {
            $query->where('stage_id', $request->stage_id);
        }

        $sortBy = $request->get('sort_by', 'created_at');
        $sortDir = $request->get('sort_dir', 'desc');
        $query->orderBy($sortBy, $sortDir);

        $cards = $query->paginate($request->get('per_page', 20));

        return response()->json([
            'success' => true,
            'data' => $cards->items(),
            'meta' => [
                'current_page' => $cards->currentPage(),
                'last_page' => $cards->lastPage(),
                'per_page' => $cards->perPage(),
                'total' => $cards->total(),
            ],
        ]);
    }

    /**
     * Store a new card.
     */
    public function storeCard(Request $request, string $pipelineId): JsonResponse
    {
        $pipeline = Pipeline::findOrFail($pipelineId);

        $request->validate([
            'title' => 'required|string|max:255',
            'stage_id' => 'required|uuid|exists:pipeline_stages,id',
            'contact_id' => 'nullable|uuid|exists:clients,id',
            'assigned_to' => 'nullable|uuid|exists:users,id',
            'description' => 'nullable|string',
            'value' => 'nullable|numeric|min:0',
            'priority' => 'nullable|string|in:low,medium,high,urgent',
            'expected_close_date' => 'nullable|date',
            'custom_fields' => 'nullable|array',
            'metadata' => 'nullable|array',
            'products' => 'nullable|array',
            'products.*.product_id' => 'required|uuid|exists:products,id',
            'products.*.quantity' => 'required|numeric|min:0',
            'products.*.unit_price' => 'required|numeric|min:0',
            'products.*.discount' => 'nullable|numeric|min:0',
        ]);

        DB::beginTransaction();
        try {
            $maxPosition = PipelineCard::where('stage_id', $request->stage_id)->max('position') ?? -1;

            // Calculate total value from products if provided
            $totalValue = $request->value ?? 0;
            if ($request->has('products') && !empty($request->products)) {
                $totalValue = 0;
                foreach ($request->products as $productData) {
                    $total = ($productData['quantity'] * $productData['unit_price']) - ($productData['discount'] ?? 0);
                    $totalValue += $total;
                }
            }

            // Auto-assign to current user if not specified
            $assignedTo = $request->assigned_to;
            if (!$assignedTo) {
                $assignedTo = $request->user()->id;
            }

            $card = PipelineCard::create([
                'id' => Str::uuid(),
                'pipeline_id' => $pipelineId,
                'stage_id' => $request->stage_id,
                'contact_id' => $request->contact_id,
                'assigned_to' => $assignedTo,
                'title' => $request->title,
                'description' => $request->description,
                'value' => $totalValue,
                'position' => $maxPosition + 1,
                'priority' => $request->priority ?? 'medium',
                'expected_close_date' => $request->expected_close_date,
                'custom_fields' => $request->custom_fields,
                'metadata' => $request->metadata,
            ]);

            // Save products if provided
            if ($request->has('products') && !empty($request->products)) {
                foreach ($request->products as $productData) {
                    $total = ($productData['quantity'] * $productData['unit_price']) - ($productData['discount'] ?? 0);
                    
                    PipelineCardProduct::create([
                        'id' => Str::uuid(),
                        'card_id' => $card->id,
                        'product_id' => $productData['product_id'],
                        'quantity' => $productData['quantity'],
                        'unit_price' => $productData['unit_price'],
                        'discount' => $productData['discount'] ?? 0,
                        'total' => $total,
                    ]);
                }
            }

            // Log history
            PipelineCardHistory::create([
                'id' => Str::uuid(),
                'card_id' => $card->id,
                'user_id' => auth()->id(),
                'action' => 'created',
                'to_stage_id' => $request->stage_id,
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'data' => $card->load(['stage', 'contact', 'assignedTo', 'products.product']),
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Show a card.
     */
    public function showCard(Request $request, string $pipelineId, string $cardId): JsonResponse
    {
        $card = PipelineCard::where('pipeline_id', $pipelineId)
            ->with(['stage', 'contact', 'assignedTo', 'products.product', 'tasks', 'history.user', 'comments.user'])
            ->findOrFail($cardId);

        // SECURITY: Sales users can only see their own cards
        $user = $request->user();
        if (!$user->isAdmin() && !$user->isManager() && $card->assigned_to !== $user->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        return response()->json([
            'success' => true,
            'data' => $card,
        ]);
    }

    /**
     * Update a card.
     */
    public function updateCard(Request $request, string $pipelineId, string $cardId): JsonResponse
    {
        $card = PipelineCard::where('pipeline_id', $pipelineId)->findOrFail($cardId);

        // SECURITY: Sales users can only update their own cards
        $user = $request->user();
        if (!$user->isAdmin() && !$user->isManager() && $card->assigned_to !== $user->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'title' => 'sometimes|string|max:255',
            'stage_id' => 'sometimes|uuid|exists:pipeline_stages,id',
            'contact_id' => 'sometimes|nullable|uuid|exists:clients,id',
            'assigned_to' => 'sometimes|nullable|uuid|exists:users,id',
            'description' => 'sometimes|nullable|string',
            'value' => 'sometimes|nullable|numeric|min:0',
            'priority' => 'sometimes|nullable|string|in:low,medium,high,urgent',
            'expected_close_date' => 'sometimes|nullable|date',
            'custom_fields' => 'sometimes|nullable|array',
        ]);

        $changes = [];
        foreach ($request->all() as $key => $value) {
            if ($card->$key !== $value) {
                $changes[$key] = ['from' => $card->$key, 'to' => $value];
            }
        }

        $card->update($request->all());

        if (!empty($changes)) {
            PipelineCardHistory::create([
                'id' => Str::uuid(),
                'card_id' => $card->id,
                'user_id' => auth()->id(),
                'action' => 'updated',
                'changes' => $changes,
            ]);
        }

        return response()->json([
            'success' => true,
            'data' => $card->fresh()->load(['stage', 'contact', 'assignedTo']),
        ]);
    }

    /**
     * Delete a card.
     */
    public function destroyCard(Request $request, string $pipelineId, string $cardId): JsonResponse
    {
        $card = PipelineCard::where('pipeline_id', $pipelineId)->findOrFail($cardId);

        // SECURITY: Sales users can only delete their own cards
        $user = $request->user();
        if (!$user->isAdmin() && !$user->isManager() && $card->assigned_to !== $user->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $card->delete();

        return response()->json([
            'success' => true,
            'message' => 'Card deleted successfully',
        ]);
    }

    /**
     * Move a card to another stage.
     */
    public function moveCard(Request $request, string $pipelineId, string $cardId): JsonResponse
    {
        $card = PipelineCard::where('pipeline_id', $pipelineId)->findOrFail($cardId);

        // SECURITY: Sales users can only move their own cards
        $user = $request->user();
        if (!$user->isAdmin() && !$user->isManager() && $card->assigned_to !== $user->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'stage_id' => 'required|uuid|exists:pipeline_stages,id',
            'position' => 'nullable|integer|min:0',
            'lost_reason' => 'nullable|string',
        ]);

        $fromStageId = $card->stage_id;
        $toStage = PipelineStage::findOrFail($request->stage_id);

        $card->update([
            'stage_id' => $request->stage_id,
            'position' => $request->position ?? 0,
            'won_at' => $toStage->is_won ? now() : null,
            'lost_at' => $toStage->is_lost ? now() : null,
            'lost_reason' => $toStage->is_lost ? $request->lost_reason : null,
        ]);

        PipelineCardHistory::create([
            'id' => Str::uuid(),
            'card_id' => $card->id,
            'user_id' => auth()->id(),
            'action' => 'moved',
            'from_stage_id' => $fromStageId,
            'to_stage_id' => $request->stage_id,
        ]);

        return response()->json([
            'success' => true,
            'data' => $card->fresh()->load(['stage', 'contact', 'assignedTo']),
        ]);
    }

    /**
     * Reorder cards in a stage.
     */
    public function reorderCards(Request $request, string $pipelineId): JsonResponse
    {
        $request->validate([
            'stage_id' => 'required|uuid|exists:pipeline_stages,id',
            'cards' => 'required|array',
            'cards.*.id' => 'required|uuid|exists:pipeline_cards,id',
            'cards.*.position' => 'required|integer|min:0',
        ]);

        foreach ($request->cards as $cardData) {
            PipelineCard::where('id', $cardData['id'])
                ->update([
                    'position' => $cardData['position'],
                    'stage_id' => $request->stage_id,
                ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Cards reordered successfully',
        ]);
    }

    /**
     * Update card products.
     */
    public function updateCardProducts(Request $request, string $pipelineId, string $cardId): JsonResponse
    {
        $card = PipelineCard::where('pipeline_id', $pipelineId)->findOrFail($cardId);

        // SECURITY: Sales users can only update products of their own cards
        $user = $request->user();
        if (!$user->isAdmin() && !$user->isManager() && $card->assigned_to !== $user->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'products' => 'required|array',
            'products.*.product_id' => 'required|uuid|exists:products,id',
            'products.*.quantity' => 'required|numeric|min:0',
            'products.*.unit_price' => 'required|numeric|min:0',
            'products.*.discount' => 'nullable|numeric|min:0',
        ]);

        DB::beginTransaction();
        try {
            // Remove existing products
            PipelineCardProduct::where('card_id', $card->id)->delete();

            $totalValue = 0;

            foreach ($request->products as $productData) {
                $total = ($productData['quantity'] * $productData['unit_price']) - ($productData['discount'] ?? 0);
                $totalValue += $total;

                PipelineCardProduct::create([
                    'id' => Str::uuid(),
                    'card_id' => $card->id,
                    'product_id' => $productData['product_id'],
                    'quantity' => $productData['quantity'],
                    'unit_price' => $productData['unit_price'],
                    'discount' => $productData['discount'] ?? 0,
                    'total' => $total,
                ]);
            }

            // Update card value
            $card->update(['value' => $totalValue]);

            DB::commit();

            return response()->json([
                'success' => true,
                'data' => $card->fresh()->load(['products.product']),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    // ==========================================
    // CARD COMMENTS (TIMELINE)
    // ==========================================

    /**
     * List comments for a card.
     */
    public function listComments(string $pipelineId, string $cardId): JsonResponse
    {
        $card = PipelineCard::where('pipeline_id', $pipelineId)->findOrFail($cardId);

        $comments = PipelineCardComment::where('card_id', $cardId)
            ->with('user')
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $comments,
        ]);
    }

    /**
     * Store a new comment.
     */
    public function storeComment(Request $request, string $pipelineId, string $cardId): JsonResponse
    {
        $card = PipelineCard::where('pipeline_id', $pipelineId)->findOrFail($cardId);

        $request->validate([
            'content' => 'required|string',
        ]);

        $comment = PipelineCardComment::create([
            'id' => Str::uuid(),
            'card_id' => $cardId,
            'user_id' => auth()->id(),
            'content' => $request->content,
        ]);

        // Log in history
        PipelineCardHistory::create([
            'id' => Str::uuid(),
            'card_id' => $card->id,
            'user_id' => auth()->id(),
            'action' => 'comment',
            'changes' => ['comment' => $request->content],
        ]);

        return response()->json([
            'success' => true,
            'data' => $comment->load('user'),
        ], 201);
    }

    /**
     * Update a comment.
     */
    public function updateComment(Request $request, string $pipelineId, string $cardId, string $commentId): JsonResponse
    {
        $comment = PipelineCardComment::where('card_id', $cardId)->findOrFail($commentId);

        // Only allow owner to edit
        if ($comment->user_id !== auth()->id()) {
            return response()->json([
                'success' => false,
                'message' => 'Você não tem permissão para editar este comentário.',
            ], 403);
        }

        $request->validate([
            'content' => 'required|string',
        ]);

        $comment->update(['content' => $request->content]);

        return response()->json([
            'success' => true,
            'data' => $comment->fresh()->load('user'),
        ]);
    }

    /**
     * Delete a comment.
     */
    public function destroyComment(string $pipelineId, string $cardId, string $commentId): JsonResponse
    {
        $comment = PipelineCardComment::where('card_id', $cardId)->findOrFail($commentId);

        // Only allow owner to delete
        if ($comment->user_id !== auth()->id()) {
            return response()->json([
                'success' => false,
                'message' => 'Você não tem permissão para excluir este comentário.',
            ], 403);
        }

        $comment->delete();

        return response()->json([
            'success' => true,
            'message' => 'Comentário excluído com sucesso.',
        ]);
    }

    // ==========================================
    // AI AUTO-FILL
    // ==========================================

    /**
     * Auto-fill card data using AI.
     */
    public function aiAutoFill(Request $request, string $pipelineId, string $cardId): JsonResponse
    {
        $card = PipelineCard::where('pipeline_id', $pipelineId)
            ->with(['stage', 'contact', 'assignedTo', 'comments.user', 'history'])
            ->findOrFail($cardId);

        // Use user's tenant_id for token tracking
        $tenantId = $request->user()?->tenant_id;
        $userId = $request->user()?->id;
        $aiService = new AIService($tenantId, $userId);
        
        // Build context from card data
        $cardContext = "Card: {$card->title}\n";
        $cardContext .= "Contato: " . ($card->contact?->name ?? 'N/A') . "\n";
        $cardContext .= "Estágio: " . ($card->stage?->name ?? 'N/A') . "\n";
        $cardContext .= "Comentários: " . $card->comments->count() . "\n";
        
        $result = $aiService->autoFillCard(
            $card->toArray(),
            $card->comments->toArray(),
            $card->history->toArray()
        );

        if ($result['success']) {
            // Record in AI Learning
            try {
                $learningService = new \App\Services\AILearningService($tenantId);
                
                // Record feedback for autofill usage
                $learningService->recordFeedback(
                    userMessage: $cardContext,
                    aiResponse: json_encode($result['suggestions']),
                    rating: 'neutral',
                    feature: 'autofill',
                    options: [
                        'card_id' => $cardId,
                        'pipeline_id' => $pipelineId,
                        'user_id' => $userId,
                    ]
                );
                
                // Learn pattern from this autofill
                $learningService->learnPattern(
                    intent: 'card_autofill',
                    triggerKeywords: ['autofill', 'preencher', $card->stage?->name ?? ''],
                    responseTemplate: $result['suggestions']['suggested_next_action'] ?? '',
                    wasSuccessful: true
                );
                
                \Log::info('AI Learning: Autofill recorded', [
                    'tenant_id' => $tenantId,
                    'card_id' => $cardId,
                ]);
            } catch (\Exception $e) {
                \Log::error('AI Learning: Failed to record autofill', [
                    'error' => $e->getMessage(),
                ]);
            }
            
            return response()->json([
                'success' => true,
                'data' => $result['suggestions'],
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => $result['message'],
        ], 400);
    }

    /**
     * Archive a card.
     */
    public function archiveCard(Request $request, string $pipelineId, string $cardId): JsonResponse
    {
        $card = PipelineCard::where('pipeline_id', $pipelineId)->findOrFail($cardId);
        
        $card->archive();

        PipelineCardHistory::create([
            'id' => Str::uuid(),
            'card_id' => $card->id,
            'user_id' => auth()->id(),
            'action' => 'archived',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Card arquivado com sucesso.',
        ]);
    }

    /**
     * Unarchive a card.
     */
    public function unarchiveCard(Request $request, string $pipelineId, string $cardId): JsonResponse
    {
        $card = PipelineCard::where('pipeline_id', $pipelineId)->findOrFail($cardId);
        
        $card->unarchive();

        PipelineCardHistory::create([
            'id' => Str::uuid(),
            'card_id' => $card->id,
            'user_id' => auth()->id(),
            'action' => 'unarchived',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Card restaurado com sucesso.',
        ]);
    }

    /**
     * List archived cards.
     */
    public function listArchivedCards(Request $request, string $pipelineId): JsonResponse
    {
        $cards = PipelineCard::where('pipeline_id', $pipelineId)
            ->archived()
            ->with(['stage', 'contact', 'assignedTo', 'products.product', 'attachments'])
            ->orderByDesc('archived_at')
            ->paginate($request->get('per_page', 20));

        return response()->json([
            'success' => true,
            'data' => $cards,
        ]);
    }

    /**
     * List card attachments.
     */
    public function listAttachments(Request $request, string $pipelineId, string $cardId): JsonResponse
    {
        $card = PipelineCard::where('pipeline_id', $pipelineId)->findOrFail($cardId);
        
        $attachments = $card->attachments()->with('uploader')->get();

        return response()->json([
            'success' => true,
            'data' => $attachments,
        ]);
    }

    /**
     * Upload attachment to card.
     */
    public function uploadAttachment(Request $request, string $pipelineId, string $cardId): JsonResponse
    {
        $card = PipelineCard::where('pipeline_id', $pipelineId)->findOrFail($cardId);

        $request->validate([
            'file' => 'required|file|max:10240', // 10MB max
        ]);

        $file = $request->file('file');
        $filename = Str::uuid() . '.' . $file->getClientOriginalExtension();
        $path = $file->storeAs('attachments/' . $cardId, $filename, 'public');

        $attachment = PipelineCardAttachment::create([
            'id' => Str::uuid(),
            'card_id' => $card->id,
            'uploaded_by' => auth()->id(),
            'filename' => $filename,
            'original_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getMimeType(),
            'size' => $file->getSize(),
            'path' => $path,
            'disk' => 'public',
        ]);

        PipelineCardHistory::create([
            'id' => Str::uuid(),
            'card_id' => $card->id,
            'user_id' => auth()->id(),
            'action' => 'attachment_added',
            'changes' => ['filename' => $file->getClientOriginalName()],
        ]);

        return response()->json([
            'success' => true,
            'data' => $attachment->load('uploader'),
            'message' => 'Arquivo anexado com sucesso.',
        ], 201);
    }

    /**
     * Delete attachment from card.
     */
    public function deleteAttachment(Request $request, string $pipelineId, string $cardId, string $attachmentId): JsonResponse
    {
        $card = PipelineCard::where('pipeline_id', $pipelineId)->findOrFail($cardId);
        $attachment = PipelineCardAttachment::where('card_id', $card->id)->findOrFail($attachmentId);

        $originalName = $attachment->original_name;
        
        // Delete file from storage
        $attachment->deleteFile();
        
        // Delete record
        $attachment->delete();

        PipelineCardHistory::create([
            'id' => Str::uuid(),
            'card_id' => $card->id,
            'user_id' => auth()->id(),
            'action' => 'attachment_removed',
            'changes' => ['filename' => $originalName],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Arquivo removido com sucesso.',
        ]);
    }

    /**
     * Download attachment.
     */
    public function downloadAttachment(Request $request, string $pipelineId, string $cardId, string $attachmentId): mixed
    {
        $card = PipelineCard::where('pipeline_id', $pipelineId)->findOrFail($cardId);
        $attachment = PipelineCardAttachment::where('card_id', $card->id)->findOrFail($attachmentId);

        return Storage::disk($attachment->disk)->download($attachment->path, $attachment->original_name);
    }
}
