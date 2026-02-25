#!/bin/bash

echo "═══════════════════════════════════════════════════════════════════════════"
echo "🔍 INVESTIGAR CONVERSAS - SQL DIRETO"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""

# Buscar por telefone
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 BUSCANDO: +55 12 97408-6119"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

docker exec dv-api php -r "
require '/var/www/html/vendor/autoload.php';
\$app = require_once '/var/www/html/bootstrap/app.php';
\$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

\$convs = \App\Models\WhatsappConversation::where(function(\$q) {
    \$q->where('contact_phone', 'like', '%12974086119%')
      ->orWhere('contact_phone', 'like', '%1297408%')
      ->orWhere('remote_jid', 'like', '%12974086119%')
      ->orWhere('contact_name', 'like', '%97408%');
})->get();

foreach (\$convs as \$c) {
    echo 'ID: ' . \$c->id . PHP_EOL;
    echo 'Nome: ' . (\$c->contact_name ?? 'NULL') . PHP_EOL;
    echo 'Telefone: ' . (\$c->contact_phone ?? 'NULL') . PHP_EOL;
    echo 'Remote JID: ' . \$c->remote_jid . PHP_EOL;
    echo 'Session: ' . \$c->session_id . PHP_EOL;
    echo 'Mensagens: ' . \App\Models\WhatsappMessage::where('conversation_id', \$c->id)->count() . PHP_EOL;
    echo PHP_EOL;
}

if (\$convs->isEmpty()) {
    echo 'Nenhuma conversa encontrada.' . PHP_EOL;
}
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 BUSCANDO: Edina"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

docker exec dv-api php -r "
require '/var/www/html/vendor/autoload.php';
\$app = require_once '/var/www/html/bootstrap/app.php';
\$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

\$convs = \App\Models\WhatsappConversation::where('contact_name', 'like', '%Edina%')->get();

foreach (\$convs as \$c) {
    echo 'ID: ' . \$c->id . PHP_EOL;
    echo 'Nome: ' . (\$c->contact_name ?? 'NULL') . PHP_EOL;
    echo 'Telefone: ' . (\$c->contact_phone ?? 'NULL') . PHP_EOL;
    echo 'Remote JID: ' . \$c->remote_jid . PHP_EOL;
    echo 'Session: ' . \$c->session_id . PHP_EOL;
    echo 'Mensagens: ' . \App\Models\WhatsappMessage::where('conversation_id', \$c->id)->count() . PHP_EOL;
    echo PHP_EOL;
}

if (\$convs->isEmpty()) {
    echo 'Nenhuma conversa encontrada.' . PHP_EOL;
}
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 TODAS CONVERSAS DA SESSÃO 5512991280763"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

docker exec dv-api php -r "
require '/var/www/html/vendor/autoload.php';
\$app = require_once '/var/www/html/bootstrap/app.php';
\$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

\$session = \App\Models\WhatsappSession::where('phone_number', '5512991280763')->first();

if (\$session) {
    \$convs = \App\Models\WhatsappConversation::where('session_id', \$session->id)
        ->where('is_group', false)
        ->orderBy('last_message_at', 'desc')
        ->limit(15)
        ->get();
    
    foreach (\$convs as \$c) {
        \$name = \$c->contact_name ?? 'Sem nome';
        \$phone = \$c->contact_phone ?? 'NULL';
        \$normalized = preg_replace('/\D/', '', \$phone);
        
        echo '• ' . \$name . PHP_EOL;
        echo '  Tel: ' . \$phone . ' (norm: ' . \$normalized . ')' . PHP_EOL;
        echo '  JID: ' . \$c->remote_jid . PHP_EOL;
        echo '  ID: ' . substr(\$c->id, 0, 12) . '...' . PHP_EOL;
        echo PHP_EOL;
    }
} else {
    echo 'Sessão não encontrada.' . PHP_EOL;
}
"

echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
