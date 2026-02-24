'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { 
  X, 
  User, 
  Mail, 
  Phone, 
  FileText, 
  Building2,
  Calendar,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Pencil,
  ExternalLink,
  TrendingUp,
  Eye,
  Send,
  XCircle,
  CheckCircle2,
} from 'lucide-react'
import { clientsApi, productsApi } from '@/lib/api'
import { formatCurrency, formatDate, getStatusLabel } from '@/lib/utils'
import { Client, FinancialTransaction } from '@/types'
import { CreateQuoteModal } from '@/components/quotes/create-quote-modal'
import { useEffect, useState } from 'react'

interface ClientDetailModalProps {
  isOpen: boolean
  onClose: () => void
  clientId: string | null
  onEdit?: (client: Client) => void
  onViewTransaction?: (transaction: FinancialTransaction) => void
  onViewQuote?: (quote: any) => void
}

const statusColors = {
  pending: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-500/10',
  paid: 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-500/10',
  overdue: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-500/10',
  cancelled: 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-500/10',
}

const statusIcons = {
  pending: Clock,
  paid: CheckCircle,
  overdue: AlertTriangle,
  cancelled: X,
}

const quoteStatusColors: Record<string, string> = {
  draft: 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-500/10',
  sent: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-500/10',
  approved: 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-500/10',
  rejected: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-500/10',
  expired: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-500/10',
  converted: 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-500/10',
}

const quoteStatusLabels: Record<string, string> = {
  draft: 'Rascunho',
  sent: 'Enviado',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  expired: 'Expirado',
  converted: 'Convertido',
}

const quoteStatusIcons: Record<string, any> = {
  draft: FileText,
  sent: Send,
  approved: CheckCircle2,
  rejected: XCircle,
  expired: Clock,
  converted: DollarSign,
}

export function ClientDetailModal({ isOpen, onClose, clientId, onEdit, onViewTransaction, onViewQuote }: ClientDetailModalProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'info' | 'transactions' | 'quotes' | 'products'>('info')
  const [showQuoteModal, setShowQuoteModal] = useState(false)
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['client-detail', clientId],
    queryFn: () => clientsApi.get(clientId!),
    enabled: isOpen && !!clientId,
  })

  const { data: productsData } = useQuery({
    queryKey: ['products-list'],
    queryFn: () => productsApi.list({ per_page: 200, is_active: true }),
    enabled: isOpen,
  })
  const products = productsData?.data?.data || []

  const { data: customFieldsData } = useQuery({
    queryKey: ['client-custom-fields'],
    queryFn: () => clientsApi.customFields.list(),
    enabled: isOpen,
  })
  const customFields = customFieldsData?.data?.data || []

  // Handle nested response structure
  const responseData = data?.data
  const client = responseData?.data || responseData

  useEffect(() => {
    if (!client) return
    const tabsWithData = {
      transactions: !!client?.recent_transactions?.length,
      quotes: !!client?.quotes?.length,
      products: !!client?.products_bought?.length,
    }
    if (activeTab !== 'info' && !tabsWithData[activeTab as keyof typeof tabsWithData]) {
      setActiveTab('info')
    }
  }, [client, activeTab])

  const handleViewTransaction = (transaction: any) => {
    if (onViewTransaction) {
      onViewTransaction(transaction)
    } else {
      onClose()
      router.push(`/financial?transaction=${transaction.id}`)
    }
  }

  const handleViewAllTransactions = () => {
    onClose()
    router.push(`/financial?client=${clientId}`)
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
          className="relative w-[calc(100vw-1rem)] sm:w-auto max-w-4xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl mx-2 sm:mx-auto max-h-[90vh] overflow-hidden flex flex-col"
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-96">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-96 text-center p-6">
              <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Erro ao carregar cliente</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">Não foi possível carregar os dados do cliente.</p>
              <button onClick={onClose} className="btn-primary">Fechar</button>
            </div>
          ) : client ? (
            <>
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center">
                    {client.type === 'company' ? (
                      <Building2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <User className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white font-display">{client.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                                       ${client.status === 'active' 
                                         ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' 
                                         : 'bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400'}`}>
                        {client.status === 'active' ? 'Ativo' : 'Inativo'}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {client.type === 'company' ? 'Pessoa Jurídica' : 'Pessoa Física'}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 px-6 pt-4 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                {[
                  { id: 'info' as const, label: 'Informações', icon: User, show: true },
                  { id: 'transactions' as const, label: 'Transações', icon: DollarSign, show: !!client?.recent_transactions?.length },
                  { id: 'quotes' as const, label: 'Orçamentos', icon: FileText, show: !!client?.quotes?.length },
                  { id: 'products' as const, label: 'Produtos', icon: Package, show: !!client?.products_bought?.length },
                ].filter(tab => tab.show).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                               ${activeTab === tab.id 
                                 ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' 
                                 : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto p-6">
                {activeTab === 'info' && (
                  <div className="space-y-6">
                    {/* Stats Cards */}
                    {client.stats && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs">Total Vendas</span>
                          </div>
                          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(client.stats.total_revenue || 0)}
                          </p>
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                            <FileText className="w-4 h-4" />
                            <span className="text-xs">Transações</span>
                          </div>
                          <p className="text-lg font-bold text-gray-900 dark:text-white">
                            {client.stats.total_transactions || 0}
                          </p>
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                            <Clock className="w-4 h-4 text-amber-500" />
                            <span className="text-xs">Pendente</span>
                          </div>
                          <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                            {formatCurrency(client.stats.pending_amount || 0)}
                          </p>
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                            <Calendar className="w-4 h-4" />
                            <span className="text-xs">Última Compra</span>
                          </div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">
                            {client.stats.last_transaction_at 
                              ? formatDate(client.stats.last_transaction_at)
                              : 'Nunca'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Contact Info */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Dados de Contato</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {client.email && (
                          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <Mail className="w-5 h-5 text-gray-400" />
                            <div>
                              <p className="text-xs text-gray-500">E-mail</p>
                              <p className="text-sm text-gray-900 dark:text-white">{client.email}</p>
                            </div>
                          </div>
                        )}
                        {client.phone && (
                          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <Phone className="w-5 h-5 text-gray-400" />
                            <div>
                              <p className="text-xs text-gray-500">Telefone</p>
                              <p className="text-sm text-gray-900 dark:text-white">{client.phone}</p>
                            </div>
                          </div>
                        )}
                        {client.document && (
                          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <FileText className="w-5 h-5 text-gray-400" />
                            <div>
                              <p className="text-xs text-gray-500">{client.type === 'company' ? 'CNPJ' : 'CPF'}</p>
                              <p className="text-sm text-gray-900 dark:text-white">{client.document}</p>
                            </div>
                          </div>
                        )}
                        {client.company_name && (
                          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <Building2 className="w-5 h-5 text-gray-400" />
                            <div>
                              <p className="text-xs text-gray-500">Razão Social</p>
                              <p className="text-sm text-gray-900 dark:text-white">{client.company_name}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Custom Fields */}
                    {client.custom_fields && Object.keys(client.custom_fields).length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Campos personalizados</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {Object.entries(client.custom_fields).map(([key, value]) => {
                            const field = customFields.find((f: any) => f.field_key === key)
                            const label = field?.name || key
                            return (
                              <div key={key} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <p className="text-xs text-gray-500">{label}</p>
                                <p className="text-sm text-gray-900 dark:text-white">{String(value)}</p>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {client.notes && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Observações</h3>
                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <p className="text-sm text-gray-700 dark:text-gray-300">{client.notes}</p>
                        </div>
                      </div>
                    )}

                    {/* Created At */}
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Cliente cadastrado em {formatDate(client.created_at)}
                    </div>
                  </div>
                )}

                {activeTab === 'transactions' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                        Histórico de Transações
                      </h3>
                      {client.recent_transactions && client.recent_transactions.length > 0 && (
                        <button 
                          onClick={handleViewAllTransactions}
                          className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          Ver todas
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {client.recent_transactions && client.recent_transactions.length > 0 ? (
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                              <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">Data</th>
                              <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">Descrição</th>
                              <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">Produtos</th>
                              <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">Status</th>
                              <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">Valor</th>
                              <th className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">Ação</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {client.recent_transactions.map((transaction: any) => {
                              const StatusIcon = statusIcons[transaction.status as keyof typeof statusIcons] || Clock
                              return (
                                <tr 
                                  key={transaction.id}
                                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                                >
                                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                    {formatDate(transaction.date)}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-6 h-6 rounded flex items-center justify-center
                                                     ${transaction.type === 'income' 
                                                       ? 'bg-emerald-100 dark:bg-emerald-500/10' 
                                                       : 'bg-red-100 dark:bg-red-500/10'}`}>
                                        {transaction.type === 'income' ? (
                                          <ArrowUpRight className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                        ) : (
                                          <ArrowDownRight className="w-3 h-3 text-red-600 dark:text-red-400" />
                                        )}
                                      </div>
                                      <span className="text-sm text-gray-900 dark:text-white">{transaction.description}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    {transaction.product_items && transaction.product_items.length > 0 ? (
                                      <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                        <Package className="w-3 h-3" />
                                        {transaction.product_items.length} item(s)
                                      </span>
                                    ) : (
                                      <span className="text-xs text-gray-400">-</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                                                     ${statusColors[transaction.status as keyof typeof statusColors]}`}>
                                      <StatusIcon className="w-3 h-3" />
                                      {getStatusLabel(transaction.status)}
                                    </span>
                                  </td>
                                  <td className={`px-4 py-3 text-sm text-right font-medium ${
                                    transaction.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                                  }`}>
                                    {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <button
                                      onClick={() => handleViewTransaction(transaction)}
                                      className="p-1.5 text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 
                                               hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                                      title="Ver detalhes"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Nenhuma transação registrada</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'quotes' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                        Orçamentos do Cliente
                      </h3>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setShowQuoteModal(true)}
                          className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          Enviar proposta
                          <Send className="w-3 h-3" />
                        </button>
                        {client.quotes && client.quotes.length > 0 && (
                          <button 
                            onClick={() => {
                              onClose()
                              router.push(`/quotes?client=${clientId}`)
                            }}
                            className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                          >
                            Ver todos
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {client.quotes && client.quotes.length > 0 ? (
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                              <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">Número</th>
                              <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">Data</th>
                              <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">Status</th>
                              <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">Valor</th>
                              <th className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">Ação</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {client.quotes.map((quote: any) => {
                              const StatusIcon = quoteStatusIcons[quote.status] || FileText
                              return (
                                <tr 
                                  key={quote.id}
                                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                                >
                                  <td className="px-4 py-3">
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                                      {quote.quote_number}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                    {formatDate(quote.created_at)}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                                                     ${quoteStatusColors[quote.status] || quoteStatusColors.draft}`}>
                                      <StatusIcon className="w-3 h-3" />
                                      {quoteStatusLabels[quote.status] || quote.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right font-medium text-emerald-600 dark:text-emerald-400">
                                    {formatCurrency(quote.total)}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <button
                                      onClick={() => {
                                        if (onViewQuote) {
                                          onViewQuote(quote)
                                        } else {
                                          onClose()
                                          router.push(`/quotes?quote=${quote.id}`)
                                        }
                                      }}
                                      className="p-1.5 text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 
                                               hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                                      title="Ver detalhes"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Nenhum orçamento registrado</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'products' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Produtos Mais Comprados
                    </h3>

                    {client.products_bought && client.products_bought.length > 0 ? (
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                              <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">Produto</th>
                              <th className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">Quantidade</th>
                              <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {client.products_bought.map((product: any) => (
                              <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                      <Package className="w-4 h-4 text-gray-400" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-gray-900 dark:text-white">{product.name}</p>
                                      {product.sku && (
                                        <p className="text-xs text-gray-500">#{product.sku}</p>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    {product.total_quantity}x
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                    {formatCurrency(product.total_value)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Nenhum produto comprado ainda</p>
                      </div>
                    )}
                  </div>
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
                      onEdit(client)
                    }}
                    className="btn-primary"
                  >
                    <Pencil className="w-4 h-4" />
                    Editar
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-96 text-center p-6">
              <User className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Cliente não encontrado</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">O cliente solicitado não existe ou foi removido.</p>
              <button onClick={onClose} className="btn-primary">Fechar</button>
            </div>
          )}
        </motion.div>
      </div>

      {client && (
        <CreateQuoteModal
          isOpen={showQuoteModal}
          onClose={() => setShowQuoteModal(false)}
          clients={[client]}
          products={products}
          initialClientId={client.id}
          lockClient
        />
      )}
    </AnimatePresence>
  )
}
