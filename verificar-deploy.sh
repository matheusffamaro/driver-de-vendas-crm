#!/bin/bash

echo "🔍 Verificando se código instrumentado foi deployado..."
echo ""

docker exec dv-api grep -n "agent log H2" /var/www/html/app/Http/Controllers/Api/WhatsappController.php 2>/dev/null

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Código instrumentado ESTÁ no servidor!"
else
    echo ""
    echo "❌ Código instrumentado NÃO está no servidor ainda"
    echo "   Aguarde o GitHub Actions completar o deploy"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Testando permissão de escrita no diretório de logs..."
echo ""

docker exec dv-api touch /var/www/html/storage/logs/test-write.log 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Permissão de escrita OK"
    docker exec dv-api rm /var/www/html/storage/logs/test-write.log
else
    echo "❌ SEM permissão de escrita em storage/logs"
    echo "   Execute: docker exec dv-api chmod 777 /var/www/html/storage/logs"
fi
