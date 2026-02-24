'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, Reorder } from 'framer-motion'
import { 
  ArrowLeft, 
  Plus, 
  X, 
  GripVertical, 
  Check,
  Trash2,
  Save,
  Kanban,
  Info
} from 'lucide-react'
import { pipelineApi, tenantApi } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

interface Stage {
  id: string
  name: string
  color: string
  type: 'open' | 'won' | 'lost'
  position: number
  isNew?: boolean
}

interface CustomField {
  id: string
  name: string
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'checkbox'
  options: string[]
  is_required: boolean
  show_on_card: boolean
  show_on_list: boolean
  isNew?: boolean
}

const stageColors = [
  '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#6B7280',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316',
]

const fieldTypes = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Data' },
  { value: 'select', label: 'Seleção' },
  { value: 'multiselect', label: 'Múltipla seleção' },
  { value: 'checkbox', label: 'Checkbox' },
]

export default function PipelineSettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const pipelineId = searchParams.get('id')

  const [stages, setStages] = useState<Stage[]>([])
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [wonStageId, setWonStageId] = useState<string>('')
  const [lostStageId, setLostStageId] = useState<string>('')
  const [linkedTools, setLinkedTools] = useState({
    tasks: true,
    products: true,
    contacts: true,
  })
  const [pipelineName, setPipelineName] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // Fetch pipelines
  const { data: pipelinesData, isLoading: loadingPipelines } = useQuery({
    queryKey: ['pipelines'],
    queryFn: () => pipelineApi.list(),
  })

  const pipelines = pipelinesData?.data?.data || []

  // Fetch tenant data for addon limits
  const { data: tenantData } = useQuery({
    queryKey: ['tenant'],
    queryFn: () => tenantApi.get(),
  })

  const pipelinesAddonEnabled = tenantData?.data?.data?.pipelines_addon_enabled ?? false
  const pipelinesCount = tenantData?.data?.data?.pipelines_count ?? 0
  const pipelinesLimit = tenantData?.data?.data?.pipelines_limit ?? 1

  // Auto-select default pipeline if no ID provided
  useEffect(() => {
    if (!pipelineId && pipelines.length > 0) {
      const defaultPipeline = pipelines.find((p: any) => p.is_default) || pipelines[0]
      router.replace(`/crm/pipeline/settings?id=${defaultPipeline.id}`)
    }
  }, [pipelineId, pipelines, router])

  // Fetch pipeline details
  const { data: pipelineData, isLoading: loadingPipeline } = useQuery({
    queryKey: ['pipeline', pipelineId],
    queryFn: () => pipelineApi.get(pipelineId!),
    enabled: !!pipelineId,
  })

  // Initialize state from pipeline data
  useEffect(() => {
    if (pipelineData?.data?.data) {
      const pipeline = pipelineData.data.data
      setPipelineName(pipeline.name)
      setStages(pipeline.stages.map((s: any) => ({
        ...s,
        isNew: false,
      })))
      setCustomFields(pipeline.custom_fields?.map((f: any) => ({
        ...f,
        isNew: false,
      })) || [])
      
      // Set won/lost stages (backend uses is_won/is_lost booleans)
      const wonStage = pipeline.stages.find((s: any) => s.is_won)
      const lostStage = pipeline.stages.find((s: any) => s.is_lost)
      if (wonStage) setWonStageId(wonStage.id)
      if (lostStage) setLostStageId(lostStage.id)
    }
  }, [pipelineData])

  // Create pipeline mutation
  const createPipelineMutation = useMutation({
    mutationFn: (data: any) => pipelineApi.create(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] })
      queryClient.invalidateQueries({ queryKey: ['tenant'] })
      router.push(`/crm/pipeline/settings?id=${response.data.data.id}`)
      toast.success('Pipeline Criado', 'Novo pipeline criado com sucesso!')
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Erro ao criar pipeline'
      
      // Check if it's a limit error
      if (error.response?.status === 403) {
        toast.error(
          'Limite Atingido',
          message
        )
      } else {
        toast.error('Erro', message)
      }
    }
  })

  // Update stages mutation
  const updateStagesMutation = useMutation({
    mutationFn: () => pipelineApi.updateStages(pipelineId!, stages.map((s, i) => ({
      id: s.isNew ? undefined : s.id,
      name: s.name,
      color: s.color,
      is_won: s.id === wonStageId,
      is_lost: s.id === lostStageId,
      position: i,
    }))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', pipelineId] })
      queryClient.invalidateQueries({ queryKey: ['pipelines'] })
      setHasChanges(false)
    },
  })

  // Delete pipeline mutation
  const deletePipelineMutation = useMutation({
    mutationFn: (id: string) => pipelineApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] })
      queryClient.invalidateQueries({ queryKey: ['tenant'] })
      toast.success('Pipeline Excluído', 'Pipeline deletado com sucesso!')
      router.push('/crm/pipeline/settings')
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Erro ao excluir pipeline'
      toast.error('Erro', message)
    }
  })

  // Helper to generate field_key from name
  const generateFieldKey = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
  }

  // Update custom fields mutation
  const updateFieldsMutation = useMutation({
    mutationFn: (fieldsToSave: any[]) => {
      // Map fields to API format
      const validFields = fieldsToSave.map((f, i) => ({
        id: f.isNew ? undefined : f.id,
        name: f.name.trim(),
        field_key: generateFieldKey(f.name) || `field_${i}`,
        type: f.type,
        options: (f.options && f.options.length > 0) ? f.options : null,
        is_required: f.is_required || false,
        position: i,
      }))
      console.log('Saving custom fields:', validFields)
      return pipelineApi.updateCustomFields(pipelineId!, validFields)
    },
    onSuccess: (response) => {
      console.log('Custom fields saved:', response?.data)
      queryClient.invalidateQueries({ queryKey: ['pipeline', pipelineId] })
      queryClient.invalidateQueries({ queryKey: ['pipeline-detail', pipelineId] })
    },
  })

  const handleAddStage = () => {
    const newStage: Stage = {
      id: `new-${Date.now()}`,
      name: '',
      color: stageColors[stages.length % stageColors.length],
      type: 'open',
      position: stages.length,
      isNew: true,
    }
    setStages([...stages, newStage])
    setHasChanges(true)
  }

  const handleRemoveStage = (id: string) => {
    if (stages.length <= 1) return
    setStages(stages.filter((s) => s.id !== id))
    setHasChanges(true)
  }

  const handleStageChange = (id: string, field: string, value: any) => {
    setStages(stages.map((s) => s.id === id ? { ...s, [field]: value } : s))
    setHasChanges(true)
  }

  const handleAddField = () => {
    const newField: CustomField = {
      id: `new-${Date.now()}`,
      name: '',
      type: 'text',
      options: [],
      is_required: false,
      show_on_card: true,
      show_on_list: true,
      isNew: true,
    }
    setCustomFields([...customFields, newField])
    setHasChanges(true)
  }

  const handleRemoveField = (id: string) => {
    setCustomFields(customFields.filter((f) => f.id !== id))
    setHasChanges(true)
  }

  const handleFieldChange = (id: string, field: string, value: any) => {
    setCustomFields(customFields.map((f) => f.id === id ? { ...f, [field]: value } : f))
    setHasChanges(true)
  }

  const handleAddOption = (fieldId: string, option: string) => {
    if (!option.trim()) return
    setCustomFields(customFields.map((f) => 
      f.id === fieldId 
        ? { ...f, options: [...f.options, option.trim()] }
        : f
    ))
    setHasChanges(true)
  }

  const handleRemoveOption = (fieldId: string, optionIndex: number) => {
    setCustomFields(customFields.map((f) => 
      f.id === fieldId 
        ? { ...f, options: f.options.filter((_, i) => i !== optionIndex) }
        : f
    ))
    setHasChanges(true)
  }

  // Update pipeline name mutation
  const updatePipelineMutation = useMutation({
    mutationFn: () => pipelineApi.update(pipelineId!, { name: pipelineName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', pipelineId] })
      queryClient.invalidateQueries({ queryKey: ['pipelines'] })
    },
  })

  const handleSave = async () => {
    if (!pipelineId) {
      // Create new pipeline
      createPipelineMutation.mutate({ name: pipelineName || 'Novo Funil', is_default: pipelines.length === 0 })
    } else {
      console.log('=== SAVING PIPELINE ===')
      console.log('Custom fields BEFORE filter:', customFields)
      
      // Remove empty-name custom fields automatically before saving
      const validCustomFields = customFields.filter((f) => f.name.trim() !== '')
      console.log('Custom fields AFTER filter (valid):', validCustomFields)
      
      if (validCustomFields.length !== customFields.length) {
        console.log(`Removed ${customFields.length - validCustomFields.length} empty fields`)
        setCustomFields(validCustomFields)
      }

      // Update existing - save each part independently
      let hasError = false

      try {
        console.log('Saving pipeline name...')
        await updatePipelineMutation.mutateAsync()
        console.log('Pipeline name saved')
      } catch (error) {
        console.error('Erro ao salvar nome:', error)
        hasError = true
      }

      try {
        console.log('Saving stages...')
        await updateStagesMutation.mutateAsync()
        console.log('Stages saved')
      } catch (error) {
        console.error('Erro ao salvar stages:', error)
        hasError = true
      }

      try {
        console.log('Saving custom fields...')
        await updateFieldsMutation.mutateAsync(validCustomFields)
        console.log('Custom fields saved')
      } catch (error) {
        console.error('Erro ao salvar campos:', error)
        hasError = true
      }

      if (hasError) {
        toast.error('Erro parcial', 'Nem todas as configurações foram salvas. Verifique e tente novamente.')
      } else {
        setHasChanges(false)
        toast.success('Salvo!', 'Configurações atualizadas com sucesso')
      }
    }
  }

  const isLoading = loadingPipelines || loadingPipeline
  const isSaving = createPipelineMutation.isPending || updatePipelineMutation.isPending || updateStagesMutation.isPending || updateFieldsMutation.isPending

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <Link
          href="/crm/pipeline"
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          Voltar
        </Link>
        <div className="flex items-center gap-3">
          {pipelineId && pipelines.length > 1 && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Excluir Pipeline
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || (!hasChanges && !!pipelineId)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50"
          >
            {isSaving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar
          </button>
        </div>
      </div>

      {/* Pipeline Limit Indicator */}
      <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Kanban className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                Pipelines: {pipelines.length} 
                {pipelinesAddonEnabled 
                  ? ' (Ilimitado)' 
                  : ` / ${pipelinesLimit}`
                }
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {pipelinesAddonEnabled 
                  ? `R$ 29,90/mês (ilimitado)` 
                  : '1 pipeline gratuito'
                }
              </p>
            </div>
          </div>
          {!pipelinesAddonEnabled && pipelines.length >= pipelinesLimit && (
            <Link 
              href="/settings?tab=plan"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Ativar Add-on
            </Link>
          )}
          {(pipelinesAddonEnabled || pipelines.length < pipelinesLimit) && (
            <button
              onClick={() => {
                // Create new pipeline immediately
                const newPipelineName = `Novo Funil ${pipelines.length + 1}`
                createPipelineMutation.mutate({ 
                  name: newPipelineName, 
                  is_default: pipelines.length === 0 
                })
              }}
              disabled={createPipelineMutation.isPending}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {createPipelineMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Criando...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Novo Pipeline
                </>
              )}
            </button>
          )}
        </div>
        
        {!pipelinesAddonEnabled && pipelines.length >= pipelinesLimit && (
          <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Você atingiu o limite de {pipelinesLimit} pipeline gratuito. Ative o add-on "Múltiplos Pipelines" para criar pipelines adicionais por R$ 19,90 cada/mês.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Pipeline Name and Selector */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Nome do Funil</h2>
        <div className="flex items-center gap-4">
          <input
            type="text"
            value={pipelineName}
            onChange={(e) => {
              setPipelineName(e.target.value)
              setHasChanges(true)
            }}
            placeholder="Nome do funil"
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {pipelines.length > 1 && (
            <select
              value={pipelineId || ''}
              onChange={(e) => router.push(`/crm/pipeline/settings?id=${e.target.value}`)}
              className="px-4 py-2 border rounded-lg font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {pipelines.map((pipeline: any) => (
                <option key={pipeline.id} value={pipeline.id}>
                  {pipeline.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </section>

      {/* Stages Section */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Edição dos status</h2>
        
        <div className="space-y-2">
          <Reorder.Group 
            axis="y" 
            values={stages} 
            onReorder={(newOrder) => {
              setStages(newOrder)
              setHasChanges(true)
            }}
            className="space-y-2"
          >
            {stages.map((stage) => (
              <Reorder.Item key={stage.id} value={stage}>
                <div className="flex items-center gap-3 px-4 py-3 bg-white border rounded-lg group hover:shadow-sm transition-shadow">
                  <GripVertical className="h-5 w-5 text-gray-300 cursor-grab flex-shrink-0" />
                  
                  {/* Color Picker */}
                  <div className="relative">
                    <div 
                      className="w-8 h-8 rounded-full border-2 border-white shadow-sm cursor-pointer"
                      style={{ backgroundColor: stage.color }}
                      onClick={() => {
                        const colorPicker = document.getElementById(`color-picker-${stage.id}`)
                        colorPicker?.click()
                      }}
                    />
                    <input
                      id={`color-picker-${stage.id}`}
                      type="color"
                      value={stage.color}
                      onChange={(e) => handleStageChange(stage.id, 'color', e.target.value)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                  </div>
                  
                  {/* Stage Name */}
                  <input
                    type="text"
                    value={stage.name}
                    onChange={(e) => handleStageChange(stage.id, 'name', e.target.value)}
                    placeholder="Nome do status"
                    className="flex-1 px-3 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  
                  {/* Won/Lost indicators */}
                  {stage.id === wonStageId && (
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">Ganho</span>
                  )}
                  {stage.id === lostStageId && (
                    <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">Perdido</span>
                  )}
                  
                  {/* Remove Button */}
                  <button
                    onClick={() => handleRemoveStage(stage.id)}
                    disabled={stages.length <= 1}
                    className="p-1.5 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </Reorder.Item>
            ))}
          </Reorder.Group>
          
          <button
            onClick={handleAddStage}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 hover:border-emerald-300 hover:text-emerald-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span className="text-sm">Adicionar status</span>
          </button>
        </div>
      </section>

      {/* Linked Tools Section */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Links com outras ferramentas</h2>
        
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={linkedTools.tasks}
              onChange={(e) => setLinkedTools({ ...linkedTools, tasks: e.target.checked })}
              className="w-4 h-4 text-emerald-500 border-gray-300 rounded focus:ring-emerald-500"
            />
            <span className="text-sm text-gray-700">Tarefas</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={linkedTools.products}
              onChange={(e) => setLinkedTools({ ...linkedTools, products: e.target.checked })}
              className="w-4 h-4 text-emerald-500 border-gray-300 rounded focus:ring-emerald-500"
            />
            <span className="text-sm text-gray-700">Produtos</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={linkedTools.contacts}
              onChange={(e) => setLinkedTools({ ...linkedTools, contacts: e.target.checked })}
              className="w-4 h-4 text-emerald-500 border-gray-300 rounded focus:ring-emerald-500"
            />
            <span className="text-sm text-gray-700">Contatos</span>
          </label>
        </div>
      </section>

      {/* Special Stages Section */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Campos especiais</h2>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Status de ganho</label>
            <select
              value={wonStageId}
              onChange={(e) => {
                setWonStageId(e.target.value)
                setHasChanges(true)
              }}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Selecione...</option>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name || 'Sem nome'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Status de perdido</label>
            <select
              value={lostStageId}
              onChange={(e) => {
                setLostStageId(e.target.value)
                setHasChanges(true)
              }}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Selecione...</option>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name || 'Sem nome'}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Custom Fields Section */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Campos</h2>
        
        <div className="space-y-4">
          {customFields.map((field) => (
            <div key={field.id} className="p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-start gap-4">
                <GripVertical className="h-5 w-5 text-gray-300 mt-2 cursor-grab" />
                
                <div className="flex-1 grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">* Nome</label>
                    <input
                      type="text"
                      value={field.name}
                      onChange={(e) => handleFieldChange(field.id, 'name', e.target.value)}
                      placeholder="Nome do campo"
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">* Tipo</label>
                    <select
                      value={field.type}
                      onChange={(e) => handleFieldChange(field.id, 'type', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {fieldTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Opções de valor</label>
                    <div className="flex flex-wrap gap-1">
                      {(field.options || []).map((option, i) => (
                        <span 
                          key={i} 
                          className="inline-flex items-center gap-1 px-2 py-1 bg-white border rounded text-sm"
                        >
                          {option}
                          <button
                            onClick={() => handleRemoveOption(field.id, i)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                      {(field.type === 'select' || field.type === 'multiselect') && (
                        <input
                          type="text"
                          placeholder="Adicionar..."
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleAddOption(field.id, (e.target as HTMLInputElement).value)
                              ;(e.target as HTMLInputElement).value = ''
                            }
                          }}
                          className="w-24 px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      )}
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => handleRemoveField(field.id)}
                  className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex items-center gap-6 mt-4 ml-9">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={field.is_required}
                    onChange={(e) => handleFieldChange(field.id, 'is_required', e.target.checked)}
                    className="w-4 h-4 text-emerald-500 border-gray-300 rounded focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-600">Campo obrigatório</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={field.show_on_card}
                    onChange={(e) => handleFieldChange(field.id, 'show_on_card', e.target.checked)}
                    className="w-4 h-4 text-emerald-500 border-gray-300 rounded focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-600">Mostrar no quadro</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={field.show_on_list}
                    onChange={(e) => handleFieldChange(field.id, 'show_on_list', e.target.checked)}
                    className="w-4 h-4 text-emerald-500 border-gray-300 rounded focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-600">Mostrar na lista</span>
                </label>
              </div>
            </div>
          ))}

          <button
            onClick={handleAddField}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 hover:border-emerald-300 hover:text-emerald-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Excluir Pipeline
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Esta ação não pode ser desfeita
                </p>
              </div>
            </div>
            
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Tem certeza que deseja excluir o pipeline <strong>{pipelineName}</strong>? 
              Todos os cards e dados associados serão permanentemente removidos.
            </p>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (pipelineId) {
                    deletePipelineMutation.mutate(pipelineId)
                    setShowDeleteModal(false)
                  }
                }}
                disabled={deletePipelineMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deletePipelineMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Excluindo...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Excluir
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
