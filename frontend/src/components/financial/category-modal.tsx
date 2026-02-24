'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Loader2 } from 'lucide-react'
import { financialApi } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

interface Category {
  id: string
  name: string
  type: 'income' | 'expense'
  color: string
  icon?: string
  transactions_count?: number
}

interface CategoryModalProps {
  isOpen: boolean
  onClose: () => void
  category?: Category | null
  defaultType?: 'income' | 'expense'
}

const colors = [
  '#22c55e', '#3b82f6', '#8b5cf6', '#06b6d4', '#ec4899',
  '#ef4444', '#f97316', '#eab308', '#84cc16', '#6366f1',
  '#14b8a6', '#f43f5e', '#a855f7', '#0ea5e9', '#78716c',
]

export function CategoryModal({ isOpen, onClose, category, defaultType = 'income' }: CategoryModalProps) {
  const queryClient = useQueryClient()
  const isEditing = !!category

  const [formData, setFormData] = useState({
    name: '',
    type: defaultType,
    color: colors[0],
  })

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name,
        type: category.type,
        color: category.color,
      })
    } else {
      setFormData({
        name: '',
        type: defaultType,
        color: colors[Math.floor(Math.random() * colors.length)],
      })
    }
  }, [category, defaultType])

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => financialApi.categories.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Categoria criada', 'A categoria foi criada com sucesso')
      onClose()
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Erro ao criar categoria'
      toast.error('Erro', message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) => financialApi.categories.update(category!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Categoria atualizada', 'A categoria foi atualizada com sucesso')
      onClose()
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Erro ao atualizar categoria'
      toast.error('Erro', message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isEditing) {
      updateMutation.mutate(formData)
    } else {
      createMutation.mutate(formData)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl mx-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white font-display">
              {isEditing ? 'Editar Categoria' : 'Nova Categoria'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                Tipo
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'income' })}
                  className={`flex items-center justify-center gap-2 py-3 rounded-lg border transition-all
                            ${formData.type === 'income'
                              ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500'
                              : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                >
                  Receita
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'expense' })}
                  className={`flex items-center justify-center gap-2 py-3 rounded-lg border transition-all
                            ${formData.type === 'expense'
                              ? 'bg-red-500/10 border-red-500 text-red-500'
                              : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                >
                  Despesa
                </button>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                Nome da Categoria
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
                placeholder="Ex: Vendas, Marketing, Salários..."
                required
              />
            </div>

            {/* Color */}
            <div>
              <label className="block text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                Cor
              </label>
              <div className="flex flex-wrap gap-2">
                {colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-8 h-8 rounded-lg border-2 transition-all
                               ${formData.color === color 
                                 ? 'border-gray-900 dark:border-white scale-110' 
                                 : 'border-transparent hover:scale-105'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              
              {/* Custom color input */}
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <span className="text-sm text-gray-500">Cor personalizada</span>
              </div>
            </div>

            {/* Preview */}
            <div>
              <label className="block text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                Prévia
              </label>
              <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div 
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: formData.color }}
                />
                <span 
                  className="px-3 py-1 rounded-full text-sm font-medium"
                  style={{ 
                    backgroundColor: `${formData.color}20`,
                    color: formData.color,
                  }}
                >
                  {formData.name || 'Nome da categoria'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending || !formData.name}
                className="btn-primary"
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {isEditing ? 'Salvar' : 'Criar Categoria'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

