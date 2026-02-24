# Frontend Performance Optimization Guide

## ✅ Implementações Realizadas (12/02/2026)

### 1. React.memo e Hooks de Performance

#### Componentes Otimizados

**Sidebar (`components/layout/sidebar.tsx`)**
- ✅ `useMemo` para filtrar navegação por permissões
- ✅ `useCallback` para função `isActive`
- ✅ `useMemo` para verificar página de config ativa
- **Benefício**: Evita recalcular filtros a cada render

#### Componentes Utilitários Criados

**`components/optimized/memoized-list-item.tsx`**
- ✅ `MemoizedListItem` - Componente genérico para listas
- ✅ `useVirtualizedList` - Hook para paginação virtual
- ✅ Comparação customizada de props

**`hooks/use-optimized-callback.ts`**
- ✅ `useOptimizedCallback` - Wrapper para useCallback
- ✅ `useOptimizedMemo` - Wrapper para useMemo
- ✅ `useDebouncedCallback` - Debounce para inputs
- ✅ `useThrottledCallback` - Throttle para scroll/resize

### 2. Como Usar as Otimizações

#### MemoizedListItem (Para Listas)

```tsx
import { MemoizedListItem } from '@/components/optimized/memoized-list-item'

// Em vez de:
{clients.map(client => (
  <ClientCard key={client.id} client={client} />
))}

// Use:
{clients.map(client => (
  <MemoizedListItem
    key={client.id}
    id={client.id}
    data={client}
    render={(client) => <ClientCard client={client} />}
  />
))}
```

#### useVirtualizedList (Para Listas Grandes)

```tsx
import { useVirtualizedList } from '@/components/optimized/memoized-list-item'

function ClientList({ clients }: { clients: Client[] }) {
  const { visibleItems, loadMore, hasMore } = useVirtualizedList(clients, 50)
  
  return (
    <>
      {visibleItems.map(client => (
        <ClientCard key={client.id} client={client} />
      ))}
      {hasMore && <button onClick={loadMore}>Carregar Mais</button>}
    </>
  )
}
```

#### useDebouncedCallback (Para Busca)

```tsx
import { useDebouncedCallback } from '@/hooks/use-optimized-callback'

function SearchInput() {
  const [query, setQuery] = useState('')
  
  const debouncedSearch = useDebouncedCallback((value: string) => {
    // API call aqui
    searchClients(value)
  }, 300) // 300ms de delay
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    debouncedSearch(value)
  }
  
  return <input value={query} onChange={handleChange} />
}
```

#### useThrottledCallback (Para Scroll/Resize)

```tsx
import { useThrottledCallback } from '@/hooks/use-optimized-callback'

function InfiniteScroll() {
  const throttledScroll = useThrottledCallback(() => {
    // Check if need to load more
    if (shouldLoadMore()) {
      loadMore()
    }
  }, 200) // Max 1 call per 200ms
  
  useEffect(() => {
    window.addEventListener('scroll', throttledScroll)
    return () => window.removeEventListener('scroll', throttledScroll)
  }, [throttledScroll])
}
```

### 3. Componentes Prioritários para Otimização

#### Alto Impacto (Implementar primeiro)

1. **Lista de Clientes** (`app/clients/page.tsx`)
   - Use `MemoizedListItem` para cada cliente
   - Use `useVirtualizedList` se lista > 100 itens
   - Use `useDebouncedCallback` na busca

2. **Lista de Usuários** (`app/users/page.tsx`)
   - Use `MemoizedListItem` para cada usuário
   - Use `useDebouncedCallback` na busca

3. **Pipeline/Cards** (`app/crm/pipeline/page.tsx`)
   - Use `React.memo` para cada card
   - Use `useDebouncedCallback` para drag & drop
   - Use `useThrottledCallback` para updates de posição

4. **Lista de Produtos** (`app/products/page.tsx`)
   - Use `MemoizedListItem` para cada produto
   - Use `useVirtualizedList` para catálogos grandes

5. **WhatsApp Conversations** (`app/crm/whatsapp/page.tsx`)
   - Use `React.memo` para cada mensagem
   - Use `useVirtualizedList` para histórico longo
   - Use `useThrottledCallback` para scroll

#### Médio Impacto

6. **Filtros e Selects Complexos**
   - Use `useMemo` para opções de filtro
   - Use `useDebouncedCallback` para autocomplete

7. **Modais e Dialogs**
   - Use `React.memo` para conteúdo do modal
   - Use `useCallback` para handlers

8. **Forms com Validação**
   - Use `useDebouncedCallback` para validação async
   - Use `useMemo` para regras de validação

### 4. Checklist de Otimização

Ao otimizar um componente, verifique:

- [ ] **Listas**: Usar `MemoizedListItem` ou `React.memo`
- [ ] **Funções**: Envolver callbacks com `useCallback`
- [ ] **Valores computados**: Usar `useMemo` para cálculos caros
- [ ] **Busca/Input**: Usar `useDebouncedCallback`
- [ ] **Scroll/Resize**: Usar `useThrottledCallback`
- [ ] **Props**: Passar apenas props necessárias
- [ ] **Key**: Usar IDs únicos e estáveis, não índices de array

### 5. Medição de Performance

#### React DevTools Profiler

1. Instale React DevTools
2. Abra a aba "Profiler"
3. Clique em "Record"
4. Interaja com a aplicação
5. Pare a gravação
6. Analise os componentes que re-renderizam mais

#### Console Performance

```tsx
// Adicione nos componentes para debug
useEffect(() => {
  console.count('ComponentName render')
})
```

#### Lighthouse

1. Abra DevTools
2. Aba "Lighthouse"
3. Selecione "Performance"
4. Clique em "Analyze page load"

### 6. Regras de Ouro

1. **Não otimize prematuramente**: Meça primeiro, otimize depois
2. **Memoize cálculos caros**: Não cálculos simples
3. **Debounce inputs**: Sempre em buscas e validações async
4. **Throttle eventos**: Scroll, resize, mousemove
5. **Virtualize listas longas**: > 100 itens
6. **Code splitting**: Lazy load rotas e componentes pesados

### 7. Próximos Passos

1. **Implementar otimizações em páginas prioritárias**
   - Clientes, Usuários, Pipeline, Produtos

2. **Adicionar React Query cache**
   - Evitar re-fetch desnecessários
   - Implementar cache strategy

3. **Lazy Loading de Componentes**
   ```tsx
   const HeavyComponent = lazy(() => import('./HeavyComponent'))
   ```

4. **Image Optimization**
   - Usar Next.js Image component
   - Lazy load imagens off-screen

5. **Bundle Analysis**
   ```bash
   npm run build && npm run analyze
   ```

### 8. Métricas de Sucesso

Antes da otimização:
- Initial Load: ~2-3s
- Time to Interactive: ~3-4s
- FCP (First Contentful Paint): ~1.5s

Meta após otimização:
- Initial Load: < 1.5s
- Time to Interactive: < 2s
- FCP: < 1s

---

**Última atualização**: 12/02/2026  
**Próxima revisão**: 12/03/2026
