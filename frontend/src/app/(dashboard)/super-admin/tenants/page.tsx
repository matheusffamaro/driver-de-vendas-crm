'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSuperAdminAuthStore } from '@/stores/super-admin-auth-store'
import { superAdminApi } from '@/lib/api'
import {
  Building2,
  Search,
  Users,
  Brain,
  CheckCircle,
  XCircle,
  Eye,
} from 'lucide-react'
import Link from 'next/link'

interface TenantItem {
  id: string
  name: string
  email: string
  is_active: boolean
  created_at: string
  subscription?: {
    plan?: {
      name: string
    }
    status?: string
  }
  computed_status?: string
  subscription_status_label?: string
  metrics: {
    users_count: number
    clients_count: number
    pipeline_cards_count: number
    ai_tokens_used: number
  }
}

export default function TenantsPage() {
  const { user } = useSuperAdminAuthStore()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin-tenants', searchTerm, statusFilter, page],
    queryFn: async () => {
      const response = await superAdminApi.tenants.list({
        search: searchTerm || undefined,
        status: statusFilter,
        page,
        per_page: 15,
      })
      return response.data
    },
    enabled: !!user?.is_super_admin,
  })

  const tenants = data?.data || []
  const meta = data?.meta || { total: 0, current_page: 1, last_page: 1 }

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Empresas</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Gerencie todas as empresas cadastradas</p>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Total: <span className="text-gray-900 dark:text-white font-medium">{meta.total || 0}</span> empresas
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
        >
          <option value="all">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Empresa
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Plano
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Usuários
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Clientes
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Uso IA
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  Carregando...
                </td>
              </tr>
            ) : tenants.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>Nenhuma empresa encontrada</p>
                </td>
              </tr>
            ) : (
              tenants.map((tenant: TenantItem) => (
                <tr key={tenant.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold">
                        {tenant.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{tenant.name}</p>
                        <p className="text-sm text-gray-500">{tenant.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="px-2.5 py-1 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-center">
                        {tenant.subscription?.plan?.name || 'Sem Plano'}
                      </span>
                      {tenant.subscription?.status === 'trial' && tenant.subscription_status_label && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 text-center">
                          {tenant.subscription_status_label}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-900 dark:text-white">{tenant.metrics.users_count}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center text-gray-600 dark:text-gray-400">
                    {tenant.metrics.clients_count}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <Brain className="w-4 h-4 text-purple-500" />
                      <span className="text-gray-900 dark:text-white">{formatNumber(tenant.metrics.ai_tokens_used)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {(() => {
                      const status = tenant.computed_status || (tenant.is_active ? 'active' : 'suspended')
                      
                      if (status === 'active') {
                        return (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full">
                            <CheckCircle className="w-3 h-3" />
                            Ativo
                          </span>
                        )
                      }
                      
                      if (status === 'trial') {
                        return (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
                            <CheckCircle className="w-3 h-3" />
                            Trial
                          </span>
                        )
                      }
                      
                      if (status === 'suspended') {
                        return (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full">
                            <XCircle className="w-3 h-3" />
                            Suspenso
                          </span>
                        )
                      }
                      
                      if (status === 'expired') {
                        return (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-full">
                            <XCircle className="w-3 h-3" />
                            Expirado
                          </span>
                        )
                      }
                      
                      return (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400 rounded-full">
                          <XCircle className="w-3 h-3" />
                          Sem Assinatura
                        </span>
                      )
                    })()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/super-admin/tenants/${tenant.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
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

        {/* Pagination */}
        {meta.last_page > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Página {meta.current_page} de {meta.last_page} ({meta.total} empresas)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={meta.current_page <= 1}
                className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(p => Math.min(meta.last_page, p + 1))}
                disabled={meta.current_page >= meta.last_page}
                className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
