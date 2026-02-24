import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface SuperAdminUser {
  id: string
  name: string
  email: string
  avatar?: string
  is_super_admin: boolean
}

interface SuperAdminAuthState {
  user: SuperAdminUser | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean

  setAuth: (data: {
    user: SuperAdminUser
    tokens: { access_token: string; refresh_token: string }
  }) => void
  setTokens: (tokens: { access_token: string; refresh_token: string }) => void
  logout: () => void
}

export const useSuperAdminAuthStore = create<SuperAdminAuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: ({ user, tokens }) => {
        set({
          user,
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

      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        })
      },
    }),
    {
      name: 'super-admin-auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

