# 📧 Configuração de OAuth2 para Email (Gmail e Outlook)

Para usar a integração de email com Gmail e Outlook, você precisa configurar as credenciais OAuth2 das respectivas plataformas.

## 🔐 Pré-requisitos

- Conta Google (para Gmail)
- Conta Microsoft (para Outlook)
- Acesso aos consoles de desenvolvedor

---

## 🚀 1. Configurar OAuth2 do Gmail (Google Cloud Console)

### Passo 1: Criar Projeto no Google Cloud Console

1. Acesse: https://console.cloud.google.com/
2. Clique em **"Create Project"** (ou selecione um projeto existente)
3. Dê um nome ao projeto (ex: "CRM Email Integration")
4. Clique em **"Create"**

### Passo 2: Habilitar Gmail API

1. No menu lateral, vá em **"APIs & Services"** → **"Library"**
2. Busque por **"Gmail API"**
3. Clique em **"Enable"**

### Passo 3: Configurar OAuth Consent Screen

1. No menu lateral, vá em **"APIs & Services"** → **"OAuth consent screen"**
2. Selecione **"External"** (ou Internal se for workspace)
3. Preencha:
   - **App name**: CRM Email Integration
   - **User support email**: seu email
   - **Developer contact**: seu email
4. Clique em **"Save and Continue"**
5. Em **Scopes**, adicione:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.compose`
   - `https://www.googleapis.com/auth/gmail.modify`
6. Continue até finalizar

### Passo 4: Criar Credenciais OAuth 2.0

1. No menu lateral, vá em **"APIs & Services"** → **"Credentials"**
2. Clique em **"Create Credentials"** → **"OAuth client ID"**
3. Selecione **"Web application"**
4. Configure:
   - **Name**: CRM Backend
   - **Authorized redirect URIs**: 
     ```
     http://localhost:8000/api/email/accounts/oauth/gmail/callback
     ```
     (ou use seu domínio de produção: `https://seu-dominio.com/api/email/accounts/oauth/gmail/callback`)
5. Clique em **"Create"**
6. **Copie** o `Client ID` e `Client Secret`

### Passo 5: Adicionar ao .env

Abra o arquivo `/backend/.env` e adicione:

```bash
GOOGLE_CLIENT_ID=seu-client-id-aqui.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=seu-client-secret-aqui
GOOGLE_REDIRECT_URI=http://localhost:8000/api/email/accounts/oauth/gmail/callback
```

---

## 📨 2. Configurar OAuth2 do Outlook (Microsoft Azure Portal)

### Passo 1: Registrar Aplicação no Azure

1. Acesse: https://portal.azure.com/
2. No menu, procure por **"Microsoft Entra ID"** (antigo Azure AD)
3. No menu lateral, vá em **"App registrations"**
4. Clique em **"New registration"**
5. Configure:
   - **Name**: CRM Email Integration
   - **Supported account types**: Accounts in any organizational directory and personal Microsoft accounts
   - **Redirect URI**: Web → `http://localhost:8000/api/email/accounts/oauth/outlook/callback`
6. Clique em **"Register"**

### Passo 2: Copiar Application (client) ID

1. Na página Overview do app, copie o **"Application (client) ID"**

### Passo 3: Criar Client Secret

1. No menu lateral, vá em **"Certificates & secrets"**
2. Clique em **"New client secret"**
3. Adicione uma descrição (ex: "CRM Backend") e escolha a validade
4. Clique em **"Add"**
5. **IMPORTANTE**: Copie o **VALUE** do secret imediatamente (não é possível ver depois!)

### Passo 4: Configurar Permissões API

1. No menu lateral, vá em **"API permissions"**
2. Clique em **"Add a permission"**
3. Selecione **"Microsoft Graph"**
4. Selecione **"Delegated permissions"**
5. Adicione as seguintes permissões:
   - `Mail.Read`
   - `Mail.ReadWrite`
   - `Mail.Send`
   - `User.Read`
   - `offline_access`
6. Clique em **"Add permissions"**
7. Clique em **"Grant admin consent"** (se for admin)

### Passo 5: Adicionar ao .env

Abra o arquivo `/backend/.env` e adicione:

```bash
MICROSOFT_CLIENT_ID=seu-application-id-aqui
MICROSOFT_CLIENT_SECRET=seu-client-secret-aqui
MICROSOFT_REDIRECT_URI=http://localhost:8000/api/email/accounts/oauth/outlook/callback
```

---

## 🔄 3. Reiniciar Backend

Após adicionar as credenciais no `.env`:

```bash
cd driver-de-vendas-crm/docker
docker restart dv-api
```

Ou pelo Docker Desktop, reinicie o container `dv-api`.

---

## ✅ 4. Testar Conexão

1. Acesse: http://localhost:3100/settings
2. Vá na aba **"Email"**
3. Clique em **"Gmail"** ou **"Outlook"**
4. Autorize o acesso quando solicitado
5. Aguarde o redirect de volta para o CRM

---

## 🧪 5. IMAP/SMTP (Opcional)

Para testar IMAP/SMTP sem OAuth2, você pode usar serviços como:

- **Gmail com App Password**: Gere uma senha de app em https://myaccount.google.com/apppasswords
- **Mailtrap**: Serviço de teste de email (https://mailtrap.io/)
- **Seu próprio servidor IMAP/SMTP**

---

## ⚠️ Problemas Comuns

### Erro: "redirect_uri_mismatch"
- Verifique se a URI no console (Google/Azure) é **exatamente igual** à do `.env`
- Use `http://` para localhost e `https://` para produção
- Não use `/` no final da URI

### Erro: "Invalid credentials"
- Verifique se copiou o Client ID e Secret corretamente
- Verifique se não há espaços extras no `.env`
- Reinicie o backend após alterar o `.env`

### Erro: "Access denied"
- Verifique se as permissões de API estão corretas
- Para Google: Verifique os scopes no OAuth Consent Screen
- Para Microsoft: Verifique se deu "Grant admin consent"

---

## 📝 Configuração do .env Completo

```bash
# Email OAuth2 Configuration
# Gmail OAuth2
GOOGLE_CLIENT_ID=123456789-abcdefghijk.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnop
GOOGLE_REDIRECT_URI=http://localhost:8000/api/email/accounts/oauth/gmail/callback

# Microsoft OAuth2
MICROSOFT_CLIENT_ID=12345678-1234-1234-1234-123456789012
MICROSOFT_CLIENT_SECRET=abc~defGHI123456789
MICROSOFT_REDIRECT_URI=http://localhost:8000/api/email/accounts/oauth/outlook/callback
```

---

## 🎉 Pronto!

Após configurar tudo, você poderá:
- ✅ Conectar contas Gmail via OAuth2
- ✅ Conectar contas Outlook via OAuth2
- ✅ Conectar qualquer email via IMAP/SMTP
- ✅ Sincronizar emails automaticamente
- ✅ Enviar e receber emails pelo CRM

**Observação**: Por enquanto, os botões de Gmail e Outlook mostrarão uma mensagem informando que as credenciais OAuth não estão configuradas até que você adicione as variáveis no `.env`.
