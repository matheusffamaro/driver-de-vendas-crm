'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3,
  Users,
  Package,
  Kanban,
  CheckSquare,
  Trophy,
  XCircle,
  Target,
  TrendingUp,
  Clock,
  UserCircle,
  LayoutDashboard,
  Table2,
} from 'lucide-react'
import { ModernColoredBarChart, ModernDonutChart, ProgressRing } from '@/components/ui/charts'
import { pipelineApi, clientsApi, productsApi, crmTasksApi, usersApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { usePermissionStore } from '@/stores/permission-store'

type ViewMode = 'summary' | 'by_salesperson'

export default function ReportsPage() {
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('summary')
  const { isAdmin, isManager } = usePermissionStore()
  const canFilterBySalesperson = isAdmin || isManager

  // Fetch pipelines
  const { data: pipelinesData, isLoading: pipelinesLoading } = useQuery({
    queryKey: ['pipelines-report'],
    queryFn: () => pipelineApi.list(),
  })

  const pipelines = pipelinesData?.data?.data || []
  const activePipeline = selectedPipelineId 
    ? pipelines.find((p: any) => p.id === selectedPipelineId) 
    : pipelines[0]

  // Fetch users (for vendedor filter and admin report)
  const { data: usersData } = useQuery({
    queryKey: ['users-report-list'],
    queryFn: () => usersApi.list({ per_page: 200 }),
    enabled: canFilterBySalesperson,
  })
  const usersList = usersData?.data?.data ?? []

  // Fetch pipeline report (with optional assigned_to and by_salesperson)
  const { data: reportData, isLoading: reportLoading } = useQuery({
    queryKey: ['pipeline-report', activePipeline?.id, selectedUserId ?? 'all', viewMode],
    queryFn: () => pipelineApi.report(activePipeline.id, {
      ...(selectedUserId ? { assigned_to: selectedUserId } : {}),
      ...(viewMode === 'by_salesperson' && canFilterBySalesperson ? { by_salesperson: true } : {}),
    }),
    enabled: !!activePipeline?.id,
  })

  // Fetch pipeline cards for detailed view
  const { data: cardsData } = useQuery({
    queryKey: ['pipeline-cards-report', activePipeline?.id],
    queryFn: () => pipelineApi.cards.list(activePipeline.id),
    enabled: !!activePipeline?.id,
  })

  // Fetch clients
  const { data: clientsData } = useQuery({
    queryKey: ['clients-report'],
    queryFn: () => clientsApi.list({ per_page: 1000 }),
  })

  // Fetch products
  const { data: productsData } = useQuery({
    queryKey: ['products-report'],
    queryFn: () => productsApi.list({ per_page: 1000 }),
  })

  // Fetch tasks
  const { data: tasksData } = useQuery({
    queryKey: ['tasks-report'],
    queryFn: () => crmTasksApi.list({ per_page: 1000 }),
  })

  const report = reportData?.data?.data
  const bySalesperson = report?.by_salesperson ?? []
  const cardsStages = cardsData?.data?.data?.stages || []
  const clients = clientsData?.data?.data || []
  const products = productsData?.data?.data || []
  const tasks = tasksData?.data?.data || []

  // Use report data for accurate metrics
  const totalCards = report?.total_cards || 0
  const wonCards = report?.won_cards || 0
  const lostCards = report?.lost_cards || 0
  const conversionRate = report?.conversion_rate || 0
  const totalPipelineValue = report?.total_pipeline_value || 0
  const wonValue = report?.total_value || 0

  // Tasks metrics
  const pendingTasks = tasks.filter((t: any) => t.status === 'pending').length
  const completedTasks = tasks.filter((t: any) => t.status === 'completed').length
  const inProgressTasks = tasks.filter((t: any) => t.status === 'in_progress').length
  const taskCompletionRate = tasks.length > 0 
    ? Math.round((completedTasks / tasks.length) * 100) 
    : 0

  // Stage distribution data from report
  const stageDistribution = (report?.stage_distribution || cardsStages).map((stage: any) => ({
    name: stage.name,
    value: stage.cards_count || stage.cards?.length || 0,
    total: stage.total_value || 0,
    color: stage.color || '#10B981',
  }))

  // Pipeline result pie chart
  const inProgress = totalCards - wonCards - lostCards
  const resultData = [
    { name: 'Ganhos', value: wonCards, color: '#22C55E' },
    { name: 'Perdidos', value: lostCards, color: '#EF4444' },
    { name: 'Em andamento', value: inProgress > 0 ? inProgress : 0, color: '#3B82F6' },
  ].filter(d => d.value > 0)

  const isLoading = pipelinesLoading || reportLoading

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            Relatórios
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Análise de desempenho do seu CRM
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {canFilterBySalesperson && (
            <>
              <div className="flex items-center gap-2">
                <UserCircle className="w-4 h-4 text-gray-500" />
                <select
                  value={selectedUserId ?? ''}
                  onChange={(e) => setSelectedUserId(e.target.value || null)}
                  className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  <option value="">Todos os vendedores</option>
                  {usersList.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex rounded-xl overflow-hidden border border-gray-300 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setViewMode('summary')}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${viewMode === 'summary' ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Resumido
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('by_salesperson')}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${viewMode === 'by_salesperson' ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                >
                  <Table2 className="w-4 h-4" />
                  Por vendedor
                </button>
              </div>
            </>
          )}
          {pipelines.length > 1 && (
            <select
              value={selectedPipelineId || activePipeline?.id || ''}
              onChange={(e) => setSelectedPipelineId(e.target.value)}
              className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              {pipelines.map((pipeline: any) => (
                <option key={pipeline.id} value={pipeline.id}>
                  {pipeline.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {/* Total Leads */}
            <div className="stat-card">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Kanban className="w-6 h-6 text-purple-500" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Total de Leads</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{totalCards}</p>
              </div>
            </div>

            {/* Conversion Rate */}
            <div className="stat-card">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Target className="w-6 h-6 text-emerald-500" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Taxa de Conversão</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{conversionRate}%</p>
              </div>
            </div>

            {/* Won Value */}
            <div className="stat-card">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-green-500" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Valor Ganho</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(wonValue)}</p>
              </div>
            </div>

            {/* Pipeline Value */}
            <div className="stat-card">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-blue-500" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Valor no Funil</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(totalPipelineValue)}</p>
              </div>
            </div>
          </motion.div>

          {/* Secondary Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-4"
          >
            <div className="stat-card text-center">
              <Trophy className="w-8 h-8 text-green-500 mx-auto" />
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{wonCards}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Ganhos</p>
            </div>
            <div className="stat-card text-center">
              <XCircle className="w-8 h-8 text-red-500 mx-auto" />
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{lostCards}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Perdidos</p>
            </div>
            <div className="stat-card text-center">
              <Users className="w-8 h-8 text-blue-500 mx-auto" />
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{clients.length}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Clientes</p>
            </div>
            <div className="stat-card text-center">
              <Package className="w-8 h-8 text-amber-500 mx-auto" />
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{products.length}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Produtos</p>
            </div>
          </motion.div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Stage Distribution Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-card p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Leads por Etapa
              </h3>
              <ModernColoredBarChart
                data={stageDistribution}
                height={256}
                tooltipFormatter={(value: number, name: string) => {
                  if (name === 'total') return formatCurrency(value)
                  return value
                }}
              />
            </motion.div>

            {/* Pipeline Results Pie Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-card p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Resultado do Funil
              </h3>
              <ModernDonutChart
                data={resultData}
                height={192}
                centerValue={totalCards}
                centerLabel="Total"
              />
            </motion.div>
          </div>

          {/* Tasks Report */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-card p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Desempenho de Tarefas
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="text-center flex flex-col items-center">
                <ProgressRing
                  value={taskCompletionRate}
                  size={128}
                  strokeWidth={10}
                  color="#22C55E"
                />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Taxa de Conclusão</p>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-5 h-5 text-green-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Concluídas</span>
                  </div>
                  <span className="font-bold text-gray-900 dark:text-white">{completedTasks}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Pendentes</span>
                  </div>
                  <span className="font-bold text-gray-900 dark:text-white">{pendingTasks}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-5 h-5 text-blue-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Total</span>
                  </div>
                  <span className="font-bold text-gray-900 dark:text-white">{tasks.length}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Melhor mês</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                    {wonCards > 0 ? `${wonCards} conversões` : 'Sem dados'}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Ticket médio</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                    {wonCards > 0 ? formatCurrency(wonValue / wonCards) : formatCurrency(0)}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Relatório por vendedor (administrador) */}
          {canFilterBySalesperson && viewMode === 'by_salesperson' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="glass-card overflow-hidden"
            >
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Table2 className="w-5 h-5 text-emerald-500" />
                  Desempenho por vendedor
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Visão consolidada por responsável (administrador)
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Vendedor
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Total leads
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Ganhos
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Perdidos
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Em andamento
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Valor ganho
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Taxa conversão
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {bySalesperson.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                          Nenhum dado por vendedor neste período.
                        </td>
                      </tr>
                    ) : (
                      bySalesperson.map((row: any) => (
                        <tr key={row.user_id || 'unassigned'} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-6 py-4">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {row.user_name}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right text-sm text-gray-900 dark:text-white">
                            {row.total_cards}
                          </td>
                          <td className="px-6 py-4 text-right text-sm text-green-600 dark:text-green-400">
                            {row.won_cards}
                          </td>
                          <td className="px-6 py-4 text-right text-sm text-red-600 dark:text-red-400">
                            {row.lost_cards}
                          </td>
                          <td className="px-6 py-4 text-right text-sm text-gray-900 dark:text-white">
                            {row.in_progress_cards}
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-medium text-gray-900 dark:text-white">
                            {formatCurrency(row.won_value)}
                          </td>
                          <td className="px-6 py-4 text-right text-sm text-gray-900 dark:text-white">
                            {row.conversion_rate}%
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* Stage Details Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="glass-card overflow-hidden"
          >
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Detalhamento por Etapa
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Etapa
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Leads
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Valor Total
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      % do Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {stageDistribution.map((stage: any) => (
                    <tr key={stage.name} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: stage.color }}
                          />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {stage.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-900 dark:text-white">
                        {stage.value}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-900 dark:text-white">
                        {formatCurrency(stage.total)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-900 dark:text-white">
                        {totalCards > 0 ? Math.round((stage.value / totalCards) * 100) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      )}
    </div>
  )
}
