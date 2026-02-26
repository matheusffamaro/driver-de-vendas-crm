#!/bin/bash

echo "🔍 VERIFICANDO DEPLOY E WHATSAPP"
echo ""

echo "1️⃣ Verificando se código está deployado:"
if docker exec dv-api grep -q "agent log H1,H2,H3,H5" /var/www/html/app/Services/Whatsapp/WhatsappWebhookService.php; then
    echo "✅ Código instrumentado ESTÁ deployado"
else
    echo "❌ Código instrumentado NÃO está deployado"
fi

echo ""
echo "2️⃣ Verificando sessões WhatsApp ativas:"
docker exec dv-api php -r "
require '/var/www/html/vendor/autoload.php';
\$app = require_once '/var/www/html/bootstrap/app.php';
\$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

\$sessions = \App\Models\WhatsappSession::where('is_active', true)->get();
foreach (\$sessions as \$session) {
    echo '📱 ' . \$session->phone_number . ' - ' . \$session->session_name . ' - Status: ' . \$session->status . PHP_EOL;
}
"

echo ""
echo "3️⃣ Para reproduzir o bug, você precisa:"
echo "   a) Abrir web.whatsapp.com no navegador"
echo "   b) Escanear QR code com o telefone conectado ao CRM"
echo "   c) Enviar mensagem para Rosângela Guedes"
echo ""
echo "❓ Você consegue acessar web.whatsapp.com?"
