'use client'

import { usePermissionStore } from '@/stores/permission-store'
import { useRouter } from 'next/navigation'
import { useEffect, ReactNode } from 'react'

interface PermissionGuardProps {
  children: ReactNode
  permission?: string
  permissions?: string[]
  requireAll?: boolean
  fallback?: ReactNode
  redirectTo?: string
  onUnauthorized?: () => void
}

/**
 * PermissionGuard Component
 * 
 * Protects components based on user permissions.
 * 
 * @example
 * // Single permission
 * <PermissionGuard permission="clients.edit">
 *   <EditButton />
 * </PermissionGuard>
 * 
 * @example
 * // Multiple permissions (any)
 * <PermissionGuard permissions={['clients.edit', 'clients.delete']}>
 *   <ActionButtons />
 * </PermissionGuard>
 * 
 * @example
 * // Multiple permissions (all required)
 * <PermissionGuard permissions={['users.view', 'users.edit']} requireAll>
 *   <UserForm />
 * </PermissionGuard>
 * 
 * @example
 * // With fallback
 * <PermissionGuard permission="reports.view" fallback={<div>Access Denied</div>}>
 *   <ReportsPage />
 * </PermissionGuard>
 */
export function PermissionGuard({
  children,
  permission,
  permissions,
  requireAll = false,
  fallback = null,
  redirectTo,
  onUnauthorized,
}: PermissionGuardProps) {
  const router = useRouter()
  const { hasPermission, hasAnyPermission, isAdmin } = usePermissionStore()

  // Admin bypasses all permission checks
  if (isAdmin) {
    return <>{children}</>
  }

  // Check permissions
  let hasAccess = false

  if (permission) {
    hasAccess = hasPermission(permission)
  } else if (permissions && permissions.length > 0) {
    if (requireAll) {
      hasAccess = permissions.every(p => hasPermission(p))
    } else {
      hasAccess = hasAnyPermission(permissions)
    }
  } else {
    // No permission specified, allow access
    hasAccess = true
  }

  useEffect(() => {
    if (!hasAccess) {
      if (redirectTo) {
        router.push(redirectTo)
      }
      if (onUnauthorized) {
        onUnauthorized()
      }
    }
  }, [hasAccess, redirectTo, onUnauthorized, router])

  if (!hasAccess) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

/**
 * usePermissionGuard Hook
 * 
 * A hook version of PermissionGuard for conditional logic
 * 
 * @example
 * const { canEdit, canDelete } = usePermissionGuard(['clients.edit', 'clients.delete'])
 * 
 * return (
 *   <>
 *     {canEdit && <EditButton />}
 *     {canDelete && <DeleteButton />}
 *   </>
 * )
 */
export function usePermissionGuard(permissionsToCheck: string | string[]) {
  const { hasPermission, hasAnyPermission, isAdmin } = usePermissionStore()

  if (isAdmin) {
    const allTrue: Record<string, boolean> = {}
    const perms = Array.isArray(permissionsToCheck) ? permissionsToCheck : [permissionsToCheck]
    perms.forEach(p => {
      allTrue[p] = true
    })
    return allTrue
  }

  const permissions = Array.isArray(permissionsToCheck) ? permissionsToCheck : [permissionsToCheck]
  const result: Record<string, boolean> = {}

  permissions.forEach(permission => {
    result[permission] = hasPermission(permission)
  })

  return result
}
