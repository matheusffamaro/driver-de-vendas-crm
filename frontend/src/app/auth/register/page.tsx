'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Eye, EyeOff, UserPlus, Loader2, Building2, CheckCircle } from 'lucide-react'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from '@/hooks/use-toast'

const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
  password_confirmation: z.string(),
  tenant_name: z.string().min(2, 'Nome da empresa deve ter pelo menos 2 caracteres'),
  tenant_document: z.string().optional(),
}).refine((data) => data.password === data.password_confirmation, {
  message: 'As senhas não conferem',
  path: ['password_confirmation'],
})

type RegisterForm = z.infer<typeof registerSchema>

const features = [
  'Dashboard com KPIs em tempo real',
  'Gestão de clientes e contratos',
  'Controle financeiro completo',
  'Relatórios e exportação CSV',
  '14 dias de trial gratuito',
]

export default function RegisterPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true)
    
    try {
      const response = await authApi.register(data)
      const result = response.data.data
      
      setAuth({
        user: result.user,
        tenant: result.tenant,
        role: { id: '', name: 'Owner', slug: 'owner' },
        tenants: [result.tenant],
        tokens: result.tokens,
      })
      
      toast.success('Conta criada!', 'Bem-vindo ao Driver de Vendas CRM')
      router.push('/dashboard')
    } catch (error: any) {
      const message = error.response?.data?.message || 'Erro ao criar conta'
      toast.error('Falha no registro', message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex dark">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-dark-bg">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white font-display">Driver</span>
          </div>

          <div className="glass-card p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white font-display">Criar conta</h2>
              <p className="text-slate-400 mt-2">
                Comece seu trial gratuito de 14 dias
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Seu nome
                  </label>
                  <input
                    type="text"
                    {...register('name')}
                    className={`input ${errors.name ? 'input-error' : ''}`}
                    placeholder="João Silva"
                  />
                  {errors.name && (
                    <p className="text-danger-500 text-sm mt-1">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    E-mail
                  </label>
                  <input
                    type="email"
                    {...register('email')}
                    className={`input ${errors.email ? 'input-error' : ''}`}
                    placeholder="seu@email.com"
                  />
                  {errors.email && (
                    <p className="text-danger-500 text-sm mt-1">{errors.email.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nome da empresa
                </label>
                <input
                  type="text"
                  {...register('tenant_name')}
                  className={`input ${errors.tenant_name ? 'input-error' : ''}`}
                  placeholder="Minha Empresa LTDA"
                />
                {errors.tenant_name && (
                  <p className="text-danger-500 text-sm mt-1">{errors.tenant_name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  CNPJ <span className="text-slate-500">(opcional)</span>
                </label>
                <input
                  type="text"
                  {...register('tenant_document')}
                  className="input"
                  placeholder="00.000.000/0001-00"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
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
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-danger-500 text-sm mt-1">{errors.password.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Confirmar senha
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    {...register('password_confirmation')}
                    className={`input ${errors.password_confirmation ? 'input-error' : ''}`}
                    placeholder="••••••••"
                  />
                  {errors.password_confirmation && (
                    <p className="text-danger-500 text-sm mt-1">{errors.password_confirmation.message}</p>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full py-3 mt-6"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    Criar conta grátis
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-slate-400 mt-6 text-sm">
              Ao criar conta, você concorda com nossos{' '}
              <Link href="/terms" className="text-brand-400 hover:text-brand-300">
                Termos de Uso
              </Link>{' '}
              e{' '}
              <Link href="/privacy" className="text-brand-400 hover:text-brand-300">
                Política de Privacidade
              </Link>
            </p>

            <p className="text-center text-slate-400 mt-4">
              Já tem uma conta?{' '}
              <Link href="/auth/login" className="text-brand-400 hover:text-brand-300 font-medium">
                Entrar
              </Link>
            </p>
          </div>
        </motion.div>
      </div>

      {/* Right side - Features */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-dark-bg via-dark-card to-dark-bg relative overflow-hidden">
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-grid-dark opacity-50" />
        
        {/* Gradient orbs */}
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-brand-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-1/4 w-64 h-64 bg-accent-500/10 rounded-full blur-3xl" />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-brand-500 rounded-xl flex items-center justify-center">
                <Building2 className="w-7 h-7 text-white" />
              </div>
              <span className="text-2xl font-bold text-white font-display">Driver</span>
            </div>
            
            <h2 className="text-3xl font-bold text-white mb-8 font-display">
              Tudo que você precisa para
              <br />
              <span className="gradient-text">gerenciar seu negócio</span>
            </h2>
            
            <div className="space-y-4">
              {features.map((feature, index) => (
                <motion.div
                  key={feature}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + index * 0.1, duration: 0.5 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-6 h-6 rounded-full bg-brand-500/20 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-brand-400" />
                  </div>
                  <span className="text-slate-300">{feature}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

