<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Role extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'permissions',
        'is_system',
    ];

    protected $casts = [
        'permissions' => 'array',
        'is_system' => 'boolean',
    ];

    /**
     * All available permissions in the CRM system.
     */
    public const ALL_PERMISSIONS = [
        // Dashboard
        'dashboard.view' => 'Visualizar Dashboard',
        'dashboard.analytics' => 'Visualizar Análises',
        
        // Clients/Contacts
        'clients.view' => 'Visualizar Contatos',
        'clients.create' => 'Criar Contatos',
        'clients.edit' => 'Editar Contatos',
        'clients.delete' => 'Excluir Contatos',
        'clients.export' => 'Exportar Contatos',
        'clients.import' => 'Importar Contatos',
        
        // Pipeline/Funnel
        'pipeline.view' => 'Visualizar Funil de Vendas',
        'pipeline.create' => 'Criar Cards no Funil',
        'pipeline.edit' => 'Editar Cards no Funil',
        'pipeline.delete' => 'Excluir Cards no Funil',
        'pipeline.move' => 'Mover Cards entre Etapas',
        'pipeline.settings' => 'Configurar Funil de Vendas',
        
        // Tasks
        'tasks.view' => 'Visualizar Tarefas',
        'tasks.create' => 'Criar Tarefas',
        'tasks.edit' => 'Editar Tarefas',
        'tasks.delete' => 'Excluir Tarefas',
        'tasks.assign' => 'Atribuir Tarefas',
        
        // WhatsApp
        'whatsapp.view' => 'Visualizar WhatsApp',
        'whatsapp.send' => 'Enviar Mensagens',
        'whatsapp.sessions' => 'Gerenciar Sessões',
        'whatsapp.templates' => 'Gerenciar Templates',
        
        // Products
        'products.view' => 'Visualizar Produtos',
        'products.create' => 'Criar Produtos',
        'products.edit' => 'Editar Produtos',
        'products.delete' => 'Excluir Produtos',
        
        // AI Agent
        'ai_agent.view' => 'Visualizar Chat IA',
        'ai_agent.configure' => 'Configurar Chat IA',
        'ai_agent.knowledge' => 'Gerenciar Base de Conhecimento',
        
        // AI Learning
        'ai_learning.view' => 'Visualizar Aprendizado de IA',
        'ai_learning.feedback' => 'Dar Feedback à IA',
        
        // Email
        'email.view' => 'Visualizar Emails',
        'email.send' => 'Enviar Emails',
        
        // Users
        'users.view' => 'Visualizar Usuários',
        'users.create' => 'Criar Usuários',
        'users.edit' => 'Editar Usuários',
        'users.delete' => 'Excluir Usuários',
        'users.invite' => 'Convidar Usuários',
        'users.roles' => 'Gerenciar Papéis',
        
        // Settings
        'settings.view' => 'Visualizar Configurações',
        'settings.edit' => 'Editar Configurações',
        'settings.integrations' => 'Gerenciar Integrações',
        
        // Reports
        'reports.view' => 'Visualizar Relatórios',
        'reports.export' => 'Exportar Relatórios',
    ];

    /**
     * Predefined system roles.
     */
    public const SYSTEM_ROLES = [
        'admin' => [
            'name' => 'Administrador',
            'slug' => 'admin',
            'description' => 'Acesso total ao sistema',
            'permissions' => ['*'], // All permissions
            'is_system' => true,
        ],
        'manager' => [
            'name' => 'Gerente',
            'slug' => 'manager',
            'description' => 'Gerencia equipe e operações',
            'permissions' => [
                'dashboard.view', 'dashboard.analytics',
                'clients.view', 'clients.create', 'clients.edit', 'clients.delete', 'clients.export',
                'pipeline.view', 'pipeline.create', 'pipeline.edit', 'pipeline.delete', 'pipeline.move',
                'tasks.view', 'tasks.create', 'tasks.edit', 'tasks.delete', 'tasks.assign',
                'whatsapp.view', 'whatsapp.send', 'whatsapp.templates',
                'products.view', 'products.create', 'products.edit',
                'ai_agent.view',
                'users.view',
                'reports.view', 'reports.export',
            ],
            'is_system' => true,
        ],
        'sales' => [
            'name' => 'Vendedor',
            'slug' => 'sales',
            'description' => 'Acesso às funcionalidades de vendas',
            'permissions' => [
                'dashboard.view',
                'clients.view', 'clients.create', 'clients.edit',
                // NOTE: Sales CANNOT delete clients (clients.delete) - only admin/manager can
                'pipeline.view', 'pipeline.create', 'pipeline.edit', 'pipeline.move',
                'tasks.view', 'tasks.create', 'tasks.edit',
                'whatsapp.view', 'whatsapp.send',
                'products.view',
                'ai_agent.view',
                'users.view', // Needed to see user list for task assignment
                'reports.view',
            ],
            'is_system' => true,
        ],
        'support' => [
            'name' => 'Suporte',
            'slug' => 'support',
            'description' => 'Atendimento ao cliente',
            'permissions' => [
                'dashboard.view',
                'clients.view', 'clients.edit',
                'pipeline.view',
                'tasks.view', 'tasks.create', 'tasks.edit',
                'whatsapp.view', 'whatsapp.send',
                'ai_agent.view',
            ],
            'is_system' => true,
        ],
        'viewer' => [
            'name' => 'Visualizador',
            'slug' => 'viewer',
            'description' => 'Apenas visualização',
            'permissions' => [
                'dashboard.view',
                'clients.view',
                'pipeline.view',
                'tasks.view',
                'whatsapp.view',
                'products.view',
                'reports.view',
            ],
            'is_system' => true,
        ],
    ];

    /**
     * Users with this role.
     */
    public function users()
    {
        return $this->hasMany(User::class, 'role_id');
    }

    /**
     * Get role by slug.
     */
    public static function getBySlug(string $slug): ?self
    {
        return static::where('slug', $slug)->first();
    }

    /**
     * Get admin role.
     */
    public static function admin(): ?self
    {
        return static::getBySlug('admin');
    }

    /**
     * Check if role has permission.
     */
    public function hasPermission(string $permission): bool
    {
        $permissions = $this->permissions ?? [];
        
        // Admin has all permissions
        if (in_array('*', $permissions)) {
            return true;
        }
        
        // Check for exact permission
        if (in_array($permission, $permissions)) {
            return true;
        }
        
        // Check for wildcard permission (e.g., 'clients.*')
        $parts = explode('.', $permission);
        if (count($parts) === 2) {
            $wildcard = $parts[0] . '.*';
            if (in_array($wildcard, $permissions)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Check if role has any of the given permissions.
     */
    public function hasAnyPermission(array $permissions): bool
    {
        foreach ($permissions as $permission) {
            if ($this->hasPermission($permission)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if role has all of the given permissions.
     */
    public function hasAllPermissions(array $permissions): bool
    {
        foreach ($permissions as $permission) {
            if (!$this->hasPermission($permission)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Get all permission keys for this role (expanded from wildcards).
     */
    public function getAllPermissionKeys(): array
    {
        $permissions = $this->permissions ?? [];
        
        // Admin has all permissions
        if (in_array('*', $permissions)) {
            return array_keys(self::ALL_PERMISSIONS);
        }
        
        $expanded = [];
        foreach ($permissions as $permission) {
            if (str_ends_with($permission, '.*')) {
                $prefix = substr($permission, 0, -2);
                foreach (array_keys(self::ALL_PERMISSIONS) as $key) {
                    if (str_starts_with($key, $prefix . '.')) {
                        $expanded[] = $key;
                    }
                }
            } else {
                $expanded[] = $permission;
            }
        }
        
        return array_unique($expanded);
    }

    /**
     * Check if this role is higher or equal to another role in hierarchy.
     */
    public function isHigherOrEqual(Role $role): bool
    {
        $hierarchy = ['admin', 'manager', 'sales', 'support', 'viewer'];
        
        $currentIndex = array_search($this->slug, $hierarchy);
        $targetIndex = array_search($role->slug, $hierarchy);
        
        if ($currentIndex === false || $targetIndex === false) {
            return false;
        }
        
        return $currentIndex <= $targetIndex;
    }

    /**
     * Get all permissions grouped by module.
     */
    public static function getPermissionsGroupedByModule(): array
    {
        $grouped = [];
        
        foreach (self::ALL_PERMISSIONS as $key => $label) {
            $parts = explode('.', $key);
            $module = $parts[0] ?? 'other';
            
            if (!isset($grouped[$module])) {
                $grouped[$module] = [];
            }
            
            $grouped[$module][] = [
                'key' => $key,
                'label' => $label,
            ];
        }
        
        return $grouped;
    }
}
