<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AILearningService;
use App\Services\AIService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AILearningController extends Controller
{
    private function resolveTenantId(Request $request): ?string
    {
        $user = $request->user();
        if ($user?->tenant_id) {
            return $user->tenant_id;
        }

        // Fallback for system/super-admin users without tenant_id (single-tenant default)
        return DB::table('tenants')->orderBy('created_at')->value('id');
    }

    /**
     * Record feedback on an AI response
     */
    public function feedback(Request $request): JsonResponse
    {
        $request->validate([
            'user_message' => 'required|string|max:2000',
            'ai_response' => 'required|string|max:5000',
            'rating' => 'required|in:positive,negative,neutral',
            'correction' => 'nullable|string|max:2000',
            'conversation_id' => 'nullable|uuid',
            'comment' => 'nullable|string|max:500',
        ]);

        $tenantId = $this->resolveTenantId($request);
        if (!$tenantId) {
            return response()->json([
                'success' => false,
                'message' => 'Tenant not found for AI learning.',
            ], 400);
        }
        
        $aiService = new AIService($tenantId, $request->user()->id ?? null);
        
        $result = $aiService->recordFeedback(
            $request->input('user_message'),
            $request->input('ai_response'),
            $request->input('rating'),
            $request->input('correction'),
            $request->input('conversation_id')
        );

        return response()->json($result);
    }

    /**
     * Get learning statistics
     */
    public function stats(Request $request): JsonResponse
    {
        $tenantId = $this->resolveTenantId($request);
        if (!$tenantId) {
            return response()->json([
                'success' => false,
                'message' => 'Tenant not found for AI learning.',
            ], 400);
        }
        
        $learningService = new AILearningService($tenantId);
        $stats = $learningService->getStats();

        // Add some additional insights
        $stats['insights'] = $this->calculateInsights($tenantId);

        return response()->json([
            'success' => true,
            'data' => $stats,
        ]);
    }

    /**
     * Get memories/learned facts
     */
    public function memories(Request $request): JsonResponse
    {
        $tenantId = $this->resolveTenantId($request);
        if (!$tenantId) {
            return response()->json([
                'success' => false,
                'message' => 'Tenant not found for AI learning.',
            ], 400);
        }
        $type = $request->input('type');
        $limit = min($request->input('limit', 50), 100);

        $memories = DB::table('ai_memories')
            ->where('tenant_id', $tenantId)
            ->when($type, fn($q) => $q->where('type', $type))
            ->orderByDesc('confidence_score')
            ->orderByDesc('usage_count')
            ->limit($limit)
            ->get();

        return response()->json([
            'success' => true,
            'data' => $memories,
        ]);
    }

    /**
     * Add a memory/fact manually
     */
    public function addMemory(Request $request): JsonResponse
    {
        $request->validate([
            'key' => 'required|string|max:500',
            'value' => 'required|string|max:2000',
            'type' => 'required|in:fact,preference,policy,product,service',
            'category' => 'nullable|string|max:100',
        ]);

        $tenantId = $this->resolveTenantId($request);
        if (!$tenantId) {
            return response()->json([
                'success' => false,
                'message' => 'Tenant not found for AI learning.',
            ], 400);
        }
        
        $learningService = new AILearningService($tenantId);
        
        $learningService->remember(
            $request->input('key'),
            $request->input('value'),
            $request->input('type'),
            [
                'category' => $request->input('category'),
                'source' => 'manual',
                'confidence' => 0.9, // High confidence for manual entries
            ]
        );

        return response()->json([
            'success' => true,
            'message' => 'Memória adicionada com sucesso.',
        ]);
    }

    /**
     * Update a memory
     */
    public function updateMemory(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'value' => 'sometimes|string|max:2000',
            'is_active' => 'sometimes|boolean',
            'is_verified' => 'sometimes|boolean',
        ]);

        $tenantId = $request->user()->tenant_id ?? $request->user()->id;

        $memory = DB::table('ai_memories')
            ->where('id', $id)
            ->where('tenant_id', $tenantId)
            ->first();

        if (!$memory) {
            return response()->json([
                'success' => false,
                'message' => 'Memória não encontrada.',
            ], 404);
        }

        DB::table('ai_memories')
            ->where('id', $id)
            ->update(array_merge(
                $request->only(['value', 'is_active', 'is_verified']),
                ['updated_at' => now()]
            ));

        return response()->json([
            'success' => true,
            'message' => 'Memória atualizada.',
        ]);
    }

    /**
     * Delete a memory
     */
    public function deleteMemory(string $id): JsonResponse
    {
        $tenantId = request()->user()->tenant_id ?? request()->user()->id;

        $deleted = DB::table('ai_memories')
            ->where('id', $id)
            ->where('tenant_id', $tenantId)
            ->delete();

        return response()->json([
            'success' => $deleted > 0,
            'message' => $deleted > 0 ? 'Memória excluída.' : 'Memória não encontrada.',
        ]);
    }

    /**
     * Get FAQ cache entries
     */
    public function faq(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id ?? $request->user()->id;
        $limit = min($request->input('limit', 50), 100);

        $faqs = DB::table('ai_faq_cache')
            ->where('tenant_id', $tenantId)
            ->orderByDesc('times_asked')
            ->orderByDesc('helpfulness_score')
            ->limit($limit)
            ->get();

        return response()->json([
            'success' => true,
            'data' => $faqs,
        ]);
    }

    /**
     * Verify a FAQ entry
     */
    public function verifyFaq(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'answer' => 'sometimes|string|max:2000',
        ]);

        $tenantId = $request->user()->tenant_id ?? $request->user()->id;

        DB::table('ai_faq_cache')
            ->where('id', $id)
            ->where('tenant_id', $tenantId)
            ->update([
                'is_verified' => true,
                'answer' => $request->input('answer') ?? DB::raw('answer'),
                'helpfulness_score' => 1.0, // Verified = perfect score
                'updated_at' => now(),
            ]);

        return response()->json([
            'success' => true,
            'message' => 'FAQ verificada e aprovada.',
        ]);
    }

    /**
     * Get feedback history
     */
    public function feedbackHistory(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id ?? $request->user()->id;
        $rating = $request->input('rating');
        $limit = min($request->input('limit', 50), 100);

        $feedback = DB::table('ai_feedback')
            ->where('tenant_id', $tenantId)
            ->when($rating, fn($q) => $q->where('rating', $rating))
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get();

        return response()->json([
            'success' => true,
            'data' => $feedback,
        ]);
    }

    /**
     * Process pending feedback (manual trigger)
     */
    public function processFeedback(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id ?? $request->user()->id;
        
        $learningService = new AILearningService($tenantId);
        $processed = $learningService->processPendingFeedback(100);

        return response()->json([
            'success' => true,
            'message' => "Processados {$processed} feedbacks.",
            'processed' => $processed,
        ]);
    }

    /**
     * Get learning patterns
     */
    public function patterns(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id ?? $request->user()->id;
        $limit = min($request->input('limit', 50), 100);

        $patterns = DB::table('ai_learning_patterns')
            ->where('tenant_id', $tenantId)
            ->orderByDesc('success_rate')
            ->orderByDesc('times_used')
            ->limit($limit)
            ->get();

        return response()->json([
            'success' => true,
            'data' => $patterns,
        ]);
    }

    /**
     * Calculate insights from learning data
     */
    private function calculateInsights(string $tenantId): array
    {
        $insights = [];

        // Most asked questions
        $topQuestions = DB::table('ai_faq_cache')
            ->where('tenant_id', $tenantId)
            ->orderByDesc('times_asked')
            ->limit(5)
            ->get(['question', 'times_asked']);

        $insights['top_questions'] = $topQuestions;

        // Feedback trend (last 7 days)
        $feedbackTrend = DB::table('ai_feedback')
            ->where('tenant_id', $tenantId)
            ->where('created_at', '>=', now()->subDays(7))
            ->selectRaw("DATE(created_at) as date, rating, COUNT(*) as count")
            ->groupBy('date', 'rating')
            ->orderBy('date')
            ->get();

        $insights['feedback_trend'] = $feedbackTrend;

        // Learning progress
        $totalMemories = DB::table('ai_memories')->where('tenant_id', $tenantId)->count();
        $verifiedMemories = DB::table('ai_memories')->where('tenant_id', $tenantId)->where('is_verified', true)->count();
        $avgConfidence = DB::table('ai_memories')->where('tenant_id', $tenantId)->avg('confidence_score') ?? 0;

        $insights['learning_progress'] = [
            'total_knowledge' => $totalMemories,
            'verified_knowledge' => $verifiedMemories,
            'avg_confidence' => round($avgConfidence * 100, 1) . '%',
            'knowledge_score' => $totalMemories > 0 ? round(($verifiedMemories / $totalMemories) * 100, 1) : 0,
        ];

        // Response improvement
        $positiveFeedback = DB::table('ai_feedback')
            ->where('tenant_id', $tenantId)
            ->where('rating', 'positive')
            ->count();
        $totalFeedback = DB::table('ai_feedback')
            ->where('tenant_id', $tenantId)
            ->count();

        $insights['satisfaction_rate'] = $totalFeedback > 0 
            ? round(($positiveFeedback / $totalFeedback) * 100, 1) . '%'
            : 'N/A';

        return $insights;
    }
}
