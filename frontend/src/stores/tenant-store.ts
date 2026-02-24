import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface TenantAddons {
  email_addon_enabled: boolean
  pipelines_addon_enabled: boolean
  ai_addon_enabled: boolean
  email_campaigns_addon_enabled: boolean
}

interface TenantStoreState extends TenantAddons {
  // Actions
  setAddons: (addons: TenantAddons) => void
  clearAddons: () => void
}

export const useTenantStore = create<TenantStoreState>()(
  persist(
    (set) => ({
      email_addon_enabled: false,
      pipelines_addon_enabled: false,
      ai_addon_enabled: false,
      email_campaigns_addon_enabled: false,
      
      setAddons: (addons) => set({
        email_addon_enabled: addons.email_addon_enabled,
        pipelines_addon_enabled: addons.pipelines_addon_enabled,
        ai_addon_enabled: addons.ai_addon_enabled,
        email_campaigns_addon_enabled: addons.email_campaigns_addon_enabled,
      }),
      
      clearAddons: () => set({
        email_addon_enabled: false,
        pipelines_addon_enabled: false,
        ai_addon_enabled: false,
        email_campaigns_addon_enabled: false,
      }),
    }),
    {
      name: 'tenant-addons',
      partialize: (state) => ({
        email_addon_enabled: state.email_addon_enabled,
        pipelines_addon_enabled: state.pipelines_addon_enabled,
        ai_addon_enabled: state.ai_addon_enabled,
        email_campaigns_addon_enabled: state.email_campaigns_addon_enabled,
      }),
    }
  )
)
