<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckPermission
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     * @param  string  ...$permissions
     */
    public function handle(Request $request, Closure $next, ...$permissions): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Não autenticado.',
            ], 401);
        }

        // Check if user is suspended
        if ($user->isSuspended()) {
            return response()->json([
                'success' => false,
                'message' => 'Sua conta está suspensa.',
            ], 403);
        }

        // If no specific permissions required, just check authentication
        if (empty($permissions)) {
            return $next($request);
        }

        // Check for 'any:' prefix (user needs any one of the permissions)
        $requireAny = false;
        $permissionList = [];
        
        foreach ($permissions as $permission) {
            if (str_starts_with($permission, 'any:')) {
                $requireAny = true;
                $permissionList[] = substr($permission, 4);
            } else {
                $permissionList[] = $permission;
            }
        }

        if ($requireAny) {
            if (!$user->hasAnyPermission($permissionList)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Você não tem permissão para realizar esta ação.',
                    'required_permissions' => $permissionList,
                ], 403);
            }
        } else {
            // Default: require all permissions
            foreach ($permissionList as $permission) {
                if (!$user->hasPermission($permission)) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Você não tem permissão para realizar esta ação.',
                        'missing_permission' => $permission,
                    ], 403);
                }
            }
        }

        return $next($request);
    }
}
