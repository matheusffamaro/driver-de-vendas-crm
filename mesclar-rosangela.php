<?php

require '/var/www/html/vendor/autoload.php';
$app = require_once '/var/www/html/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "🔧 MESCLANDO CONVERSAS DA ROSÂNGELA GUEDES\n\n";

$session = \App\Models\WhatsappSession::where('phone_number', '5512991280763')->first();
if (!$session) {
    echo "❌ Sessão não encontrada\n";
    exit(1);
}

// Conversa com JID LID (nome correto, mas JID temporário)
$convLid = \App\Models\WhatsappConversation::where('session_id', $session->id)
    ->where('remote_jid', 'like', '%143456336904351%')
    ->first();

// Conversa com JID Normal (nome = número, mas JID correto)
$convNormal = \App\Models\WhatsappConversation::where('session_id', $session->id)
    ->where('remote_jid', 'like', '%5512988315292%')
    ->first();

if (!$convLid || !$convNormal) {
    echo "❌ Uma das conversas não foi encontrada\n";
    echo "LID: " . ($convLid ? "EXISTE" : "NÃO EXISTE") . "\n";
    echo "Normal: " . ($convNormal ? "EXISTE" : "NÃO EXISTE") . "\n";
    exit(1);
}

echo "📱 CONVERSA LID (nome correto, JID temporário):\n";
echo "   ID: " . $convLid->id . "\n";
echo "   Nome: " . $convLid->contact_name . "\n";
echo "   JID: " . $convLid->remote_jid . "\n";
echo "   Mensagens: " . \App\Models\WhatsappMessage::where('conversation_id', $convLid->id)->count() . "\n\n";

echo "📱 CONVERSA NORMAL (nome = número, JID correto):\n";
echo "   ID: " . $convNormal->id . "\n";
echo "   Nome: " . $convNormal->contact_name . "\n";
echo "   JID: " . $convNormal->remote_jid . "\n";
echo "   Mensagens: " . \App\Models\WhatsappMessage::where('conversation_id', $convNormal->id)->count() . "\n\n";

echo "🔄 ESTRATÉGIA:\n";
echo "   1. Manter CONVERSA NORMAL (JID correto: 5512988315292@s.whatsapp.net)\n";
echo "   2. Atualizar nome para: 'Rosângela Guedes 💛'\n";
echo "   3. Mover mensagens da CONVERSA LID para a NORMAL\n";
echo "   4. Deletar CONVERSA LID\n\n";

echo "⏳ Executando merge...\n\n";

try {
    // 1. Atualizar conversa normal com nome correto e telefone correto
    $convNormal->update([
        'contact_name' => 'Rosângela Guedes 💛',
        'contact_phone' => '5512988315292',
    ]);
    echo "✅ Nome atualizado na conversa normal\n";
    
    // 2. Mover todas as mensagens da LID para a Normal
    $movedCount = \App\Models\WhatsappMessage::where('conversation_id', $convLid->id)
        ->update(['conversation_id' => $convNormal->id]);
    echo "✅ Mensagens movidas: " . $movedCount . "\n";
    
    // 3. Deletar conversa LID
    $convLid->forceDelete();
    echo "✅ Conversa LID deletada\n\n";
    
    echo "===================\n";
    echo "🎉 MERGE CONCLUÍDO COM SUCESSO!\n\n";
    
    // Verificar resultado
    $finalMsgCount = \App\Models\WhatsappMessage::where('conversation_id', $convNormal->id)->count();
    echo "📊 RESULTADO FINAL:\n";
    echo "   ID: " . $convNormal->id . "\n";
    echo "   Nome: " . $convNormal->contact_name . "\n";
    echo "   JID: " . $convNormal->remote_jid . "\n";
    echo "   Total de mensagens: " . $finalMsgCount . "\n\n";
    
} catch (\Exception $e) {
    echo "❌ ERRO: " . $e->getMessage() . "\n";
    exit(1);
}
