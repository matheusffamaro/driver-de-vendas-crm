'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSuperAdminAuthStore } from '@/stores/super-admin-auth-store'
import { superAdminApi } from '@/lib/api'
import {
  CreditCard,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Building2,
  DollarSign,
  AlertTriangle,
} from 'lucide-react'
import Link from 'next/link'

interface Subscription {
  id: string
  tenant_id: string
  tenant_name: string
  plan_name: string
  status: 'active' | 'trial' | 'cancelled' | 'expired'
  price: number
  started_at: string
  expires_at: string | null
}

export default function SubscriptionsPage() {
  const { user } = useSuperAdminAuthStore()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin-subscriptions', searchTerm, statusFilter],
    queryFn: async () => {
      try {
        const response = await superAdminApi.subscriptions?.list?.({
          search: searchTerm || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
        })
        return response?.data || { data: [], totals: {} }
      } catch (e) {
        return { data: [], totals: { total: 0, active: 0, trial: 0, cancelled: 0, monthly_revenue: 0 } }
      }
    },
    enabled: !!user?.is_super_admin,
  })

  const subscriptions = data?.data || []
  const totals = data?.totals || { total: 0, active: 0, trial: 0, cancelled: 0, monthly_revenue: 0 }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full">
            <CheckCircle className="w-3 h-3" />
            Ativo
          </span>
        )
      case 'trial':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
            <Clock className="w-3 h-3" />
            Trial
          </span>
        )
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full">
            <XCircle className="w-3 h-3" />
            Cancelado
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400 rounded-full">
            <AlertTriangle className="w-3 h-3" />
            {status}
          </span>
        )
    }
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Assinaturas</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Gerencie todas as assinaturas dos clientes</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{totals.total || 0}</p>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <CreditCard className="w-6 h-6 text-emerald-500" />
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Ativas</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{totals.active || 0}</p>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <CheckCircle className="w-6 h-6 text-emerald-500" />
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Em Trial</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{totals.trial || 0}</p>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Clock className="w-6 h-6 text-blue-500" />
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Receita Mensal</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                R$ {(totals.monthly_revenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por empresa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
        >
          <option value="all">Todos os status</option>
          <option value="active">Ativas</option>
          <option value="trial">Em Trial</option>
          <option value="cancelled">Canceladas</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
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
                Valor
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Início
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  Carregando...
                </td>
              </tr>
            ) : subscriptions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>Nenhuma assinatura encontrada</p>
                </td>
              </tr>
            ) : (
              subscriptions.map((sub: Subscription) => (
                <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{sub.tenant_name}</p>
                        <p className="text-sm text-gray-500">ID: {sub.tenant_id?.slice(0, 8)}...</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full">
                      {sub.plan_name}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">
                    R$ {(sub.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(sub.status)}
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400 text-sm">
                    {sub.started_at ? new Date(sub.started_at).toLocaleDateString('pt-BR') : '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/super-admin/tenants/${sub.tenant_id}`}
                      className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 text-sm font-medium"
                    >
                      Ver empresa
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
