'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { useThemeStore } from '@/stores/theme-store'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { PermissionGuard } from '@/components/auth/permission-guard'
import { PermissionProvider } from '@/components/providers/permission-provider'
import { Loader2 } from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated } = useAuthStore()
  const { primaryColor } = useThemeStore()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Check if we're in super-admin area (has its own layout)
  const isSuperAdminArea = pathname?.startsWith('/super-admin')

  useEffect(() => {
    setMounted(true)
    
    // Initialize theme from localStorage or system preference
    const savedTheme = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (mounted && !isAuthenticated && !isSuperAdminArea) {
      router.push('/auth/login')
    }
  }, [mounted, isAuthenticated, isSuperAdminArea, router])

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
            style={{ backgroundColor: primaryColor }}
          >
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Carregando...</p>
        </div>
      </div>
    )
  }

  // Super Admin area uses its own layout
  if (isSuperAdminArea) {
    return <>{children}</>
  }
  
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
            style={{ backgroundColor: primaryColor }}
          >
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <PermissionProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        <Sidebar 
          collapsed={false} 
          onToggle={() => {}}
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />
        
        <div className="lg:ml-64 transition-all duration-300">
          <Header onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />
          
          <main className="p-4 sm:p-6 lg:p-8">
              <PermissionGuard>
                {children}
              </PermissionGuard>
          </main>
        </div>
      </div>
    </PermissionProvider>
  )
}
