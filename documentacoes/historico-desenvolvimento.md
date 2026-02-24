# Historico de Desenvolvimento — Driver de Vendas CRM

Registro cronologico de sprints, fases e decisoes tecnicas.

---

## Sprint 1 — Fundacao WhatsApp (05/02/2026)

**Status:** Revertida

A Sprint 1 implementou funcionalidades de WhatsApp multi-numero e siglas de vendedores, mas foi completamente revertida por decisao do projeto.

### Arquivos removidos (23 total)

| Categoria | Qtd | Detalhes |
|-----------|-----|----------|
| Migrations | 2 | `create_whatsapp_numbers_table`, `add_signature_to_users_table` |
| Models | 1 | `WhatsappNumber` |
| Middleware | 1 | `CheckWhatsappPermission` |
| Paginas Frontend | 1 | `whatsapp/numbers/page.tsx` |
| Componentes Frontend | 3 | `SignatureEditor`, `SignatureBadge`, `SellerFilter` |
| Documentacao | 13 | Diversos MDs de sprint e setup |
| Scripts | 1 | `create-test-user.php` |
| Banco de Dados | 1 | `database.sqlite` |

### Reversoes em arquivos existentes

- `User.php` — Removidos campo `signature` e metodos `whatsappNumbers()`, `activeWhatsappNumber()`
- `bootstrap/app.php` — Removido middleware `whatsapp.permission`

---

## Fase 3 — Seguranca e Performance (12/02/2026)

**Status:** Concluida

5 correcoes implementadas com sucesso em 17 arquivos.

### 1. JWT Secret (Critico)

- Secret fraco (`crm-whitelabel-jwt-secret-key-12345`) substituido por 512 bits gerado com OpenSSL
- Removidos backups de `.env` expostos
- Todos os tokens JWT existentes foram invalidados

### 2. Mass Assignment Protection

- Campos sensíveis removidos do `$fillable` (User: `is_super_admin`, `tenant_id`, `is_active`; Tenant: `is_active`)
- Adicionado `$guarded` para protecao explicita
- Criadas Request classes com validacao (`UpdateUserRequest`, `CreateUserRequest`)

### 3. Legacy Role Cleanup

- Migration para migrar dados de `role` (texto) para `role_id` (FK)
- Remocao automatica da coluna legada `role`
- Mapeamento: admin→admin, manager→manager, user→user, sales→sales, support→support

### 4. Frontend Optimizations

- Sidebar otimizado com `useMemo` e `useCallback`
- Componente `MemoizedListItem` generico criado
- Hooks `useDebouncedCallback` e `useThrottledCallback`
- Ver detalhes em [guia-performance.md](./guia-performance.md)

### 5. Backend Performance

- 28 indices compostos adicionados
- Eager loading em `ClientController` e `UserController` (90% reducao em queries)
- Ver detalhes em [guia-performance.md](./guia-performance.md)

### Metricas da Fase 3

| Metrica | Antes | Depois |
|---------|-------|--------|
| JWT Secret | 37 chars, fraco | 88 chars, 512 bits |
| Mass Assignment | 7 campos expostos | 0 |
| Client queries (20 itens) | 21 queries, ~150ms | 2 queries, ~50ms |
| User queries (20 itens) | 21 queries, ~120ms | 2 queries, ~40ms |

---

*Ultima atualizacao: 12/02/2026*
