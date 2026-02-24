# Guia de Performance — Driver de Vendas CRM

---

## Backend

### 1. Indices Compostos de Banco de Dados

Migration: `2026_02_13_000101_add_composite_indexes_for_performance.php`

| Tabela | Indice | Colunas | Objetivo |
|--------|--------|---------|----------|
| `users` | `idx_users_tenant_active` | tenant_id, is_active | Listar usuarios ativos por tenant |
| `users` | `idx_users_tenant_role` | tenant_id, role_id | Filtrar usuarios por role |
| `users` | `idx_users_tenant_email` | tenant_id, email | Buscar usuario por email |
| `clients` | `idx_clients_tenant_type` | tenant_id, type | Filtrar clientes por tipo |
| `clients` | `idx_clients_tenant_status` | tenant_id, status | Filtrar clientes por status |
| `clients` | `idx_clients_tenant_created` | tenant_id, created_at | Ordenar clientes por data |
| `pipeline_cards` | `idx_cards_tenant_pipeline` | tenant_id, pipeline_id | Cards por pipeline |
| `pipeline_cards` | `idx_cards_tenant_stage` | tenant_id, stage_id | Cards por estagio |
| `pipeline_cards` | `idx_cards_tenant_pipeline_stage` | tenant_id, pipeline_id, stage_id | Cards por pipeline e estagio |
| `pipeline_cards` | `idx_cards_tenant_won` | tenant_id, won_at | Cards ganhos |
| `pipeline_cards` | `idx_cards_tenant_created` | tenant_id, created_at | Cards recentes |
| `crm_tasks` | `idx_tasks_tenant_status` | tenant_id, status | Tarefas por status |
| `crm_tasks` | `idx_tasks_tenant_scheduled` | tenant_id, scheduled_at | Tarefas agendadas |
| `crm_tasks` | `idx_tasks_tenant_assigned` | tenant_id, assigned_to | Tarefas por responsavel |
| `products` | `idx_products_tenant_category` | tenant_id, category_id | Produtos por categoria |
| `products` | `idx_products_tenant_active` | tenant_id, is_active | Produtos ativos |
| `products` | `idx_products_tenant_type` | tenant_id, type | Produtos por tipo |
| `whatsapp_sessions` | `idx_whatsapp_tenant_status` | tenant_id, status | Sessoes WhatsApp por status |
| `whatsapp_conversations` | `idx_conversations_session_updated` | session_id, updated_at | Conversas recentes |
| `whatsapp_conversations` | `idx_conversations_session_archived` | session_id, is_archived | Conversas arquivadas |
| `whatsapp_messages` | `idx_messages_conv_timestamp` | conversation_id, timestamp | Mensagens por data |
| `whatsapp_messages` | `idx_messages_conv_direction` | conversation_id, direction | Mensagens por direcao |
| `email_messages` | `idx_email_messages_thread_created` | thread_id, created_at | Emails recentes |
| `email_messages` | `idx_email_messages_thread_read` | thread_id, is_read | Emails nao lidos |
| `paypal_payments` | `idx_paypal_tenant_status` | tenant_id, status | Pagamentos por status |
| `paypal_payments` | `idx_paypal_tenant_paid` | tenant_id, paid_at | Pagamentos por data |
| `subscriptions` | `idx_subscriptions_tenant_status` | tenant_id, status | Assinaturas por status |
| `subscriptions` | `idx_subscriptions_tenant_ends` | tenant_id, ends_at | Assinaturas expirando |

**Total**: 28 indices compostos

### 2. Eager Loading (Prevencao N+1)

#### ClientController

```php
// Antes: 21 queries (1 + 20 N+1)
$clients = Client::where('tenant_id', $tenantId)->paginate(20);

// Depois: 2 queries — reducao de 90%
$clients = Client::with(['pipelineCards' => function ($q) {
    $q->select('id', 'client_id', 'title', 'value', 'pipeline_id')->limit(5);
}])
->where('tenant_id', $tenantId)
->paginate(20);
```

#### UserController

```php
// Antes: 21 queries (1 + 20 N+1)
$users = User::where('tenant_id', $tenantId)->paginate(20);

// Depois: 2 queries — reducao de 90%
$users = User::with('roleRelation')
    ->where('tenant_id', $tenantId)
    ->paginate(20);
```

### 3. Template para Novos Controllers

```php
// Sempre usar with() para relacoes necessarias
$items = Model::with(['relation1', 'relation2'])
    ->where('tenant_id', $tenantId)
    ->paginate(20);
```

### 4. Checklist de Performance (Backend)

- [ ] Usar `with()` para eager loading de relacoes
- [ ] Usar `select()` para limitar colunas
- [ ] Usar `paginate()` em vez de `get()`
- [ ] Usar `limit()` em sub-queries
- [ ] Verificar indices nas colunas de WHERE/ORDER BY
- [ ] Considerar cache para dados estaticos
- [ ] Nunca fazer queries dentro de loops

### 5. Monitoramento

```bash
# Laravel Debugbar (dev)
composer require barryvdh/laravel-debugbar --dev
```

Adicione no `AppServiceProvider` para logar queries lentas:

```php
if (app()->environment('local')) {
    DB::listen(function ($query) {
        if ($query->time > 100) {
            Log::warning('Slow Query:', [
                'sql' => $query->sql,
                'time' => $query->time . 'ms',
            ]);
        }
    });
}
```

---

## Frontend

### 1. Componentes Otimizados

**Sidebar** — `useMemo` para filtrar navegacao por permissoes, `useCallback` para funcao `isActive`.

**MemoizedListItem** (`components/optimized/memoized-list-item.tsx`) — Componente generico para listas com comparacao customizada de props.

**useVirtualizedList** — Hook para paginacao virtual de listas grandes.

### 2. Hooks Utilitarios

```tsx
import { useDebouncedCallback } from '@/hooks/use-optimized-callback'
import { useThrottledCallback } from '@/hooks/use-optimized-callback'
import { useVirtualizedList } from '@/components/optimized/memoized-list-item'
import { MemoizedListItem } from '@/components/optimized/memoized-list-item'
```

| Hook | Uso |
|------|-----|
| `useDebouncedCallback(fn, 300)` | Busca, validacao async |
| `useThrottledCallback(fn, 200)` | Scroll, resize |
| `useVirtualizedList(items, 50)` | Listas com > 100 itens |
| `<MemoizedListItem>` | Itens de lista que nao mudam com frequencia |

### 3. Exemplos de Uso

#### Lista memoizada

```tsx
{clients.map(client => (
  <MemoizedListItem
    key={client.id}
    id={client.id}
    data={client}
    render={(client) => <ClientCard client={client} />}
  />
))}
```

#### Busca com debounce

```tsx
const debouncedSearch = useDebouncedCallback((value: string) => {
  searchClients(value)
}, 300)
```

#### Lista virtualizada

```tsx
const { visibleItems, loadMore, hasMore } = useVirtualizedList(clients, 50)
```

### 4. Checklist de Performance (Frontend)

- [ ] Listas: usar `MemoizedListItem` ou `React.memo`
- [ ] Funcoes: envolver callbacks com `useCallback`
- [ ] Valores computados: usar `useMemo` para calculos caros
- [ ] Busca/Input: usar `useDebouncedCallback`
- [ ] Scroll/Resize: usar `useThrottledCallback`
- [ ] Props: passar apenas o necessario
- [ ] Key: usar IDs unicos e estaveis, nao indices de array

### 5. Componentes Prioritarios para Otimizar

1. Lista de Clientes (`clients/page.tsx`)
2. Lista de Usuarios (`users/page.tsx`)
3. Pipeline/Cards (`pipeline/page.tsx`)
4. Lista de Produtos (`products/page.tsx`)
5. WhatsApp Conversations (`whatsapp/page.tsx`)

---

## Metricas

| Operacao | Antes | Depois |
|----------|-------|--------|
| Lista de clientes (20 itens) | 21 queries, ~150ms | 2 queries, ~50ms |
| Lista de usuarios (20 itens) | 21 queries, ~120ms | 2 queries, ~40ms |
| Sidebar re-renders por navegacao | ~10 | ~2 |

---

*Ultima atualizacao: 12/02/2026*
