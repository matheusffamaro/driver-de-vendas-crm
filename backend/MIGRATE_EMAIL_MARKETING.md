# Migrations do módulo Campanhas de E-mail

Se aparecer erro **"relation \"email_templates\" does not exist"** (ou tabela não encontrada), rode as migrations no ambiente onde o backend está rodando.

## Erro "could not translate host name postgres"

Se aparecer **"could not translate host name postgres to address"**, o Laravel está tentando conectar no host `postgres` (típico de Docker). Para rodar `php artisan migrate` **na sua máquina**:

1. No arquivo **`.env`** do backend, use o host e a porta do Postgres:
   - Postgres em **Docker** (este projeto: `docker/docker-compose.yml`): na sua máquina use `DB_HOST=127.0.0.1` e `DB_PORT=5433` (o compose mapeia `5433:5432`).
   - Postgres rodando **localmente** na porta padrão: `DB_HOST=127.0.0.1` e `DB_PORT=5432`.
2. Salve o `.env` e rode de novo:

```bash
cd driver-de-vendas-crm/backend
php artisan migrate
```

Se o backend **roda dentro do Docker**, a API usa `postgres:5432` (o script `docker-start.sh` ajusta o `.env` ao subir o container). Para rodar migrations, use **dentro do container**: `docker compose exec api php artisan migrate`.

## Comando

Na raiz do projeto Laravel (backend):

```bash
php artisan migrate
```

Exemplo no servidor (quando o código está em `/var/www/html`):

```bash
cd /var/www/html
php artisan migrate --force
```

O `--force` é necessário em produção para não pedir confirmação.

## Tabelas criadas

- `email_templates` – modelos de e-mail (nome, assunto, body_html, body_json)
- `email_campaigns` – campanhas (status, métricas, etc.)
- `email_campaign_recipients` – destinatários por campanha
- `email_campaign_tracking_links` – links para rastreio de cliques

Depois de rodar as migrations, o "Salvar e fechar" no editor de modelos deve funcionar.
