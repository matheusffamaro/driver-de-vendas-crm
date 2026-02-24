'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Send,
  Check,
  XCircle,
  Calendar,
  User,
  Mail,
  Phone,
  MapPin,
  Package,
  FileText,
  Clock,
  DollarSign,
  Truck,
  CreditCard,
  AlertCircle,
} from 'lucide-react'

interface QuoteDetailModalProps {
  quote: any
  onClose: () => void
  onSend: () => void
  onApprove: () => void
  onReject: (reason: string) => void
}

const statusConfig = {
  draft: { label: 'Rascunho', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  sent: { label: 'Enviado', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  approved: { label: 'Aprovado', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  rejected: { label: 'Perdido', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  expired: { label: 'Expirado', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
}

export function QuoteDetailModal({ quote, onClose, onSend, onApprove, onReject }: QuoteDetailModalProps) {
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)
  }

  const formatDate = (date: string) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('pt-BR')
  }

  const formatDateTime = (date: string) => {
    if (!date) return '-'
    return new Date(date).toLocaleString('pt-BR')
  }

  const status = statusConfig[quote.status as keyof typeof statusConfig]
  const canSend = quote.status === 'draft' && quote.items?.length > 0
  const canApprove = quote.status === 'sent' || quote.status === 'draft'
  const canReject = quote.status === 'sent'

  const handleReject = () => {
    if (!rejectReason.trim()) {
      return
    }
    onReject(rejectReason)
    setShowRejectModal(false)
    setRejectReason('')
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-[calc(100vw-1rem)] sm:w-auto max-w-3xl mx-2 sm:mx-auto my-8"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{quote.quote_number}</h2>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${status?.color}`}>
                  {status?.label}
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Criado em {formatDateTime(quote.created_at)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
            {/* Client Info */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-500" />
                Cliente
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-sm text-gray-500">Nome</p>
                  <p className="font-medium text-gray-900 dark:text-white">{quote.client?.name || '-'}</p>
                </div>
                {quote.client?.email && (
                  <div>
                    <p className="text-sm text-gray-500">E-mail</p>
                    <p className="font-medium text-gray-900 dark:text-white flex items-center gap-1">
                      <Mail className="w-4 h-4 text-gray-400" />
                      {quote.client.email}
                    </p>
                  </div>
                )}
                {quote.client?.phone && (
                  <div>
                    <p className="text-sm text-gray-500">Telefone</p>
                    <p className="font-medium text-gray-900 dark:text-white flex items-center gap-1">
                      <Phone className="w-4 h-4 text-gray-400" />
                      {quote.client.phone}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Items */}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-500" />
                Itens do Orçamento
              </h3>
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Item</th>
                      <th className="text-center text-xs font-semibold text-gray-500 uppercase px-4 py-3">Qtd</th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-3">Preço Un.</th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-3">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {quote.items?.map((item: any) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 dark:text-white">{item.description}</p>
                          {item.sku && <p className="text-xs text-gray-500">{item.sku}</p>}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                          {formatCurrency(item.unit_price)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                          {formatCurrency(item.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="text-gray-900 dark:text-white">{formatCurrency(quote.subtotal)}</span>
                </div>
                {quote.discount_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">
                      Desconto {quote.discount_percent > 0 && `(${quote.discount_percent}%)`}
                    </span>
                    <span className="text-red-500">-{formatCurrency(quote.discount_amount)}</span>
                  </div>
                )}
                {quote.shipping_cost > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Frete</span>
                    <span className="text-gray-900 dark:text-white">{formatCurrency(quote.shipping_cost)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-gray-900 dark:text-white">Total</span>
                  <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(quote.total)}</span>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {quote.valid_until && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Validade</p>
                    <p className="font-medium text-gray-900 dark:text-white">{formatDate(quote.valid_until)}</p>
                  </div>
                </div>
              )}
              {quote.delivery_days && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <Truck className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Prazo de Entrega</p>
                    <p className="font-medium text-gray-900 dark:text-white">{quote.delivery_days} dias úteis</p>
                  </div>
                </div>
              )}
              {quote.payment_terms && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg sm:col-span-2">
                  <CreditCard className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Condições de Pagamento</p>
                    <p className="font-medium text-gray-900 dark:text-white">{quote.payment_terms}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            {quote.notes && (
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-500" />
                  Observações
                </h3>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{quote.notes}</p>
              </div>
            )}

            {/* Rejection Reason */}
            {quote.status === 'rejected' && quote.rejection_reason && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Motivo da Perda
                </h3>
                <p className="text-red-600 dark:text-red-300">{quote.rejection_reason}</p>
              </div>
            )}

            {/* Timeline */}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-500" />
                Histórico
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="w-2 h-2 rounded-full bg-gray-400" />
                  Criado em {formatDateTime(quote.created_at)} por {quote.creator?.name || 'Sistema'}
                </div>
                {quote.sent_at && (
                  <div className="flex items-center gap-2 text-blue-500">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    Enviado em {formatDateTime(quote.sent_at)}
                  </div>
                )}
                {quote.approved_at && (
                  <div className="flex items-center gap-2 text-emerald-500">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    Aprovado em {formatDateTime(quote.approved_at)}
                  </div>
                )}
                {quote.rejected_at && (
                  <div className="flex items-center gap-2 text-red-500">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    Rejeitado em {formatDateTime(quote.rejected_at)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          {(canSend || canApprove || canReject) && (
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              {canSend && (
                <button onClick={onSend} className="btn-secondary">
                  <Send className="w-5 h-5" />
                  Enviar por E-mail
                </button>
              )}
              {canReject && (
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors flex items-center gap-2"
                >
                  <XCircle className="w-5 h-5" />
                  Marcar como Perdido
                </button>
              )}
              {canApprove && (
                <button onClick={onApprove} className="btn-primary">
                  <Check className="w-5 h-5" />
                  Aprovar Venda
                </button>
              )}
            </div>
          )}
        </motion.div>

        {/* Reject Modal */}
        <AnimatePresence>
          {showRejectModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 flex items-center justify-center z-60"
              onClick={() => setShowRejectModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-md m-4"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  Motivo da Perda
                </h3>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Por que este orçamento foi perdido?"
                  rows={4}
                  className="input mb-4"
                />
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowRejectModal(false)}
                    className="btn-secondary"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={!rejectReason.trim()}
                    className="px-4 py-2 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
                  >
                    Confirmar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  )
}

