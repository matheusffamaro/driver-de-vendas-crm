'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  Users,
  Package,
  Kanban,
  CheckSquare,
  MessageCircle,
  ArrowRight,
} from 'lucide-react'
import { ModernBarChart, ModernDonutChart } from '@/components/ui/charts'
import { pipelineApi, clientsApi, productsApi, crmTasksApi } from '@/lib/api'
import { TrialBanner } from '@/components/trial-banner'

export default function DashboardPage() {
  const router = useRouter()

  // Fetch pipelines data
  const { data: pipelinesData } = useQuery({
    queryKey: ['pipelines-dashboard'],
    queryFn: () => pipelineApi.list(),
  })

  // Fetch clients count
  const { data: clientsData } = useQuery({
    queryKey: ['clients-dashboard'],
    queryFn: () => clientsApi.list({ per_page: 1 }),
  })

  // Fetch products count
  const { data: productsData } = useQuery({
    queryKey: ['products-dashboard'],
    queryFn: () => productsApi.list({ per_page: 1 }),
  })

  // Fetch tasks
  const { data: tasksData } = useQuery({
    queryKey: ['tasks-dashboard'],
    queryFn: () => crmTasksApi.list({ per_page: 100 }),
  })

  const pipelines = pipelinesData?.data?.data || []
  const defaultPipeline = pipelines[0]
  const stages = defaultPipeline?.stages || []
  
  // Calculate pipeline metrics
  const totalCards = defaultPipeline?.cards_count || 0
  const wonStage = stages.find((s: any) => s.is_won)
  const lostStage = stages.find((s: any) => s.is_lost)
  
  // Tasks metrics
  const tasks = tasksData?.data?.data || []
  const pendingTasks = tasks.filter((t: any) => t.status === 'pending').length
  const inProgressTasks = tasks.filter((t: any) => t.status === 'in_progress').length
  const completedTasks = tasks.filter((t: any) => t.status === 'completed').length
  const overdueTasks = tasks.filter((t: any) => {
    if (!['pending', 'in_progress'].includes(t.status) || !t.scheduled_at) return false
    return new Date(t.scheduled_at) < new Date()
  }).length

  // Client and product counts
  const totalClients = clientsData?.data?.meta?.total || 0
  const totalProducts = productsData?.data?.meta?.total || 0

  // Stage distribution for chart
  const stageData = stages
    .filter((s: any) => !s.is_won && !s.is_lost)
    .map((stage: any) => ({
      name: stage.name,
      cards: stage.cards_count || stage.cards?.length || 0,
      color: stage.color,
    }))

  // Pie chart data for tasks
  const tasksPieData = [
    { name: 'Pendentes', value: pendingTasks, color: '#F59E0B' },
    { name: 'Em andamento', value: inProgressTasks, color: '#3B82F6' },
    { name: 'Concluídas', value: completedTasks, color: '#22C55E' },
    { name: 'Atrasadas', value: overdueTasks, color: '#EF4444' },
  ].filter(d => d.value > 0)

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  }

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-display">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Visão geral do seu CRM</p>
      </div>

      {/* Trial Banner */}
      <TrialBanner />

      {/* KPI Cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {/* Leads no Funil */}
        <motion.div 
          variants={item} 
          className="stat-card cursor-pointer hover:scale-[1.02] transition-transform"
          onClick={() => router.push('/crm/pipeline')}
        >
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Kanban className="w-6 h-6 text-purple-500" />
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Leads no Funil</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{totalCards}</p>
          </div>
        </motion.div>

        {/* Clientes */}
        <motion.div 
          variants={item} 
          className="stat-card cursor-pointer hover:scale-[1.02] transition-transform"
          onClick={() => router.push('/clients')}
        >
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-500" />
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Clientes</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{totalClients}</p>
          </div>
        </motion.div>

        {/* Produtos */}
        <motion.div 
          variants={item} 
          className="stat-card cursor-pointer hover:scale-[1.02] transition-transform"
          onClick={() => router.push('/products')}
        >
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Package className="w-6 h-6 text-emerald-500" />
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Produtos</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{totalProducts}</p>
          </div>
        </motion.div>

        {/* Tarefas Pendentes */}
        <motion.div 
          variants={item} 
          className="stat-card cursor-pointer hover:scale-[1.02] transition-transform"
          onClick={() => router.push('/crm/tasks')}
        >
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <CheckSquare className="w-6 h-6 text-amber-500" />
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Tarefas Pendentes</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {pendingTasks + inProgressTasks}
              {overdueTasks > 0 && (
                <span className="text-sm text-red-500 ml-2">({overdueTasks} atrasadas)</span>
              )}
            </p>
          </div>
        </motion.div>
      </motion.div>

      {/* Quick Stats - Pipeline Stages */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4"
      >
        {stages.map((stage: any) => (
          <motion.div 
            key={stage.id} 
            variants={item} 
            className="stat-card text-center"
          >
            <div 
              className="w-3 h-3 rounded-full mx-auto mb-2"
              style={{ backgroundColor: stage.color }}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{stage.name}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
              {stage.cards_count || stage.cards?.length || 0}
            </p>
          </motion.div>
        ))}
      </motion.div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Distribution Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6"
        >
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Distribuição do Funil</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Leads por etapa</p>
          </div>

          <ModernBarChart
            data={stageData}
            dataKey="cards"
            barName="cards"
            layout="vertical"
            height={256}
            emptyState={
              <div className="text-center">
                <Kanban className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 dark:text-gray-400">Nenhum lead no funil</p>
                <button
                  onClick={() => router.push('/crm/pipeline')}
                  className="btn-primary mt-4"
                >
                  Ir para Funil
                </button>
              </div>
            }
          />
        </motion.div>

        {/* Tasks Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-6"
        >
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Status das Tarefas</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Distribuição por status</p>
          </div>

          <ModernDonutChart
            data={tasksPieData}
            height={192}
            centerValue={pendingTasks + inProgressTasks + completedTasks + overdueTasks}
            centerLabel="Total"
            emptyState={
              <div className="text-center">
                <CheckSquare className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 dark:text-gray-400">Nenhuma tarefa</p>
              </div>
            }
          />
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glass-card p-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Ações Rápidas</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <button
            onClick={() => router.push('/crm/pipeline')}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
          >
            <Kanban className="w-8 h-8 text-purple-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Novo Lead</span>
          </button>
          
          <button
            onClick={() => router.push('/clients')}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
          >
            <Users className="w-8 h-8 text-blue-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Novo Cliente</span>
          </button>
          
          <button
            onClick={() => router.push('/crm/tasks')}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
          >
            <CheckSquare className="w-8 h-8 text-amber-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Nova Tarefa</span>
          </button>
          
          <button
            onClick={() => router.push('/crm/whatsapp')}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-green-500/10 hover:bg-green-500/20 transition-colors"
          >
            <MessageCircle className="w-8 h-8 text-green-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">WhatsApp</span>
          </button>
        </div>
      </motion.div>
    </div>
  )
}
