#!/bin/bash

# Script para VER conversas duplicadas (sem mesclar)

echo "═══════════════════════════════════════════════════════════════════════════"
echo "🔍 VERIFICAR CONVERSAS DUPLICADAS"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""

docker exec dv-api php artisan tinker --execute="
// Buscar todas as conversas não-grupo
\$convs = \App\Models\WhatsappConversation::with('session')
    ->where('is_group', false)
    ->get();

echo 'Total de conversas: ' . \$convs->count() . '\n\n';

// Agrupar por telefone normalizado
\$byPhone = [];
foreach (\$convs as \$c) {
    \$digits = preg_replace('/\D/', '', \$c->contact_phone ?? '');
    if (strlen(\$digits) >= 10) {
        \$byPhone[\$digits] = \$byPhone[\$digits] ?? [];
        \$byPhone[\$digits][] = \$c;
    }
}

// Filtrar apenas duplicatas
\$duplicates = array_filter(\$byPhone, fn(\$group) => count(\$group) > 1);

if (count(\$duplicates) === 0) {
    echo '✅ Nenhuma duplicata encontrada!\n';
    exit;
}

echo '⚠️  ' . count(\$duplicates) . ' números com conversas duplicadas:\n';
echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

foreach (\$duplicates as \$phone => \$group) {
    \$name = \$group[0]->contact_name ?? 'Sem nome';
    echo '📱 ' . \$name . ' (+' . \$phone . ') - ' . count(\$group) . ' conversas:\n';
    
    foreach (\$group as \$conv) {
        \$msgCount = \App\Models\WhatsappMessage::where('conversation_id', \$conv->id)->count();
        \$session = \$conv->session->phone_number ?? 'Sem sessão';
        \$jid = \$conv->remote_jid;
        \$lastMsg = \$conv->last_message_at ? \$conv->last_message_at->format('d/m H:i') : 'nunca';
        
        echo '   • ID: ' . substr(\$conv->id, 0, 8) . '...\n';
        echo '     JID: ' . \$jid . '\n';
        echo '     Session: ' . \$session . '\n';
        echo '     Mensagens: ' . \$msgCount . '\n';
        echo '     Última msg: ' . \$lastMsg . '\n\n';
    }
    
    echo '\n';
}

echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
echo '\n💡 Para mesclar duplicatas, rode:\n';
echo '   bash limpar-duplicadas.sh\n';
" 2>/dev/null

echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
