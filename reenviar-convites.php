<?php

require '/var/www/html/vendor/autoload.php';
$app = require_once '/var/www/html/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "📧 REENVIANDO CONVITES PENDENTES:\n\n";

$pending = \App\Models\UserInvitation::whereNull('accepted_at')
    ->where('expires_at', '>', now())
    ->get();

echo "Total de convites pendentes: " . $pending->count() . "\n\n";

foreach ($pending as $inv) {
    echo "📨 Enviando para: {$inv->email}...\n";
    try {
        $inv->load(['inviter', 'roleRelation']);
        Mail::to($inv->email)->send(new \App\Mail\UserInvitationMail($inv));
        echo "   ✅ Enviado com sucesso!\n\n";
    } catch (\Exception $e) {
        echo "   ❌ Erro: " . $e->getMessage() . "\n\n";
    }
}

echo "✅ Processo concluído!\n";
