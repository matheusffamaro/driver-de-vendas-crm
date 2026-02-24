# 📝 Exemplo Prático - Como Migrar o Controller para Usar os Services

## 🎯 Objetivo

Mostrar como migrar gradualmente o `WhatsappController.php` atual para usar os novos Services, sem quebrar nada.

## 📦 Passo 1: Adicionar Services ao Controller

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Whatsapp\WhatsappSessionService;
use App\Services\Whatsapp\WhatsappConversationService;
use App\Services\Whatsapp\WhatsappMessageService;
use App\Services\Whatsapp\WhatsappWebhookService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WhatsappController extends Controller
{
    // ✅ Adicionar Services via constructor injection
    public function __construct(
        private WhatsappSessionService $sessionService,
        private WhatsappConversationService $conversationService,
        private WhatsappMessageService $messageService,
        private WhatsappWebhookService $webhookService
    ) {}

    // ... resto do código existente
}
```

## 🔄 Passo 2: Migrar Método por Método

### Exemplo 1: `listSessions()`

**❌ ANTES (código antigo - 15 linhas)**:
```php
public function listSessions(): JsonResponse
{
    $user = auth()->user();
    $tenantId = $user?->tenant_id;

    $query = WhatsappSession::query()
        ->when($tenantId, fn($q) => $q->where('tenant_id', $tenantId));

    // SECURITY: Sales users see only their own sessions
    // Admins and Managers see all sessions
    if ($user && !$user->isAdmin() && !$user->isManager()) {
        $query->where('user_id', $user->id);
    }

    $sessions = $query->orderByDesc('connected_at')->get();

    return response()->json([
        'success' => true,
        'data' => $sessions,
    ]);
}
```

**✅ DEPOIS (usando Service - 5 linhas)**:
```php
public function listSessions(Request $request): JsonResponse
{
    $sessions = $this->sessionService->listSessions($request->user());
    
    return response()->json([
        'success' => true,
        'data' => $sessions,
    ]);
}
```

**Redução**: 15 linhas → 5 linhas (**67% menor**)

---

### Exemplo 2: `createSession()`

**❌ ANTES (código antigo - 70 linhas)**:
```php
public function createSession(Request $request): JsonResponse
{
    $request->validate([
        'phone_number' => 'required|string',
        'session_name' => 'nullable|string',
        'is_global' => 'nullable|boolean',
    ]);

    $user = $request->user();
    $tenantId = $user?->tenant_id;

    // Check if session already exists (scoped by tenant when available)
    $existing = WhatsappSession::withTrashed()
        ->where('phone_number', $request->phone_number)
        ->when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
        ->first();

    if ($existing) {
        if ($existing->trashed()) {
            $existing->restore();
        }
        $session = $existing;
        $session->update([
            'session_name' => $request->session_name ?? $existing->session_name,
            'status' => 'connecting',
        ]);
    } else {
        // SECURITY: Only admins/managers can create global sessions
        // Sales users always create sessions assigned to themselves
        $isGlobal = false;
        $userId = $user ? $user->id : null;

        if ($user && ($user->isAdmin() || $user->isManager())) {
            $isGlobal = $request->boolean('is_global', false);
            $userId = $isGlobal ? null : $user->id;
        }

        $session = WhatsappSession::create([
            'id' => Str::uuid(),
            'tenant_id' => $tenantId,
            'user_id' => $userId,
            'phone_number' => $request->phone_number,
            'session_name' => $request->session_name,
            'status' => 'connecting',
        ]);
    }

    try {
        $response = Http::timeout($this->timeout)->post("{$this->serviceUrl}/sessions", [
            'sessionId' => $session->id,
            'phoneNumber' => $session->phone_number,
        ]);

        if ($response->successful()) {
            return response()->json([
                'success' => true,
                'message' => 'Sessão iniciada com sucesso. Aguardando QR Code.',
                'data' => ['session' => $session],
            ]);
        } else {
            $session->update(['status' => 'failed']);
            return response()->json([
                'success' => false,
                'message' => 'Erro ao iniciar sessão no serviço WhatsApp.',
            ], $response->status());
        }
    } catch (\Exception $e) {
        Log::error('WhatsApp session creation error: ' . $e->getMessage());
        $session->update(['status' => 'failed']);
        return response()->json([
            'success' => false,
            'message' => 'Erro de comunicação com o serviço WhatsApp.',
        ], 500);
    }
}
```

**✅ DEPOIS (usando Service - 15 linhas)**:
```php
public function createSession(Request $request): JsonResponse
{
    $request->validate([
        'phone_number' => 'required|string',
        'session_name' => 'nullable|string',
        'is_global' => 'nullable|boolean',
    ]);

    $result = $this->sessionService->createSession(
        phoneNumber: $request->phone_number,
        user: $request->user(),
        sessionName: $request->session_name,
        isGlobal: $request->boolean('is_global')
    );

    return response()->json([
        'success' => $result['success'],
        'message' => $result['message'],
        'data' => ['session' => $result['session']],
    ], $result['success'] ? 200 : 500);
}
```

**Redução**: 70 linhas → 15 linhas (**79% menor**)

---

### Exemplo 3: `webhook()`

**❌ ANTES (código antigo - 450+ linhas com métodos privados)**:
```php
public function webhook(Request $request): JsonResponse
{
    $event = $request->input('event');
    $sessionId = $request->input('sessionId');
    $allData = $request->all();

    Log::info("WhatsApp webhook: {$event}", ['sessionId' => $sessionId]);

    $session = WhatsappSession::withTrashed()->find($sessionId);
    if (!$session) {
        return response()->json(['success' => false, 'message' => 'Session not found'], 404);
    }

    if ($session->trashed()) {
        return response()->json(['success' => true, 'message' => 'Session deleted, ignoring webhook']);
    }

    switch ($event) {
        case 'qr_code':
            $session->update([
                'status' => 'qr_code',
                'qr_code' => $allData['qrCode'] ?? $allData['qr'] ?? null,
            ]);
            break;
        case 'connected':
            $session->update([
                'status' => 'connected',
                'phone_number' => $allData['phoneNumber'] ?? $session->phone_number,
                'qr_code' => null,
                'connected_at' => now(),
                'last_activity_at' => now(),
            ]);
            break;
        case 'disconnected':
        case 'logged_out':
            $session->update([
                'status' => 'disconnected',
                'qr_code' => null,
            ]);
            break;
        case 'message':
            $this->handleIncomingMessage($session, $allData);
            break;
        case 'message_status':
            $this->handleMessageStatus($allData);
            break;
    }

    return response()->json(['success' => true]);
}

// + 200 linhas do método handleIncomingMessage()
// + 270 linhas do método processAiAgentResponse()
// + 30 linhas do método detectIntent()
// + 20 linhas do método extractKeywordsForLearning()
// + 10 linhas do método handleMessageStatus()
```

**✅ DEPOIS (usando Service - 3 linhas)**:
```php
public function webhook(Request $request): JsonResponse
{
    return response()->json(
        $this->webhookService->handleWebhook($request->all())
    );
}
```

**Redução**: 450+ linhas → 3 linhas (**99% menor**)

---

### Exemplo 4: `listConversations()`

**❌ ANTES (70 linhas)**:
```php
public function listConversations(Request $request, string $sessionId): JsonResponse
{
    $user = $request->user();

    $session = WhatsappSession::where('id', $sessionId)
        ->where('tenant_id', $user?->tenant_id)
        ->firstOrFail();

    // SECURITY: Sales users can only access their own sessions
    if ($user && !$user->isAdmin() && !$user->isManager() && $session->user_id !== $user->id) {
        return response()->json([
            'success' => false,
            'message' => 'Acesso negado.',
        ], 403);
    }

    $query = WhatsappConversation::where('session_id', $session->id)
        ->with(['contact', 'assignedUser', 'lastMessage']);

    // Filter archived
    if (!$request->boolean('include_archived', false)) {
        $query->where('is_archived', false);
    }

    // SECURITY: Sales users only see conversations assigned to them
    // Admins and Managers see all conversations
    if ($user && !$user->isAdmin() && !$user->isManager()) {
        $query->where('assigned_user_id', $user->id);
    } elseif ($user && ($user->isAdmin() || $user->isManager()) && $request->filled('assigned_to')) {
        // Admins/Managers can filter by assigned user
        $query->where('assigned_user_id', $request->assigned_to);
    }

    // Admins/Managers can filter by seller signature
    if ($user && ($user->isAdmin() || $user->isManager()) && $request->filled('assigned_signature')) {
        $signature = strtoupper($request->assigned_signature);
        $query->whereHas('assignedUser', function ($q) use ($signature) {
            $q->where('signature', $signature);
        });
    }

    // Explicit "my conversations" filter (for admins/managers)
    if ($request->boolean('my_conversations') && $user && ($user->isAdmin() || $user->isManager())) {
        $query->where('assigned_user_id', $user->id);
    }

    // Search filter
    if ($request->has('search') && $request->search) {
        $search = $request->search;
        $query->where(function ($q) use ($search) {
            $q->where('contact_name', 'ilike', "%{$search}%")
              ->orWhere('contact_phone', 'ilike', "%{$search}%");
        });
    }

    $conversations = $query->orderByDesc('is_pinned')
        ->orderByDesc('last_message_at')
        ->get();

    return response()->json([
        'success' => true,
        'data' => $conversations,
    ]);
}
```

**✅ DEPOIS (15 linhas)**:
```php
public function listConversations(Request $request, string $sessionId): JsonResponse
{
    $session = WhatsappSession::where('id', $sessionId)
        ->where('tenant_id', $request->user()->tenant_id)
        ->firstOrFail();

    // Check access
    if (!$this->sessionService->canUserAccessSession($request->user(), $session)) {
        return response()->json(['success' => false, 'message' => 'Acesso negado.'], 403);
    }

    $conversations = $this->conversationService->listConversations(
        session: $session,
        user: $request->user(),
        filters: [
            'search' => $request->search,
            'include_archived' => $request->boolean('include_archived'),
            'assigned_to' => $request->assigned_to,
            'assigned_signature' => $request->assigned_signature,
            'my_conversations' => $request->boolean('my_conversations'),
        ]
    );

    return response()->json([
        'success' => true,
        'data' => $conversations,
    ]);
}
```

**Redução**: 70 linhas → 15 linhas (**79% menor**)

---

### Exemplo 5: `sendMessage()`

**❌ ANTES (90 linhas)**:
```php
public function sendMessage(Request $request, string $conversationId): JsonResponse
{
    $user = $request->user();
    $conversation = WhatsappConversation::with('session')->findOrFail($conversationId);

    // Ensure tenant isolation
    if ($user && $conversation->session?->tenant_id !== $user->tenant_id) {
        return response()->json([
            'success' => false,
            'message' => 'Acesso negado.',
        ], 403);
    }

    // SECURITY: Sales users can only send messages in their own session's conversations
    if ($user && !$user->isAdmin() && !$user->isManager()) {
        // Check if session belongs to the user
        if ($conversation->session?->user_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Acesso negado. Você só pode enviar mensagens em sessões próprias.',
            ], 403);
        }

        // Auto-assign conversation to sender if unassigned
        if ($conversation->assigned_user_id === null) {
            $conversation->update(['assigned_user_id' => $user->id]);
        }

        // Verify conversation is assigned to the user
        if ($conversation->assigned_user_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Acesso negado. Esta conversa está atribuída a outro usuário.',
            ], 403);
        }
    }
    
    $session = $conversation->session;
    if (!$session) {
        return response()->json([
            'success' => false,
            'message' => 'Sessão WhatsApp não encontrada para esta conversa.',
        ], 404);
    }

    $request->validate([
        'type' => 'required|string|in:text,image,video,audio,document',
        'content' => 'nullable|string',
        'media' => 'nullable|file|max:50000',
    ]);

    try {
        $messageType = $request->type;
        $content = $request->content;

        if ($messageType === 'text') {
            // Send text message
            $payload = [
                'sessionId' => $session->id,
                'to' => $conversation->remote_jid,
                'text' => $content,
            ];
            $response = Http::timeout($this->timeout)->post("{$this->serviceUrl}/messages/send/text", $payload);
        } else {
            // Send media message
            $file = $request->file('media');
            if (!$file) {
                return response()->json([
                    'success' => false,
                    'message' => 'Arquivo é obrigatório para mensagens de mídia.',
                ], 422);
            }

            $fileContent = file_get_contents($file->getRealPath());
            $base64 = base64_encode($fileContent);

            $payload = [
                'sessionId' => $session->id,
                'to' => $conversation->remote_jid,
                'type' => $messageType,
                'media' => $base64,
                'mimetype' => $file->getMimeType(),
                'filename' => $file->getClientOriginalName(),
                'caption' => $content,
            ];

            $response = Http::timeout(60)->post("{$this->serviceUrl}/messages/send/media", $payload);
        }

        // ... resto do código
    } catch (\Exception $e) {
        Log::error('WhatsApp send message error: ' . $e->getMessage());
    }

    return response()->json([
        'success' => false,
        'message' => 'Erro ao enviar mensagem.',
    ], 500);
}
```

**✅ DEPOIS (25 linhas)**:
```php
public function sendMessage(Request $request, string $conversationId): JsonResponse
{
    $conversation = WhatsappConversation::with('session')->findOrFail($conversationId);
    $user = $request->user();

    // Check authorization
    $access = $this->messageService->canUserSendMessage($user, $conversation);
    if (!$access['allowed']) {
        return response()->json([
            'success' => false,
            'message' => $access['message'],
        ], 403);
    }

    $request->validate([
        'type' => 'required|string|in:text,image,video,audio,document',
        'content' => 'nullable|string',
        'media' => 'nullable|file|max:50000',
    ]);

    // Send based on type
    $result = $request->type === 'text'
        ? $this->messageService->sendTextMessage($conversation, $request->content, $user)
        : $this->messageService->sendMediaMessage($conversation, $request->file('media'), $request->type, $user, $request->content);

    return response()->json($result, $result['success'] ? 200 : 500);
}
```

**Redução**: 90 linhas → 25 linhas (**72% menor**)

---

## 📊 Resumo das Reduções

| Método | Antes | Depois | Redução |
|--------|-------|--------|---------|
| `listSessions()` | 15 linhas | 5 linhas | **67%** |
| `createSession()` | 70 linhas | 15 linhas | **79%** |
| `webhook()` | 450+ linhas | 3 linhas | **99%** |
| `listConversations()` | 70 linhas | 15 linhas | **79%** |
| `sendMessage()` | 90 linhas | 25 linhas | **72%** |

**Total**: ~700 linhas → ~65 linhas = **91% de redução**

---

## ⚡ Migração Completa do Controller

Se quiser migrar todos os métodos de uma vez, o controller ficaria assim:

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Whatsapp\WhatsappSessionService;
use App\Services\Whatsapp\WhatsappConversationService;
use App\Services\Whatsapp\WhatsappMessageService;
use App\Services\Whatsapp\WhatsappWebhookService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WhatsappController extends Controller
{
    public function __construct(
        private WhatsappSessionService $sessionService,
        private WhatsappConversationService $conversationService,
        private WhatsappMessageService $messageService,
        private WhatsappWebhookService $webhookService
    ) {}

    // ==========================================
    // SESSIONS - 5 métodos migrados
    // ==========================================

    public function listSessions(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->sessionService->listSessions($request->user()),
        ]);
    }

    public function createSession(Request $request): JsonResponse
    {
        $request->validate([
            'phone_number' => 'required|string',
            'session_name' => 'nullable|string',
            'is_global' => 'nullable|boolean',
        ]);

        $result = $this->sessionService->createSession(
            $request->phone_number,
            $request->user(),
            $request->session_name,
            $request->boolean('is_global')
        );

        return response()->json($result, $result['success'] ? 200 : 500);
    }

    // ... outros métodos de sessão...

    // ==========================================
    // WEBHOOK - 1 método migrado
    // ==========================================

    public function webhook(Request $request): JsonResponse
    {
        return response()->json($this->webhookService->handleWebhook($request->all()));
    }

    // ==========================================
    // CONVERSATIONS - 4 métodos migrados
    // ==========================================

    public function listConversations(Request $request, string $sessionId): JsonResponse
    {
        $session = WhatsappSession::where('id', $sessionId)
            ->where('tenant_id', $request->user()->tenant_id)
            ->firstOrFail();

        if (!$this->sessionService->canUserAccessSession($request->user(), $session)) {
            return response()->json(['success' => false, 'message' => 'Acesso negado.'], 403);
        }

        $conversations = $this->conversationService->listConversations(
            $session,
            $request->user(),
            [
                'search' => $request->search,
                'include_archived' => $request->boolean('include_archived'),
                'assigned_to' => $request->assigned_to,
                'my_conversations' => $request->boolean('my_conversations'),
            ]
        );

        return response()->json(['success' => true, 'data' => $conversations]);
    }

    // ... outros métodos de conversas...

    // ==========================================
    // MESSAGES - 3 métodos migrados
    // ==========================================

    public function sendMessage(Request $request, string $conversationId): JsonResponse
    {
        $conversation = WhatsappConversation::with('session')->findOrFail($conversationId);
        
        $access = $this->messageService->canUserSendMessage($request->user(), $conversation);
        if (!$access['allowed']) {
            return response()->json(['success' => false, 'message' => $access['message']], 403);
        }

        $request->validate([
            'type' => 'required|string|in:text,image,video,audio,document',
            'content' => 'nullable|string',
            'media' => 'nullable|file|max:50000',
        ]);

        $result = $request->type === 'text'
            ? $this->messageService->sendTextMessage($conversation, $request->content, $request->user())
            : $this->messageService->sendMediaMessage($conversation, $request->file('media'), $request->type, $request->user(), $request->content);

        return response()->json($result, $result['success'] ? 200 : 500);
    }

    // ... outros métodos de mensagens...
}
```

**Resultado Final**: Controller de **~400 linhas** ao invés de **2002 linhas** (**80% menor**)

---

## ✅ Checklist de Migração

### Migração Básica (Faça Agora)
- [ ] Adicionar constructor injection dos Services
- [ ] Migrar método `listSessions()`
- [ ] Migrar método `createSession()`
- [ ] Migrar método `webhook()`
- [ ] Testar se tudo continua funcionando

### Migração Completa (Quando Tiver Tempo)
- [ ] Migrar todos os métodos de sessão
- [ ] Migrar todos os métodos de conversas
- [ ] Migrar todos os métodos de mensagens
- [ ] Remover métodos privados não utilizados
- [ ] Criar testes unitários para os Services

---

**Status**: ✅ **Exemplo Completo - Pronto para Migrar**

**Impacto**: 🚀 **91% menos código, 10x mais limpo, 100% mais testável**
