'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  ShieldCheck,
  Users,
  User,
  ChevronLeft,
  Save,
  Loader2,
  Check,
  X,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  LayoutDashboard,
  UserCircle,
  Kanban,
  CheckSquare,
  MessageCircle,
  Package,
  Bot,
  Settings,
  BarChart3,
  AlertCircle,
  Info,
} from 'lucide-react'
import { rolesApi } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import Link from 'next/link'

// Permission module icons
const moduleIcons: Record<string, any> = {
  dashboard: LayoutDashboard,
  clients: UserCircle,
  pipeline: Kanban,
  tasks: CheckSquare,
  whatsapp: MessageCircle,
  products: Package,
  ai_agent: Bot,
  users: Users,
  settings: Settings,
  reports: BarChart3,
}

// Permission module labels
const moduleLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  clients: 'Contatos',
  pipeline: 'Funil de Vendas',
  tasks: 'Tarefas',
  whatsapp: 'WhatsApp',
  products: 'Produtos',
  ai_agent: 'Chat IA',
  users: 'Usuários',
  settings: 'Configurações',
  reports: 'Relatórios',
}

// Permission labels
const permissionLabels: Record<string, string> = {
  'dashboard.view': 'Visualizar Dashboard',
  'dashboard.analytics': 'Ver Análises',
  'clients.view': 'Visualizar Contatos',
  'clients.create': 'Criar Contatos',
  'clients.edit': 'Editar Contatos',
  'clients.delete': 'Excluir Contatos',
  'clients.export': 'Exportar Contatos',
  'clients.import': 'Importar Contatos',
  'pipeline.view': 'Visualizar Funil',
  'pipeline.create': 'Criar Cards',
  'pipeline.edit': 'Editar Cards',
  'pipeline.delete': 'Excluir Cards',
  'pipeline.move': 'Mover Cards',
  'pipeline.settings': 'Configurar Funil',
  'tasks.view': 'Visualizar Tarefas',
  'tasks.create': 'Criar Tarefas',
  'tasks.edit': 'Editar Tarefas',
  'tasks.delete': 'Excluir Tarefas',
  'tasks.assign': 'Atribuir Tarefas',
  'whatsapp.view': 'Visualizar Conversas',
  'whatsapp.send': 'Enviar Mensagens',
  'whatsapp.sessions': 'Gerenciar Sessões',
  'whatsapp.templates': 'Gerenciar Templates',
  'products.view': 'Visualizar Produtos',
  'products.create': 'Criar Produtos',
  'products.edit': 'Editar Produtos',
  'products.delete': 'Excluir Produtos',
  'ai_agent.view': 'Visualizar Chat IA',
  'ai_agent.configure': 'Configurar Chat IA',
  'ai_agent.knowledge': 'Gerenciar Base de Conhecimento',
  'users.view': 'Visualizar Usuários',
  'users.create': 'Criar Usuários',
  'users.edit': 'Editar Usuários',
  'users.delete': 'Excluir Usuários',
  'users.invite': 'Convidar Usuários',
  'users.roles': 'Gerenciar Papéis',
  'settings.view': 'Visualizar Configurações',
  'settings.edit': 'Editar Configurações',
  'settings.integrations': 'Gerenciar Integrações',
  'reports.view': 'Visualizar Relatórios',
  'reports.export': 'Exportar Relatórios',
}

// Role colors
const roleColors: Record<string, { bg: string; text: string; border: string }> = {
  admin: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', border: 'border-emerald-500' },
  manager: { bg: 'bg-purple-500/10', text: 'text-purple-600', border: 'border-purple-500' },
  sales: { bg: 'bg-blue-500/10', text: 'text-blue-600', border: 'border-blue-500' },
  support: { bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-500' },
  viewer: { bg: 'bg-gray-500/10', text: 'text-gray-600', border: 'border-gray-500' },
}

const roleIcons: Record<string, any> = {
  admin: ShieldCheck,
  manager: Shield,
  sales: User,
  support: Users,
  viewer: User,
}

interface Role {
  id: string
  name: string
  slug: string
  description?: string
  permissions: string[]
  permissions_expanded?: string[]
  is_system: boolean
}

interface PermissionGroup {
  module: string
  permissions: string[]
}

export default function RolesPage() {
  const queryClient = useQueryClient()
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [editedPermissions, setEditedPermissions] = useState<string[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [showNewRoleModal, setShowNewRoleModal] = useState(false)
  const [newRole, setNewRole] = useState({ name: '', slug: '', description: '' })

  // Fetch roles
  const { data: rolesData, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesApi.list(),
  })

  // Fetch all available permissions
  const { data: permissionsData } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => rolesApi.listPermissions(),
  })

  const roles: Role[] = rolesData?.data?.data || []
  const allPermissions: Record<string, { key: string; label: string }[]> = permissionsData?.data?.data || {}

  // Group permissions by module
  const permissionGroups: PermissionGroup[] = Object.keys(allPermissions).map(module => ({
    module,
    permissions: allPermissions[module]?.map((p: any) => p.key) || [],
  }))

  // Update role permissions mutation
  const updateRoleMutation = useMutation({
    mutationFn: ({ id, permissions }: { id: string; permissions: string[] }) =>
      rolesApi.update(id, { permissions }),
    onSuccess: () => {
      toast.success('Permissões atualizadas', 'As permissões do papel foram salvas com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setIsEditing(false)
    },
    onError: (error: any) => {
      toast.error('Erro', error.response?.data?.message || 'Erro ao atualizar permissões.')
    },
  })

  // Create role mutation
  const createRoleMutation = useMutation({
    mutationFn: (data: { name: string; slug: string; description: string; permissions: string[] }) =>
      rolesApi.create(data),
    onSuccess: () => {
      toast.success('Papel criado', 'O novo papel foi criado com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setShowNewRoleModal(false)
      setNewRole({ name: '', slug: '', description: '' })
    },
    onError: (error: any) => {
      toast.error('Erro', error.response?.data?.message || 'Erro ao criar papel.')
    },
  })

  // Delete role mutation
  const deleteRoleMutation = useMutation({
    mutationFn: (id: string) => rolesApi.remove(id),
    onSuccess: () => {
      toast.success('Papel excluído', 'O papel foi excluído com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setSelectedRole(null)
    },
    onError: (error: any) => {
      toast.error('Erro', error.response?.data?.message || 'Erro ao excluir papel.')
    },
  })

  // Select a role
  const handleSelectRole = (role: Role) => {
    setSelectedRole(role)
    // Use expanded permissions if available, otherwise use raw permissions
    const perms = role.permissions_expanded || role.permissions || []
    // Handle admin's '*' permission
    if (role.permissions?.includes('*')) {
      setEditedPermissions(Object.values(allPermissions).flatMap((p: any) => p.map((x: any) => x.key)))
    } else {
      setEditedPermissions([...perms])
    }
    setIsEditing(false)
  }

  // Toggle a single permission
  const togglePermission = (permission: string) => {
    if (!isEditing) return
    
    setEditedPermissions(prev => {
      if (prev.includes(permission)) {
        return prev.filter(p => p !== permission)
      } else {
        return [...prev, permission]
      }
    })
  }

  // Toggle all permissions in a module
  const toggleModule = (module: string) => {
    if (!isEditing) return
    
    const modulePerms = allPermissions[module]?.map((p: any) => p.key) || []
    const allChecked = modulePerms.every(p => editedPermissions.includes(p))
    
    setEditedPermissions(prev => {
      if (allChecked) {
        return prev.filter(p => !modulePerms.includes(p))
      } else {
        return Array.from(new Set([...prev, ...modulePerms]))
      }
    })
  }

  // Check if module has all permissions
  const isModuleFullyChecked = (module: string) => {
    const modulePerms = allPermissions[module]?.map((p: any) => p.key) || []
    return modulePerms.length > 0 && modulePerms.every(p => editedPermissions.includes(p))
  }

  // Check if module has some permissions
  const isModulePartiallyChecked = (module: string) => {
    const modulePerms = allPermissions[module]?.map((p: any) => p.key) || []
    const checkedCount = modulePerms.filter(p => editedPermissions.includes(p)).length
    return checkedCount > 0 && checkedCount < modulePerms.length
  }

  // Save permissions
  const handleSave = () => {
    if (!selectedRole) return
    updateRoleMutation.mutate({ id: selectedRole.id, permissions: editedPermissions })
  }

  // Reset to default
  const handleReset = () => {
    if (!selectedRole) return
    const perms = selectedRole.permissions_expanded || selectedRole.permissions || []
    if (selectedRole.permissions?.includes('*')) {
      setEditedPermissions(Object.values(allPermissions).flatMap((p: any) => p.map((x: any) => x.key)))
    } else {
      setEditedPermissions([...perms])
    }
  }

  // Create new role
  const handleCreateRole = () => {
    if (!newRole.name || !newRole.slug) {
      toast.error('Erro', 'Nome e slug são obrigatórios.')
      return
    }
    createRoleMutation.mutate({
      ...newRole,
      permissions: [],
    })
  }

  // Check if admin role (can't edit permissions)
  const isAdminRole = selectedRole?.slug === 'admin'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/users"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gerenciar Papéis</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Configure as permissões de cada papel</p>
          </div>
        </div>
        <button
          onClick={() => setShowNewRoleModal(true)}
          className="btn-primary"
        >
          <Plus className="w-5 h-5" />
          Novo Papel
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Roles List */}
        <div className="lg:col-span-1">
          <div className="glass-card p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Papéis</h2>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                {roles.map((role) => {
                  const RoleIcon = roleIcons[role.slug] || User
                  const colors = roleColors[role.slug] || roleColors.viewer
                  const isSelected = selectedRole?.id === role.id
                  
                  return (
                    <button
                      key={role.id}
                      onClick={() => handleSelectRole(role)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                        isSelected
                          ? `${colors.bg} ${colors.border} border-2`
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800 border-2 border-transparent'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${colors.bg}`}>
                        <RoleIcon className={`w-5 h-5 ${colors.text}`} />
                      </div>
                      <div className="text-left flex-1">
                        <p className={`font-medium ${isSelected ? colors.text : 'text-gray-900 dark:text-white'}`}>
                          {role.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {role.is_system ? 'Sistema' : 'Personalizado'}
                        </p>
                      </div>
                      {isSelected && <Check className={`w-5 h-5 ${colors.text}`} />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Permissions Editor */}
        <div className="lg:col-span-3">
          {selectedRole ? (
            <div className="glass-card">
              {/* Role Header */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${roleColors[selectedRole.slug]?.bg || roleColors.viewer.bg}`}>
                      {(() => {
                        const RoleIcon = roleIcons[selectedRole.slug] || User
                        return <RoleIcon className={`w-6 h-6 ${roleColors[selectedRole.slug]?.text || roleColors.viewer.text}`} />
                      })()}
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{selectedRole.name}</h2>
                      <p className="text-gray-500 dark:text-gray-400">{selectedRole.description || 'Sem descrição'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {isAdminRole ? (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg text-sm">
                        <Info className="w-4 h-4" />
                        Permissões completas
                      </div>
                    ) : isEditing ? (
                      <>
                        <button
                          onClick={handleReset}
                          className="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Resetar
                        </button>
                        <button
                          onClick={() => setIsEditing(false)}
                          className="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={updateRoleMutation.isPending}
                          className="btn-primary"
                        >
                          {updateRoleMutation.isPending ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <>
                              <Save className="w-5 h-5" />
                              Salvar
                            </>
                          )}
                        </button>
                      </>
                    ) : (
                      <>
                        {!selectedRole.is_system && (
                          <button
                            onClick={() => {
                              if (confirm('Tem certeza que deseja excluir este papel?')) {
                                deleteRoleMutation.mutate(selectedRole.id)
                              }
                            }}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                        <button
                          onClick={() => setIsEditing(true)}
                          className="btn-primary"
                        >
                          <Pencil className="w-5 h-5" />
                          Editar Permissões
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Permissions Grid */}
              <div className="p-6">
                {isAdminRole ? (
                  <div className="text-center py-8">
                    <ShieldCheck className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Acesso Total
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                      O papel de Administrador possui todas as permissões do sistema e não pode ser modificado.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.keys(allPermissions).map((module) => {
                      const ModuleIcon = moduleIcons[module] || Settings
                      const modulePermissions = allPermissions[module] || []
                      const isFullyChecked = isModuleFullyChecked(module)
                      const isPartiallyChecked = isModulePartiallyChecked(module)
                      
                      return (
                        <div
                          key={module}
                          className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
                        >
                          {/* Module Header */}
                          <div
                            className={`flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 ${
                              isEditing ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800' : ''
                            }`}
                            onClick={() => isEditing && toggleModule(module)}
                          >
                            <div className={`p-2 rounded-lg ${isFullyChecked ? 'bg-emerald-500/10' : 'bg-gray-200 dark:bg-gray-700'}`}>
                              <ModuleIcon className={`w-5 h-5 ${isFullyChecked ? 'text-emerald-500' : 'text-gray-500'}`} />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-gray-900 dark:text-white">
                                {moduleLabels[module] || module}
                              </p>
                              <p className="text-xs text-gray-500">
                                {modulePermissions.filter((p: any) => editedPermissions.includes(p.key)).length} de {modulePermissions.length} permissões
                              </p>
                            </div>
                            {isEditing && (
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                isFullyChecked
                                  ? 'bg-emerald-500 border-emerald-500'
                                  : isPartiallyChecked
                                  ? 'bg-emerald-500/50 border-emerald-500'
                                  : 'border-gray-300 dark:border-gray-600'
                              }`}>
                                {(isFullyChecked || isPartiallyChecked) && (
                                  <Check className="w-3 h-3 text-white" />
                                )}
                              </div>
                            )}
                          </div>
                          
                          {/* Permissions List */}
                          <div className="p-3 space-y-1">
                            {modulePermissions.map((perm: any) => {
                              const isChecked = editedPermissions.includes(perm.key)
                              
                              return (
                                <label
                                  key={perm.key}
                                  className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                                    isEditing
                                      ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800'
                                      : 'cursor-default'
                                  }`}
                                >
                                  <div
                                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                      isChecked
                                        ? 'bg-emerald-500 border-emerald-500'
                                        : 'border-gray-300 dark:border-gray-600'
                                    } ${!isEditing ? 'opacity-60' : ''}`}
                                    onClick={(e) => {
                                      e.preventDefault()
                                      togglePermission(perm.key)
                                    }}
                                  >
                                    {isChecked && <Check className="w-3 h-3 text-white" />}
                                  </div>
                                  <span className={`text-sm ${isChecked ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                                    {permissionLabels[perm.key] || perm.label || perm.key}
                                  </span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="glass-card p-12 text-center">
              <Shield className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Selecione um papel
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Escolha um papel na lista para visualizar e editar suas permissões
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New Role Modal */}
      <AnimatePresence>
        {showNewRoleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowNewRoleModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl m-4 p-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-emerald-500/10">
                  <Plus className="w-6 h-6 text-emerald-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Novo Papel
                </h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nome
                  </label>
                  <input
                    type="text"
                    value={newRole.name}
                    onChange={(e) => setNewRole(prev => ({ ...prev, name: e.target.value }))}
                    className="input"
                    placeholder="Ex: Supervisor"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Identificador (slug)
                  </label>
                  <input
                    type="text"
                    value={newRole.slug}
                    onChange={(e) => setNewRole(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') }))}
                    className="input"
                    placeholder="Ex: supervisor"
                  />
                  <p className="text-xs text-gray-500 mt-1">Apenas letras minúsculas, números, hífen e underscore</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Descrição
                  </label>
                  <textarea
                    value={newRole.description}
                    onChange={(e) => setNewRole(prev => ({ ...prev, description: e.target.value }))}
                    className="input"
                    rows={2}
                    placeholder="Descreva as responsabilidades deste papel..."
                  />
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowNewRoleModal(false)}
                  className="flex-1 px-4 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateRole}
                  disabled={createRoleMutation.isPending || !newRole.name || !newRole.slug}
                  className="flex-1 btn-primary disabled:opacity-50"
                >
                  {createRoleMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Criar Papel'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
