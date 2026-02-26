#!/bin/bash

echo "📧 CONFIGURANDO SMTP MGACODE.COM.BR"
echo ""

ENV_FILE="/opt/driver-crm/docker/.env.prod"

# Backup
cp "$ENV_FILE" "${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
echo "✅ Backup criado"

# Atualizar todas as configurações
sed -i 's/^MAIL_MAILER=.*/MAIL_MAILER=smtp/' "$ENV_FILE"
sed -i 's/^MAIL_HOST=.*/MAIL_HOST=mail.mgacode.com.br/' "$ENV_FILE"
sed -i 's/^MAIL_PORT=.*/MAIL_PORT=465/' "$ENV_FILE"
sed -i 's/^MAIL_USERNAME=.*/MAIL_USERNAME=noreply@mgacode.com.br/' "$ENV_FILE"
sed -i 's/^MAIL_PASSWORD=.*/MAIL_PASSWORD="?a#G$\&Z-j~MI]-aI"/' "$ENV_FILE"
sed -i 's/^MAIL_ENCRYPTION=.*/MAIL_ENCRYPTION=ssl/' "$ENV_FILE"
sed -i 's/^MAIL_FROM_ADDRESS=.*/MAIL_FROM_ADDRESS=noreply@mgacode.com.br/' "$ENV_FILE"
sed -i 's/^MAIL_FROM_NAME=.*/MAIL_FROM_NAME="Driver de Vendas CRM"/' "$ENV_FILE"

# Verificar se linhas foram atualizadas
echo ""
echo "✅ Configurações atualizadas:"
echo ""
grep "^MAIL_" "$ENV_FILE" | grep -v "MAIL_PASSWORD"
echo "MAIL_PASSWORD=*** (configurada)"
echo ""

# Reiniciar container
echo "🔄 Reiniciando container para aplicar configurações..."
cd /opt/driver-crm/docker
docker compose -f docker-compose.prod.yml restart dv-api

echo ""
echo "⏳ Aguardando container iniciar (10s)..."
sleep 10

echo ""
echo "🧹 Limpando cache do Laravel..."
docker exec dv-api php artisan config:clear
docker exec dv-api php artisan cache:clear

echo ""
echo "✅ CONFIGURAÇÃO CONCLUÍDA!"
echo ""
echo "🧪 Testando envio de email..."
docker exec dv-api php /tmp/diagnosticar-emails.php
