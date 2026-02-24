'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Moon,
  Sun,
  Menu,
  Kanban,
} from 'lucide-react'
import { useThemeStore } from '@/stores/theme-store'
import { usePermissionStore } from '@/stores/permission-store'

interface HeaderProps {
  onMobileMenuToggle?: () => void
}

export function Header({ onMobileMenuToggle }: HeaderProps) {
  const { companyName, logoUrl, primaryColor } = useThemeStore()
  const { role } = usePermissionStore()
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  const toggleTheme = () => {
    const newIsDark = !isDark
    setIsDark(newIsDark)
    
    if (newIsDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  return (
    <header className="h-14 bg-white dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 sticky top-0 z-30">
      <div className="h-full px-4 sm:px-6 flex items-center justify-between">
        {/* Left side */}
        <div className="flex items-center gap-3">
          {/* Mobile menu button */}
          <button 
            onClick={onMobileMenuToggle}
            className="lg:hidden p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white 
                       hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Company logo/name for mobile */}
          <div className="lg:hidden flex items-center gap-3">
            {['sales', 'seller'].includes(role?.slug || '') ? (
              <div className="flex flex-col leading-none">
                <span className="text-xl font-black text-gray-900 dark:text-white tracking-tight">driver*</span>
                <span className="text-[9px] uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">de vendas</span>
              </div>
            ) : logoUrl ? (
              <img src={logoUrl} alt={companyName} className="h-10 w-auto" />
            ) : (
              <>
                <div 
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Kanban className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                  {companyName}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          {mounted && (
            <motion.button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center 
                         text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
              whileTap={{ scale: 0.95 }}
              title={isDark ? 'Modo claro' : 'Modo escuro'}
            >
              {isDark ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </motion.button>
          )}
        </div>
      </div>
    </header>
  )
}
