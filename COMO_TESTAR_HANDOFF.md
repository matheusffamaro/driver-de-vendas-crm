# 🧪 Como Testar o Handoff (Human Takeover)

## 📋 O que é Handoff?

Handoff é o mecanismo que **para a IA de responder** quando um humano assume a conversa. Isso economiza tokens e evita respostas duplicadas.

**Comportamento esperado:**
1. Cliente envia mensagem → ✅ IA responde
2. Humano assume e envia mensagem → 🔄 Handoff ativado
3. Cliente envia nova mensagem → ❌ IA NÃO responde (humano está no controle)

---

## 🚀 Método 1: Script Automático (Recomendado)

### No servidor, execute:

```bash
# Baixar e executar (após deploy)
cd /tmp
curl -O https://raw.githubusercontent.com/matheusffamaro/driver-de-vendas-crm/main/testar-handoff-completo.sh
chmod +x testar-handoff-completo.sh
bash testar-handoff-completo.sh
```

### Ou copie e cole este comando único:

```bash
bash <(curl -s https://raw.githubusercontent.com/matheusffamaro/driver-de-vendas-crm/main/testar-handoff-completo.sh)
```

### O script vai:
1. ✅ Criar conversa de teste
2. ✅ Testar se IA responde (sem handoff)
3. ✅ Simular humano assumindo
4. ✅ Testar se IA para (com handoff)
5. ✅ Mostrar histórico completo
6. ✅ Limpar dados de teste

---

## 🎯 Método 2: Teste Manual Passo a Passo

### Passo 1: Preparar ambiente

```bash
# Buscar sessão ativa com IA
docker exec dv-api php -r "
require '/var/www/html/vendor/autoload.php';
\$app = require_once '/var/www/html/bootstrap/app.php';
\$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

\$session = \App\Models\WhatsappSession::where('status', 'connected')
    ->whereHas('aiAgentSettings', function(\$q) {
        \$q->where('is_active', true);
    })
    ->first();

if (!\$session) {
    echo 'ERROR: Nenhuma sessão com IA ativa\n';
    exit(1);
}

echo 'SESSION_ID=' . \$session->id . '\n';
echo 'SESSION_PHONE=' . \$session->phone_number . '\n';
"
```

**Copie o SESSION_ID do resultado acima.**

### Passo 2: Criar conversa de teste

```bash
# Substitua <SESSION_ID> pelo ID obtido acima
docker exec dv-api php -r "
require '/var/www/html/vendor/autoload.php';
\$app = require_once '/var/www/html/bootstrap/app.php';
\$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

\$conv = \App\Models\WhatsappConversation::create([
    'id' => \Illuminate\Support\Str::uuid(),
    'session_id' => '<SESSION_ID>',
    'remote_jid' => '5599999999999@s.whatsapp.net',
    'is_group' => false,
    'contact_phone' => '5599999999999',
    'contact_name' => 'Teste Handoff',
    'last_message_at' => now(),
]);

echo 'CONVERSATION_ID=' . \$conv->id . '\n';
"
```

**Copie o CONVERSATION_ID do resultado acima.**

### Passo 3: Teste 1 - IA deve responder

```bash
# Criar mensagem do cliente
docker exec dv-api php -r "
require '/var/www/html/vendor/autoload.php';
\$app = require_once '/var/www/html/bootstrap/app.php';
\$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

\App\Models\WhatsappMessage::create([
    'id' => \Illuminate\Support\Str::uuid(),
    'conversation_id' => '<CONVERSATION_ID>',
    'message_id' => 'test-msg-1-' . time(),
    'direction' => 'incoming',
    'type' => 'text',
    'content' => 'Olá, preciso de ajuda',
    'status' => 'received',
    'sender_name' => 'Teste Handoff',
    'sent_at' => now(),
]);

echo '✅ Mensagem criada\n';
"

# Aguardar 3 segundos
sleep 3

# Verificar se IA respondeu
docker exec dv-api php -r "
require '/var/www/html/vendor/autoload.php';
\$app = require_once '/var/www/html/bootstrap/app.php';
\$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

\$aiResponse = \App\Models\WhatsappMessage::where('conversation_id', '<CONVERSATION_ID>')
    ->where('direction', 'outgoing')
    ->where('sender_name', 'AI Agent')
    ->where('created_at', '>=', now()->subSeconds(5))
    ->exists();

echo \$aiResponse ? '✅ IA RESPONDEU (correto)\n' : '❌ IA NÃO RESPONDEU (erro)\n';
"
```

### Passo 4: Simular handoff

```bash
# Enviar mensagem HUMANA
docker exec dv-api php -r "
require '/var/www/html/vendor/autoload.php';
\$app = require_once '/var/www/html/bootstrap/app.php';
\$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

\App\Models\WhatsappMessage::create([
    'id' => \Illuminate\Support\Str::uuid(),
    'conversation_id' => '<CONVERSATION_ID>',
    'message_id' => 'test-msg-human-' . time(),
    'direction' => 'outgoing',
    'type' => 'text',
    'content' => 'Eu assumo daqui!',
    'status' => 'sent',
    'sender_name' => 'Administrador',
    'sent_at' => now(),
]);

echo '✅ Mensagem HUMANA enviada (handoff ativo)\n';
"
```

### Passo 5: Teste 2 - IA NÃO deve responder

```bash
# Enviar nova mensagem do cliente
docker exec dv-api php -r "
require '/var/www/html/vendor/autoload.php';
\$app = require_once '/var/www/html/bootstrap/app.php';
\$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

\App\Models\WhatsappMessage::create([
    'id' => \Illuminate\Support\Str::uuid(),
    'conversation_id' => '<CONVERSATION_ID>',
    'message_id' => 'test-msg-2-' . time(),
    'direction' => 'incoming',
    'type' => 'text',
    'content' => 'Pode me ajudar?',
    'status' => 'received',
    'sender_name' => 'Teste Handoff',
    'sent_at' => now(),
]);

echo '✅ Segunda mensagem criada\n';
"

# Aguardar 5 segundos
sleep 5

# Verificar se IA NÃO respondeu
docker exec dv-api php -r "
require '/var/www/html/vendor/autoload.php';
\$app = require_once '/var/www/html/bootstrap/app.php';
\$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

\$aiResponse = \App\Models\WhatsappMessage::where('conversation_id', '<CONVERSATION_ID>')
    ->where('direction', 'outgoing')
    ->where('sender_name', 'AI Agent')
    ->where('created_at', '>=', now()->subSeconds(8))
    ->orderBy('created_at', 'desc')
    ->first();

if (\$aiResponse && \$aiResponse->created_at > now()->subSeconds(8)) {
    echo '❌ IA RESPONDEU (handoff não funcionou)\n';
} else {
    echo '✅ IA NÃO RESPONDEU (handoff funcionando!)\n';
}
"
```

### Passo 6: Limpar dados de teste

```bash
# Deletar conversa e mensagens de teste
docker exec dv-api php -r "
require '/var/www/html/vendor/autoload.php';
\$app = require_once '/var/www/html/bootstrap/app.php';
\$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

\$conv = \App\Models\WhatsappConversation::find('<CONVERSATION_ID>');
if (\$conv) {
    \App\Models\WhatsappMessage::where('conversation_id', '<CONVERSATION_ID>')->forceDelete();
    \$conv->forceDelete();
    echo '✅ Dados de teste deletados\n';
}
"
```

---

## 🔍 Método 3: Verificar Handoff em Conversa Real

Se quiser testar com uma conversa real existente:

```bash
# Ver conversas disponíveis
docker exec dv-api php -r "
require '/var/www/html/vendor/autoload.php';
\$app = require_once '/var/www/html/bootstrap/app.php';
\$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

\$convs = \App\Models\WhatsappConversation::where('is_group', false)
    ->orderBy('last_message_at', 'desc')
    ->limit(5)
    ->get();

foreach (\$convs as \$c) {
    echo \$c->id . ' | ' . (\$c->contact_name ?? 'Sem nome') . ' | ' . \$c->contact_phone . '\n';
}
"

# Verificar se handoff está ativo numa conversa específica
docker exec dv-api php -r "
require '/var/www/html/vendor/autoload.php';
\$app = require_once '/var/www/html/bootstrap/app.php';
\$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

\$convId = '<CONVERSATION_ID>';

\$hasHumanMsg = \App\Models\WhatsappMessage::where('conversation_id', \$convId)
    ->where('direction', 'outgoing')
    ->where('created_at', '>=', now()->subMinutes(30))
    ->where(function(\$q) {
        \$q->whereNull('sender_name')
          ->orWhere('sender_name', '!=', 'AI Agent');
    })
    ->exists();

echo 'Handoff ativo? ' . (\$hasHumanMsg ? '✅ SIM (IA não vai responder)' : '❌ NÃO (IA vai responder)') . '\n';

\$lastHuman = \App\Models\WhatsappMessage::where('conversation_id', \$convId)
    ->where('direction', 'outgoing')
    ->where(function(\$q) {
        \$q->whereNull('sender_name')
          ->orWhere('sender_name', '!=', 'AI Agent');
    })
    ->orderBy('created_at', 'desc')
    ->first();

if (\$lastHuman) {
    \$ago = \$lastHuman->created_at->diffForHumans();
    echo 'Última mensagem humana: ' . \$ago . ' por ' . (\$lastHuman->sender_name ?? 'Usuário') . '\n';
}
"
```

---

## 📊 Interpretação dos Resultados

### ✅ Sucesso Total
```
✅ Teste 1: IA respondeu quando deveria
✅ Teste 2: IA parou após handoff
🎉 Handoff funcionando 100%!
```

### ❌ IA não responde nunca
```
❌ Teste 1: IA NÃO respondeu
⚠️  Problema: IA não está configurada ou API key inválida
```

**Solução:**
- Verificar se IA está ativa: `docker exec dv-api php artisan ai:status`
- Verificar API key: `docker exec dv-api php -r "echo env('GROQ_API_KEY') ? 'OK' : 'FALTANDO';"`

### ❌ Handoff não funciona
```
✅ Teste 1: IA respondeu
❌ Teste 2: IA respondeu mesmo após handoff
⚠️  Problema: Lógica de handoff com bug
```

**Solução:**
- Ver logs: `docker exec dv-api tail -100 storage/logs/laravel.log | grep -i handoff`
- Verificar código: `WhatsappAIAgentService.php` e `WhatsappController.php`

---

## 🐛 Troubleshooting

### Erro: "Nenhuma sessão com IA ativa"
```bash
# Ativar IA para uma sessão
docker exec dv-api php -r "
require '/var/www/html/vendor/autoload.php';
\$app = require_once '/var/www/html/bootstrap/app.php';
\$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

\$session = \App\Models\WhatsappSession::where('status', 'connected')->first();
if (!\$session) { echo 'Nenhuma sessão conectada\n'; exit(1); }

\$settings = \$session->aiAgentSettings()->firstOrCreate([
    'session_id' => \$session->id,
], [
    'id' => \Illuminate\Support\Str::uuid(),
    'is_active' => true,
    'model' => 'llama-3.3-70b-versatile',
]);

\$settings->update(['is_active' => true]);
echo '✅ IA ativada para sessão: ' . \$session->phone_number . '\n';
"
```

### Erro: "IA não responde"
```bash
# Verificar queue worker
docker exec dv-api php artisan queue:work --once

# Verificar se há jobs pendentes
docker exec dv-api php -r "
require '/var/www/html/vendor/autoload.php';
\$app = require_once '/var/www/html/bootstrap/app.php';
\$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

\$pending = \Illuminate\Support\Facades\DB::table('jobs')->count();
echo 'Jobs pendentes: ' . \$pending . '\n';
"

# Ver últimas 20 linhas do log
docker exec dv-api tail -20 storage/logs/laravel.log
```

### Erro: "Handoff não funciona"
```bash
# Ver se hasRecentHumanMessage está detectando corretamente
docker exec dv-api php -r "
require '/var/www/html/vendor/autoload.php';
\$app = require_once '/var/www/html/bootstrap/app.php';
\$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

\$convId = '<CONVERSATION_ID>';

\$humanMsgs = \App\Models\WhatsappMessage::where('conversation_id', \$convId)
    ->where('direction', 'outgoing')
    ->where('created_at', '>=', now()->subMinutes(30))
    ->get();

echo 'Mensagens outgoing (últimos 30min): ' . \$humanMsgs->count() . '\n\n';

foreach (\$humanMsgs as \$msg) {
    \$isHuman = !\$msg->sender_name || \$msg->sender_name !== 'AI Agent';
    echo (\$isHuman ? '👤' : '🤖') . ' ' . (\$msg->sender_name ?? 'NULL') . ' - ' . \$msg->content . '\n';
}
"
```

---

## 📝 Checklist de Validação

Após executar o teste, validar:

- [ ] Teste 1 passou: IA respondeu inicialmente
- [ ] Handoff ativado: Mensagem humana detectada
- [ ] Teste 2 passou: IA parou de responder
- [ ] Logs mostram: "Human takeover detected"
- [ ] Interface mostra: Apenas 1 resposta da IA

---

## 🎓 Entendendo o Handoff

### Como funciona:
```php
// Em WhatsappAIAgentService::processAutoResponse()
if ($this->hasRecentHumanMessage($conversation)) {
    Log::info('Human takeover detected, skipping response');
    return; // IA para de responder!
}

// hasRecentHumanMessage() verifica:
// - Mensagens outgoing (do vendedor para cliente)
// - Últimos 30 minutos
// - sender_name != 'AI Agent' (ou NULL = humano)
```

### Janela de Handoff:
- **30 minutos**: Se humano enviou mensagem há menos de 30min, IA não responde
- **Depois de 30min**: Handoff expira, IA volta a responder automaticamente

### Por que 30 minutos?
- Tempo suficiente para humano concluir atendimento
- Se cliente voltar depois de 30min sem resposta humana, IA retoma
- Evita conversas "abandonadas" sem resposta

---

## 🚀 Automação de Testes

### Adicionar ao CI/CD (.github/workflows/test.yml)

```yaml
- name: Test Handoff
  run: |
    docker exec dv-api php artisan test --filter HandoffTest
```

### Criar teste PHPUnit

```php
// tests/Feature/WhatsappHandoffTest.php
public function test_ai_stops_responding_after_human_takeover()
{
    // Arrange
    $conversation = WhatsappConversation::factory()->create();
    
    // Act - IA responde inicialmente
    $this->createIncomingMessage($conversation, 'Olá');
    $this->assertHasAiResponse($conversation);
    
    // Act - Humano assume
    $this->createHumanMessage($conversation, 'Eu assumo');
    
    // Act - Cliente envia nova mensagem
    $this->createIncomingMessage($conversation, 'Pode ajudar?');
    
    // Assert - IA NÃO responde
    $this->assertNoNewAiResponse($conversation);
}
```

---

## 📚 Arquivos Relacionados

- `backend/app/Services/Whatsapp/WhatsappAIAgentService.php` - Lógica principal
- `backend/app/Http/Controllers/Api/WhatsappController.php` - Segundo ponto de verificação
- `backend/app/Models/WhatsappConversation.php` - Método `hasRecentHumanMessage()`

---

## 🎯 Comandos Rápidos

```bash
# Ver se handoff está ativo numa conversa
docker exec dv-api php artisan whatsapp:check-handoff <conversation_id>

# Forçar handoff (manual)
docker exec dv-api php artisan whatsapp:force-handoff <conversation_id>

# Resetar handoff (IA volta a responder)
docker exec dv-api php artisan whatsapp:reset-handoff <conversation_id>
```

---

**Executar o script e reportar resultado!** 🚀
