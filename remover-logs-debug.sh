#!/bin/bash

echo "🧹 Removendo instrumentação de debug..."

# WhatsappController.php - remover blocos de log
docker exec dv-api sed -i '/\/\/ #region agent log/,/\/\/ #endregion/d' /var/www/html/app/Http/Controllers/Api/WhatsappController.php

echo "✅ WhatsappController.php limpo"

# Verificar quantas linhas sobraram
LINES=$(docker exec dv-api wc -l < /var/www/html/app/Http/Controllers/Api/WhatsappController.php)
echo "📊 Linhas restantes: $LINES"

echo ""
echo "✅ Instrumentação removida com sucesso!"
