'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, ArrowUpRight, ArrowDownRight, Plus, Trash2, Package, Search } from 'lucide-react'
import { financialApi, productsApi, clientsApi } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { FinancialTransaction, FinancialCategory, Product } from '@/types'
import { formatCurrency } from '@/lib/utils'

const transactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  category_id: z.string().min(1, 'Selecione uma categoria'),
  amount: z.number().min(0.01, 'Valor deve ser maior que zero'),
  description: z.string().min(1, 'Descrição é obrigatória'),
  date: z.string().min(1, 'Data é obrigatória'),
  due_date: z.string().optional(),
  client_id: z.string().optional(),
  notes: z.string().optional(),
})

type TransactionFormData = z.infer<typeof transactionSchema>

interface TransactionProduct {
  product_id: string
  product: Product
  quantity: number
  unit_price: number
  discount: number
  total: number
}

interface TransactionModalProps {
  isOpen: boolean
  onClose: () => void
  transaction?: FinancialTransaction | null
  categories: FinancialCategory[]
}

export function TransactionModal({ isOpen, onClose, transaction, categories }: TransactionModalProps) {
  const queryClient = useQueryClient()
  const isEditing = !!transaction
  
  const [selectedProducts, setSelectedProducts] = useState<TransactionProduct[]>([])
  const [showProductSearch, setShowProductSearch] = useState(false)
  const [productSearch, setProductSearch] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: 'income',
      date: new Date().toISOString().split('T')[0],
    },
  })

  const type = watch('type')
  const filteredCategories = categories.filter((c) => c.type === type)

  // Fetch products for income transactions
  const { data: productsData } = useQuery({
    queryKey: ['products-select', productSearch],
    queryFn: () => productsApi.list({ 
      per_page: 20, 
      'filter[search]': productSearch || undefined,
      'filter[is_active]': true,
    } as any),
    enabled: isOpen && type === 'income',
  })

  // Fetch clients
  const { data: clientsData } = useQuery({
    queryKey: ['clients-select'],
    queryFn: () => clientsApi.list({ per_page: 100, status: 'active' }),
    enabled: isOpen,
  })

  const products: Product[] = productsData?.data?.data || []
  const clients = clientsData?.data?.data || []

  // Calculate total from products
  const productsTotal = selectedProducts.reduce((sum, p) => sum + p.total, 0)

  useEffect(() => {
    if (transaction) {
      reset({
        type: transaction.type,
        category_id: transaction.category_id,
        amount: transaction.amount,
        description: transaction.description,
        date: transaction.date,
        due_date: transaction.due_date || '',
        client_id: transaction.client_id || '',
        notes: transaction.notes || '',
      })
      setSelectedProducts([])
    } else {
      reset({
        type: 'income',
        category_id: '',
        amount: 0,
        description: '',
        date: new Date().toISOString().split('T')[0],
        due_date: '',
        client_id: '',
        notes: '',
      })
      setSelectedProducts([])
    }
  }, [transaction, reset, isOpen])

  // Reset category when type changes
  useEffect(() => {
    if (!isEditing) {
      setValue('category_id', '')
    }
    setSelectedProducts([])
  }, [type, setValue, isEditing])

  // Update amount when products change
  useEffect(() => {
    if (selectedProducts.length > 0) {
      setValue('amount', productsTotal)
    }
  }, [productsTotal, setValue, selectedProducts.length])

  const addProduct = (product: Product) => {
    const existing = selectedProducts.find(p => p.product_id === product.id)
    if (existing) {
      setSelectedProducts(prev => 
        prev.map(p => p.product_id === product.id 
          ? { ...p, quantity: p.quantity + 1, total: (p.quantity + 1) * p.unit_price - p.discount }
          : p
        )
      )
    } else {
      setSelectedProducts(prev => [...prev, {
        product_id: product.id,
        product,
        quantity: 1,
        unit_price: product.price,
        discount: 0,
        total: product.price,
      }])
    }
    setShowProductSearch(false)
    setProductSearch('')
  }

  const updateProductQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeProduct(productId)
      return
    }
    setSelectedProducts(prev =>
      prev.map(p => p.product_id === productId
        ? { ...p, quantity, total: quantity * p.unit_price - p.discount }
        : p
      )
    )
  }

  const removeProduct = (productId: string) => {
    setSelectedProducts(prev => prev.filter(p => p.product_id !== productId))
  }

  const mutation = useMutation({
    mutationFn: (data: TransactionFormData) => {
      const payload = {
        ...data,
        due_date: data.due_date || undefined,
        client_id: data.client_id || undefined,
        notes: data.notes || undefined,
        products: selectedProducts.map(p => ({
          product_id: p.product_id,
          quantity: p.quantity,
          unit_price: p.unit_price,
          discount: p.discount,
          total: p.total,
        })),
      }
      
      if (isEditing) {
        return financialApi.transactions.update(transaction!.id, payload)
      }
      return financialApi.transactions.create(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success(
        isEditing ? 'Transação atualizada' : 'Transação criada',
        isEditing ? 'As alterações foram salvas' : 'A transação foi registrada com sucesso'
      )
      onClose()
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Ocorreu um erro'
      toast.error('Erro', message)
    },
  })

  const onSubmit = (data: TransactionFormData) => {
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
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4"
          >
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white font-display">
                  {isEditing ? 'Editar Transação' : 'Nova Transação'}
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
                {/* Type Toggle */}
                <div className="flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => setValue('type', 'income')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md font-medium transition-colors
                               ${type === 'income' 
                                 ? 'bg-emerald-500 text-white' 
                                 : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                  >
                    <ArrowUpRight className="w-5 h-5" />
                    Receita
                  </button>
                  <button
                    type="button"
                    onClick={() => setValue('type', 'expense')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md font-medium transition-colors
                               ${type === 'expense' 
                                 ? 'bg-red-500 text-white' 
                                 : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                  >
                    <ArrowDownRight className="w-5 h-5" />
                    Despesa
                  </button>
                </div>

                {/* Products Section (only for income) */}
                {type === 'income' && (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        Produtos da Venda
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowProductSearch(!showProductSearch)}
                        className="text-emerald-500 hover:text-emerald-600 text-sm flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar Produto
                      </button>
                    </div>

                    {/* Product Search */}
                    {showProductSearch && (
                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            className="input pl-9 text-sm"
                            placeholder="Buscar produto..."
                            autoFocus
                          />
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {products.map((product) => (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => addProduct(product)}
                              className="w-full flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors text-left"
                            >
                              <div>
                                <p className="text-sm text-gray-900 dark:text-white">{product.name}</p>
                                {product.sku && (
                                  <p className="text-xs text-gray-500">#{product.sku}</p>
                                )}
                              </div>
                              <span className="text-sm text-emerald-500">{formatCurrency(product.price)}</span>
                            </button>
                          ))}
                          {products.length === 0 && (
                            <p className="text-sm text-gray-500 text-center py-4">
                              {productSearch ? 'Nenhum produto encontrado' : 'Digite para buscar'}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Selected Products */}
                    {selectedProducts.length > 0 && (
                      <div className="space-y-2">
                        {selectedProducts.map((item) => (
                          <div 
                            key={item.product_id}
                            className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900 dark:text-white truncate">{item.product.name}</p>
                              <p className="text-xs text-gray-500">{formatCurrency(item.unit_price)} / {item.product.unit}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => updateProductQuantity(item.product_id, item.quantity - 1)}
                                className="w-6 h-6 flex items-center justify-center bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                              >
                                -
                              </button>
                              <span className="text-sm text-gray-900 dark:text-white w-8 text-center">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => updateProductQuantity(item.product_id, item.quantity + 1)}
                                className="w-6 h-6 flex items-center justify-center bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                              >
                                +
                              </button>
                            </div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white w-24 text-right">
                              {formatCurrency(item.total)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeProduct(item.product_id)}
                              className="p-1 text-gray-400 hover:text-red-500"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                          <span className="text-sm text-gray-500">Total dos Produtos</span>
                          <span className="text-lg font-bold text-emerald-500">{formatCurrency(productsTotal)}</span>
                        </div>
                      </div>
                    )}

                    {selectedProducts.length === 0 && !showProductSearch && (
                      <p className="text-sm text-gray-500 text-center py-2">
                        Adicione produtos para esta venda (opcional)
                      </p>
                    )}
                  </div>
                )}

                {/* Client Selection */}
                <div>
                  <label className="block text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                    Cliente <span className="text-gray-500">(opcional)</span>
                  </label>
                  <select {...register('client_id')} className="input">
                    <option value="">Selecione um cliente</option>
                    {clients.map((client: any) => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                    Valor
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      {...register('amount', { valueAsNumber: true })}
                      className={`input pl-10 ${errors.amount ? 'input-error' : ''}`}
                      placeholder="0,00"
                    />
                  </div>
                  {errors.amount && (
                    <p className="text-danger-500 text-sm mt-1">{errors.amount.message}</p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                    Descrição
                  </label>
                  <input
                    type="text"
                    {...register('description')}
                    className={`input ${errors.description ? 'input-error' : ''}`}
                    placeholder="Ex: Venda de produto"
                  />
                  {errors.description && (
                    <p className="text-danger-500 text-sm mt-1">{errors.description.message}</p>
                  )}
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                    Categoria
                  </label>
                  <select
                    {...register('category_id')}
                    className={`input ${errors.category_id ? 'input-error' : ''}`}
                  >
                    <option value="">Selecione uma categoria</option>
                    {filteredCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  {errors.category_id && (
                    <p className="text-danger-500 text-sm mt-1">{errors.category_id.message}</p>
                  )}
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                      Data
                    </label>
                    <input
                      type="date"
                      {...register('date')}
                      className={`input ${errors.date ? 'input-error' : ''}`}
                    />
                    {errors.date && (
                      <p className="text-danger-500 text-sm mt-1">{errors.date.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                      Vencimento <span className="text-gray-500">(opcional)</span>
                    </label>
                    <input
                      type="date"
                      {...register('due_date')}
                      className="input"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                    Observações <span className="text-gray-500">(opcional)</span>
                  </label>
                  <textarea
                    {...register('notes')}
                    rows={3}
                    className="input resize-none"
                    placeholder="Anotações sobre a transação..."
                  />
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
                      'Criar Transação'
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
