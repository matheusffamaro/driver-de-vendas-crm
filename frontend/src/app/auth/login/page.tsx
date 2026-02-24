'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Eye, EyeOff, LogIn, Loader2, Building2, Moon, Sun } from 'lucide-react'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { usePermissionStore } from '@/stores/permission-store'
import { toast } from '@/hooks/use-toast'

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const { setPermissions } = usePermissionStore()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const savedTheme = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setIsDark(true)
      document.documentElement.classList.add('dark')
    }
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

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true)
    
    try {
      const response = await authApi.login(data)
      const { user, role, permissions, is_admin, is_manager, is_super_admin, tokens } = response.data.data
      
      // Set auth data (tenant/tenants are optional for single-tenant CRM)
      setAuth({ 
        user: { ...user, is_super_admin: is_super_admin || user.is_super_admin || false }, 
        tenant: null, 
        role, 
        tenants: [], 
        tokens 
      })
      
      // Set permissions
      setPermissions({
        role,
        permissions: permissions || [],
        is_admin: is_admin || false,
        is_manager: is_manager || false,
      })
      
      toast.success('Bem-vindo!', `Logado como ${user.name}`)
      router.push('/dashboard')
    } catch (error: any) {
      const message = error.response?.data?.message || 'Erro ao fazer login'
      toast.error('Falha no login', message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      {/* Theme Toggle */}
      {mounted && (
        <motion.button
          onClick={toggleTheme}
          className="fixed top-6 right-6 z-50 w-10 h-10 rounded-xl bg-white dark:bg-slate-800 
                     border border-slate-200 dark:border-slate-700 shadow-lg
                     flex items-center justify-center text-slate-600 dark:text-slate-300 
                     hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          whileTap={{ scale: 0.95 }}
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </motion.button>
      )}

      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 relative overflow-hidden">
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-grid-pattern opacity-30" />
        
        {/* Gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/10 dark:bg-emerald-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-teal-300/20 dark:bg-amber-500/10 rounded-full blur-3xl" />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-14 h-14 bg-white/20 dark:bg-emerald-500 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-xl">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <span className="text-3xl font-bold text-white font-display">Driver</span>
            </div>
            
            <h1 className="text-4xl lg:text-5xl font-bold text-white leading-tight mb-6 font-display">
              CRM de vendas
              <br />
              <span className="text-emerald-200 dark:text-emerald-400">inteligente</span>
            </h1>
            
            <p className="text-lg text-white/80 dark:text-slate-400 max-w-md leading-relaxed">
              Gerencie seus clientes, vendas e WhatsApp em uma única plataforma com IA integrada.
            </p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-12 flex items-center gap-8"
          >
            <div>
              <div className="text-3xl font-bold text-white">500+</div>
              <div className="text-sm text-white/60 dark:text-slate-500">Empresas</div>
            </div>
            <div className="w-px h-12 bg-white/20 dark:bg-slate-700" />
            <div>
              <div className="text-3xl font-bold text-white">99.9%</div>
              <div className="text-sm text-white/60 dark:text-slate-500">Uptime</div>
            </div>
            <div className="w-px h-12 bg-white/20 dark:bg-slate-700" />
            <div>
              <div className="text-3xl font-bold text-white">24/7</div>
              <div className="text-sm text-white/60 dark:text-slate-500">Suporte</div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 w-full min-w-0">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md min-w-0"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-slate-900 dark:text-white font-display">Driver</span>
          </div>

          <div className="bg-white dark:bg-slate-800/50 rounded-2xl shadow-xl dark:shadow-2xl border border-slate-200 dark:border-slate-700/50 p-4 sm:p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-display">Entrar</h2>
              <p className="text-slate-500 dark:text-slate-400 mt-2">
                Entre na sua conta para continuar
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 w-full">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  E-mail
                </label>
                <input
                  type="email"
                  {...register('email')}
                  className={`input ${errors.email ? 'input-error' : ''}`}
                  placeholder="seu@email.com"
                />
                {errors.email && (
                  <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Senha
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    {...register('password')}
                    className={`input pr-12 ${errors.password ? 'input-error' : ''}`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
                )}
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-slate-600 dark:text-slate-400 cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 
                               text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0" 
                  />
                  Lembrar de mim
                </label>
                <Link href="/auth/forgot-password" className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium">
                  Esqueceu a senha?
                </Link>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full py-3"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    Entrar
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-slate-500 dark:text-slate-400 mt-6">
              Não tem uma conta?{' '}
              <Link href="/auth/register" className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-semibold">
                Criar conta
              </Link>
            </p>
          </div>

          {/* Footer */}
          <p className="text-center text-slate-400 dark:text-slate-500 text-sm mt-8">
            © 2026 Driver de Vendas CRM. Todos os direitos reservados.
          </p>
        </motion.div>
      </div>
    </div>
  )
}
