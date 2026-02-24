'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, UserPlus, Mail } from 'lucide-react'
import { usersApi } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { Role } from '@/types'

const inviteSchema = z.object({
  email: z.string().email('E-mail inválido'),
  role_id: z.string().min(1, 'Selecione um papel'),
})

type InviteFormData = z.infer<typeof inviteSchema>

interface InviteUserModalProps {
  isOpen: boolean
  onClose: () => void
  roles: Role[]
}

export function InviteUserModal({ isOpen, onClose, roles }: InviteUserModalProps) {
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
  })

  // Filter out owner role from options
  const availableRoles = roles.filter((r) => r.slug !== 'owner')

  const mutation = useMutation({
    mutationFn: (data: InviteFormData) => usersApi.sendInvitation({ email: data.email, role_id: data.role_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['pending-invitations'] })
      toast.success('Convite enviado!', 'O usuário receberá um e-mail com o convite')
      reset()
      onClose()
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Não foi possível enviar o convite'
      toast.error('Erro', message)
    },
  })

  const onSubmit = (data: InviteFormData) => {
    mutation.mutate(data)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
            className="relative w-full max-w-md mx-auto my-4"
          >
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <UserPlus className="w-5 h-5 text-emerald-500" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white font-display">
                    Convidar Usuário
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                <p className="text-gray-500 text-sm">
                  Envie um convite por e-mail para adicionar um novo membro à sua equipe.
                </p>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      {...register('email')}
                      className={`input pl-10 ${errors.email ? 'input-error' : ''}`}
                      placeholder="usuario@empresa.com"
                    />
                  </div>
                  {errors.email && (
                    <p className="text-danger-500 text-sm mt-1">{errors.email.message}</p>
                  )}
                </div>

                {/* Role */}
                <div>
                  <label className="block text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                    Papel
                  </label>
                  <select
                    {...register('role_id')}
                    className={`input ${errors.role_id ? 'input-error' : ''}`}
                  >
                    <option value="">Selecione um papel</option>
                    {availableRoles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                  {errors.role_id && (
                    <p className="text-danger-500 text-sm mt-1">{errors.role_id.message}</p>
                  )}
                </div>

                {/* Role descriptions */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
                  <p className="text-xs text-gray-500 font-medium uppercase">Descrição dos papéis</p>
                  <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
                    <p><span className="text-emerald-600">Administrador:</span> Acesso total ao sistema</p>
                    <p><span className="text-purple-600">Gerente:</span> Gerencia equipe e operações</p>
                    <p><span className="text-blue-600">Vendedor:</span> Acesso às funcionalidades de vendas</p>
                    <p><span className="text-amber-600">Suporte:</span> Atendimento ao cliente</p>
                    <p><span className="text-gray-700 dark:text-gray-300">Visualizador:</span> Apenas visualização</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={mutation.isPending}
                    className="btn-primary"
                  >
                    {mutation.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Mail className="w-5 h-5" />
                        Enviar Convite
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

