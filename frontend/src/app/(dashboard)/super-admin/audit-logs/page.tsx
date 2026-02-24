'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSuperAdminAuthStore } from '@/stores/super-admin-auth-store'
import { superAdminApi } from '@/lib/api'
import {
  FileText,
  Search,
  Calendar,
  User,
  Activity,
  Eye,
  Edit,
  Trash2,
  UserPlus,
  Shield,
  Clock,
} from 'lucide-react'

interface AuditLog {
  id: string
  user_id: string
  user_name?: string
  action: string
  entity_type?: string
  entity_id?: string
  old_values?: any
  new_values?: any
  ip_address?: string
  created_at: string
}

const actionIcons: Record<string, any> = {
  'view_dashboard': Eye,
  'list_tenants': Eye,
  'view_tenant': Eye,
  'update_tenant': Edit,
  'suspend_tenant': Shield,
  'activate_tenant': Shield,
  'add_super_admin': UserPlus,
  'remove_super_admin': Trash2,
  'default': Activity,
}

const actionLabels: Record<string, string> = {
  'view_dashboard': 'Visualizou Dashboard',
  'list_tenants': 'Listou Empresas',
  'view_tenant': 'Visualizou Empresa',
  'update_tenant': 'Atualizou Empresa',
  'suspend_tenant': 'Suspendeu Empresa',
  'activate_tenant': 'Reativou Empresa',
  'add_super_admin': 'Adicionou Super Admin',
  'remove_super_admin': 'Removeu Super Admin',
}

export default function AuditLogsPage() {
  const { user } = useSuperAdminAuthStore()
  const [searchTerm, setSearchTerm] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin-audit-logs', searchTerm, actionFilter, page],
    queryFn: async () => {
      try {
        const response = await superAdminApi.auditLogs?.({
          search: searchTerm || undefined,
          action: actionFilter !== 'all' ? actionFilter : undefined,
          page,
          per_page: 20,
        })
        return response?.data || { data: [], meta: { total: 0, current_page: 1, last_page: 1 } }
      } catch (e) {
        return { data: [], meta: { total: 0, current_page: 1, last_page: 1 } }
      }
    },
    enabled: !!user?.is_super_admin,
  })

  const logs = data?.data || []
  const meta = data?.meta || { total: 0, current_page: 1, last_page: 1 }

  const getActionIcon = (action: string) => {
    const Icon = actionIcons[action] || actionIcons['default']
    return Icon
  }

  const getActionLabel = (action: string) => {
    return actionLabels[action] || action
  }

  const getActionColor = (action: string) => {
    if (action.includes('view') || action.includes('list')) return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
    if (action.includes('update') || action.includes('edit')) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20'
    if (action.includes('suspend') || action.includes('delete') || action.includes('remove')) return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
    if (action.includes('activate') || action.includes('add')) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
    return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return {
      date: date.toLocaleDateString('pt-BR'),
      time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Logs de Auditoria</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Histórico de ações realizadas no painel administrativo</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total de Registros</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{meta.total || 0}</p>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <FileText className="w-6 h-6 text-emerald-500" />
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Ações Hoje</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {logs.filter((l: AuditLog) => {
                  const today = new Date().toDateString()
                  return new Date(l.created_at).toDateString() === today
                }).length}
              </p>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Calendar className="w-6 h-6 text-blue-500" />
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Admins Ativos</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {new Set(logs.map((l: AuditLog) => l.user_id)).size}
              </p>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <User className="w-6 h-6 text-emerald-500" />
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
            placeholder="Buscar por usuário ou ação..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
        >
          <option value="all">Todas as ações</option>
          <option value="view_dashboard">Visualizar Dashboard</option>
          <option value="list_tenants">Listar Empresas</option>
          <option value="view_tenant">Visualizar Empresa</option>
          <option value="update_tenant">Atualizar Empresa</option>
          <option value="suspend_tenant">Suspender Empresa</option>
          <option value="activate_tenant">Ativar Empresa</option>
        </select>
      </div>

      {/* Logs List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {isLoading ? (
            <div className="px-6 py-12 text-center text-gray-500">
              Carregando...
            </div>
          ) : logs.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>Nenhum log encontrado</p>
            </div>
          ) : (
            logs.map((log: AuditLog) => {
              const Icon = getActionIcon(log.action)
              const { date, time } = formatDate(log.created_at)
              const colorClass = getActionColor(log.action)
              
              return (
                <div key={log.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className={`p-2.5 rounded-lg ${colorClass}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {getActionLabel(log.action)}
                        </span>
                        {log.entity_type && (
                          <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                            {log.entity_type}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {log.user_name || 'Admin'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {date} às {time}
                        </span>
                        {log.ip_address && (
                          <span className="text-gray-400">
                            IP: {log.ip_address}
                          </span>
                        )}
                      </div>
                      {log.entity_id && (
                        <p className="text-xs text-gray-400 mt-1 font-mono">
                          ID: {log.entity_id}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
        </div>

        {/* Pagination */}
        {meta.last_page > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Página {meta.current_page} de {meta.last_page}
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
