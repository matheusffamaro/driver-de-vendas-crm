#!/bin/bash

echo "CONFIGURANDO SMTP MGACODE.COM.BR"
echo ""

ENV_FILE="/opt/driver-crm/docker/.env.prod"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERRO: Arquivo $ENV_FILE nao encontrado."
  exit 1
fi

# Backup
cp "$ENV_FILE" "${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
echo "Backup criado"

# Atualizar configuracoes (exceto MAIL_PASSWORD, que deve ser definida manualmente)
sed -i 's/^MAIL_MAILER=.*/MAIL_MAILER=smtp/' "$ENV_FILE"
sed -i 's/^MAIL_HOST=.*/MAIL_HOST=mail.mgacode.com.br/' "$ENV_FILE"
sed -i 's/^MAIL_PORT=.*/MAIL_PORT=465/' "$ENV_FILE"
sed -i 's/^MAIL_USERNAME=.*/MAIL_USERNAME=noreply@mgacode.com.br/' "$ENV_FILE"
sed -i 's/^MAIL_ENCRYPTION=.*/MAIL_ENCRYPTION=ssl/' "$ENV_FILE"
sed -i 's/^MAIL_FROM_ADDRESS=.*/MAIL_FROM_ADDRESS=noreply@mgacode.com.br/' "$ENV_FILE"
sed -i 's/^MAIL_FROM_NAME=.*/MAIL_FROM_NAME="Driver de Vendas CRM"/' "$ENV_FILE"

echo ""
echo "Configuracoes atualizadas:"
echo ""
grep "^MAIL_" "$ENV_FILE" | grep -v "MAIL_PASSWORD"

# Check if MAIL_PASSWORD is set
if grep -q '^MAIL_PASSWORD=$' "$ENV_FILE" || ! grep -q '^MAIL_PASSWORD=' "$ENV_FILE"; then
  echo ""
  echo "ATENCAO: MAIL_PASSWORD nao esta definida no $ENV_FILE."
  echo "Defina manualmente: nano $ENV_FILE"
  echo "Exemplo: MAIL_PASSWORD=\"sua-senha-aqui\""
  exit 1
fi

echo "MAIL_PASSWORD=*** (ja definida)"
echo ""

# Reiniciar container
echo "Reiniciando container para aplicar configuracoes..."
cd /opt/driver-crm/docker
docker compose --env-file .env.prod up -d --build api

echo ""
echo "Aguardando container iniciar (10s)..."
sleep 10

echo ""
echo "Limpando cache do Laravel..."
docker exec dv-api php artisan config:clear
docker exec dv-api php artisan cache:clear

echo ""
echo "CONFIGURACAO CONCLUIDA!"
