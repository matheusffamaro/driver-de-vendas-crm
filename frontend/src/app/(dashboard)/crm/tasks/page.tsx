'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Calendar,
  Clock,
  User,
  CheckCircle2,
  Circle,
  AlertCircle,
  X,
  ChevronDown,
  Paperclip,
  Trash2
} from 'lucide-react'
import { crmTasksApi, usersApi, clientsApi, pipelineApi } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { format, parseISO, isToday, isPast } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Task {
  id: string
  title: string
  description: string | null
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high'
  scheduled_at: string | null
  completed_at: string | null
  contact: { id: string; name: string; phone: string } | null
  assigned_to: { id: string; name: string } | null  // Laravel serializes as snake_case
  card: { id: string; title: string; value: number; contact?: { id: string; name: string } } | null
  attachments: any[]
  created_at: string
}

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  completed: 'Concluído',
  cancelled: 'Cancelado',
}

const statusColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

export default function TasksPage() {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [scheduledFrom, setScheduledFrom] = useState('')
  const [myTasksOnly, setMyTasksOnly] = useState(false)
  const [showNewTaskModal, setShowNewTaskModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  // Fetch tasks
  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['crm-tasks', searchTerm, statusFilter, scheduledFrom, myTasksOnly],
    queryFn: () => crmTasksApi.list({
      search: searchTerm || undefined,
      status: statusFilter || undefined,
      scheduled_from: scheduledFrom || undefined,
      my_tasks: myTasksOnly || undefined,
      per_page: 50,
    }),
  })

  const tasks: Task[] = tasksData?.data?.data || []
  const summary = tasksData?.data?.summary || { total: 0, todo: 0, in_progress: 0, done: 0, overdue: 0 }
  const todayTasks = tasks.filter((task) => task.scheduled_at && isToday(parseISO(task.scheduled_at)))

  // Fetch users for assignment
  const { data: usersData } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => usersApi.list({ per_page: 100 }),
  })
  const users = usersData?.data?.data || []

  // Fetch clients
  const { data: clientsData } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () => clientsApi.list({ per_page: 100 }),
  })
  const clients = clientsData?.data?.data || []

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: (data: any) => crmTasksApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-tasks'] })
      setShowNewTaskModal(false)
    },
  })

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => crmTasksApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-tasks'] })
      setSelectedTask(null)
    },
    onError: (error: any) => {
      console.error('Error updating task:', error)
      toast.error('Erro ao atualizar tarefa', error?.response?.data?.message || error.message)
    },
  })

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: (id: string) => crmTasksApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-tasks'] })
      setSelectedTask(null)
    },
  })

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    try {
      const date = parseISO(dateString)
      return format(date, "dd 'de' MMMM, HH:mm", { locale: ptBR })
    } catch {
      return dateString
    }
  }

  const isOverdue = (task: Task) => {
    if (!task.scheduled_at || task.status === 'completed' || task.status === 'cancelled') return false
    return isPast(parseISO(task.scheduled_at))
  }

  const renderTasksTable = (rows: Task[], emptyLabel: string) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Contato
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Título
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Descrição
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Atribuído a
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Agendado para
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {isLoading ? (
            <tr>
              <td colSpan={7} className="px-6 py-12 text-center">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500" />
                </div>
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((task) => (
              <tr
                key={task.id}
                onClick={() => setSelectedTask(task)}
                className={`hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors ${
                  isOverdue(task) ? 'bg-red-50 dark:bg-red-900/20' : ''
                }`}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {task.contact?.name || task.card?.contact?.name || '-'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm font-medium text-gray-800 dark:text-white">{task.title}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                    {task.description || '-'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {task.assigned_to ? (
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                          {task.assigned_to.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </span>
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-300">{task.assigned_to.name}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`text-sm ${isOverdue(task) ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-600 dark:text-gray-300'}`}>
                    {formatDate(task.scheduled_at)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-3 py-1 text-xs font-medium rounded-full ${statusColors[task.status]}`}>
                    {statusLabels[task.status]}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                    <ChevronDown className="h-4 w-4 rotate-[-90deg]" />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Tarefas</h1>
        <button
          onClick={() => setShowNewTaskModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Tarefa
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">Filtrar por status</option>
          <option value="pending">Pendente</option>
          <option value="in_progress">Em andamento</option>
          <option value="completed">Concluído</option>
          <option value="cancelled">Cancelado</option>
        </select>

        <input
          type="date"
          value={scheduledFrom}
          onChange={(e) => setScheduledFrom(e.target.value)}
          placeholder="Agendado para"
          className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />

        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['crm-tasks'] })}
          className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 transition-colors"
        >
          Buscar
        </button>

        <button
          onClick={() => setMyTasksOnly(!myTasksOnly)}
          className={`px-4 py-2 border rounded-lg transition-colors ${
            myTasksOnly ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 text-emerald-700 dark:text-emerald-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600'
          }`}
        >
          Minhas tarefas
        </button>

        <button className="p-2 text-gray-400 hover:text-gray-600">
          <MoreVertical className="h-5 w-5" />
        </button>
      </div>

      {/* Today's Tasks Table */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">Tarefas de hoje</h2>
        {renderTasksTable(todayTasks, 'Nenhuma tarefa para hoje')}
      </div>

      {/* All Tasks Table */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">Todas as tarefas</h2>
        {renderTasksTable(tasks, 'Nenhuma tarefa encontrada')}
      </div>

      {/* New Task Modal */}
      <AnimatePresence>
        {showNewTaskModal && (
          <TaskModal
            users={users}
            clients={clients}
            onClose={() => setShowNewTaskModal(false)}
            onSave={(data) => createTaskMutation.mutate(data)}
            isLoading={createTaskMutation.isPending}
          />
        )}
      </AnimatePresence>

      {/* Task Detail Modal */}
      <AnimatePresence>
        {selectedTask && (
          <TaskDetailModal
            task={selectedTask}
            users={users}
            onClose={() => setSelectedTask(null)}
            onUpdate={(data) => updateTaskMutation.mutate({ id: selectedTask.id, data })}
            onDelete={() => {
              if (confirm('Tem certeza que deseja excluir esta tarefa?')) {
                deleteTaskMutation.mutate(selectedTask.id)
              }
            }}
            isLoading={updateTaskMutation.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// Task Modal Component
function TaskModal({
  users,
  clients,
  onClose,
  onSave,
  isLoading,
}: {
  users: any[]
  clients: any[]
  onClose: () => void
  onSave: (data: any) => void
  isLoading: boolean
}) {
  const [formData, setFormData] = useState({
    title: '',
    status: 'pending',
    assigned_to: '',
    card_id: '',
    scheduled_at: '',
    description: '',
  })

  const { data: pipelinesData } = useQuery({
    queryKey: ['pipelines'],
    queryFn: () => pipelineApi.list(),
  })
  const pipelines = pipelinesData?.data?.data || []

  const { data: cardsData } = useQuery({
    queryKey: ['pipeline-cards-all', pipelines.map((p: any) => p.id).join(',')],
    queryFn: async () => {
      const results = await Promise.all(
        pipelines.map((pipeline: any) =>
          pipelineApi.cards.listView(pipeline.id, { per_page: 200 })
            .then((res) => (res.data?.data || []).map((card: any) => ({
              ...card,
              pipeline_name: pipeline.name,
            })))
        )
      )
      return results.flat()
    },
    enabled: pipelines.length > 0,
  })
  const availableCards = cardsData || []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      ...formData,
      assigned_to: formData.assigned_to || null,
      card_id: formData.card_id || null,
      scheduled_at: formData.scheduled_at || null,
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: -20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: -20 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Novo(a) Tarefa</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">* Título</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">* Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="pending">Pendente</option>
                <option value="in_progress">Em andamento</option>
                <option value="completed">Concluído</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Atribuído a</label>
            <select
              value={formData.assigned_to}
              onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Selecione...</option>
              {users.map((user: any) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Oportunidade</label>
            <select
              value={formData.card_id}
              onChange={(e) => setFormData({ ...formData, card_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Sem oportunidade</option>
              {availableCards.map((card: any) => (
                <option key={card.id} value={card.id}>
                  {card.title}{card.pipeline_name ? ` • ${card.pipeline_name}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Agendado para</label>
            <input
              type="datetime-local"
              value={formData.scheduled_at}
              onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Descrição</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || !formData.title}
              className="px-4 py-2 bg-gray-800 dark:bg-gray-600 text-white rounded-lg hover:bg-gray-900 dark:hover:bg-gray-500 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
              <Plus className="h-4 w-4" />
              Tarefa
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// Task Detail Modal Component
function TaskDetailModal({
  task,
  users,
  onClose,
  onUpdate,
  onDelete,
  isLoading,
}: {
  task: Task
  users: any[]
  onClose: () => void
  onUpdate: (data: any) => void
  onDelete: () => void
  isLoading: boolean
}) {
  const [activeTab, setActiveTab] = useState<'geral' | 'timeline'>('geral')
  const [formData, setFormData] = useState({
    title: task.title,
    status: task.status,
    assigned_to: task.assigned_to?.id || '',
    card_id: task.card?.id || '',
    scheduled_at: task.scheduled_at ? task.scheduled_at.replace(' ', 'T').slice(0, 16) : '',
    description: task.description || '',
  })

  const { data: pipelinesData } = useQuery({
    queryKey: ['pipelines'],
    queryFn: () => pipelineApi.list(),
  })
  const pipelines = pipelinesData?.data?.data || []

  const { data: cardsData } = useQuery({
    queryKey: ['pipeline-cards-all', pipelines.map((p: any) => p.id).join(',')],
    queryFn: async () => {
      const results = await Promise.all(
        pipelines.map((pipeline: any) =>
          pipelineApi.cards.listView(pipeline.id, { per_page: 200 })
            .then((res) => (res.data?.data || []).map((card: any) => ({
              ...card,
              pipeline_name: pipeline.name,
            })))
        )
      )
      return results.flat()
    },
    enabled: pipelines.length > 0,
  })
  const availableCards = cardsData || []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onUpdate({
      ...formData,
      assigned_to: formData.assigned_to || null,
      card_id: formData.card_id || null,
      scheduled_at: formData.scheduled_at || null,
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-10 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: -20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: -20 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-3xl mx-4 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('geral')}
              className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
                activeTab === 'geral' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 dark:text-gray-400'
              }`}
            >
              Geral
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
                activeTab === 'timeline' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 dark:text-gray-400'
              }`}
            >
              Linha do tempo
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <span className="text-sm font-medium text-emerald-700">
                {task.assigned_to?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
              </span>
            </div>
            <button 
              onClick={onDelete}
              className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
            >
              Arquivar
            </button>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
              <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex">
          {/* Main Content */}
          <form onSubmit={handleSubmit} className="flex-1 p-6">
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-700 dark:text-gray-200">Informações Gerais</h3>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">* Título</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">* Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as Task['status'] })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="pending">Pendente</option>
                    <option value="in_progress">Em andamento</option>
                    <option value="completed">Concluído</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Agendado para</label>
                  <input
                    type="datetime-local"
                    value={formData.scheduled_at}
                    onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Descrição</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              <button 
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 bg-gray-800 dark:bg-gray-600 text-white rounded-lg hover:bg-gray-900 dark:hover:bg-gray-500 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Salvando...' : 'Atualizar Tarefa'}
              </button>
            </div>
          </form>

          {/* Sidebar */}
          <div className="w-64 border-l border-gray-200 dark:border-gray-700 p-4 space-y-4">
            <div>
              <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">Atribuição</label>
              <select
                value={formData.assigned_to}
                onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Sem atribuição</option>
                {users.map((user: any) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">Oportunidade</label>
              <select
                value={formData.card_id}
                onChange={(e) => setFormData({ ...formData, card_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Sem oportunidade</option>
                {availableCards.map((card: any) => (
                  <option key={card.id} value={card.id}>
                    {card.title}{card.pipeline_name ? ` • ${card.pipeline_name}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">Ações</label>
              <button className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg w-full text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                <Paperclip className="h-4 w-4" />
                Anexar
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
