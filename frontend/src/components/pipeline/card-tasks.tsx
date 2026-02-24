'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Check,
  X,
  Plus,
  Calendar,
  User,
  AlertCircle,
  Clock,
  ChevronDown,
  Link as LinkIcon,
  Zap,
} from 'lucide-react'
import { format, isToday, isTomorrow, isPast, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Task {
  id: string
  title: string
  description?: string
  status: 'pending' | 'completed'
  scheduled_at?: string
  assigned_to?: { id: string; name: string }
}

interface CardTasksProps {
  tasks: Task[]
  onComplete: (taskId: string) => void
  onCreate: (task: Partial<Task>) => void
  onUnlink: (taskId: string) => void
  onLink?: (taskId: string) => void
  users: Array<{ id: string; name: string }>
  isLoading?: boolean
  showHeader?: boolean
}

export function CardTasks({
  tasks,
  onComplete,
  onCreate,
  onUnlink,
  onLink,
  users,
  isLoading = false,
  showHeader = true,
}: CardTasksProps) {
  const [showCompleted, setShowCompleted] = useState(false)
  const [quickTaskTitle, setQuickTaskTitle] = useState('')
  const [showFullForm, setShowFullForm] = useState(false)
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    scheduled_at: '',
    assigned_to: '',
  })

  const pendingTasks = tasks.filter(t => t.status !== 'completed')
  const completedTasks = tasks.filter(t => t.status === 'completed')

  const getTaskUrgency = (task: Task): 'overdue' | 'today' | 'tomorrow' | 'upcoming' | null => {
    if (!task.scheduled_at) return null
    const date = new Date(task.scheduled_at)
    if (isPast(date) && !isToday(date)) return 'overdue'
    if (isToday(date)) return 'today'
    if (isTomorrow(date)) return 'tomorrow'
    return 'upcoming'
  }

  const getUrgencyBadge = (urgency: ReturnType<typeof getTaskUrgency>) => {
    switch (urgency) {
      case 'overdue':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-medium rounded-full">
            <AlertCircle className="w-3 h-3" />
            Atrasada
          </span>
        )
      case 'today':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs font-medium rounded-full">
            <Clock className="w-3 h-3" />
            Hoje
          </span>
        )
      case 'tomorrow':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium rounded-full">
            <Calendar className="w-3 h-3" />
            Amanhã
          </span>
        )
      default:
        return null
    }
  }

  const handleQuickCreate = () => {
    if (quickTaskTitle.trim()) {
      onCreate({ title: quickTaskTitle.trim() })
      setQuickTaskTitle('')
    }
  }

  const handleFullCreate = () => {
    if (newTask.title.trim()) {
      const taskData: Partial<Task> = {
        title: newTask.title,
        description: newTask.description || undefined,
        scheduled_at: newTask.scheduled_at || undefined,
      }
      if (newTask.assigned_to) {
        const user = users.find(u => u.id === newTask.assigned_to)
        if (user) taskData.assigned_to = user
      }
      onCreate(taskData)
      setNewTask({ title: '', description: '', scheduled_at: '', assigned_to: '' })
      setShowFullForm(false)
    }
  }

  const TaskItem = ({ task }: { task: Task }) => {
    const urgency = getTaskUrgency(task)
    const isCompleted = task.status === 'completed'

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className={`group flex items-start gap-3 p-3 rounded-lg border transition-all ${
          isCompleted
            ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
            : urgency === 'overdue'
            ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800 hover:border-red-300'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-700'
        }`}
      >
        {/* Checkbox */}
        <button
          onClick={() => onComplete(task.id)}
          disabled={isCompleted}
          className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
            isCompleted
              ? 'bg-emerald-500 border-emerald-500 text-white'
              : urgency === 'overdue'
              ? 'border-red-400 hover:border-red-500 hover:bg-red-50'
              : 'border-gray-300 dark:border-gray-600 hover:border-emerald-400 hover:bg-emerald-50'
          }`}
        >
          {isCompleted && <Check className="w-3 h-3" />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 mb-1">
            <p className={`text-sm font-medium flex-1 ${isCompleted ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
              {task.title}
            </p>
            {!isCompleted && urgency && getUrgencyBadge(urgency)}
          </div>

          {task.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{task.description}</p>
          )}

          <div className="flex items-center gap-3 text-xs">
            {task.scheduled_at && (
              <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                <Calendar className="w-3 h-3" />
                {format(new Date(task.scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
              </div>
            )}
            {task.assigned_to && (
              <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center text-xs font-medium">
                  {task.assigned_to.name.charAt(0)}
                </div>
                <span>{task.assigned_to.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <button
          onClick={() => onUnlink(task.id)}
          className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
          title="Desvincular tarefa"
        >
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-white">Tarefas</h3>
            {pendingTasks.length > 0 && (
              <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium rounded-full">
                {pendingTasks.length}
              </span>
            )}
          </div>
          {onLink && (
            <button
              onClick={() => {}}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              <LinkIcon className="w-3 h-3" />
              Vincular existente
            </button>
          )}
        </div>
      )}

      {/* Quick Add */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={quickTaskTitle}
          onChange={(e) => setQuickTaskTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleQuickCreate()
          }}
          placeholder="Criar tarefa rápida..."
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-colors"
        />
        <button
          onClick={handleQuickCreate}
          disabled={!quickTaskTitle.trim()}
          className="p-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white disabled:text-gray-500 rounded-lg transition-colors"
          title="Criar tarefa"
        >
          <Zap className="w-4 h-4" />
        </button>
        <button
          onClick={() => setShowFullForm(!showFullForm)}
          className={`p-2 rounded-lg transition-colors ${
            showFullForm
              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
          title="Formulário completo"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Full Form */}
      <AnimatePresence>
        {showFullForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800 space-y-3">
              <input
                type="text"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Título da tarefa *"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
              />
              <textarea
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="Descrição (opcional)"
                rows={2}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 resize-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="datetime-local"
                  value={newTask.scheduled_at}
                  onChange={(e) => setNewTask({ ...newTask, scheduled_at: e.target.value })}
                  className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                />
                <select
                  value={newTask.assigned_to}
                  onChange={(e) => setNewTask({ ...newTask, assigned_to: e.target.value })}
                  className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                >
                  <option value="">Atribuir a...</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowFullForm(false)
                    setNewTask({ title: '', description: '', scheduled_at: '', assigned_to: '' })
                  }}
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleFullCreate}
                  disabled={!newTask.title.trim() || isLoading}
                  className="px-3 py-1.5 text-sm bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white disabled:text-gray-500 rounded-lg transition-colors"
                >
                  {isLoading ? 'Criando...' : 'Criar Tarefa'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tasks List */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {pendingTasks.map((task) => (
            <TaskItem key={task.id} task={task} />
          ))}
        </AnimatePresence>
      </div>

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <div>
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${showCompleted ? '' : '-rotate-90'}`} />
            <span>
              Concluídas ({completedTasks.length})
            </span>
          </button>
          <AnimatePresence>
            {showCompleted && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 space-y-2"
              >
                {completedTasks.map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Empty State */}
      {tasks.length === 0 && (
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 mb-3">
            <Check className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma tarefa vinculada</p>
          <p className="text-xs text-gray-400 mt-1">Crie sua primeira tarefa acima</p>
        </div>
      )}
    </div>
  )
}
