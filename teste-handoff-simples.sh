#!/bin/bash

echo "🧪 TESTE DE HANDOFF - Iniciando..."
echo ""

docker exec dv-api php /var/www/html/artisan test:handoff 2>/dev/null || docker exec dv-api php -r '
require "/var/www/html/vendor/autoload.php";
$app = require_once "/var/www/html/bootstrap/app.php";
$app->make("Illuminate\Contracts\Console\Kernel")->bootstrap();

echo "═══════════════════════════════════════════════════════════════════\n";
echo "🧪 TESTE DE HANDOFF (Human Takeover)\n";
echo "═══════════════════════════════════════════════════════════════════\n\n";

// 1. Buscar sessão ativa
$session = \App\Models\WhatsappSession::where("status", "connected")
    ->whereHas("aiAgentSettings", function($q) { $q->where("is_active", true); })
    ->first();

if (!$session) {
    echo "❌ Nenhuma sessão com IA ativa\n";
    exit(1);
}

echo "✅ Sessão: {$session->phone_number}\n\n";

// 2. Criar conversa de teste
$testPhone = "5599999" . rand(10000, 99999);
$conv = \App\Models\WhatsappConversation::create([
    "id" => \Illuminate\Support\Str::uuid(),
    "session_id" => $session->id,
    "remote_jid" => "{$testPhone}@s.whatsapp.net",
    "is_group" => false,
    "contact_phone" => $testPhone,
    "contact_name" => "Teste Handoff",
    "last_message_at" => now(),
]);

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
echo "📋 TESTE 1: IA deve responder (sem handoff)\n";
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

// 3. Mensagem do cliente
\App\Models\WhatsappMessage::create([
    "id" => \Illuminate\Support\Str::uuid(),
    "conversation_id" => $conv->id,
    "message_id" => "test1-" . time(),
    "direction" => "incoming",
    "type" => "text",
    "content" => "Olá, preciso de ajuda",
    "status" => "received",
    "sender_name" => "Teste Handoff",
    "sent_at" => now(),
]);

echo "📥 Cliente: Olá, preciso de ajuda\n";
sleep(1);

// 4. Simular processamento IA
$aiService = app(\App\Services\Whatsapp\WhatsappAIAgentService::class);
try {
    $aiService->processAutoResponse($session, $conv, "Olá, preciso de ajuda");
} catch (\Exception $e) {
    echo "⚠️  Erro ao processar IA: {$e->getMessage()}\n";
}

sleep(2);

// Verificar se IA respondeu
$aiResp1 = \App\Models\WhatsappMessage::where("conversation_id", $conv->id)
    ->where("sender_name", "AI Agent")
    ->exists();

if ($aiResp1) {
    echo "✅ PASSOU: IA respondeu\n\n";
} else {
    echo "❌ FALHOU: IA não respondeu (verifique configuração)\n\n";
}

// 5. Humano assume
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
echo "📋 HANDOFF: Humano assume a conversa\n";
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

\App\Models\WhatsappMessage::create([
    "id" => \Illuminate\Support\Str::uuid(),
    "conversation_id" => $conv->id,
    "message_id" => "testhuman-" . time(),
    "direction" => "outgoing",
    "type" => "text",
    "content" => "Eu assumo daqui!",
    "status" => "sent",
    "sender_name" => "Administrador",
    "sent_at" => now(),
]);

echo "📤 Humano: Eu assumo daqui!\n";
echo "🔄 Handoff ATIVO\n\n";
sleep(1);

// 6. Nova mensagem do cliente
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
echo "📋 TESTE 2: IA NÃO deve responder (com handoff)\n";
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

\App\Models\WhatsappMessage::create([
    "id" => \Illuminate\Support\Str::uuid(),
    "conversation_id" => $conv->id,
    "message_id" => "test2-" . time(),
    "direction" => "incoming",
    "type" => "text",
    "content" => "Pode me ajudar?",
    "status" => "received",
    "sender_name" => "Teste Handoff",
    "sent_at" => now(),
]);

echo "📥 Cliente: Pode me ajudar?\n";
sleep(1);

// Refresh conversation
$conv->refresh();

// Tentar processar IA novamente
try {
    $aiService->processAutoResponse($session, $conv, "Pode me ajudar?");
} catch (\Exception $e) {
    echo "⚠️  Erro: {$e->getMessage()}\n";
}

sleep(2);

// Verificar se IA NÃO respondeu desta vez
$aiResp2Count = \App\Models\WhatsappMessage::where("conversation_id", $conv->id)
    ->where("sender_name", "AI Agent")
    ->count();

if ($aiResp2Count === 1) {
    echo "✅ PASSOU: IA NÃO respondeu (handoff funcionando!)\n\n";
    $success = true;
} else {
    echo "❌ FALHOU: IA respondeu " . $aiResp2Count . " vezes (deveria ser apenas 1)\n\n";
    $success = false;
}

// 7. Resultado final
echo "═══════════════════════════════════════════════════════════════════\n";
echo "📊 RESULTADO FINAL\n";
echo "═══════════════════════════════════════════════════════════════════\n\n";

if ($aiResp1 && $success) {
    echo "🎉 ✅ HANDOFF FUNCIONANDO 100%!\n\n";
    echo "   ✅ IA respondeu inicialmente\n";
    echo "   ✅ IA parou após humano assumir\n\n";
} else {
    echo "⚠️  ❌ HANDOFF COM PROBLEMAS\n\n";
    if (!$aiResp1) echo "   ❌ IA não está respondendo\n";
    if (!$success) echo "   ❌ IA não respeita handoff\n\n";
}

// 8. Limpar
\App\Models\WhatsappMessage::where("conversation_id", $conv->id)->forceDelete();
$conv->forceDelete();

echo "🧹 Dados de teste removidos\n";
echo "═══════════════════════════════════════════════════════════════════\n";
'

echo ""
echo "Teste concluído!"
