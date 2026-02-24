#!/bin/sh
set -e

# Create necessary directories
mkdir -p bootstrap/cache
mkdir -p storage/framework/cache
mkdir -p storage/framework/sessions
mkdir -p storage/framework/views
mkdir -p storage/logs

# Set permissions
chmod -R 777 storage bootstrap/cache

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cat > .env << EOF
APP_NAME="CRM Whitelabel"
APP_ENV=${APP_ENV:-local}
APP_KEY=${APP_KEY:-}
APP_DEBUG=${APP_DEBUG:-true}
APP_URL=http://localhost:8000

LOG_CHANNEL=stack
LOG_LEVEL=debug

DB_CONNECTION=pgsql
DB_HOST=${DB_HOST:-postgres}
DB_PORT=${DB_PORT:-5432}
DB_DATABASE=${DB_DATABASE:-crm_whitelabel}
DB_USERNAME=${DB_USERNAME:-postgres}
DB_PASSWORD=${DB_PASSWORD:-postgres}

CACHE_DRIVER=file
QUEUE_CONNECTION=sync
SESSION_DRIVER=file

JWT_SECRET=${JWT_SECRET:-your-jwt-secret-key-here}
JWT_TTL=1440
JWT_REFRESH_TTL=20160
JWT_ALGO=HS256

WHATSAPP_SERVICE_URL=${WHATSAPP_SERVICE_URL:-http://whatsapp:3001}
WHATSAPP_WEBHOOK_URL=${WHATSAPP_WEBHOOK_URL:-http://api:8000/api/whatsapp/webhook}

# OpenAI Configuration
OPENAI_API_KEY=${OPENAI_API_KEY:-}
OPENAI_MODEL=${OPENAI_MODEL:-gpt-4o-mini}
EOF
fi

# Install composer dependencies if vendor doesn't exist
if [ ! -d "vendor" ] || [ ! -f "vendor/autoload.php" ]; then
    echo "Installing Composer dependencies..."
    composer install --no-dev --optimize-autoloader --no-interaction
fi

# Generate app key if not set
if ! grep -q "^APP_KEY=base64:" .env 2>/dev/null; then
    php artisan key:generate --force
fi

# Dentro do Docker: forçar .env a usar postgres:5432 (Laravel lê o arquivo, não só o ambiente)
# Assim a API conecta no serviço postgres da rede. Migrate na máquina: use docker compose exec api php artisan migrate
if [ -f ".env" ]; then
  sed -i.bak 's/^DB_HOST=.*/DB_HOST=postgres/' .env 2>/dev/null || true
  sed -i.bak 's/^DB_PORT=.*/DB_PORT=5432/' .env 2>/dev/null || true
  rm -f .env.bak 2>/dev/null || true
fi

# Clear caches (evita config em cache com DB antigo)
php artisan config:clear 2>/dev/null || true
php artisan cache:clear 2>/dev/null || true

# Start the server
exec php artisan serve --host=0.0.0.0 --port=8000
