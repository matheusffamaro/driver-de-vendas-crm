<?php

require '/var/www/html/vendor/autoload.php';
$app = require_once '/var/www/html/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "🔍 INVESTIGANDO IA DA SESSÃO ADMIN (5512991280763)\n\n";

// Buscar sessão admin@crm.com
$session = \App\Models\WhatsappSession::where('phone_number', '5512991280763')->first();

if (!$session) {
    echo "❌ Sessão não encontrada\n";
    exit(1);
}

echo "✅ SESSÃO ENCONTRADA:\n";
echo "   Telefone: {$session->phone_number}\n";
echo "   ID: {$session->id}\n";
echo "   Nome: {$session->session_name}\n";
echo "   Tenant ID: {$session->tenant_id}\n\n";

echo "🤖 TODOS OS AGENTES DO SISTEMA:\n\n";
$allAgents = \App\Models\AiChatAgent::withoutGlobalScopes()->get();
foreach ($allAgents as $ag) {
    $sessionInfo = $ag->whatsapp_session_id ?? 'null (global)';
    if ($ag->whatsapp_session_id === 'none') {
        $sessionInfo = 'none (desativado)';
    }
    
    echo "📋 {$ag->name}\n";
    echo "   Ativo: " . ($ag->is_active ? "✅ SIM" : "❌ NÃO") . "\n";
    echo "   Tenant: " . $ag->tenant_id . "\n";
    echo "   Session ID: {$sessionInfo}\n";
    
    if ($ag->whatsapp_session_id === $session->id) {
        echo "   ⚠️  ESTE É O AGENTE DA SESSÃO ADMIN!\n";
    }
    echo "\n";
}

echo "===================\n";
echo "🎯 AGENTE ATIVO PARA ESTA SESSÃO (lógica do sistema):\n\n";

$activeAgent = \App\Models\AiChatAgent::withoutGlobalScopes()
    ->where('tenant_id', $session->tenant_id)
    ->where('is_active', true)
    ->where('whatsapp_session_id', '!=', 'none')
    ->where(function ($q) use ($session) {
        $q->where('whatsapp_session_id', $session->id)
            ->orWhereNull('whatsapp_session_id');
    })
    ->first();

if ($activeAgent) {
    echo "⚠️  AGENTE ATIVO ENCONTRADO:\n";
    echo "   Nome: {$activeAgent->name}\n";
    echo "   ID: {$activeAgent->id}\n";
    echo "   is_active: " . ($activeAgent->is_active ? "true" : "false") . "\n";
    echo "   whatsapp_session_id: " . ($activeAgent->whatsapp_session_id ?? "null") . "\n\n";
    
    if ($activeAgent->whatsapp_session_id === null) {
        echo "   💡 Este é um agente GLOBAL (sem sessão específica)\n";
        echo "   🐛 BUG: Agente global está respondendo para sessão desativada!\n";
    } else if ($activeAgent->whatsapp_session_id === $session->id) {
        echo "   🐛 BUG: Agente está is_active=true mas UI mostra desativado!\n";
    }
} else {
    echo "✅ Nenhum agente ativo (como esperado)\n";
}

echo "\n📨 ÚLTIMA MENSAGEM IA NA SESSÃO:\n";
$lastAiMsg = \App\Models\WhatsappMessage::whereIn('conversation_id', function($q) use ($session) {
    $q->select('id')->from('whatsapp_conversations')->where('session_id', $session->id);
})
->where('direction', 'outgoing')
->where('content', 'like', '%Olá%')
->orderBy('created_at', 'desc')
->first();

if ($lastAiMsg) {
    echo "   Horário: {$lastAiMsg->created_at}\n";
    echo "   Conteúdo: " . substr($lastAiMsg->content, 0, 100) . "...\n";
}
