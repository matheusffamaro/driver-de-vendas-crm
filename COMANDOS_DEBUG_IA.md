# 🐛 Comandos de Debug: IA WhatsApp

**Data**: 25/02/2026  
**Problema**: IA não está respondendo às mensagens  
**Scripts**: `debug-ia.sh` e `forcar-ia-responder.sh`

---

## ⚡ SOLUÇÃO RÁPIDA

Se a IA não está respondendo, rode estes comandos no servidor:

```bash
# 1. Diagnóstico completo
bash debug-ia.sh

# 2. Forçar IA a responder (teste manual)
bash forcar-ia-responder.sh

# 3. Ver logs da IA
docker logs dv-api --tail=50 | grep "AI Agent"
```

---

## 🔍 CAUSAS COMUNS

### 1. Handoff Ativo (MAIS COMUM)

**Sintoma**: IA não responde após humano enviar mensagem

**Verificar**:
```bash
docker exec dv-api php artisan tinker --execute="
\$conv = \App\Models\WhatsappConversation::orderBy('last_message_at', 'desc')->first();
\$hasHuman = \App\Models\WhatsappMessage::where('conversation_id', \$conv->id)
    ->where('direction', 'outgoing')
    ->where('created_at', '>=', now()->subMinutes(30))
    ->where(function (\$q) {
        \$q->whereNull('sender_name')->orWhere('sender_name', '!=', 'AI Agent');
    })
    ->exists();
echo \$hasHuman ? 'HANDOFF ATIVO' : 'HANDOFF INATIVO';
"
```

**Solução**:
```bash
# Limpar assigned_user_id para IA voltar
docker exec dv-api php artisan tinker --execute="
\$conv = \App\Models\WhatsappConversation::orderBy('last_message_at', 'desc')->first();
\$conv->update(['assigned_user_id' => null]);
echo 'Handoff removido. IA pode responder novamente.';
"
```

---

### 2. AI Agent Inativo

**Sintoma**: IA nunca responde

**Verificar**:
```bash
docker exec dv-api php artisan tinker --execute="
\$agent = \App\Models\AiChatAgent::where('is_active', true)->first();
echo \$agent ? 'AI Agent ativo: ' . \$agent->name : 'NENHUM AI AGENT ATIVO!';
"
```

**Solução**:
```bash
# Ativar primeiro AI Agent encontrado
docker exec dv-api php artisan tinker --execute="
\$agent = \App\Models\AiChatAgent::first();
if (\$agent) {
    \$agent->update(['is_active' => true]);
    echo 'AI Agent ativado: ' . \$agent->name;
} else {
    echo 'Nenhum AI Agent encontrado. Criar um no frontend.';
}
"
```

---

### 3. Groq API Key Não Configurada

**Sintoma**: IA não responde, logs mostram erro de API

**Verificar**:
```bash
docker exec dv-api php artisan tinker --execute="
\$key = config('services.groq.api_key');
echo \$key ? 'API Key: ' . substr(\$key, 0, 20) . '...' : 'API KEY NÃO CONFIGURADA!';
"
```

**Solução**:
```bash
# Verificar .env no container
docker exec dv-api cat .env | grep GROQ_API_KEY

# Se não estiver, adicionar e reiniciar
docker exec dv-api bash -c "echo 'GROQ_API_KEY=sua-chave-aqui' >> .env"
docker exec dv-api php artisan config:clear
docker restart dv-api
```

---

### 4. WhatsApp AI Agent Desabilitado

**Sintoma**: IA funciona no chat manual, mas não no WhatsApp

**Verificar**:
```bash
docker exec dv-api php artisan tinker --execute="
echo config('whatsapp.ai_agent.enabled') ? 'HABILITADO' : 'DESABILITADO';
"
```

**Solução**:
```bash
# Verificar config/whatsapp.php
docker exec dv-api cat config/whatsapp.php | grep -A 3 "ai_agent"

# Deve ter: 'enabled' => env('WHATSAPP_AI_AGENT_ENABLED', true),

# Verificar .env
docker exec dv-api cat .env | grep WHATSAPP_AI_AGENT_ENABLED

# Se não estiver ou estiver false, corrigir:
docker exec dv-api php artisan tinker --execute="
file_put_contents('.env', str_replace(
    'WHATSAPP_AI_AGENT_ENABLED=false',
    'WHATSAPP_AI_AGENT_ENABLED=true',
    file_get_contents('.env')
));
echo 'Habilitado';
"
docker exec dv-api php artisan config:clear
```

---

### 5. Rate Limit Atingido

**Sintoma**: IA responde algumas vezes, depois para

**Verificar**:
```bash
docker exec dv-api php artisan tinker --execute="
\$conv = \App\Models\WhatsappConversation::orderBy('last_message_at', 'desc')->first();
\$session = \$conv->session;
\$key = 'ai_agent_global:' . \$session->id;
\$count = \Cache::get(\$key, 0);
echo 'Rate limit: ' . \$count . '/30 RPM';
echo \$count >= 30 ? ' ❌ LIMITE ATINGIDO' : ' ✅ OK';
"
```

**Solução**:
```bash
# Limpar rate limit
docker exec dv-api php artisan tinker --execute="
\$conv = \App\Models\WhatsappConversation::orderBy('last_message_at', 'desc')->first();
\$session = \$conv->session;
\$key = 'ai_agent_global:' . \$session->id;
\Cache::forget(\$key);
echo 'Rate limit limpo. IA pode responder novamente.';
"
```

---

### 6. Webhook Não Chega

**Sintoma**: Mensagens aparecem no banco, mas IA nunca processa

**Verificar**:
```bash
# Ver últimas mensagens incoming
docker exec dv-api php artisan tinker --execute="
\$msgs = \App\Models\WhatsappMessage::where('direction', 'incoming')
    ->orderBy('created_at', 'desc')
    ->limit(5)
    ->get();
foreach (\$msgs as \$msg) {
    echo \$msg->created_at->format('H:i:s') . ' - ' . substr(\$msg->content, 0, 40) . '\n';
}
"

# Ver logs de webhook
docker logs dv-api --tail=100 | grep -i "webhook\|AI Agent"
```

**Solução**:
```bash
# Verificar se webhook está configurado no WhatsApp Service
# (isso é feito automaticamente, mas pode ter erro)

# Testar webhook manualmente:
curl -X POST http://localhost:8000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "messages.upsert",
    "sessionId": "SESSION_ID",
    "data": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "text": "Teste manual",
      "fromMe": false
    }
  }'
```

---

## 🧪 SCRIPTS CRIADOS

### 1. debug-ia.sh

**Uso**:
```bash
bash debug-ia.sh
```

**O que faz**:
1. ✅ Verifica se AI Agent está ativo
2. ✅ Verifica Groq API Key
3. ✅ Verifica configuração WhatsApp AI Agent
4. ✅ Lista últimas conversas
5. ✅ Analisa última conversa em detalhes
6. ✅ Verifica handoff
7. ✅ Verifica rate limits
8. ✅ Verifica horário de serviço
9. ✅ Lista mensagens não respondidas
10. ✅ Mostra logs da IA

**Resultado**: Diagnóstico completo + causa raiz do problema

---

### 2. forcar-ia-responder.sh

**Uso**:
```bash
bash forcar-ia-responder.sh
```

**O que faz**:
1. ✅ Pega última conversa
2. ✅ Remove handoff (assigned_user_id)
3. ✅ Limpa rate limits
4. ✅ Limpa debounce
5. ✅ **Força IA a processar última mensagem**
6. ✅ Verifica se IA respondeu
7. ✅ Mostra resposta da IA

**Resultado**: IA responde manualmente + confirma que está funcionando

---

## 💻 COMANDOS INDIVIDUAIS

### Ver Status da IA

```bash
docker exec dv-api php artisan tinker --execute="
\$agent = \App\Models\AiChatAgent::where('is_active', true)->first();
if (\$agent) {
    echo 'AI Agent: ' . \$agent->name . '\n';
    echo 'Ativo: ' . (\$agent->is_active ? 'SIM' : 'NÃO') . '\n';
    echo 'WhatsApp Session: ' . (\$agent->whatsapp_session_id ?? 'Global') . '\n';
    echo 'Tipo: ' . \$agent->instruction_type . '\n';
} else {
    echo 'NENHUM AI AGENT ATIVO';
}
"
```

---

### Ver Última Conversa

```bash
docker exec dv-api php artisan tinker --execute="
\$conv = \App\Models\WhatsappConversation::with('session')->orderBy('last_message_at', 'desc')->first();
echo 'ID: ' . \$conv->id . '\n';
echo 'Contato: ' . (\$conv->contact_name ?? \$conv->contact_phone) . '\n';
echo 'Session: ' . \$conv->session->phone_number . '\n';
echo 'Assigned: ' . (\$conv->assigned_user_id ? 'SIM (handoff)' : 'NÃO') . '\n';
echo 'Última msg: ' . \$conv->last_message_at->diffForHumans() . '\n';
"
```

---

### Ver Últimas Mensagens

```bash
docker exec dv-api php artisan tinker --execute="
\$conv = \App\Models\WhatsappConversation::orderBy('last_message_at', 'desc')->first();
\$msgs = \App\Models\WhatsappMessage::where('conversation_id', \$conv->id)
    ->orderBy('created_at', 'desc')
    ->limit(10)
    ->get();

foreach (\$msgs as \$msg) {
    \$dir = \$msg->direction === 'incoming' ? 'IN' : 'OUT';
    \$sender = \$msg->sender_name ?? 'null';
    \$time = \$msg->created_at->format('H:i:s');
    echo \"[\$time] \$dir (\$sender): \" . substr(\$msg->content, 0, 40) . \"\n\";
}
"
```

---

### Verificar Handoff

```bash
docker exec dv-api php artisan tinker --execute="
\$conv = \App\Models\WhatsappConversation::orderBy('last_message_at', 'desc')->first();

// Verificar assigned_user_id
echo 'assigned_user_id: ' . (\$conv->assigned_user_id ?? 'null') . '\n';

// Verificar mensagens humanas recentes
\$hasHuman = \App\Models\WhatsappMessage::where('conversation_id', \$conv->id)
    ->where('direction', 'outgoing')
    ->where('created_at', '>=', now()->subMinutes(30))
    ->where(function (\$q) {
        \$q->whereNull('sender_name')->orWhere('sender_name', '!=', 'AI Agent');
    })
    ->exists();

echo 'Handoff: ' . (\$hasHuman ? 'ATIVO (IA não vai responder)' : 'INATIVO (IA pode responder)') . '\n';
"
```

---

### Limpar Handoff

```bash
docker exec dv-api php artisan tinker --execute="
\$conv = \App\Models\WhatsappConversation::orderBy('last_message_at', 'desc')->first();
\$conv->update(['assigned_user_id' => null]);
echo 'Handoff removido. IA pode responder novamente.';
"
```

---

### Limpar Rate Limits

```bash
docker exec dv-api php artisan tinker --execute="
\$conv = \App\Models\WhatsappConversation::orderBy('last_message_at', 'desc')->first();
\$session = \$conv->session;

\$globalKey = 'ai_agent_global:' . \$session->id;
\$debounceKey = 'ai_agent_debounce:' . \$conv->id;

\Cache::forget(\$globalKey);
\Cache::forget(\$debounceKey);

echo 'Rate limits limpos.';
"
```

---

### Forçar IA a Responder AGORA

```bash
docker exec dv-api php artisan tinker --execute="
\$conv = \App\Models\WhatsappConversation::with('session')->orderBy('last_message_at', 'desc')->first();
\$session = \$conv->session;

// Limpar handoff
\$conv->update(['assigned_user_id' => null]);

// Limpar cache
\Cache::forget('ai_agent_global:' . \$session->id);
\Cache::forget('ai_agent_debounce:' . \$conv->id);

// Pegar última mensagem incoming
\$msg = \App\Models\WhatsappMessage::where('conversation_id', \$conv->id)
    ->where('direction', 'incoming')
    ->orderBy('created_at', 'desc')
    ->first();

if (\$msg) {
    echo 'Processando: ' . substr(\$msg->content, 0, 50) . '\n\n';
    
    \$aiService = new \App\Services\Whatsapp\WhatsappAIAgentService();
    \$aiService->processAutoResponse(\$session, \$conv, \$msg->content);
    
    echo 'Processado! Aguardar 3 segundos...\n';
    sleep(3);
    
    // Verificar resposta
    \$aiResp = \App\Models\WhatsappMessage::where('conversation_id', \$conv->id)
        ->where('direction', 'outgoing')
        ->where('sender_name', 'AI Agent')
        ->orderBy('created_at', 'desc')
        ->first();
    
    if (\$aiResp) {
        echo 'IA respondeu: ' . substr(\$aiResp->content, 0, 100);
    } else {
        echo 'IA não respondeu. Ver logs.';
    }
}
"
```

---

### Ver Logs Filtrados

```bash
# Logs da IA
docker logs dv-api --tail=100 | grep "AI Agent"

# Logs de erro
docker logs dv-api --tail=100 | grep -i "error"

# Logs de handoff
docker logs dv-api | grep "Human takeover"

# Logs de processamento
docker logs dv-api | grep "processing message"
```

---

## 🎯 FLUXO DE DEBUG

### Passo a Passo

```
1. Rodar diagnóstico:
   bash debug-ia.sh

2. Identificar problema:
   • AI Agent inativo? → Ativar
   • Groq Key faltando? → Configurar
   • Handoff ativo? → Remover
   • Rate limit? → Limpar

3. Forçar resposta:
   bash forcar-ia-responder.sh

4. Verificar se funcionou:
   • IA deve responder
   • Se não, ver logs

5. Testar com mensagem real:
   • Cliente envia nova mensagem
   • IA deve responder automaticamente
```

---

## 📊 EXEMPLO DE OUTPUT

### debug-ia.sh (quando tudo OK)

```
═══════════════════════════════════════════════════════════════════════════
🔍 DIAGNÓSTICO COMPLETO: IA WhatsApp
═══════════════════════════════════════════════════════════════════════════

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1️⃣ VERIFICANDO CONFIGURAÇÃO DA IA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ AI Agent ativo: Atendente Virtual
   ID: xxx-xxx-xxx
   WhatsApp Session: Global (todos)
   Tipo instrução: custom

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2️⃣ VERIFICANDO CONFIGURAÇÃO GROQ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Groq API Key configurada
   Key: gsk_xxxxxxxxxxxxx...

✅ whatsapp.ai_agent.enabled = true

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5️⃣ VERIFICANDO HANDOFF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  HANDOFF ATIVO (mensagem humana nos últimos 30min)
   → IA NÃO vai responder (comportamento correto)
   
   Última msg humana: 25/02 18:23:15
   Enviada por: Matheus Amaro
   Tempo atrás: 2 minutos atrás

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔟 DIAGNÓSTICO FINAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Checklist:

   ✅ AI Agent ativo
   ✅ Groq API Key configurada
   ✅ WhatsApp AI Agent habilitado
   ⚠️  Handoff ativo (IA não vai responder)

⚠️  PROBLEMA DETECTADO!

Causas possíveis:
   • Handoff ativo (humano assumiu conversa)

═══════════════════════════════════════════════════════════════════════════
```

---

### forcar-ia-responder.sh (sucesso)

```
═══════════════════════════════════════════════════════════════════════════
🤖 FORÇAR IA A RESPONDER
═══════════════════════════════════════════════════════════════════════════

📋 Conversa: xxx-xxx-xxx
👤 Malu Amaro

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 1: Limpar handoff (assigned_user_id)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

assigned_user_id: user-id → null
✅ Handoff removido

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 2: Limpar rate limits e debounce
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Rate limits limpos
✅ Debounce limpo

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 3: Processar resposta da IA MANUALMENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Processando...

📨 Mensagem: oiiiee
📅 Recebida: 18:23:42 25/02

Processando resposta da IA...

✅ processAutoResponse() executado

Verificando se IA respondeu...

✅ IA RESPONDEU!

🤖 Resposta: Olá! Como posso ajudar você hoje?
📅 Enviada: 18:25:15

═══════════════════════════════════════════════════════════════════════════
```

---

## 🔧 COMANDOS ÚTEIS

### Ativar AI Agent

```bash
docker exec dv-api php artisan tinker --execute="
\$agent = \App\Models\AiChatAgent::first();
\$agent->update(['is_active' => true]);
echo 'AI Agent ativado';
"
```

---

### Desativar Handoff Permanentemente (para teste)

```bash
# CUIDADO: Remove handoff de TODAS as conversas
docker exec dv-api php artisan tinker --execute="
\App\Models\WhatsappConversation::query()->update(['assigned_user_id' => null]);
echo 'Handoff removido de todas as conversas';
"
```

---

### Ver Tokens Usados Hoje

```bash
docker exec dv-api php artisan tinker --execute="
\$today = \App\Models\AiTokenUsage::whereDate('created_at', today())
    ->selectRaw('SUM(prompt_tokens) as prompt, SUM(completion_tokens) as completion')
    ->first();

echo 'Tokens hoje:\n';
echo '  Prompt: ' . number_format(\$today->prompt ?? 0) . '\n';
echo '  Completion: ' . number_format(\$today->completion ?? 0) . '\n';
echo '  Total: ' . number_format((\$today->prompt ?? 0) + (\$today->completion ?? 0)) . '\n';
"
```

---

### Ver Custos Hoje

```bash
docker exec dv-api php artisan tinker --execute="
\$today = \App\Models\AiTokenUsage::whereDate('created_at', today())->get();

\$promptTokens = \$today->sum('prompt_tokens');
\$completionTokens = \$today->sum('completion_tokens');

// Preços Groq: \$0.59 input / \$0.79 output per 1M tokens
\$inputCost = (\$promptTokens / 1000000) * 0.59;
\$outputCost = (\$completionTokens / 1000000) * 0.79;
\$totalCost = \$inputCost + \$outputCost;

// Converter para BRL (R\$ 5.80)
\$totalBRL = \$totalCost * 5.80;

echo 'Custo hoje:\n';
echo '  Input: \$' . number_format(\$inputCost, 4) . '\n';
echo '  Output: \$' . number_format(\$outputCost, 4) . '\n';
echo '  Total USD: \$' . number_format(\$totalCost, 4) . '\n';
echo '  Total BRL: R\$ ' . number_format(\$totalBRL, 2) . '\n';
"
```

---

## 🚨 TROUBLESHOOTING AVANÇADO

### IA Não Responde Mesmo Sem Handoff

```bash
# 1. Verificar se webhook está chegando
docker logs dv-api --tail=50 | grep "messages.upsert"

# Se não mostrar nada: webhook não está chegando

# 2. Verificar se processAutoResponse é chamado
docker logs dv-api --tail=50 | grep "processAutoResponse\|processing message"

# Se não mostrar: método não está sendo chamado

# 3. Verificar se há erros
docker logs dv-api --tail=100 | grep -i "error" | tail -10

# 4. Testar Groq API diretamente
docker exec dv-api php artisan tinker --execute="
\$aiService = new \App\Services\AIService();
\$result = \$aiService->generateChatResponse('Olá', [], []);
echo \$result['success'] ? 'Groq OK' : 'Groq ERROR: ' . \$result['message'];
"
```

---

### Webhook Não Chega

```bash
# Verificar configuração do webhook no WhatsApp Service
# (service externo - fora do escopo deste script)

# Testar webhook manualmente:
curl -X POST http://localhost:8000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "messages.upsert",
    "sessionId": "SESSION_ID_AQUI",
    "data": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "text": "Teste manual webhook",
      "fromMe": false
    }
  }'
```

---

## 💡 DICAS

### 1. Sempre Verificar Handoff Primeiro

Handoff é a causa #1 de "IA não responde"

```bash
bash debug-ia.sh
```

Procure por: `⚠️  HANDOFF ATIVO`

---

### 2. Limpar Cache Antes de Testar

```bash
docker exec dv-api php artisan cache:clear
docker exec dv-api php artisan config:clear
```

---

### 3. Ver Logs em Tempo Real

```bash
docker logs -f dv-api | grep "AI Agent"
```

---

### 4. Testar com Conversa Nova

Se uma conversa específica não funciona, testar com conversa nova:

```bash
# Cliente envia mensagem nova
# IA deve responder imediatamente
```

---

## 📄 ARQUIVOS

### Scripts no Servidor

```
driver-de-vendas-crm/
   ├── debug-ia.sh               ← Diagnóstico completo
   ├── forcar-ia-responder.sh    ← Forçar IA manualmente
   ├── test-handoff.sh           ← Testar handoff
   └── fix-502.sh                ← Corrigir erro 502
```

### Como Usar

```bash
# Conectar no servidor
ssh usuario@servidor

# Ir para diretório
cd /caminho/projeto/driver-de-vendas-crm

# Dar permissão de execução (primeira vez)
chmod +x debug-ia.sh forcar-ia-responder.sh

# Rodar diagnóstico
bash debug-ia.sh

# Forçar IA a responder
bash forcar-ia-responder.sh
```

---

## ✅ CHECKLIST DE VERIFICAÇÃO

```
□ AI Agent ativo?
  docker exec dv-api php artisan tinker --execute="
    echo \App\Models\AiChatAgent::where('is_active', true)->exists() ? 'SIM' : 'NÃO';
  "

□ Groq API Key configurada?
  docker exec dv-api php artisan tinker --execute="
    echo config('services.groq.api_key') ? 'SIM' : 'NÃO';
  "

□ WhatsApp AI habilitado?
  docker exec dv-api php artisan tinker --execute="
    echo config('whatsapp.ai_agent.enabled') ? 'SIM' : 'NÃO';
  "

□ Handoff inativo?
  bash debug-ia.sh | grep "HANDOFF"

□ Rate limit OK?
  bash debug-ia.sh | grep "Rate limit"

□ Logs sem erros?
  docker logs dv-api --tail=50 | grep -i error
```

---

**Criado**: 25/02/2026  
**Uso**: Diagnosticar e forçar IA a responder  
**Localização**: `driver-de-vendas-crm/`
