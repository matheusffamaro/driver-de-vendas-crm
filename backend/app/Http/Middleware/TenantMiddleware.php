<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class TenantMiddleware
{
    /**
     * Handle an incoming request.
     *
     * Ensures the authenticated user has a valid tenant_id.
     * This provides an additional layer of security beyond the TenantScope.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        // Allow super admins to bypass tenant checks
        if ($user && $user->is_super_admin) {
            return $next($request);
        }

        // Ensure user has a tenant
        if ($user && !$user->tenant_id) {
            return response()->json([
                'success' => false,
                'message' => 'Usuário sem tenant associado. Entre em contato com o suporte.',
            ], 403);
        }

        // Ensure tenant is active
        if ($user && $user->tenant) {
            if (!$user->tenant->is_active) {
                return response()->json([
                    'success' => false,
                    'message' => 'Sua conta foi suspensa. Entre em contato com o suporte.',
                ], 403);
            }
        }

        return $next($request);
    }
}
