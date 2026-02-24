'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { usePermissionStore } from '@/stores/permission-store'
import { useTenantStore } from '@/stores/tenant-store'
import { authApi } from '@/lib/api'
import { api } from '@/lib/api'

interface PermissionProviderProps {
  children: React.ReactNode
}

export function PermissionProvider({ children }: PermissionProviderProps) {
  const { isAuthenticated } = useAuthStore()
  const { setPermissions } = usePermissionStore()
  const { setAddons } = useTenantStore()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadPermissionsAndAddons = async () => {
      // Only load if authenticated
      if (!isAuthenticated) {
        setIsLoading(false)
        return
      }

      try {
        // Load permissions
        const authResponse = await authApi.me()
        const authData = authResponse.data.data

        setPermissions({
          role: authData.role,
          permissions: authData.permissions || [],
          is_admin: authData.is_admin || false,
          is_manager: authData.is_manager || false,
        })

        // Load tenant addons status
        const tenantResponse = await api.get('/tenant/current')
        const tenantData = tenantResponse.data.data

        setAddons({
          email_addon_enabled: tenantData.email_addon_enabled || false,
          pipelines_addon_enabled: tenantData.pipelines_addon_enabled || false,
          ai_addon_enabled: tenantData.ai_addon_enabled || false,
          email_campaigns_addon_enabled: tenantData.email_campaigns_addon_enabled || false,
        })
      } catch (error) {
        console.error('Error loading permissions and addons:', error)
        // Don't block UI if loading fails
      } finally {
        setIsLoading(false)
      }
    }

    loadPermissionsAndAddons()
  }, [isAuthenticated])

  // Don't block rendering while loading
  // Just load in background
  return <>{children}</>
}
