#!/bin/bash

echo "💾 DIAGNÓSTICO DE USO DE DISCO"
echo "=============================="
echo ""

# 1. Uso geral do disco
echo "📊 USO GERAL DO DISCO:"
df -h / | tail -1
echo ""

# 2. Top 10 diretórios maiores
echo "📁 TOP 10 DIRETÓRIOS MAIORES:"
du -h --max-depth=1 / 2>/dev/null | sort -rh | head -10
echo ""

# 3. Verificar uso do Docker
echo "🐳 USO DO DOCKER:"
echo ""
echo "Containers:"
docker ps -a --format "table {{.Names}}\t{{.Size}}\t{{.Status}}"
echo ""
echo "Volumes:"
docker system df -v | head -20
echo ""

# 4. Logs grandes
echo "📝 LOGS GRANDES (>100MB):"
find /var/log -type f -size +100M -exec ls -lh {} \; 2>/dev/null | awk '{print $5, $9}'
echo ""

# 5. Banco de dados
echo "💾 TAMANHO DO BANCO DE DADOS:"
docker exec dv-api du -sh /var/lib/mysql 2>/dev/null || echo "N/A"
echo ""

# 6. Storage do Laravel
echo "📦 STORAGE DO LARAVEL:"
docker exec dv-api du -sh /var/www/html/storage 2>/dev/null
docker exec dv-api du -h /var/www/html/storage/ --max-depth=1 2>/dev/null | sort -rh
echo ""

# 7. Logs do Laravel
echo "📄 LOGS DO LARAVEL:"
docker exec dv-api find /var/www/html/storage/logs -type f -exec ls -lh {} \; 2>/dev/null | awk '{print $5, $9}' | sort -rh
echo ""

# 8. Imagens Docker antigas
echo "🗑️  IMAGENS DOCKER NÃO USADAS:"
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | head -15
echo ""

# 9. Recomendações de limpeza
echo "=============================="
echo "💡 RECOMENDAÇÕES DE LIMPEZA:"
echo ""
echo "1. Limpar logs do Laravel:"
echo "   docker exec dv-api find /var/www/html/storage/logs -name '*.log' -mtime +7 -delete"
echo ""
echo "2. Limpar cache do Docker:"
echo "   docker system prune -a --volumes -f"
echo ""
echo "3. Limpar logs do sistema:"
echo "   journalctl --vacuum-time=7d"
echo ""
echo "4. Limpar pacotes APT:"
echo "   apt-get clean && apt-get autoclean"
