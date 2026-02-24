'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2 } from 'lucide-react'
import { clientsApi } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { Client } from '@/types'

const clientSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  document: z.string().optional(),
  type: z.enum(['individual', 'company']),
  company_name: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['active', 'inactive']),
})

type ClientFormData = z.infer<typeof clientSchema>

interface ClientModalProps {
  isOpen: boolean
  onClose: () => void
  client?: Client | null
}

export function ClientModal({ isOpen, onClose, client }: ClientModalProps) {
  const queryClient = useQueryClient()
  const isEditing = !!client
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({})

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      type: 'individual',
      status: 'active',
    },
  })

  const type = watch('type')

  const { data: customFieldsData } = useQuery({
    queryKey: ['client-custom-fields'],
    queryFn: () => clientsApi.customFields.list(),
  })
  const customFields = customFieldsData?.data?.data || []

  useEffect(() => {
    if (client) {
      reset({
        name: client.name,
        email: client.email || '',
        phone: client.phone || '',
        document: client.document || '',
        type: client.type,
        company_name: client.company_name || '',
        notes: client.notes || '',
        status: client.status,
      })
      setCustomFieldValues(client.custom_fields || {})
    } else {
      reset({
        name: '',
        email: '',
        phone: '',
        document: '',
        type: 'individual',
        company_name: '',
        notes: '',
        status: 'active',
      })
      setCustomFieldValues({})
    }
  }, [client, reset])

  const mutation = useMutation({
    mutationFn: (data: ClientFormData) => {
      const payload = {
        ...data,
        email: data.email || undefined,
        custom_fields: customFieldValues,
      }
      
      if (isEditing) {
        return clientsApi.update(client!.id, payload)
      }
      return clientsApi.create(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success(
        isEditing ? 'Cliente atualizado' : 'Cliente criado',
        isEditing ? 'As alterações foram salvas' : 'O cliente foi adicionado com sucesso'
      )
      onClose()
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Ocorreu um erro'
      toast.error('Erro', message)
    },
  })

  const onSubmit = (data: ClientFormData) => {
    mutation.mutate(data)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto m-4"
          >
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white font-display">
                  {isEditing ? 'Editar Cliente' : 'Novo Cliente'}
                </h2>
                <button
                  onClick={onClose}
                  className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                {/* Type */}
                <div>
                  <label className="block text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                    Tipo
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="individual"
                        {...register('type')}
                        className="text-emerald-500 focus:ring-emerald-500"
                      />
                      <span className="text-gray-900 dark:text-white">Pessoa Física</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="company"
                        {...register('type')}
                        className="text-emerald-500 focus:ring-emerald-500"
                      />
                      <span className="text-gray-900 dark:text-white">Pessoa Jurídica</span>
                    </label>
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                    {type === 'company' ? 'Nome Fantasia' : 'Nome Completo'}
                  </label>
                  <input
                    type="text"
                    {...register('name')}
                    className={`input ${errors.name ? 'input-error' : ''}`}
                    placeholder={type === 'company' ? 'Nome fantasia' : 'Nome completo'}
                  />
                  {errors.name && (
                    <p className="text-danger-500 text-sm mt-1">{errors.name.message}</p>
                  )}
                </div>

                {/* Company Name (only for company) */}
                {type === 'company' && (
                  <div>
                    <label className="block text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                      Razão Social
                    </label>
                    <input
                      type="text"
                      {...register('company_name')}
                      className="input"
                      placeholder="Razão social da empresa"
                    />
                  </div>
                )}

                {customFields.length > 0 && (
                  <div className="space-y-4 pt-2">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Campos personalizados</h3>
                    {customFields.map((field: any) => (
                      <div key={field.id}>
                        <label className="block text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                          {field.name}{field.is_required ? ' *' : ''}
                        </label>
                        {field.type === 'select' ? (
                          <select
                            value={customFieldValues[field.field_key] ?? ''}
                            onChange={(e) =>
                              setCustomFieldValues({ ...customFieldValues, [field.field_key]: e.target.value })
                            }
                            className="input"
                          >
                            <option value="">Selecione...</option>
                            {(field.options || []).map((opt: string) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                            value={customFieldValues[field.field_key] ?? ''}
                            onChange={(e) =>
                              setCustomFieldValues({ ...customFieldValues, [field.field_key]: e.target.value })
                            }
                            className="input"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Email & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                      E-mail
                    </label>
                    <input
                      type="email"
                      {...register('email')}
                      className={`input ${errors.email ? 'input-error' : ''}`}
                      placeholder="email@exemplo.com"
                    />
                    {errors.email && (
                      <p className="text-danger-500 text-sm mt-1">{errors.email.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                      Telefone
                    </label>
                    <input
                      type="text"
                      {...register('phone')}
                      className="input"
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                </div>

                {/* Document */}
                <div>
                  <label className="block text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                    {type === 'company' ? 'CNPJ' : 'CPF'}
                  </label>
                  <input
                    type="text"
                    {...register('document')}
                    className="input"
                    placeholder={type === 'company' ? '00.000.000/0001-00' : '000.000.000-00'}
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                    Observações
                  </label>
                  <textarea
                    {...register('notes')}
                    rows={3}
                    className="input resize-none"
                    placeholder="Anotações sobre o cliente..."
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                    Status
                  </label>
                  <select {...register('status')} className="input">
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={mutation.isPending}
                    className="btn-primary"
                  >
                    {mutation.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : isEditing ? (
                      'Salvar'
                    ) : (
                      'Criar Cliente'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

