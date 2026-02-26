#!/bin/bash

# Script de teste COMPLETO do Handoff (Human Takeover)
# Testa se a IA para de responder quando humano assume a conversa

set -e

echo "═══════════════════════════════════════════════════════════════════════════"
echo "🧪 TESTE COMPLETO DE HANDOFF (Human Takeover)"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""
echo "Este script vai:"
echo "  1. Criar conversa de teste"
echo "  2. ✅ IA deve responder (sem handoff)"
echo "  3. Simular humano assumindo"
echo "  4. ❌ IA NÃO deve responder (com handoff)"
echo "  5. Limpar dados de teste"
echo ""
read -p "Pressione ENTER para começar o teste..."
echo ""

# Variáveis
TEST_PHONE="5599999999999"
TEST_NAME="Teste Handoff $(date +%H%M%S)"
SESSION_ID=""
CONVERSATION_ID=""
CLEANUP_IDS=()

# Função de limpeza
cleanup() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🧹 LIMPANDO DADOS DE TESTE"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    if [ -n "$CONVERSATION_ID" ]; then
        echo "Deletando conversa de teste..."
        docker exec dv-api php -r "
        require '/var/www/html/vendor/autoload.php';
        \$app = require_once '/var/www/html/bootstrap/app.php';
        \$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();
        
        \$conv = \App\Models\WhatsappConversation::find('$CONVERSATION_ID');
        if (\$conv) {
            \App\Models\WhatsappMessage::where('conversation_id', '$CONVERSATION_ID')->forceDelete();
            \$conv->forceDelete();
            echo '✅ Conversa de teste deletada\n';
        }
        "
    fi
    
    echo "✅ Limpeza concluída"
}

trap cleanup EXIT

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 PASSO 1: SETUP - Buscar sessão ativa com IA habilitada"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

SESSION_INFO=$(docker exec dv-api php -r "
require '/var/www/html/vendor/autoload.php';
\$app = require_once '/var/www/html/bootstrap/app.php';
\$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

\$session = \App\Models\WhatsappSession::where('status', 'connected')
    ->whereHas('aiAgentSettings', function(\$q) {
        \$q->where('is_active', true);
    })
    ->first();

if (!\$session) {
    echo 'ERROR:Nenhuma sessão conectada com IA ativa encontrada';
    exit(1);
}

\$settings = \$session->aiAgentSettings;
echo \$session->id . '|' . \$session->phone_number . '|' . (\$settings->is_active ? '1' : '0');
")

if [[ "$SESSION_INFO" == ERROR:* ]]; then
    echo "❌ ${SESSION_INFO#ERROR:}"
    exit 1
fi

SESSION_ID=$(echo "$SESSION_INFO" | cut -d'|' -f1)
SESSION_PHONE=$(echo "$SESSION_INFO" | cut -d'|' -f2)
IA_ACTIVE=$(echo "$SESSION_INFO" | cut -d'|' -f3)

echo "✅ Sessão encontrada:"
echo "   ID: $SESSION_ID"
echo "   Telefone: $SESSION_PHONE"
echo "   IA Ativa: $IA_ACTIVE"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 PASSO 2: CRIAR CONVERSA DE TESTE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

CONVERSATION_ID=$(docker exec dv-api php -r "
require '/var/www/html/vendor/autoload.php';
\$app = require_once '/var/www/html/bootstrap/app.php';
\$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

\$conv = \App\Models\WhatsappConversation::create([
    'id' => \Illuminate\Support\Str::uuid(),
    'session_id' => '$SESSION_ID',
    'remote_jid' => '${TEST_PHONE}@s.whatsapp.net',
    'is_group' => false,
    'contact_phone' => '$TEST_PHONE',
    'contact_name' => '$TEST_NAME',
    'last_message_at' => now(),
]);

echo \$conv->id;
")

echo "✅ Conversa criada:"
echo "   ID: $CONVERSATION_ID"
echo "   Contato: $TEST_NAME"
echo "   Telefone: $TEST_PHONE"
echo ""

sleep 2

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 PASSO 3: TESTE 1 - IA DEVE RESPONDER (sem handoff)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🤖 Enviando mensagem do cliente: 'Olá, preciso de ajuda'"
echo ""

MENSAGEM_1_ID=$(docker exec dv-api php -r "
require '/var/www/html/vendor/autoload.php';
\$app = require_once '/var/www/html/bootstrap/app.php';
\$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

\$message = \App\Models\WhatsappMessage::create([
    'id' => \Illuminate\Support\Str::uuid(),
    'conversation_id' => '$CONVERSATION_ID',
    'message_id' => 'test-msg-1-' . time(),
    'direction' => 'incoming',
    'type' => 'text',
    'content' => 'Olá, preciso de ajuda',
    'status' => 'received',
    'sender_name' => '$TEST_NAME',
    'sent_at' => now(),
]);

echo \$message->id;
")

echo "✅ Mensagem do cliente criada (ID: $MENSAGEM_1_ID)"
echo ""
echo "⏳ Aguardando 3 segundos para IA processar..."
sleep 3

RESULTADO_1=$(docker exec dv-api php -r "
require '/var/www/html/vendor/autoload.php';
\$app = require_once '/var/www/html/bootstrap/app.php';
\$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

\$aiResponse = \App\Models\WhatsappMessage::where('conversation_id', '$CONVERSATION_ID')
    ->where('direction', 'outgoing')
    ->where('sender_name', 'AI Agent')
    ->where('created_at', '>=', now()->subSeconds(5))
    ->first();

echo \$aiResponse ? 'SIM' : 'NAO';
")

if [ "$RESULTADO_1" == "SIM" ]; then
    echo "✅ TESTE 1 PASSOU: IA respondeu corretamente (sem handoff)"
else
    echo "❌ TESTE 1 FALHOU: IA NÃO respondeu (deveria ter respondido)"
    echo ""
    echo "🔍 Possíveis causas:"
    docker exec dv-api php -r "
    require '/var/www/html/vendor/autoload.php';
    \$app = require_once '/var/www/html/bootstrap/app.php';
    \$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();
    
    \$session = \App\Models\WhatsappSession::find('$SESSION_ID');
    \$settings = \$session->aiAgentSettings;
    
    echo '   IA Ativa: ' . (\$settings->is_active ? 'SIM' : 'NAO') . '\n';
    echo '   Groq API Key: ' . (env('GROQ_API_KEY') ? 'CONFIGURADA' : 'FALTANDO') . '\n';
    
    \$lastLog = \Illuminate\Support\Facades\Log::getLogger()->getHandlers()[0] ?? null;
    "
    exit 1
fi

echo ""
sleep 2

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 PASSO 4: SIMULAR HANDOFF - Humano assume a conversa"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "👤 Enviando mensagem HUMANA: 'Eu assumo daqui, obrigado!'"
echo ""

MENSAGEM_HUMANA_ID=$(docker exec dv-api php -r "
require '/var/www/html/vendor/autoload.php';
\$app = require_once '/var/www/html/bootstrap/app.php';
\$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

\$message = \App\Models\WhatsappMessage::create([
    'id' => \Illuminate\Support\Str::uuid(),
    'conversation_id' => '$CONVERSATION_ID',
    'message_id' => 'test-msg-human-' . time(),
    'direction' => 'outgoing',
    'type' => 'text',
    'content' => 'Eu assumo daqui, obrigado!',
    'status' => 'sent',
    'sender_name' => 'Administrador (Teste)',
    'sent_at' => now(),
]);

echo \$message->id;
")

echo "✅ Mensagem HUMANA criada (ID: $MENSAGEM_HUMANA_ID)"
echo "   → Handoff ATIVO (IA deve parar de responder)"
echo ""
sleep 2

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 PASSO 5: TESTE 2 - IA NÃO DEVE RESPONDER (com handoff)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🤖 Enviando nova mensagem do cliente: 'Pode me ajudar?'"
echo ""

MENSAGEM_2_ID=$(docker exec dv-api php -r "
require '/var/www/html/vendor/autoload.php';
\$app = require_once '/var/www/html/bootstrap/app.php';
\$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

\$message = \App\Models\WhatsappMessage::create([
    'id' => \Illuminate\Support\Str::uuid(),
    'conversation_id' => '$CONVERSATION_ID',
    'message_id' => 'test-msg-2-' . time(),
    'direction' => 'incoming',
    'type' => 'text',
    'content' => 'Pode me ajudar?',
    'status' => 'received',
    'sender_name' => '$TEST_NAME',
    'sent_at' => now(),
]);

echo \$message->id;
")

echo "✅ Segunda mensagem do cliente criada (ID: $MENSAGEM_2_ID)"
echo ""
echo "⏳ Aguardando 5 segundos para verificar se IA responde..."
sleep 5

RESULTADO_2=$(docker exec dv-api php -r "
require '/var/www/html/vendor/autoload.php';
\$app = require_once '/var/www/html/bootstrap/app.php';
\$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

\$aiResponse = \App\Models\WhatsappMessage::where('conversation_id', '$CONVERSATION_ID')
    ->where('direction', 'outgoing')
    ->where('sender_name', 'AI Agent')
    ->where('created_at', '>=', now()->subSeconds(8))
    ->where('created_at', '>', '$MENSAGEM_HUMANA_ID')
    ->first();

echo \$aiResponse ? 'SIM' : 'NAO';
")

echo ""
if [ "$RESULTADO_2" == "NAO" ]; then
    echo "✅ TESTE 2 PASSOU: IA NÃO respondeu após handoff"
    echo "   → Handoff funcionando corretamente! 🎉"
else
    echo "❌ TESTE 2 FALHOU: IA respondeu mesmo após handoff"
    echo "   → Handoff NÃO está funcionando!"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 VERIFICAÇÃO DETALHADA"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

docker exec dv-api php -r "
require '/var/www/html/vendor/autoload.php';
\$app = require_once '/var/www/html/bootstrap/app.php';
\$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

\$messages = \App\Models\WhatsappMessage::where('conversation_id', '$CONVERSATION_ID')
    ->orderBy('created_at', 'asc')
    ->get();

echo '📝 Histórico de mensagens:' . PHP_EOL . PHP_EOL;

foreach (\$messages as \$msg) {
    \$time = \$msg->created_at->format('H:i:s');
    \$direction = \$msg->direction === 'incoming' ? '📥' : '📤';
    \$sender = \$msg->sender_name ?? 'Unknown';
    
    echo \$direction . ' [' . \$time . '] ' . \$sender . ': ' . \$msg->content . PHP_EOL;
}

echo PHP_EOL;
echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' . PHP_EOL;
echo '🔍 Verificação de Handoff:' . PHP_EOL . PHP_EOL;

\$conv = \App\Models\WhatsappConversation::find('$CONVERSATION_ID');

\$hasHumanMsg = \App\Models\WhatsappMessage::where('conversation_id', '$CONVERSATION_ID')
    ->where('direction', 'outgoing')
    ->where('created_at', '>=', now()->subMinutes(30))
    ->where(function(\$q) {
        \$q->whereNull('sender_name')
          ->orWhere('sender_name', '!=', 'AI Agent');
    })
    ->exists();

echo 'Tem mensagem humana recente? ' . (\$hasHumanMsg ? '✅ SIM' : '❌ NÃO') . PHP_EOL;
echo 'assigned_user_id: ' . (\$conv->assigned_user_id ?? 'NULL') . PHP_EOL;

\$aiMessages = \App\Models\WhatsappMessage::where('conversation_id', '$CONVERSATION_ID')
    ->where('sender_name', 'AI Agent')
    ->count();
    
echo 'Total respostas IA: ' . \$aiMessages . PHP_EOL;
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 RESULTADO FINAL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$RESULTADO_1" == "SIM" ] && [ "$RESULTADO_2" == "NAO" ]; then
    echo "🎉 ✅ TODOS OS TESTES PASSARAM!"
    echo ""
    echo "   ✅ Teste 1: IA respondeu quando deveria"
    echo "   ✅ Teste 2: IA parou após handoff"
    echo ""
    echo "   🎯 Handoff funcionando 100%!"
    echo ""
elif [ "$RESULTADO_1" == "NAO" ]; then
    echo "⚠️  ❌ TESTE 1 FALHOU"
    echo ""
    echo "   IA não está respondendo NUNCA"
    echo "   Problema: Configuração de IA ou API key"
    echo ""
    echo "   Execute para diagnóstico:"
    echo "   docker exec dv-api php artisan queue:work --once"
    echo ""
elif [ "$RESULTADO_2" == "SIM" ]; then
    echo "⚠️  ❌ TESTE 2 FALHOU"
    echo ""
    echo "   IA respondeu MESMO com handoff ativo"
    echo "   Problema: Lógica de handoff não está funcionando"
    echo ""
    echo "   Verifique os logs:"
    echo "   docker exec dv-api tail -100 storage/logs/laravel.log | grep -i handoff"
    echo ""
else
    echo "❓ RESULTADO INCONCLUSIVO"
    echo ""
    echo "   Verifique os logs manualmente"
fi

echo "═══════════════════════════════════════════════════════════════════════════"
