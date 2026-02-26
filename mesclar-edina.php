<?php

require '/var/www/html/vendor/autoload.php';
$app = require_once '/var/www/html/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
echo "🔧 MESCLANDO CONVERSAS MANUALMENTE\n";
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

$wrongConv = \App\Models\WhatsappConversation::where('remote_jid', '225429998833693@s.whatsapp.net')->first();
$correctConv = \App\Models\WhatsappConversation::where('remote_jid', '5512974086119@s.whatsapp.net')->first();

if (!$wrongConv) {
    echo "❌ Erro: Conversa incorreta não encontrada\n";
    exit(1);
}

if (!$correctConv) {
    echo "❌ Erro: Conversa correta não encontrada\n";
    exit(1);
}

echo "📱 Conversa INCORRETA (será deletada):\n";
echo "   ID: {$wrongConv->id}\n";
echo "   Número: {$wrongConv->contact_phone}\n";
$wrongMsgCount = \App\Models\WhatsappMessage::where('conversation_id', $wrongConv->id)->count();
echo "   Mensagens: {$wrongMsgCount}\n\n";

echo "📱 Conversa CORRETA (receberá as mensagens):\n";
echo "   ID: {$correctConv->id}\n";
echo "   Número: {$correctConv->contact_phone}\n";
$correctMsgCount = \App\Models\WhatsappMessage::where('conversation_id', $correctConv->id)->count();
echo "   Mensagens: {$correctMsgCount}\n\n";

echo "🔄 Movendo mensagens...\n";

$movedCount = \App\Models\WhatsappMessage::where('conversation_id', $wrongConv->id)
    ->update(['conversation_id' => $correctConv->id]);

echo "✅ {$movedCount} mensagens movidas\n\n";

$correctConv->update([
    'contact_name' => 'Edina Borges',
    'last_message_at' => now()
]);

echo "✅ Nome atualizado para: Edina Borges\n\n";

$wrongConv->delete();

echo "✅ Conversa incorreta deletada\n\n";

$finalCount = \App\Models\WhatsappMessage::where('conversation_id', $correctConv->id)->count();

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
echo "✅ MESCLAGEM CONCLUÍDA COM SUCESSO!\n";
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

echo "📊 Resultado final:\n";
echo "   ID da conversa: {$correctConv->id}\n";
echo "   Nome: Edina Borges\n";
echo "   Telefone: +55 12 97408-6119\n";
echo "   Total de mensagens: {$finalCount}\n";
