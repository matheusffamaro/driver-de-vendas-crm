import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: string
  name: string
  email: string
  avatar_url?: string
  is_super_admin?: boolean // Super Admin do Driver de Vendas
}

export interface Tenant {
  id: string
  name: string
  slug: string
  logo_url?: string
}

export interface Role {
  id: string
  name: string
  slug: string
  permissions?: string[]
}

interface AuthState {
  user: User | null
  tenant: Tenant | null
  role: Role | null
  tenants: Tenant[]
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  
  // Actions
  setAuth: (data: {
    user: User
    tenant: Tenant | null
    role: Role
    tenants: Tenant[]
    tokens: { access_token: string; refresh_token: string }
  }) => void
  setTokens: (tokens: { access_token: string; refresh_token: string }) => void
  switchTenant: (tenant: Tenant, role: Role, tokens: { access_token: string; refresh_token: string }) => void
  logout: () => void
  updateUser: (user: Partial<User>) => void
  updateTenant: (tenant: Partial<Tenant>) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tenant: null,
      role: null,
      tenants: [],
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: ({ user, tenant, role, tenants, tokens }) => {
        set({
          user,
          tenant,
          role,
          tenants,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          isAuthenticated: true,
        })
      },

      setTokens: (tokens) => {
        set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
        })
      },

      switchTenant: (tenant, role, tokens) => {
        set({
          tenant,
          role,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
        })
      },

      logout: () => {
        set({
          user: null,
          tenant: null,
          role: null,
          tenants: [],
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        })
      },

      updateUser: (userData) => {
        const { user } = get()
        if (user) {
          set({ user: { ...user, ...userData } })
        }
      },

      updateTenant: (tenantData) => {
        const { tenant } = get()
        if (tenant) {
          set({ tenant: { ...tenant, ...tenantData } })
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        tenant: state.tenant,
        role: state.role,
        tenants: state.tenants,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

