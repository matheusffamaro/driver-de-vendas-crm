#!/bin/bash

# Script para testar handoff da IA
# Verifica se há mensagens humanas recentes e se a IA respeitou o handoff

echo "═══════════════════════════════════════════════════════════════════════════"
echo "🧪 TESTE DE HANDOFF - IA WhatsApp"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""

# Obter ID da conversa (última conversa ativa)
CONVERSATION_ID=$(docker exec dv-api php artisan tinker --execute="
\$conv = \App\Models\WhatsappConversation::orderBy('last_message_at', 'desc')->first();
if (\$conv) {
    echo \$conv->id;
} else {
    echo 'NONE';
}
" 2>/dev/null | tail -1 | tr -d '\r\n')

if [ "$CONVERSATION_ID" = "NONE" ]; then
    echo "❌ Nenhuma conversa encontrada"
    echo ""
    echo "Criar uma conversa primeiro:"
    echo "   1. Abrir WhatsApp no frontend"
    echo "   2. Enviar mensagem de um cliente"
    echo ""
    exit 1
fi

echo "📋 Conversa ID: $CONVERSATION_ID"
echo ""

# Buscar últimas mensagens
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📨 ÚLTIMAS 10 MENSAGENS:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

docker exec dv-api php artisan tinker --execute="
\$messages = \App\Models\WhatsappMessage::where('conversation_id', '$CONVERSATION_ID')
    ->orderBy('created_at', 'desc')
    ->limit(10)
    ->get();

foreach (\$messages as \$msg) {
    \$direction = \$msg->direction === 'incoming' ? '👤 Cliente' : '📤 Enviado';
    \$sender = \$msg->sender_name ?? 'sem nome';
    \$isAI = \$msg->sender_name === 'AI Agent' ? '🤖' : '👨';
    
    if (\$msg->direction === 'outgoing') {
        \$direction = \$isAI . ' ' . (\$msg->sender_name ?? 'Humano');
    }
    
    \$time = \$msg->created_at->format('H:i:s');
    \$content = substr(\$msg->content, 0, 50);
    
    echo \"[\$time] \$direction: \$content\n\";
}
" 2>/dev/null

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 VERIFICAÇÃO DE HANDOFF:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verificar mensagens humanas recentes (30min)
HAS_HUMAN=$(docker exec dv-api php artisan tinker --execute="
\$hasHuman = \App\Models\WhatsappMessage::where('conversation_id', '$CONVERSATION_ID')
    ->where('direction', 'outgoing')
    ->where('created_at', '>=', now()->subMinutes(30))
    ->where(function (\$q) {
        \$q->whereNull('sender_name')
            ->orWhere('sender_name', '!=', 'AI Agent');
    })
    ->exists();

echo \$hasHuman ? 'YES' : 'NO';
" 2>/dev/null | tail -1 | tr -d '\r\n')

if [ "$HAS_HUMAN" = "YES" ]; then
    echo "✅ Mensagem humana recente detectada (últimos 30min)"
    echo "   → IA DEVE estar parada (handoff ativo)"
    echo ""
    
    # Verificar se IA respondeu depois da mensagem humana
    RECENT_AI=$(docker exec dv-api php artisan tinker --execute="
    \$humanMsg = \App\Models\WhatsappMessage::where('conversation_id', '$CONVERSATION_ID')
        ->where('direction', 'outgoing')
        ->where('created_at', '>=', now()->subMinutes(30))
        ->where(function (\$q) {
            \$q->whereNull('sender_name')
                ->orWhere('sender_name', '!=', 'AI Agent');
        })
        ->orderBy('created_at', 'desc')
        ->first();
    
    if (!\$humanMsg) {
        echo 'NO_HUMAN';
        exit;
    }
    
    \$aiAfter = \App\Models\WhatsappMessage::where('conversation_id', '$CONVERSATION_ID')
        ->where('direction', 'outgoing')
        ->where('sender_name', 'AI Agent')
        ->where('created_at', '>', \$humanMsg->created_at)
        ->exists();
    
    echo \$aiAfter ? 'AI_RESPONDED' : 'AI_STOPPED';
    " 2>/dev/null | tail -1 | tr -d '\r\n')
    
    if [ "$RECENT_AI" = "AI_STOPPED" ]; then
        echo "✅ IA NÃO respondeu após mensagem humana"
        echo "   🎉 HANDOFF FUNCIONANDO CORRETAMENTE!"
    elif [ "$RECENT_AI" = "AI_RESPONDED" ]; then
        echo "❌ IA RESPONDEU após mensagem humana"
        echo "   ⚠️  HANDOFF NÃO FUNCIONOU!"
        echo ""
        echo "Possíveis causas:"
        echo "   1. Container não foi reiniciado após mudanças"
        echo "   2. Verificar logs: docker logs dv-api --tail=50"
        echo "   3. sender_name não foi salvo corretamente"
    fi
else
    echo "⚠️  Nenhuma mensagem humana recente (últimos 30min)"
    echo "   → IA PODE responder normalmente"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 ESTATÍSTICAS DA CONVERSA:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

docker exec dv-api php artisan tinker --execute="
\$totalMsgs = \App\Models\WhatsappMessage::where('conversation_id', '$CONVERSATION_ID')->count();
\$aiMsgs = \App\Models\WhatsappMessage::where('conversation_id', '$CONVERSATION_ID')
    ->where('sender_name', 'AI Agent')->count();
\$humanMsgs = \App\Models\WhatsappMessage::where('conversation_id', '$CONVERSATION_ID')
    ->where('direction', 'outgoing')
    ->where(function (\$q) {
        \$q->whereNull('sender_name')->orWhere('sender_name', '!=', 'AI Agent');
    })->count();
\$clientMsgs = \App\Models\WhatsappMessage::where('conversation_id', '$CONVERSATION_ID')
    ->where('direction', 'incoming')->count();

echo \"Total de mensagens: \$totalMsgs\n\";
echo \"🤖 Mensagens IA: \$aiMsgs\n\";
echo \"👨 Mensagens humanas: \$humanMsgs\n\";
echo \"👤 Mensagens cliente: \$clientMsgs\n\";

if (\$humanMsgs > 0) {
    \$pct = round((\$aiMsgs / (\$aiMsgs + \$humanMsgs)) * 100, 1);
    echo \"\nIA respondeu \$pct% das mensagens enviadas\";
}
" 2>/dev/null

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 COMO TESTAR:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Cliente envia: 'Oi'"
echo "   → IA deve responder"
echo ""
echo "2. Admin/Manager envia: 'Olá! Sou Matheus'"
echo "   → sender_name deve ser 'Matheus Amaro'"
echo ""
echo "3. Cliente envia: 'Ótimo!'"
echo "   → IA NÃO deve responder (handoff ativo)"
echo ""
echo "4. Rodar este script para verificar:"
echo "   bash test-handoff.sh"
echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
