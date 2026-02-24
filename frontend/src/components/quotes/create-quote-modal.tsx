'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Plus,
  Trash2,
  Loader2,
  Package,
  Search,
} from 'lucide-react'
import { quotesApi } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

interface QuoteItem {
  id: string
  product_id?: string
  description: string
  sku?: string
  unit: string
  quantity: number
  unit_price: number
  discount_percent: number
  total: number
}

interface CreateQuoteModalProps {
  isOpen: boolean
  onClose: () => void
  clients: any[]
  products: any[]
  initialClientId?: string
  lockClient?: boolean
}

export function CreateQuoteModal({ isOpen, onClose, clients, products, initialClientId, lockClient = false }: CreateQuoteModalProps) {
  const queryClient = useQueryClient()
  const [clientId, setClientId] = useState('')
  const [clientSearch, setClientSearch] = useState('')

  useEffect(() => {
    if (isOpen && initialClientId) {
      const selected = clients.find((c) => c.id === initialClientId)
      setClientId(initialClientId)
      setClientSearch(selected?.name || '')
    }
  }, [isOpen, initialClientId, clients])
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [deliveryDays, setDeliveryDays] = useState('')
  const [discountPercent, setDiscountPercent] = useState('')
  const [shippingCost, setShippingCost] = useState('')
  const [items, setItems] = useState<QuoteItem[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [showProductDropdown, setShowProductDropdown] = useState(false)

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.email?.toLowerCase().includes(clientSearch.toLowerCase())
  )

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku?.toLowerCase().includes(productSearch.toLowerCase())
  )

  const createMutation = useMutation({
    mutationFn: (data: any) => quotesApi.create(data),
    onSuccess: () => {
      toast.success('Orçamento criado', 'Orçamento criado com sucesso!')
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      queryClient.invalidateQueries({ queryKey: ['quotes-stats'] })
      handleClose()
    },
    onError: (error: any) => {
      toast.error('Erro', error.response?.data?.message || 'Erro ao criar orçamento')
    },
  })

  const handleClose = () => {
    setClientId('')
    setClientSearch('')
    setValidUntil('')
    setNotes('')
    setPaymentTerms('')
    setDeliveryDays('')
    setDiscountPercent('')
    setShippingCost('')
    setItems([])
    setProductSearch('')
    onClose()
  }

  const addProduct = (product: any) => {
    const newItem: QuoteItem = {
      id: crypto.randomUUID(),
      product_id: product.id,
      description: product.name,
      sku: product.sku,
      unit: product.unit || 'un',
      quantity: 1,
      unit_price: product.price || 0,
      discount_percent: 0,
      total: product.price || 0,
    }
    setItems([...items, newItem])
    setProductSearch('')
    setShowProductDropdown(false)
  }

  const addCustomItem = () => {
    const newItem: QuoteItem = {
      id: crypto.randomUUID(),
      description: '',
      unit: 'un',
      quantity: 1,
      unit_price: 0,
      discount_percent: 0,
      total: 0,
    }
    setItems([...items, newItem])
  }

  const updateItem = (id: string, field: string, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value }
        // Recalculate total
        const subtotal = updated.quantity * updated.unit_price
        const discount = subtotal * (updated.discount_percent / 100)
        updated.total = subtotal - discount
        return updated
      }
      return item
    }))
  }

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id))
  }

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + item.total, 0)
  }

  const calculateDiscount = () => {
    const subtotal = calculateSubtotal()
    return subtotal * (parseFloat(discountPercent) || 0) / 100
  }

  const calculateTotal = () => {
    const subtotal = calculateSubtotal()
    const discount = calculateDiscount()
    const shipping = parseFloat(shippingCost) || 0
    return subtotal - discount + shipping
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!clientId) {
      toast.error('Erro', 'Selecione um cliente')
      return
    }

    if (items.length === 0) {
      toast.error('Erro', 'Adicione pelo menos um item')
      return
    }

    const hasInvalidItems = items.some(item => !item.description || item.quantity <= 0)
    if (hasInvalidItems) {
      toast.error('Erro', 'Preencha todos os itens corretamente')
      return
    }

    createMutation.mutate({
      client_id: clientId,
      valid_until: validUntil || undefined,
      notes: notes || undefined,
      payment_terms: paymentTerms || undefined,
      delivery_days: deliveryDays ? parseInt(deliveryDays) : undefined,
      discount_percent: discountPercent ? parseFloat(discountPercent) : undefined,
      shipping_cost: shippingCost ? parseFloat(shippingCost) : undefined,
      items: items.map(item => ({
        product_id: item.product_id,
        description: item.description,
        sku: item.sku,
        unit: item.unit,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent,
      })),
    })
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto"
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-4xl my-8"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Novo Orçamento</h2>
            <button
              onClick={handleClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Client Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Cliente *
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar cliente..."
                    value={clientSearch}
                    onChange={(e) => {
                      setClientSearch(e.target.value)
                      setClientId('')
                    }}
                    disabled={lockClient}
                    className="input pl-10 disabled:opacity-70"
                  />
                </div>
                {!lockClient && clientSearch && !clientId && filteredClients.length > 0 && (
                  <div className="mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg max-h-40 overflow-y-auto">
                    {filteredClients.slice(0, 5).map(client => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => {
                          setClientId(client.id)
                          setClientSearch(client.name)
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <p className="font-medium text-gray-900 dark:text-white">{client.name}</p>
                        <p className="text-sm text-gray-500">{client.email}</p>
                      </button>
                    ))}
                  </div>
                )}
                {clientId && (
                  <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">
                    ✓ Cliente selecionado
                  </p>
                )}
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Itens do Orçamento *
                  </label>
                </div>

                {/* Add Product */}
                <div className="relative mb-4">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar produto para adicionar..."
                        value={productSearch}
                        onChange={(e) => {
                          setProductSearch(e.target.value)
                          setShowProductDropdown(true)
                        }}
                        onFocus={() => setShowProductDropdown(true)}
                        className="input pl-10"
                      />
                      {showProductDropdown && productSearch && filteredProducts.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg max-h-40 overflow-y-auto z-10">
                          {filteredProducts.slice(0, 5).map(product => (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => addProduct(product)}
                              className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                              <p className="font-medium text-gray-900 dark:text-white">{product.name}</p>
                              <p className="text-sm text-gray-500">
                                {product.sku && `${product.sku} • `}
                                {formatCurrency(product.price || 0)}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={addCustomItem}
                      className="btn-secondary whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      Item Manual
                    </button>
                  </div>
                </div>

                {/* Items List */}
                {items.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    Adicione produtos ou itens manuais ao orçamento
                  </div>
                ) : (
                  <div className="space-y-3">
                    {items.map((item, index) => (
                      <div
                        key={item.id}
                        className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4"
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-6 gap-3">
                            <div className="sm:col-span-3">
                              <label className="block text-xs text-gray-500 mb-1">Descrição</label>
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                placeholder="Descrição do item"
                                className="input text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Qtd</label>
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                min="0"
                                step="0.01"
                                className="input text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Preço Un.</label>
                              <input
                                type="number"
                                value={item.unit_price}
                                onChange={(e) => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                                min="0"
                                step="0.01"
                                className="input text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Total</label>
                              <div className="h-10 flex items-center font-semibold text-gray-900 dark:text-white">
                                {formatCurrency(item.total)}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Summary */}
              {items.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Desconto (%)</label>
                      <input
                        type="number"
                        value={discountPercent}
                        onChange={(e) => setDiscountPercent(e.target.value)}
                        min="0"
                        max="100"
                        step="0.01"
                        placeholder="0"
                        className="input text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Frete (R$)</label>
                      <input
                        type="number"
                        value={shippingCost}
                        onChange={(e) => setShippingCost(e.target.value)}
                        min="0"
                        step="0.01"
                        placeholder="0,00"
                        className="input text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Prazo de Entrega (dias)</label>
                      <input
                        type="number"
                        value={deliveryDays}
                        onChange={(e) => setDeliveryDays(e.target.value)}
                        min="0"
                        placeholder="Ex: 15"
                        className="input text-sm"
                      />
                    </div>
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Subtotal</span>
                      <span className="text-gray-900 dark:text-white">{formatCurrency(calculateSubtotal())}</span>
                    </div>
                    {parseFloat(discountPercent) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Desconto ({discountPercent}%)</span>
                        <span className="text-red-500">-{formatCurrency(calculateDiscount())}</span>
                      </div>
                    )}
                    {parseFloat(shippingCost) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Frete</span>
                        <span className="text-gray-900 dark:text-white">{formatCurrency(parseFloat(shippingCost))}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-gray-900 dark:text-white">Total</span>
                      <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(calculateTotal())}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Additional Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Validade do Orçamento
                  </label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Condições de Pagamento
                  </label>
                  <input
                    type="text"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    placeholder="Ex: 50% entrada + 50% na entrega"
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Observações
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observações que aparecerão no orçamento..."
                  rows={3}
                  className="input"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button type="button" onClick={handleClose} className="btn-secondary">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="btn-primary"
              >
                {createMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    Criar Orçamento
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

