'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X, Loader2 } from 'lucide-react'

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  isLoading?: boolean
  variant?: 'danger' | 'warning' | 'info'
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  isLoading = false,
  variant = 'danger',
}: ConfirmModalProps) {
  const variantStyles = {
    danger: {
      icon: 'bg-danger-500/10 text-danger-500',
      button: 'btn-danger',
    },
    warning: {
      icon: 'bg-warning-500/10 text-warning-500',
      button: 'bg-warning-500 hover:bg-warning-600 text-white',
    },
    info: {
      icon: 'bg-brand-500/10 text-brand-500',
      button: 'btn-primary',
    },
  }

  const styles = variantStyles[variant]

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md m-4"
          >
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6">
              {/* Icon */}
              <div className={`w-12 h-12 rounded-full ${styles.icon} flex items-center justify-center mx-auto`}>
                <AlertTriangle className="w-6 h-6" />
              </div>

              {/* Content */}
              <div className="text-center mt-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-2">{message}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-center gap-3 mt-6">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className="px-6 py-2.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors font-medium"
                >
                  {cancelText}
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={isLoading}
                  className={`${styles.button} px-6 inline-flex items-center justify-center gap-2 py-2.5 
                             font-medium rounded-lg transition-all duration-200
                             disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    confirmText
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

