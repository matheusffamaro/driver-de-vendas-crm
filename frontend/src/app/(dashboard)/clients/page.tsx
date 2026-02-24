'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Mail,
  Phone,
  Building2,
  User as UserIcon,
  Edit,
  Trash2,
  Eye,
  Loader2,
} from 'lucide-react'
import { clientsApi } from '@/lib/api'
import { formatCurrency, formatPhone, getStatusColor, getStatusLabel } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'
import { Client } from '@/types'
import { ClientModal } from '@/components/clients/client-modal'
import { ClientDetailModal } from '@/components/clients/client-detail-modal'
import { ClientCustomFieldsModal } from '@/components/clients/client-custom-fields-modal'
import { ConfirmModal } from '@/components/ui/confirm-modal'

export default function ClientsPage() {
  const queryClient = useQueryClient()
  const { canEdit } = usePermissions()
  const canEditClients = canEdit()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCustomFieldsOpen, setIsCustomFieldsOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [deleteClient, setDeleteClient] = useState<Client | null>(null)
  const [viewClientId, setViewClientId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['clients', { page, search, status: statusFilter, type: typeFilter }],
    queryFn: () => clientsApi.list({
      page,
      per_page: 15,
      search: search || undefined,
      status: statusFilter || undefined,
    }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clientsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Cliente excluído', 'O cliente foi removido com sucesso')
      setDeleteClient(null)
    },
    onError: () => {
      toast.error('Erro', 'Não foi possível excluir o cliente')
    },
  })

  const clients = data?.data?.data || []
  const meta = data?.data?.meta

  const handleEdit = (client: Client) => {
    setSelectedClient(client)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedClient(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-display">Clientes</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Gerencie seus clientes e contatos</p>
        </div>

        {canEditClients && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCustomFieldsOpen(true)}
              className="btn-ghost"
              title="Campos personalizados"
            >
              <span className="hidden sm:inline">Campos personalizados</span>
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
                  const response = await clientsApi.exportCsv()
                  const blob = new Blob([response.data], { type: 'text/csv' })
                  const url = window.URL.createObjectURL(blob)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = 'clientes.csv'
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
              Novo Cliente
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
                  await clientsApi.importCsv(file)
                  queryClient.invalidateQueries({ queryKey: ['clients'] })
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

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 dark:text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome, email ou documento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input w-full sm:w-40"
          >
            <option value="">Todos status</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="input w-full sm:w-40"
          >
            <option value="">Todos tipos</option>
            <option value="individual">Pessoa Física</option>
            <option value="company">Pessoa Jurídica</option>
          </select>
        </div>
      </div>

      {/* Clients List */}
      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          </div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
              <UserIcon className="w-8 h-8 text-gray-500 dark:text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Nenhum cliente encontrado</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {search ? 'Tente uma busca diferente' : 'Comece adicionando seu primeiro cliente'}
            </p>
            {!search && canEditClients && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="btn-primary mt-4"
              >
                <Plus className="w-5 h-5" />
                Adicionar Cliente
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table for desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-500 dark:text-gray-400">Cliente</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-500 dark:text-gray-400">Contato</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-500 dark:text-gray-400">Tipo</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-500 dark:text-gray-400">Status</th>
                    <th className="text-right py-4 px-6 text-sm font-medium text-gray-500 dark:text-gray-400">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border">
                  {clients.map((client: Client) => (
                    <motion.tr
                      key={client.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center">
                            {client.type === 'company' ? (
                              <Building2 className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                            ) : (
                              <UserIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{client.name}</p>
                            {client.company_name && (
                              <p className="text-sm text-gray-500 dark:text-gray-400">{client.company_name}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="space-y-1">
                          {client.email && (
                            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                              <Mail className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                              {client.email}
                            </div>
                          )}
                          {client.phone && (
                            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                              <Phone className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                              {formatPhone(client.phone)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {getStatusLabel(client.type)}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`badge ${getStatusColor(client.status)}`}>
                          {getStatusLabel(client.status)}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setViewClientId(client.id)}
                            className="p-2 text-gray-500 dark:text-gray-400 hover:text-brand-500 hover:bg-brand-500/10 rounded-lg transition-colors"
                            title="Ver detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {canEditClients && (
                            <>
                              <button
                                onClick={() => handleEdit(client)}
                                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
                                title="Editar"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeleteClient(client)}
                                className="p-2 text-gray-500 dark:text-gray-400 hover:text-danger-500 hover:bg-danger-500/10 rounded-lg transition-colors"
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cards for mobile */}
            <div className="md:hidden divide-y divide-dark-border">
              {clients.map((client: Client) => (
                <div key={client.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center">
                        {client.type === 'company' ? (
                          <Building2 className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                        ) : (
                          <UserIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{client.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{client.email}</p>
                      </div>
                    </div>
                    <span className={`badge ${getStatusColor(client.status)}`}>
                      {getStatusLabel(client.status)}
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-4">
                    <button
                      onClick={() => setViewClientId(client.id)}
                      className="btn-ghost text-sm"
                    >
                      <Eye className="w-4 h-4" />
                      Ver
                    </button>
                    {canEditClients && (
                      <>
                        <button
                          onClick={() => handleEdit(client)}
                          className="btn-ghost text-sm"
                        >
                          <Edit className="w-4 h-4" />
                          Editar
                        </button>
                        <button
                          onClick={() => setDeleteClient(client)}
                          className="btn-ghost text-sm text-danger-500"
                        >
                          <Trash2 className="w-4 h-4" />
                          Excluir
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

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
          </>
        )}
      </div>

      {/* Client Modal */}
      <ClientModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        client={selectedClient}
      />

      {/* Custom Fields Modal */}
      <ClientCustomFieldsModal
        isOpen={isCustomFieldsOpen}
        onClose={() => setIsCustomFieldsOpen(false)}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteClient}
        onClose={() => setDeleteClient(null)}
        onConfirm={() => deleteClient && deleteMutation.mutate(deleteClient.id)}
        title="Excluir cliente"
        message={`Tem certeza que deseja excluir "${deleteClient?.name}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        isLoading={deleteMutation.isPending}
        variant="danger"
      />

      {/* Client Detail Modal */}
      <ClientDetailModal
        isOpen={!!viewClientId}
        onClose={() => setViewClientId(null)}
        clientId={viewClientId}
        onEdit={(client) => {
          setViewClientId(null)
          handleEdit(client)
        }}
      />
    </div>
  )
}

