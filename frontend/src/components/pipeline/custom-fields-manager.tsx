'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import {
  X,
  Plus,
  GripVertical,
  Trash2,
  Type,
  Hash,
  Calendar,
  List,
  CheckSquare,
  Phone,
  Mail,
  Link as LinkIcon,
  AlignLeft,
  DollarSign,
  Save,
  Loader2,
  Check,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface CustomField {
  id?: string
  name: string
  field_key: string
  type: 'text' | 'textarea' | 'number' | 'money' | 'date' | 'select' | 'multiselect' | 'checkbox' | 'phone' | 'email' | 'url'
  options?: string[]
  is_required: boolean
  position: number
}

interface CustomFieldsManagerProps {
  isOpen: boolean
  onClose: () => void
  pipelineId: string
  currentFields: CustomField[]
  onSave: (fields: CustomField[]) => Promise<void>
}

const FIELD_TYPES = [
  { value: 'text', label: 'Texto Curto', icon: Type, description: 'Campo de texto simples' },
  { value: 'textarea', label: 'Texto Longo', icon: AlignLeft, description: 'Área de texto multilinha' },
  { value: 'number', label: 'Número', icon: Hash, description: 'Apenas números' },
  { value: 'money', label: 'Moeda (R$)', icon: DollarSign, description: 'Valor em reais' },
  { value: 'date', label: 'Data', icon: Calendar, description: 'Seletor de data' },
  { value: 'select', label: 'Seleção Única', icon: List, description: 'Lista suspensa' },
  { value: 'multiselect', label: 'Seleção Múltipla', icon: CheckSquare, description: 'Múltiplas opções' },
  { value: 'checkbox', label: 'Sim/Não', icon: CheckSquare, description: 'Campo verdadeiro/falso' },
  { value: 'phone', label: 'Telefone', icon: Phone, description: 'Com máscara (11) 98765-4321' },
  { value: 'email', label: 'E-mail', icon: Mail, description: 'Com validação de email' },
  { value: 'url', label: 'URL/Link', icon: LinkIcon, description: 'Link completo com validação' },
]

export function CustomFieldsManager({ isOpen, onClose, pipelineId, currentFields, onSave }: CustomFieldsManagerProps) {
  const [fields, setFields] = useState<CustomField[]>(currentFields)
  const [editingField, setEditingField] = useState<CustomField | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setFields(currentFields)
  }, [currentFields])

  const addField = () => {
    const newField: CustomField = {
      name: '',
      field_key: '',
      type: 'text',
      is_required: false,
      position: fields.length,
    }
    setEditingField(newField)
  }

  const saveField = () => {
    if (!editingField || !editingField.name.trim()) {
      toast.error('Erro', 'Nome do campo é obrigatório')
      return
    }

    // Generate field_key from name if not set
    if (!editingField.field_key) {
      editingField.field_key = editingField.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '_')
    }

    if (editingField.id) {
      // Update existing
      setFields(fields.map(f => f.id === editingField.id ? editingField : f))
    } else {
      // Add new
      setFields([...fields, { ...editingField, id: `temp-${Date.now()}` }])
    }
    
    setEditingField(null)
  }

  const deleteField = (fieldId: string) => {
    if (confirm('Tem certeza que deseja excluir este campo? Todos os dados já salvos neste campo serão perdidos.')) {
      setFields(fields.filter(f => f.id !== fieldId))
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(fields)
      toast.success('Campos salvos!', 'Campos customizados atualizados com sucesso')
      onClose()
    } catch (error: any) {
      console.error('Error saving custom fields:', error)
      const errorMessage = error?.response?.data?.message || error?.message || 'Não foi possível salvar os campos'
      toast.error('Erro ao salvar', errorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  const needsOptions = (type: string) => ['select', 'multiselect'].includes(type)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay + Modal Container */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          >
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="relative w-full max-w-4xl max-h-[85vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden mx-2 sm:mx-auto"
              onClick={(e) => e.stopPropagation()}
            >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Campos Customizados</h2>
                <p className="text-sm text-gray-500 mt-1">Personalize as informações coletadas nas oportunidades</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
              {/* Fields List */}
              {fields.length > 0 ? (
                <Reorder.Group axis="y" values={fields} onReorder={setFields} className="space-y-3">
                  {fields.map((field) => (
                    <Reorder.Item key={field.id} value={field}>
                      <div className="group flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                        <button className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                          <GripVertical className="w-5 h-5" />
                        </button>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-white">{field.name}</span>
                            {field.is_required && (
                              <span className="px-1.5 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded">
                                Obrigatório
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500">
                              {FIELD_TYPES.find(t => t.value === field.type)?.label || field.type}
                            </span>
                            <span className="text-xs text-gray-400">•</span>
                            <span className="text-xs text-gray-400 font-mono">{field.field_key}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditingField(field)}
                            className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => deleteField(field.id!)}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              ) : (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                    <Type className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400">Nenhum campo customizado criado</p>
                  <p className="text-sm text-gray-400 mt-1">Clique em "Adicionar Campo" para começar</p>
                </div>
              )}

              {/* Add Field Button */}
              {!editingField && (
                <button
                  onClick={addField}
                  className="w-full mt-4 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 
                           rounded-lg text-gray-600 dark:text-gray-400 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400
                           transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  <Plus className="w-5 h-5" />
                  Adicionar Campo
                </button>
              )}

              {/* Edit Field Form */}
              {editingField && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl"
                >
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    {editingField.id ? 'Editar Campo' : 'Novo Campo'}
                  </h3>

                  <div className="space-y-4">
                    {/* Field Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Nome do Campo <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={editingField.name}
                        onChange={(e) => setEditingField({ ...editingField, name: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 
                                 bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                                 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                        placeholder="Ex: Origem do Lead"
                      />
                    </div>

                    {/* Field Type */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Tipo de Campo <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {FIELD_TYPES.map((type) => {
                          const Icon = type.icon
                          const isSelected = editingField.type === type.value
                          return (
                            <button
                              key={type.value}
                              onClick={() => setEditingField({ ...editingField, type: type.value as any })}
                              className={`p-3 rounded-lg border-2 text-left transition-all ${
                                isSelected
                                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <Icon className={`w-4 h-4 ${isSelected ? 'text-emerald-600' : 'text-gray-400'}`} />
                                <span className={`text-sm font-medium ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                  {type.label}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{type.description}</p>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Options for select/multiselect */}
                    {needsOptions(editingField.type) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Opções <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={(editingField.options || []).join('\n')}
                          onChange={(e) => setEditingField({ 
                            ...editingField, 
                            options: e.target.value.split('\n').filter(o => o.trim()) 
                          })}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 
                                   bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                                   focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                          placeholder="Digite uma opção por linha&#10;Ex:&#10;Indicação&#10;Google Ads&#10;Redes Sociais"
                          rows={5}
                        />
                        <p className="text-xs text-gray-500 mt-1">Uma opção por linha</p>
                      </div>
                    )}

                    {/* Is Required */}
                    <div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingField.is_required}
                          onChange={(e) => setEditingField({ ...editingField, is_required: e.target.checked })}
                          className="w-4 h-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Campo obrigatório
                        </span>
                      </label>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={saveField}
                        className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        {editingField.id ? 'Atualizar' : 'Adicionar'} Campo
                      </button>
                      <button
                        onClick={() => setEditingField(null)}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <p className="text-sm text-gray-500">
                {fields.length} {fields.length === 1 ? 'campo configurado' : 'campos configurados'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
                  disabled={isSaving}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || editingField !== null}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 
                           text-white disabled:text-gray-500 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Salvar Campos
                    </>
                  )}
                </button>
              </div>
            </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
