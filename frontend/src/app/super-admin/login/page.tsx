'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Loader2, Shield, Moon, Sun, ChevronLeft } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { superAdminAuthApi } from '@/lib/api'
import { useSuperAdminAuthStore } from '@/stores/super-admin-auth-store'
import { toast } from '@/hooks/use-toast'

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
})

type FormData = z.infer<typeof schema>

export default function SuperAdminLoginPage() {
  const router = useRouter()
  const { isAuthenticated, setAuth } = useSuperAdminAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    setMounted(true)
    const savedTheme = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const shouldDark = savedTheme === 'dark' || (!savedTheme && prefersDark)
    setIsDark(shouldDark)
    if (shouldDark) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, [])

  useEffect(() => {
    if (isAuthenticated) router.push('/super-admin')
  }, [isAuthenticated, router])

  const toggleTheme = () => {
    const next = !isDark
    setIsDark(next)
    if (next) {
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
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    try {
      const response = await superAdminAuthApi.login(data)
      const payload = response.data.data

      setAuth({
        user: payload.user,
        tokens: payload.tokens,
      })

      toast.success('Bem-vindo!', 'Acesso administrativo liberado')
      router.push('/super-admin')
    } catch (err: any) {
      const message = err.response?.data?.message || 'Erro ao fazer login'
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

      {/* Left side */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-30" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/10 dark:bg-emerald-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-teal-300/20 dark:bg-amber-500/10 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col justify-center px-16">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-14 h-14 bg-white/20 dark:bg-emerald-500 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-xl">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <span className="text-3xl font-bold text-white font-display">Driver Admin</span>
            </div>

            <h1 className="text-4xl lg:text-5xl font-bold text-white leading-tight mb-6 font-display">
              Painel do
              <br />
              <span className="text-emerald-200 dark:text-emerald-400">Super Administrador</span>
            </h1>

            <p className="text-lg text-white/80 dark:text-slate-400 max-w-md leading-relaxed">
              Acesso exclusivo para os donos do Driver de Vendas CRM (custos, métricas e gestão de tenants).
            </p>
          </motion.div>
        </div>
      </div>

      {/* Right side */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="mb-6">
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400"
            >
              <ChevronLeft className="w-4 h-4" />
              Voltar para o login do CRM
            </Link>
          </div>

          <div className="bg-white dark:bg-slate-800/50 rounded-2xl shadow-xl dark:shadow-2xl border border-slate-200 dark:border-slate-700/50 p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-display">
                Entrar (Admin)
              </h2>
              <p className="text-slate-500 dark:text-slate-400 mt-2">
                Use o usuário super admin para acessar o painel
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  E-mail
                </label>
                <input
                  type="email"
                  {...register('email')}
                  className={`input ${errors.email ? 'input-error' : ''}`}
                  placeholder="adm@drivercrm.com.br"
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

              <button type="submit" disabled={isLoading} className="btn-primary w-full py-3">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Entrar no Painel Admin'}
              </button>
            </form>
          </div>

          <p className="text-center text-slate-400 dark:text-slate-500 text-sm mt-8">
            © 2026 Driver de Vendas CRM. Painel administrativo.
          </p>
        </motion.div>
      </div>
    </div>
  )
}

