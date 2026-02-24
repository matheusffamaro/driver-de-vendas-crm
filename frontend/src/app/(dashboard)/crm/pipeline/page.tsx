'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Settings, 
  BarChart2, 
  List,
  LayoutGrid,
  Phone,
  Mail,
  DollarSign,
  User,
  Calendar,
  GripVertical,
  X,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Check,
  Clock,
  Sparkles,
  Link2,
  FileText,
  Download,
  Loader2,
  Archive,
  RotateCcw,
  Kanban
} from 'lucide-react'
import { pipelineApi, clientsApi, productsApi, usersApi, crmTasksApi, proposalsApi } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import Link from 'next/link'
import { CustomFieldsManager } from '@/components/pipeline/custom-fields-manager'
import { CustomFieldInput } from '@/components/pipeline/custom-field-input'
import { AdvancedFilters } from '@/components/pipeline/advanced-filters'
import { FilterGroup } from '@/components/pipeline/filter-builder'

interface Stage {
  id: string
  name: string
  color: string
  type: 'open' | 'won' | 'lost'
  position: number
  cards: Card[]
  cards_count: number
  total_value: number
}

interface Card {
  id: string
  title: string | null
  value: number
  priority: 'low' | 'medium' | 'high' | null
  observation: string | null
  contact: { id: string; name: string; phone: string; email: string } | null
  assigned_to: { id: string; name: string } | null  // Laravel relationship name
  stage: { id: string; name: string; color: string; type: string }
  products: any[]
  custom_fields: Record<string, any> | null
  created_at: string
}

interface Pipeline {
  id: string
  name: string
  stages: Stage[]
  totals: {
    cards: number
    value: number
  }
}

export default function PipelinePage() {
  const queryClient = useQueryClient()
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [searchTerm, setSearchTerm] = useState('')
  const [showSearchInput, setShowSearchInput] = useState(false)
  const [showNewCardModal, setShowNewCardModal] = useState(false)
  const [showArchivedModal, setShowArchivedModal] = useState(false)
  const [showCustomFieldsManager, setShowCustomFieldsManager] = useState(false)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null)
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [draggedCard, setDraggedCard] = useState<Card | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')
  const [activeFilters, setActiveFilters] = useState<FilterGroup | null>(null)
  const [savedFilters, setSavedFilters] = useState<Array<{ id: string; name: string; filters: FilterGroup; is_favorite: boolean }>>([])

  // Fetch pipelines
  const { data: pipelinesData, isLoading: loadingPipelines } = useQuery({
    queryKey: ['pipelines'],
    queryFn: () => pipelineApi.list({ active_only: true }),
  })

  const pipelines = pipelinesData?.data?.data || []

  // Auto-select first pipeline
  useEffect(() => {
    if (pipelines.length > 0 && !selectedPipelineId) {
      const defaultPipeline = pipelines.find((p: any) => p.is_default) || pipelines[0]
      setSelectedPipelineId(defaultPipeline.id)
    }
  }, [pipelines, selectedPipelineId])

  // Fetch pipeline cards
  const { data: pipelineData, isLoading: loadingCards, refetch: refetchCards } = useQuery({
    queryKey: ['pipeline-cards', selectedPipelineId, searchTerm],
    queryFn: () => pipelineApi.cards.list(selectedPipelineId!, { search: searchTerm || undefined }),
    enabled: !!selectedPipelineId,
  })

  // Fetch archived cards
  const { data: archivedData, refetch: refetchArchived } = useQuery({
    queryKey: ['archived-cards', selectedPipelineId],
    queryFn: () => pipelineApi.archived(selectedPipelineId!),
    enabled: !!selectedPipelineId && showArchivedModal,
  })
  const archivedCards = archivedData?.data?.data?.data || []

  const rawStages: Stage[] = pipelineData?.data?.data?.stages || []
  const totals = pipelineData?.data?.data?.totals || { cards: 0, value: 0 }
  const selectedPipeline = pipelines.find((p: any) => p.id === selectedPipelineId)
  const customFields = selectedPipeline?.custom_fields || []

  // Apply search to cards
  const applySearchToCard = (card: Card): boolean => {
    if (!searchTerm.trim()) return true
    
    const search = searchTerm.toLowerCase()
    
    // Search in title
    if (card.title?.toLowerCase().includes(search)) return true
    
    // Search in contact name
    if (card.contact?.name?.toLowerCase().includes(search)) return true
    
    // Search in contact email
    if (card.contact?.email?.toLowerCase().includes(search)) return true
    
    // Search in contact phone
    if (card.contact?.phone?.toLowerCase().includes(search)) return true
    
    // Search in observation
    if (card.observation?.toLowerCase().includes(search)) return true
    
    // Search in value (formatted)
    if (card.value && String(card.value).includes(search)) return true
    
    // Search in custom fields
    if (card.custom_fields) {
      const customValues = Object.values(card.custom_fields).join(' ').toLowerCase()
      if (customValues.includes(search)) return true
    }
    
    return false
  }

  // Apply filters to cards
  const applyFiltersToCard = (card: Card): boolean => {
    if (!activeFilters || activeFilters.conditions.length === 0) return true

    const checkCondition = (condition: any): boolean => {
      const { field, operator, value } = condition
      
      // Get field value from card
      let cardValue: any = null
      
      if (field.startsWith('custom.')) {
        const customKey = field.replace('custom.', '')
        cardValue = card.custom_fields?.[customKey]
      } else if (field === 'title') {
        cardValue = card.title
      } else if (field === 'value') {
        cardValue = card.value
      } else if (field === 'priority') {
        cardValue = card.priority
      } else if (field === 'assigned_to') {
        cardValue = card.assigned_to?.id
      } else if (field === 'contact') {
        cardValue = card.contact?.name
      } else if (field === 'stage') {
        cardValue = card.stage?.id
      } else if (field === 'created_at') {
        cardValue = new Date(card.created_at)
      } else if (field === 'updated_at') {
        cardValue = card.created_at // fallback
      }

      // Apply operator
      switch (operator) {
        case 'equals':
          return cardValue === value
        case 'not_equals':
          return cardValue !== value
        case 'contains':
          return String(cardValue || '').toLowerCase().includes(String(value || '').toLowerCase())
        case 'not_contains':
          return !String(cardValue || '').toLowerCase().includes(String(value || '').toLowerCase())
        case 'starts_with':
          return String(cardValue || '').toLowerCase().startsWith(String(value || '').toLowerCase())
        case 'ends_with':
          return String(cardValue || '').toLowerCase().endsWith(String(value || '').toLowerCase())
        case 'greater_than':
          return Number(cardValue) > Number(value)
        case 'less_than':
          return Number(cardValue) < Number(value)
        case 'greater_or_equal':
          return Number(cardValue) >= Number(value)
        case 'less_or_equal':
          return Number(cardValue) <= Number(value)
        case 'is_empty':
          return !cardValue || cardValue === '' || cardValue === null || cardValue === undefined
        case 'is_not_empty':
          return !!cardValue && cardValue !== '' && cardValue !== null && cardValue !== undefined
        case 'is_today':
          if (!cardValue) return false
          const today = new Date()
          const cardDate = new Date(cardValue)
          return cardDate.toDateString() === today.toDateString()
        case 'in':
          return Array.isArray(value) ? value.includes(cardValue) : false
        case 'not_in':
          return Array.isArray(value) ? !value.includes(cardValue) : true
        default:
          return true
      }
    }

    if (activeFilters.operator === 'AND') {
      return activeFilters.conditions.every(checkCondition)
    } else {
      return activeFilters.conditions.some(checkCondition)
    }
  }

  // Filter stages and cards (apply both search and filters)
  const stages: Stage[] = rawStages.map(stage => ({
    ...stage,
    cards: stage.cards.filter(card => applySearchToCard(card) && applyFiltersToCard(card))
  }))

  // Fetch clients for new card modal
  const { data: clientsData } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () => clientsApi.list({ per_page: 100 }),
  })
  const clients = clientsData?.data?.data || []

  // Fetch products for new card modal
  const { data: productsData } = useQuery({
    queryKey: ['products-list'],
    queryFn: () => productsApi.list({ per_page: 100, is_active: true }),
  })
  const products = productsData?.data?.data || []

  // Fetch users for assignment
  const { data: usersData } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => usersApi.list({ per_page: 100 }),
  })
  const users = usersData?.data?.data || []

  // Create card mutation
  const createCardMutation = useMutation({
    mutationFn: (data: any) => pipelineApi.cards.create(selectedPipelineId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-cards'] })
      setShowNewCardModal(false)
      setSelectedStageId(null)
    },
  })

  // Move card mutation
  const moveCardMutation = useMutation({
    mutationFn: ({ cardId, stageId, position }: { cardId: string; stageId: string; position?: number }) =>
      pipelineApi.cards.move(selectedPipelineId!, cardId, { stage_id: stageId, position }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-cards'] })
    },
  })

  // Unarchive card mutation
  const unarchiveCardMutation = useMutation({
    mutationFn: (cardId: string) => pipelineApi.cards.unarchive(selectedPipelineId!, cardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-cards'] })
      queryClient.invalidateQueries({ queryKey: ['archived-cards'] })
      toast.success('Card restaurado!')
    },
    onError: () => {
      toast.error('Erro ao restaurar card')
    },
  })

  // Update custom fields mutation
  const updateCustomFieldsMutation = useMutation({
    mutationFn: (fields: any[]) => pipelineApi.updateCustomFields(selectedPipelineId!, fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] })
      queryClient.invalidateQueries({ queryKey: ['pipeline-cards'] })
      toast.success('Campos customizados salvos!', 'As alterações foram aplicadas')
      setShowCustomFieldsManager(false)
    },
    onError: (error: any) => {
      console.error('Error updating custom fields:', error)
      const errorMessage = error?.response?.data?.message || 'Tente novamente'
      toast.error('Erro ao salvar campos', errorMessage)
    },
  })

  const handleSaveCustomFields = async (fields: any[]) => {
    await updateCustomFieldsMutation.mutateAsync(fields)
  }

  // Advanced Filters
  const handleApplyFilters = (filters: FilterGroup) => {
    setActiveFilters(filters)
    const count = filters.conditions.length
    if (count > 0) {
      toast.success('Filtros aplicados!', `${count} ${count === 1 ? 'condição ativa' : 'condições ativas'}`)
    }
  }

  const handleSaveFilter = async (name: string, filters: FilterGroup) => {
    const newFilter = {
      id: `filter-${Date.now()}`,
      name,
      filters,
      is_favorite: false,
    }
    setSavedFilters([...savedFilters, newFilter])
    // In a real implementation, save to backend/localStorage
    localStorage.setItem('pipeline-filters', JSON.stringify([...savedFilters, newFilter]))
  }

  const handleDeleteFilter = async (filterId: string) => {
    const updated = savedFilters.filter(f => f.id !== filterId)
    setSavedFilters(updated)
    localStorage.setItem('pipeline-filters', JSON.stringify(updated))
  }

  const handleLoadFilter = (filterId: string) => {
    const filter = savedFilters.find(f => f.id === filterId)
    if (filter) {
      setActiveFilters(filter.filters)
    }
  }

  // Load saved filters from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('pipeline-filters')
    if (saved) {
      try {
        setSavedFilters(JSON.parse(saved))
      } catch (e) {
        console.error('Failed to parse saved filters', e)
      }
    }
  }, [])

  // Close search input when search term is cleared
  useEffect(() => {
    if (!searchTerm && showSearchInput) {
      const timer = setTimeout(() => setShowSearchInput(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [searchTerm, showSearchInput])

  // Handle drag and drop
  const handleDragStart = (e: React.DragEvent, card: Card) => {
    setDraggedCard(card)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverStage(stageId)
  }

  const handleDragLeave = () => {
    setDragOverStage(null)
  }

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault()
    if (draggedCard && draggedCard.stage.id !== stageId) {
      moveCardMutation.mutate({ cardId: draggedCard.id, stageId })
    }
    setDraggedCard(null)
    setDragOverStage(null)
  }

  const handleDragEnd = () => {
    setDraggedCard(null)
    setDragOverStage(null)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  const getPriorityLabel = (priority: string | null) => {
    switch (priority) {
      case 'urgent': return 'Urgente'
      case 'high': return 'Alta'
      case 'medium': return 'Média'
      case 'low': return 'Baixa'
      default: return '-'
    }
  }

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-50'
      case 'high': return 'text-orange-600 bg-orange-50'
      case 'medium': return 'text-yellow-600 bg-yellow-50'
      case 'low': return 'text-blue-600 bg-blue-50'
      default: return 'text-gray-500'
    }
  }

  if (loadingPipelines) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    )
  }

  if (pipelines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <LayoutGrid className="h-16 w-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Nenhum funil de vendas</h2>
        <p className="text-gray-500 mb-4">Crie seu primeiro funil para começar a gerenciar suas oportunidades.</p>
        <Link
          href="/crm/pipeline/settings"
          className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
        >
          <Plus className="h-4 w-4 inline mr-2" />
          Criar Funil
        </Link>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col bg-white dark:bg-gray-900 -m-4 sm:-m-6 lg:-m-8">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center gap-3">
          {/* Filters */}
          <button
            onClick={() => setShowAdvancedFilters(true)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all relative ${
              activeFilters && activeFilters.conditions.length > 0
                ? 'bg-purple-500 text-white shadow-sm'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
            }`}
          >
            <Filter className="h-4 w-4" />
            <span>Filtros</span>
            {activeFilters && activeFilters.conditions.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs font-bold bg-white/20 rounded-full">
                {activeFilters.conditions.length}
              </span>
            )}
          </button>
          
          {/* Search */}
          {showSearchInput ? (
            <div className="relative flex items-center">
              <Search className="absolute left-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchTerm('')
                    setShowSearchInput(false)
                  }
                }}
                placeholder="Buscar..."
                className="pl-10 pr-8 py-2 w-56 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                autoFocus
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowSearchInput(true)}
              className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
            >
              <Search className="h-4 w-4" />
              <span>Buscar</span>
            </button>
          )}

          {/* Separator */}
          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700"></div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'kanban' 
                  ? 'bg-emerald-500 text-white shadow-sm' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'list' 
                  ? 'bg-emerald-500 text-white shadow-sm' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          {/* Separator */}
          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700"></div>

          {/* Sort */}
          <select 
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
          >
            <option value="created_at">Data de criação</option>
            <option value="value">Valor</option>
            <option value="updated_at">Última atualização</option>
          </select>
          
          <button
            onClick={() => setSortDir(sortDir === 'desc' ? 'asc' : 'desc')}
            className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
          >
            {sortDir === 'desc' ? 'Desc' : 'Asc'}
          </button>

          {/* Separator */}
          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700"></div>

          {/* Pipeline Selector - Show when multiple pipelines exist */}
          {pipelines.length > 1 && (
            <div className="flex items-center gap-2">
              <Kanban className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <select
                value={selectedPipelineId || ''}
                onChange={(e) => setSelectedPipelineId(e.target.value)}
                className="px-3 py-2 border border-purple-300 dark:border-purple-700 rounded-lg text-sm font-medium text-gray-900 dark:text-white bg-white dark:bg-gray-800 hover:bg-purple-50 dark:hover:bg-purple-900/20 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors cursor-pointer"
              >
                {pipelines.map((pipeline: any) => (
                  <option key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Separator */}
          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700"></div>

          {/* Report */}
          <Link
            href={`/crm/pipeline/report?id=${selectedPipelineId}`}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Relatório"
          >
            <BarChart2 className="h-4 w-4" />
          </Link>

          {/* Archived */}
          <button
            onClick={() => setShowArchivedModal(true)}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Arquivados"
          >
            <Archive className="h-4 w-4" />
          </button>

          {/* Settings */}
          <Link
            href={`/crm/pipeline/settings?id=${selectedPipelineId}`}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Configurar"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {/* Custom Fields */}
          <button
            onClick={() => setShowCustomFieldsManager(true)}
            className="flex items-center gap-2 px-3 py-2 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition-colors text-sm font-medium border border-purple-200 dark:border-purple-800"
          >
            <Sparkles className="h-4 w-4" />
            <span>Campos Customizados</span>
          </button>
          
          {/* Add Button */}
          <button
            onClick={() => {
              setSelectedStageId(stages[0]?.id || null)
              setShowNewCardModal(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors shadow-sm text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            <span>Adicionar</span>
          </button>
        </div>
      </div>

      {/* Search/Filter Info Banner */}
      {(searchTerm || (activeFilters && activeFilters.conditions.length > 0)) && (
        <div className="px-6 py-3 bg-blue-50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm">
              {searchTerm && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-800">
                  <Search className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="font-medium text-gray-900 dark:text-white">
                    "{searchTerm}"
                  </span>
                  <button
                    onClick={() => {
                      setSearchTerm('')
                      setShowSearchInput(false)
                    }}
                    className="ml-1 p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    <X className="w-3 h-3 text-gray-400" />
                  </button>
                </div>
              )}
              {activeFilters && activeFilters.conditions.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg border border-purple-200 dark:border-purple-800">
                  <Filter className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {activeFilters.conditions.length} {activeFilters.conditions.length === 1 ? 'filtro ativo' : 'filtros ativos'}
                  </span>
                  <button
                    onClick={() => setActiveFilters(null)}
                    className="ml-1 p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    <X className="w-3 h-3 text-gray-400" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <span>•</span>
                <span className="font-medium">
                  {stages.reduce((sum, stage) => sum + stage.cards.length, 0)} resultado{stages.reduce((sum, stage) => sum + stage.cards.length, 0) !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      {viewMode === 'kanban' && (
        <div className="flex-1 overflow-x-auto px-4 py-3 bg-gray-50/50 dark:bg-gray-900/50">
          <div className="flex h-full gap-4" style={{ minWidth: stages.length > 5 ? `${stages.length * 240}px` : '100%' }}>
            {stages.map((stage) => (
              <div
                key={stage.id}
                className={`flex-1 min-w-[180px] flex flex-col rounded-xl transition-colors ${
                  dragOverStage === stage.id ? 'bg-emerald-50 dark:bg-emerald-900/20 ring-2 ring-emerald-300' : 'bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700'
                }`}
                onDragOver={(e) => handleDragOver(e, stage.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                {/* Stage Header */}
                <div className="p-3 rounded-t-xl border-b border-gray-100 dark:border-gray-700 sticky top-0 z-10 bg-white dark:bg-gray-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: stage.color || '#10b981' }}
                      />
                      <h3 className="font-semibold text-gray-800 dark:text-white truncate">{stage.name}</h3>
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-full font-medium">
                        {stage.cards_count}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedStageId(stage.id)
                        setShowNewCardModal(true)
                      }}
                      className="p-1.5 text-emerald-500 hover:bg-emerald-100 rounded-lg transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-sm text-emerald-600 font-semibold mt-1">
                    {formatCurrency(stage.total_value)}
                  </p>
                </div>

                {/* Cards Container */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  <AnimatePresence mode="popLayout">
                    {stage.cards.map((card) => (
                      <motion.div
                        key={card.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        draggable
                        onDragStart={(e) => handleDragStart(e as any, card)}
                        onDragEnd={handleDragEnd}
                        onClick={() => setSelectedCard(card)}
                        className={`bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer hover:shadow-lg hover:border-emerald-200 dark:hover:border-emerald-500 transition-all group ${
                          draggedCard?.id === card.id ? 'opacity-50 rotate-1 scale-105 shadow-xl' : ''
                        }`}
                      >
                        {/* Contact Info */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Contato</p>
                            <p className="text-gray-800 font-medium truncate">
                              {card.contact?.name || card.contact?.phone || 'Sem contato'}
                            </p>
                            {card.contact?.phone && card.contact?.name && (
                              <p className="text-gray-500 text-xs mt-0.5">{card.contact.phone}</p>
                            )}
                          </div>
                          {card.priority && (
                            <span className={`text-xs px-2 py-1 rounded-lg font-medium whitespace-nowrap ${getPriorityColor(card.priority)}`}>
                              {getPriorityLabel(card.priority)}
                            </span>
                          )}
                        </div>

                        {/* Observation */}
                        {card.observation && (
                          <div className="mb-3">
                            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Observação</p>
                            <p className="text-gray-600 text-sm line-clamp-2">
                              {card.observation}
                            </p>
                          </div>
                        )}

                        {/* Value */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                          <p className="text-emerald-600 font-bold text-lg">
                            {formatCurrency(card.value)}
                          </p>
                          {card.assigned_to && (
                            <div className="flex items-center gap-1.5">
                              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-xs font-medium">
                                {card.assigned_to.name.charAt(0).toUpperCase()}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* Add Card Button */}
                  <button
                    onClick={() => {
                      setSelectedStageId(stage.id)
                      setShowNewCardModal(true)
                    }}
                    className="w-full p-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-emerald-300 hover:text-emerald-500 hover:bg-emerald-50/50 transition-all flex items-center justify-center gap-2 font-medium"
                  >
                    <Plus className="h-4 w-4" />
                    ADICIONAR
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contato</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prioridade</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Responsável</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {stages.flatMap((stage) =>
                stage.cards.map((card) => (
                  <tr
                    key={card.id}
                    onClick={() => setSelectedCard(card)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{card.contact?.name || 'Sem contato'}</p>
                      <p className="text-sm text-gray-500">{card.contact?.phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span 
                        className="px-2 py-1 text-xs rounded-full"
                        style={{ backgroundColor: stage.color + '20', color: stage.color }}
                      >
                        {stage.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{getPriorityLabel(card.priority)}</td>
                    <td className="px-4 py-3 font-medium text-emerald-600">{formatCurrency(card.value)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{card.assigned_to?.name || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* New Card Modal */}
      <AnimatePresence>
        {showNewCardModal && (
          <NewCardModal
            stages={stages}
            selectedStageId={selectedStageId}
            clients={clients}
            products={products}
            users={users}
            customFields={customFields}
            onClose={() => {
              setShowNewCardModal(false)
              setSelectedStageId(null)
            }}
            onSave={(data) => createCardMutation.mutate(data)}
            isLoading={createCardMutation.isPending}
          />
        )}
      </AnimatePresence>

      {/* Card Detail Modal */}
      <AnimatePresence>
        {selectedCard && (
          <CardDetailModal
            card={selectedCard}
            pipelineId={selectedPipelineId!}
            stages={stages}
            clients={clients}
            products={products}
            users={users}
            onClose={() => setSelectedCard(null)}
            onUpdate={() => queryClient.invalidateQueries({ queryKey: ['pipeline-cards'] })}
          />
        )}
      </AnimatePresence>

      {/* Archived Cards Modal */}
      <AnimatePresence>
        {showArchivedModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowArchivedModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden mx-2 sm:mx-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Archive className="h-5 w-5" />
                  Cards Arquivados
                </h2>
                <button
                  onClick={() => setShowArchivedModal(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[calc(80vh-120px)]">
                {archivedCards.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Archive className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhum card arquivado</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {archivedCards.map((card: any) => (
                      <div
                        key={card.id}
                        className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700"
                      >
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 dark:text-white truncate">
                            {card.title}
                          </h3>
                          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {card.contact && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {card.contact.name}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              R${Number(card.value || 0).toFixed(2)}
                            </span>
                            {card.stage && (
                              <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">
                                {card.stage.name}
                              </span>
                            )}
                            {card.archived_at && (
                              <span className="text-xs">
                                Arquivado em {new Date(card.archived_at).toLocaleDateString('pt-BR')}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => unarchiveCardMutation.mutate(card.id)}
                          disabled={unarchiveCardMutation.isPending}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
                        >
                          <RotateCcw className="h-4 w-4" />
                          Restaurar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Fields Manager */}
      {selectedPipelineId && (
        <CustomFieldsManager
          isOpen={showCustomFieldsManager}
          onClose={() => setShowCustomFieldsManager(false)}
          pipelineId={selectedPipelineId}
          currentFields={customFields}
          onSave={handleSaveCustomFields}
        />
      )}

      {/* Advanced Filters */}
      <AdvancedFilters
        isOpen={showAdvancedFilters}
        onClose={() => setShowAdvancedFilters(false)}
        onApplyFilters={handleApplyFilters}
        currentFilters={activeFilters || undefined}
        customFields={customFields}
        onSaveFilter={handleSaveFilter}
        onLoadFilter={handleLoadFilter}
        onDeleteFilter={handleDeleteFilter}
        savedFilters={savedFilters}
      />
    </div>
  )
}

// New Card Modal Component
function NewCardModal({
  stages,
  selectedStageId,
  clients,
  products,
  users,
  customFields,
  onClose,
  onSave,
  isLoading,
}: {
  stages: Stage[]
  selectedStageId: string | null
  clients: any[]
  products: any[]
  users: any[]
  customFields: any[]
  onClose: () => void
  onSave: (data: any) => void
  isLoading: boolean
}) {
  const [formData, setFormData] = useState({
    stage_id: selectedStageId || stages[0]?.id || '',
    contact_id: '',
    assigned_to: '',
    title: '',
    value: 0,
    priority: '',
    observation: '',
    products: [] as { product_id: string; quantity: number; unit_price: number; discount: number }[],
    custom_fields: {} as Record<string, any>,
  })

  const [showProducts, setShowProducts] = useState(true)
  const [showGeneralInfo, setShowGeneralInfo] = useState(true)

  const handleAddProduct = () => {
    setFormData({
      ...formData,
      products: [...formData.products, { product_id: '', quantity: 1, unit_price: 0, discount: 0 }],
    })
  }

  const handleRemoveProduct = (index: number) => {
    const newProducts = [...formData.products]
    newProducts.splice(index, 1)
    setFormData({ ...formData, products: newProducts })
  }

  const handleProductChange = (index: number, field: string, value: any) => {
    const newProducts = [...formData.products]
    if (field === 'product_id') {
      const product = products.find((p) => p.id === value)
      newProducts[index] = {
        ...newProducts[index],
        product_id: value,
        unit_price: product?.price || 0,
      }
    } else {
      newProducts[index] = { ...newProducts[index], [field]: value }
    }
    setFormData({ ...formData, products: newProducts })
  }

  const calculateProductTotal = (product: any) => {
    return (product.quantity * product.unit_price) - product.discount
  }

  const calculateTotal = () => {
    if (formData.products.length === 0) return formData.value
    return formData.products.reduce((sum, p) => sum + calculateProductTotal(p), 0)
  }

  const handleCustomFieldChange = (fieldKey: string, value: any) => {
    setFormData({
      ...formData,
      custom_fields: {
        ...formData.custom_fields,
        [fieldKey]: value,
      },
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      ...formData,
      contact_id: formData.contact_id || null,
      assigned_to: formData.assigned_to || null,
      priority: formData.priority || null,
      value: calculateTotal(),
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
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-2 sm:mx-auto my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Novo(a) Registro</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {/* General Info Section */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
            <button
              type="button"
              onClick={() => setShowGeneralInfo(!showGeneralInfo)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <span className="font-medium text-gray-700 dark:text-gray-200">Informações gerais</span>
              {showGeneralInfo ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
            </button>
            
            {showGeneralInfo && (
              <div className="px-4 pb-4 space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Título <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ex: Negociação com João Silva"
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Status</label>
                    <select
                      value={formData.stage_id}
                      onChange={(e) => setFormData({ ...formData, stage_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {stages.map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Contato</label>
                    <select
                      value={formData.contact_id}
                      onChange={(e) => {
                        const selectedClient = clients.find((c: any) => c.id === e.target.value)
                        setFormData({ 
                          ...formData, 
                          contact_id: e.target.value,
                          // Auto-fill title if empty
                          title: formData.title || (selectedClient ? `Negociação - ${selectedClient.name}` : '')
                        })
                      }}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Selecione um contato</option>
                      {clients.map((client: any) => (
                        <option key={client.id} value={client.id}>
                          {client.name} {client.phone ? `- ${client.phone}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Prioridade</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Selecione...</option>
                      <option value="low">Baixa</option>
                      <option value="medium">Média</option>
                      <option value="high">Alta</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Valor (R$)</label>
                    <input
                      type="number"
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                      placeholder="0,00"
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Observação</label>
                  <textarea
                    value={formData.observation}
                    onChange={(e) => setFormData({ ...formData, observation: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Products Section */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
            <button
              type="button"
              onClick={() => setShowProducts(!showProducts)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <span className="font-medium text-gray-700 dark:text-gray-200">Produtos</span>
              {showProducts ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
            </button>

            {showProducts && (
              <div className="px-4 pb-4 space-y-3">
                <div className="overflow-x-auto">
                {/* Products Table Header */}
                {formData.products.length > 0 && (
                  <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 dark:text-gray-400 font-medium px-1 min-w-[480px]">
                    <div className="col-span-5">Nome</div>
                    <div className="col-span-2">Qtde.</div>
                    <div className="col-span-2">Preço</div>
                    <div className="col-span-2">Total</div>
                    <div className="col-span-1"></div>
                  </div>
                )}

                {/* Products List */}
                {formData.products.map((product, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-center min-w-[480px]">
                    <select
                      value={product.product_id}
                      onChange={(e) => handleProductChange(index, 'product_id', e.target.value)}
                      className="col-span-5 px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
                    >
                      <option value="">Selecione...</option>
                      {products.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={product.quantity}
                      onChange={(e) => handleProductChange(index, 'quantity', parseInt(e.target.value) || 1)}
                      className="col-span-2 px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
                      min="1"
                    />
                    <div className="col-span-2 flex items-center gap-1">
                      <span className="text-xs text-gray-400">R$</span>
                      <input
                        type="number"
                        value={product.unit_price}
                        onChange={(e) => handleProductChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
                        step="0.01"
                      />
                    </div>
                    <div className="col-span-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                      R${calculateProductTotal(product).toFixed(2)}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveProduct(index)}
                      className="col-span-1 p-1 text-gray-400 hover:text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                {/* Total */}
                {formData.products.length > 0 && (
                  <div className="flex justify-end text-sm font-semibold text-gray-700 dark:text-gray-200 pr-12 pt-2 border-t border-gray-200 dark:border-gray-700">
                    R${calculateTotal().toFixed(2)}
                  </div>
                )}
                </div>

                {/* Add Product Button */}
                <button
                  type="button"
                  onClick={handleAddProduct}
                  className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-emerald-400 hover:text-emerald-500 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Produto
                </button>
              </div>
            )}
          </div>

          {/* Custom Fields */}
          {customFields && customFields.length > 0 && (
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <button
                type="button"
                onClick={() => setFormData({ ...formData })} // Just to trigger re-render
                className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 mb-4"
              >
                <Sparkles className="h-4 w-4 text-purple-500" />
                Campos Customizados
              </button>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customFields.map((field: any) => (
                  <CustomFieldInput
                    key={field.id}
                    field={field}
                    value={formData.custom_fields[field.field_key]}
                    onChange={(value) => handleCustomFieldChange(field.field_key, value)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
              <Plus className="h-4 w-4" />
              Registro
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// Card Detail Modal Component
function CardDetailModal({
  card,
  pipelineId,
  stages,
  clients,
  products,
  users,
  onClose,
  onUpdate,
}: {
  card: Card
  pipelineId: string
  stages: Stage[]
  clients: any[]
  products: any[]
  users: any[]
  onClose: () => void
  onUpdate: () => void
}) {
  const [activeTab, setActiveTab] = useState<'geral' | 'timeline' | 'proposta'>('geral')
  const [newComment, setNewComment] = useState('')
  const queryClient = useQueryClient()
  const [proposalTo, setProposalTo] = useState(card.contact?.email || '')
  const [proposalSubject, setProposalSubject] = useState('Proposta Comercial')
  const [proposalMessage, setProposalMessage] = useState(
    `Olá ${card.contact?.name || 'Cliente'},\n\nSegue em anexo nossa proposta comercial. Qualquer dúvida, estou à disposição.\n\nAtenciosamente,`
  )
  const [proposalFile, setProposalFile] = useState<File | null>(null)
  const [formData, setFormData] = useState({
    title: card.title || card.contact?.name || '',
    stage_id: card.stage.id,
    value: card.value,
    observation: card.observation || '',
    assigned_to: card.assigned_to?.id || '',
    priority: card.priority || '',
    contact_id: card.contact?.id || '',
  })

  useEffect(() => {
    if (card.contact?.email && !proposalTo) {
      setProposalTo(card.contact.email)
    }
  }, [card.contact?.email, proposalTo])

  useEffect(() => {
    if (formData.contact_id) {
      const selected = clients.find((c: any) => c.id === formData.contact_id)
      if (selected) {
        setProposalTo(selected.email || '')
        setProposalMessage(
          `Olá ${selected.name || 'Cliente'},\n\nSegue em anexo nossa proposta comercial. Qualquer dúvida, estou à disposição.\n\nAtenciosamente,`
        )
      }
    }
  }, [formData.contact_id, clients])

  // Custom fields state
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>(card.custom_fields || {})

  // Fetch pipeline custom field definitions
  const { data: pipelineDetailData } = useQuery({
    queryKey: ['pipeline-detail', pipelineId],
    queryFn: () => pipelineApi.get(pipelineId),
    enabled: !!pipelineId,
  })
  const customFieldDefs: any[] = pipelineDetailData?.data?.data?.custom_fields || []

  // Products state
  const [cardProducts, setCardProducts] = useState<any[]>(
    card.products?.map((p: any) => ({
      product_id: p.product?.id || p.product_id,
      quantity: p.quantity || 1,
      unit_price: p.unit_price || p.product?.price || 0,
    })) || []
  )
  const [showProductsSection, setShowProductsSection] = useState(true)

  // Tasks state
  const [showTasksSection, setShowTasksSection] = useState(true)
  const [showNewTaskForm, setShowNewTaskForm] = useState(false)
  const [showTaskSelector, setShowTaskSelector] = useState(false)
  const [taskSearchQuery, setTaskSearchQuery] = useState('')
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    scheduled_at: '',
    assigned_to: '',
  })

  // Fetch comments
  const { data: commentsData, refetch: refetchComments } = useQuery({
    queryKey: ['card-comments', pipelineId, card.id],
    queryFn: () => pipelineApi.cards.comments.list(pipelineId, card.id),
    enabled: activeTab === 'timeline',
  })
  const comments = commentsData?.data?.data || []

  // Fetch tasks for this card
  const { data: tasksData, refetch: refetchTasks } = useQuery({
    queryKey: ['card-tasks', card.id],
    queryFn: () => crmTasksApi.list({ card_id: card.id }),
  })
  const cardTasks = tasksData?.data?.data || []

  // Fetch available tasks (tasks without card_id that can be linked)
  const { data: availableTasksData } = useQuery({
    queryKey: ['available-tasks', taskSearchQuery],
    queryFn: () => crmTasksApi.list({ 
      search: taskSearchQuery,
      per_page: 20,
    }),
    enabled: showTaskSelector,
  })
  const availableTasks = (availableTasksData?.data?.data || []).filter(
    (task: any) => !task.card_id && !cardTasks.some((ct: any) => ct.id === task.id)
  )

  const updateCardMutation = useMutation({
    mutationFn: (data: any) => pipelineApi.cards.update(pipelineId, card.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-cards'] })
      onUpdate()
    },
  })

  // Update products mutation
  const updateProductsMutation = useMutation({
    mutationFn: (productsData: any[]) => pipelineApi.cards.updateProducts(pipelineId, card.id, productsData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-cards'] })
      onUpdate()
    },
  })

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: (taskData: any) => crmTasksApi.create({
      ...taskData,
      card_id: card.id,
      contact_id: card.contact?.id,
    }),
    onSuccess: () => {
      setShowNewTaskForm(false)
      setNewTask({ title: '', description: '', scheduled_at: '', assigned_to: '' })
      refetchTasks()
    },
  })

  // Complete task mutation
  const completeTaskMutation = useMutation({
    mutationFn: (taskId: string) => crmTasksApi.update(taskId, { status: 'completed' }),
    onSuccess: () => {
      refetchTasks()
    },
  })

  // Link existing task to card mutation
  const linkTaskMutation = useMutation({
    mutationFn: (taskId: string) => crmTasksApi.update(taskId, { 
      card_id: card.id,
      contact_id: card.contact?.id,
    }),
    onSuccess: () => {
      refetchTasks()
      setShowTaskSelector(false)
      setTaskSearchQuery('')
    },
  })

  // Unlink task from card mutation
  const unlinkTaskMutation = useMutation({
    mutationFn: (taskId: string) => crmTasksApi.update(taskId, { card_id: null }),
    onSuccess: () => {
      refetchTasks()
    },
  })

  // Create comment mutation
  const createCommentMutation = useMutation({
    mutationFn: (content: string) => pipelineApi.cards.comments.create(pipelineId, card.id, content),
    onSuccess: () => {
      setNewComment('')
      refetchComments()
    },
  })

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => pipelineApi.cards.comments.delete(pipelineId, card.id, commentId),
    onSuccess: () => {
      refetchComments()
    },
  })

  const sendProposalMutation = useMutation({
    mutationFn: (payload: {
      to: string
      subject: string
      message?: string
      client_id?: string
      pipeline_card_id?: string
      file: File
    }) => proposalsApi.send(payload),
    onSuccess: () => {
      toast.success('Proposta enviada', 'E-mail enviado com sucesso')
      setProposalFile(null)
    },
    onError: (error: any) => {
      toast.error('Erro', error.response?.data?.message || 'Falha ao enviar proposta')
    },
  })

  // Attachments state and query
  const [showAttachments, setShowAttachments] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const { data: attachmentsData, refetch: refetchAttachments } = useQuery({
    queryKey: ['card-attachments', pipelineId, card.id],
    queryFn: () => pipelineApi.cards.attachments.list(pipelineId, card.id),
  })
  const attachments = attachmentsData?.data?.data || []

  // Upload attachment mutation
  const uploadAttachmentMutation = useMutation({
    mutationFn: (file: File) => pipelineApi.cards.attachments.upload(pipelineId, card.id, file),
    onSuccess: () => {
      refetchAttachments()
      toast.success('Arquivo anexado com sucesso!')
    },
    onError: () => {
      toast.error('Erro ao anexar arquivo')
    },
  })

  // Delete attachment mutation
  const deleteAttachmentMutation = useMutation({
    mutationFn: (attachmentId: string) => pipelineApi.cards.attachments.delete(pipelineId, card.id, attachmentId),
    onSuccess: () => {
      refetchAttachments()
      toast.success('Arquivo removido!')
    },
  })

  // Archive card mutation
  const archiveCardMutation = useMutation({
    mutationFn: () => pipelineApi.cards.archive(pipelineId, card.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-cards'] })
      toast.success('Card arquivado!')
      onClose()
    },
    onError: () => {
      toast.error('Erro ao arquivar card')
    },
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      uploadAttachmentMutation.mutate(file)
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // AI Auto-fill mutation
  const aiAutoFillMutation = useMutation({
    mutationFn: () => pipelineApi.cards.aiAutoFill(pipelineId, card.id),
    onSuccess: (response) => {
      const suggestions = response?.data?.data
      if (suggestions) {
        // Apply suggestions to form
        if (suggestions.title) {
          setFormData(prev => ({ ...prev, title: suggestions.title }))
        }
        if (suggestions.observation) {
          setFormData(prev => ({ ...prev, observation: suggestions.observation }))
        }
        toast.success(
          '✨ Sugestões aplicadas!',
          suggestions.suggested_next_action ? `Próxima ação: ${suggestions.suggested_next_action}` : 'Campos atualizados com sucesso'
        )
      }
    },
    onError: (error: any) => {
      toast.error(
        'Erro no preenchimento automático',
        error?.response?.data?.message || 'Verifique se a chave da API está configurada.'
      )
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Update card info - convert empty strings to null and map observation to description
    const dataToSend = {
      title: formData.title || null,
      stage_id: formData.stage_id,
      contact_id: formData.contact_id || null,
      assigned_to: formData.assigned_to || null,
      priority: formData.priority || null,
      description: formData.observation || null, // Backend expects 'description'
      value: formData.value,
      custom_fields: customFieldDefs.length > 0 ? customFieldValues : undefined,
    }
    updateCardMutation.mutate(dataToSend)
    // Update products if changed
    if (cardProducts.length >= 0) {
      updateProductsMutation.mutate(cardProducts.filter(p => p.product_id))
    }
  }

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newComment.trim()) {
      createCommentMutation.mutate(newComment.trim())
    }
  }

  const handleTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newTask.title.trim()) {
      createTaskMutation.mutate({
        ...newTask,
        status: 'pending',
      })
    }
  }

  // Product management helpers
  const handleAddCardProduct = () => {
    setCardProducts([...cardProducts, { product_id: '', quantity: 1, unit_price: 0 }])
  }

  const handleRemoveCardProduct = (index: number) => {
    setCardProducts(cardProducts.filter((_, i) => i !== index))
  }

  const handleCardProductChange = (index: number, field: string, value: any) => {
    const updated = [...cardProducts]
    updated[index] = { ...updated[index], [field]: value }
    
    // Auto-fill price when product is selected
    if (field === 'product_id') {
      const selectedProduct = products.find((p: any) => p.id === value)
      if (selectedProduct) {
        updated[index].unit_price = selectedProduct.price || 0
      }
    }
    
    setCardProducts(updated)
  }

  const calculateCardProductTotal = (product: any) => {
    return (product.quantity || 0) * (product.unit_price || 0)
  }

  const calculateCardTotalValue = () => {
    return cardProducts.reduce((sum, p) => sum + calculateCardProductTotal(p), 0)
  }

  const formatCommentDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    const isToday = date.toDateString() === today.toDateString()
    
    if (isToday) {
      return `Hoje, ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    }
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-3xl mx-2 sm:mx-auto my-8"
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
            <button
              onClick={() => setActiveTab('proposta')}
              className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
                activeTab === 'proposta' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 dark:text-gray-400'
              }`}
            >
              Proposta
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => aiAutoFillMutation.mutate()}
              disabled={aiAutoFillMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 group relative"
              title="Preenchimento automático (experimental)"
            >
              <Sparkles className={`h-4 w-4 ${aiAutoFillMutation.isPending ? 'animate-pulse' : ''}`} />
              {aiAutoFillMutation.isPending ? 'Processando...' : 'Preencher'}
              <div className="absolute -bottom-16 right-0 hidden group-hover:block w-48 p-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg z-10">
                Preenchimento automático (experimental)
                <br />
                Usa dados do card e comentários para sugerir informações 🤖
              </div>
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-300">Valor total: <span className="font-semibold text-emerald-600">R${calculateCardTotalValue().toFixed(2)}</span></span>
            <button 
              onClick={() => {
                if (confirm('Tem certeza que deseja arquivar este card?')) {
                  archiveCardMutation.mutate()
                }
              }}
              disabled={archiveCardMutation.isPending}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-50"
            >
              <Archive className="h-4 w-4" />
              {archiveCardMutation.isPending ? 'Arquivando...' : 'Arquivar'}
            </button>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
              <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex">
          {/* Main Content */}
          <div className="flex-1 p-4 sm:p-6">
            {activeTab === 'geral' ? (
              <form onSubmit={handleSubmit}>
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-700 dark:text-gray-200">Informações Gerais</h3>
                    <ChevronUp className="h-4 w-4 text-gray-400" />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Contato</label>
                    <select
                      value={formData.contact_id}
                      onChange={(e) => setFormData({ ...formData, contact_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Selecione um contato</option>
                      {clients.map((client: any) => (
                        <option key={client.id} value={client.id}>
                          {client.name} {client.phone ? `- ${client.phone}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Status</label>
                      <select
                        value={formData.stage_id}
                        onChange={(e) => setFormData({ ...formData, stage_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        {stages.map((stage) => (
                          <option key={stage.id} value={stage.id}>
                            {stage.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Prioridade</label>
                      <select
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">Selecione...</option>
                        <option value="low">Baixa</option>
                        <option value="medium">Média</option>
                        <option value="high">Alta</option>
                        <option value="urgent">Urgente</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Observação</label>
                    <textarea
                      value={formData.observation}
                      onChange={(e) => setFormData({ ...formData, observation: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                    />
                  </div>

                  {/* Custom Fields */}
                  {customFieldDefs.length > 0 && (
                    <div className="border-t border-gray-200 dark:border-gray-600 pt-4 mt-2">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="h-4 w-4 text-purple-500" />
                        <h4 className="text-sm font-medium text-gray-600 dark:text-gray-300">Campos Customizados</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {customFieldDefs.map((field: any) => (
                          <CustomFieldInput
                            key={field.id}
                            field={field}
                            value={customFieldValues[field.field_key]}
                            onChange={(value) => setCustomFieldValues({ ...customFieldValues, [field.field_key]: value })}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <button 
                    type="submit"
                    disabled={updateCardMutation.isPending}
                    className="px-4 py-2 bg-gray-800 dark:bg-gray-600 text-white rounded-lg hover:bg-gray-900 dark:hover:bg-gray-500 transition-colors disabled:opacity-50"
                  >
                    {updateCardMutation.isPending ? 'Salvando...' : 'Atualizar Registro'}
                  </button>
                </div>

                {/* Contact Info */}
                {card.contact && (
                  <div className="mt-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2">
                        <User className="w-4 h-4 text-emerald-500" />
                        Contato
                      </h3>
                      <ChevronUp className="h-4 w-4 text-gray-400" />
                    </div>
                    <div className="space-y-3">
                      {/* Nome */}
                      <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex-shrink-0">
                          <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Nome</span>
                          <p className="font-medium text-gray-900 dark:text-white break-words">
                            {card.contact.name}
                          </p>
                        </div>
                      </div>

                      {/* Email */}
                      {card.contact.email && (
                        <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg">
                          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex-shrink-0">
                            <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">E-mail</span>
                            <a 
                              href={`mailto:${card.contact.email}`}
                              className="font-medium text-blue-600 dark:text-blue-400 hover:underline break-all"
                            >
                              {card.contact.email}
                            </a>
                          </div>
                        </div>
                      )}

                      {/* Telefone */}
                      {card.contact.phone && (
                        <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg">
                          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg flex-shrink-0">
                            <Phone className="w-4 h-4 text-green-600 dark:text-green-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Telefone</span>
                            <a 
                              href={`https://wa.me/55${card.contact.phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-green-600 dark:text-green-400 hover:underline"
                            >
                              {card.contact.phone}
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Products Section */}
                <div className="mt-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                  <div 
                    className="flex items-center justify-between mb-3 cursor-pointer"
                    onClick={() => setShowProductsSection(!showProductsSection)}
                  >
                    <h3 className="font-medium text-gray-700 dark:text-gray-200">Produtos</h3>
                    <ChevronUp className={`h-4 w-4 text-gray-400 transition-transform ${showProductsSection ? '' : 'rotate-180'}`} />
                  </div>
                  
                  {showProductsSection && (
                    <div className="space-y-3">
                      {/* Headers */}
                      <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className="col-span-5">Nome</span>
                        <span className="col-span-2">Qtde.</span>
                        <span className="col-span-2">Preço</span>
                        <span className="col-span-2">Total</span>
                        <span className="col-span-1"></span>
                      </div>

                      {/* Products List */}
                      {cardProducts.map((product, index) => (
                        <div key={index} className="grid grid-cols-12 gap-2 items-center">
                          <select
                            value={product.product_id}
                            onChange={(e) => handleCardProductChange(index, 'product_id', e.target.value)}
                            className="col-span-5 px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
                          >
                            <option value="">Selecione...</option>
                            {products.map((p: any) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            value={product.quantity}
                            onChange={(e) => handleCardProductChange(index, 'quantity', parseInt(e.target.value) || 1)}
                            className="col-span-2 px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
                            min="1"
                          />
                          <div className="col-span-2 flex items-center gap-1">
                            <span className="text-xs text-gray-400">R$</span>
                            <input
                              type="number"
                              value={product.unit_price}
                              onChange={(e) => handleCardProductChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
                              step="0.01"
                            />
                          </div>
                          <div className="col-span-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                            R${calculateCardProductTotal(product).toFixed(2)}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveCardProduct(index)}
                            className="col-span-1 p-1 text-gray-400 hover:text-red-500"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}

                      {/* Total */}
                      {cardProducts.length > 0 && (
                        <div className="flex justify-end text-sm font-semibold text-gray-700 dark:text-gray-200 pr-12 pt-2 border-t border-gray-200 dark:border-gray-700">
                          R${calculateCardTotalValue().toFixed(2)}
                        </div>
                      )}

                      {/* Add Product Button */}
                      <button
                        type="button"
                        onClick={handleAddCardProduct}
                        className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-emerald-400 hover:text-emerald-500 transition-colors w-full justify-center"
                      >
                        <Plus className="h-4 w-4" />
                        Produto
                      </button>
                    </div>
                  )}
                </div>

                {/* Tasks Section */}
                <div className="mt-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                  <div 
                    className="flex items-center justify-between mb-3 cursor-pointer"
                    onClick={() => setShowTasksSection(!showTasksSection)}
                  >
                    <h3 className="font-medium text-gray-700 dark:text-gray-200">Tarefas ({cardTasks.length})</h3>
                    <ChevronUp className={`h-4 w-4 text-gray-400 transition-transform ${showTasksSection ? '' : 'rotate-180'}`} />
                  </div>
                  
                  {showTasksSection && (
                    <div className="space-y-3">
                      {/* Tasks List */}
                      {cardTasks.map((task: any) => (
                        <div key={task.id} className="flex items-center gap-3 p-2 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 group">
                          <button
                            type="button"
                            onClick={() => completeTaskMutation.mutate(task.id)}
                            disabled={task.status === 'completed'}
                            className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                              task.status === 'completed' 
                                ? 'bg-emerald-500 border-emerald-500 text-white' 
                                : 'border-gray-300 dark:border-gray-500 hover:border-emerald-400'
                            }`}
                          >
                            {task.status === 'completed' && <Check className="h-3 w-3" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-200'}`}>
                              {task.title}
                            </p>
                            {task.scheduled_at && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(task.scheduled_at).toLocaleDateString('pt-BR', { 
                                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
                                })}
                              </p>
                            )}
                          </div>
                          {task.assigned_to && (
                            <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs font-medium dark:text-white">
                              {task.assigned_to.name?.charAt(0) || '?'}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => unlinkTaskMutation.mutate(task.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                            title="Desvincular tarefa"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}

                      {cardTasks.length === 0 && !showNewTaskForm && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">Nenhuma tarefa vinculada</p>
                      )}

                      {/* New Task Form */}
                      {showNewTaskForm && (
                        <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 space-y-3">
                          <input
                            type="text"
                            value={newTask.title}
                            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                            placeholder="Título da tarefa"
                            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                          />
                          <textarea
                            value={newTask.description}
                            onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                            placeholder="Descrição (opcional)"
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm resize-none"
                          />
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="datetime-local"
                              value={newTask.scheduled_at}
                              onChange={(e) => setNewTask({ ...newTask, scheduled_at: e.target.value })}
                              className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                            />
                            <select
                              value={newTask.assigned_to}
                              onChange={(e) => setNewTask({ ...newTask, assigned_to: e.target.value })}
                              className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                            >
                              <option value="">Atribuir a...</option>
                              {users.map((user: any) => (
                                <option key={user.id} value={user.id}>{user.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setShowNewTaskForm(false)
                                setNewTask({ title: '', description: '', scheduled_at: '', assigned_to: '' })
                              }}
                              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={handleTaskSubmit}
                              disabled={!newTask.title.trim() || createTaskMutation.isPending}
                              className="px-3 py-1.5 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
                            >
                              {createTaskMutation.isPending ? 'Criando...' : 'Criar'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Select Existing Task */}
                      {showTaskSelector && (
                        <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 space-y-3">
                          <div className="flex items-center gap-2">
                            <Search className="h-4 w-4 text-gray-400" />
                            <input
                              type="text"
                              value={taskSearchQuery}
                              onChange={(e) => setTaskSearchQuery(e.target.value)}
                              placeholder="Buscar tarefa existente..."
                              className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                              autoFocus
                            />
                          </div>
                          
                          <div className="max-h-48 overflow-y-auto space-y-2">
                            {availableTasks.length > 0 ? (
                              availableTasks.map((task: any) => (
                                <button
                                  key={task.id}
                                  type="button"
                                  onClick={() => linkTaskMutation.mutate(task.id)}
                                  disabled={linkTaskMutation.isPending}
                                  className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-lg text-left transition-colors"
                                >
                                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                    task.status === 'completed' ? 'bg-emerald-500' :
                                    task.status === 'in_progress' ? 'bg-blue-500' :
                                    'bg-gray-300'
                                  }`} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{task.title}</p>
                                    {task.scheduled_at && (
                                      <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {new Date(task.scheduled_at).toLocaleDateString('pt-BR', { 
                                          day: '2-digit', month: '2-digit' 
                                        })}
                                      </p>
                                    )}
                                  </div>
                                  <Plus className="h-4 w-4 text-emerald-500" />
                                </button>
                              ))
                            ) : (
                              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                                {taskSearchQuery ? 'Nenhuma tarefa encontrada' : 'Nenhuma tarefa disponível para vincular'}
                              </p>
                            )}
                          </div>
                          
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setShowTaskSelector(false)
                                setTaskSearchQuery('')
                              }}
                              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Add Task Buttons */}
                      {!showNewTaskForm && !showTaskSelector && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setShowTaskSelector(true)}
                            className="flex-1 flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors justify-center"
                          >
                            <Link2 className="h-4 w-4" />
                            Vincular Existente
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowNewTaskForm(true)}
                            className="flex-1 flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-emerald-400 hover:text-emerald-500 transition-colors justify-center"
                          >
                            <Plus className="h-4 w-4" />
                            Nova Tarefa
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </form>
            ) : activeTab === 'timeline' ? (
              /* Timeline Tab */
              <div className="space-y-4">
                {/* Comment Form */}
                <form onSubmit={handleCommentSubmit} className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3 border-b border-gray-200 dark:border-gray-600 pb-3">
                    <button type="button" className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded font-bold text-gray-600 dark:text-gray-300">B</button>
                    <button type="button" className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded italic text-gray-600 dark:text-gray-300">I</button>
                    <button type="button" className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded line-through text-gray-600 dark:text-gray-300">S</button>
                    <button type="button" className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-gray-600 dark:text-gray-300">🔗</button>
                    <div className="h-4 w-px bg-gray-200 dark:bg-gray-600 mx-1" />
                    <button type="button" className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-gray-600 dark:text-gray-300 text-xs">Tt</button>
                    <button type="button" className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-gray-600 dark:text-gray-300">"</button>
                    <button type="button" className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-gray-600 dark:text-gray-300">&lt;/&gt;</button>
                  </div>
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Novo comentário"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <div className="flex justify-end mt-3">
                    <button
                      type="submit"
                      disabled={!newComment.trim() || createCommentMutation.isPending}
                      className="px-4 py-2 bg-gray-800 dark:bg-gray-600 text-white rounded-lg hover:bg-gray-900 dark:hover:bg-gray-500 transition-colors disabled:opacity-50"
                    >
                      {createCommentMutation.isPending ? 'Enviando...' : 'Comentar'}
                    </button>
                  </div>
                </form>

                {/* Comments List */}
                <div className="space-y-4">
                  {comments.map((comment: any) => (
                    <div key={comment.id} className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                              {comment.user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 dark:text-white">{comment.user?.name || 'Usuário'}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{formatCommentDate(comment.created_at)}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            if (confirm('Excluir este comentário?')) {
                              deleteCommentMutation.mutate(comment.id)
                            }
                          }}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="ml-13 pl-13">
                        <p className="text-gray-700 dark:text-gray-200 whitespace-pre-wrap bg-white dark:bg-gray-700 rounded-lg p-3">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  ))}

                  {comments.length === 0 && (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <p>Nenhum comentário ainda.</p>
                      <p className="text-sm">Adicione o primeiro comentário acima.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-4">
                  <h3 className="font-medium text-gray-700 dark:text-gray-200">Enviar proposta por e-mail</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Para</label>
                      <input
                        type="email"
                        value={proposalTo}
                        onChange={(e) => setProposalTo(e.target.value)}
                        placeholder="cliente@exemplo.com"
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Assunto</label>
                      <input
                        type="text"
                        value={proposalSubject}
                        onChange={(e) => setProposalSubject(e.target.value)}
                        placeholder="Proposta Comercial"
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Mensagem</label>
                    <textarea
                      value={proposalMessage}
                      onChange={(e) => setProposalMessage(e.target.value)}
                      rows={5}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setProposalFile(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4
                                 file:rounded-lg file:border-0 file:text-sm file:font-semibold
                                 file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                    />
                    {proposalFile && (
                      <span className="text-xs text-gray-500">{proposalFile.name}</span>
                    )}
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Pré-visualização</h4>
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                      <div className="text-lg font-semibold text-gray-900 dark:text-white">{proposalSubject || 'Proposta Comercial'}</div>
                      <div className="text-sm text-gray-500">Olá, {card.contact?.name || 'Cliente'}!</div>
                      <p className="mt-3 text-sm text-gray-700 dark:text-gray-200 whitespace-pre-line">
                        {proposalMessage || 'Segue em anexo nossa proposta comercial.'}
                      </p>
                      <div className="mt-4 text-xs text-gray-500">Anexo: proposta em PDF</div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        if (!proposalTo) {
                          toast.error('Informe o e-mail do cliente')
                          return
                        }
                        if (!proposalSubject) {
                          toast.error('Informe o assunto do e-mail')
                          return
                        }
                        if (!proposalFile) {
                          toast.error('Anexe o PDF da proposta')
                          return
                        }
                        sendProposalMutation.mutate({
                          to: proposalTo,
                          subject: proposalSubject,
                          message: proposalMessage,
                          client_id: formData.contact_id || card.contact?.id,
                          pipeline_card_id: card.id,
                          file: proposalFile,
                        })
                      }}
                      disabled={sendProposalMutation.isPending}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      {sendProposalMutation.isPending ? 'Enviando...' : 'Enviar proposta'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="w-56 border-l border-gray-200 dark:border-gray-700 p-4 space-y-4">
            <div>
              <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">Responsável</label>
              <select
                value={formData.assigned_to}
                onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              >
                <option value="">Sem atribuição</option>
                {users.map((user: any) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
              <button className="mt-2 text-xs text-emerald-600 hover:text-emerald-700">
                Me atribuir
              </button>
            </div>

            <div>
              <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">Ações</label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadAttachmentMutation.isPending}
                className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg w-full text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm disabled:opacity-50"
              >
                {uploadAttachmentMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {uploadAttachmentMutation.isPending ? 'Enviando...' : 'Anexar Arquivo'}
              </button>
            </div>

            {/* Attachments List */}
            {attachments.length > 0 && (
              <div>
                <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Anexos ({attachments.length})
                </label>
                <div className="space-y-2">
                  {attachments.map((attachment: any) => (
                    <div 
                      key={attachment.id} 
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-sm"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <span className="text-gray-600 dark:text-gray-300 truncate" title={attachment.original_name}>
                          {attachment.original_name}
                        </span>
                        <span className="text-gray-400 text-xs flex-shrink-0">
                          {attachment.size_formatted}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-gray-400 hover:text-emerald-500 transition-colors"
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                        <button
                          onClick={() => deleteAttachmentMutation.mutate(attachment.id)}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                          title="Remover"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {card.contact?.phone && (
              <div>
                <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">WhatsApp</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-sm">
                  <Phone className="h-4 w-4 text-emerald-500" />
                  <span className="text-gray-600 dark:text-gray-300">{card.contact.phone}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
