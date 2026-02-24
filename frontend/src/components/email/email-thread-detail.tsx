'use client'

import { motion } from 'framer-motion'
import {
  X,
  Reply,
  ReplyAll,
  Forward,
  Archive,
  Trash2,
  Star,
  MoreVertical,
  Paperclip,
  ExternalLink,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmailThreadDetailProps {
  thread: any
  onClose: () => void
  onReply: () => void
  onForward: () => void
  onArchive: () => void
  onDelete: () => void
  onStar: () => void
}

export function EmailThreadDetail({
  thread,
  onClose,
  onReply,
  onForward,
  onArchive,
  onDelete,
  onStar,
}: EmailThreadDetailProps) {
  const messages = thread.messages || []
  const lastMessage = messages[messages.length - 1]

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {thread.subject}
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              {thread.linked_contact && (
                <a
                  href={`/clients?id=${thread.linked_contact.id}`}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                >
                  <User className="w-3 h-3" />
                  {thread.linked_contact.name}
                </a>
              )}
              {thread.linked_pipeline_card && (
                <a
                  href={`/crm/pipeline`}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Oportunidade
                </a>
              )}
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onReply}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors text-sm font-medium"
          >
            <Reply className="w-4 h-4" />
            Responder
          </button>
          
          <button
            onClick={onForward}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
          >
            <Forward className="w-4 h-4" />
            Encaminhar
          </button>

          <div className="flex-1" />

          <button
            onClick={onStar}
            className={cn(
              "p-2 rounded-lg transition-colors",
              thread.is_starred
                ? 'text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
            )}
            title={thread.is_starred ? 'Remover estrela' : 'Adicionar estrela'}
          >
            <Star className={cn("w-5 h-5", thread.is_starred && 'fill-yellow-500')} />
          </button>

          <button
            onClick={onArchive}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500"
            title="Arquivar"
          >
            <Archive className="w-5 h-5" />
          </button>

          <button
            onClick={onDelete}
            className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-500"
            title="Excluir"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((message: any, index: number) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6"
            >
              {/* Message Header */}
              <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                    {(message.from_name || message.from_email)[0].toUpperCase()}
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {message.from_name || message.from_email}
                      </span>
                      {message.is_sent && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                          Enviado
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      <span>{message.from_email}</span>
                    </div>
                    {message.to && message.to.length > 0 && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Para: {message.to.map((t: any) => t.email).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="text-sm text-gray-500 dark:text-gray-400 text-right">
                  <div>
                    {new Date(message.sent_at).toLocaleDateString('pt-BR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                  <div>
                    {new Date(message.sent_at).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>

              {/* Message Body */}
              <div className="prose dark:prose-invert max-w-none">
                {message.body_html ? (
                  <div
                    className="text-gray-700 dark:text-gray-300"
                    dangerouslySetInnerHTML={{ __html: message.body_html }}
                  />
                ) : (
                  <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {message.body_text}
                  </div>
                )}
              </div>

              {/* Attachments */}
              {message.attachments && message.attachments.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Paperclip className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {message.attachments.length} anexo(s)
                    </span>
                  </div>
                  <div className="space-y-2">
                    {message.attachments.map((attachment: any, i: number) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <Paperclip className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                          {attachment.name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {(attachment.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tracking Info */}
              {message.tracking && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    {message.tracking.opened_at && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span>
                          Aberto em {new Date(message.tracking.opened_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                    )}
                    {message.tracking.clicks_count > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span>{message.tracking.clicks_count} cliques</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
