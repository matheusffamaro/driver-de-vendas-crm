'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  LayoutDashboard,
  Users,
  UserCircle,
  BarChart3,
  Settings,
  LogOut,
  Package,
  X,
  ChevronDown,
  MessageCircle,
  Kanban,
  CheckSquare,
  FileText,
  Bot,
  Brain,
  Sparkles,
  Mail,
  Inbox,
  Send,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { useThemeStore } from '@/stores/theme-store'
import { usePermissionStore } from '@/stores/permission-store'
import { useTenantStore } from '@/stores/tenant-store'
import { authApi } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { toast } from '@/hooks/use-toast'
import { ThemeToggle } from '@/components/theme-toggle'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  mobileOpen?: boolean
  onMobileClose?: () => void
}

interface NavItem {
  name: string
  href: string
  icon: any
  permission?: string
  requiresAddon?: 'email' | 'pipelines' | 'ai' // Addon required for this item
}

const navigation: NavItem[] = [
  // AI modules - require addon purchase (available for Enterprise plans)
  { name: 'Chat de atendimento IA', href: '/crm/ai-agent', icon: Bot, permission: 'ai_agent.view', requiresAddon: 'ai' },
  { name: 'Aprendizado da IA', href: '/crm/ai-learning', icon: Brain, permission: 'ai_learning.view', requiresAddon: 'ai' },
  
  { name: 'WhatsApp', href: '/crm/whatsapp', icon: MessageCircle, permission: 'whatsapp.view' },
  { name: 'Email', href: '/email/inbox', icon: Inbox, permission: 'email.view', requiresAddon: 'email' },
  { name: 'Produtos/Serviços', href: '/products', icon: Package, permission: 'products.view' },
  { name: 'Tarefas', href: '/crm/tasks', icon: CheckSquare, permission: 'tasks.view' },
  { name: 'Funil de vendas', href: '/crm/pipeline', icon: Kanban, permission: 'pipeline.view' },
  { name: 'Contatos', href: '/clients', icon: FileText, permission: 'clients.view' },
]

const campanhasNavigation: NavItem[] = [
  { name: 'Campanhas', href: '/email/campaigns', icon: Send, permission: 'email.view' },
  { name: 'Modelos de e-mail', href: '/email/templates', icon: FileText, permission: 'email.view' },
]

const configNavigation: NavItem[] = [
  { name: 'Geral', href: '/settings', icon: Settings, permission: 'settings.view' },
  { name: 'Planos', href: '/settings?tab=plan', icon: Sparkles, permission: 'settings.view' },
  { name: 'Usuários', href: '/users', icon: UserCircle, permission: 'users.view' },
  { name: 'Relatórios', href: '/reports', icon: BarChart3, permission: 'reports.view' },
]

export function Sidebar({ collapsed, onToggle, mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const { clearPermissions, hasPermission, isAdmin } = usePermissionStore()
  const { role } = usePermissionStore()
  const { email_addon_enabled, pipelines_addon_enabled, ai_addon_enabled, email_campaigns_addon_enabled } = useTenantStore()
  const { companyName, logoUrl, primaryColor } = useThemeStore()
  const [openConfig, setOpenConfig] = useState(false)
  const [openCampanhas, setOpenCampanhas] = useState(false)
  
  // SECURITY: Filter navigation by permissions AND addons (memoized to prevent recalculation)
  const filteredNavigation = useMemo(() => 
    navigation.filter(item => {
      // Check permission
      if (item.permission && !isAdmin && !hasPermission(item.permission)) {
        return false
      }
      
      // Check addon requirement
      if (item.requiresAddon) {
        if (item.requiresAddon === 'email' && !email_addon_enabled) {
          return false
        }
        if (item.requiresAddon === 'pipelines' && !pipelines_addon_enabled) {
          return false
        }
        if (item.requiresAddon === 'ai' && !ai_addon_enabled) {
          return false // Only show if AI addon is active
        }
      }
      
      return true
    }),
    [isAdmin, hasPermission, email_addon_enabled, pipelines_addon_enabled, ai_addon_enabled, email_campaigns_addon_enabled]
  )
  
  const filteredConfigNavigation = useMemo(() =>
    configNavigation.filter(item =>
      !item.permission || isAdmin || hasPermission(item.permission)
    ),
    [isAdmin, hasPermission]
  )
  
  // Check if any config page is active (memoized)
  const isConfigActive = useMemo(() => 
    configNavigation.some(item => {
      const [itemPath, itemQuery] = item.href.split('?')
      if (pathname !== itemPath && !pathname.startsWith(itemPath + '/')) {
        return false
      }
      if (itemQuery) {
        const params = new URLSearchParams(itemQuery)
        return Array.from(params.entries()).every(([key, value]) => 
          searchParams.get(key) === value
        )
      }
      return true
    }),
    [pathname, searchParams]
  )

  const isCampanhasActive = useMemo(() => 
    pathname === '/email/campaigns' || pathname.startsWith('/email/campaigns/') ||
    pathname === '/email/templates' || pathname.startsWith('/email/templates/'),
    [pathname]
  )

  // Auto-open config menu if on config page
  useEffect(() => {
    if (isConfigActive) {
      setOpenConfig(true)
    }
  }, [isConfigActive])

  useEffect(() => {
    if (isCampanhasActive) {
      setOpenCampanhas(true)
    }
  }, [isCampanhasActive])

  const isActive = (href: string) => {
    const [hrefPath, hrefQuery] = href.split('?')
    
    // Check if pathname matches
    const pathMatches = pathname === hrefPath || pathname.startsWith(hrefPath + '/')
    
    if (!pathMatches) return false
    
    // If there's a query string in href, check if query params match
    if (hrefQuery) {
      const params = new URLSearchParams(hrefQuery)
      return Array.from(params.entries()).every(([key, value]) => 
        searchParams.get(key) === value
      )
    }
    
    // For /settings without query, only match if there's no tab param
    if (hrefPath === '/settings' && !hrefQuery) {
      return pathname === '/settings' && !searchParams.get('tab')
    }
    
    return pathMatches
  }

  const handleLogout = async () => {
    const { clearAddons } = useTenantStore.getState()
    
    try {
      await authApi.logout()
    } catch (e) {
      // Ignore errors on logout
    }
    logout()
    clearPermissions()
    clearAddons()
    toast.success('Até logo!', 'Você foi desconectado')
    router.push('/auth/login')
  }

  return (
    <>
      {/* Overlay for mobile */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={onMobileClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen z-50 flex flex-col transition-all duration-300
                    bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
                    w-64
                    ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <Link href="/dashboard" className="flex items-center gap-3 w-full">
            <div className="flex flex-col leading-none">
              <span className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">driver*</span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">de vendas</span>
            </div>
          </Link>
          {/* Mobile close button */}
          <button
            onClick={onMobileClose}
            className="lg:hidden p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white 
                       hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {filteredNavigation.map((item) => {
            const active = isActive(item.href)
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200
                           ${active 
                             ? 'font-medium' 
                             : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                style={active ? {
                  backgroundColor: `${primaryColor}15`,
                  color: primaryColor,
                } : {}}
              >
                {active && (
                  <motion.div
                    layoutId="activeNavIndicator"
                    className="absolute left-0 w-1 h-6 rounded-r-full"
                    style={{ backgroundColor: primaryColor }}
                  />
                )}
                <item.icon className="w-5 h-5 flex-shrink-0" style={active ? { color: primaryColor } : {}} />
                <span className="text-sm">{item.name}</span>
              </Link>
            )
          })}

          {/* Campanhas de e-mail (when email campaigns addon enabled) */}
          {email_campaigns_addon_enabled && (isAdmin || hasPermission('email.view')) && (
            <div className="pt-2">
              <button
                onClick={() => setOpenCampanhas(!openCampanhas)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200
                           ${isCampanhasActive 
                             ? 'font-medium' 
                             : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                style={isCampanhasActive ? {
                  backgroundColor: `${primaryColor}15`,
                  color: primaryColor,
                } : {}}
              >
                <div className="flex items-center gap-3">
                  <Send className="w-5 h-5 flex-shrink-0" style={isCampanhasActive ? { color: primaryColor } : {}} />
                  <span className="text-sm">Campanhas de e-mail</span>
                </div>
                <ChevronDown 
                  className={`w-4 h-4 transition-transform ${openCampanhas ? 'rotate-180' : ''}`} 
                />
              </button>
              <AnimatePresence>
                {openCampanhas && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-1 ml-2 space-y-1 border-l border-gray-200 dark:border-gray-700 pl-3">
                      {campanhasNavigation.map((item) => {
                        const active = isActive(item.href)
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
                                       ${active 
                                         ? 'font-medium' 
                                         : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                            style={active ? { color: primaryColor } : {}}
                          >
                            <item.icon className="w-4 h-4" />
                            {item.name}
                          </Link>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Configurações Section */}
          <div className="pt-4">
            <button
              onClick={() => setOpenConfig(!openConfig)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200
                         ${isConfigActive 
                           ? 'font-medium' 
                           : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              style={isConfigActive ? {
                backgroundColor: `${primaryColor}15`,
                color: primaryColor,
              } : {}}
            >
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 flex-shrink-0" style={isConfigActive ? { color: primaryColor } : {}} />
                <span className="text-sm">Configurações</span>
              </div>
              <ChevronDown 
                className={`w-4 h-4 transition-transform ${openConfig ? 'rotate-180' : ''}`} 
              />
            </button>

            <AnimatePresence>
              {openConfig && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-1 ml-2 space-y-1 border-l border-gray-200 dark:border-gray-700 pl-3">
                    {filteredConfigNavigation.map((item) => {
                      const active = isActive(item.href)
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
                                     ${active 
                                       ? 'font-medium' 
                                       : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                          style={active ? { color: primaryColor } : {}}
                        >
                          <item.icon className="w-4 h-4" />
                          {item.name}
                        </Link>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </nav>

        {/* Theme Toggle */}
        <div className="px-4 pb-2">
          <ThemeToggle />
        </div>

        {/* User & Logout */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div 
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ 
                backgroundColor: `${primaryColor}20`,
                color: primaryColor,
              }}
            >
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt={user.name} className="w-9 h-9 rounded-full object-cover" />
              ) : (
                <span className="font-medium text-sm">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.name}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 
                         rounded-lg transition-all"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
