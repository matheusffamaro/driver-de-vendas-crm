'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSuperAdminAuthStore } from '@/stores/super-admin-auth-store'
import { superAdminApi } from '@/lib/api'
import {
  Building2,
  Users,
  CreditCard,
  Brain,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  Search,
  Eye,
  CheckCircle,
  XCircle,
  RefreshCw,
  BarChart3,
  ArrowRight,
} from 'lucide-react'
import Link from 'next/link'

interface DashboardData {
  tenants: {
    total: number
    active: number
    inactive: number
    new_this_month: number
    growth_percent: number
  }
  users: {
    total: number
    active: number
    new_this_month: number
  }
  subscriptions: {
    active: number
    monthly_revenue: number
    monthly_revenue_formatted: string
  }
  ai_usage: {
    tokens_today: number
    tokens_month: number
    cost_month_usd: number
    cost_month_brl: number
  }
}

interface TenantItem {
  id: string
  name: string
  email: string
  is_active: boolean
  subscription?: {
    plan?: {
      name: string
    }
  }
  metrics: {
    users_count: number
    ai_tokens_used: number
  }
}

export default function SuperAdminDashboard() {
  const { user } = useSuperAdminAuthStore()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const { data: dashboardData, isLoading: isLoadingDashboard, refetch } = useQuery({
    queryKey: ['super-admin-dashboard'],
    queryFn: async () => {
      const response = await superAdminApi.dashboard()
      return response.data.data as DashboardData
    },
    enabled: !!user?.is_super_admin,
  })

  const { data: tenantsData, isLoading: isLoadingTenants } = useQuery({
    queryKey: ['super-admin-tenants', searchTerm, statusFilter],
    queryFn: async () => {
      const response = await superAdminApi.tenants.list({
        search: searchTerm || undefined,
        status: statusFilter,
        per_page: 5,
      })
      return response.data
    },
    enabled: !!user?.is_super_admin,
  })

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Dashboard Administrativo
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Monitoramento de empresas e custos
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Empresas */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Empresas
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                {dashboardData?.tenants.total || 0}
              </p>
              <div className="flex items-center gap-1 mt-2">
                {(dashboardData?.tenants.growth_percent || 0) >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                )}
                <span className={`text-sm font-medium ${(dashboardData?.tenants.growth_percent || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {dashboardData?.tenants.growth_percent || 0}% este mês
                </span>
              </div>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <Building2 className="w-8 h-8 text-emerald-500" />
            </div>
          </div>
        </div>

        {/* Usuários */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Usuários Totais
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                {dashboardData?.users.total || 0}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                {dashboardData?.users.active || 0} ativos
              </p>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </div>
        </div>

        {/* Receita */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Receita Mensal
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                {dashboardData?.subscriptions.monthly_revenue_formatted || 'R$ 0'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                {dashboardData?.subscriptions.active || 0} assinaturas
              </p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <CreditCard className="w-8 h-8 text-green-500" />
            </div>
          </div>
        </div>

        {/* Custo IA */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Custo IA (Mês)
              </p>
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                ${(dashboardData?.ai_usage.cost_month_usd || 0).toFixed(2)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                ~R$ {(dashboardData?.ai_usage.cost_month_brl || 0).toFixed(2)}
              </p>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <Brain className="w-8 h-8 text-purple-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Uso de Tokens */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-500" />
            Uso de Tokens
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Hoje</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatNumber(dashboardData?.ai_usage.tokens_today || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Este mês</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatNumber(dashboardData?.ai_usage.tokens_month || 0)}
              </span>
            </div>
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Média diária: {formatNumber(Math.round((dashboardData?.ai_usage.tokens_month || 0) / 30))} tokens
              </div>
            </div>
          </div>
        </div>

        {/* Detalhamento de Custos */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-500" />
            Detalhamento de Custos
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Input tokens</span>
              <span className="font-mono text-gray-900 dark:text-white">$0.59/1M</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Output tokens</span>
              <span className="font-mono text-gray-900 dark:text-white">$0.79/1M</span>
            </div>
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-900 dark:text-white">Total Mês</span>
                <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">
                  ${(dashboardData?.ai_usage.cost_month_usd || 0).toFixed(4)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Resumo Rápido */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-500" />
            Resumo Rápido
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Empresas ativas</span>
              <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-sm font-medium">
                {dashboardData?.tenants.active || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Empresas inativas</span>
              <span className="px-2.5 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-sm font-medium">
                {dashboardData?.tenants.inactive || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Novos este mês</span>
              <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm font-medium">
                +{dashboardData?.tenants.new_this_month || 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Empresas Cadastradas
            </h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar empresa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">Todos</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Empresa
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Plano
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Usuários
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Uso IA
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {isLoadingTenants ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Carregando...
                  </td>
                </tr>
              ) : tenantsData?.data?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Nenhuma empresa encontrada
                  </td>
                </tr>
              ) : (
                tenantsData?.data?.map((tenant: TenantItem) => (
                  <tr key={tenant.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {tenant.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {tenant.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full">
                        {tenant.subscription?.plan?.name || 'Free'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">
                      {tenant.metrics.users_count}
                    </td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">
                      {formatNumber(tenant.metrics.ai_tokens_used)} tokens
                    </td>
                    <td className="px-6 py-4">
                      {tenant.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full">
                          <CheckCircle className="w-3 h-3" />
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full">
                          <XCircle className="w-3 h-3" />
                          Inativo
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/super-admin/tenants/${tenant.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Ver todas */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <Link
            href="/super-admin/tenants"
            className="flex items-center justify-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium"
          >
            Ver todas as empresas
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
