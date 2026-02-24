'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  X,
  Send,
  Paperclip,
  Bold,
  Italic,
  Link as LinkIcon,
  Loader2,
  ChevronDown,
} from 'lucide-react'
import { emailApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface EmailComposerProps {
  onClose: () => void
  onSent: () => void
  replyTo?: any
  forwardMessage?: any
  defaultTo?: string
}

export function EmailComposer({
  onClose,
  onSent,
  replyTo,
  forwardMessage,
  defaultTo,
}: EmailComposerProps) {
  const { user } = useAuthStore()
  
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [to, setTo] = useState(defaultTo || '')
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  // Fetch email accounts
  const { data: accountsData } = useQuery({
    queryKey: ['email', 'accounts'],
    queryFn: async () => {
      const response = await emailApi.accounts.list()
      return response.data
    },
  })

  const accounts = accountsData || []

  // Auto-select first account
  if (accounts.length > 0 && !selectedAccountId) {
    setSelectedAccountId(accounts[0].id)
  }

  // Send email mutation
  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAccountId) {
        throw new Error('Please select an email account')
      }
      if (!to) {
        throw new Error('Please enter at least one recipient')
      }
      if (!subject) {
        throw new Error('Please enter a subject')
      }

      const toList = to.split(',').map((email) => ({
        email: email.trim(),
      }))

      const ccList = cc
        ? cc.split(',').map((email) => ({ email: email.trim() }))
        : undefined

      const bccList = bcc
        ? bcc.split(',').map((email) => ({ email: email.trim() }))
        : undefined

      await emailApi.messages.send({
        account_id: selectedAccountId,
        to: toList,
        cc: ccList,
        bcc: bccList,
        subject,
        body_text: body,
        body_html: body.replace(/\n/g, '<br>'), // Simple conversion
        track_opens: true,
        track_clicks: true,
      })
    },
    onSuccess: () => {
      onSent()
    },
    onError: (error: any) => {
      toast.error('Erro ao enviar', error.message || 'Não foi possível enviar o email')
    },
  })

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden mx-2 sm:mx-auto"
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Novo Email
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {/* Account Selection */}
          {accounts.length > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 w-full sm:w-16 shrink-0">
                De:
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {accounts.map((account: any) => (
                  <option key={account.id} value={account.id}>
                    {account.account_name} ({account.email})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* To */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 w-full sm:w-16 shrink-0">
              Para:
            </label>
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <input
                type="text"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="email@example.com, outro@example.com"
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center gap-1">
                {!showCc && (
                  <button
                    onClick={() => setShowCc(true)}
                    className="text-sm text-blue-500 hover:text-blue-600"
                  >
                    Cc
                  </button>
                )}
                {!showBcc && (
                  <button
                    onClick={() => setShowBcc(true)}
                    className="text-sm text-blue-500 hover:text-blue-600"
                  >
                    Cco
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* CC */}
          {showCc && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 w-full sm:w-16 shrink-0">
                Cc:
              </label>
              <input
                type="text"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="email@example.com"
                className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* BCC */}
          {showBcc && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 w-full sm:w-16 shrink-0">
                Cco:
              </label>
              <input
                type="text"
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                placeholder="email@example.com"
                className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Subject */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 w-full sm:w-16 shrink-0">
              Assunto:
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Assunto do email"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Body */}
          <div className="mt-4">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Escreva sua mensagem aqui..."
              rows={12}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500"
              title="Anexar arquivo (em breve)"
              disabled
            >
              <Paperclip className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending || !to || !subject}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Enviar
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
