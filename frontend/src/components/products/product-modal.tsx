'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Loader2, Package } from 'lucide-react'
import { productsApi } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { Product, ProductCategory } from '@/types'

interface ProductModalProps {
  isOpen: boolean
  onClose: () => void
  product?: Product | null
  categories: ProductCategory[]
  defaultType?: 'product' | 'service'
}

const UNITS = [
  { value: 'un', label: 'Unidade' },
  { value: 'kg', label: 'Quilograma' },
  { value: 'g', label: 'Grama' },
  { value: 'l', label: 'Litro' },
  { value: 'ml', label: 'Mililitro' },
  { value: 'm', label: 'Metro' },
  { value: 'cm', label: 'Centímetro' },
  { value: 'm2', label: 'Metro Quadrado' },
  { value: 'h', label: 'Hora' },
  { value: 'pc', label: 'Peça' },
  { value: 'cx', label: 'Caixa' },
  { value: 'pct', label: 'Pacote' },
]

export function ProductModal({ isOpen, onClose, product, categories, defaultType = 'product' }: ProductModalProps) {
  const queryClient = useQueryClient()
  const isEditing = !!product

  const [formData, setFormData] = useState({
    type: 'product' as 'product' | 'service',
    name: '',
    sku: '',
    description: '',
    price: '',
    cost: '',
    unit: 'un',
    stock_quantity: '0',
    min_stock: '0',
    category_id: '',
    is_active: true,
    track_stock: true,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (product) {
      setFormData({
        type: (product.type as 'product' | 'service') || 'product',
        name: product.name,
        sku: product.sku || '',
        description: product.description || '',
        price: String(product.price),
        cost: product.cost ? String(product.cost) : '',
        unit: product.unit,
        stock_quantity: String(product.stock_quantity),
        min_stock: String(product.min_stock),
        category_id: product.category_id || '',
        is_active: product.is_active,
        track_stock: product.track_stock,
      })
    } else {
      setFormData({
        type: defaultType,
        name: '',
        sku: '',
        description: '',
        price: '',
        cost: '',
        unit: defaultType === 'service' ? 'h' : 'un',
        stock_quantity: '0',
        min_stock: '0',
        category_id: '',
        is_active: true,
        track_stock: defaultType === 'service' ? false : true,
      })
    }
    setErrors({})
  }, [product, isOpen])

  const createMutation = useMutation({
    mutationFn: (data: any) => productsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      const label = formData.type === 'service' ? 'Serviço' : 'Produto'
      toast.success(`${label} criado`, `O ${label.toLowerCase()} foi criado com sucesso`)
      onClose()
    },
    onError: (error: any) => {
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors)
      }
      toast.error('Erro', error.response?.data?.message || 'Erro ao criar produto')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) => productsApi.update(product!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      const label = formData.type === 'service' ? 'Serviço' : 'Produto'
      toast.success(`${label} atualizado`, `O ${label.toLowerCase()} foi atualizado com sucesso`)
      onClose()
    },
    onError: (error: any) => {
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors)
      }
      toast.error('Erro', error.response?.data?.message || 'Erro ao atualizar produto')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const data = {
      type: formData.type,
      name: formData.name,
      sku: formData.sku || null,
      description: formData.description || null,
      price: parseFloat(formData.price),
      cost: formData.cost ? parseFloat(formData.cost) : null,
      unit: formData.unit,
      stock_quantity: parseInt(formData.stock_quantity),
      min_stock: parseInt(formData.min_stock) || 0,
      category_id: formData.category_id || null,
      is_active: formData.is_active,
      track_stock: formData.track_stock,
    }

    if (formData.type === 'service') {
      data.track_stock = false
      data.min_stock = 0
    }
    
    if (isEditing) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
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
          className="relative w-full max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl mx-4 max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900 z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Package className="w-5 h-5 text-emerald-500" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white font-display">
                {isEditing ? 'Editar' : 'Novo'} {formData.type === 'service' ? 'Serviço' : 'Produto'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {!isEditing && (
                <div>
                  <label className="block text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                    Tipo
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        type: e.target.value as 'product' | 'service',
                        unit: e.target.value === 'service' ? 'h' : formData.unit,
                        min_stock: e.target.value === 'service' ? '0' : formData.min_stock,
                        track_stock: e.target.value === 'service' ? false : formData.track_stock,
                      })
                    }
                    className="input"
                  >
                    <option value="product">Produto</option>
                    <option value="service">Serviço</option>
                  </select>
                </div>
              )}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                  Nome do {formData.type === 'service' ? 'Serviço' : 'Produto'} *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`input ${errors.name ? 'border-danger-500' : ''}`}
                  placeholder="Ex: Produto XYZ"
                  required
                />
                {errors.name && <p className="text-danger-500 text-sm mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                  SKU (Código)
                </label>
                <input
                  type="text"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  className={`input ${errors.sku ? 'border-danger-500' : ''}`}
                  placeholder="Ex: PROD-001"
                />
                {errors.sku && <p className="text-danger-500 text-sm mt-1">{errors.sku}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                  Categoria
                </label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="input"
                >
                  <option value="">Selecione uma categoria</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                Descrição
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input min-h-[80px]"
                placeholder="Descrição do produto..."
              />
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                  Preço de Venda *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className={`input pl-10 ${errors.price ? 'border-danger-500' : ''}`}
                    placeholder="0,00"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                  Custo
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    className="input pl-10"
                    placeholder="0,00"
                  />
                </div>
              </div>
            </div>

            {/* Stock */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                  Unidade *
                </label>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="input"
                  required
                >
                  {UNITS.map((unit) => (
                    <option key={unit.value} value={unit.value}>{unit.label}</option>
                  ))}
                </select>
              </div>

              {formData.type === 'product' ? (
                <>
              <div>
                <label className="block text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                  Quantidade em Estoque
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                  Estoque Mínimo
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.min_stock}
                  onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                  className="input"
                />
              </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                    Quantidade de Horas
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                    className="input"
                  />
                </div>
              )}
            </div>

            {/* Toggles */}
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-emerald-500 
                            focus:ring-emerald-500"
                />
                <span className="text-gray-700 dark:text-gray-300">Produto Ativo</span>
              </label>

              {formData.type === 'product' && (
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.track_stock}
                  onChange={(e) => setFormData({ ...formData, track_stock: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-emerald-500 
                            focus:ring-emerald-500"
                />
                <span className="text-gray-700 dark:text-gray-300">Controlar Estoque</span>
              </label>
              )}
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
                disabled={isPending}
                className="btn-primary"
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {isEditing ? 'Salvar' : 'Criar Produto'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

