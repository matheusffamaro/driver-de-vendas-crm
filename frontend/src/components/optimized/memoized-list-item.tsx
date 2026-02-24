import { memo, useState, useMemo, useCallback } from 'react'

/**
 * Generic memoized list item component for performance optimization.
 * 
 * Use this to wrap list items to prevent unnecessary re-renders when
 * the list data changes but individual items remain the same.
 * 
 * @example
 * ```tsx
 * <MemoizedListItem
 *   id={client.id}
 *   render={() => (
 *     <div>
 *       <h3>{client.name}</h3>
 *       <p>{client.email}</p>
 *     </div>
 *   )}
 * />
 * ```
 */

interface MemoizedListItemProps<T = any> {
  id: string | number
  data?: T
  render: (data?: T) => React.ReactNode
  onClick?: (data?: T) => void
}

function ListItemComponent<T = any>({ id, data, render, onClick }: MemoizedListItemProps<T>) {
  return (
    <div 
      onClick={onClick ? () => onClick(data) : undefined}
      data-item-id={id}
    >
      {render(data)}
    </div>
  )
}

/**
 * Memoized list item that only re-renders when its specific data changes.
 * Compares by id and data reference.
 */
export const MemoizedListItem = memo(
  ListItemComponent,
  (prevProps, nextProps) => {
    // Custom comparison function
    // Only re-render if id or data reference changes
    return prevProps.id === nextProps.id && prevProps.data === nextProps.data
  }
) as typeof ListItemComponent

/**
 * Hook for optimized list rendering with pagination.
 * 
 * @example
 * ```tsx
 * const { visibleItems, loadMore, hasMore } = useVirtualizedList(items, 50)
 * ```
 */
export function useVirtualizedList<T>(
  items: T[],
  pageSize: number = 50
) {
  const [page, setPage] = useState(1)
  
  const visibleItems = useMemo(
    () => items.slice(0, page * pageSize),
    [items, page, pageSize]
  )
  
  const hasMore = visibleItems.length < items.length
  
  const loadMore = useCallback(() => {
    if (hasMore) {
      setPage(p => p + 1)
    }
  }, [hasMore])
  
  const reset = useCallback(() => {
    setPage(1)
  }, [])
  
  return { visibleItems, loadMore, hasMore, reset }
}

// Re-export memo for convenience
export { memo }
