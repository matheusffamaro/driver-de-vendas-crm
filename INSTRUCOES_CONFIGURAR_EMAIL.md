# 📧 Configurar Email SMTP (mgacode.com.br)

**Data**: 26/02/2026  
**Problema**: Emails de convite não estão sendo enviados  
**Causa**: Configuração SMTP incorreta (Gmail sem senha de aplicativo)  
**Solução**: Usar SMTP do domínio mgacode.com.br  

---

## ✅ Configurações SMTP

```
Servidor: mail.mgacode.com.br
Porta: 465 (SSL)
Usuário: noreply@mgacode.com.br
Senha: [senha da conta de email]
Autenticação: Sim (obrigatória)
```

---

## 🔧 Como Configurar

### 1. Execute o script automático:

```bash
bash /opt/driver-crm/configurar-smtp-mgacode.sh
```

Isso vai atualizar automaticamente:
- `MAIL_MAILER=smtp`
- `MAIL_HOST=mail.mgacode.com.br`
- `MAIL_PORT=465`
- `MAIL_USERNAME=noreply@mgacode.com.br`
- `MAIL_ENCRYPTION=ssl`
- `MAIL_FROM_ADDRESS=noreply@mgacode.com.br`

### 2. Configure a senha manualmente:

```bash
nano /opt/driver-crm/docker/.env.prod
```

Procure por `MAIL_PASSWORD` e atualize:
```
MAIL_PASSWORD=sua_senha_do_email_aqui
```

Salve: `Ctrl+O` → Enter → `Ctrl+X`

### 3. Reinicie o container:

```bash
cd /opt/driver-crm/docker
docker compose -f docker-compose.prod.yml restart dv-api
```

### 4. Teste o envio:

```bash
docker exec dv-api php /tmp/diagnosticar-emails.php
```

Deve mostrar: `✅ Sistema de email está configurado`

---

## 🧪 Testar Email Funcionando

Após configurar, execute:

```bash
docker exec dv-api php artisan tinker --execute="
Mail::raw('Teste de email - Driver CRM', function(\$m) {
    \$m->to('alessandro@driverdevendas.com.br')
      ->subject('Teste de Configuração SMTP');
});
echo 'Email de teste enviado!';
"
```

Verifique a caixa de entrada de alessandro@driverdevendas.com.br.

---

## 🔄 Reenviar Convites Pendentes

Após configurar o SMTP corretamente, reenvie os convites:

```bash
docker exec dv-api php -r "
require '/var/www/html/vendor/autoload.php';
\$app = require_once '/var/www/html/bootstrap/app.php';
\$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

\$pending = \App\Models\UserInvitation::whereNull('accepted_at')
    ->where('expires_at', '>', now())
    ->get();

foreach (\$pending as \$inv) {
    \$inv->load(['inviter', 'roleRelation']);
    Mail::to(\$inv->email)->send(new \App\Mail\UserInvitationMail(\$inv));
    echo '✅ Convite reenviado para: ' . \$inv->email . PHP_EOL;
}
"
```

---

## ⚠️ Observações

1. **Senha de aplicativo não é necessária** - você usa a senha normal da conta `noreply@mgacode.com.br`
2. **Porta 465 usa SSL** - configure `MAIL_ENCRYPTION=ssl` (não TLS)
3. **Verifique spam** - primeiros emails podem cair no spam
4. **DNS/SPF** - Certifique-se que o domínio tem registros SPF configurados para evitar spam
