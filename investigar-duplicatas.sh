#!/bin/bash

echo "═══════════════════════════════════════════════════════════════════════════"
echo "🔍 INVESTIGAR CONVERSAS ESPECÍFICAS"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""

docker exec dv-api php artisan tinker --execute="
// Buscar conversas por nome ou telefone parcial
\$search1 = '5512974086119';
\$search2 = 'Edina';

echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
echo '🔍 BUSCANDO POR: +55 12 97408-6119\n';
echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

\$convs1 = \App\Models\WhatsappConversation::where(function(\$q) use (\$search1) {
    \$q->where('contact_phone', 'like', '%' . \$search1 . '%')
      ->orWhere('remote_jid', 'like', '%' . \$search1 . '%');
})->get();

foreach (\$convs1 as \$c) {
    echo 'ID: ' . \$c->id . '\n';
    echo 'Nome: ' . (\$c->contact_name ?? 'NULL') . '\n';
    echo 'Telefone: ' . (\$c->contact_phone ?? 'NULL') . '\n';
    echo 'Remote JID: ' . \$c->remote_jid . '\n';
    echo 'LID JID: ' . (\$c->lid_jid ?? 'NULL') . '\n';
    echo 'Session: ' . \$c->session_id . '\n';
    echo 'Mensagens: ' . \App\Models\WhatsappMessage::where('conversation_id', \$c->id)->count() . '\n';
    echo '\n';
}

echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
echo '🔍 BUSCANDO POR: Edina\n';
echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

\$convs2 = \App\Models\WhatsappConversation::where('contact_name', 'like', '%' . \$search2 . '%')->get();

foreach (\$convs2 as \$c) {
    echo 'ID: ' . \$c->id . '\n';
    echo 'Nome: ' . (\$c->contact_name ?? 'NULL') . '\n';
    echo 'Telefone: ' . (\$c->contact_phone ?? 'NULL') . '\n';
    echo 'Remote JID: ' . \$c->remote_jid . '\n';
    echo 'LID JID: ' . (\$c->lid_jid ?? 'NULL') . '\n';
    echo 'Session: ' . \$c->session_id . '\n';
    echo 'Mensagens: ' . \App\Models\WhatsappMessage::where('conversation_id', \$c->id)->count() . '\n';
    echo '\n';
}

echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
echo '📊 TODAS AS CONVERSAS DA SESSÃO (primeiras 20)\n';
echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

\$session = \App\Models\WhatsappSession::where('phone_number', '5512991280763')->first();
if (\$session) {
    \$allConvs = \App\Models\WhatsappConversation::where('session_id', \$session->id)
        ->where('is_group', false)
        ->orderBy('last_message_at', 'desc')
        ->limit(20)
        ->get();
    
    foreach (\$allConvs as \$c) {
        \$phone = \$c->contact_phone ?? 'NULL';
        \$normalized = preg_replace('/\D/', '', \$phone);
        
        echo '• ' . (\$c->contact_name ?? 'Sem nome') . '\n';
        echo '  Telefone: ' . \$phone . ' (normalized: ' . \$normalized . ')\n';
        echo '  JID: ' . \$c->remote_jid . '\n';
        echo '  ID: ' . substr(\$c->id, 0, 8) . '...\n\n';
    }
}
" 2>/dev/null
