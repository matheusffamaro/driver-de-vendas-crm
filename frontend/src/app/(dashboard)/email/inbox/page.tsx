'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail,
  Inbox,
  Star,
  Send,
  Archive,
  RefreshCw,
  Search,
  Plus,
  Filter,
  MoreVertical,
  Paperclip,
  Clock,
  ArrowLeft,
  Menu,
} from 'lucide-react'
import { emailApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from '@/hooks/use-toast'
import { EmailComposer } from '@/components/email/email-composer'
import { EmailThreadDetail } from '@/components/email/email-thread-detail'
import { cn } from '@/lib/utils'

type Filter = 'inbox' | 'unread' | 'starred' | 'sent' | 'archived'

export default function EmailInboxPage() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  
  const [activeFilter, setActiveFilter] = useState<Filter>('inbox')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [showComposer, setShowComposer] = useState(false)
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)

  // Fetch threads
  const { data: threadsData, isLoading } = useQuery({
    queryKey: ['email', 'threads', activeFilter, searchQuery],
    queryFn: async () => {
      const response = await emailApi.inbox.list({
        filter: activeFilter,
        search: searchQuery || undefined,
        per_page: 50,
      })
      return response.data
    },
  })

  // Fetch unread count
  const { data: unreadData } = useQuery({
    queryKey: ['email', 'unread-count'],
    queryFn: async () => {
      const response = await emailApi.inbox.getUnreadCount()
      return response.data
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Fetch selected thread details
  const { data: selectedThread } = useQuery({
    queryKey: ['email', 'thread', selectedThreadId],
    queryFn: async () => {
      if (!selectedThreadId) return null
      const response = await emailApi.inbox.get(selectedThreadId)
      return response.data
    },
    enabled: !!selectedThreadId,
  })

  // Mark as read/unread
  const markAsReadMutation = useMutation({
    mutationFn: ({ id, is_read }: { id: string; is_read: boolean }) =>
      emailApi.inbox.markAsRead(id, is_read),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email', 'threads'] })
      queryClient.invalidateQueries({ queryKey: ['email', 'unread-count'] })
    },
  })

  // Star/unstar
  const starMutation = useMutation({
    mutationFn: ({ id, is_starred }: { id: string; is_starred: boolean }) =>
      emailApi.inbox.star(id, is_starred),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email', 'threads'] })
    },
  })

  // Archive/unarchive
  const archiveMutation = useMutation({
    mutationFn: ({ id, is_archived }: { id: string; is_archived: boolean }) =>
      emailApi.inbox.archive(id, is_archived),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email', 'threads'] })
      toast.success('Thread archived', 'The thread has been moved to archive.')
      setSelectedThreadId(null)
    },
  })

  // Delete thread
  const deleteMutation = useMutation({
    mutationFn: (id: string) => emailApi.inbox.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email', 'threads'] })
      toast.success('Thread deleted', 'The thread has been permanently deleted.')
      setSelectedThreadId(null)
    },
  })

  // Sync all email accounts (fetch new emails from Gmail/Outlook), then refresh list
  const syncAllMutation = useMutation({
    mutationFn: async () => {
      const accountsRes = await emailApi.accounts.list()
      const accounts = Array.isArray(accountsRes?.data) ? accountsRes.data : (accountsRes?.data?.data ?? [])
      const active = accounts.filter((a: { is_active?: boolean }) => a.is_active !== false)
      for (const account of active) {
        await emailApi.accounts.sync(account.id)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email'] })
      toast.success('Sincronização concluída', 'Os e-mails mais recentes foram buscados.')
    },
    onError: (err: any) => {
      toast.error('Erro ao sincronizar', err?.response?.data?.error ?? err?.message)
    },
  })

  const threads = threadsData?.data || []
  const unreadCount = unreadData?.unread_count || 0

  const filters = [
    { id: 'inbox', label: 'Caixa de Entrada', icon: Inbox, count: unreadCount },
    { id: 'unread', label: 'Não lidos', icon: Mail, count: unreadCount },
    { id: 'starred', label: 'Com Estrela', icon: Star },
    { id: 'sent', label: 'Enviados', icon: Send },
    { id: 'archived', label: 'Arquivados', icon: Archive },
  ]

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setShowMobileSidebar(!showMobileSidebar)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0"
            >
              <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2 truncate">
              <Mail className="w-5 h-5 sm:w-7 sm:h-7 text-blue-500 flex-shrink-0" />
              <span className="hidden sm:inline">Sales Inbox</span>
              <span className="sm:hidden">Inbox</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar emails..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 w-48 lg:w-64 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={() => syncAllMutation.mutate()}
              disabled={syncAllMutation.isPending}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              title="Sincronizar e-mails"
            >
              <RefreshCw className={cn('w-5 h-5 text-gray-600 dark:text-gray-400', syncAllMutation.isPending && 'animate-spin')} />
            </button>

            <button
              onClick={() => setShowComposer(true)}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors font-medium text-sm sm:text-base"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Novo Email</span>
            </button>
          </div>
        </div>
        {/* Mobile search */}
        <div className="sm:hidden mt-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar emails..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile sidebar overlay */}
        {showMobileSidebar && (
          <div className="md:hidden fixed inset-0 z-30 bg-black/50" onClick={() => setShowMobileSidebar(false)} />
        )}
        {/* Sidebar */}
        <div className={cn(
          "fixed md:relative z-40 md:z-auto inset-y-0 left-0 md:inset-auto w-64 flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4 overflow-y-auto transition-transform md:translate-x-0",
          showMobileSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}>
          <div className="space-y-1">
            {filters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => { setActiveFilter(filter.id as Filter); setShowMobileSidebar(false) }}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors text-left",
                  activeFilter === filter.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                )}
              >
                <div className="flex items-center gap-3">
                  <filter.icon className="w-5 h-5" />
                  <span className="font-medium">{filter.label}</span>
                </div>
                {filter.count ? (
                  <span className={cn(
                    "px-2 py-0.5 text-xs font-medium rounded-full",
                    activeFilter === filter.id
                      ? 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  )}>
                    {filter.count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {/* Thread List */}
        <div className={cn(
          "w-full md:w-96 flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto",
          selectedThreadId && 'hidden md:block'
        )}>
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
          ) : threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Mail className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">Nenhum email encontrado</p>
              <p className="text-sm">Sua caixa de entrada está vazia</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {threads.map((thread: any) => (
                <button
                  key={thread.id}
                  onClick={() => setSelectedThreadId(thread.id)}
                  className={cn(
                    "w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors",
                    selectedThreadId === thread.id && 'bg-blue-50 dark:bg-blue-900/20',
                    !thread.is_read && 'bg-blue-50/30 dark:bg-blue-900/10'
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {!thread.is_read && (
                          <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                        )}
                        {thread.is_starred && (
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                        )}
                        <p className={cn(
                          "text-sm truncate",
                          !thread.is_read ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300'
                        )}>
                          {thread.participants?.[0] || 'Unknown'}
                        </p>
                      </div>
                      <p className={cn(
                        "text-sm truncate",
                        !thread.is_read ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'
                      )}>
                        {thread.subject}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 truncate mt-1">
                        {thread.snippet || 'No preview available'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 ml-2">
                      <span className="text-xs text-gray-500 dark:text-gray-500 whitespace-nowrap">
                        {new Date(thread.last_message_at).toLocaleDateString('pt-BR', { 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </span>
                      {thread.messages?.length > 1 && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {thread.messages.length}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Badges */}
                  <div className="flex items-center gap-2 mt-2">
                    {thread.linked_contact && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                        {thread.linked_contact.name}
                      </span>
                    )}
                    {thread.linked_pipeline_card && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                        Deal
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Thread Detail */}
        <div className={cn(
          "flex-1 bg-gray-50 dark:bg-gray-900 overflow-y-auto",
          !selectedThreadId && 'hidden md:flex md:flex-col'
        )}>
          {selectedThread ? (
            <div className="md:hidden flex items-center gap-2 p-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <button onClick={() => setSelectedThreadId(null)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{selectedThread.subject}</span>
            </div>
          ) : null}
          {selectedThread ? (
            <EmailThreadDetail
              thread={selectedThread}
              onClose={() => setSelectedThreadId(null)}
              onReply={() => {
                // TODO: Implement reply
              }}
              onForward={() => {
                // TODO: Implement forward
              }}
              onArchive={() => archiveMutation.mutate({ id: selectedThread.id, is_archived: true })}
              onDelete={() => deleteMutation.mutate(selectedThread.id)}
              onStar={() => starMutation.mutate({ id: selectedThread.id, is_starred: !selectedThread.is_starred })}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Mail className="w-24 h-24 mb-4 opacity-30" />
              <p className="text-lg font-medium">Selecione um email</p>
              <p className="text-sm">Escolha uma conversa para visualizar</p>
            </div>
          )}
        </div>
      </div>

      {/* Email Composer Modal */}
      <AnimatePresence>
        {showComposer && (
          <EmailComposer
            onClose={() => setShowComposer(false)}
            onSent={() => {
              setShowComposer(false)
              queryClient.invalidateQueries({ queryKey: ['email'] })
              toast.success('Email enviado', 'Seu email foi enviado com sucesso!')
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
