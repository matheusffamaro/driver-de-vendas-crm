'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Plus,
  Filter,
  Save,
  Trash2,
  Star,
  StarOff,
  ChevronDown,
  Calendar,
  DollarSign,
  User,
  Tag,
  Clock,
  Sparkles,
  Search,
} from 'lucide-react'
import { FilterBuilder, FilterGroup } from './filter-builder'
import { SavedFilters } from './saved-filters'
import { toast } from '@/hooks/use-toast'

interface AdvancedFiltersProps {
  isOpen: boolean
  onClose: () => void
  onApplyFilters: (filters: FilterGroup) => void
  currentFilters?: FilterGroup
  customFields: any[]
  onSaveFilter?: (name: string, filters: FilterGroup) => Promise<void>
  onLoadFilter?: (filterId: string) => void
  onDeleteFilter?: (filterId: string) => Promise<void>
  savedFilters?: Array<{ id: string; name: string; filters: FilterGroup; is_favorite: boolean }>
}

export function AdvancedFilters({
  isOpen,
  onClose,
  onApplyFilters,
  currentFilters,
  customFields,
  onSaveFilter,
  onLoadFilter,
  onDeleteFilter,
  savedFilters = [],
}: AdvancedFiltersProps) {
  const [filters, setFilters] = useState<FilterGroup>(
    currentFilters || {
      operator: 'AND',
      conditions: [],
    }
  )
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [filterName, setFilterName] = useState('')
  const [activeTab, setActiveTab] = useState<'builder' | 'saved'>('builder')

  useEffect(() => {
    if (currentFilters) {
      setFilters(currentFilters)
    }
  }, [currentFilters])

  const handleApply = () => {
    onApplyFilters(filters)
    onClose()
    toast.success('Filtros aplicados!', 'Os cards foram filtrados')
  }

  const handleClear = () => {
    setFilters({ operator: 'AND', conditions: [] })
  }

  const handleSave = async () => {
    if (!filterName.trim()) {
      toast.error('Nome obrigatório', 'Digite um nome para o filtro')
      return
    }
    if (onSaveFilter) {
      await onSaveFilter(filterName, filters)
      setShowSaveDialog(false)
      setFilterName('')
      toast.success('Filtro salvo!', `"${filterName}" foi salvo com sucesso`)
    }
  }

  const handleLoadFilter = (filterId: string) => {
    const saved = savedFilters.find(f => f.id === filterId)
    if (saved) {
      setFilters(saved.filters)
      setActiveTab('builder')
      toast.success('Filtro carregado!', `"${saved.name}" foi aplicado`)
    }
    if (onLoadFilter) {
      onLoadFilter(filterId)
    }
  }

  const quickFilters = [
    {
      icon: Clock,
      label: 'Criados Hoje',
      color: 'blue',
      filter: {
        operator: 'AND' as const,
        conditions: [
          {
            field: 'created_at',
            operator: 'is_today' as const,
            value: null,
          },
        ],
      },
    },
    {
      icon: DollarSign,
      label: 'Alto Valor (>R$10k)',
      color: 'emerald',
      filter: {
        operator: 'AND' as const,
        conditions: [
          {
            field: 'value',
            operator: 'greater_than' as const,
            value: 10000,
          },
        ],
      },
    },
    {
      icon: User,
      label: 'Sem Atribuição',
      color: 'orange',
      filter: {
        operator: 'AND' as const,
        conditions: [
          {
            field: 'assigned_to',
            operator: 'is_empty' as const,
            value: null,
          },
        ],
      },
    },
    {
      icon: Tag,
      label: 'Alta Prioridade',
      color: 'red',
      filter: {
        operator: 'AND' as const,
        conditions: [
          {
            field: 'priority',
            operator: 'equals' as const,
            value: 'high',
          },
        ],
      },
    },
  ]

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full md:w-[600px] lg:w-[700px] bg-white dark:bg-gray-800 shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Filter className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Filtros Avançados</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Personalize sua busca com múltiplos critérios</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <button
                onClick={() => setActiveTab('builder')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'builder'
                    ? 'bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Construtor
              </button>
              <button
                onClick={() => setActiveTab('saved')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'saved'
                    ? 'bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Salvos ({savedFilters.length})
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {activeTab === 'builder' ? (
                <>
                  {/* Quick Filters */}
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-yellow-500" />
                      Filtros Rápidos
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {quickFilters.map((quick) => {
                        const Icon = quick.icon
                        return (
                          <button
                            key={quick.label}
                            onClick={() => setFilters(quick.filter)}
                            className={`p-3 rounded-lg border-2 text-left transition-all hover:scale-[1.02] ${
                              quick.color === 'blue' && 'border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                            } ${
                              quick.color === 'emerald' && 'border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                            } ${
                              quick.color === 'orange' && 'border-orange-200 dark:border-orange-800 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                            } ${
                              quick.color === 'red' && 'border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Icon className={`w-4 h-4 text-${quick.color}-600`} />
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{quick.label}</span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Filter Builder */}
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Construir Filtro</h3>
                    <FilterBuilder filters={filters} onChange={setFilters} customFields={customFields} />
                  </div>
                </>
              ) : (
                <SavedFilters
                  filters={savedFilters}
                  onLoad={handleLoadFilter}
                  onDelete={onDeleteFilter}
                />
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <div className="flex items-center gap-2">
                {filters.conditions.length > 0 && (
                  <>
                    <button
                      onClick={handleClear}
                      className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      Limpar
                    </button>
                    <button
                      onClick={() => setShowSaveDialog(true)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      Salvar Filtro
                    </button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleApply}
                  disabled={filters.conditions.length === 0}
                  className="px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white disabled:text-gray-500 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <Filter className="w-4 h-4" />
                  Aplicar Filtros
                </button>
              </div>
            </div>
          </motion.div>

          {/* Save Dialog */}
          {showSaveDialog && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
              onClick={() => setShowSaveDialog(false)}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Salvar Filtro</h3>
                <input
                  type="text"
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  placeholder="Nome do filtro..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-4"
                  autoFocus
                />
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => setShowSaveDialog(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg"
                  >
                    Salvar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  )
}
