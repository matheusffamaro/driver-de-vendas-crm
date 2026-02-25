#!/bin/bash

# Script para encontrar e mesclar conversas duplicadas do WhatsApp

echo "═══════════════════════════════════════════════════════════════════════════"
echo "🧹 LIMPAR CONVERSAS DUPLICADAS"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""

# Função para executar PHP
run_php() {
    docker exec dv-api php artisan tinker --execute="$1" 2>/dev/null
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣ DETECTANDO CONVERSAS DUPLICADAS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

run_php "
// Buscar conversas agrupadas por telefone (dígitos)
\$convs = \App\Models\WhatsappConversation::where('is_group', false)
    ->whereNotNull('contact_phone')
    ->get();

\$byPhone = [];
foreach (\$convs as \$c) {
    \$digits = preg_replace('/\D/', '', \$c->contact_phone);
    if (strlen(\$digits) >= 10) {
        \$byPhone[\$digits] = \$byPhone[\$digits] ?? [];
        \$byPhone[\$digits][] = \$c;
    }
}

\$duplicates = array_filter(\$byPhone, fn(\$group) => count(\$group) > 1);

echo 'Total de conversas: ' . \$convs->count() . '\n';
echo 'Números com duplicatas: ' . count(\$duplicates) . '\n\n';

if (count(\$duplicates) > 0) {
    echo '📋 DUPLICATAS ENCONTRADAS:\n\n';
    foreach (\$duplicates as \$phone => \$group) {
        \$name = \$group[0]->contact_name ?? 'Sem nome';
        echo '• ' . \$name . ' (' . \$phone . '): ' . count(\$group) . ' conversas\n';
    }
}
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣ MESCLANDO CONVERSAS DUPLICADAS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

run_php "
\$sessions = \App\Models\WhatsappSession::all();
\$totalMerged = 0;

foreach (\$sessions as \$session) {
    \$convs = \App\Models\WhatsappConversation::where('session_id', \$session->id)
        ->where('is_group', false)
        ->get();
    
    if (\$convs->isEmpty()) continue;
    
    // Agrupar por telefone
    \$byPhone = [];
    foreach (\$convs as \$c) {
        \$digits = preg_replace('/\D/', '', \$c->contact_phone ?? '');
        if (strlen(\$digits) >= 10) {
            \$byPhone[\$digits] = \$byPhone[\$digits] ?? [];
            \$byPhone[\$digits][] = \$c;
        }
    }
    
    // Mesclar duplicatas
    foreach (\$byPhone as \$phone => \$group) {
        if (count(\$group) <= 1) continue;
        
        // Ordenar: preferir @s.whatsapp.net, depois mais mensagens
        usort(\$group, function(\$a, \$b) {
            \$aIsPhone = str_ends_with(\$a->remote_jid, '@s.whatsapp.net');
            \$bIsPhone = str_ends_with(\$b->remote_jid, '@s.whatsapp.net');
            if (\$aIsPhone && !\$bIsPhone) return -1;
            if (!\$aIsPhone && \$bIsPhone) return 1;
            
            \$aCount = \App\Models\WhatsappMessage::where('conversation_id', \$a->id)->count();
            \$bCount = \App\Models\WhatsappMessage::where('conversation_id', \$b->id)->count();
            return \$bCount <=> \$aCount;
        });
        
        \$keep = \$group[0];
        \$remove = array_slice(\$group, 1);
        
        echo 'Mesclando: ' . (\$keep->contact_name ?? \$phone) . ' (' . count(\$remove) . ' duplicatas)\n';
        
        foreach (\$remove as \$dup) {
            // Mover mensagens
            \App\Models\WhatsappMessage::where('conversation_id', \$dup->id)
                ->update(['conversation_id' => \$keep->id]);
            
            // Deletar duplicata
            \$dup->delete();
            \$totalMerged++;
        }
    }
}

echo '\n✅ Total mesclado: ' . \$totalMerged . ' conversas duplicadas\n';
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣ VERIFICANDO RESULTADO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

run_php "
\$convs = \App\Models\WhatsappConversation::where('is_group', false)->get();
\$byPhone = [];
foreach (\$convs as \$c) {
    \$digits = preg_replace('/\D/', '', \$c->contact_phone ?? '');
    if (strlen(\$digits) >= 10) {
        \$byPhone[\$digits] = \$byPhone[\$digits] ?? [];
        \$byPhone[\$digits][] = \$c;
    }
}

\$remaining = array_filter(\$byPhone, fn(\$g) => count(\$g) > 1);

if (count(\$remaining) > 0) {
    echo '⚠️  Ainda há ' . count(\$remaining) . ' números com duplicatas\n';
    echo '   (podem ser conversas legítimas em sessões diferentes)\n';
} else {
    echo '✅ Nenhuma duplicata encontrada!\n';
}
"

echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
