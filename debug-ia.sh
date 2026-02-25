#!/bin/bash

# Script de diagnóstico completo da IA WhatsApp
# Roda direto no servidor via docker exec

echo "═══════════════════════════════════════════════════════════════════════════"
echo "🔍 DIAGNÓSTICO COMPLETO: IA WhatsApp"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""

# Função para executar PHP no container
run_php() {
    docker exec dv-api php artisan tinker --execute="$1" 2>/dev/null
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣ VERIFICANDO CONFIGURAÇÃO DA IA"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

run_php "
\$agent = \App\Models\AiChatAgent::where('is_active', true)->first();
if (!\$agent) {
    echo '❌ NENHUM AI AGENT ATIVO!\n';
    echo '\nSolução: Ativar AI Agent no frontend\n';
    exit;
}

echo '✅ AI Agent ativo: ' . \$agent->name . '\n';
echo '   ID: ' . \$agent->id . '\n';
echo '   WhatsApp Session: ' . (\$agent->whatsapp_session_id ?? 'Global (todos)') . '\n';
echo '   Tipo instrução: ' . \$agent->instruction_type . '\n';
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣ VERIFICANDO CONFIGURAÇÃO GROQ"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

run_php "
\$key = config('services.groq.api_key');
if (!\$key) {
    echo '❌ GROQ API KEY NÃO CONFIGURADA!\n';
    echo '\nVerificar .env: GROQ_API_KEY=...\n';
} else {
    echo '✅ Groq API Key configurada\n';
    echo '   Key: ' . substr(\$key, 0, 15) . '...\n';
}

\$enabled = config('whatsapp.ai_agent.enabled');
echo '\n';
echo (\$enabled ? '✅' : '❌') . ' whatsapp.ai_agent.enabled = ' . (\$enabled ? 'true' : 'false') . '\n';
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣ VERIFICANDO ÚLTIMAS CONVERSAS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

run_php "
\$convs = \App\Models\WhatsappConversation::with('session')
    ->orderBy('last_message_at', 'desc')
    ->limit(5)
    ->get();

if (\$convs->isEmpty()) {
    echo '⚠️  Nenhuma conversa encontrada\n';
    exit;
}

foreach (\$convs as \$conv) {
    \$name = \$conv->contact_name ?? \$conv->contact_phone ?? 'Sem nome';
    \$time = \$conv->last_message_at ? \$conv->last_message_at->format('H:i d/m') : 'nunca';
    \$assigned = \$conv->assigned_user_id ? '👨' : '🤖';
    
    echo \"{\$conv->id}\n\";
    echo \"   \$assigned \$name - \$time\n\";
    echo \"   Session: \" . (\$conv->session->session_name ?? \$conv->session->phone_number) . \"\n\";
    echo \"\n\";
}
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣ ANÁLISE DETALHADA: Última Conversa"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

CONV_ID=$(docker exec dv-api php artisan tinker --execute="
\$conv = \App\Models\WhatsappConversation::orderBy('last_message_at', 'desc')->first();
echo \$conv ? \$conv->id : 'NONE';
" 2>/dev/null | tail -1 | tr -d '\r\n')

if [ "$CONV_ID" = "NONE" ]; then
    echo "❌ Nenhuma conversa encontrada"
    exit 1
fi

echo "📋 Analisando conversa: $CONV_ID"
echo ""

run_php "
\$conv = \App\Models\WhatsappConversation::with('session')->find('$CONV_ID');
if (!\$conv) { echo 'Conversa não encontrada'; exit; }

echo '👤 Contato: ' . (\$conv->contact_name ?? \$conv->contact_phone) . '\n';
echo '📱 Número: ' . \$conv->contact_phone . '\n';
echo '🔧 Session: ' . \$conv->session->phone_number . '\n';
echo '👨 Atribuído: ' . (\$conv->assigned_user_id ? 'SIM (handoff ativo)' : 'NÃO (IA pode responder)') . '\n';
echo '📅 Última msg: ' . (\$conv->last_message_at ? \$conv->last_message_at->format('d/m H:i:s') : 'nunca') . '\n';
"

echo ""
echo "📨 Últimas 10 mensagens:"
echo ""

run_php "
\$msgs = \App\Models\WhatsappMessage::where('conversation_id', '$CONV_ID')
    ->orderBy('created_at', 'desc')
    ->limit(10)
    ->get();

foreach (\$msgs as \$msg) {
    \$dir = \$msg->direction === 'incoming' ? '👤 Cliente' : '📤 Enviado';
    \$sender = \$msg->sender_name ?? 'null';
    \$time = \$msg->created_at->format('H:i:s');
    \$content = substr(\$msg->content, 0, 40);
    
    \$icon = '   ';
    if (\$msg->direction === 'outgoing') {
        \$icon = \$msg->sender_name === 'AI Agent' ? '🤖' : '👨';
    }
    
    echo \"[\$time] \$icon \$dir (\$sender): \$content\n\";
}
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5️⃣ VERIFICANDO HANDOFF"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

HAS_HUMAN=$(run_php "
\$hasHuman = \App\Models\WhatsappMessage::where('conversation_id', '$CONV_ID')
    ->where('direction', 'outgoing')
    ->where('created_at', '>=', now()->subMinutes(30))
    ->where(function (\$q) {
        \$q->whereNull('sender_name')
            ->orWhere('sender_name', '!=', 'AI Agent');
    })
    ->exists();

echo \$hasHuman ? 'YES' : 'NO';
" | tail -1 | tr -d '\r\n')

if [ "$HAS_HUMAN" = "YES" ]; then
    echo "⚠️  HANDOFF ATIVO (mensagem humana nos últimos 30min)"
    echo "   → IA NÃO vai responder (comportamento correto)"
    echo ""
    
    run_php "
    \$lastHuman = \App\Models\WhatsappMessage::where('conversation_id', '$CONV_ID')
        ->where('direction', 'outgoing')
        ->where(function (\$q) {
            \$q->whereNull('sender_name')->orWhere('sender_name', '!=', 'AI Agent');
        })
        ->orderBy('created_at', 'desc')
        ->first();
    
    if (\$lastHuman) {
        echo '   Última msg humana: ' . \$lastHuman->created_at->format('d/m H:i:s') . '\n';
        echo '   Enviada por: ' . (\$lastHuman->sender_name ?? 'sem nome') . '\n';
        echo '   Tempo atrás: ' . \$lastHuman->created_at->diffForHumans() . '\n';
    }
    "
    echo ""
    echo "💡 Para IA voltar a responder:"
    echo "   • Aguardar 30 minutos OU"
    echo "   • Limpar assigned_user_id da conversa"
else
    echo "✅ Handoff NÃO ativo"
    echo "   → IA PODE responder"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6️⃣ VERIFICANDO RATE LIMITS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

run_php "
\$conv = \App\Models\WhatsappConversation::find('$CONV_ID');
\$session = \$conv->session;

// Global rate limit
\$globalKey = 'ai_agent_global:' . \$session->id;
\$globalCount = \Cache::get(\$globalKey, 0);
echo 'Global (sessão): ' . \$globalCount . '/30 RPM\n';

if (\$globalCount >= 30) {
    echo '❌ Rate limit global atingido!\n';
} else {
    echo '✅ Rate limit OK\n';
}

// Debounce
\$debounceKey = 'ai_agent_debounce:' . \$conv->id;
\$lastProcessed = \Cache::get(\$debounceKey);
if (\$lastProcessed) {
    \$diff = now()->timestamp - \$lastProcessed;
    echo '\nDebounce: Última resposta há ' . \$diff . ' segundos\n';
    if (\$diff < 2) {
        echo '⚠️  Debounce ativo (aguardando 2s)\n';
    }
}
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "7️⃣ VERIFICANDO HORÁRIO DE SERVIÇO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

run_php "
\$agent = \App\Models\AiChatAgent::where('is_active', true)->first();
if (!\$agent) { exit; }

\$hours = \$agent->human_service_hours;

if (empty(\$hours)) {
    echo '✅ IA ativa 24/7 (sem restrição de horário)\n';
} else {
    echo '⚠️  Horário de serviço configurado:\n';
    echo json_encode(\$hours, JSON_PRETTY_PRINT) . '\n';
    
    \$now = now()->format('H:i');
    \$day = now()->dayOfWeek; // 0=Sun, 6=Sat
    
    echo '\nHorário atual: ' . \$now . ' (dia: ' . \$day . ')\n';
}
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "8️⃣ ÚLTIMAS MENSAGENS INCOMING (não respondidas)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

run_php "
\$incoming = \App\Models\WhatsappMessage::where('conversation_id', '$CONV_ID')
    ->where('direction', 'incoming')
    ->orderBy('created_at', 'desc')
    ->limit(3)
    ->get();

if (\$incoming->isEmpty()) {
    echo '⚠️  Nenhuma mensagem incoming recente\n';
} else {
    foreach (\$incoming as \$msg) {
        \$time = \$msg->created_at->format('H:i:s d/m');
        \$content = substr(\$msg->content, 0, 50);
        
        // Verificar se IA respondeu depois
        \$aiAfter = \App\Models\WhatsappMessage::where('conversation_id', '$CONV_ID')
            ->where('direction', 'outgoing')
            ->where('sender_name', 'AI Agent')
            ->where('created_at', '>', \$msg->created_at)
            ->exists();
        
        \$status = \$aiAfter ? '✅ IA respondeu' : '❌ SEM resposta IA';
        
        echo \"[\$time] \$content\n\";
        echo \"         \$status\n\n\";
    }
}
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "9️⃣ LOGS DA IA (últimas entradas)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

docker logs dv-api --tail=100 2>&1 | grep -i "AI Agent" | tail -10

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔟 DIAGNÓSTICO FINAL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verificar todas as condições
AI_ACTIVE=$(run_php "echo \App\Models\AiChatAgent::where('is_active', true)->exists() ? 'YES' : 'NO';" | tail -1 | tr -d '\r\n')
GROQ_KEY=$(run_php "echo config('services.groq.api_key') ? 'YES' : 'NO';" | tail -1 | tr -d '\r\n')
WA_ENABLED=$(run_php "echo config('whatsapp.ai_agent.enabled') ? 'YES' : 'NO';" | tail -1 | tr -d '\r\n')

echo "Checklist:"
echo ""

if [ "$AI_ACTIVE" = "YES" ]; then
    echo "   ✅ AI Agent ativo"
else
    echo "   ❌ AI Agent NÃO ativo"
fi

if [ "$GROQ_KEY" = "YES" ]; then
    echo "   ✅ Groq API Key configurada"
else
    echo "   ❌ Groq API Key NÃO configurada"
fi

if [ "$WA_ENABLED" = "YES" ]; then
    echo "   ✅ WhatsApp AI Agent habilitado"
else
    echo "   ❌ WhatsApp AI Agent desabilitado"
fi

if [ "$HAS_HUMAN" = "YES" ]; then
    echo "   ⚠️  Handoff ativo (IA não vai responder)"
else
    echo "   ✅ Handoff inativo (IA pode responder)"
fi

echo ""

if [ "$AI_ACTIVE" = "YES" ] && [ "$GROQ_KEY" = "YES" ] && [ "$WA_ENABLED" = "YES" ] && [ "$HAS_HUMAN" = "NO" ]; then
    echo "✅ TUDO PRONTO! IA deveria estar respondendo."
    echo ""
    echo "Se IA não responde, possíveis causas:"
    echo "   1. Mensagens não chegam via webhook"
    echo "   2. Rate limit temporário"
    echo "   3. Horário de serviço restrito"
    echo "   4. Erro no processamento (ver logs)"
else
    echo "⚠️  PROBLEMA DETECTADO!"
    echo ""
    echo "Causas possíveis:"
    [ "$AI_ACTIVE" != "YES" ] && echo "   • AI Agent não está ativo"
    [ "$GROQ_KEY" != "YES" ] && echo "   • Groq API Key não configurada"
    [ "$WA_ENABLED" != "YES" ] && echo "   • WhatsApp AI Agent desabilitado no config"
    [ "$HAS_HUMAN" = "YES" ] && echo "   • Handoff ativo (humano assumiu conversa)"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
