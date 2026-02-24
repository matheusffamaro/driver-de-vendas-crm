'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  X, 
  Plus, 
  Pencil, 
  Trash2, 
  Loader2,
  Tag,
  Package,
} from 'lucide-react'
import { productsApi } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { ConfirmModal } from '@/components/ui/confirm-modal'

interface Category {
  id: string
  name: string
  color: string
  description?: string
  products_count?: number
}

interface ProductCategoryManagerProps {
  isOpen: boolean
  onClose: () => void
}

const colors = [
  '#3b82f6', '#22c55e', '#8b5cf6', '#f97316', '#ec4899',
  '#ef4444', '#eab308', '#06b6d4', '#84cc16', '#6366f1',
]

export function ProductCategoryManager({ isOpen, onClose }: ProductCategoryManagerProps) {
  const queryClient = useQueryClient()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)
  const [formData, setFormData] = useState({ name: '', color: colors[0], description: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['product-categories'],
    queryFn: () => productsApi.categories.list(),
    enabled: isOpen,
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => productsApi.categories.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] })
      toast.success('Categoria criada', 'A categoria foi criada com sucesso')
      resetForm()
    },
    onError: (error: any) => {
      toast.error('Erro', error.response?.data?.message || 'Erro ao criar categoria')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => productsApi.categories.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] })
      toast.success('Categoria atualizada', 'A categoria foi atualizada com sucesso')
      resetForm()
    },
    onError: (error: any) => {
      toast.error('Erro', error.response?.data?.message || 'Erro ao atualizar categoria')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productsApi.categories.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] })
      toast.success('Categoria excluída', 'A categoria foi excluída com sucesso')
      setCategoryToDelete(null)
    },
    onError: (error: any) => {
      toast.error('Erro', error.response?.data?.message || 'Erro ao excluir categoria')
    },
  })

  const categories: Category[] = data?.data?.data || []

  const resetForm = () => {
    setFormData({ name: '', color: colors[0], description: '' })
    setEditingCategory(null)
    setIsFormOpen(false)
  }

  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      color: category.color,
      description: category.description || '',
    })
    setIsFormOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data: formData })
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
          className="relative w-full max-w-xl bg-dark-card border border-dark-border rounded-xl shadow-2xl mx-4 max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-dark-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
                <Tag className="w-5 h-5 text-brand-500" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white font-display">
                  Categorias de Produtos
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Organize seus produtos
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
              </div>
            ) : (
              <>
                {/* Form */}
                {isFormOpen && (
                  <form onSubmit={handleSubmit} className="mb-6 p-4 bg-dark-hover rounded-xl">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Nome da Categoria
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="input"
                          placeholder="Ex: Eletrônicos"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
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
                                           ? 'border-white scale-110' 
                                           : 'border-transparent hover:scale-105'}`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={resetForm}
                          className="btn-ghost text-sm"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={isPending || !formData.name}
                          className="btn-primary text-sm"
                        >
                          {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                          {editingCategory ? 'Salvar' : 'Criar'}
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {/* Categories List */}
                {categories.length === 0 && !isFormOpen ? (
                  <div className="flex flex-col items-center justify-center h-48 text-center">
                    <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                      <Package className="w-8 h-8 text-slate-500" />
                    </div>
                    <h3 className="text-lg font-medium text-white">Nenhuma categoria</h3>
                    <p className="text-slate-400 mt-1">
                      Crie categorias para organizar seus produtos
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {categories.map((category) => (
                      <motion.div
                        key={category.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-between p-4 bg-dark-hover rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: category.color }}
                          />
                          <span className="text-white font-medium">{category.name}</span>
                          {category.products_count !== undefined && category.products_count > 0 && (
                            <span className="text-xs text-slate-500">
                              {category.products_count} produtos
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(category)}
                            className="p-2 text-slate-400 hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setCategoryToDelete(category)}
                            disabled={category.products_count !== undefined && category.products_count > 0}
                            className="p-2 text-slate-400 hover:text-danger-500 hover:bg-danger-500/10 rounded-lg transition-colors
                                       disabled:opacity-50 disabled:cursor-not-allowed"
                            title={category.products_count && category.products_count > 0 
                              ? 'Não é possível excluir categoria com produtos' 
                              : 'Excluir'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          {!isFormOpen && (
            <div className="p-6 border-t border-dark-border">
              <button
                onClick={() => setIsFormOpen(true)}
                className="btn-primary w-full"
              >
                <Plus className="w-5 h-5" />
                Nova Categoria
              </button>
            </div>
          )}
        </motion.div>

        {/* Delete Confirmation */}
        <ConfirmModal
          isOpen={!!categoryToDelete}
          onClose={() => setCategoryToDelete(null)}
          onConfirm={() => categoryToDelete && deleteMutation.mutate(categoryToDelete.id)}
          title="Excluir categoria"
          message={`Tem certeza que deseja excluir a categoria "${categoryToDelete?.name}"?`}
          confirmText="Excluir"
          isLoading={deleteMutation.isPending}
          variant="danger"
        />
      </div>
    </AnimatePresence>
  )
}

