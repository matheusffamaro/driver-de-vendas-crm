# Changelog - 25/02/2026

## Correções e Melhorias no Agente de Chat IA

---

### 1. Instruções do Agente de IA - Correção Crítica

**Problema:** Dos 8 campos de instrução configurados na interface (Definição de Função, Empresa, Tom, Orientações, Prevenção de Erros, Encaminhamento Humano, Links Úteis, Exemplos), apenas 2 eram realmente enviados para a IA (`function_definition` e `tone`). Os outros 6 eram ignorados.

**Como testar:**

- Acesse **Chat de atendimento IA** > **Configuração de Instruções**
- Preencha o campo **"Sobre a Empresa, Produtos e Serviços"** com informações da empresa
- Preencha **"Prevenção de Informações Incorretas"** com uma regra clara (ex: "Nunca invente preços")
- Use o **Testar Chatbot** e pergunte algo sobre a empresa
- A resposta deve refletir as instruções de empresa e respeitar as regras de prevenção

---

### 2. Modo "Personalizado" de Instruções

**Problema:** Quando o tipo de instrução era trocado para "Personalizado", nenhum campo de texto aparecia.

**Como testar:**

- Em **Configuração de Instruções**, troque o Tipo de Instrução para **"Personalizado"**
- Deve aparecer um textarea único grande para escrever instruções livres
- Troque de volta para **"Estruturado"** — os campos accordion devem voltar

---

### 3. Teste de Chatbot sem exigir ativação

**Problema:** O botão "Enviar" no teste ficava desabilitado se o chatbot não estivesse ativo. Impossível testar antes de ativar.

**Como testar:**

- Desative o toggle **"Ativo"** no topo
- Vá até **Testar Chatbot** e envie uma mensagem
- O teste deve funcionar normalmente mesmo com o agente desativado

---

### 4. Extração de texto de PDF e DOC/DOCX

**Problema:** Upload de documentos PDF e DOC/DOCX na Base de Conhecimento era aceito, mas o conteúdo não era extraído (ficava vazio). Só TXT funcionava.

**Como testar:**

- Acesse **Base de Conhecimento**
- Faça upload de um arquivo **.pdf** com texto
- Faça upload de um arquivo **.docx**
- Envie uma pergunta no **Testar Chatbot** sobre o conteúdo do documento
- A IA deve conseguir responder com base no conteúdo extraído

---

### 5. Isolamento de Configuração por Tenant (Conta)

**Problema:** Todas as contas de clientes compartilhavam a mesma configuração de Agente de Chat. O email `alessandro@driverdevendas.com.br` aparecia para todos.

**Como testar:**

- Faça login com a conta do **Alessandro** (tenant A) e configure o agente com instruções específicas
- Faça login com outra conta (tenant B)
- O tenant B deve ver um agente vazio/padrão, sem as configurações do Alessandro
- Configurações feitas no tenant B não devem afetar o tenant A

---

### 6. Instruções completas no WhatsApp (IA respondendo pelo WhatsApp)

**Problema:** Quando a IA respondia automaticamente pelo WhatsApp, também usava apenas 4 dos 8 campos de instrução.

**Como testar:**

- Ative o agente com instruções preenchidas (especialmente **Encaminhamento Humano** e **Tom da Conversa**)
- Envie uma mensagem pelo WhatsApp para o número conectado
- A resposta da IA deve seguir o tom configurado e respeitar as regras de encaminhamento

---

### 7. Fontes locais (fix de build)

**Problema:** O build do frontend falhava no VPS porque não conseguia baixar fontes do Google Fonts (timeout de rede no Docker).

**Como testar:**

- Verifique que o site carrega corretamente com as fontes **Outfit** e **JetBrains Mono**
- As fontes devem aparecer normalmente em toda a interface

---

### 8. Correções no CI/CD Pipeline

**Problema:** O workflow de CI falhava por falta de `bootstrap/cache`, `.env`/`.env.docker`, e `artisan test` inexistente.

**Como testar:**

- Verificar no GitHub Actions que os 3 jobs (**Backend**, **Frontend**, **Validate Docker Compose**) passam com sucesso
