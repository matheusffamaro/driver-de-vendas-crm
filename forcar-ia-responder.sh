#!/bin/bash

# Script para FORÇAR IA a responder manualmente
# Útil para testar se a IA está funcionando

echo "═══════════════════════════════════════════════════════════════════════════"
echo "🤖 FORÇAR IA A RESPONDER"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""

# Pegar última conversa
CONV_ID=$(docker exec dv-api php artisan tinker --execute="
\$conv = \App\Models\WhatsappConversation::orderBy('last_message_at', 'desc')->first();
echo \$conv ? \$conv->id : 'NONE';
" 2>/dev/null | tail -1 | tr -d '\r\n')

if [ "$CONV_ID" = "NONE" ]; then
    echo "❌ Nenhuma conversa encontrada"
    exit 1
fi

echo "📋 Conversa: $CONV_ID"
echo ""

# Mostrar contato
docker exec dv-api php artisan tinker --execute="
\$conv = \App\Models\WhatsappConversation::find('$CONV_ID');
echo '👤 ' . (\$conv->contact_name ?? \$conv->contact_phone) . '\n';
" 2>/dev/null

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PASSO 1: Limpar handoff (assigned_user_id)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

docker exec dv-api php artisan tinker --execute="
\$conv = \App\Models\WhatsappConversation::find('$CONV_ID');
\$before = \$conv->assigned_user_id;
\$conv->update(['assigned_user_id' => null]);
echo 'assigned_user_id: ' . (\$before ?? 'null') . ' → null\n';
echo '✅ Handoff removido\n';
" 2>/dev/null

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PASSO 2: Limpar rate limits e debounce"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

docker exec dv-api php artisan tinker --execute="
\$conv = \App\Models\WhatsappConversation::find('$CONV_ID');
\$session = \$conv->session;

\$globalKey = 'ai_agent_global:' . \$session->id;
\$debounceKey = 'ai_agent_debounce:' . \$conv->id;

\Cache::forget(\$globalKey);
\Cache::forget(\$debounceKey);

echo '✅ Rate limits limpos\n';
echo '✅ Debounce limpo\n';
" 2>/dev/null

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PASSO 3: Processar resposta da IA MANUALMENTE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Processando..."
echo ""

docker exec dv-api php artisan tinker --execute="
\$conv = \App\Models\WhatsappConversation::with('session')->find('$CONV_ID');
if (!\$conv) {
    echo 'Conversa não encontrada\n';
    exit;
}

\$session = \$conv->session;

// Pegar última mensagem do cliente
\$lastMsg = \App\Models\WhatsappMessage::where('conversation_id', \$conv->id)
    ->where('direction', 'incoming')
    ->orderBy('created_at', 'desc')
    ->first();

if (!\$lastMsg) {
    echo '❌ Nenhuma mensagem incoming para processar\n';
    exit;
}

echo '📨 Mensagem: ' . substr(\$lastMsg->content, 0, 50) . '\n';
echo '📅 Recebida: ' . \$lastMsg->created_at->format('H:i:s d/m') . '\n';
echo '\n';
echo 'Processando resposta da IA...\n\n';

try {
    \$aiService = new \App\Services\Whatsapp\WhatsappAIAgentService();
    \$aiService->processAutoResponse(\$session, \$conv, \$lastMsg->content);
    
    echo '✅ processAutoResponse() executado\n';
    echo '\nVerificando se IA respondeu...\n\n';
    
    sleep(3);
    
    \$aiResponse = \App\Models\WhatsappMessage::where('conversation_id', \$conv->id)
        ->where('direction', 'outgoing')
        ->where('sender_name', 'AI Agent')
        ->where('created_at', '>', \$lastMsg->created_at)
        ->orderBy('created_at', 'desc')
        ->first();
    
    if (\$aiResponse) {
        echo '✅ IA RESPONDEU!\n\n';
        echo '🤖 Resposta: ' . substr(\$aiResponse->content, 0, 100) . '\n';
        echo '📅 Enviada: ' . \$aiResponse->created_at->format('H:i:s') . '\n';
    } else {
        echo '❌ IA NÃO RESPONDEU\n';
        echo '\nVerificar logs para entender por quê:\n';
        echo '   docker logs dv-api --tail=50 | grep \"AI Agent\"\n';
    }
    
} catch (\Exception \$e) {
    echo '❌ ERRO: ' . \$e->getMessage() . '\n';
    echo '\nStack trace:\n';
    echo \$e->getTraceAsString() . '\n';
}
" 2>/dev/null

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 RESULTADO FINAL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verificar se IA respondeu
AI_RESPONDED=$(docker exec dv-api php artisan tinker --execute="
\$conv = \App\Models\WhatsappConversation::find('$CONV_ID');
\$lastIncoming = \App\Models\WhatsappMessage::where('conversation_id', \$conv->id)
    ->where('direction', 'incoming')
    ->orderBy('created_at', 'desc')
    ->first();

if (!\$lastIncoming) { echo 'NO_MSG'; exit; }

\$aiAfter = \App\Models\WhatsappMessage::where('conversation_id', \$conv->id)
    ->where('direction', 'outgoing')
    ->where('sender_name', 'AI Agent')
    ->where('created_at', '>', \$lastIncoming->created_at)
    ->exists();

echo \$aiAfter ? 'YES' : 'NO';
" 2>/dev/null | tail -1 | tr -d '\r\n')

if [ "$AI_RESPONDED" = "YES" ]; then
    echo "✅ IA FUNCIONANDO CORRETAMENTE!"
    echo ""
    echo "   A IA respondeu à última mensagem do cliente."
elif [ "$AI_RESPONDED" = "NO" ]; then
    echo "❌ IA NÃO RESPONDEU"
    echo ""
    echo "Possíveis causas:"
    echo "   1. Handoff estava ativo (verificado acima)"
    echo "   2. Rate limit ativo"
    echo "   3. Horário de serviço restrito"
    echo "   4. Erro na configuração"
    echo "   5. Webhook não chegou"
    echo ""
    echo "💡 Ver logs detalhados:"
    echo "   docker logs dv-api --tail=100 | grep -A 5 'AI Agent'"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
