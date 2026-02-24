'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Search,
  Mail,
  Shield,
  MoreHorizontal,
  Clock,
  Check,
  Loader2,
  UserPlus,
  Crown,
  ShieldCheck,
  Users as UsersIcon,
  User as UserIcon,
  RefreshCw,
  X,
  AlertCircle,
  Send,
  Pencil,
  Trash2,
} from 'lucide-react'
import { usersApi, rolesApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { usePermissionStore } from '@/stores/permission-store'
import { toast } from '@/hooks/use-toast'
import { InviteUserModal } from '@/components/users/invite-user-modal'
import Link from 'next/link'

const roleIcons: Record<string, any> = {
  admin: ShieldCheck,
  manager: Shield,
  sales: UserIcon,
  support: UsersIcon,
  viewer: UserIcon,
}

const roleColors: Record<string, string> = {
  admin: 'text-emerald-600 bg-emerald-500/10',
  manager: 'text-purple-600 bg-purple-500/10',
  sales: 'text-blue-600 bg-blue-500/10',
  support: 'text-amber-600 bg-amber-500/10',
  viewer: 'text-gray-500 dark:text-gray-400 bg-slate-500/10',
}

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  sales: 'Vendedor',
  support: 'Suporte',
  viewer: 'Visualizador',
}

export default function UsersPage() {
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuthStore()
  const { hasPermission, isAdmin, role } = usePermissionStore()
  const [search, setSearch] = useState('')
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'users' | 'invitations'>('users')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [editingUser, setEditingUser] = useState<any | null>(null)
  const [newRoleId, setNewRoleId] = useState<string>('')
  const [userToRemove, setUserToRemove] = useState<any | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['users', { search }],
    queryFn: () => usersApi.list({
      search: search || undefined,
    }),
  })

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesApi.list(),
  })

  const { data: invitationsData, isLoading: isLoadingInvitations } = useQuery({
    queryKey: ['pending-invitations'],
    queryFn: () => usersApi.pendingInvitations(),
  })

  const resendMutation = useMutation({
    mutationFn: (id: string) => usersApi.resendInvitation(id),
    onSuccess: () => {
      toast.success('Convite reenviado', 'O convite foi reenviado com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['pending-invitations'] })
    },
    onError: (error: any) => {
      toast.error('Erro', error.response?.data?.message || 'Erro ao reenviar convite.')
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => usersApi.cancelInvitation(id),
    onSuccess: () => {
      toast.success('Convite cancelado', 'O convite foi cancelado com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['pending-invitations'] })
    },
    onError: (error: any) => {
      toast.error('Erro', error.response?.data?.message || 'Erro ao cancelar convite.')
    },
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) => {
      console.log('Updating role:', { userId, roleId })
      return usersApi.updateRole(userId, roleId)
    },
    onSuccess: (response) => {
      console.log('Role update success:', response)
      toast.success('Papel atualizado', 'O papel do usuário foi atualizado com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setEditingUser(null)
      setNewRoleId('')
    },
    onError: (error: any) => {
      console.error('Role update error:', error.response?.data || error)
      toast.error('Erro', error.response?.data?.message || 'Erro ao atualizar papel.')
    },
  })

  const removeUserMutation = useMutation({
    mutationFn: (userId: string) => {
      console.log('Removing user:', userId)
      return usersApi.remove(userId)
    },
    onSuccess: (response) => {
      console.log('Remove user success:', response)
      toast.success('Usuário removido', 'O usuário foi removido da equipe.')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setUserToRemove(null)
    },
    onError: (error: any) => {
      console.error('Remove user error:', error.response?.data || error)
      toast.error('Erro', error.response?.data?.message || 'Erro ao remover usuário.')
      setUserToRemove(null)
    },
  })

  const users = data?.data?.data || []
  const roles = rolesData?.data?.data || []
  const invitations = invitationsData?.data?.data || []

  // Check if user can manage users
  const canManageUsers =
    isAdmin ||
    role?.slug === 'admin' ||
    currentUser?.is_super_admin ||
    hasPermission('users.edit') ||
    hasPermission('users.invite')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-display">Usuários</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Gerencie os membros da sua equipe</p>
        </div>

        {canManageUsers && (
          <div className="flex items-center gap-3">
            <Link
              href="/users/roles"
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-colors"
            >
              <Shield className="w-5 h-5" />
              Gerenciar Papéis
            </Link>
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="btn-primary"
            >
              <UserPlus className="w-5 h-5" />
              Convidar Usuário
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
              <UsersIcon className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{users.length}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Ativos</p>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{invitations.length}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Pendentes</p>
            </div>
          </div>
        </div>
        
        {['admin', 'manager'].map((slug) => {
          const count = users.filter((u: any) => u.role?.slug === slug).length
          const Icon = roleIcons[slug] || UserIcon
          const color = roleColors[slug] || roleColors.viewer
          const label = roleLabels[slug] || slug
          
          return (
            <div key={slug} className="stat-card">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{count}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 font-medium text-sm transition-colors relative ${
            activeTab === 'users'
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Usuários Ativos
          {activeTab === 'users' && (
            <motion.div
              layoutId="activeTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500"
            />
          )}
        </button>
        <button
          onClick={() => setActiveTab('invitations')}
          className={`px-4 py-2 font-medium text-sm transition-colors relative flex items-center gap-2 ${
            activeTab === 'invitations'
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Convites Pendentes
          {invitations.length > 0 && (
            <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {invitations.length}
            </span>
          )}
          {activeTab === 'invitations' && (
            <motion.div
              layoutId="activeTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500"
            />
          )}
        </button>
      </div>

      {/* Search - only show for users tab */}
      {activeTab === 'users' && (
        <div className="glass-card p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 dark:text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou e-mail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>
      )}

      {/* Content based on active tab */}
      <AnimatePresence mode="wait">
        {activeTab === 'users' ? (
          <motion.div
            key="users-list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-card overflow-visible"
          >
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                  <UsersIcon className="w-8 h-8 text-gray-500 dark:text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Nenhum usuário encontrado</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                  {search ? 'Tente uma busca diferente' : 'Convide membros para sua equipe'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {users.map((user: any) => {
                  const RoleIcon = roleIcons[user.role?.slug as keyof typeof roleIcons] || UserIcon
                  const roleColor = roleColors[user.role?.slug as keyof typeof roleColors] || roleColors.user
                  const isCurrentUser = user.id === currentUser?.id
                  
                  return (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                            {user.avatar_url ? (
                              <img 
                                src={user.avatar_url} 
                                alt={user.name}
                                className="w-12 h-12 rounded-full object-cover"
                              />
                            ) : (
                              <span className="text-lg font-medium text-gray-900 dark:text-white">
                                {user.name?.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900 dark:text-white truncate">{user.name}</p>
                              {isCurrentUser && (
                                <span className="badge badge-info text-xs">Você</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Mail className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                              <span className="text-sm text-gray-500 dark:text-gray-400 truncate">{user.email}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${roleColor}`}>
                            <RoleIcon className="w-4 h-4" />
                            <span className="text-sm font-medium">
                              {roleLabels[user.role?.slug as keyof typeof roleLabels] || 'Usuário'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-emerald-500">
                            <Check className="w-4 h-4" />
                            <span className="text-xs hidden sm:inline">Ativo</span>
                          </div>

                          {canManageUsers && !isCurrentUser && user.role?.slug !== 'owner' && (
                            <div className="relative">
                              <button 
                                onClick={() => setOpenMenuId(openMenuId === user.id ? null : user.id)}
                                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
                              >
                                <MoreHorizontal className="w-5 h-5" />
                              </button>
                              
                              <AnimatePresence>
                                {openMenuId === user.id && (
                                  <>
                                    {/* Overlay to close menu */}
                                    <div 
                                      className="fixed inset-0 z-40" 
                                      onClick={() => setOpenMenuId(null)}
                                    />
                                    <motion.div
                                      initial={{ opacity: 0, scale: 0.95 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      exit={{ opacity: 0, scale: 0.95 }}
                                      className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-visible"
                                    >
                                      <button
                                      onClick={() => {
                                        setEditingUser(user)
                                        setNewRoleId(user.role?.id || '')
                                        setOpenMenuId(null)
                                      }}
                                      className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                    >
                                      <Pencil className="w-4 h-4" />
                                      Alterar Papel
                                    </button>
                                    <button
                                      onClick={() => {
                                        setUserToRemove(user)
                                        setOpenMenuId(null)
                                      }}
                                      className="w-full flex items-center gap-3 px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                      Remover da Equipe
                                    </button>
                                  </motion.div>
                                  </>
                                )}
                              </AnimatePresence>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="invitations-list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-card overflow-hidden"
          >
            {isLoadingInvitations ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
              </div>
            ) : invitations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                  <Mail className="w-8 h-8 text-gray-500 dark:text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Nenhum convite pendente</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                  Todos os convites foram aceitos ou expiraram
                </p>
                {canManageUsers && (
                  <button
                    onClick={() => setIsInviteModalOpen(true)}
                    className="btn-primary mt-4"
                  >
                    <UserPlus className="w-5 h-5" />
                    Convidar Usuário
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {invitations.map((invitation: any) => {
                  const RoleIcon = roleIcons[invitation.role?.slug as keyof typeof roleIcons] || UserIcon
                  const roleColor = roleColors[invitation.role?.slug as keyof typeof roleColors] || roleColors.user
                  const expiresAt = new Date(invitation.expires_at)
                  const now = new Date()
                  const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                  const isExpiringSoon = daysLeft <= 2
                  
                  return (
                    <motion.div
                      key={invitation.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                            <Mail className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900 dark:text-white truncate">{invitation.email}</p>
                            </div>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                                <Clock className="w-4 h-4" />
                                <span className={isExpiringSoon ? 'text-amber-500' : ''}>
                                  {daysLeft > 0 ? `Expira em ${daysLeft} dia${daysLeft > 1 ? 's' : ''}` : 'Expira hoje'}
                                </span>
                              </div>
                              {invitation.invited_by && (
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                  por {invitation.invited_by.name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${roleColor}`}>
                            <RoleIcon className="w-4 h-4" />
                            <span className="text-sm font-medium hidden sm:inline">
                              {roleLabels[invitation.role?.slug as keyof typeof roleLabels] || 'Usuário'}
                            </span>
                          </div>

                          {canManageUsers && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => resendMutation.mutate(invitation.id)}
                                disabled={resendMutation.isPending}
                                className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
                                title="Reenviar convite"
                              >
                                {resendMutation.isPending ? (
                                  <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                  <RefreshCw className="w-5 h-5" />
                                )}
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm('Tem certeza que deseja cancelar este convite?')) {
                                    cancelMutation.mutate(invitation.id)
                                  }
                                }}
                                disabled={cancelMutation.isPending}
                                className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                title="Cancelar convite"
                              >
                                {cancelMutation.isPending ? (
                                  <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                  <X className="w-5 h-5" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>


      {/* Edit Role Modal */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => {
                setEditingUser(null)
                setNewRoleId('')
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl m-4 p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Alterar Papel de {editingUser.name}
              </h3>
              
              <div className="space-y-3">
                {roles.map((role: any) => {
                  const RoleIcon = roleIcons[role.slug] || UserIcon
                  const roleColor = roleColors[role.slug] || roleColors.viewer
                  
                  return (
                    <label
                      key={role.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        String(newRoleId) === String(role.id)
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={role.id}
                        checked={String(newRoleId) === String(role.id)}
                        onChange={(e) => setNewRoleId(e.target.value)}
                        className="sr-only"
                      />
                      <div className={`p-2 rounded-lg ${roleColor}`}>
                        <RoleIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">{role.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {role.description || roleLabels[role.slug] || role.slug}
                        </p>
                      </div>
                      {String(newRoleId) === String(role.id) && (
                        <Check className="w-5 h-5 text-emerald-500" />
                      )}
                    </label>
                  )
                })}
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setEditingUser(null)
                    setNewRoleId('')
                  }}
                  className="flex-1 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (newRoleId && editingUser) {
                      updateRoleMutation.mutate({ userId: editingUser.id, roleId: newRoleId })
                    }
                  }}
                  disabled={!newRoleId || String(newRoleId) === String(editingUser.role?.id) || updateRoleMutation.isPending}
                  className="flex-1 btn-primary disabled:opacity-50"
                >
                  {updateRoleMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Salvar'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Remove User Confirmation Modal */}
      <AnimatePresence>
        {userToRemove && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setUserToRemove(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl m-4 p-6"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Remover Usuário
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Esta ação não pode ser desfeita
                  </p>
                </div>
              </div>
              
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Tem certeza que deseja remover <strong>{userToRemove.name}</strong> da equipe?
                O usuário perderá acesso a todos os dados desta empresa.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setUserToRemove(null)}
                  className="flex-1 px-4 py-2.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-700 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => removeUserMutation.mutate(userToRemove.id)}
                  disabled={removeUserMutation.isPending}
                  className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {removeUserMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Remover
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Invite Modal */}
      <InviteUserModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        roles={roles}
      />
    </div>
  )
}

