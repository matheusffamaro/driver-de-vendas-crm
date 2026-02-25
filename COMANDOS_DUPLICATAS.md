# 📖 Comandos para Gerenciar Conversas Duplicadas

## 🎯 Comandos Rápidos

### 1. Ver Duplicatas (Dry Run)
```bash
# Ver duplicatas sem fazer alterações
docker exec dv-api php artisan whatsapp:merge-duplicates --dry-run
```

### 2. Limpar Todas as Duplicatas
```bash
# Mesclar duplicatas em todas as sessões
docker exec dv-api php artisan whatsapp:merge-duplicates
```

### 3. Limpar Duplicatas de uma Sessão Específica
```bash
# Buscar ID da sessão
docker exec dv-api php artisan tinker --execute="
\$sessions = \App\Models\WhatsappSession::all();
foreach (\$sessions as \$s) {
    echo \$s->phone_number . ' => ' . \$s->id . '\n';
}
"

# Mesclar duplicatas de uma sessão específica
docker exec dv-api php artisan whatsapp:merge-duplicates --session=<SESSION_ID>
```

---

## 🔍 Diagnóstico Detalhado

### Ver Estatísticas de Duplicatas
```bash
docker exec dv-api php artisan tinker --execute="
\$convs = \App\Models\WhatsappConversation::where('is_group', false)->get();

// Agrupar por telefone normalizado
\$byPhone = [];
foreach (\$convs as \$c) {
    \$digits = preg_replace('/\D/', '', \$c->contact_phone ?? '');
    if (strlen(\$digits) >= 10) {
        \$byPhone[\$digits] = \$byPhone[\$digits] ?? [];
        \$byPhone[\$digits][] = \$c;
    }
}

\$duplicates = array_filter(\$byPhone, fn(\$g) => count(\$g) > 1);

echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
echo '📊 ESTATÍSTICAS DE CONVERSAS\n';
echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
echo 'Total de conversas: ' . \$convs->count() . '\n';
echo 'Números únicos: ' . count(\$byPhone) . '\n';
echo 'Números com duplicatas: ' . count(\$duplicates) . '\n';
echo 'Total de conversas duplicadas: ' . array_sum(array_map(fn(\$g) => count(\$g) - 1, \$duplicates)) . '\n\n';

if (count(\$duplicates) > 0) {
    echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    echo '🔍 TOP 10 NÚMEROS COM MAIS DUPLICATAS\n';
    echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    
    \$sorted = collect(\$duplicates)->sortByDesc(fn(\$g) => count(\$g))->take(10);
    
    foreach (\$sorted as \$phone => \$group) {
        \$name = \$group[0]->contact_name ?? 'Sem nome';
        echo '📱 ' . \$name . ' (+' . \$phone . '): ' . count(\$group) . ' conversas\n';
        
        foreach (\$group as \$conv) {
            \$msgCount = \App\Models\WhatsappMessage::where('conversation_id', \$conv->id)->count();
            \$jidType = str_ends_with(\$conv->remote_jid, '@s.whatsapp.net') ? '📞 Phone' : 
                       (str_ends_with(\$conv->remote_jid, '@lid') ? '🔒 LID' : '📧 Other');
            echo '   ' . \$jidType . ': ' . \$conv->remote_jid . ' (' . \$msgCount . ' msgs)\n';
        }
        echo '\n';
    }
}
"
```

### Ver Duplicatas por Sessão
```bash
docker exec dv-api php artisan tinker --execute="
\$sessions = \App\Models\WhatsappSession::with('conversations')->get();

foreach (\$sessions as \$session) {
    \$convs = \$session->conversations->where('is_group', false);
    
    \$byPhone = [];
    foreach (\$convs as \$c) {
        \$digits = preg_replace('/\D/', '', \$c->contact_phone ?? '');
        if (strlen(\$digits) >= 10) {
            \$byPhone[\$digits] = \$byPhone[\$digits] ?? [];
            \$byPhone[\$digits][] = \$c;
        }
    }
    
    \$duplicates = array_filter(\$byPhone, fn(\$g) => count(\$g) > 1);
    
    if (count(\$duplicates) > 0) {
        echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        echo '📱 Sessão: ' . \$session->phone_number . '\n';
        echo '   Duplicatas: ' . count(\$duplicates) . ' números\n\n';
        
        foreach (\$duplicates as \$phone => \$group) {
            \$name = \$group[0]->contact_name ?? 'Sem nome';
            echo '   • ' . \$name . ' (+' . \$phone . '): ' . count(\$group) . ' conversas\n';
        }
        echo '\n';
    }
}
"
```

---

## 🧹 Scripts Shell (Alternativa)

### ver-duplicadas.sh
```bash
bash ver-duplicadas.sh
```

### limpar-duplicadas.sh
```bash
bash limpar-duplicadas.sh
```

---

## 🔧 Comandos de Manutenção

### Limpar Conversas Órfãs (sem mensagens)
```bash
docker exec dv-api php artisan tinker --execute="
\$orphans = \App\Models\WhatsappConversation::whereDoesntHave('messages')->get();
echo 'Conversas órfãs encontradas: ' . \$orphans->count() . '\n';

if (\$orphans->count() > 0) {
    \$orphans->each(fn(\$c) => \$c->delete());
    echo '✅ Conversas órfãs removidas\n';
}
"
```

### Recriar Índices de Performance
```bash
# Otimizar índices para busca de duplicatas
docker exec dv-api php artisan tinker --execute="
DB::statement('ANALYZE TABLE whatsapp_conversations');
DB::statement('ANALYZE TABLE whatsapp_messages');
echo '✅ Índices otimizados\n';
"
```

### Ver Conversas com Múltiplos JIDs
```bash
docker exec dv-api php artisan tinker --execute="
\$convs = \App\Models\WhatsappConversation::where('is_group', false)
    ->whereNotNull('lid_jid')
    ->get();

echo '🔍 Conversas com múltiplos JIDs: ' . \$convs->count() . '\n\n';

foreach (\$convs as \$conv) {
    echo '• ' . (\$conv->contact_name ?? \$conv->contact_phone) . '\n';
    echo '  remote_jid: ' . \$conv->remote_jid . '\n';
    echo '  lid_jid: ' . \$conv->lid_jid . '\n\n';
}
"
```

---

## 📊 Monitoramento Contínuo

### Job Diário de Limpeza (Agendado)
```bash
# Adicionar ao scheduler (já existe no sistema)
# Ver: WhatsappController::mergeDuplicateConversationsInSession()
```

### Criar Alerta de Duplicatas
```bash
docker exec dv-api php artisan tinker --execute="
\$convs = \App\Models\WhatsappConversation::where('is_group', false)->get();
\$byPhone = [];
foreach (\$convs as \$c) {
    \$digits = preg_replace('/\D/', '', \$c->contact_phone ?? '');
    if (strlen(\$digits) >= 10) {
        \$byPhone[\$digits] = \$byPhone[\$digits] ?? [];
        \$byPhone[\$digits][] = \$c;
    }
}

\$duplicates = array_filter(\$byPhone, fn(\$g) => count(\$g) > 1);

if (count(\$duplicates) > 5) {
    echo '⚠️  ALERTA: ' . count(\$duplicates) . ' números com conversas duplicadas!\n';
    echo '   Execute: php artisan whatsapp:merge-duplicates\n';
} else {
    echo '✅ Sistema OK - Poucas ou nenhuma duplicata\n';
}
"
```

---

## 🎓 Exemplos Práticos

### Exemplo 1: Verificar e Limpar
```bash
# 1. Ver duplicatas
docker exec dv-api php artisan whatsapp:merge-duplicates --dry-run

# 2. Se OK, mesclar
docker exec dv-api php artisan whatsapp:merge-duplicates

# 3. Verificar resultado
docker exec dv-api php artisan whatsapp:merge-duplicates --dry-run
```

### Exemplo 2: Limpar Sessão Específica
```bash
# 1. Listar sessões
docker exec dv-api php artisan tinker --execute="
\$sessions = \App\Models\WhatsappSession::all(['id', 'phone_number']);
foreach (\$sessions as \$s) echo \$s->phone_number . ' => ' . \$s->id . '\n';
"

# 2. Ver duplicatas da sessão
docker exec dv-api php artisan whatsapp:merge-duplicates \
  --session=abc-123-def \
  --dry-run

# 3. Mesclar
docker exec dv-api php artisan whatsapp:merge-duplicates \
  --session=abc-123-def
```

### Exemplo 3: Análise Antes e Depois
```bash
# ANTES
echo "=== ANTES DA LIMPEZA ===" > /tmp/duplicates-before.txt
docker exec dv-api php artisan whatsapp:merge-duplicates --dry-run >> /tmp/duplicates-before.txt

# LIMPAR
docker exec dv-api php artisan whatsapp:merge-duplicates

# DEPOIS
echo "=== DEPOIS DA LIMPEZA ===" > /tmp/duplicates-after.txt
docker exec dv-api php artisan whatsapp:merge-duplicates --dry-run >> /tmp/duplicates-after.txt

# COMPARAR
diff /tmp/duplicates-before.txt /tmp/duplicates-after.txt
```

---

## 🚨 Troubleshooting

### Erro: "Class not found"
```bash
# Rebuild autoload
docker exec dv-api composer dump-autoload
```

### Erro: "Too many connections"
```bash
# Aumentar max_connections no MySQL
docker exec dv-api php artisan tinker --execute="
DB::statement('SET GLOBAL max_connections = 500');
"
```

### Performance Lenta
```bash
# Processar em lotes menores
docker exec dv-api php artisan tinker --execute="
\$sessions = \App\Models\WhatsappSession::all();
foreach (\$sessions as \$session) {
    echo 'Processing ' . \$session->phone_number . '...\n';
    Artisan::call('whatsapp:merge-duplicates', ['--session' => \$session->id]);
    sleep(1); // Pausa entre sessões
}
"
```

---

## 📋 Checklist de Manutenção

### Semanal:
- [ ] Executar `whatsapp:merge-duplicates --dry-run`
- [ ] Se >10 duplicatas, executar merge
- [ ] Verificar logs de erro

### Mensal:
- [ ] Analisar padrões de duplicação
- [ ] Limpar conversas órfãs
- [ ] Otimizar índices do banco

### Trimestral:
- [ ] Revisar lógica de merge
- [ ] Atualizar scripts de diagnóstico
- [ ] Documentar casos especiais

---

**Comandos sempre atualizados!** 🚀
