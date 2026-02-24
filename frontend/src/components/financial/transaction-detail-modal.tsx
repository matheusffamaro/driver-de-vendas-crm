'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { 
  X, 
  ArrowUpRight, 
  ArrowDownRight, 
  Calendar,
  User,
  Tag,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  CreditCard,
  ExternalLink,
  Pencil,
  Package,
  Loader2,
} from 'lucide-react'
import { formatCurrency, formatDate, getStatusLabel } from '@/lib/utils'
import { financialApi } from '@/lib/api'

interface TransactionDetailModalProps {
  isOpen: boolean
  onClose: () => void
  transaction?: {
    id: string
    description: string
    amount: number
    type: 'income' | 'expense'
    status: 'pending' | 'paid' | 'overdue' | 'cancelled'
    date: string
    due_date?: string
    paid_at?: string
    payment_method?: string
    receipt_url?: string
    notes?: string
    client?: { id: string; name: string } | null
    category?: { id?: string; name: string; color: string } | null
    product_items?: Array<{
      id: string
      quantity: number
      unit_price: number
      total: number
      product: { id: string; name: string; sku?: string; unit: string }
    }>
  } | null
  transactionId?: string | null
  onEdit?: (transaction: any) => void
  onViewClient?: (clientId: string) => void
}

const statusIcons = {
  pending: Clock,
  paid: CheckCircle,
  overdue: AlertTriangle,
  cancelled: XCircle,
}

const statusColors = {
  pending: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-500/10',
  paid: 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-500/10',
  overdue: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-500/10',
  cancelled: 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-500/10',
}

export function TransactionDetailModal({ 
  isOpen, 
  onClose, 
  transaction: providedTransaction,
  transactionId,
  onEdit,
  onViewClient,
}: TransactionDetailModalProps) {
  const router = useRouter()
  
  // Fetch transaction details if only ID is provided
  const { data, isLoading } = useQuery({
    queryKey: ['transaction-detail', transactionId],
    queryFn: () => financialApi.transactions.get(transactionId!),
    enabled: isOpen && !!transactionId && !providedTransaction,
  })

  const transaction = providedTransaction || data?.data?.data

  if (!isOpen) return null

  const handleViewClient = (clientId: string) => {
    if (onViewClient) {
      onViewClient(clientId)
    } else {
      onClose()
      router.push(`/clients?view=${clientId}`)
    }
  }

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
          className="relative w-full max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
          ) : !transaction ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-6">
              <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Transação não encontrada</h3>
              <button onClick={onClose} className="btn-primary mt-4">Fechar</button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center
                                 ${transaction.type === 'income' 
                                   ? 'bg-emerald-100 dark:bg-emerald-500/10' 
                                   : 'bg-red-100 dark:bg-red-500/10'}`}>
                    {transaction.type === 'income' ? (
                      <ArrowUpRight className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <ArrowDownRight className="w-6 h-6 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white font-display">
                      Detalhes da Transação
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {transaction.type === 'income' ? 'Receita' : 'Despesa'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto p-6 space-y-6">
                {/* Amount */}
                <div className="text-center py-4">
                  <p className={`text-4xl font-bold ${
                    transaction.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                  </p>
                  <p className="text-lg text-gray-900 dark:text-white mt-2">{transaction.description}</p>
                </div>

                {/* Status */}
                <div className="flex items-center justify-center">
                  {(() => {
                    const status = transaction.status as keyof typeof statusIcons
                    const StatusIcon = statusIcons[status] || Clock
                    return (
                      <span className={`flex items-center gap-2 px-4 py-2 rounded-full ${statusColors[status] || statusColors.pending}`}>
                        <StatusIcon className="w-5 h-5" />
                        <span className="font-medium">{getStatusLabel(transaction.status)}</span>
                      </span>
                    )
                  })()}
                </div>

                {/* Products (if any) */}
                {transaction.product_items && transaction.product_items.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Produtos Vendidos
                    </h3>
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-2">Produto</th>
                            <th className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-2">Qtd</th>
                            <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-2">Unit.</th>
                            <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-2">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {transaction.product_items.map((item: any) => (
                            <tr key={item.id}>
                              <td className="px-4 py-2">
                                <p className="text-sm text-gray-900 dark:text-white">{item.product.name}</p>
                                {item.product.sku && (
                                  <p className="text-xs text-gray-500">#{item.product.sku}</p>
                                )}
                              </td>
                              <td className="px-4 py-2 text-center text-sm text-gray-900 dark:text-white">
                                {item.quantity} {item.product.unit}
                              </td>
                              <td className="px-4 py-2 text-right text-sm text-gray-500 dark:text-gray-400">
                                {formatCurrency(item.unit_price)}
                              </td>
                              <td className="px-4 py-2 text-right text-sm font-medium text-gray-900 dark:text-white">
                                {formatCurrency(item.total)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Date */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">Data</span>
                    </div>
                    <p className="text-gray-900 dark:text-white font-medium">{formatDate(transaction.date)}</p>
                  </div>

                  {/* Due Date */}
                  {transaction.due_date && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm">Vencimento</span>
                      </div>
                      <p className="text-gray-900 dark:text-white font-medium">{formatDate(transaction.due_date)}</p>
                    </div>
                  )}

                  {/* Category */}
                  {transaction.category && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                        <Tag className="w-4 h-4" />
                        <span className="text-sm">Categoria</span>
                      </div>
                      <span 
                        className="inline-flex px-3 py-1 rounded-full text-sm font-medium"
                        style={{ 
                          backgroundColor: `${transaction.category.color}20`,
                          color: transaction.category.color,
                        }}
                      >
                        {transaction.category.name}
                      </span>
                    </div>
                  )}

                  {/* Client */}
                  {transaction.client && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                        <User className="w-4 h-4" />
                        <span className="text-sm">Cliente</span>
                      </div>
                      <button
                        onClick={() => handleViewClient(transaction.client!.id)}
                        className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline flex items-center gap-1"
                      >
                        {transaction.client.name}
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Payment Date */}
                  {transaction.paid_at && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm">Pago em</span>
                      </div>
                      <p className="text-gray-900 dark:text-white font-medium">{formatDate(transaction.paid_at)}</p>
                    </div>
                  )}

                  {/* Payment Method */}
                  {transaction.payment_method && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                        <CreditCard className="w-4 h-4" />
                        <span className="text-sm">Forma de Pagamento</span>
                      </div>
                      <p className="text-gray-900 dark:text-white font-medium capitalize">{transaction.payment_method}</p>
                    </div>
                  )}
                </div>

                {/* Notes */}
                {transaction.notes && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                      <FileText className="w-4 h-4" />
                      <span className="text-sm">Observações</span>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300">{transaction.notes}</p>
                  </div>
                )}

                {/* Receipt */}
                {transaction.receipt_url && (
                  <a
                    href={transaction.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl
                               text-emerald-600 dark:text-emerald-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <ExternalLink className="w-5 h-5" />
                    Ver Comprovante
                  </a>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <button 
                  onClick={onClose} 
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors font-medium"
                >
                  Fechar
                </button>
                {onEdit && (
                  <button 
                    onClick={() => {
                      onClose()
                      onEdit(transaction)
                    }}
                    className="btn-primary"
                  >
                    <Pencil className="w-4 h-4" />
                    Editar
                  </button>
                )}
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
