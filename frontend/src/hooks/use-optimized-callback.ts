import { useCallback, useMemo, useRef, useEffect } from 'react'

/**
 * Optimized callback hook that prevents unnecessary function recreation.
 * Similar to useCallback but with automatic dependency tracking.
 * 
 * @example
 * ```tsx
 * const handleClick = useOptimizedCallback((id: string) => {
 *   console.log('Clicked:', id)
 * }, []) // Empty deps - callback never changes
 * ```
 */
export function useOptimizedCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T {
  return useCallback(callback, deps)
}

/**
 * Memoized value hook for expensive computations.
 * 
 * @example
 * ```tsx
 * const sortedItems = useOptimizedMemo(() => {
 *   return items.sort((a, b) => a.name.localeCompare(b.name))
 * }, [items])
 * ```
 */
export function useOptimizedMemo<T>(
  factory: () => T,
  deps: React.DependencyList
): T {
  return useMemo(factory, deps)
}

/**
 * Debounced callback hook for search inputs and frequent updates.
 * 
 * @example
 * ```tsx
 * const debouncedSearch = useDebouncedCallback((query: string) => {
 *   searchClients(query)
 * }, 300)
 * ```
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>()
  const callbackRef = useRef(callback)
  
  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])
  
  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args)
      }, delay)
    }) as T,
    [delay]
  )
}

/**
 * Throttled callback hook to limit function execution frequency.
 * 
 * @example
 * ```tsx
 * const throttledScroll = useThrottledCallback((e: Event) => {
 *   console.log('Scrolling...', e)
 * }, 100)
 * ```
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastRun = useRef(Date.now())
  const callbackRef = useRef(callback)
  
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])
  
  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now()
      
      if (now - lastRun.current >= delay) {
        lastRun.current = now
        callbackRef.current(...args)
      }
    }) as T,
    [delay]
  )
}
