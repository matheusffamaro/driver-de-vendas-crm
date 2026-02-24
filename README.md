# Driver de Vendas CRM

Sistema de CRM completo com integração WhatsApp e agente de IA.

## 🚀 Tecnologias

- **Backend:** Laravel 11 (PHP 8.3)
- **Frontend:** Next.js 14 (React 18)
- **Banco de Dados:** PostgreSQL 15
- **WhatsApp:** Baileys (Node.js)
- **IA:** Groq (Llama 3.3) / Google Gemini

## 📋 Pré-requisitos

- Docker e Docker Compose
- Git

## 🛠️ Instalação

1. **Clone o repositório** (se ainda não fez)

2. **Inicie os containers:**
```bash
cd docker
docker compose up -d --build
```

3. **Execute as migrations:**
```bash
docker exec dv-api php artisan migrate --force
docker exec dv-api php artisan db:seed --force
```

## 🌐 URLs de Acesso

| Serviço | URL | Descrição |
|---------|-----|-----------|
| Frontend | http://localhost:3000 | Interface do usuário |
| API | http://localhost:8000 | Backend REST API |
| WhatsApp | http://localhost:3001 | Serviço WhatsApp |
| Mailpit | http://localhost:8025 | Teste de emails |

## 🔐 Credenciais Padrão

- **Email:** admin@crm.com
- **Senha:** admin123

## 📁 Estrutura do Projeto

```
driver-de-vendas-crm/
├── backend/          # Laravel API
├── frontend/         # Next.js App
├── whatsapp-service/ # Serviço WhatsApp
├── docker/           # Configurações Docker
│   ├── docker-compose.yml
│   ├── Dockerfile.api
│   ├── Dockerfile.frontend
│   └── Dockerfile.whatsapp
└── README.md
```

## 🔧 Comandos Úteis

```bash
# Iniciar sistema
cd docker && docker compose up -d

# Parar sistema
cd docker && docker compose down

# Ver logs
docker compose logs -f api

# Acessar container da API
docker exec -it dv-api bash

# Rodar migrations
docker exec dv-api php artisan migrate

# Limpar cache
docker exec dv-api php artisan cache:clear
docker exec dv-api php artisan config:clear
```

## 📞 Funcionalidades Atuais

- ✅ Gestão de Contatos/Clientes
- ✅ Funil de Vendas (Kanban)
- ✅ Integração WhatsApp
- ✅ Agente de IA para atendimento
- ✅ Gestão de Tarefas
- ✅ Gestão de Produtos
- ✅ Sistema de Planos e Assinaturas
- ✅ Multi-tenancy

## 📄 Licença

Proprietário - Todos os direitos reservados.
