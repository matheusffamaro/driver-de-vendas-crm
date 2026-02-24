'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  LayoutDashboard,
  Building2,
  CreditCard,
  Brain,
  FileText,
  LogOut,
  Shield,
  ChevronLeft,
  Moon,
  Sun,
} from 'lucide-react'
import { useSuperAdminAuthStore } from '@/stores/super-admin-auth-store'
import { superAdminAuthApi } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from '@/components/theme-toggle'

const adminNavigation = [
  { name: 'Dashboard', href: '/super-admin', icon: LayoutDashboard, exact: true },
  { name: 'Empresas', href: '/super-admin/tenants', icon: Building2, exact: false },
  { name: 'Assinaturas', href: '/super-admin/subscriptions', icon: CreditCard, exact: true },
  { name: 'Uso de IA', href: '/super-admin/ai-usage', icon: Brain, exact: true },
  { name: 'Logs de Auditoria', href: '/super-admin/audit-logs', icon: FileText, exact: true },
]

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, logout, isAuthenticated } = useSuperAdminAuthStore()

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/super-admin/login')
      return
    }

    if (user && !user.is_super_admin) {
      router.push('/super-admin/login')
    }
  }, [isAuthenticated, user, router])

  const handleLogout = async () => {
    try {
      await superAdminAuthApi.logout()
    } catch (e) {
      // Ignore errors on logout
    }
    logout()
    toast.success('Até logo!', 'Você foi desconectado')
    router.push('/super-admin/login')
  }

  const isActive = (href: string, exact: boolean = false) => {
    if (exact) {
      return pathname === href
    }
    return pathname === href || pathname.startsWith(href + '/')
  }

  if (!isAuthenticated || !user?.is_super_admin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Acesso Negado
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Faça login como super administrador.
          </p>
          <Link 
            href="/super-admin/login" 
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            Ir para login do Admin
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 z-50 flex flex-col">
        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-gray-100 dark:border-gray-800">
          <Link href="/super-admin" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">
              Admin
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {adminNavigation.map((item) => {
            const active = isActive(item.href, item.exact)
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200
                           ${active 
                             ? 'font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' 
                             : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                {active && (
                  <motion.div
                    layoutId="adminActiveIndicator"
                    className="absolute left-0 w-1 h-6 bg-emerald-500 rounded-r-full"
                  />
                )}
                <item.icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-emerald-500' : ''}`} />
                <span className="text-sm">{item.name}</span>
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-100 dark:border-gray-800">
          {/* Voltar ao CRM */}
          <div className="px-3 py-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm">Voltar ao CRM</span>
            </Link>
          </div>

          {/* Theme Toggle */}
          <div className="px-4 pb-2">
            <ThemeToggle />
          </div>

          {/* User & Logout */}
          <div className="p-4 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <span className="font-medium text-sm">
                  {user?.name?.charAt(0).toUpperCase() || 'A'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 min-h-screen">
        {children}
      </main>
    </div>
  )
}
