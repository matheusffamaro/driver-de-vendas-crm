<?php

require '/var/www/html/vendor/autoload.php';
$app = require_once '/var/www/html/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "🚀 SIMULANDO MENSAGEM ENVIADA EXTERNAMENTE\n\n";

// Simular webhook de mensagem fromMe=true (enviada pelo WhatsApp Web externo)
$webhookData = [
    'event' => 'message',
    'data' => [
        'from' => '5512988315292@s.whatsapp.net', // JID do número da Rosângela
        'fromMe' => true, // MENSAGEM ENVIADA (não recebida!)
        'to' => '5512991280763@s.whatsapp.net', // Sua sessão
        'type' => 'text',
        'text' => 'Teste de mensagem externa - ' . date('H:i:s'),
        'messageId' => 'test_' . uniqid(),
        'timestamp' => time(),
        'pushName' => null, // Mensagem enviada não tem pushName
        'isGroup' => false,
    ]
];

echo "📤 Dados do webhook (fromMe=true):\n";
echo json_encode($webhookData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n\n";

// Buscar sessão
$session = \App\Models\WhatsappSession::where('phone_number', '5512991280763')->first();
if (!$session) {
    echo "❌ Sessão não encontrada\n";
    exit(1);
}

echo "✅ Sessão encontrada: " . $session->phone_number . " (ID: " . $session->id . ")\n\n";

// Chamar o serviço de webhook
$webhookService = app(\App\Services\Whatsapp\WhatsappWebhookService::class);

echo "🔄 Processando webhook...\n\n";

try {
    $webhookService->handle($session, $webhookData);
    echo "✅ Webhook processado com sucesso!\n\n";
} catch (\Exception $e) {
    echo "❌ Erro ao processar webhook: " . $e->getMessage() . "\n\n";
}

// Verificar estado DEPOIS
echo "===================\n";
echo "📊 VERIFICANDO CONVERSAS DEPOIS:\n\n";

$rosangelas1 = \App\Models\WhatsappConversation::where('session_id', $session->id)
    ->where('remote_jid', 'like', '%143456336904351%')
    ->get();

$rosangelas2 = \App\Models\WhatsappConversation::where('session_id', $session->id)
    ->where('remote_jid', 'like', '%5512988315292%')
    ->get();

echo "Conversas com JID LID (143456336904351@lid): " . $rosangelas1->count() . "\n";
echo "Conversas com JID Normal (5512988315292@s.whatsapp.net): " . $rosangelas2->count() . "\n\n";

if ($rosangelas1->count() + $rosangelas2->count() > 1) {
    echo "⚠️  DUPLICATA CONFIRMADA!\n";
} else {
    echo "✅ Sem duplicatas\n";
}
