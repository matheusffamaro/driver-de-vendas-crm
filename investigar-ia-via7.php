<?php

require '/var/www/html/vendor/autoload.php';
$app = require_once '/var/www/html/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "🔍 INVESTIGANDO IA DA VIA7RECRUTAMENTO\n\n";

// Buscar sessão Via7 (pela imagem parece ser 551191513447)
$possiblePhones = ['5511915134473', '551191513447'];

foreach ($possiblePhones as $phone) {
    $session = \App\Models\WhatsappSession::where('phone_number', 'like', "%{$phone}%")->first();
    if ($session) {
        echo "✅ SESSÃO ENCONTRADA: {$session->phone_number}\n";
        echo "   ID: {$session->id}\n";
        echo "   Nome: {$session->session_name}\n";
        echo "   Status: {$session->status}\n";
        echo "   Tenant ID: {$session->tenant_id}\n\n";
        
        // Buscar IA agent usando MESMA lógica do WhatsappAIAgentService
        echo "🤖 AGENTES DE IA PARA ESTA SESSÃO:\n\n";
        
        $tenantId = $session->tenant_id;
        $agents = \App\Models\AiChatAgent::withoutGlobalScopes()
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->where('whatsapp_session_id', '!=', 'none')
            ->where(function ($q) use ($session) {
                $q->where('whatsapp_session_id', $session->id)
                    ->orWhereNull('whatsapp_session_id');
            })
            ->get();
        
        echo "Filtros aplicados:\n";
        echo "   tenant_id = {$tenantId}\n";
        echo "   is_active = true\n";
        echo "   whatsapp_session_id != 'none'\n";
        echo "   (whatsapp_session_id = {$session->id} OR IS NULL)\n\n";
        
        echo "Total encontrado: " . $agents->count() . "\n\n";
        
        foreach ($agents as $agent) {
            echo "📋 Agente: {$agent->name}\n";
            echo "   ID: {$agent->id}\n";
            echo "   Ativo: " . ($agent->is_active ? "✅ SIM" : "❌ NÃO") . "\n";
            echo "   Session ID: " . ($agent->whatsapp_session_id ?? 'null (global)') . "\n";
            echo "   Tenant ID: {$agent->tenant_id}\n";
            echo "   Model: {$agent->model}\n";
            echo "   Temperatura: {$agent->temperature}\n\n";
        }
        
        // Verificar últimas mensagens
        echo "📨 ÚLTIMAS 5 MENSAGENS DA SESSÃO:\n\n";
        $conversations = \App\Models\WhatsappConversation::where('session_id', $session->id)
            ->orderBy('last_message_at', 'desc')
            ->take(3)
            ->get();
        
        foreach ($conversations as $conv) {
            $lastMsg = \App\Models\WhatsappMessage::where('conversation_id', $conv->id)
                ->orderBy('created_at', 'desc')
                ->first();
            
            if ($lastMsg) {
                $dir = $lastMsg->direction == 'incoming' ? '🔵' : '🟢';
                echo "{$dir} {$conv->contact_name} ({$lastMsg->created_at}):\n";
                echo "   " . substr($lastMsg->content ?? '', 0, 60) . "\n\n";
            }
        }
        
        break;
    }
}

if (!isset($session)) {
    echo "❌ Sessão Via7 não encontrada\n";
    echo "Tentei: " . implode(', ', $possiblePhones) . "\n";
}
