<?php

require '/var/www/html/vendor/autoload.php';
$app = require_once '/var/www/html/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "🚀 SIMULANDO MENSAGEM ENVIADA EXTERNAMENTE (fromMe=true)\n\n";

// Buscar sessão CRM Demo
$session = \App\Models\WhatsappSession::where('phone_number', '5512991280763')->first();
if (!$session) {
    echo "❌ Sessão não encontrada\n";
    exit(1);
}

echo "✅ Sessão encontrada: " . $session->phone_number . " (ID: " . $session->id . ")\n\n";

// Webhook de mensagem fromMe=true (enviada pelo usuário no WhatsApp Web/App externo)
// FORMATO CORRETO: dados diretos no array raiz, não aninhados em 'data'
$webhookData = [
    'event' => 'message',
    'sessionId' => $session->id,
    'from' => '5512988315292@s.whatsapp.net', // JID da Rosângela
    'fromMe' => true, // MENSAGEM ENVIADA!
    'to' => '5512991280763@s.whatsapp.net',
    'type' => 'text',
    'text' => 'Simulação de resposta externa - ' . date('H:i:s'),
    'messageId' => 'simulate_' . uniqid(),
    'timestamp' => time(),
    'pushName' => null,
    'isGroup' => false,
];

echo "📤 Webhook (fromMe=true):\n";
echo "   JID: 5512988315292@s.whatsapp.net\n";
echo "   fromMe: true\n";
echo "   text: " . $webhookData['text'] . "\n\n";

// Processar webhook
$webhookService = app(\App\Services\Whatsapp\WhatsappWebhookService::class);
echo "🔄 Processando webhook...\n\n";

try {
    $result = $webhookService->handleWebhook($webhookData);
    echo "✅ Resultado: " . json_encode($result) . "\n\n";
} catch (\Exception $e) {
    echo "❌ Erro: " . $e->getMessage() . "\n";
    echo "Stack: " . $e->getTraceAsString() . "\n\n";
}

// Verificar estado DEPOIS
echo "===================\n";
echo "📊 ESTADO APÓS SIMULAÇÃO:\n\n";

$conv1 = \App\Models\WhatsappConversation::where('session_id', $session->id)
    ->where('remote_jid', 'like', '%143456336904351%')
    ->first();

$conv2 = \App\Models\WhatsappConversation::where('session_id', $session->id)
    ->where('remote_jid', 'like', '%5512988315292%')
    ->first();

$msgs1 = $conv1 ? \App\Models\WhatsappMessage::where('conversation_id', $conv1->id)->count() : 0;
$msgs2 = $conv2 ? \App\Models\WhatsappMessage::where('conversation_id', $conv2->id)->count() : 0;

echo "Conversa 1 (LID): " . ($conv1 ? 'EXISTE' : 'NÃO EXISTE') . " - Msgs: " . $msgs1 . "\n";
echo "Conversa 2 (Normal): " . ($conv2 ? 'EXISTE' : 'NÃO EXISTE') . " - Msgs: " . $msgs2 . "\n\n";

if ($conv1 && $conv2) {
    echo "⚠️  DUPLICATA CONFIRMADA!\n";
    echo "📋 A simulação deve ter adicionado mensagem em UMA das conversas\n";
    echo "    ou criado uma TERCEIRA conversa!\n";
} else {
    echo "✅ Apenas 1 conversa existe\n";
}

echo "\n📋 Agora veja o LOG de debug:\n";
echo "docker exec dv-api cat /var/www/html/storage/logs/debug-09ce68.log\n";
