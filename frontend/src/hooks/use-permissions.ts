'use client'

import { usePermissionStore } from '@/stores/permission-store'
import { useAuthStore } from '@/stores/auth-store'

export function usePermissions() {
  const { role, permissions, isAdmin, isManager, hasPermission, hasAnyPermission } = usePermissionStore()
  const { user } = useAuthStore()
  
  return {
    role: role?.slug || 'viewer',
    permissions,
    isAdmin,
    isManager,
    isOwner: user?.is_super_admin || false,
    canAccessPage: (permission: string) => hasPermission(permission),
    canEdit: (resource: string) => hasPermission(`${resource}.edit`) || isAdmin,
    canDelete: (resource: string) => hasPermission(`${resource}.delete`) || isAdmin,
    canCreate: (resource: string) => hasPermission(`${resource}.create`) || isAdmin,
    canView: (resource: string) => hasPermission(`${resource}.view`) || isAdmin,
    canManageUsers: hasPermission('users.edit') || hasPermission('users.roles') || isAdmin,
    canViewReports: hasPermission('reports.view') || isAdmin,
    hasPermission,
    hasAnyPermission,
    getAllowedPages: () => {
      const pages = []
      if (hasPermission('dashboard.view') || isAdmin) pages.push('dashboard')
      if (hasPermission('clients.view') || isAdmin) pages.push('clients')
      if (hasPermission('pipeline.view') || isAdmin) pages.push('pipeline')
      if (hasPermission('tasks.view') || isAdmin) pages.push('tasks')
      if (hasPermission('whatsapp.view') || isAdmin) pages.push('whatsapp')
      if (hasPermission('products.view') || isAdmin) pages.push('products')
      if (hasPermission('users.view') || isAdmin) pages.push('users')
      if (hasPermission('reports.view') || isAdmin) pages.push('reports')
      if (hasPermission('settings.view') || isAdmin) pages.push('settings')
      return pages
    },
  }
}
