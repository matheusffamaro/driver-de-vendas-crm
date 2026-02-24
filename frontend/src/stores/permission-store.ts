import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Role {
  id: string
  name: string
  slug: string
}

interface PermissionState {
  role: Role | null
  permissions: string[]
  isAdmin: boolean
  isManager: boolean
  
  // Actions
  setPermissions: (data: { role: Role | null; permissions: string[]; is_admin: boolean; is_manager: boolean }) => void
  clearPermissions: () => void
  
  // Permission checks
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  hasAllPermissions: (permissions: string[]) => boolean
}

export const usePermissionStore = create<PermissionState>()(
  persist(
    (set, get) => ({
      role: null,
      permissions: [],
      isAdmin: false,
      isManager: false,
      
      setPermissions: (data) => set({
        role: data.role,
        permissions: data.permissions,
        isAdmin: data.is_admin,
        isManager: data.is_manager,
      }),
      
      clearPermissions: () => set({
        role: null,
        permissions: [],
        isAdmin: false,
        isManager: false,
      }),
      
      hasPermission: (permission: string) => {
        const { permissions, isAdmin } = get()
        
        // Admin has all permissions
        if (isAdmin) return true
        
        // Check for exact permission
        if (permissions.includes(permission)) return true
        
        // Check for wildcard permission (e.g., 'clients.*')
        const parts = permission.split('.')
        if (parts.length === 2) {
          const wildcard = `${parts[0]}.*`
          if (permissions.includes(wildcard)) return true
        }
        
        return false
      },
      
      hasAnyPermission: (permissionList: string[]) => {
        const { hasPermission } = get()
        return permissionList.some(p => hasPermission(p))
      },
      
      hasAllPermissions: (permissionList: string[]) => {
        const { hasPermission } = get()
        return permissionList.every(p => hasPermission(p))
      },
    }),
    {
      name: 'crm-permissions',
      partialize: (state) => ({
        role: state.role,
        permissions: state.permissions,
        isAdmin: state.isAdmin,
        isManager: state.isManager,
      }),
    }
  )
)

// Hook for easy permission checking in components
export function usePermission(permission: string): boolean {
  return usePermissionStore((state) => state.hasPermission(permission))
}

export function useAnyPermission(permissions: string[]): boolean {
  return usePermissionStore((state) => state.hasAnyPermission(permissions))
}

export function useAllPermissions(permissions: string[]): boolean {
  return usePermissionStore((state) => state.hasAllPermissions(permissions))
}

// Permission constants for reference
export const PERMISSIONS = {
  // Dashboard
  DASHBOARD_VIEW: 'dashboard.view',
  DASHBOARD_ANALYTICS: 'dashboard.analytics',
  
  // Clients/Contacts
  CLIENTS_VIEW: 'clients.view',
  CLIENTS_CREATE: 'clients.create',
  CLIENTS_EDIT: 'clients.edit',
  CLIENTS_DELETE: 'clients.delete',
  CLIENTS_EXPORT: 'clients.export',
  CLIENTS_IMPORT: 'clients.import',
  
  // Pipeline/Funnel
  PIPELINE_VIEW: 'pipeline.view',
  PIPELINE_CREATE: 'pipeline.create',
  PIPELINE_EDIT: 'pipeline.edit',
  PIPELINE_DELETE: 'pipeline.delete',
  PIPELINE_MOVE: 'pipeline.move',
  PIPELINE_SETTINGS: 'pipeline.settings',
  
  // Tasks
  TASKS_VIEW: 'tasks.view',
  TASKS_CREATE: 'tasks.create',
  TASKS_EDIT: 'tasks.edit',
  TASKS_DELETE: 'tasks.delete',
  TASKS_ASSIGN: 'tasks.assign',
  
  // WhatsApp
  WHATSAPP_VIEW: 'whatsapp.view',
  WHATSAPP_SEND: 'whatsapp.send',
  WHATSAPP_SESSIONS: 'whatsapp.sessions',
  WHATSAPP_TEMPLATES: 'whatsapp.templates',
  
  // Products
  PRODUCTS_VIEW: 'products.view',
  PRODUCTS_CREATE: 'products.create',
  PRODUCTS_EDIT: 'products.edit',
  PRODUCTS_DELETE: 'products.delete',
  
  // AI Agent
  AI_AGENT_VIEW: 'ai_agent.view',
  AI_AGENT_CONFIGURE: 'ai_agent.configure',
  AI_AGENT_KNOWLEDGE: 'ai_agent.knowledge',
  
  // Users
  USERS_VIEW: 'users.view',
  USERS_CREATE: 'users.create',
  USERS_EDIT: 'users.edit',
  USERS_DELETE: 'users.delete',
  USERS_INVITE: 'users.invite',
  USERS_ROLES: 'users.roles',
  
  // Settings
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_EDIT: 'settings.edit',
  SETTINGS_INTEGRATIONS: 'settings.integrations',
  
  // Reports
  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',
} as const
