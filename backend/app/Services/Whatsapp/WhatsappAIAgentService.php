<?php

namespace App\Services\Whatsapp;

use App\Models\WhatsappSession;
use App\Models\WhatsappConversation;
use App\Models\WhatsappMessage;
use App\Models\AiChatAgent;
use App\Services\AIService;
use App\Services\AILearningService;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class WhatsappAIAgentService
{
    private string $serviceUrl;

    public function __construct()
    {
        $this->serviceUrl = config('whatsapp.service.url');
    }

    /**
     * Process AI Agent auto-response
     */
    public function processAutoResponse(
        WhatsappSession $session,
        WhatsappConversation $conversation,
        string $messageText
    ): void {
        if (!config('whatsapp.ai_agent.enabled')) {
            return;
        }

        try {
            $conversation->refresh();

            // HANDOFF: Se há mensagem humana recente (últimos 30min), não responder
            // Isso detecta quando QUALQUER usuário (admin, manager, vendedor) assumiu a conversa
            if ($this->hasRecentHumanMessage($conversation)) {
                Log::info('AI Agent: Human takeover detected (recent human message), skipping response', [
                    'conversationId' => $conversation->id,
                ]);
                return;
            }

            if (!$this->checkRateLimits($session, $conversation)) {
                return;
            }

            $aiAgent = $this->getActiveAIAgent($session);
            if (!$aiAgent) {
                Log::debug('AI Agent not active for session', ['sessionId' => $session->id]);
                return;
            }

            if (!$this->isWithinServiceHours($aiAgent)) {
                Log::info('AI Agent: Outside service hours, skipping response', [
                    'sessionId' => $session->id,
                    'conversationId' => $conversation->id,
                ]);
                return;
            }

            if (empty(trim($messageText))) {
                Log::debug('AI Agent: Empty message, skipping');
                return;
            }

            $messageText = $this->combineRecentMessages($conversation, $messageText);

            $this->setRateLimitLocks($session, $conversation);

            Log::info('AI Agent processing message', [
                'sessionId' => $session->id,
                'conversationId' => $conversation->id,
                'agentId' => $aiAgent->id,
                'agentName' => $aiAgent->name,
                'messageLength' => strlen($messageText),
            ]);

            $aiResponse = $this->generateAIResponse($session, $aiAgent, $messageText, $conversation);

            if (!$aiResponse) {
                return;
            }

            // Re-check after generation (may have taken seconds)
            $conversation->refresh();
            $isStillAutoAssigned = (
                $session->user_id !== null
                && $conversation->assigned_user_id === $session->user_id
            );
            if ($conversation->assigned_user_id !== null && !$isStillAutoAssigned) {
                Log::info('AI Agent: Human takeover detected after generation, discarding response', [
                    'conversationId' => $conversation->id,
                    'assignedUserId' => $conversation->assigned_user_id,
                ]);
                return;
            }
            if ($this->hasRecentHumanMessage($conversation)) {
                Log::info('AI Agent: Human message detected after generation, discarding response', [
                    'conversationId' => $conversation->id,
                ]);
                return;
            }

            $this->sendAIResponse($session, $conversation, $aiResponse, $aiAgent, $messageText);

        } catch (\Exception $e) {
            Log::error('AI Agent unexpected error', [
                'sessionId' => $session->id,
                'conversationId' => $conversation->id,
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);
        }
    }

    /**
     * Check if current time is within the configured service hours.
     * If no hours are configured, AI is always active.
     */
    private function isWithinServiceHours(AiChatAgent $aiAgent): bool
    {
        $hours = $aiAgent->human_service_hours;

        if (empty($hours) || !is_array($hours)) {
            return true;
        }

        $dayMap = [
            1 => 'monday',
            2 => 'tuesday',
            3 => 'wednesday',
            4 => 'thursday',
            5 => 'friday',
            6 => 'saturday',
            0 => 'sunday',
        ];

        $now = now()->timezone('America/Sao_Paulo');
        $dayKey = $dayMap[$now->dayOfWeek] ?? null;

        if (!$dayKey || !isset($hours[$dayKey])) {
            return true;
        }

        $dayConfig = $hours[$dayKey];

        if (!($dayConfig['enabled'] ?? false)) {
            return true;
        }

        $start = $dayConfig['start'] ?? null;
        $end = $dayConfig['end'] ?? null;

        if (!$start || !$end) {
            return true;
        }

        $currentTime = $now->format('H:i');
        return $currentTime >= $start && $currentTime <= $end;
    }

    /**
     * Check rate limits for AI Agent
     */
    private function checkRateLimits(WhatsappSession $session, WhatsappConversation $conversation): bool
    {
        // Global rate limit - max requests per minute
        $globalRateKey = "ai_agent_global:{$session->id}";
        $globalCount = Cache::get($globalRateKey, 0);
        $maxRate = config('whatsapp.ai_agent.rate_limit_per_minute');

        if ($globalCount >= $maxRate) {
            Log::debug('AI Agent: Global rate limit reached', [
                'sessionId' => $session->id,
                'count' => $globalCount,
            ]);
            return false;
        }

        // Debounce - wait for messages to accumulate
        $debounceKey = "ai_agent_debounce:{$conversation->id}";
        $lastProcessed = Cache::get($debounceKey);
        $debounceSeconds = config('whatsapp.ai_agent.debounce_seconds');

        if ($lastProcessed) {
            $timeSinceLastResponse = now()->timestamp - $lastProcessed;
            if ($timeSinceLastResponse < $debounceSeconds) {
                Log::debug('AI Agent: Debouncing, waiting for more messages', [
                    'conversationId' => $conversation->id,
                ]);
                return false;
            }
        }

        return true;
    }

    /**
     * Set rate limit locks
     */
    private function setRateLimitLocks(WhatsappSession $session, WhatsappConversation $conversation): void
    {
        $debounceKey = "ai_agent_debounce:{$conversation->id}";
        Cache::put($debounceKey, now()->timestamp, 60);

        $globalRateKey = "ai_agent_global:{$session->id}";
        $globalCount = Cache::get($globalRateKey, 0);
        Cache::put($globalRateKey, $globalCount + 1, 60);
    }

    /**
     * Get active AI Agent for session
     */
    private function getActiveAIAgent(WhatsappSession $session): ?AiChatAgent
    {
        $tenantId = $session->tenant_id;

        return AiChatAgent::withoutGlobalScopes()
            ->with('documents')
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->where('whatsapp_session_id', '!=', 'none')
            ->where(function ($q) use ($session) {
                $q->where('whatsapp_session_id', $session->id)
                    ->orWhereNull('whatsapp_session_id');
            })
            ->first();
    }

    /**
     * Combine recent messages from customer
     */
    private function combineRecentMessages(WhatsappConversation $conversation, string $currentMessage): string
    {
        $windowSeconds = config('whatsapp.ai_agent.recent_message_window_seconds');
        
        $recentMessages = WhatsappMessage::where('conversation_id', $conversation->id)
            ->where('direction', 'incoming')
            ->where('created_at', '>=', now()->subSeconds($windowSeconds))
            ->orderBy('created_at', 'asc')
            ->pluck('content')
            ->filter()
            ->unique()
            ->values()
            ->toArray();

        if (count($recentMessages) > 1) {
            Log::info('AI Agent: Combined multiple messages', [
                'conversationId' => $conversation->id,
                'messageCount' => count($recentMessages),
            ]);
            return implode("\n", $recentMessages);
        }

        return $currentMessage;
    }

    /**
     * Check if a human (not AI) sent a recent outgoing message in this conversation.
     * This is a safety net for human takeover detection even when assigned_user_id
     * is not yet set (e.g. race condition, global session edge case).
     */
    private function hasRecentHumanMessage(WhatsappConversation $conversation): bool
    {
        return WhatsappMessage::where('conversation_id', $conversation->id)
            ->where('direction', 'outgoing')
            ->where('created_at', '>=', now()->subMinutes(30))
            ->where(function ($q) {
                $q->whereNull('sender_name')
                    ->orWhere('sender_name', '!=', 'AI Agent');
            })
            ->exists();
    }

    /**
     * Generate AI response
     */
    private function generateAIResponse(
        WhatsappSession $session,
        AiChatAgent $aiAgent,
        string $messageText,
        WhatsappConversation $conversation
    ): ?string {
        // Build knowledge base
        $knowledgeBase = $this->buildKnowledgeBase($aiAgent);

        $instructions = $aiAgent->instruction_type === 'custom'
            ? ['custom_instructions' => $aiAgent->custom_instructions]
            : [
                'function_definition' => $aiAgent->function_definition,
                'company_info' => $aiAgent->company_info,
                'tone' => $aiAgent->tone,
                'knowledge_guidelines' => $aiAgent->knowledge_guidelines,
                'incorrect_info_prevention' => $aiAgent->incorrect_info_prevention,
                'human_escalation_rules' => $aiAgent->human_escalation_rules,
                'useful_links' => $aiAgent->useful_links,
                'conversation_examples' => $aiAgent->conversation_examples,
            ];

        $context = [
            'knowledge_base' => $knowledgeBase['content'],
        ];

        Log::debug('AI Agent knowledge base loaded', [
            'documentsCount' => $knowledgeBase['count'],
        ]);

        // Generate response using AI Service
        $tenantId = $session->tenant_id ?? \DB::table('tenants')->orderBy('created_at')->value('id');
        $aiService = new AIService($tenantId);

        if (!$aiService->isConfigured()) {
            Log::error('AI Agent: Groq API key not configured');
            return null;
        }

        $result = $aiService->generateChatResponse(
            $messageText,
            $context,
            $instructions,
            $conversation->id
        );

        if (!$result['success'] || empty($result['response'])) {
            Log::warning('AI Agent failed to generate response', [
                'sessionId' => $session->id,
                'conversationId' => $conversation->id,
                'error' => $result['message'] ?? 'Unknown error',
            ]);
            return null;
        }

        Log::info('AI Agent generated response', [
            'conversationId' => $conversation->id,
            'responseLength' => strlen($result['response']),
        ]);

        return $result['response'];
    }

    /**
     * Build knowledge base from documents
     */
    private function buildKnowledgeBase(AiChatAgent $aiAgent): array
    {
        $knowledgeBase = '';
        $count = 0;

        foreach ($aiAgent->documents ?? [] as $doc) {
            if ($doc->content) {
                $knowledgeBase .= "\n\n--- {$doc->name} ---\n{$doc->content}";
                $count++;
            }
        }

        return [
            'content' => $knowledgeBase,
            'count' => $count,
        ];
    }

    /**
     * Send AI response via WhatsApp
     */
    private function sendAIResponse(
        WhatsappSession $session,
        WhatsappConversation $conversation,
        string $aiResponse,
        AiChatAgent $aiAgent,
        string $originalMessage
    ): void {
        try {
            $response = Http::timeout(30)
                ->post("{$this->serviceUrl}/messages/send/text", [
                    'sessionId' => $session->id,
                    'to' => $conversation->remote_jid,
                    'text' => $aiResponse,
                ]);

            if (!$response->successful()) {
                Log::error('Failed to send AI Agent response via WhatsApp', [
                    'sessionId' => $session->id,
                    'conversationId' => $conversation->id,
                    'statusCode' => $response->status(),
                ]);
                return;
            }

            // Save AI response as outgoing message
            WhatsappMessage::create([
                'id' => Str::uuid(),
                'conversation_id' => $conversation->id,
                'message_id' => $response->json('data.messageId') ?? Str::uuid()->toString(),
                'direction' => 'outgoing',
                'type' => 'text',
                'content' => $aiResponse,
                'status' => 'sent',
                'sender_name' => 'AI Agent',
            ]);

            // Update conversation
            $conversation->update([
                'last_message_at' => now(),
                'unread_count' => 0,
            ]);

            // Record interaction for learning
            $this->recordLearningInteraction($session, $conversation, $originalMessage, $aiResponse, $aiAgent);

            Log::info('AI Agent response sent successfully', [
                'conversationId' => $conversation->id,
                'remoteJid' => $conversation->remote_jid,
            ]);

        } catch (\Exception $e) {
            Log::error('Error sending AI response', [
                'error' => $e->getMessage(),
                'conversationId' => $conversation->id,
            ]);
        }
    }

    /**
     * Record interaction for AI learning
     */
    private function recordLearningInteraction(
        WhatsappSession $session,
        WhatsappConversation $conversation,
        string $question,
        string $answer,
        AiChatAgent $aiAgent
    ): void {
        try {
            $tenantId = $session->tenant_id ?? \DB::table('tenants')->orderBy('created_at')->value('id');

            if (!$tenantId) {
                throw new \RuntimeException('Tenant not found for AI Learning');
            }

            $learningService = new AILearningService($tenantId);

            // Detect intent and extract keywords
            $intent = $this->detectIntent($question);
            $keywords = $this->extractKeywords($question);

            // Check if interaction should be stored as FAQ
            $canStoreFaq = $this->canStoreFAQ($intent, $question, $keywords);

            // Create/Update FAQ entry if applicable
            if ($canStoreFaq) {
                $learningService->createOrUpdateFAQ($question, $answer, false);
            }

            // Update conversation context
            $learningService->updateConversationContext(
                $conversation->id,
                $question,
                $answer,
                null // sentiment will be analyzed later
            );

            // Learn pattern from this interaction
            if (!empty($keywords) && $intent !== 'general') {
                $learningService->learnPattern(
                    intent: $intent,
                    triggerKeywords: $keywords,
                    responseTemplate: $answer,
                    wasSuccessful: true
                );
            }

            // Record feedback as neutral (can be corrected later)
            $learningService->recordFeedback(
                $question,
                $answer,
                'neutral',
                'whatsapp_auto',
                [
                    'conversation_id' => $conversation->id,
                    'session_id' => $session->id,
                    'agent_id' => $aiAgent->id,
                    'intent' => $intent,
                    'keywords' => $keywords,
                ]
            );

            Log::info('AI Learning: Interaction recorded', [
                'conversationId' => $conversation->id,
                'intent' => $intent,
                'keywordsCount' => count($keywords),
            ]);

        } catch (\Exception $e) {
            // Don't fail the response if learning fails
            Log::warning('AI Learning: Failed to record interaction', [
                'error' => $e->getMessage(),
                'conversationId' => $conversation->id,
            ]);
        }
    }

    /**
     * Detect intent from message
     */
    public function detectIntent(string $message): string
    {
        $message = mb_strtolower($message);
        $intents = config('whatsapp.intents');

        foreach ($intents as $intent => $keywords) {
            foreach ($keywords as $keyword) {
                if (str_contains($message, $keyword)) {
                    return $intent;
                }
            }
        }

        return 'general';
    }

    /**
     * Extract keywords from message
     */
    public function extractKeywords(string $text): array
    {
        $stopWords = config('whatsapp.stop_words');
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

    /**
     * Check if interaction can be stored as FAQ
     */
    private function canStoreFAQ(string $intent, string $message, array $keywords): bool
    {
        $allowedIntents = config('whatsapp.allowed_faq_intents');
        $minLength = config('whatsapp.ai_agent.min_message_length');
        $minKeywords = config('whatsapp.ai_agent.min_keywords');

        return in_array($intent, $allowedIntents, true)
            && mb_strlen(trim($message)) >= $minLength
            && count($keywords) >= $minKeywords;
    }
}
