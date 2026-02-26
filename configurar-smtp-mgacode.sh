#!/bin/bash

echo "📧 CONFIGURANDO SMTP DO MGACODE.COM.BR"
echo ""

# Caminho do .env no servidor
ENV_FILE="/opt/driver-crm/docker/.env.prod"

echo "📝 Atualizando configurações de email..."
echo ""

# Backup do .env atual
cp "$ENV_FILE" "${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
echo "✅ Backup criado: ${ENV_FILE}.backup"

# Atualizar configurações SMTP
sed -i 's/^MAIL_MAILER=.*/MAIL_MAILER=smtp/' "$ENV_FILE"
sed -i 's/^MAIL_HOST=.*/MAIL_HOST=mail.mgacode.com.br/' "$ENV_FILE"
sed -i 's/^MAIL_PORT=.*/MAIL_PORT=465/' "$ENV_FILE"
sed -i 's/^MAIL_USERNAME=.*/MAIL_USERNAME=noreply@mgacode.com.br/' "$ENV_FILE"
sed -i 's/^MAIL_ENCRYPTION=.*/MAIL_ENCRYPTION=ssl/' "$ENV_FILE"
sed -i 's/^MAIL_FROM_ADDRESS=.*/MAIL_FROM_ADDRESS=noreply@mgacode.com.br/' "$ENV_FILE"
sed -i 's/^MAIL_FROM_NAME=.*/MAIL_FROM_NAME="Driver de Vendas CRM"/' "$ENV_FILE"

echo "✅ Configurações atualizadas:"
echo ""
grep "^MAIL_" "$ENV_FILE" | grep -v "MAIL_PASSWORD"
echo "MAIL_PASSWORD=*** (não alterado - você precisa configurar manualmente)"
echo ""
echo "⚠️  PRÓXIMO PASSO MANUAL:"
echo "   1. Edite o arquivo: $ENV_FILE"
echo "   2. Atualize a linha: MAIL_PASSWORD=SUA_SENHA_AQUI"
echo "   3. Reinicie o container: cd /opt/driver-crm/docker && docker compose -f docker-compose.prod.yml restart dv-api"
echo ""
echo "📋 OU execute:"
echo "   nano $ENV_FILE"
echo "   # Procure por MAIL_PASSWORD e atualize"
echo "   # Salve com Ctrl+O, saia com Ctrl+X"
