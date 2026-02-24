'use client'

import { useToast, Toast } from '@/hooks/use-toast'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const colors = {
  success: 'bg-success-500',
  error: 'bg-danger-500',
  warning: 'bg-warning-500',
  info: 'bg-brand-500',
}

export function Toaster() {
  const { toasts, dismiss } = useToast()

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence mode="sync">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const Icon = icons[toast.type]
  const color = colors[toast.type]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      className="glass-card p-4 pr-12 min-w-[300px] max-w-[400px] relative overflow-hidden"
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${color}`} />
      
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 flex-shrink-0 ${color.replace('bg-', 'text-')}`} />
        <div className="flex-1 min-w-0">
          {toast.title && (
            <p className="font-medium text-slate-900 dark:text-white text-sm">
              {toast.title}
            </p>
          )}
          {toast.message && (
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              {toast.message}
            </p>
          )}
        </div>
      </div>
      
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  )
}

