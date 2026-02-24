<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Models\UserInvitation;
use Firebase\JWT\JWT;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    /**
     * Register a new user.
     */
    public function register(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:6|confirmed',
            'tenant_name' => 'required|string|max:255',
        ]);

        DB::beginTransaction();

        try {
            // Create tenant for the new user
            // Trial does NOT include any addons - addons must be purchased separately
            $tenant = Tenant::create([
                'id' => Str::uuid(),
                'name' => $request->tenant_name,
                'email' => $request->email,
                'slug' => Str::slug($request->tenant_name) . '-' . Str::random(6),
                'is_active' => true,
            ]);

            // Get Business plan for 14-day trial
            $businessPlan = \App\Models\Plan::where('slug', 'business')->first();
            
            if (!$businessPlan) {
                throw new \Exception('Business plan not found. Please run database seeders.');
            }

            // Create subscription with 14-day trial
            $subscription = \App\Models\Subscription::create([
                'id' => Str::uuid(),
                'tenant_id' => $tenant->id,
                'plan_id' => $businessPlan->id,
                'status' => \App\Models\Subscription::STATUS_TRIAL,
                'trial_ends_at' => now()->addDays(14),
                'starts_at' => now(),
                'billing_cycle' => 'monthly',
                'metadata' => [
                    'trial_started_at' => now()->toDateTimeString(),
                    'trial_days' => 14,
                    'auto_created' => true,
                ],
            ]);

            // Get admin role (new role system)
            $adminRole = Role::where('slug', 'admin')->first();
            
            if (!$adminRole) {
                throw new \Exception('Admin role not found. Please run database seeders.');
            }

            // Create user with role_id and tenant_id
            $user = User::create([
                'id' => Str::uuid(),
                'name' => $request->name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'role_id' => $adminRole->id,
                'tenant_id' => $tenant->id,
                'is_active' => true,
                'is_super_admin' => false,
            ]);

            DB::commit();

            $tokens = $this->generateTokens($user);

            return response()->json([
                'success' => true,
                'data' => [
                    'user' => [
                        'id' => $user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                        'role' => $adminRole->name,
                    ],
                    'tenant' => [
                        'id' => $tenant->id,
                        'name' => $tenant->name,
                    ],
                    'subscription' => [
                        'id' => $subscription->id,
                        'plan' => 'Business',
                        'status' => 'trial',
                        'trial_ends_at' => $subscription->trial_ends_at->toDateTimeString(),
                        'trial_days_remaining' => $subscription->trialDaysRemaining(),
                    ],
                    'tokens' => $tokens,
                ],
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to create account: ' . $e->getMessage(),
                'error_code' => 'REGISTRATION_FAILED',
            ], 500);
        }
    }

    /**
     * Authenticate a user.
     */
    public function login(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'email' => 'required|email',
                'password' => 'required|string',
            ]);

            $user = User::where('email', $request->email)->first();

            if (! $user || ! Hash::check($request->password, $user->password)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid credentials',
                    'error_code' => 'INVALID_CREDENTIALS',
                ], 401);
            }

            if (! $user->is_active) {
                return response()->json([
                    'success' => false,
                    'message' => 'Account is inactive',
                    'error_code' => 'ACCOUNT_INACTIVE',
                ], 403);
            }

            $tokens = $this->generateTokens($user);
            $role = null;
            $permissions = [];
            $isAdmin = false;
            $isManager = false;
            try {
                $role = $user->getRole();
                $permissions = $user->getAllPermissions();
                $isAdmin = $user->isAdmin();
                $isManager = $user->isManager();
            } catch (\Throwable $roleEx) {
                Log::warning('Login: role/permissions load failed', ['user_id' => $user->id, 'message' => $roleEx->getMessage()]);
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'user' => [
                        'id' => $user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                        'avatar' => $user->avatar,
                        'is_super_admin' => $user->is_super_admin ?? false,
                    ],
                    'role' => $role ? [
                        'id' => $role->id,
                        'name' => $role->name,
                        'slug' => $role->slug,
                    ] : null,
                    'permissions' => $permissions,
                    'is_admin' => $isAdmin,
                    'is_manager' => $isManager,
                    'is_super_admin' => $user->is_super_admin ?? false,
                    'tokens' => $tokens,
                ],
            ]);
        } catch (\Throwable $e) {
            Log::error('Login error', [
                'email' => $request->input('email'),
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            $response = [
                'success' => false,
                'message' => 'Erro ao processar login. Verifique as credenciais ou tente novamente.',
                'error_code' => 'LOGIN_ERROR',
            ];
            if (config('app.debug')) {
                $response['debug_message'] = $e->getMessage();
                $response['debug_file'] = $e->getFile() . ':' . $e->getLine();
            }
            return response()->json($response, 500);
        }
    }

    /**
     * Authenticate a SUPER ADMIN (Driver owners only).
     * This login is separate from CRM login UI, but uses the same JWT mechanism.
     */
    public function superAdminLogin(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid credentials',
                'error_code' => 'INVALID_CREDENTIALS',
            ], 401);
        }

        if (!$user->is_active) {
            return response()->json([
                'success' => false,
                'message' => 'Account is inactive',
                'error_code' => 'ACCOUNT_INACTIVE',
            ], 403);
        }

        if (!($user->is_super_admin ?? false)) {
            return response()->json([
                'success' => false,
                'message' => 'Not allowed',
                'error_code' => 'NOT_SUPER_ADMIN',
            ], 403);
        }

        $tokens = $this->generateTokens($user);

        return response()->json([
            'success' => true,
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'avatar' => $user->avatar,
                    'is_super_admin' => true,
                ],
                'tokens' => $tokens,
            ],
        ]);
    }

    /**
     * Refresh access token.
     */
    public function refresh(Request $request): JsonResponse
    {
        $request->validate([
            'refresh_token' => 'required|string',
        ]);

        try {
            $decoded = JWT::decode(
                $request->refresh_token,
                new \Firebase\JWT\Key(config('jwt.secret'), config('jwt.algo'))
            );

            $user = User::find($decoded->sub);
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not found',
                    'error_code' => 'USER_NOT_FOUND',
                ], 401);
            }

            $tokens = $this->generateTokens($user);

            return response()->json([
                'success' => true,
                'data' => $tokens,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid refresh token',
                'error_code' => 'TOKEN_INVALID',
            ], 401);
        }
    }

    /**
     * Logout user.
     */
    public function logout(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Successfully logged out',
        ]);
    }

    /**
     * Get current user.
     */
    public function me(): JsonResponse
    {
        $user = auth()->user();
        $role = $user->getRole();
        $permissions = $user->getAllPermissions();

        return response()->json([
            'success' => true,
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'avatar' => $user->avatar,
                    'phone' => $user->phone,
                    'is_super_admin' => $user->is_super_admin ?? false,
                ],
                'role' => $role ? [
                    'id' => $role->id,
                    'name' => $role->name,
                    'slug' => $role->slug,
                ] : null,
                'permissions' => $permissions,
                'is_admin' => $user->isAdmin(),
                'is_manager' => $user->isManager(),
                'is_super_admin' => $user->is_super_admin ?? false,
            ],
        ]);
    }

    /**
     * Update current user profile.
     */
    public function updateProfile(Request $request): JsonResponse
    {
        $user = auth()->user();

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'phone' => 'sometimes|nullable|string|max:20',
            'avatar' => 'sometimes|nullable|string',
        ]);

        $user->update($request->only(['name', 'phone', 'avatar']));

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'avatar' => $user->avatar,
                'phone' => $user->phone,
            ],
        ]);
    }

    /**
     * Change password.
     */
    public function changePassword(Request $request): JsonResponse
    {
        $request->validate([
            'current_password' => 'required|string',
            'password' => 'required|string|min:6|confirmed',
        ]);

        $user = auth()->user();

        if (!Hash::check($request->current_password, $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Current password is incorrect',
                'error_code' => 'INVALID_PASSWORD',
            ], 400);
        }

        $user->update(['password' => Hash::make($request->password)]);

        return response()->json([
            'success' => true,
            'message' => 'Password changed successfully',
        ]);
    }

    /**
     * Generate JWT tokens.
     */
    private function generateTokens(User $user): array
    {
        $secret = config('jwt.secret');
        if (empty($secret) || $secret === 'your-secret-key-here') {
            throw new \RuntimeException('JWT_SECRET não está configurado no .env. Gere uma chave e defina JWT_SECRET.');
        }

        $now = time();
        $accessExpire = $now + (config('jwt.ttl', 1440) * 60);
        $refreshExpire = $now + (config('jwt.refresh_ttl', 20160) * 60);

        $accessPayload = [
            'iss' => config('app.url'),
            'sub' => $user->id,
            'iat' => $now,
            'exp' => $accessExpire,
            'type' => 'access',
        ];

        $refreshPayload = [
            'iss' => config('app.url'),
            'sub' => $user->id,
            'iat' => $now,
            'exp' => $refreshExpire,
            'type' => 'refresh',
            'jti' => Str::uuid()->toString(),
        ];

        return [
            'access_token' => JWT::encode($accessPayload, $secret, config('jwt.algo')),
            'refresh_token' => JWT::encode($refreshPayload, $secret, config('jwt.algo')),
            'token_type' => 'Bearer',
            'expires_in' => config('jwt.ttl', 1440) * 60,
        ];
    }

    /**
     * Get invitation details by token (public route).
     */
    public function getInvitation(string $token): JsonResponse
    {
        $invitation = UserInvitation::where('token', $token)
            ->whereNull('accepted_at')
            ->where('expires_at', '>', now())
            ->with(['inviter', 'roleRelation'])
            ->first();

        if (!$invitation) {
            return response()->json([
                'success' => false,
                'message' => 'Convite inválido, já foi aceito ou expirou.',
            ], 404);
        }

        // Get tenant info from the inviter
        $tenant = null;
        if ($invitation->inviter && $invitation->inviter->tenant_id) {
            $tenant = Tenant::find($invitation->inviter->tenant_id);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $invitation->id,
                'email' => $invitation->email,
                'name' => $invitation->name,
                'tenant' => $tenant ? [
                    'id' => $tenant->id,
                    'name' => $tenant->name,
                ] : [
                    'id' => 'default',
                    'name' => 'Driver de Vendas CRM',
                ],
                'role' => $invitation->roleRelation ? [
                    'id' => $invitation->roleRelation->id,
                    'name' => $invitation->roleRelation->name,
                    'slug' => $invitation->roleRelation->slug,
                ] : [
                    'id' => null,
                    'name' => ucfirst($invitation->role ?? 'Usuário'),
                    'slug' => $invitation->role ?? 'user',
                ],
                'inviter' => $invitation->inviter ? [
                    'id' => $invitation->inviter->id,
                    'name' => $invitation->inviter->name,
                ] : [
                    'id' => null,
                    'name' => 'Administrador',
                ],
                'expires_at' => $invitation->expires_at,
            ],
        ]);
    }

    /**
     * Accept invitation and create user account (public route).
     */
    public function acceptInvitation(Request $request, string $token): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $invitation = UserInvitation::where('token', $token)
            ->whereNull('accepted_at')
            ->where('expires_at', '>', now())
            ->with(['inviter', 'roleRelation'])
            ->first();

        if (!$invitation) {
            return response()->json([
                'success' => false,
                'message' => 'Convite inválido, já foi aceito ou expirou.',
            ], 404);
        }

        // Check if email already exists
        if (User::where('email', $invitation->email)->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Este e-mail já está cadastrado no sistema.',
            ], 400);
        }

        try {
            DB::beginTransaction();

            // Get tenant from inviter
            $tenantId = $invitation->inviter?->tenant_id;
            $tenant = $tenantId ? Tenant::find($tenantId) : null;

            // Create the user
            $user = User::create([
                'id' => Str::uuid(),
                'name' => $request->name,
                'email' => $invitation->email,
                'password' => Hash::make($request->password),
                'role' => $invitation->role ?? 'user',
                'role_id' => $invitation->role_id,
                'tenant_id' => $tenantId,
                'is_active' => true,
                'email_verified_at' => now(),
            ]);

            // Mark invitation as accepted
            $invitation->update([
                'accepted_at' => now(),
            ]);

            DB::commit();

            // Generate tokens
            $tokens = $this->generateTokens($user);
            $role = $user->getRole();
            $permissions = $user->getAllPermissions();

            Log::info('User accepted invitation', [
                'user_id' => $user->id,
                'email' => $user->email,
                'invitation_id' => $invitation->id,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Conta criada com sucesso!',
                'data' => [
                    'user' => [
                        'id' => $user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                        'avatar' => $user->avatar,
                    ],
                    'tenant' => $tenant ? [
                        'id' => $tenant->id,
                        'name' => $tenant->name,
                    ] : [
                        'id' => 'default',
                        'name' => 'Driver de Vendas CRM',
                    ],
                    'role' => $role ? [
                        'id' => $role->id,
                        'name' => $role->name,
                        'slug' => $role->slug,
                    ] : null,
                    'permissions' => $permissions,
                    'tenants' => $tenant ? [[
                        'id' => $tenant->id,
                        'name' => $tenant->name,
                    ]] : [],
                    'tokens' => $tokens,
                ],
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to accept invitation', [
                'error' => $e->getMessage(),
                'invitation_id' => $invitation->id,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Erro ao criar conta. Tente novamente.',
            ], 500);
        }
    }
}
