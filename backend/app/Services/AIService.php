<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

class AIService
{
    private string $provider;
    private string $apiKey;
    private string $model;
    private string $fastModel; // Modelo leve para tarefas simples
    private string $baseUrl;
    private string $geminiApiKey;
    private string $geminiModel;
    private string $geminiBaseUrl;
    private ?TokenService $tokenService = null;
    private ?AILearningService $learningService = null;
    private ?string $tenantId = null;
    private ?string $userId = null;
    private bool $learningEnabled = true;

    // ==========================================
    // CONFIGURAÇÕES DE OTIMIZAÇÃO DE CUSTOS
    // ==========================================
    private const MAX_KNOWLEDGE_BASE_TOKENS = 200; // Limite contexto (era ~500)
    private const MAX_CHAT_RESPONSE_TOKENS = 150;  // Limite resposta chat (era 200)
    private const MAX_JSON_RESPONSE_TOKENS = 250;  // Limite resposta JSON (era 400)
    private const CACHE_TTL_SECONDS = 86400;       // 24h cache (era variável)
    private const MIN_CACHE_MESSAGE_LENGTH = 5;    // Mínimo para cachear
    private const MAX_CACHE_MESSAGE_LENGTH = 150;  // Máximo para cachear

    public function __construct(?string $tenantId = null, ?string $userId = null)
    {
        $this->provider = config('services.ai.provider', 'groq');

        // Groq (OpenAI-compatible)
        $groqKey = config('services.groq.api_key', '');
        $groqModel = config('services.groq.model', 'llama-3.3-70b-versatile');
        $groqFast = config('services.groq.fast_model', 'llama-3.1-8b-instant');
        $groqBase = config('services.groq.base_url', 'https://api.groq.com/openai/v1');

        // Gemini (Google)
        $this->geminiApiKey = config('services.gemini.api_key', '');
        $this->geminiModel = config('services.gemini.model', 'gemini-2.0-flash');
        $this->geminiBaseUrl = config('services.gemini.base_url', 'https://generativelanguage.googleapis.com/v1beta');

        // Provider fallback (avoid silent failures in environments without GROQ key)
        if ($this->provider === 'groq' && empty($groqKey) && !empty($this->geminiApiKey)) {
            Log::warning('AI provider fallback: groq key missing, using gemini');
            $this->provider = 'gemini';
        }
        if ($this->provider === 'gemini' && empty($this->geminiApiKey) && !empty($groqKey)) {
            Log::warning('AI provider fallback: gemini key missing, using groq');
            $this->provider = 'groq';
        }

        if ($this->provider === 'gemini') {
            $this->apiKey = $this->geminiApiKey;
            $this->model = $this->geminiModel;
            $this->fastModel = $this->geminiModel;
            $this->baseUrl = $this->geminiBaseUrl;
        } else {
            // Default to Groq (and also works for OpenAI-compatible providers if configured similarly)
            $this->apiKey = $groqKey;
            $this->model = $groqModel;
            $this->fastModel = $groqFast;
            $this->baseUrl = $groqBase;
        }

        $this->tenantId = $tenantId;
        $this->userId = $userId;
    }

    /**
     * Enable/disable learning
     */
    public function withLearning(bool $enabled = true): self
    {
        $this->learningEnabled = $enabled;
        return $this;
    }

    /**
     * Get learning service
     */
    private function getLearningService(): AILearningService
    {
        if (!$this->learningService) {
            $this->learningService = new AILearningService($this->tenantId);
        }
        return $this->learningService;
    }

    /**
     * Set tenant context for token tracking
     */
    public function forTenant(string $tenantId): self
    {
        $this->tenantId = $tenantId;
        $this->tokenService = null;
        return $this;
    }

    /**
     * Set user context
     */
    public function forUser(string $userId): self
    {
        $this->userId = $userId;
        return $this;
    }

    /**
     * Get token service
     */
    private function getTokenService(): TokenService
    {
        if (!$this->tokenService) {
            $this->tokenService = new TokenService($this->tenantId, $this->userId);
        }
        return $this->tokenService;
    }

    /**
     * Check if API is configured
     */
    public function isConfigured(): bool
    {
        return !empty($this->apiKey);
    }

    /**
     * Get current model info
     */
    public function getModelInfo(): array
    {
        return [
            'provider' => $this->provider === 'gemini' ? 'Gemini' : 'Groq',
            'model' => $this->model,
            'free_tier' => true,
            'configured' => $this->isConfigured(),
        ];
    }

    /**
     * Get usage stats for current tenant
     */
    public function getUsageStats(): array
    {
        return $this->getTokenService()->getUsageStats();
    }

    /**
     * Detecta se a mensagem é simples (saudação, confirmação, etc.)
     * Mensagens simples podem usar modelo mais leve
     */
    private function isSimpleMessage(string $message): bool
    {
        $message = mb_strtolower(trim($message));
        $simplePatterns = [
            '/^(oi|olá|ola|hello|hi|hey|eai|e ai)[\s!?.]*$/u',
            '/^(bom dia|boa tarde|boa noite)[\s!?.]*$/u',
            '/^(ok|sim|não|nao|obrigado|obrigada|valeu|thanks)[\s!?.]*$/u',
            '/^(tchau|bye|adeus|até mais|ate mais)[\s!?.]*$/u',
            '/^(tudo bem|como vai|beleza)[\s!?]*$/u',
        ];
        
        foreach ($simplePatterns as $pattern) {
            if (preg_match($pattern, $message)) {
                return true;
            }
        }
        
        // Mensagens muito curtas (< 15 chars) são provavelmente simples
        return strlen($message) < 15;
    }

    /**
     * Seleciona o modelo ideal baseado na complexidade da tarefa
     */
    private function selectModel(string $feature, string $prompt): string
    {
        // Tarefas que sempre precisam do modelo completo
        $complexFeatures = ['autofill', 'lead_analysis', 'email_draft'];
        
        if (in_array($feature, $complexFeatures)) {
            return $this->model;
        }
        
        // Para chat, verificar se é mensagem simples
        if ($feature === 'chat' && $this->isSimpleMessage($prompt)) {
            Log::debug('Using fast model for simple message', ['prompt' => substr($prompt, 0, 50)]);
            return $this->fastModel;
        }
        
        // Resumos curtos podem usar modelo rápido
        if ($feature === 'summarize' && strlen($prompt) < 500) {
            return $this->fastModel;
        }
        
        return $this->model;
    }

    /**
     * Make a request to Groq API with token tracking and cost optimization
     */
    private function callGemini(string $feature, string $prompt, string $systemInstruction = '', float $temperature = 0.7, int $maxTokens = 500): array
    {
        $startTime = microtime(true);

        if (!$this->isConfigured()) {
            return ['success' => false, 'message' => 'Chave da API de IA não configurada.'];
        }

        try {
            $selectedModel = $this->selectModel($feature, $prompt);

            $estimatedTokens = TokenService::estimateTokens($prompt . $systemInstruction);
            $tokenCheck = $this->getTokenService()->canUseTokens($feature, $estimatedTokens);
            
            if (!$tokenCheck['allowed']) {
                return [
                    'success' => false,
                    'message' => $tokenCheck['message'],
                    'reason' => $tokenCheck['reason'] ?? 'limit_exceeded',
                    'upgrade_required' => $tokenCheck['upgrade_required'] ?? false,
                ];
            }

            $rateCheck = $this->getTokenService()->checkRateLimit();
            if (!$rateCheck['allowed']) {
                return ['success' => false, 'message' => $rateCheck['message']];
            }

            if ($this->provider === 'gemini') {
                return $this->callGeminiGenerateContent($feature, $prompt, $systemInstruction, $temperature, $maxTokens, $startTime);
            }

            // Groq uses OpenAI-compatible API
            $url = "{$this->baseUrl}/chat/completions";

            $messages = [];
            
            // OTIMIZAÇÃO: System instruction mais compacta
            if (!empty(trim($systemInstruction))) {
                $messages[] = [
                    'role' => 'system',
                    'content' => $this->compactSystemPrompt($systemInstruction),
                ];
            }
            
            // Add user message
            $messages[] = [
                'role' => 'user',
                'content' => $prompt,
            ];

            $requestBody = [
                'model' => $selectedModel,
                'messages' => $messages,
                'temperature' => $temperature,
                'max_tokens' => $maxTokens,
                'top_p' => 0.9,
            ];

            $response = Http::timeout(30)
                ->withHeaders([
                    'Content-Type' => 'application/json',
                    'Authorization' => 'Bearer ' . $this->apiKey,
                ])
                ->post($url, $requestBody);

            $responseTimeMs = (int) ((microtime(true) - $startTime) * 1000);
            
            // Increment rate limit
            $this->getTokenService()->incrementRateLimit();

            if ($response->successful()) {
                $data = $response->json();
                
                $text = $data['choices'][0]['message']['content'] ?? null;
                
                if ($text) {
                    $promptTokens = $data['usage']['prompt_tokens'] ?? 0;
                    $completionTokens = $data['usage']['completion_tokens'] ?? 0;
                    
                    // Record token usage
                    $this->getTokenService()->recordUsage(
                        feature: $feature,
                        promptTokens: $promptTokens,
                        completionTokens: $completionTokens,
                        model: $selectedModel,
                        cacheHit: false,
                        responseTimeMs: $responseTimeMs
                    );

                    return [
                        'success' => true,
                        'response' => $text,
                        'model_used' => $selectedModel,
                        'usage' => [
                            'prompt_tokens' => $promptTokens,
                            'completion_tokens' => $completionTokens,
                            'total_tokens' => $promptTokens + $completionTokens,
                        ],
                    ];
                }

                return ['success' => false, 'message' => 'Resposta vazia.'];
            }

            $errorBody = $response->json();
            $errorMessage = $errorBody['error']['message'] ?? 'Erro desconhecido';
            
            Log::error('AI API error', [
                'provider' => $this->provider,
                'status' => $response->status(),
                'error' => $errorMessage,
                'model' => $selectedModel
            ]);

            if ($response->status() === 429) {
                return ['success' => false, 'message' => 'Limite da API atingido. Aguarde.'];
            }

            return ['success' => false, 'message' => 'Erro na API: ' . $errorMessage];

        } catch (\Exception $e) {
            Log::error('AI provider error', ['provider' => $this->provider, 'error' => $e->getMessage()]);
            return ['success' => false, 'message' => 'Erro ao processar.'];
        }
    }

    /**
     * Gemini: generateContent API call
     */
    private function callGeminiGenerateContent(
        string $feature,
        string $prompt,
        string $systemInstruction,
        float $temperature,
        int $maxTokens,
        float $startTime
    ): array {
        try {
            $url = "{$this->geminiBaseUrl}/models/{$this->geminiModel}:generateContent?key={$this->geminiApiKey}";

            $inputText = trim($systemInstruction) ? (trim($systemInstruction) . "\n\n" . $prompt) : $prompt;

            $requestBody = [
                'contents' => [
                    [
                        'role' => 'user',
                        'parts' => [
                            ['text' => $inputText],
                        ],
                    ],
                ],
                'generationConfig' => [
                    'temperature' => $temperature,
                    'maxOutputTokens' => $maxTokens,
                    'topP' => 0.9,
                ],
            ];

            $response = Http::timeout(30)
                ->withHeaders(['Content-Type' => 'application/json'])
                ->post($url, $requestBody);

            $responseTimeMs = (int) ((microtime(true) - $startTime) * 1000);
            $this->getTokenService()->incrementRateLimit();

            if ($response->successful()) {
                $data = $response->json();
                $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? null;
                if (!$text) {
                    return ['success' => false, 'message' => 'Resposta vazia.'];
                }

                $usage = $data['usageMetadata'] ?? [];
                $promptTokens = (int) ($usage['promptTokenCount'] ?? 0);
                $completionTokens = (int) ($usage['candidatesTokenCount'] ?? 0);

                $this->getTokenService()->recordUsage(
                    feature: $feature,
                    promptTokens: $promptTokens,
                    completionTokens: $completionTokens,
                    model: $this->geminiModel,
                    cacheHit: false,
                    responseTimeMs: $responseTimeMs
                );

                return [
                    'success' => true,
                    'response' => $text,
                    'model_used' => $this->geminiModel,
                    'usage' => [
                        'prompt_tokens' => $promptTokens,
                        'completion_tokens' => $completionTokens,
                        'total_tokens' => $promptTokens + $completionTokens,
                    ],
                ];
            }

            $error = $response->json();
            $message = $error['error']['message'] ?? $response->body();
            Log::error('Gemini API error', ['status' => $response->status(), 'error' => $message]);

            if ($response->status() === 429) {
                return ['success' => false, 'message' => 'Limite da API atingido. Aguarde.'];
            }

            return ['success' => false, 'message' => 'Erro na API: ' . $message];
        } catch (\Exception $e) {
            Log::error('Gemini error', ['error' => $e->getMessage()]);
            return ['success' => false, 'message' => 'Erro ao processar.'];
        }
    }

    /**
     * Compacta system prompts removendo verbosidade
     */
    private function compactSystemPrompt(string $prompt): string
    {
        // Remove espaços extras e quebras de linha múltiplas
        $prompt = preg_replace('/\s+/', ' ', trim($prompt));
        // Limita tamanho máximo do system prompt
        return $this->truncate($prompt, 300);
    }

    /**
     * Generate chatbot response with learning integration and cost optimization
     */
    public function generateChatResponse(string $message, array $context, array $instructions, ?string $conversationId = null): array
    {
        // Validate and fix conversation_id if needed
        if ($conversationId && !\Illuminate\Support\Str::isUuid($conversationId)) {
            $originalId = $conversationId;
            $conversationId = (string) \Illuminate\Support\Str::uuid();
            Log::warning('Non-UUID conversation_id converted to UUID', [
                'original' => $originalId,
                'generated' => $conversationId
            ]);
        }
        
        $messageLength = strlen($message);
        
        // OTIMIZAÇÃO 1: Respostas prontas para saudações simples (sem API)
        $quickResponse = $this->getQuickResponse($message);
        if ($quickResponse) {
            
            Log::debug('AI using quick response (no API call)', ['message' => substr($message, 0, 30)]);
            return [
                'success' => true,
                'response' => $quickResponse,
                'source' => 'quick_response',
                'tokens_saved' => true,
            ];
        }

        // OTIMIZAÇÃO 2: Check FAQ cache first (learned responses) - sem chamar API
        if ($this->learningEnabled) {
            $faq = $this->getLearningService()->findSimilarFAQ($message);
            if ($faq && $faq->helpfulness_score >= 0.75) {
                Log::info('AI using learned FAQ response', ['question' => substr($message, 0, 50)]);
                return [
                    'success' => true,
                    'response' => $faq->answer,
                    'source' => 'learned_faq',
                    'confidence' => $faq->helpfulness_score,
                    'tokens_saved' => true,
                ];
            }
        }

        // OTIMIZAÇÃO 3: Cache agressivo com range expandido
        $cacheKey = 'ai_response:' . $this->tenantId . ':' . md5(mb_strtolower(trim($message)));
        $cached = Cache::get($cacheKey);
        if ($cached && $messageLength >= self::MIN_CACHE_MESSAGE_LENGTH && $messageLength <= self::MAX_CACHE_MESSAGE_LENGTH) {
            $this->getTokenService()->recordUsage(
                feature: 'chat',
                promptTokens: 0,
                completionTokens: 0,
                model: $this->model,
                cacheHit: true
            );
            return ['success' => true, 'response' => $cached, 'cached' => true, 'tokens_saved' => true];
        }

        // OTIMIZAÇÃO 4: Contexto mínimo necessário
        $enrichedContext = $context;
        if ($this->learningEnabled) {
            // Só buscar contexto aprendido se realmente necessário
            if ($this->needsEnrichedContext($message)) {
            $learnedContext = $this->getLearningService()->buildEnrichedContext($message, $conversationId);
            $enrichedContext = array_merge($context, ['learned' => $learnedContext]);
            }
        }

        // OTIMIZAÇÃO 5: Prompts compactos
        $systemPrompt = $this->buildCompactSystemPrompt($instructions);
        $userPrompt = $this->buildChatPromptWithLearning($message, $enrichedContext);

        // OTIMIZAÇÃO 6: Limite de tokens baseado no tipo de mensagem
        $maxTokens = $this->isSimpleMessage($message) ? 100 : self::MAX_CHAT_RESPONSE_TOKENS;
        
        $result = $this->callGemini('chat', $userPrompt, $systemPrompt, 0.7, $maxTokens);

        if ($result['success']) {
            // OTIMIZAÇÃO 7: Cache expandido (mais mensagens cacheadas)
            if ($messageLength >= self::MIN_CACHE_MESSAGE_LENGTH && 
                $messageLength <= self::MAX_CACHE_MESSAGE_LENGTH && 
                strlen($result['response']) < 500) {
                Cache::put($cacheKey, $result['response'], self::CACHE_TTL_SECONDS);
            }

            // Update conversation context for learning
            if ($this->learningEnabled && $conversationId) {
                $this->getLearningService()->updateConversationContext(
                    $conversationId,
                    $message,
                    $result['response']
                );
            }
        }

        return $result;
    }

    /**
     * Respostas rápidas para mensagens comuns (sem API)
     */
    private function getQuickResponse(string $message): ?string
    {
        $message = mb_strtolower(trim($message));
        
        $quickResponses = [
            // Saudações
            'oi' => 'Olá! Como posso ajudar você hoje?',
            'olá' => 'Olá! Como posso ajudar você hoje?',
            'ola' => 'Olá! Como posso ajudar você hoje?',
            'hello' => 'Olá! Como posso ajudar você hoje?',
            'hi' => 'Olá! Como posso ajudar você hoje?',
            'bom dia' => 'Bom dia! Como posso ajudar?',
            'boa tarde' => 'Boa tarde! Como posso ajudar?',
            'boa noite' => 'Boa noite! Como posso ajudar?',
            
            // Confirmações
            'ok' => 'Entendido! Posso ajudar com mais alguma coisa?',
            'obrigado' => 'Por nada! Estou à disposição.',
            'obrigada' => 'Por nada! Estou à disposição.',
            'valeu' => 'Por nada! Qualquer dúvida, estou aqui.',
            
            // Despedidas
            'tchau' => 'Até mais! Foi um prazer ajudar.',
            'bye' => 'Até mais! Foi um prazer ajudar.',
            'até mais' => 'Até mais! Volte sempre.',
            'ate mais' => 'Até mais! Volte sempre.',
        ];
        
        // Match exato ou com pontuação
        $cleanMessage = preg_replace('/[!?.]+$/', '', $message);
        
        return $quickResponses[$cleanMessage] ?? $quickResponses[$message] ?? null;
    }

    /**
     * Determina se precisa de contexto enriquecido (evita queries desnecessárias)
     */
    private function needsEnrichedContext(string $message): bool
    {
        // Mensagens muito curtas não precisam de contexto
        if (strlen($message) < 20) {
            return false;
        }
        
        // Verifica se tem palavras-chave que indicam necessidade de contexto
        $contextKeywords = ['anterior', 'último', 'falamos', 'disse', 'mencionou', 'pedido', 'compra', 'serviço', 'produto'];
        $messageLower = mb_strtolower($message);
        
        foreach ($contextKeywords as $keyword) {
            if (str_contains($messageLower, $keyword)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Record feedback on a response (for learning)
     */
    public function recordFeedback(
        string $userMessage,
        string $aiResponse,
        string $rating,
        ?string $correction = null,
        ?string $conversationId = null
    ): array {
        if (!$this->learningEnabled) {
            return ['success' => false, 'message' => 'Learning disabled'];
        }

        $feedbackId = $this->getLearningService()->recordFeedback(
            $userMessage,
            $aiResponse,
            $rating,
            'chat',
            [
                'user_id' => $this->userId,
                'correction' => $correction,
                'conversation_id' => $conversationId,
            ]
        );

        return [
            'success' => true,
            'feedback_id' => $feedbackId,
            'message' => 'Feedback recorded for learning',
        ];
    }

    /**
     * Get learning statistics
     */
    public function getLearningStats(): array
    {
        return $this->getLearningService()->getStats();
    }

    /**
     * Auto-fill card data with intelligent lead analysis
     */
    public function autoFillCard(array $cardData, array $comments, array $history): array
    {
        $context = $this->buildCardContextCompact($cardData, $comments, $history);

        $systemPrompt = <<<'SYS'
Você é um assistente de vendas experiente em CRM. Analise os dados do lead e gere insights acionáveis.

Regras para "observation":
- NÃO repita informações já visíveis (nome, telefone, valor, estágio)
- Escreva uma análise estratégica: perfil do lead, nível de interesse, pontos de atenção, oportunidades
- Se houver comentários/histórico, extraia padrões e contexto relevante
- Se houver produtos, sugira cross-sell ou ajustes na proposta
- Seja direto e objetivo (2-4 frases)

Regras para "suggested_next_action":
- Ação específica e prática (não genérica como "fazer follow-up")
- Inclua prazo quando possível (ex: "Ligar amanhã às 10h para...")
- Considere o estágio atual do funil

Responda APENAS com JSON válido, sem texto adicional.
SYS;

        $prompt = <<<PROMPT
{$context}

Gere JSON: {"priority":"low|medium|high","observation":"análise estratégica do lead","suggested_next_action":"ação específica"}
PROMPT;

        $result = $this->callGemini('autofill', $prompt, $systemPrompt, 0.4, 350);

        if (!$result['success']) {
            return $result;
        }

        $json = $this->extractJsonFromResponse($result['response']);
        return $json ? ['success' => true, 'suggestions' => $json, 'usage' => $result['usage'] ?? null] : ['success' => false, 'message' => 'Não foi possível extrair sugestões.'];
    }

    /**
     * Summarize conversation (OTIMIZADO)
     */
    public function summarizeConversation(array $messages): array
    {
        if (empty($messages)) {
            return ['success' => false, 'message' => 'Sem mensagens.'];
        }

        // OTIMIZAÇÃO: Menos mensagens, truncamento mais agressivo
        $recent = array_slice($messages, -8);
        $conversation = '';
        foreach ($recent as $msg) {
            $role = $msg['direction'] === 'incoming' ? 'C' : 'A';
            $content = $this->truncate($msg['content'] ?? '', 60); // Era 100
            $conversation .= "{$role}:{$content}\n";
        }

        // OTIMIZAÇÃO: Prompt mais compacto
        $prompt = "Resumo(2linhas)+sentimento(pos/neu/neg):\n{$conversation}";

        return $this->callGemini('summarize', $prompt, '', 0.3, 120); // Era 200
    }

    /**
     * Generate email draft (OTIMIZADO)
     */
    public function generateEmailDraft(string $purpose, array $contactInfo, string $tone = 'professional'): array
    {
        $name = $contactInfo['name'] ?? 'Cliente';
        // OTIMIZAÇÃO: Prompt mais direto
        $prompt = "Email {$tone} p/ {$name}:{$purpose}. Assunto+corpo.";

        return $this->callGemini('email_draft', $prompt, 'Redator.', 0.5, 300); // Era 400
    }

    /**
     * Analyze lead quality (OTIMIZADO)
     */
    public function analyzeLeadQuality(array $leadData): array
    {
        // OTIMIZAÇÃO: Só campos essenciais
        $essentials = array_intersect_key($leadData, array_flip(['name', 'email', 'company', 'value']));
        $info = json_encode($essentials, JSON_UNESCAPED_UNICODE);

        // OTIMIZAÇÃO: Prompt mínimo
        $prompt = "Lead:{$info}\nJSON:{quality_score(1-10),qualification(hot/warm/cold),priority(high/med/low)}";

        $result = $this->callGemini('lead_analysis', $prompt, 'Analista.', 0.3, 150); // Era 200

        if (!$result['success']) {
            return $result;
        }

        $json = $this->extractJsonFromResponse($result['response']);
        return $json ? ['success' => true, 'analysis' => $json] : ['success' => false, 'message' => 'Erro na análise.'];
    }

    /**
     * Generate WhatsApp message suggestions (OTIMIZADO)
     */
    public function suggestWhatsAppMessage(string $context, string $objective): array
    {
        // OTIMIZAÇÃO: Contexto limitado
        $context = $this->truncate($context, 100);
        $prompt = "2 msgs WhatsApp curtas. Ctx:{$context}. Obj:{$objective}";

        $result = $this->callGemini('chat', $prompt, 'WhatsApp expert.', 0.7, 150); // Era 200

        if ($result['success']) {
            return ['success' => true, 'suggestions' => $result['response']];
        }

        return $result;
    }

    private function buildCompactSystemPrompt(array $instructions): string
    {
        if (!empty($instructions['custom_instructions'])) {
            return "Assistente virtual em PT-BR.\n\n" . $this->truncate($instructions['custom_instructions'], 2000);
        }

        $parts = ['Assistente virtual em PT-BR.'];

        if (!empty($instructions['function_definition'])) {
            $parts[] = "Sua função: {$this->truncate($instructions['function_definition'], 300)}";
        }

        if (!empty($instructions['company_info'])) {
            $parts[] = "Sobre a empresa/produtos: {$this->truncate($instructions['company_info'], 400)}";
        }

        if (!empty($instructions['tone'])) {
            $parts[] = "Tom da conversa: {$this->truncate($instructions['tone'], 150)}";
        }

        if (!empty($instructions['knowledge_guidelines'])) {
            $parts[] = "Orientações de conhecimento: {$this->truncate($instructions['knowledge_guidelines'], 200)}";
        }

        if (!empty($instructions['incorrect_info_prevention'])) {
            $parts[] = "IMPORTANTE - Prevenção de erros: {$this->truncate($instructions['incorrect_info_prevention'], 200)}";
        }

        if (!empty($instructions['human_escalation_rules'])) {
            $parts[] = "Encaminhar para humano quando: {$this->truncate($instructions['human_escalation_rules'], 200)}";
        }

        if (!empty($instructions['useful_links'])) {
            $parts[] = "Links úteis para compartilhar: {$this->truncate($instructions['useful_links'], 200)}";
        }

        if (!empty($instructions['conversation_examples'])) {
            $parts[] = "Exemplos de conversa:\n{$this->truncate($instructions['conversation_examples'], 300)}";
        }

        return implode("\n\n", $parts);
    }

    private function buildChatPrompt(string $message, array $context): string
    {
        $prompt = $message;

        if (!empty($context['knowledge_base']) && $this->needsKnowledgeBase($message)) {
            $kb = $this->truncate($context['knowledge_base'], 500);
            $prompt = "Contexto: {$kb}\n\nPergunta: {$message}";
        }

        return $prompt;
    }

    /**
     * Build chat prompt with learned context (OTIMIZADO)
     */
    private function buildChatPromptWithLearning(string $message, array $context): string
    {
        $parts = [];

        // OTIMIZAÇÃO: Contexto aprendido mais compacto
        if (!empty($context['learned'])) {
            $learned = $context['learned'];

            // OTIMIZAÇÃO: Máximo 2 memórias, formato compacto
            if (!empty($learned['memories'])) {
                $memoryText = array_map(
                    fn($m) => "{$m['key']}:{$m['value']}",
                    array_slice($learned['memories'], 0, 2) // Era 3
                );
                $parts[] = "Info:" . implode(';', $memoryText);
            }

            // OTIMIZAÇÃO: FAQ só se alta confiança
            if (!empty($learned['faq']) && $learned['faq']['confidence'] >= 0.6 && $learned['faq']['confidence'] < 0.75) {
                $parts[] = "Ref:" . $this->truncate($learned['faq']['answer'], 100); // Era 200
            }

            // OTIMIZAÇÃO: Contexto de conversa simplificado
            if (!empty($learned['conversation_context'])) {
                $conv = $learned['conversation_context'];
                if (!empty($conv['topics'])) {
                    $parts[] = "Tópicos:" . implode(',', array_slice($conv['topics'], 0, 3)); // Era 5
                }
            }
        }

        // OTIMIZAÇÃO: Knowledge base bem menor
        if (!empty($context['knowledge_base']) && $this->needsKnowledgeBase($message)) {
            $parts[] = "KB:" . $this->truncate($context['knowledge_base'], self::MAX_KNOWLEDGE_BASE_TOKENS);
        }

        // Build final prompt
        if (!empty($parts)) {
            return implode("\n", $parts) . "\nMsg:" . $message;
        }

        return $message;
    }

    private function needsKnowledgeBase(string $message): bool
    {
        $questionWords = ['como', 'qual', 'quando', 'onde', 'quanto', 'preço', 'valor', 'horário', 'funciona', 'serviço', 'produto', '?'];
        $messageLower = mb_strtolower($message);
        
        foreach ($questionWords as $word) {
            if (str_contains($messageLower, $word)) {
                return true;
            }
        }
        
        return false;
    }

    private function truncate(string $text, int $maxLength): string
    {
        return strlen($text) <= $maxLength ? $text : substr($text, 0, $maxLength) . '...';
    }

    private function buildCardContextCompact(array $cardData, array $comments, array $history): string
    {
        $lines = [];

        // Contact info
        $contact = $cardData['contact'] ?? [];
        if (!empty($contact['name'])) {
            $contactLine = "Contato: {$contact['name']}";
            if (!empty($contact['type'])) $contactLine .= " ({$contact['type']})";
            if (!empty($contact['company_name'])) $contactLine .= " - {$contact['company_name']}";
            $lines[] = $contactLine;

            if (!empty($contact['city']) || !empty($contact['state'])) {
                $lines[] = "Local: " . trim(($contact['city'] ?? '') . '/' . ($contact['state'] ?? ''), '/');
            }
            if (!empty($contact['status'])) {
                $lines[] = "Status do contato: {$contact['status']}";
            }
            if (!empty($contact['notes'])) {
                $lines[] = "Notas do contato: " . $this->truncate($contact['notes'], 150);
            }
        }

        // Card/deal info
        $lines[] = "Estágio: " . ($cardData['stage']['name'] ?? 'N/A');
        if (!empty($cardData['value'])) {
            $lines[] = "Valor do negócio: R$ " . number_format((float)$cardData['value'], 2, ',', '.');
        }
        if (!empty($cardData['priority'])) {
            $lines[] = "Prioridade atual: {$cardData['priority']}";
        }
        if (!empty($cardData['expected_close_date'])) {
            $lines[] = "Previsão de fechamento: {$cardData['expected_close_date']}";
        }
        if (!empty($cardData['description'])) {
            $lines[] = "Observação atual: " . $this->truncate($cardData['description'], 200);
        }

        // Products on the deal
        $products = $cardData['products'] ?? [];
        if (!empty($products)) {
            $productNames = [];
            $totalProducts = 0;
            foreach ($products as $p) {
                $name = $p['product']['name'] ?? ($p['name'] ?? 'Produto');
                $qty = $p['quantity'] ?? 1;
                $price = $p['unit_price'] ?? $p['price'] ?? 0;
                $productNames[] = "{$name} ({$qty}x R$" . number_format((float)$price, 0, ',', '.') . ")";
                $totalProducts += ($qty * $price);
            }
            $lines[] = "Produtos/Serviços: " . implode(', ', $productNames);
        }

        // Tasks
        $tasks = $cardData['tasks'] ?? [];
        if (!empty($tasks)) {
            $pending = array_filter($tasks, fn($t) => !($t['completed_at'] ?? null));
            $completed = count($tasks) - count($pending);
            $lines[] = "Tarefas: " . count($pending) . " pendente(s), {$completed} concluída(s)";
            foreach (array_slice($pending, 0, 2) as $t) {
                $taskLine = "- {$t['title']}";
                if (!empty($t['scheduled_at'])) $taskLine .= " (agenda: {$t['scheduled_at']})";
                $lines[] = $taskLine;
            }
        }

        // Comments (most recent and relevant)
        if (!empty($comments)) {
            $lines[] = "--- Comentários recentes ---";
            $recent = array_slice($comments, -5);
            foreach ($recent as $c) {
                $author = $c['user']['name'] ?? 'Usuário';
                $date = isset($c['created_at']) ? substr($c['created_at'], 0, 10) : '';
                $lines[] = "[{$author} {$date}] " . $this->truncate($c['content'] ?? '', 150);
            }
        }

        // History (stage changes, key actions)
        if (!empty($history)) {
            $stageChanges = array_filter($history, fn($h) => ($h['action'] ?? '') === 'stage_changed');
            if (!empty($stageChanges)) {
                $recent = array_slice($stageChanges, -3);
                $lines[] = "--- Movimentações no funil ---";
                foreach ($recent as $h) {
                    $from = $h['old_stage_name'] ?? $h['metadata']['from_stage'] ?? '?';
                    $to = $h['new_stage_name'] ?? $h['metadata']['to_stage'] ?? '?';
                    $date = isset($h['created_at']) ? substr($h['created_at'], 0, 10) : '';
                    $lines[] = "{$date}: {$from} → {$to}";
                }
            }
        }

        // Card age
        if (!empty($cardData['created_at'])) {
            $created = strtotime($cardData['created_at']);
            if ($created) {
                $daysOpen = (int) ((time() - $created) / 86400);
                $lines[] = "Dias no funil: {$daysOpen}";
            }
        }

        return implode("\n", $lines);
    }

    private function extractJsonFromResponse(string $content): ?array
    {
        $content = preg_replace('/```json\s*/i', '', $content);
        $content = preg_replace('/```\s*$/', '', $content);
        $content = preg_replace('/^```\s*/m', '', $content);
        
        if (preg_match('/\{[\s\S]*\}/u', $content, $matches)) {
            $decoded = json_decode(trim($matches[0]), true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                return $decoded;
            }
        }
        
        return null;
    }
}
