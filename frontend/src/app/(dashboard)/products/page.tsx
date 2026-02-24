'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Plus,
  Search,
  Package,
  AlertTriangle,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Tag,
  TrendingUp,
  Archive,
  DollarSign,
} from 'lucide-react'
import { productsApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'
import { Product } from '@/types'
import { ProductModal } from '@/components/products/product-modal'
import { ProductCategoryManager } from '@/components/products/product-category-manager'
import { ConfirmModal } from '@/components/ui/confirm-modal'

export default function ProductsPage() {
  const queryClient = useQueryClient()
  const { canEdit } = usePermissions()
  const canEditProducts = canEdit()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'low_stock'>('all')
  const [page, setPage] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newItemType, setNewItemType] = useState<'product' | 'service'>('product')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['products', { page, search, category: categoryFilter, status: statusFilter }],
    queryFn: () => productsApi.list({
      page,
      per_page: 15,
      'filter[search]': search || undefined,
      'filter[category_id]': categoryFilter || undefined,
      'filter[is_active]': statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
      'filter[low_stock]': statusFilter === 'low_stock' ? true : undefined,
    } as any),
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['product-categories'],
    queryFn: () => productsApi.categories.list(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Produto excluído', 'O produto foi excluído com sucesso')
      setProductToDelete(null)
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Erro ao excluir produto'
      toast.error('Erro', message)
    },
  })

  const products: Product[] = data?.data?.data || []
  const summary = data?.data?.summary || {
    total_products: 0,
    active_products: 0,
    low_stock_count: 0,
    total_stock_value: 0,
  }
  const meta = data?.data?.meta
  const categories = categoriesData?.data?.data || []

  const handleEdit = (product: Product) => {
    setSelectedProduct(product)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedProduct(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-display">Produtos & Serviços</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Gerencie seu catálogo de produtos e serviços</p>
        </div>

        {canEditProducts && (
          <div className="flex items-center gap-2">
            <select
              value={newItemType}
              onChange={(e) => setNewItemType(e.target.value as 'product' | 'service')}
              className="input w-40"
              title="Tipo"
            >
              <option value="product">Produto</option>
              <option value="service">Serviço</option>
            </select>
            <button
              onClick={() => setIsCategoryManagerOpen(true)}
              className="btn-ghost"
              title="Gerenciar Categorias"
            >
              <Tag className="w-5 h-5" />
              <span className="hidden sm:inline">Categorias</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-ghost"
              title="Importar CSV"
            >
              <span className="hidden sm:inline">Importar CSV</span>
            </button>
            <button
              onClick={async () => {
                try {
                  const response = await productsApi.exportCsv()
                  const blob = new Blob([response.data], { type: 'text/csv' })
                  const url = window.URL.createObjectURL(blob)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = 'produtos-servicos.csv'
                  document.body.appendChild(link)
                  link.click()
                  link.remove()
                  window.URL.revokeObjectURL(url)
                } catch (error: any) {
                  toast.error('Erro', error.response?.data?.message || 'Erro ao exportar CSV')
                }
              }}
              className="btn-ghost"
              title="Exportar CSV"
            >
              <span className="hidden sm:inline">Exportar CSV</span>
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn-primary"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Novo {newItemType === 'service' ? 'Serviço' : 'Produto'}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={async (e) => {
                const input = e.currentTarget
                const file = input.files?.[0]
                if (!file) return
                try {
                  await productsApi.importCsv(file)
                  queryClient.invalidateQueries({ queryKey: ['products'] })
                  toast.success('Importação concluída', 'CSV processado com sucesso')
                } catch (error: any) {
                  toast.error('Erro', error.response?.data?.message || 'Erro ao importar CSV')
                } finally {
                  if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                  } else {
                    input.value = ''
                  }
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
              <Package className="w-5 h-5 text-brand-500" />
            </div>
            <span className="badge badge-info">Total</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-3">{summary.total_products}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">produtos cadastrados</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-success-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-success-500" />
            </div>
            <span className="badge badge-success">Ativos</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-3">{summary.active_products}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">produtos ativos</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-warning-500/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-warning-500" />
            </div>
            <span className="badge badge-warning">Estoque Baixo</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-3">{summary.low_stock_count}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">precisam reposição</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-accent-500/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-accent-500" />
            </div>
            <span className="badge badge-info">Valor em Estoque</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-3">{formatCurrency(summary.total_stock_value)}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">valor total</p>
        </div>
      </div>

      {/* Status Filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors
                     ${statusFilter === 'all' 
                       ? 'bg-emerald-500 text-white' 
                       : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
        >
          Todos ({summary.total_products})
        </button>
        <button
          onClick={() => setStatusFilter('active')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2
                     ${statusFilter === 'active'
                       ? 'bg-emerald-500 text-white' 
                       : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
        >
          <TrendingUp className="w-4 h-4" />
          Ativos ({summary.active_products})
        </button>
        <button
          onClick={() => setStatusFilter('low_stock')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2
                     ${statusFilter === 'low_stock'
                       ? 'bg-amber-500 text-white' 
                       : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
        >
          <AlertTriangle className="w-4 h-4" />
          Estoque Baixo ({summary.low_stock_count})
        </button>
        <button
          onClick={() => setStatusFilter('inactive')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2
                     ${statusFilter === 'inactive'
                       ? 'bg-gray-500 text-white' 
                       : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
        >
          <Archive className="w-4 h-4" />
          Inativos
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 dark:text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome, SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="input w-full sm:w-48"
          >
            <option value="">Todas categorias</option>
            {categories.map((cat: any) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Grid */}
      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-gray-500 dark:text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Nenhum produto encontrado</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {search ? 'Tente uma busca diferente' : 'Comece cadastrando seu primeiro produto'}
            </p>
            {!search && canEditProducts && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="btn-primary mt-4"
              >
                <Plus className="w-5 h-5" />
                Novo Produto
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-dark-border">
            {products.map((product) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 hover:bg-gray-50 dark:bg-gray-800 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
                                   ${product.is_active ? 'bg-brand-500/10' : 'bg-slate-500/10'}`}>
                      <Package className={`w-6 h-6 ${product.is_active ? 'text-brand-500' : 'text-gray-500 dark:text-gray-400'}`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 dark:text-white truncate">{product.name}</p>
                        {product.sku && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">#{product.sku}</span>
                        )}
                        {product.type === 'service' && (
                          <span className="badge badge-info text-xs">Serviço</span>
                        )}
                        {!product.is_active && (
                          <span className="badge badge-secondary text-xs">Inativo</span>
                        )}
                        {product.track_stock && product.stock_quantity <= product.min_stock && (
                          <span className="badge badge-warning text-xs flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Estoque baixo
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {product.category && (
                          <span 
                            className="px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{ 
                              backgroundColor: `${product.category.color}20`,
                              color: product.category.color,
                            }}
                          >
                            {product.category.name}
                          </span>
                        )}
                        <span>Estoque: {product.stock_quantity} {product.unit}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(product.price)}</p>
                      {product.cost && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Custo: {formatCurrency(product.cost)}
                        </p>
                      )}
                    </div>

                    {canEditProducts && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(product)}
                          className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white hover:bg-gray-100 dark:bg-gray-800 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setProductToDelete(product)}
                          className="p-2 text-gray-500 dark:text-gray-400 hover:text-danger-500 hover:bg-danger-500/10 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {meta && meta.last_page > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Mostrando {(meta.current_page - 1) * meta.per_page + 1} a{' '}
              {Math.min(meta.current_page * meta.per_page, meta.total)} de {meta.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="btn-ghost text-sm disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === meta.last_page}
                className="btn-ghost text-sm disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Product Modal */}
      <ProductModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        product={selectedProduct}
        categories={categories}
        defaultType={newItemType}
      />

      {/* Category Manager */}
      <ProductCategoryManager
        isOpen={isCategoryManagerOpen}
        onClose={() => setIsCategoryManagerOpen(false)}
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!productToDelete}
        onClose={() => setProductToDelete(null)}
        onConfirm={() => productToDelete && deleteMutation.mutate(productToDelete.id)}
        title="Excluir produto"
        message={`Tem certeza que deseja excluir o produto "${productToDelete?.name}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        isLoading={deleteMutation.isPending}
        variant="danger"
      />
    </div>
  )
}

