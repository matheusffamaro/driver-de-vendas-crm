'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSuperAdminAuthStore } from '@/stores/super-admin-auth-store'
import { superAdminApi } from '@/lib/api'
import {
  ArrowLeft,
  Building2,
  Users,
  Activity,
  Brain,
  Calendar,
  Mail,
  Phone,
  CheckCircle,
  Ban,
  AlertTriangle,
  Edit,
  Save,
  X,
  Trash2,
  CreditCard,
  TrendingUp,
  Clock,
  DollarSign,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from '@/hooks/use-toast'

export default function TenantDetailPage() {
  const router = useRouter()
  const params = useParams()
  const tenantId = params.id as string
  const queryClient = useQueryClient()
  const { user } = useSuperAdminAuthStore()
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', email: '' })

  // Verificar se é super admin
  useEffect(() => {
    if (user && !user.is_super_admin) {
      router.push('/dashboard')
    }
  }, [user, router])

  // Fetch tenant details
  const { data: tenantData, isLoading } = useQuery({
    queryKey: ['super-admin-tenant', tenantId],
    queryFn: async () => {
      const response = await superAdminApi.tenants.get(tenantId)
      return response.data.data
    },
    enabled: !!tenantId && !!user?.is_super_admin,
  })

  useEffect(() => {
    if (tenantData?.tenant) {
      setEditForm({
        name: tenantData.tenant.name,
        email: tenantData.tenant.email || '',
      })
    }
  }, [tenantData])

  // Update tenant mutation
  const updateMutation = useMutation({
    mutationFn: (data: { name: string; email: string }) =>
      superAdminApi.tenants.update(tenantId, data),
    onSuccess: () => {
      toast.success('Tenant atualizado com sucesso!')
      setIsEditing(false)
      queryClient.invalidateQueries({ queryKey: ['super-admin-tenant', tenantId] })
    },
    onError: () => {
      toast.error('Erro ao atualizar tenant')
    },
  })

  // Suspend/Activate mutations
  const suspendMutation = useMutation({
    mutationFn: (reason?: string) => superAdminApi.tenants.suspend(tenantId, reason),
    onSuccess: () => {
      toast.success('Empresa suspensa! Emails de notificação enviados aos administradores.')
      queryClient.invalidateQueries({ queryKey: ['super-admin-tenant', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['super-admin-tenants'] })
    },
    onError: () => {
      toast.error('Erro ao suspender empresa')
    },
  })

  const activateMutation = useMutation({
    mutationFn: () => superAdminApi.tenants.activate(tenantId),
    onSuccess: () => {
      toast.success('Empresa reativada! Os usuários já podem acessar o sistema.')
      queryClient.invalidateQueries({ queryKey: ['super-admin-tenant', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['super-admin-tenants'] })
    },
    onError: () => {
      toast.error('Erro ao reativar empresa')
    },
  })

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (!user?.is_super_admin) {
    return null
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    )
  }

  const tenant = tenantData?.tenant
  const metrics = tenantData?.metrics
  const recentActivity = tenantData?.recent_activity || []

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/super-admin"
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {tenant?.name}
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                  Detalhes da Empresa
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {tenant?.is_active ? (
                <button
                  onClick={() => {
                    const reason = prompt('Motivo da suspensão (opcional):')
                    if (reason !== null && confirm('Deseja suspender esta empresa? Todos os usuários serão desativados.')) {
                      suspendMutation.mutate(reason || undefined)
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                >
                  <Ban className="w-4 h-4" />
                  Suspender
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (confirm('Deseja reativar esta empresa? Todos os usuários serão reativados.')) {
                      activateMutation.mutate()
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  Reativar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Informações Básicas
                </h2>
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <Edit className="w-4 h-4" />
                    Editar
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateMutation.mutate(editForm)}
                      className="flex items-center gap-1 px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                      <Save className="w-4 h-4" />
                      Salvar
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="flex items-center gap-1 px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                      <X className="w-4 h-4" />
                      Cancelar
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Nome da Empresa
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-white font-medium">
                      {tenant?.name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Email
                  </label>
                  {isEditing ? (
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-white">
                      {tenant?.email || '-'}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Documento
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {tenant?.document || '-'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Status
                  </label>
                  {(() => {
                    const status = tenant?.computed_status || 'no_subscription'
                    
                    if (status === 'active') {
                      return (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                          <CheckCircle className="w-4 h-4" />
                          Ativo
                        </span>
                      )
                    }
                    
                    if (status === 'trial') {
                      return (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
                          <Clock className="w-4 h-4" />
                          Trial
                        </span>
                      )
                    }
                    
                    if (status === 'suspended') {
                      return (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full">
                          <Ban className="w-4 h-4" />
                          Suspenso
                        </span>
                      )
                    }
                    
                    if (status === 'expired') {
                      return (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-full">
                          <AlertTriangle className="w-4 h-4" />
                          Expirado
                        </span>
                      )
                    }
                    
                    return (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400 rounded-full">
                        <AlertTriangle className="w-4 h-4" />
                        Sem Assinatura
                      </span>
                    )
                  })()}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Data de Cadastro
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {tenant?.created_at ? formatDate(tenant.created_at) : '-'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Plano Atual
                  </label>
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full">
                    <CreditCard className="w-4 h-4" />
                    {tenant?.subscription?.plan?.name || 'Sem Plano'}
                  </span>
                  {tenant?.subscription_status_label && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {tenant.subscription_status_label}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Usage Stats */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                Estatísticas de Uso
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                  <Users className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {metrics?.users?.total || 0}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Usuários
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                  <Building2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {metrics?.clients?.total || 0}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Clientes
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                  <TrendingUp className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {metrics?.pipeline?.total_cards || 0}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Cards Funil
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                  <Brain className="w-8 h-8 text-pink-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatNumber(metrics?.ai_usage?.total_tokens || 0)}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Tokens IA
                  </p>
                </div>
              </div>
            </div>

            {/* AI Usage Details */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-500" />
                Uso de IA (Este Mês)
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Input Tokens</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatNumber(metrics?.ai_usage?.input_tokens || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Output Tokens</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatNumber(metrics?.ai_usage?.output_tokens || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Requisições</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {metrics?.ai_usage?.requests || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Cache Hits</p>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">
                    {metrics?.ai_usage?.cache_hits || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Custo Estimado</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    ${(metrics?.ai_usage?.cost_usd || 0).toFixed(4)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Users List */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Usuários ({metrics?.users?.total || 0})
              </h2>
              <div className="space-y-3">
                {tenant?.users?.map((u: any) => (
                  <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold">
                      {u.name?.charAt(0) || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {u.name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {u.email}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${u.is_active ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                      {u.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                ))}
                {(!tenant?.users || tenant.users.length === 0) && (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                    Nenhum usuário cadastrado
                  </p>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" />
                Atividade Recente
              </h2>
              <div className="space-y-3">
                {recentActivity.length > 0 ? (
                  recentActivity.slice(0, 5).map((activity: any, index: number) => (
                    <div key={index} className="flex items-start gap-3 text-sm">
                      <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5" />
                      <div className="flex-1">
                        <p className="text-gray-900 dark:text-white">
                          {activity.feature || 'AI Request'}
                        </p>
                        <p className="text-gray-500 dark:text-gray-400 text-xs">
                          {activity.tokens_used} tokens • {formatDate(activity.created_at)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                    Nenhuma atividade recente
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
