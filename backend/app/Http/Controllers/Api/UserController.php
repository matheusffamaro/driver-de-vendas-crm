<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\UserInvitationMail;
use App\Models\Role;
use App\Models\User;
use App\Models\UserInvitation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class UserController extends Controller
{
    /**
     * List all users.
     */
    public function index(Request $request): JsonResponse
    {
        // SECURITY: Filter by tenant
        $user = $request->user();
        $query = User::where('tenant_id', $user->tenant_id)->with('roleRelation');

        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                  ->orWhere('email', 'ilike', "%{$search}%");
            });
        }

        if ($request->has('role')) {
            $query->where(function ($q) use ($request) {
                $q->where('role', $request->role)
                  ->orWhereHas('roleRelation', function ($q2) use ($request) {
                      $q2->where('slug', $request->role);
                  });
            });
        }

        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $users = $query->orderBy('name')->paginate($request->get('per_page', 20));

        $data = $users->getCollection()->map(function ($user) {
            $role = $user->getRole();
            return [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'avatar' => $user->avatar,
                'signature' => $user->signature,
                'is_active' => $user->is_active,
                'suspended_at' => $user->suspended_at,
                'suspended_reason' => $user->suspended_reason,
                'role' => $role ? [
                    'id' => $role->id,
                    'name' => $role->name,
                    'slug' => $role->slug,
                ] : null,
                'permissions' => $user->getAllPermissions(),
                'created_at' => $user->created_at,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $data,
            'meta' => [
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
            ],
        ]);
    }

    /**
     * Create a new user.
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:6',
            'role_id' => 'nullable|uuid|exists:roles,id',
            'role' => 'nullable|string|in:admin,manager,user', // Legacy support
            'phone' => 'nullable|string|max:20',
            'is_active' => 'boolean',
        ]);

        // Use role_id if provided, otherwise fall back to legacy role
        $roleId = $request->role_id;
        $legacyRole = $request->role;

        if (!$roleId && $legacyRole) {
            $role = Role::getBySlug($legacyRole);
            $roleId = $role?->id;
        }

        // Default to 'user' role if none specified
        if (!$roleId && !$legacyRole) {
            $role = Role::getBySlug('viewer');
            $roleId = $role?->id;
            $legacyRole = 'user';
        }

        $user = User::create([
            'tenant_id' => $request->user()->tenant_id, // SECURITY: Set tenant_id
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'role_id' => $roleId,
            'role' => $legacyRole ?? 'user',
            'phone' => $request->phone,
            'is_active' => $request->get('is_active', true),
        ]);

        $user->load('roleRelation');
        $role = $user->getRole();

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'is_active' => $user->is_active,
                'role' => $role ? [
                    'id' => $role->id,
                    'name' => $role->name,
                    'slug' => $role->slug,
                ] : null,
                'permissions' => $user->getAllPermissions(),
                'created_at' => $user->created_at,
            ],
            'message' => 'Usuário criado com sucesso.',
        ], 201);
    }

    /**
     * Show a specific user.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        // SECURITY: Verify tenant ownership
        $user = User::where('id', $id)
            ->where('tenant_id', $request->user()->tenant_id)
            ->with('roleRelation')
            ->firstOrFail();
        $role = $user->getRole();

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'avatar' => $user->avatar,
                'is_active' => $user->is_active,
                'suspended_at' => $user->suspended_at,
                'suspended_reason' => $user->suspended_reason,
                'role' => $role ? [
                    'id' => $role->id,
                    'name' => $role->name,
                    'slug' => $role->slug,
                    'description' => $role->description,
                ] : null,
                'permissions' => $user->getAllPermissions(),
                'created_at' => $user->created_at,
                'updated_at' => $user->updated_at,
            ],
        ]);
    }

    /**
     * Update a user.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        // SECURITY: Verify tenant ownership
        $user = User::where('id', $id)
            ->where('tenant_id', $request->user()->tenant_id)
            ->firstOrFail();
        $currentUser = $request->user();

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:users,email,' . $id,
            'password' => 'sometimes|string|min:6',
            'role_id' => 'sometimes|nullable|uuid|exists:roles,id',
            'role' => 'sometimes|nullable|string|in:admin,manager,user',
            'phone' => 'sometimes|nullable|string|max:20',
            'is_active' => 'sometimes|boolean',
        ]);

        // Check if user can change role
        if (($request->has('role_id') || $request->has('role')) && $currentUser->id !== $user->id) {
            if (!$currentUser->hasPermission('users.roles')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Você não tem permissão para alterar papéis.',
                ], 403);
            }

            // Can't assign a higher role than your own
            if ($request->has('role_id')) {
                $newRole = Role::find($request->role_id);
                $currentRole = $currentUser->getRole();
                
                if ($newRole && $currentRole && !$currentRole->isHigherOrEqual($newRole)) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Você não pode atribuir um papel superior ao seu.',
                    ], 403);
                }
            }
        }

        // Can't change your own role
        if ($currentUser->id === $user->id && ($request->has('role_id') || $request->has('role'))) {
            return response()->json([
                'success' => false,
                'message' => 'Você não pode alterar seu próprio papel.',
            ], 422);
        }

        $data = $request->except(['password']);
        
        if ($request->has('password')) {
            $data['password'] = Hash::make($request->password);
        }

        // Sync legacy role with role_id
        if ($request->has('role_id')) {
            $role = Role::find($request->role_id);
            if ($role) {
                $data['role'] = $role->slug === 'viewer' ? 'user' : $role->slug;
            }
        } elseif ($request->has('role')) {
            $role = Role::getBySlug($request->role);
            if ($role) {
                $data['role_id'] = $role->id;
            }
        }

        $user->update($data);
        $user->load('roleRelation');
        $role = $user->getRole();

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'is_active' => $user->is_active,
                'role' => $role ? [
                    'id' => $role->id,
                    'name' => $role->name,
                    'slug' => $role->slug,
                ] : null,
                'permissions' => $user->getAllPermissions(),
            ],
            'message' => 'Usuário atualizado com sucesso.',
        ]);
    }

    /**
     * Delete a user.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        // SECURITY: Verify tenant ownership
        $user = User::where('id', $id)
            ->where('tenant_id', $request->user()->tenant_id)
            ->firstOrFail();
        $currentUser = $request->user();

        if ($user->id === $currentUser->id) {
            return response()->json([
                'success' => false,
                'message' => 'Você não pode excluir sua própria conta.',
            ], 400);
        }

        // Check if current user can manage target user
        if (!$currentUser->canManageUser($user)) {
            return response()->json([
                'success' => false,
                'message' => 'Você não tem permissão para excluir este usuário.',
            ], 403);
        }

        $user->delete();

        return response()->json([
            'success' => true,
            'message' => 'Usuário excluído com sucesso.',
        ]);
    }

    /**
     * List all available roles.
     */
    public function listRoles(): JsonResponse
    {
        $roles = Role::orderBy('name')->get()->map(function ($role) {
            return [
                'id' => $role->id,
                'name' => $role->name,
                'slug' => $role->slug,
                'description' => $role->description,
                'is_system' => $role->is_system,
                'permissions' => $role->permissions,
                'permissions_expanded' => $role->getAllPermissionKeys(),
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $roles,
        ]);
    }

    /**
     * Get all available permissions.
     */
    public function listPermissions(): JsonResponse
    {
        $permissions = [];
        
        foreach (Role::ALL_PERMISSIONS as $key => $label) {
            $parts = explode('.', $key);
            $module = $parts[0];
            
            if (!isset($permissions[$module])) {
                $permissions[$module] = [];
            }
            
            $permissions[$module][] = [
                'key' => $key,
                'label' => $label,
            ];
        }

        return response()->json([
            'success' => true,
            'data' => $permissions,
        ]);
    }

    /**
     * Create a custom role.
     */
    public function createRole(Request $request): JsonResponse
    {
        // SECURITY: Verify permission
        if (!$request->user()->hasPermission('users.roles')) {
            return response()->json([
                'success' => false,
                'message' => 'Você não tem permissão para criar papéis.',
            ], 403);
        }

        $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:50|unique:roles,slug|regex:/^[a-z0-9_-]+$/',
            'description' => 'nullable|string',
            'permissions' => 'required|array',
            'permissions.*' => 'string',
        ]);

        $role = Role::create([
            'id' => Str::uuid(),
            'name' => $request->name,
            'slug' => $request->slug,
            'description' => $request->description,
            'permissions' => $request->permissions,
            'is_system' => false,
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $role->id,
                'name' => $role->name,
                'slug' => $role->slug,
                'description' => $role->description,
                'permissions' => $role->permissions,
                'permissions_expanded' => $role->getAllPermissionKeys(),
            ],
            'message' => 'Papel criado com sucesso.',
        ], 201);
    }

    /**
     * Update a role.
     */
    public function updateRole(Request $request, string $id): JsonResponse
    {
        // SECURITY: Verify permission
        if (!$request->user()->hasPermission('users.roles')) {
            return response()->json([
                'success' => false,
                'message' => 'Você não tem permissão para editar papéis.',
            ], 403);
        }

        $role = Role::findOrFail($id);

        // Can't update system roles (except permissions)
        if ($role->is_system && ($request->has('name') || $request->has('slug'))) {
            return response()->json([
                'success' => false,
                'message' => 'Papéis do sistema não podem ter nome ou slug alterados.',
            ], 400);
        }

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'slug' => 'sometimes|string|max:50|unique:roles,slug,' . $id . '|regex:/^[a-z0-9_-]+$/',
            'description' => 'nullable|string',
            'permissions' => 'sometimes|array',
            'permissions.*' => 'string',
        ]);

        $role->update($request->only(['name', 'slug', 'description', 'permissions']));

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $role->id,
                'name' => $role->name,
                'slug' => $role->slug,
                'description' => $role->description,
                'permissions' => $role->permissions,
                'permissions_expanded' => $role->getAllPermissionKeys(),
            ],
            'message' => 'Papel atualizado com sucesso.',
        ]);
    }

    /**
     * Delete a role.
     */
    public function destroyRole(Request $request, string $id): JsonResponse
    {
        // SECURITY: Verify permission
        if (!$request->user()->hasPermission('users.roles')) {
            return response()->json([
                'success' => false,
                'message' => 'Você não tem permissão para excluir papéis.',
            ], 403);
        }

        $role = Role::findOrFail($id);

        if ($role->is_system) {
            return response()->json([
                'success' => false,
                'message' => 'Papéis do sistema não podem ser excluídos.',
            ], 400);
        }

        // Check if role is in use
        $usersCount = User::where('role_id', $id)->count();
        if ($usersCount > 0) {
            return response()->json([
                'success' => false,
                'message' => "Este papel está sendo usado por {$usersCount} usuário(s). Altere o papel deles antes de excluir.",
            ], 400);
        }

        $role->delete();

        return response()->json([
            'success' => true,
            'message' => 'Papel excluído com sucesso.',
        ]);
    }

    /**
     * Update a user's role.
     */
    public function updateUserRole(Request $request, string $id): JsonResponse
    {
        $user = User::findOrFail($id);
        $currentUser = $request->user();

        $request->validate([
            'role_id' => 'required|uuid|exists:roles,id',
        ]);

        // Can't change your own role
        if ($currentUser->id === $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Você não pode alterar seu próprio papel.',
            ], 422);
        }

        // Can't change role of higher-ranked user
        if (!$currentUser->canManageUser($user)) {
            return response()->json([
                'success' => false,
                'message' => 'Você não pode alterar o papel deste usuário.',
            ], 403);
        }

        $newRole = Role::find($request->role_id);
        $currentRole = $currentUser->getRole();

        // Can't assign a higher role than your own
        if ($newRole && $currentRole && !$currentRole->isHigherOrEqual($newRole)) {
            return response()->json([
                'success' => false,
                'message' => 'Você não pode atribuir um papel superior ao seu.',
            ], 403);
        }

        $user->update([
            'role_id' => $request->role_id,
            'role' => $newRole->slug === 'viewer' ? 'user' : $newRole->slug,
        ]);

        return response()->json([
            'success' => true,
            'data' => $user->fresh()->load('roleRelation'),
            'message' => 'Papel do usuário atualizado com sucesso.',
        ]);
    }

    /**
     * List pending invitations.
     */
    public function pendingInvitations(): JsonResponse
    {
        $invitations = UserInvitation::whereNull('accepted_at')
            ->where('expires_at', '>', now())
            ->with(['inviter', 'roleRelation'])
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($invitation) {
                return [
                    'id' => $invitation->id,
                    'email' => $invitation->email,
                    'name' => $invitation->name,
                    'role' => $invitation->roleRelation ? [
                        'id' => $invitation->roleRelation->id,
                        'name' => $invitation->roleRelation->name,
                        'slug' => $invitation->roleRelation->slug,
                    ] : ($invitation->role ? ['slug' => $invitation->role] : null),
                    'invited_by' => $invitation->inviter ? [
                        'id' => $invitation->inviter->id,
                        'name' => $invitation->inviter->name,
                    ] : null,
                    'expires_at' => $invitation->expires_at,
                    'created_at' => $invitation->created_at,
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $invitations,
        ]);
    }

    /**
     * Send a new invitation.
     */
    public function sendInvitation(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
            'name' => 'nullable|string|max:255',
            'role_id' => 'nullable|uuid|exists:roles,id',
            'role' => 'nullable|string|in:admin,manager,user,sales,support,viewer',
        ]);

        // Check if user already exists
        $existingUser = User::where('email', $request->email)->first();
        if ($existingUser) {
            return response()->json([
                'success' => false,
                'message' => 'Já existe um usuário com este e-mail.',
            ], 400);
        }

        // Check if there's already a pending invitation
        $existing = UserInvitation::where('email', $request->email)
            ->whereNull('accepted_at')
            ->where('expires_at', '>', now())
            ->first();

        if ($existing) {
            return response()->json([
                'success' => false,
                'message' => 'Já existe um convite pendente para este e-mail.',
            ], 400);
        }

        // Determine role
        $roleId = $request->role_id;
        $roleName = $request->role ?? 'user';

        if (!$roleId && $roleName) {
            $role = Role::getBySlug($roleName);
            $roleId = $role?->id;
        }

        $invitation = UserInvitation::create([
            'id' => Str::uuid(),
            'tenant_id' => $request->user()->tenant_id, // SECURITY: Set tenant_id
            'email' => $request->email,
            'name' => $request->name,
            'role_id' => $roleId,
            'role' => $roleName,
            'token' => Str::random(64),
            'invited_by' => auth()->id(),
            'expires_at' => now()->addDays(7),
        ]);

        // Send invitation email
        try {
            $invitation->load(['inviter', 'roleRelation']);
            Mail::to($request->email)->send(new UserInvitationMail($invitation));
            Log::info('Invitation email sent', ['email' => $request->email, 'invitation_id' => $invitation->id]);
        } catch (\Exception $e) {
            Log::error('Failed to send invitation email', ['email' => $request->email, 'error' => $e->getMessage()]);
            // Don't fail the request, just log the error
        }

        return response()->json([
            'success' => true,
            'data' => $invitation,
            'message' => 'Convite enviado com sucesso!',
        ], 201);
    }

    /**
     * Resend an invitation.
     */
    public function resendInvitation(string $id): JsonResponse
    {
        $invitation = UserInvitation::findOrFail($id);

        if ($invitation->isAccepted()) {
            return response()->json([
                'success' => false,
                'message' => 'Este convite já foi aceito.',
            ], 400);
        }

        $invitation->update([
            'token' => Str::random(64),
            'expires_at' => now()->addDays(7),
        ]);

        // Resend invitation email
        try {
            $invitation->load(['inviter', 'roleRelation']);
            Mail::to($invitation->email)->send(new UserInvitationMail($invitation));
            Log::info('Invitation email resent', ['email' => $invitation->email, 'invitation_id' => $invitation->id]);
        } catch (\Exception $e) {
            Log::error('Failed to resend invitation email', ['email' => $invitation->email, 'error' => $e->getMessage()]);
        }

        return response()->json([
            'success' => true,
            'data' => $invitation->fresh(),
            'message' => 'Convite reenviado com sucesso!',
        ]);
    }

    /**
     * Cancel an invitation.
     */
    public function cancelInvitation(string $id): JsonResponse
    {
        $invitation = UserInvitation::findOrFail($id);

        if ($invitation->isAccepted()) {
            return response()->json([
                'success' => false,
                'message' => 'Este convite já foi aceito.',
            ], 400);
        }

        $invitation->delete();

        return response()->json([
            'success' => true,
            'message' => 'Convite cancelado com sucesso.',
        ]);
    }

    /**
     * Suspend a user.
     */
    public function suspend(Request $request, string $id): JsonResponse
    {
        $user = User::findOrFail($id);
        $currentUser = $request->user();

        $request->validate([
            'reason' => 'nullable|string|max:500',
        ]);

        if ($user->id === $currentUser->id) {
            return response()->json([
                'success' => false,
                'message' => 'Você não pode suspender sua própria conta.',
            ], 400);
        }

        if (!$currentUser->canManageUser($user)) {
            return response()->json([
                'success' => false,
                'message' => 'Você não tem permissão para suspender este usuário.',
            ], 403);
        }

        $user->suspend($request->reason);

        return response()->json([
            'success' => true,
            'data' => $user->fresh(),
            'message' => 'Usuário suspenso com sucesso.',
        ]);
    }

    /**
     * Activate a user.
     */
    public function activate(Request $request, string $id): JsonResponse
    {
        // SECURITY: Verify permission
        if (!$request->user()->hasPermission('users.edit')) {
            return response()->json([
                'success' => false,
                'message' => 'Você não tem permissão para ativar usuários.',
            ], 403);
        }

        // SECURITY: Verify tenant ownership
        $user = User::where('id', $id)
            ->where('tenant_id', $request->user()->tenant_id)
            ->firstOrFail();

        $user->activate();

        return response()->json([
            'success' => true,
            'data' => $user->fresh(),
            'message' => 'Usuário ativado com sucesso.',
        ]);
    }

    /**
     * Get user statistics.
     */
    public function statistics(): JsonResponse
    {
        $roleStats = Role::withCount('users')->get()->mapWithKeys(function ($role) {
            return [$role->slug => $role->users_count];
        });

        $stats = [
            'total' => User::count(),
            'active' => User::where('is_active', true)->count(),
            'suspended' => User::where('is_active', false)->count(),
            'by_role' => $roleStats,
            'pending_invitations' => UserInvitation::whereNull('accepted_at')
                ->where('expires_at', '>', now())
                ->count(),
        ];

        return response()->json([
            'success' => true,
            'data' => $stats,
        ]);
    }

    /**
     * Get current user's permissions.
     */
    public function myPermissions(Request $request): JsonResponse
    {
        $user = $request->user();
        $role = $user->getRole();

        return response()->json([
            'success' => true,
            'data' => [
                'role' => $role ? [
                    'id' => $role->id,
                    'name' => $role->name,
                    'slug' => $role->slug,
                ] : null,
                'permissions' => $user->getAllPermissions(),
                'is_admin' => $user->isAdmin(),
                'is_manager' => $user->isManager(),
            ],
        ]);
    }

    /**
     * Update current user's signature (for WhatsApp identification).
     * Signature must be unique per tenant.
     */
    public function updateSignature(Request $request): JsonResponse
    {
        $user = $request->user();
        $tenantId = $user->tenant_id;

        $request->validate([
            'signature' => [
                'required',
                'string',
                'min:2',
                'max:5',
                'regex:/^[A-Z0-9]+$/', // Only uppercase letters and numbers
                function ($attribute, $value, $fail) use ($user, $tenantId) {
                    // Check uniqueness within tenant, excluding current user
                    $exists = User::where('tenant_id', $tenantId)
                        ->where('signature', $value)
                        ->where('id', '!=', $user->id)
                        ->exists();
                    
                    if ($exists) {
                        $fail('Esta sigla já está em uso por outro usuário da sua empresa.');
                    }
                },
            ],
        ], [
            'signature.required' => 'A sigla é obrigatória.',
            'signature.min' => 'A sigla deve ter no mínimo 2 caracteres.',
            'signature.max' => 'A sigla deve ter no máximo 5 caracteres.',
            'signature.regex' => 'A sigla deve conter apenas letras maiúsculas e números (ex: MTSA, JPS2).',
        ]);

        // Auto-convert to uppercase
        $signature = strtoupper($request->signature);

        $user->update(['signature' => $signature]);

        return response()->json([
            'success' => true,
            'message' => 'Sigla atualizada com sucesso!',
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'signature' => $user->signature,
            ],
        ]);
    }

    /**
     * Get current user's profile (authenticated user).
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        $role = $user->getRole();

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'avatar' => $user->avatar,
                'signature' => $user->signature,
                'is_active' => $user->is_active,
                'is_super_admin' => $user->is_super_admin,
                'tenant_id' => $user->tenant_id,
                'role' => $role ? [
                    'id' => $role->id,
                    'name' => $role->name,
                    'slug' => $role->slug,
                ] : null,
                'permissions' => $user->getAllPermissions(),
                'created_at' => $user->created_at,
            ],
        ]);
    }
}
