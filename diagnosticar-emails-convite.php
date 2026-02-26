<?php

require '/var/www/html/vendor/autoload.php';
$app = require_once '/var/www/html/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "🔍 DIAGNÓSTICO: EMAILS DE CONVITE\n\n";

// 1. Buscar usuário alessandro
$alessandro = \App\Models\User::where('email', 'like', '%alessandro%')->first();
if ($alessandro) {
    echo "✅ Usuário: {$alessandro->name} ({$alessandro->email})\n";
    echo "   Tenant ID: {$alessandro->tenant_id}\n\n";
} else {
    echo "❌ Usuário alessandro não encontrado\n\n";
}

// 2. Buscar convites criados recentemente (últimas 24h)
echo "📧 CONVITES CRIADOS NAS ÚLTIMAS 24 HORAS:\n\n";

$recentInvites = \App\Models\UserInvitation::where('created_at', '>=', now()->subDay())
    ->orderBy('created_at', 'desc')
    ->get();

if ($recentInvites->isEmpty()) {
    echo "❌ Nenhum convite recente encontrado\n\n";
} else {
    foreach ($recentInvites as $inv) {
        echo "📨 Para: {$inv->email}\n";
        echo "   Nome: {$inv->name}\n";
        echo "   Convidado por: " . ($inv->inviter?->name ?? 'N/A') . "\n";
        echo "   Criado em: {$inv->created_at}\n";
        echo "   Aceito: " . ($inv->accepted_at ? "✅ Sim ({$inv->accepted_at})" : "⏳ Pendente") . "\n";
        echo "   Expira em: {$inv->expires_at}\n\n";
    }
}

// 3. Verificar configuração de email
echo "===================\n";
echo "📬 CONFIGURAÇÃO DE EMAIL:\n\n";

echo "MAIL_MAILER: " . config('mail.default') . "\n";
echo "MAIL_HOST: " . config('mail.mailers.smtp.host') . "\n";
echo "MAIL_PORT: " . config('mail.mailers.smtp.port') . "\n";
echo "MAIL_USERNAME: " . config('mail.mailers.smtp.username') . "\n";
echo "MAIL_FROM_ADDRESS: " . config('mail.from.address') . "\n";
echo "MAIL_FROM_NAME: " . config('mail.from.name') . "\n\n";

// 4. Verificar fila de jobs
echo "===================\n";
echo "📋 JOBS NA FILA:\n\n";

try {
    $jobsCount = \DB::table('jobs')->count();
    echo "Jobs pendentes: {$jobsCount}\n";
    
    if ($jobsCount > 0) {
        $jobs = \DB::table('jobs')->orderBy('id', 'desc')->limit(5)->get();
        foreach ($jobs as $job) {
            $payload = json_decode($job->payload, true);
            $jobClass = $payload['displayName'] ?? 'Unknown';
            echo "   - {$jobClass} (Tentativas: {$job->attempts})\n";
        }
    }
} catch (\Exception $e) {
    echo "❌ Tabela 'jobs' não existe (queue não configurada)\n";
}

echo "\n===================\n";
echo "📝 TESTANDO ENVIO DE EMAIL:\n\n";

try {
    // Tentar enviar email de teste
    $testSent = \Mail::raw('Teste de envio de email', function($message) {
        $message->to('teste@exemplo.com')
                ->subject('Teste Driver CRM');
    });
    echo "✅ Sistema de email está configurado\n";
} catch (\Exception $e) {
    echo "❌ ERRO ao tentar enviar email:\n";
    echo "   " . $e->getMessage() . "\n";
    echo "   Classe: " . get_class($e) . "\n";
}
