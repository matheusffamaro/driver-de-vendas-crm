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

## 📚 Documentação do Projeto

### 📋 Planejamento e Roadmap

| Documento | Descrição | Quando Usar |
|-----------|-----------|-------------|
| **[INDEX.md](./INDEX.md)** | 🗺️ Índice e guia de navegação entre todos os documentos | Começar aqui se não souber qual documento ler |
| **[ONE-PAGE-SUMMARY.md](./ONE-PAGE-SUMMARY.md)** | 📄 Resumo visual de uma página (imprimível) | Referência rápida, apresentações, decisões |
| **[BACKLOG.md](./BACKLOG.md)** | 📋 Backlog completo com todas as tarefas organizadas | Visão geral do projeto e planejamento |
| **[SPRINT-PLAN.md](./SPRINT-PLAN.md)** | 🏃 Plano detalhado de sprints com checklists | Acompanhamento diário do progresso |
| **[QUICK-REFERENCE.md](./QUICK-REFERENCE.md)** | ⚡ Guia rápido para começar hoje | Desenvolvedores iniciando no projeto |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | 🏗️ Documentação técnica da arquitetura | Entender estrutura e padrões de código |
| **[EXECUTIVE-SUMMARY.md](./EXECUTIVE-SUMMARY.md)** | 📊 Análise executiva com ROI e KPIs | Decisões de negócio e investimento |
| **[PRESENTATION.md](./PRESENTATION.md)** | 🎯 Apresentação em slides (21 slides) | Reuniões com stakeholders |

### 🎯 Como Usar Esta Documentação

#### Se você é desenvolvedor iniciando no projeto:
1. **Comece com**: [ARCHITECTURE.md](./ARCHITECTURE.md) - Entenda a estrutura técnica
2. **Depois veja**: [QUICK-REFERENCE.md](./QUICK-REFERENCE.md) - Configure seu ambiente e veja próximas tarefas
3. **Para trabalhar**: [SPRINT-PLAN.md](./SPRINT-PLAN.md) - Siga os checklists diários

#### Se você é gestor/product owner:
1. **Visão estratégica**: [BACKLOG.md](./BACKLOG.md) - Roadmap completo (4-6 meses)
2. **Acompanhamento**: [SPRINT-PLAN.md](./SPRINT-PLAN.md) - Progresso por sprint
3. **Métricas**: Veja seções de "Métricas de Acompanhamento" no SPRINT-PLAN.md

#### Se você quer contribuir:
1. **Veja o backlog**: [BACKLOG.md](./BACKLOG.md) - Escolha uma tarefa disponível
2. **Entenda a arquitetura**: [ARCHITECTURE.md](./ARCHITECTURE.md) - Siga os padrões
3. **Marque progresso**: [SPRINT-PLAN.md](./SPRINT-PLAN.md) - Atualize checklists

### 📊 Status do Projeto

**Última atualização**: 05/02/2026

```
Progresso Geral: ░░░░░░░░░░░░░░░░░░░░ 0% (0/85 tarefas)

Por Módulo:
├─ WhatsApp          ░░░░░░░░░░ 0% (0/5)   🔴 P0-P1
├─ Produtos/Serviços ░░░░░░░░░░ 0% (0/3)   🔴 P0-P1
├─ Contatos          ░░░░░░░░░░ 0% (0/4)   🔴 P0-P1
├─ Email             ░░░░░░░░░░ 0% (0/2)   🟠 P1
├─ Tarefas           ░░░░░░░░░░ 0% (0/2)   🟠 P1
├─ Pipeline          ░░░░░░░░░░ 0% (0/2)   🟠 P1
├─ Relatórios        ░░░░░░░░░░ 0% (0/1)   🟡 P2
├─ Analytics IA      ░░░░░░░░░░ 0% (0/1)   🟡 P2
├─ Agenda            ░░░░░░░░░░ 0% (0/1)   🟡 P2
├─ Mobile            ░░░░░░░░░░ 0% (0/1)   🟢 P3
└─ Planejamento      ░░░░░░░░░░ 0% (0/3)   🔴 P0
```

**Próxima Sprint**: Sprint 1 - Fundação WhatsApp (2-3 semanas)  
**Início planejado**: --/--/2026  
**Estimativa total**: 4-6 meses (com 1-2 desenvolvedores)

## 🚀 Próximos Passos

### Esta Semana
1. [ ] Implementar sistema multi-número WhatsApp (Tarefa 1.1)
2. [ ] Adicionar sistema de siglas de vendedores (Tarefa 1.2)

### Este Mês (Sprint 1)
- [ ] Completar todas as funcionalidades de WhatsApp
- [ ] Implementar permissões por cargo
- [ ] Reorganizar interface do módulo WhatsApp

Veja detalhes em: [SPRINT-PLAN.md](./SPRINT-PLAN.md)

## 📄 Licença

Proprietário - Todos os direitos reservados.
