'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertOctagon,
  X,
  Loader2,
  ShieldAlert,
  CreditCard,
  Brain,
  Mail,
  Kanban,
  Send,
  Users,
  FileText,
  BarChart3,
} from 'lucide-react'

interface CancelSubscriptionModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
  planName: string
  activeAddons: {
    ai: boolean
    email: boolean
    pipelines: boolean
    emailCampaigns: boolean
  }
}

const CANCELLATION_REASONS = [
  'O preço está muito alto',
  'Não estou usando o suficiente',
  'Mudando para outro serviço',
  'Funcionalidades não atendem minhas necessidades',
  'Problemas técnicos frequentes',
  'Outro motivo',
] as const

export function CancelSubscriptionModal({
  isOpen,
  onClose,
  onConfirm,
  planName,
  activeAddons,
}: CancelSubscriptionModalProps) {
  const [confirmText, setConfirmText] = useState('')
  const [selectedReason, setSelectedReason] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const isConfirmEnabled = confirmText === 'CANCELAR' && selectedReason !== ''

  const handleConfirm = async () => {
    if (!isConfirmEnabled) return
    setIsLoading(true)
    try {
      await onConfirm(selectedReason)
    } finally {
      setIsLoading(false)
      setConfirmText('')
      setSelectedReason('')
    }
  }

  const handleClose = () => {
    if (isLoading) return
    setConfirmText('')
    setSelectedReason('')
    onClose()
  }

  const lostFeatures = [
    { icon: CreditCard, label: `Plano ${planName} e todos os seus recursos`, always: true },
    { icon: Brain, label: 'Inteligência Artificial (chat, propostas, insights)', always: false, active: activeAddons.ai },
    { icon: Mail, label: 'Módulo de Email integrado', always: false, active: activeAddons.email },
    { icon: Kanban, label: 'Pipelines adicionais de vendas', always: false, active: activeAddons.pipelines },
    { icon: Send, label: 'Campanhas de e-mail em massa', always: false, active: activeAddons.emailCampaigns },
    { icon: Users, label: 'Limite expandido de usuários, clientes e produtos', always: true },
    { icon: FileText, label: 'Histórico de transações além do limite gratuito', always: true },
    { icon: BarChart3, label: 'Relatórios avançados', always: true },
  ].filter(f => f.always || f.active)

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg m-4 max-h-[90vh] overflow-auto"
          >
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-red-200 dark:border-red-900/50">
              {/* Header */}
              <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-t-2xl p-5 relative">
                <button
                  onClick={handleClose}
                  disabled={isLoading}
                  className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                    <AlertOctagon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Cancelar Assinatura</h2>
                    <p className="text-red-100 text-sm">Esta ação é irreversível</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-5">
                {/* Warning Banner */}
                <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl">
                  <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                      Atenção: esta ação não pode ser desfeita
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      Ao cancelar, sua assinatura será encerrada e você será movido para o plano gratuito.
                      Todos os add-ons ativos serão desativados imediatamente.
                    </p>
                  </div>
                </div>

                {/* What you'll lose */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    Você perderá acesso a:
                  </h4>
                  <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                    {lostFeatures.map((feature) => (
                      <div key={feature.label} className="flex items-center gap-2.5 text-sm">
                        <X className="w-4 h-4 text-red-500 flex-shrink-0" />
                        <feature.icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-gray-700 dark:text-gray-300">{feature.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reason selection */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    Por que você está cancelando?
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {CANCELLATION_REASONS.map((reason) => (
                      <button
                        key={reason}
                        onClick={() => setSelectedReason(reason)}
                        className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${
                          selectedReason === reason
                            ? 'border-red-400 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 font-medium'
                            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Confirmation input */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    Para confirmar, digite <span className="text-red-600 dark:text-red-400 font-mono">CANCELAR</span> abaixo:
                  </h4>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                    placeholder="Digite CANCELAR"
                    disabled={isLoading}
                    className="w-full px-4 py-3 rounded-xl border-2 text-center font-mono text-lg tracking-widest transition-colors
                      border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 
                      text-gray-900 dark:text-white placeholder-gray-400
                      focus:outline-none focus:border-red-400 dark:focus:border-red-500
                      disabled:opacity-50"
                    autoComplete="off"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleClose}
                    disabled={isLoading}
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 
                      text-gray-700 dark:text-gray-300 font-medium 
                      hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors
                      disabled:opacity-50"
                  >
                    Manter Assinatura
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={!isConfirmEnabled || isLoading}
                    className="flex-1 px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2
                      disabled:opacity-40 disabled:cursor-not-allowed
                      bg-red-600 hover:bg-red-700 text-white"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Cancelando...
                      </>
                    ) : (
                      'Confirmar Cancelamento'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
