<?php

require '/var/www/html/vendor/autoload.php';
$app = require_once '/var/www/html/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "🔧 CORRIGINDO TENANT_ID DOS AGENTES\n\n";

// Buscar sessão admin
$sessionAdmin = \App\Models\WhatsappSession::where('phone_number', '5512991280763')->first();
echo "✅ Sessão Admin: {$sessionAdmin->phone_number}\n";
echo "   Tenant correto: {$sessionAdmin->tenant_id}\n\n";

// Buscar agentes linkados a esta sessão mas com tenant errado
$agentsWithWrongTenant = \App\Models\AiChatAgent::withoutGlobalScopes()
    ->where('whatsapp_session_id', $sessionAdmin->id)
    ->where('tenant_id', '!=', $sessionAdmin->tenant_id)
    ->get();

echo "🔍 Agentes com tenant_id errado:\n\n";

foreach ($agentsWithWrongTenant as $agent) {
    echo "📋 {$agent->name}\n";
    echo "   ID: {$agent->id}\n";
    echo "   Ativo: " . ($agent->is_active ? "SIM" : "NÃO") . "\n";
    echo "   Tenant ERRADO: {$agent->tenant_id}\n";
    echo "   Tenant CORRETO: {$sessionAdmin->tenant_id}\n\n";
    
    // Corrigir tenant_id
    $agent->update(['tenant_id' => $sessionAdmin->tenant_id]);
    echo "   ✅ Tenant_id corrigido!\n\n";
}

if ($agentsWithWrongTenant->isEmpty()) {
    echo "✅ Nenhum agente com tenant errado\n";
}

echo "\n===================\n";
echo "🎯 DESATIVANDO AGENTES DUPLICADOS:\n\n";

// Buscar agentes duplicados para a mesma sessão
$agentesAdmin = \App\Models\AiChatAgent::withoutGlobalScopes()
    ->where('whatsapp_session_id', $sessionAdmin->id)
    ->where('tenant_id', $sessionAdmin->tenant_id)
    ->get();

echo "Total de agentes para sessão admin: {$agentesAdmin->count()}\n\n";

if ($agentesAdmin->count() > 1) {
    echo "⚠️  DUPLICATAS ENCONTRADAS! Mantendo apenas o mais recente:\n\n";
    
    $agentesMaisRecentes = $agentesAdmin->sortByDesc('updated_at');
    $manter = $agentesMaisRecentes->first();
    $desativar = $agentesMaisRecentes->slice(1);
    
    echo "✅ MANTENDO:\n";
    echo "   {$manter->name} (ID: " . substr($manter->id, 0, 8) . "...)\n";
    echo "   Atualizado em: {$manter->updated_at}\n\n";
    
    echo "❌ DESATIVANDO:\n";
    foreach ($desativar as $dup) {
        echo "   {$dup->name} (ID: " . substr($dup->id, 0, 8) . "...)\n";
        $dup->update(['is_active' => false]);
        echo "      ✅ Desativado\n";
    }
} else {
    echo "✅ Apenas 1 agente (sem duplicatas)\n";
}

echo "\n🧹 Limpando cache:\n";
\Artisan::call('cache:clear');
\Artisan::call('config:clear');
echo "✅ Cache limpo\n\n";

echo "===================\n";
echo "🎉 CORREÇÃO CONCLUÍDA!\n";
