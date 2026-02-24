# Lista de Módulos e Funções — Driver de Vendas CRM

Documento de referência com todos os módulos, funções e componentes do sistema (frontend, backend e serviços).

---

## 1. Módulos do produto (visão usuário)

### 1.1 Dashboard
- **Página:** `/dashboard`
- **Função:** Visão geral (KPIs, resumo de atividades, acesso rápido).

### 1.2 Contatos (Clientes)
- **Página:** `/clients`
- **Funções:** Listar, criar, editar, excluir contatos; campos customizados; busca; exportar/importar CSV; enviar proposta.

### 1.3 Produtos e serviços
- **Página:** `/products`
- **Funções:** CRUD de produtos; categorias; unidades; exportar/importar CSV.

### 1.4 Funil de vendas (Pipeline)
- **Páginas:** `/crm/pipeline`, `/crm/pipeline/settings`, `/crm/pipeline/report`
- **Funções:** Múltiplos pipelines; estágios (etapas); cards/leads; mover entre etapas; campos customizados; produtos no card; comentários/timeline; anexos; arquivamento; e-mails vinculados ao card; autofill com IA; relatório por pipeline (e por vendedor para admin).

### 1.5 Tarefas (CRM)
- **Página:** `/crm/tasks`
- **Funções:** CRUD de tarefas; vincular a card ou contato; concluir tarefa; anexos.

### 1.6 WhatsApp
- **Página:** `/crm/whatsapp`
- **Funções:** Sessões (conectar/desconectar/QR); conversas; enviar/receber mensagens; vincular conversa a contato; atribuir conversa a usuário; fixar/arquivar; filas de atribuição; respostas rápidas; corrigir nomes de contatos; definir dono da sessão (global vs vendedor); sincronizar e merge de duplicatas.

### 1.7 E-mail
- **Páginas:** `/email/inbox`, `/email/templates`, `/email/templates/new`, `/email/templates/[id]/edit`, `/email/campaigns`, `/email/campaigns/new`, `/email/campaigns/[id]`
- **Funções:**
  - **Inbox:** Contas (OAuth Gmail/Outlook, IMAP); sincronizar; listar e-mails; ler, arquivar, estrelar, excluir; vincular a contato; enviar, responder, encaminhar.
  - **Modelos:** CRUD de modelos de e-mail para campanhas.
  - **Campanhas:** CRUD de campanhas; envio em massa; destinatários; rastreamento (abertura/clique).

### 1.8 IA — Chat de atendimento
- **Página:** `/crm/ai-agent` (add-on IA)
- **Funções:** Configurar instruções do agente; base de conhecimento (documentos); testar chat; logs; modelo (Gemini/Groq).

### 1.9 IA — Aprendizado
- **Página:** `/crm/ai-learning` (add-on IA)
- **Funções:** Feedback sobre respostas; memórias (fatos aprendidos); FAQ gerado; padrões aprendidos; estatísticas.

### 1.10 Planos de IA (tenant)
- **Página:** `/crm/ai-plans`
- **Funções:** Ver planos de IA; uso atual; comparar planos; trocar plano; limites de tokens.

### 1.11 Usuários e papéis
- **Páginas:** `/users`, `/users/roles`
- **Funções:** CRUD de usuários; convites; suspender/ativar; atribuir papel; CRUD de papéis e permissões.

### 1.12 Relatórios
- **Página:** `/reports`
- **Funções:** Relatório por pipeline (leads, conversão, valor); gráficos por etapa e resultado; tarefas; desempenho por vendedor (admin/gerente); filtro por vendedor.

### 1.13 Configurações
- **Páginas:** `/settings`, `/settings?tab=...`, `/settings/appearance`
- **Abas:** Geral, Aparência, Planos e add-ons (CRM, IA, E-mail, Pipelines, Campanhas de e-mail), Notificações, etc.
- **Funções:** Dados do tenant; logo; plano e assinatura; ativar/cancelar add-ons; calculadora de uso de IA; tema (claro/escuro/sistema).

### 1.14 Super Admin (proprietário da plataforma)
- **Páginas:** `/super-admin`, `/super-admin/tenants`, `/super-admin/tenants/[id]`, `/super-admin/subscriptions`, `/super-admin/audit-logs`, `/super-admin/ai-usage`
- **Funções:** Dashboard (tenants, receita, gráficos); CRUD e gestão de tenants (suspender, ativar, trocar plano); assinaturas; logs de auditoria; uso de IA por tenant; custo e projeção de IA; gestão de super admins; CRUD de planos de IA e limites customizados.

---

## 2. Backend — Controllers (API)

| Controller | Responsabilidade |
|------------|------------------|
| **AuthController** | Login, registro, refresh, logout, perfil, senha; convites (obter/aceitar); login super admin. |
| **ClientController** | CRUD clientes; busca; export/import CSV; campos customizados. |
| **ProductController** | CRUD produtos e categorias; unidades; export/import CSV. |
| **PipelineController** | CRUD pipelines, estágios, custom fields; CRUD cards; mover/reordenar; comentários; anexos; arquivo; autofill IA; relatório (com filtro por vendedor e breakdown por vendedor). |
| **PipelineCardEmailController** | E-mails vinculados a um card (listar, criar, excluir). |
| **ProposalController** | Envio de proposta. |
| **CrmTaskController** | CRUD tarefas; marcar como concluída. |
| **WhatsappController** | Sessões, conversas, mensagens, QR, vincular contato, atribuir, fixar, arquivar, filas, respostas rápidas, fix-contact-names, sync, webhook. |
| **UserController** | CRUD usuários; papéis e permissões; convites; suspender/ativar; assinatura. |
| **ReportController** | Dashboard, vendas, clientes, produtos (métricas e filtros por usuário para vendedor). |
| **AiChatAgentController** | Configuração do agente; documentos (base de conhecimento); testar chat; logs. |
| **AiPlanController** | Planos de IA; uso atual; comparar; trocar plano; (super admin: CRUD planos, limites custom). |
| **AILearningController** | Feedback; memórias; FAQ; padrões; estatísticas. |
| **TenantController** | Dados do tenant; logo; uso; limites; status da assinatura. |
| **SubscriptionController** | Assinatura atual; upgrade; cancelar; faturas; listar planos (público). |
| **PricingController** | Planos e tiers (público); calcular/recomendar; uso; simular upgrade. |
| **PayPalController** | Criar ordem/assinatura; capturar; cancelar; histórico; webhook. |
| **EmailAccountController** | Contas de e-mail; OAuth (auth + callback); IMAP; atualizar; excluir; sync. |
| **EmailInboxController** | Inbox (listar, ler, marcar lido, arquivar, estrelar, vincular, excluir); threads por contato/card. |
| **EmailMessageController** | Enviar; responder; encaminhar. |
| **EmailTemplateController** | CRUD modelos de e-mail. |
| **EmailCampaignController** | CRUD campanhas; enviar; destinatários. |
| **EmailCampaignTrackingController** | Rastreamento de abertura e clique (rotas públicas). |
| **EmailCampaignsAddonController** | Tiers; ativar/desativar add-on campanhas; atualizar tier. |
| **PipelineAddonController** | Ativar/desativar add-on pipelines; uso e histórico. |
| **SuperAdminController** | Dashboard; tenants (listar, ver, atualizar, suspender, ativar, trocar plano); uso/custo IA; assinaturas; audit logs; super admins; gráficos. |

---

## 3. Backend — Services

| Serviço | Responsabilidade |
|---------|------------------|
| **AIService** | Chamadas à IA (Groq/Gemini); seleção de modelo; limites. |
| **TokenService** | Controle de uso de tokens (tenant/plano); gravar uso; rate limit. |
| **AILearningService** | Lógica de aprendizado (feedback, memórias, padrões, FAQ). |
| **PricingService** | Cálculo de preços; tiers; recomendação. |
| **PayPalService** | Integração PayPal (ordens, assinaturas, webhooks). |
| **OAuthEmailService** | OAuth Gmail/Outlook; refresh de token; cliente Gmail/Graph. |
| **ImapEmailService** | Conexão e leitura IMAP. |
| **CampaignSendService** | Envio de campanhas de e-mail em massa. |
| **WhatsappSessionService** | Gestão de sessões WhatsApp (criar, status, QR, etc.). |
| **WhatsappConversationService** | Conversas e mensagens. |
| **WhatsappMessageService** | Envio e formatação de mensagens. |
| **WhatsappWebhookService** | Processamento do webhook (mensagens recebidas). |
| **WhatsappAIAgentService** | Integração IA no fluxo WhatsApp (se aplicável). |

---

## 4. Backend — Jobs

| Job | Responsabilidade |
|-----|------------------|
| **SyncEmailAccountJob** | Sincronizar e-mails de uma conta (Gmail/Outlook) com paginação e filtro por data. |
| **SendCampaignJob** | Envio assíncrono de campanha de e-mail. |

---

## 5. Backend — Modelos principais

- **Tenant, User, Role** — Multi-tenant e permissões.
- **Client, ClientCustomField** — Contatos e campos customizados.
- **Product, ProductCategory** — Produtos e categorias.
- **Pipeline, PipelineStage, PipelineCustomField** — Funil.
- **PipelineCard, PipelineCardComment, PipelineCardHistory, PipelineCardProduct, PipelineCardAttachment, PipelineCardEmail** — Cards e relacionados.
- **CrmTask, CrmTaskAttachment** — Tarefas.
- **WhatsappSession, WhatsappConversation, WhatsappMessage, WhatsappQuickReply, WhatsappAssignmentQueue** — WhatsApp.
- **EmailAccount, EmailThread, EmailMessage, EmailTemplate, EmailCampaign, EmailCampaignRecipient, EmailCampaignTrackingLink** — E-mail.
- **AiChatAgent, AiKnowledgeDocument, AiChatLog, AiPlan, AiTenantPlan, AiTokenUsage** — IA.
- **Plan, PlanFeature, Subscription, PaypalPayment, PaypalWebhook, PricingTier** — Planos e pagamentos.
- **UserInvitation, AdminAuditLog** — Convites e auditoria.
- **PipelineAddonUsage, EmailAddonUsage** — Uso de add-ons.

---

## 6. Permissões do sistema

- **Dashboard:** `dashboard.view`, `dashboard.analytics`
- **Clientes:** `clients.view`, `clients.create`, `clients.edit`, `clients.delete`, `clients.export`
- **Pipeline:** `pipeline.view`, `pipeline.create`, `pipeline.edit`, `pipeline.delete`, `pipeline.move`
- **Tarefas:** `tasks.view`, `tasks.create`, `tasks.edit`, `tasks.delete`, `tasks.assign`
- **WhatsApp:** `whatsapp.view`, `whatsapp.send`, `whatsapp.sessions`, `whatsapp.templates`
- **Produtos:** `products.view`, `products.create`, `products.edit`, `products.delete`
- **IA Agente:** `ai_agent.view`, `ai_agent.configure`, `ai_agent.knowledge`
- **IA Aprendizado:** `ai_learning.view`, `ai_learning.feedback`
- **E-mail:** `email.view`, `email.send`
- **Usuários:** `users.view`, `users.create`, `users.edit`, `users.delete`, `users.invite`, `users.roles`
- **Configurações:** `settings.view`, `settings.edit`, `settings.integrations`
- **Relatórios:** `reports.view`, `reports.export`

---

## 7. Papéis pré-definidos

- **Administrador** — Acesso total (`*`).
- **Gerente** — Dashboard, clientes, pipeline, tarefas, WhatsApp, produtos, IA, usuários (view), relatórios.
- **Vendedor** — Dashboard, clientes (sem delete), pipeline, tarefas, WhatsApp, produtos, IA, usuários (view), relatórios.
- **Suporte** — Dashboard, clientes (view/edit), pipeline (view), tarefas, WhatsApp, IA.
- **Visualizador** — Apenas visualização (dashboard, clientes, pipeline, tarefas, WhatsApp, produtos, relatórios).

---

## 8. Add-ons (por plano/tenant)

- **E-mail** — Módulo de e-mail (inbox, envio, vinculação a contatos/cards).
- **Pipelines** — Múltiplos pipelines (além do primeiro).
- **IA** — Chat de atendimento e Aprendizado da IA.
- **Campanhas de e-mail** — Campanhas em massa e modelos; tiers por base de leads.

---

## 9. Serviços externos / integrações

- **WhatsApp** — Serviço Node (whatsapp-service) com sessões, webhook e proxy de mídia; backend consome API do serviço.
- **E-mail** — Gmail (OAuth), Outlook (OAuth), IMAP.
- **IA** — Groq (Llama), Google Gemini (fallback).
- **Pagamento** — PayPal (ordens e assinaturas; webhook).

---

## 10. Rotas públicas (sem JWT)

- `GET /health`
- `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`
- `GET/POST /auth/invitation/{token}` (aceitar convite)
- `POST /super-admin/auth/login`
- `GET /pricing/plans`, `GET /pricing/tiers`, `POST /pricing/calculate`, `POST /pricing/recommend`
- `GET /plans`
- `GET /email/accounts/oauth/{provider}/callback`
- `GET /email/track/{token}/open`, `GET /email/track/{token}/click/{linkHash}`
- `POST /whatsapp/webhook`, `GET /whatsapp/media/{filename}`
- `POST /paypal/webhook`

---

*Documento gerado com base no código do projeto. Atualizar conforme novas funcionalidades forem adicionadas.*
