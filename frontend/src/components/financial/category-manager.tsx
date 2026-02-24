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
  ArrowUpRight,
  ArrowDownRight,
  Tag,
  AlertTriangle,
} from 'lucide-react'
import { financialApi } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { CategoryModal } from './category-modal'
import { ConfirmModal } from '@/components/ui/confirm-modal'

interface Category {
  id: string
  name: string
  type: 'income' | 'expense'
  color: string
  icon?: string
  transactions_count?: number
}

interface CategoryManagerProps {
  isOpen: boolean
  onClose: () => void
}

export function CategoryManager({ isOpen, onClose }: CategoryManagerProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'income' | 'expense'>('income')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => financialApi.categories.list(),
    enabled: isOpen,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => financialApi.categories.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Categoria excluída', 'A categoria foi excluída com sucesso')
      setCategoryToDelete(null)
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Erro ao excluir categoria'
      toast.error('Erro', message)
    },
  })

  const categories: Category[] = data?.data?.data || []
  const incomeCategories = categories.filter(c => c.type === 'income')
  const expenseCategories = categories.filter(c => c.type === 'expense')
  const displayCategories = activeTab === 'income' ? incomeCategories : expenseCategories

  const handleEdit = (category: Category) => {
    setSelectedCategory(category)
    setIsModalOpen(true)
  }

  const handleDelete = (category: Category) => {
    if (category.transactions_count && category.transactions_count > 0) {
      toast.error('Erro', `Esta categoria possui ${category.transactions_count} transações associadas e não pode ser excluída`)
      return
    }
    setCategoryToDelete(category)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedCategory(null)
  }

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
          className="relative w-full max-w-2xl bg-dark-card border border-dark-border rounded-xl shadow-2xl mx-4 max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-dark-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
                <Tag className="w-5 h-5 text-brand-500" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white font-display">
                  Gerenciar Categorias
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Organize suas receitas e despesas
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

          {/* Tabs */}
          <div className="px-6 pt-4">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('income')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                           ${activeTab === 'income'
                             ? 'bg-success-500/10 text-success-500 border border-success-500'
                             : 'bg-gray-100 dark:bg-gray-800 text-slate-400 hover:text-white border border-transparent'}`}
              >
                <ArrowUpRight className="w-4 h-4" />
                Receitas ({incomeCategories.length})
              </button>
              <button
                onClick={() => setActiveTab('expense')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                           ${activeTab === 'expense'
                             ? 'bg-danger-500/10 text-danger-500 border border-danger-500'
                             : 'bg-gray-100 dark:bg-gray-800 text-slate-400 hover:text-white border border-transparent'}`}
              >
                <ArrowDownRight className="w-4 h-4" />
                Despesas ({expenseCategories.length})
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
              </div>
            ) : displayCategories.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                  <Tag className="w-8 h-8 text-slate-500" />
                </div>
                <h3 className="text-lg font-medium text-white">
                  Nenhuma categoria de {activeTab === 'income' ? 'receita' : 'despesa'}
                </h3>
                <p className="text-slate-400 mt-1">
                  Crie sua primeira categoria para organizar suas transações
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {displayCategories.map((category) => (
                  <motion.div
                    key={category.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between p-4 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800/50/70 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <span 
                        className="px-3 py-1 rounded-full text-sm font-medium"
                        style={{ 
                          backgroundColor: `${category.color}20`,
                          color: category.color,
                        }}
                      >
                        {category.name}
                      </span>
                      {category.transactions_count !== undefined && category.transactions_count > 0 && (
                        <span className="text-xs text-slate-500">
                          {category.transactions_count} transações
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
                        onClick={() => handleDelete(category)}
                        disabled={category.transactions_count !== undefined && category.transactions_count > 0}
                        className="p-2 text-slate-400 hover:text-danger-500 hover:bg-danger-500/10 rounded-lg transition-colors
                                   disabled:opacity-50 disabled:cursor-not-allowed"
                        title={category.transactions_count && category.transactions_count > 0 
                          ? 'Não é possível excluir categoria com transações' 
                          : 'Excluir'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-dark-border">
            <button
              onClick={() => {
                setSelectedCategory(null)
                setIsModalOpen(true)
              }}
              className="btn-primary w-full"
            >
              <Plus className="w-5 h-5" />
              Nova Categoria de {activeTab === 'income' ? 'Receita' : 'Despesa'}
            </button>
          </div>
        </motion.div>

        {/* Category Modal */}
        <CategoryModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          category={selectedCategory}
          defaultType={activeTab}
        />

        {/* Delete Confirmation */}
        <ConfirmModal
          isOpen={!!categoryToDelete}
          onClose={() => setCategoryToDelete(null)}
          onConfirm={() => categoryToDelete && deleteMutation.mutate(categoryToDelete.id)}
          title="Excluir categoria"
          message={`Tem certeza que deseja excluir a categoria "${categoryToDelete?.name}"? Esta ação não pode ser desfeita.`}
          confirmText="Excluir"
          isLoading={deleteMutation.isPending}
          variant="danger"
        />
      </div>
    </AnimatePresence>
  )
}

