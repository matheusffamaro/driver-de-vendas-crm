#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Driver de Vendas CRM - Deploy para VPS (Ubuntu 22.04 / 24.04)
#
# Uso:
#   1. Copie o projeto inteiro para /opt/driver-crm na VPS
#   2. chmod +x deploy-vps.sh
#   3. sudo ./deploy-vps.sh
#
# O script é idempotente: pode ser re-executado com segurança.
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

# ── Cores ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }
step() { echo -e "\n${CYAN}══════════════════════════════════════${NC}"; echo -e "${CYAN}  $1${NC}"; echo -e "${CYAN}══════════════════════════════════════${NC}\n"; }

# ── Validações ───────────────────────────────────────────────
[[ $EUID -ne 0 ]] && err "Execute como root: sudo ./deploy-vps.sh"

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
DOCKER_DIR="${PROJECT_DIR}/docker"
ENV_FILE="${DOCKER_DIR}/.env.prod"

[[ ! -f "${DOCKER_DIR}/docker-compose.prod.yml" ]] && err "docker-compose.prod.yml não encontrado em ${DOCKER_DIR}"

# ── Coletar informações ─────────────────────────────────────
step "Configuração inicial"

if [[ -f "${ENV_FILE}" ]]; then
    warn "Arquivo .env.prod já existe em ${ENV_FILE}"
    read -rp "Deseja sobrescrever? (s/N): " OVERWRITE
    if [[ "${OVERWRITE,,}" != "s" ]]; then
        log "Mantendo .env.prod existente"
        source "${ENV_FILE}"
        SKIP_ENV=true
    fi
fi

if [[ "${SKIP_ENV:-}" != "true" ]]; then
    read -rp "Domínio (ex: crm.driverdevendas.com.br): " DOMAIN
    [[ -z "$DOMAIN" ]] && err "Domínio é obrigatório"

    read -rp "Email para SSL (Let's Encrypt): " SSL_EMAIL
    [[ -z "$SSL_EMAIL" ]] && err "Email é obrigatório"

    DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')
    REDIS_PASSWORD=$(openssl rand -base64 16 | tr -d '/+=')
    JWT_SECRET=$(openssl rand -base64 64)
    APP_KEY="base64:$(openssl rand -base64 32)"

    read -rp "GROQ_API_KEY (Enter para pular): " GROQ_API_KEY_INPUT
    read -rp "GEMINI_API_KEY (Enter para pular): " GEMINI_API_KEY_INPUT
    read -rp "GOOGLE_CLIENT_ID (OAuth, Enter para pular): " GOOGLE_CLIENT_ID_INPUT
    read -rp "GOOGLE_CLIENT_SECRET (Enter para pular): " GOOGLE_CLIENT_SECRET_INPUT

    read -rp "MAIL_HOST (ex: smtp.gmail.com): " MAIL_HOST_INPUT
    read -rp "MAIL_PORT (ex: 587): " MAIL_PORT_INPUT
    read -rp "MAIL_USERNAME: " MAIL_USERNAME_INPUT
    read -rsp "MAIL_PASSWORD: " MAIL_PASSWORD_INPUT
    echo ""
    read -rp "MAIL_FROM_ADDRESS (ex: noreply@seudominio.com): " MAIL_FROM_INPUT

    cat > "${ENV_FILE}" <<ENVEOF
# ═══ Gerado por deploy-vps.sh em $(date -Iseconds) ═══

DOMAIN=${DOMAIN}
SSL_EMAIL=${SSL_EMAIL}

# App
APP_KEY=${APP_KEY}
APP_URL=https://${DOMAIN}
FRONTEND_URL=https://${DOMAIN}

# Database
DB_DATABASE=crm_whitelabel
DB_USERNAME=postgres
DB_PASSWORD=${DB_PASSWORD}

# Redis
REDIS_PASSWORD=${REDIS_PASSWORD}

# JWT
JWT_SECRET=${JWT_SECRET}

# AI
AI_PROVIDER=groq
GROQ_API_KEY=${GROQ_API_KEY_INPUT:-}
GROQ_MODEL=llama-3.3-70b-versatile
GEMINI_API_KEY=${GEMINI_API_KEY_INPUT:-}
GEMINI_MODEL=gemini-2.0-flash

# OAuth
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID_INPUT:-}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET_INPUT:-}
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=

# Email SMTP
MAIL_MAILER=smtp
MAIL_HOST=${MAIL_HOST_INPUT:-smtp.gmail.com}
MAIL_PORT=${MAIL_PORT_INPUT:-587}
MAIL_USERNAME=${MAIL_USERNAME_INPUT:-}
MAIL_PASSWORD=${MAIL_PASSWORD_INPUT:-}
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=${MAIL_FROM_INPUT:-noreply@driverdevendas.com}

# PayPal
PAYPAL_MODE=live
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
ENVEOF

    chmod 600 "${ENV_FILE}"
    log "Arquivo .env.prod criado"
    source "${ENV_FILE}"
fi

# ── 1. Instalar dependências do sistema ──────────────────────
step "1/7 - Instalando dependências do sistema"

apt-get update -qq
apt-get install -y -qq \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    nginx \
    certbot \
    python3-certbot-nginx \
    ufw \
    > /dev/null 2>&1

log "Pacotes do sistema instalados"

# ── 2. Instalar Docker ──────────────────────────────────────
step "2/7 - Instalando Docker"

if command -v docker &> /dev/null; then
    log "Docker já instalado: $(docker --version)"
else
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null
    chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list

    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin > /dev/null 2>&1
    systemctl enable docker
    systemctl start docker
    log "Docker instalado com sucesso"
fi

# ── 3. Build & Start containers ─────────────────────────────
step "3/7 - Build e start dos containers"

cd "${DOCKER_DIR}"

docker compose -f docker-compose.prod.yml --env-file "${ENV_FILE}" up -d --build 2>&1

log "Aguardando PostgreSQL ficar healthy..."
for i in $(seq 1 30); do
    if docker exec dv-postgres pg_isready -U "${DB_USERNAME:-postgres}" > /dev/null 2>&1; then
        log "PostgreSQL pronto"
        break
    fi
    [[ $i -eq 30 ]] && err "PostgreSQL não ficou healthy em 30s"
    sleep 2
done

# ── 4. Migrations e Seeders ─────────────────────────────────
step "4/7 - Rodando migrations e seeders"

docker exec dv-api php artisan migrate --force 2>&1
log "Migrations executadas"

docker exec dv-api php artisan db:seed --force 2>&1 || warn "Seeder já rodou anteriormente (ignorando duplicados)"
log "Seeders executados"

docker exec dv-api php artisan config:cache 2>&1
docker exec dv-api php artisan route:cache 2>&1
docker exec dv-api php artisan view:cache 2>&1
log "Caches de produção gerados"

# ── 5. Configurar Nginx ─────────────────────────────────────
step "5/7 - Configurando Nginx"

NGINX_CONF="/etc/nginx/sites-available/driver-crm"
NGINX_TPL="${DOCKER_DIR}/nginx-vps.conf.template"

if [[ ! -f "${NGINX_TPL}" ]]; then
    err "Template Nginx não encontrado: ${NGINX_TPL}"
fi

ln -sf "${NGINX_CONF}" /etc/nginx/sites-enabled/driver-crm
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

# HTTP-only config first (SSL files don't exist yet)
cat > "${NGINX_CONF}" <<TMPNGINX
server {
    listen 80;
    server_name ${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
TMPNGINX

mkdir -p /var/www/certbot
nginx -t 2>&1
systemctl restart nginx
log "Nginx configurado (HTTP temporário)"

# ── 6. SSL com Let's Encrypt ────────────────────────────────
step "6/7 - Obtendo certificado SSL"

if [[ -d "/etc/letsencrypt/live/${DOMAIN}" ]]; then
    log "Certificado SSL já existe para ${DOMAIN}"
    certbot renew --dry-run 2>&1 || warn "Teste de renovação falhou"
else
    certbot --nginx \
        -d "${DOMAIN}" \
        --email "${SSL_EMAIL}" \
        --agree-tos \
        --no-eff-email \
        --redirect \
        2>&1
    log "Certificado SSL obtido com sucesso"
fi

# Restaurar config completa com SSL
sed "s/__DOMAIN__/${DOMAIN}/g" "${NGINX_TPL}" > "${NGINX_CONF}"
nginx -t 2>&1 && systemctl reload nginx
log "Nginx recarregado com configuração SSL completa"

# ── 7. Firewall ─────────────────────────────────────────────
step "7/7 - Configurando Firewall"

ufw --force reset > /dev/null 2>&1
ufw default deny incoming > /dev/null 2>&1
ufw default allow outgoing > /dev/null 2>&1
ufw allow 22/tcp > /dev/null 2>&1
ufw allow 80/tcp > /dev/null 2>&1
ufw allow 443/tcp > /dev/null 2>&1
ufw --force enable > /dev/null 2>&1
log "UFW ativado (portas 22, 80, 443)"

# ── Resumo final ────────────────────────────────────────────
step "Deploy concluído com sucesso!"

echo -e "${GREEN}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Driver de Vendas CRM - Deploy Completo          ║${NC}"
echo -e "${GREEN}╠═══════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  URL:       https://${DOMAIN}"
echo -e "${GREEN}║${NC}  API:       https://${DOMAIN}/api"
echo -e "${GREEN}║${NC}  WhatsApp:  https://${DOMAIN}/whatsapp/"
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  DB Pass:   (salvo em ${ENV_FILE})"
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Containers:"
docker ps --format "  {{.Names}}\t{{.Status}}" 2>/dev/null | while read -r line; do
    echo -e "${GREEN}║${NC}    ${line}"
done
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Comandos úteis:"
echo -e "${GREEN}║${NC}    Logs API:      docker logs -f dv-api"
echo -e "${GREEN}║${NC}    Logs Frontend: docker logs -f dv-frontend"
echo -e "${GREEN}║${NC}    Migrate:       docker exec dv-api php artisan migrate --force"
echo -e "${GREEN}║${NC}    Rebuild:       cd ${DOCKER_DIR} && docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build"
echo -e "${GREEN}║${NC}    Backup DB:     docker exec dv-postgres pg_dump -U postgres crm_whitelabel > backup.sql"
echo -e "${GREEN}╚═══════════════════════════════════════════════════╝${NC}"
