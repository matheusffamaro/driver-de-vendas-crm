'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Send, X, User, Calendar, Trash2, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Email {
  id: string
  to: string
  cc?: string
  bcc?: string
  subject: string
  body: string
  status: 'sent' | 'failed' | 'pending'
  sent_at: string
  user: { id: string; name: string }
}

interface CardEmailsProps {
  emails: Email[]
  onSend: (email: Partial<Email>) => void
  onDelete: (emailId: string) => void
  defaultTo?: string
  isLoading?: boolean
}

export function CardEmails({ emails, onSend, onDelete, defaultTo, isLoading = false }: CardEmailsProps) {
  const [showForm, setShowForm] = useState(false)
  const [newEmail, setNewEmail] = useState({
    to: defaultTo || '',
    cc: '',
    subject: '',
    body: '',
  })

  const handleSend = () => {
    if (newEmail.to && newEmail.subject && newEmail.body) {
      onSend(newEmail)
      setNewEmail({ to: defaultTo || '', cc: '', subject: '', body: '' })
      setShowForm(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Emails</h3>
          {emails.length > 0 && (
            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium rounded-full">
              {emails.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            showForm
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          <Plus className="w-4 h-4" />
          Enviar Email
        </button>
      </div>

      {/* Send Email Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800 space-y-3">
              <input
                type="email"
                value={newEmail.to}
                onChange={(e) => setNewEmail({ ...newEmail, to: e.target.value })}
                placeholder="Para: email@exemplo.com *"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
              />
              <input
                type="text"
                value={newEmail.cc}
                onChange={(e) => setNewEmail({ ...newEmail, cc: e.target.value })}
                placeholder="CC: (opcional)"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
              />
              <input
                type="text"
                value={newEmail.subject}
                onChange={(e) => setNewEmail({ ...newEmail, subject: e.target.value })}
                placeholder="Assunto *"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
              />
              <textarea
                value={newEmail.body}
                onChange={(e) => setNewEmail({ ...newEmail, body: e.target.value })}
                placeholder="Mensagem *"
                rows={6}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 resize-none"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowForm(false)
                    setNewEmail({ to: defaultTo || '', cc: '', subject: '', body: '' })
                  }}
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSend}
                  disabled={!newEmail.to || !newEmail.subject || !newEmail.body || isLoading}
                  className="flex items-center gap-2 px-4 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white disabled:text-gray-500 rounded-lg"
                >
                  <Send className="w-4 h-4" />
                  {isLoading ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emails List */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {emails.map((email) => (
            <motion.div
              key={email.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="group p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{email.subject}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Para: {email.to}</p>
                  </div>
                </div>
                <button
                  onClick={() => onDelete(email.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-3">{email.body}</p>

              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {email.user.name}
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(email.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </div>
                <span className={`px-2 py-0.5 rounded-full font-medium ${
                  email.status === 'sent' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                  email.status === 'failed' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                  'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                }`}>
                  {email.status === 'sent' ? 'Enviado' : email.status === 'failed' ? 'Falhou' : 'Pendente'}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {emails.length === 0 && !showForm && (
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-3">
            <Mail className="w-6 h-6 text-blue-500" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum email enviado</p>
          <p className="text-xs text-gray-400 mt-1">Clique em "Enviar Email" para começar</p>
        </div>
      )}
    </div>
  )
}
