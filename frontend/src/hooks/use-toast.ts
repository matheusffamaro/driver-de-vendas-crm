import { create } from 'zustand'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title?: string
  message?: string
  duration?: number
}

interface ToastState {
  toasts: Toast[]
  add: (toast: Omit<Toast, 'id'>) => void
  dismiss: (id: string) => void
  clear: () => void
}

export const useToast = create<ToastState>((set, get) => ({
  toasts: [],

  add: (toast) => {
    const id = Math.random().toString(36).slice(2)
    const duration = toast.duration ?? 5000

    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }))

    if (duration > 0) {
      setTimeout(() => {
        get().dismiss(id)
      }, duration)
    }
  },

  dismiss: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },

  clear: () => {
    set({ toasts: [] })
  },
}))

// Helper functions
export const toast = {
  success: (title: string, message?: string) =>
    useToast.getState().add({ type: 'success', title, message }),
  
  error: (title: string, message?: string) =>
    useToast.getState().add({ type: 'error', title, message }),
  
  warning: (title: string, message?: string) =>
    useToast.getState().add({ type: 'warning', title, message }),
  
  info: (title: string, message?: string) =>
    useToast.getState().add({ type: 'info', title, message }),
}

