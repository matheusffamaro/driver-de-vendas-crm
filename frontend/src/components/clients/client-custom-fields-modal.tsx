'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Trash2, Loader2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clientsApi } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

interface ClientCustomField {
  id?: string
  name: string
  field_key?: string
  type: 'text' | 'number' | 'date' | 'select'
  options?: string[]
  is_required?: boolean
  position?: number
}

interface ClientCustomFieldsModalProps {
  isOpen: boolean
  onClose: () => void
}

const fieldTypes = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Data' },
  { value: 'select', label: 'Seleção' },
]

export function ClientCustomFieldsModal({ isOpen, onClose }: ClientCustomFieldsModalProps) {
  const queryClient = useQueryClient()
  const [fields, setFields] = useState<ClientCustomField[]>([])

  const { data, isLoading } = useQuery({
    queryKey: ['client-custom-fields'],
    queryFn: () => clientsApi.customFields.list(),
    enabled: isOpen,
  })

  useEffect(() => {
    if (data?.data?.data) {
      setFields(data.data.data)
    }
  }, [data])

  const updateMutation = useMutation({
    mutationFn: (payload: ClientCustomField[]) => clientsApi.customFields.update(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-custom-fields'] })
      toast.success('Campos atualizados', 'Campos personalizados salvos com sucesso')
      onClose()
    },
    onError: (error: any) => {
      toast.error('Erro', error.response?.data?.message || 'Erro ao salvar campos')
    },
  })

  const addField = () => {
    setFields([
      ...fields,
      {
        name: '',
        type: 'text',
        options: [],
        is_required: false,
      },
    ])
  }

  const removeField = (index: number) => {
    const next = [...fields]
    next.splice(index, 1)
    setFields(next)
  }

  const updateField = (index: number, key: keyof ClientCustomField, value: any) => {
    const next = [...fields]
    next[index] = { ...next[index], [key]: value }
    setFields(next)
  }

  const handleSave = () => {
    const payload = fields.map((field, index) => ({
      ...field,
      position: index,
      options: field.type === 'select' ? (field.options || []) : undefined,
    })).filter((field) => field.name.trim() !== '')

    updateMutation.mutate(payload)
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl mx-4 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Campos personalizados</h2>
            <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
              </div>
            ) : (
              <>
                {fields.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum campo criado.</p>
                )}

                {fields.map((field, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
                    <input
                      type="text"
                      value={field.name}
                      onChange={(e) => updateField(index, 'name', e.target.value)}
                      placeholder="Nome do campo"
                      className="md:col-span-2 input"
                    />
                    <select
                      value={field.type}
                      onChange={(e) => updateField(index, 'type', e.target.value)}
                      className="input"
                    >
                      {fieldTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                    {field.type === 'select' ? (
                      <input
                        type="text"
                        value={(field.options || []).join(', ')}
                        onChange={(e) =>
                          updateField(index, 'options', e.target.value.split(',').map((o) => o.trim()).filter(Boolean))
                        }
                        placeholder="Opções (separe por vírgula)"
                        className="md:col-span-2 input"
                      />
                    ) : (
                      <div className="md:col-span-2 text-xs text-gray-400">-</div>
                    )}
                    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={!!field.is_required}
                        onChange={(e) => updateField(index, 'is_required', e.target.checked)}
                      />
                      Obrigatório
                    </label>
                    <button
                      type="button"
                      onClick={() => removeField(index)}
                      className="p-2 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <button onClick={addField} className="btn-ghost">
                  <Plus className="w-4 h-4" />
                  Adicionar campo
                </button>
              </>
            )}
          </div>

          <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
            <button onClick={onClose} className="btn-ghost">Cancelar</button>
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="btn-primary"
            >
              {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
