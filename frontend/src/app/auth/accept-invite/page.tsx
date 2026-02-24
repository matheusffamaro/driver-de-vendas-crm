'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Eye, EyeOff, UserPlus, Loader2, Building2, Moon, Sun, AlertCircle, CheckCircle } from 'lucide-react'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { usePermissionStore } from '@/stores/permission-store'
import { toast } from '@/hooks/use-toast'

const acceptInviteSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  password_confirmation: z.string(),
}).refine((data) => data.password === data.password_confirmation, {
  message: 'As senhas não conferem',
  path: ['password_confirmation'],
})

type AcceptInviteForm = z.infer<typeof acceptInviteSchema>

interface InvitationData {
  id: string
  email: string
  tenant: {
    id: string
    name: string
  }
  role: {
    id: string
    name: string
    slug: string
  }
  inviter: {
    id: string
    name: string
  }
  expires_at: string
}

export default function AcceptInvitePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const { setAuth } = useAuthStore()
  const { setPermissions } = usePermissionStore()
  
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingInvitation, setIsLoadingInvitation] = useState(true)
  const [invitation, setInvitation] = useState<InvitationData | null>(null)
  const [error, setError] = useState<string | null>(null)
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

  useEffect(() => {
    const fetchInvitation = async () => {
      if (!token) {
        setError('Token de convite não encontrado')
        setIsLoadingInvitation(false)
        return
      }

      try {
        const response = await authApi.getInvitation(token)
        setInvitation(response.data.data)
      } catch (err: any) {
        const message = err.response?.data?.message || 'Convite inválido ou expirado'
        setError(message)
      } finally {
        setIsLoadingInvitation(false)
      }
    }

    fetchInvitation()
  }, [token])

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
  } = useForm<AcceptInviteForm>({
    resolver: zodResolver(acceptInviteSchema),
  })

  const onSubmit = async (data: AcceptInviteForm) => {
    if (!token) return
    
    setIsLoading(true)
    
    try {
      const response = await authApi.acceptInvitation(token, data)
      const { user, tenant, role, tenants, tokens, permissions } = response.data.data
      
      setAuth({ user, tenant, role, tenants, tokens })
      
      // SECURITY: Set permissions from backend response
      setPermissions({
        role: role,
        permissions: permissions || [],
        is_admin: role?.slug === 'admin',
        is_manager: role?.slug === 'manager',
      })
      
      toast.success('Bem-vindo!', `Você agora faz parte de ${tenant.name}`)
      router.push('/dashboard')
    } catch (error: any) {
      const message = error.response?.data?.message || 'Erro ao aceitar convite'
      toast.error('Falha ao aceitar convite', message)
    } finally {
      setIsLoading(false)
    }
  }

  // Loading state
  if (isLoadingInvitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400">Carregando convite...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 max-w-md w-full text-center"
        >
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Convite Inválido
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            {error || 'Este convite não existe, já foi aceito ou expirou.'}
          </p>
          <Link 
            href="/auth/login"
            className="btn-primary inline-flex items-center gap-2"
          >
            Ir para o Login
          </Link>
        </motion.div>
      </div>
    )
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
              Você foi convidado
              <br />
              <span className="text-emerald-200 dark:text-emerald-400">para {invitation.tenant.name}</span>
            </h1>
            
            <p className="text-lg text-white/80 dark:text-slate-400 max-w-md leading-relaxed">
              {invitation.inviter.name} convidou você para fazer parte da equipe como {invitation.role.name}.
            </p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-12 p-6 bg-white/10 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/20 dark:border-slate-700"
          >
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-6 h-6 text-emerald-300" />
              <span className="text-white font-semibold">O que você terá acesso:</span>
            </div>
            <ul className="space-y-2 text-white/80 dark:text-slate-400">
              <li>• Dashboard com visão geral do negócio</li>
              <li>• Gestão de clientes e transações</li>
              <li>• Relatórios financeiros</li>
              <li>• Colaboração em equipe</li>
            </ul>
          </motion.div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-slate-900 dark:text-white font-display">Driver</span>
          </div>

          <div className="bg-white dark:bg-slate-800/50 rounded-2xl shadow-xl dark:shadow-2xl border border-slate-200 dark:border-slate-700/50 p-8">
            {/* Invitation Info */}
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 mb-6 border border-emerald-200 dark:border-emerald-800">
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                <span className="font-semibold">{invitation.inviter.name}</span> convidou você para:
              </p>
              <p className="text-lg font-bold text-emerald-800 dark:text-emerald-200 mt-1">
                {invitation.tenant.name}
              </p>
              <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
                Papel: {invitation.role.name}
              </p>
            </div>

            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-display">Complete seu cadastro</h2>
              <p className="text-slate-500 dark:text-slate-400 mt-2">
                E-mail: <span className="font-medium">{invitation.email}</span>
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Seu nome
                </label>
                <input
                  type="text"
                  {...register('name')}
                  className={`input ${errors.name ? 'input-error' : ''}`}
                  placeholder="Como você quer ser chamado"
                />
                {errors.name && (
                  <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
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
                    placeholder="Mínimo 8 caracteres"
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

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Confirmar senha
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    {...register('password_confirmation')}
                    className={`input pr-12 ${errors.password_confirmation ? 'input-error' : ''}`}
                    placeholder="Repita a senha"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password_confirmation && (
                  <p className="text-red-500 text-sm mt-1">{errors.password_confirmation.message}</p>
                )}
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
                    <UserPlus className="w-5 h-5" />
                    Aceitar Convite e Criar Conta
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-slate-500 dark:text-slate-400 mt-6 text-sm">
              Já tem uma conta?{' '}
              <Link href="/auth/login" className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-semibold">
                Fazer login
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

