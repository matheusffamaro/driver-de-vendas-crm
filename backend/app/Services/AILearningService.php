<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class AILearningService
{
    private string $tenantId;
    private const CACHE_TTL = 3600; // 1 hour

    public function __construct(?string $tenantId = null)
    {
        if (!$tenantId) {
            throw new \InvalidArgumentException('Tenant ID is required for AI Learning Service');
        }
        $this->tenantId = $tenantId;
    }

    /**
     * Set tenant context
     */
    public function forTenant(string $tenantId): self
    {
        $this->tenantId = $tenantId;
        return $this;
    }

    // ==========================================
    // MEMORY MANAGEMENT
    // ==========================================

    /**
     * Store a new memory/learning
     */
    public function remember(string $key, string $value, string $type = 'fact', array $options = []): void
    {
        DB::table('ai_memories')->updateOrInsert(
            [
                'tenant_id' => $this->tenantId,
                'key' => $key,
                'type' => $type,
            ],
            [
                'id' => Str::uuid(),
                'value' => $value,
                'category' => $options['category'] ?? null,
                'context' => $options['context'] ?? null,
                'source' => $options['source'] ?? 'conversation',
                'source_id' => $options['source_id'] ?? null,
                'confidence_score' => $options['confidence'] ?? 0.5,
                'is_active' => true,
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );

        // Clear cache
        $this->clearMemoryCache();
    }

    /**
     * Recall relevant memories for a query
     */
    public function recall(string $query, int $limit = 5): array
    {
        $cacheKey = "ai_recall:{$this->tenantId}:" . md5($query);
        
        return Cache::remember($cacheKey, 300, function () use ($query, $limit) {
            $keywords = $this->extractKeywords($query);
            
            if (empty($keywords)) {
                return [];
            }

            // Search memories that match keywords
            $memories = DB::table('ai_memories')
                ->where('tenant_id', $this->tenantId)
                ->where('is_active', true)
                ->where('confidence_score', '>=', 0.3)
                ->where(function ($q) use ($keywords) {
                    foreach ($keywords as $keyword) {
                        $q->orWhere('key', 'ILIKE', "%{$keyword}%")
                          ->orWhere('value', 'ILIKE', "%{$keyword}%")
                          ->orWhere('context', 'ILIKE', "%{$keyword}%");
                    }
                })
                ->orderByDesc('confidence_score')
                ->orderByDesc('usage_count')
                ->limit($limit)
                ->get();

            // Update usage count
            $ids = $memories->pluck('id')->toArray();
            if (!empty($ids)) {
                DB::table('ai_memories')
                    ->whereIn('id', $ids)
                    ->update([
                        'usage_count' => DB::raw('usage_count + 1'),
                        'last_used_at' => now(),
                    ]);
            }

            return $memories->toArray();
        });
    }

    /**
     * Get all active memories for context building
     */
    public function getActiveMemories(string $type = null, int $limit = 50): array
    {
        $cacheKey = "ai_memories:{$this->tenantId}:" . ($type ?? 'all');

        return Cache::remember($cacheKey, self::CACHE_TTL, function () use ($type, $limit) {
            return DB::table('ai_memories')
                ->where('tenant_id', $this->tenantId)
                ->where('is_active', true)
                ->where('confidence_score', '>=', 0.4)
                ->when($type, fn($q) => $q->where('type', $type))
                ->orderByDesc('confidence_score')
                ->orderByDesc('usage_count')
                ->limit($limit)
                ->get()
                ->toArray();
        });
    }

    // ==========================================
    // FEEDBACK PROCESSING
    // ==========================================

    /**
     * Record feedback on an AI response
     */
    public function recordFeedback(
        string $userMessage,
        string $aiResponse,
        string $rating,
        string $feature = 'chat',
        array $options = []
    ): string {
        $id = Str::uuid();

        DB::table('ai_feedback')->insert([
            'id' => $id,
            'tenant_id' => $this->tenantId,
            'user_id' => $options['user_id'] ?? null,
            'user_message' => $userMessage,
            'ai_response' => $aiResponse,
            'feature' => $feature,
            'rating' => $rating,
            'correction' => $options['correction'] ?? null,
            'comment' => $options['comment'] ?? null,
            'conversation_id' => $options['conversation_id'] ?? null,
            'metadata' => json_encode($options['metadata'] ?? []),
            'processed' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // If positive feedback, boost confidence in relevant memories
        if ($rating === 'positive') {
            $this->boostRelatedMemories($userMessage);
        }

        // If negative with correction, learn from it immediately
        if ($rating === 'negative' && !empty($options['correction'])) {
            $this->learnFromCorrection($userMessage, $options['correction']);
        }

        return $id;
    }

    /**
     * Process pending feedback for learning
     */
    public function processPendingFeedback(int $limit = 100): int
    {
        $feedback = DB::table('ai_feedback')
            ->where('tenant_id', $this->tenantId)
            ->where('processed', false)
            ->limit($limit)
            ->get();

        $processed = 0;

        foreach ($feedback as $item) {
            try {
                if ($item->rating === 'positive') {
                    // Create or update FAQ from successful interaction
                    $this->createOrUpdateFAQ($item->user_message, $item->ai_response, true);
                    
                    // Boost related memories
                    $this->boostRelatedMemories($item->user_message);
                }

                if ($item->rating === 'negative' && $item->correction) {
                    // Learn the correct response
                    $this->learnFromCorrection($item->user_message, $item->correction);
                }

                // Mark as processed
                DB::table('ai_feedback')
                    ->where('id', $item->id)
                    ->update([
                        'processed' => true,
                        'processed_at' => now(),
                    ]);

                $processed++;
            } catch (\Exception $e) {
                Log::error('Error processing AI feedback', ['id' => $item->id, 'error' => $e->getMessage()]);
            }
        }

        return $processed;
    }

    // ==========================================
    // FAQ MANAGEMENT
    // ==========================================

    /**
     * Find similar FAQ
     */
    public function findSimilarFAQ(string $question): ?object
    {
        $hash = $this->hashQuestion($question);
        
        // Exact match first
        $exact = DB::table('ai_faq_cache')
            ->where('tenant_id', $this->tenantId)
            ->where('question_hash', $hash)
            ->first();

        if ($exact) {
            // Update stats
            DB::table('ai_faq_cache')
                ->where('id', $exact->id)
                ->update([
                    'times_asked' => DB::raw('times_asked + 1'),
                    'last_asked_at' => now(),
                ]);
            return $exact;
        }

        // Try fuzzy match using keywords
        $keywords = $this->extractKeywords($question);
        if (empty($keywords)) {
            return null;
        }

        $similar = DB::table('ai_faq_cache')
            ->where('tenant_id', $this->tenantId)
            ->where('helpfulness_score', '>=', 0.5)
            ->where(function ($q) use ($keywords) {
                foreach ($keywords as $keyword) {
                    $q->orWhere('question', 'ILIKE', "%{$keyword}%");
                }
            })
            ->orderByDesc('helpfulness_score')
            ->orderByDesc('times_asked')
            ->first();

        return $similar;
    }

    /**
     * Create or update FAQ entry
     * By default, does NOT mark as helpful (needs explicit positive feedback).
     */
    public function createOrUpdateFAQ(string $question, string $answer, bool $assumeHelpful = false): void
    {
        // Avoid storing generic fallback answers as FAQ (prevents repetitive loops)
        $normalizedAnswer = mb_strtolower(trim($answer));
        $genericFallbacks = [
            'não entendi muito bem',
            'nao entendi muito bem',
            'pode me explicar o que você está procurando',
            'pode me explicar o que voce esta procurando',
            'estou aqui para ajudar',
        ];
        foreach ($genericFallbacks as $fallback) {
            if (str_contains($normalizedAnswer, $fallback)) {
                return;
            }
        }

        // Skip very short or low-signal questions
        $normalizedQuestion = trim($question);
        if (mb_strlen($normalizedQuestion) < 8) {
            return;
        }

        $hash = $this->hashQuestion($question);

        $existing = DB::table('ai_faq_cache')
            ->where('tenant_id', $this->tenantId)
            ->where('question_hash', $hash)
            ->first();

        if ($existing) {
            $updates = [
                    'updated_at' => now(),
            ];
            if ($assumeHelpful) {
                $updates['times_helpful'] = DB::raw('times_helpful + 1');
                $updates['helpfulness_score'] = DB::raw('(times_helpful + 1.0) / times_asked');
            }
            DB::table('ai_faq_cache')->where('id', $existing->id)->update($updates);
        } else {
            DB::table('ai_faq_cache')->insert([
                'id' => Str::uuid(),
                'tenant_id' => $this->tenantId,
                'question' => $question,
                'question_hash' => $hash,
                'answer' => $answer,
                'times_asked' => 1,
                'times_helpful' => $assumeHelpful ? 1 : 0,
                'helpfulness_score' => $assumeHelpful ? 1.0 : 0.1,
                'last_asked_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    // ==========================================
    // PATTERN LEARNING
    // ==========================================

    /**
     * Learn a successful pattern
     */
    public function learnPattern(
        string $intent,
        array $triggerKeywords,
        string $responseTemplate,
        bool $wasSuccessful = true
    ): void {
        $existing = DB::table('ai_learning_patterns')
            ->where('tenant_id', $this->tenantId)
            ->where('intent', $intent)
            ->whereRaw("trigger_keywords::text = ?", [json_encode($triggerKeywords)])
            ->first();

        if ($existing) {
            $timesSuccessful = $wasSuccessful ? $existing->times_successful + 1 : $existing->times_successful;
            $timesUsed = $existing->times_used + 1;
            
            DB::table('ai_learning_patterns')
                ->where('id', $existing->id)
                ->update([
                    'times_used' => $timesUsed,
                    'times_successful' => $timesSuccessful,
                    'success_rate' => $timesSuccessful / $timesUsed,
                    'updated_at' => now(),
                ]);
        } else {
            DB::table('ai_learning_patterns')->insert([
                'id' => Str::uuid(),
                'tenant_id' => $this->tenantId,
                'intent' => $intent,
                'trigger_keywords' => json_encode($triggerKeywords),
                'pattern_template' => $intent,
                'response_template' => $responseTemplate,
                'times_used' => 1,
                'times_successful' => $wasSuccessful ? 1 : 0,
                'success_rate' => $wasSuccessful ? 1.0 : 0.0,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    /**
     * Find matching patterns for a message
     */
    public function findMatchingPatterns(string $message, int $limit = 3): array
    {
        $keywords = $this->extractKeywords($message);
        
        if (empty($keywords)) {
            return [];
        }

        return DB::table('ai_learning_patterns')
            ->where('tenant_id', $this->tenantId)
            ->where('is_active', true)
            ->where('success_rate', '>=', 0.5)
            ->where(function ($q) use ($keywords) {
                foreach ($keywords as $keyword) {
                    $q->orWhereRaw("trigger_keywords::text ILIKE ?", ["%{$keyword}%"]);
                }
            })
            ->orderByDesc('success_rate')
            ->orderByDesc('times_used')
            ->limit($limit)
            ->get()
            ->toArray();
    }

    // ==========================================
    // CONTEXT BUILDING
    // ==========================================

    /**
     * Build enriched context for AI from learned data
     */
    public function buildEnrichedContext(string $message, ?string $conversationId = null): array
    {
        $context = [
            'memories' => [],
            'faq' => null,
            'patterns' => [],
            'conversation_context' => null,
        ];

        // Get relevant memories
        $memories = $this->recall($message, 5);
        if (!empty($memories)) {
            $context['memories'] = array_map(fn($m) => [
                'type' => $m->type,
                'key' => $m->key,
                'value' => $m->value,
                'confidence' => $m->confidence_score,
            ], $memories);
        }

        // Check FAQ cache
        $faq = $this->findSimilarFAQ($message);
        if ($faq && $faq->helpfulness_score >= 0.7) {
            $context['faq'] = [
                'question' => $faq->question,
                'answer' => $faq->answer,
                'confidence' => $faq->helpfulness_score,
            ];
        }

        // Get matching patterns
        $patterns = $this->findMatchingPatterns($message, 2);
        if (!empty($patterns)) {
            $context['patterns'] = array_map(fn($p) => [
                'intent' => $p->intent,
                'response_template' => $p->response_template,
                'success_rate' => $p->success_rate,
            ], $patterns);
        }

        // Get conversation context if available
        if ($conversationId) {
            $convContext = DB::table('ai_conversation_contexts')
                ->where('tenant_id', $this->tenantId)
                ->where('conversation_id', $conversationId)
                ->first();

            if ($convContext) {
                $context['conversation_context'] = [
                    'summary' => $convContext->summary,
                    'topics' => json_decode($convContext->topics ?? '[]'),
                    'sentiment' => $convContext->sentiment,
                    'preferences' => json_decode($convContext->customer_preferences ?? '[]'),
                ];
            }
        }

        return $context;
    }

    /**
     * Update conversation context
     */
    public function updateConversationContext(
        string $conversationId,
        string $message,
        string $response,
        ?string $sentiment = null
    ): void {
        $existing = DB::table('ai_conversation_contexts')
            ->where('tenant_id', $this->tenantId)
            ->where('conversation_id', $conversationId)
            ->first();

        $topics = $this->extractTopics($message);

        if ($existing) {
            $existingTopics = json_decode($existing->topics ?? '[]', true);
            $mergedTopics = array_unique(array_merge($existingTopics, $topics));

            DB::table('ai_conversation_contexts')
                ->where('id', $existing->id)
                ->update([
                    'topics' => json_encode(array_slice($mergedTopics, 0, 10)),
                    'message_count' => $existing->message_count + 1,
                    'ai_response_count' => $existing->ai_response_count + 1,
                    'sentiment' => $sentiment ?? $existing->sentiment,
                    'updated_at' => now(),
                ]);
        } else {
            DB::table('ai_conversation_contexts')->insert([
                'id' => Str::uuid(),
                'tenant_id' => $this->tenantId,
                'conversation_id' => $conversationId,
                'topics' => json_encode($topics),
                'message_count' => 1,
                'ai_response_count' => 1,
                'sentiment' => $sentiment,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    // ==========================================
    // STATISTICS
    // ==========================================

    /**
     * Get learning statistics
     */
    public function getStats(): array
    {
        return [
            'memories' => [
                'total' => DB::table('ai_memories')->where('tenant_id', $this->tenantId)->count(),
                'active' => DB::table('ai_memories')->where('tenant_id', $this->tenantId)->where('is_active', true)->count(),
                'verified' => DB::table('ai_memories')->where('tenant_id', $this->tenantId)->where('is_verified', true)->count(),
                'avg_confidence' => DB::table('ai_memories')->where('tenant_id', $this->tenantId)->avg('confidence_score') ?? 0,
            ],
            'feedback' => [
                'total' => DB::table('ai_feedback')->where('tenant_id', $this->tenantId)->count(),
                'positive' => DB::table('ai_feedback')->where('tenant_id', $this->tenantId)->where('rating', 'positive')->count(),
                'negative' => DB::table('ai_feedback')->where('tenant_id', $this->tenantId)->where('rating', 'negative')->count(),
                'pending' => DB::table('ai_feedback')->where('tenant_id', $this->tenantId)->where('processed', false)->count(),
            ],
            'faq' => [
                'total' => DB::table('ai_faq_cache')->where('tenant_id', $this->tenantId)->count(),
                'verified' => DB::table('ai_faq_cache')->where('tenant_id', $this->tenantId)->where('is_verified', true)->count(),
                'avg_helpfulness' => DB::table('ai_faq_cache')->where('tenant_id', $this->tenantId)->avg('helpfulness_score') ?? 0,
            ],
            'patterns' => [
                'total' => DB::table('ai_learning_patterns')->where('tenant_id', $this->tenantId)->count(),
                'active' => DB::table('ai_learning_patterns')->where('tenant_id', $this->tenantId)->where('is_active', true)->count(),
                'avg_success_rate' => DB::table('ai_learning_patterns')->where('tenant_id', $this->tenantId)->avg('success_rate') ?? 0,
            ],
        ];
    }

    // ==========================================
    // HELPER METHODS
    // ==========================================

    private function extractKeywords(string $text): array
    {
        // Remove common words and extract meaningful keywords
        $stopWords = ['o', 'a', 'os', 'as', 'um', 'uma', 'de', 'da', 'do', 'em', 'no', 'na', 'para', 'com', 'por', 'que', 'qual', 'como', 'quando', 'onde', 'é', 'são', 'foi', 'ser', 'ter', 'eu', 'você', 'ele', 'ela', 'nós', 'eles', 'meu', 'seu', 'isso', 'este', 'esta', 'esse', 'essa', 'oi', 'olá', 'bom', 'boa', 'dia', 'tarde', 'noite', 'obrigado', 'obrigada', 'por favor', 'sim', 'não'];
        
        $words = preg_split('/\s+/', mb_strtolower(trim($text)));
        $keywords = [];

        foreach ($words as $word) {
            $word = preg_replace('/[^\p{L}\p{N}]/u', '', $word);
            if (strlen($word) >= 3 && !in_array($word, $stopWords)) {
                $keywords[] = $word;
            }
        }

        return array_unique(array_slice($keywords, 0, 10));
    }

    private function extractTopics(string $text): array
    {
        $keywords = $this->extractKeywords($text);
        return array_slice($keywords, 0, 5);
    }

    private function hashQuestion(string $question): string
    {
        // Normalize question for hashing
        $normalized = mb_strtolower(trim($question));
        $normalized = preg_replace('/[^\p{L}\p{N}\s]/u', '', $normalized);
        $normalized = preg_replace('/\s+/', ' ', $normalized);
        return md5($normalized);
    }

    private function boostRelatedMemories(string $message): void
    {
        $keywords = $this->extractKeywords($message);
        
        if (empty($keywords)) {
            return;
        }

        DB::table('ai_memories')
            ->where('tenant_id', $this->tenantId)
            ->where(function ($q) use ($keywords) {
                foreach ($keywords as $keyword) {
                    $q->orWhere('key', 'ILIKE', "%{$keyword}%");
                }
            })
            ->update([
                'success_count' => DB::raw('success_count + 1'),
                'confidence_score' => DB::raw('LEAST(confidence_score + 0.05, 1.0)'),
            ]);
    }

    private function learnFromCorrection(string $originalMessage, string $correction): void
    {
        $this->remember(
            key: $originalMessage,
            value: $correction,
            type: 'correction',
            options: [
                'source' => 'feedback',
                'confidence' => 0.8, // High confidence since it's a correction
            ]
        );
    }

    private function clearMemoryCache(): void
    {
        Cache::forget("ai_memories:{$this->tenantId}:all");
        Cache::forget("ai_memories:{$this->tenantId}:fact");
        Cache::forget("ai_memories:{$this->tenantId}:correction");
    }
}
