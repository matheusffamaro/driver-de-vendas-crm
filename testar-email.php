<?php

require '/var/www/html/vendor/autoload.php';
$app = require_once '/var/www/html/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "🧪 TESTANDO ENVIO DE EMAIL\n\n";

echo "📬 Configuração atual:\n";
echo "MAIL_MAILER: " . config('mail.default') . "\n";
echo "MAIL_HOST: " . config('mail.mailers.smtp.host') . "\n";
echo "MAIL_PORT: " . config('mail.mailers.smtp.port') . "\n";
echo "MAIL_USERNAME: " . config('mail.mailers.smtp.username') . "\n";
echo "MAIL_ENCRYPTION: " . config('mail.mailers.smtp.encryption') . "\n";
echo "MAIL_FROM: " . config('mail.from.address') . "\n\n";

echo "📤 Enviando email de teste para alessandro@driverdevendas.com.br...\n\n";

try {
    Mail::raw('Este é um email de teste do Driver CRM para verificar se o SMTP está funcionando corretamente.', function($message) {
        $message->to('alessandro@driverdevendas.com.br')
                ->subject('Teste de Configuração SMTP - Driver CRM');
    });
    echo "✅ Email enviado com sucesso!\n";
    echo "📨 Verifique a caixa de entrada de alessandro@driverdevendas.com.br\n";
    echo "⚠️  Se não aparecer, verifique a pasta de SPAM\n\n";
} catch (\Exception $e) {
    echo "❌ ERRO ao enviar email:\n";
    echo "   Mensagem: " . $e->getMessage() . "\n";
    echo "   Classe: " . get_class($e) . "\n\n";
    
    // Mostrar detalhes úteis
    if (str_contains($e->getMessage(), 'authenticate')) {
        echo "💡 Problema de autenticação - verifique usuário/senha\n";
    } elseif (str_contains($e->getMessage(), 'connection')) {
        echo "💡 Problema de conexão - verifique host/porta\n";
    }
}
