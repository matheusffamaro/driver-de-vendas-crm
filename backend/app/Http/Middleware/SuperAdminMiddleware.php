<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SuperAdminMiddleware
{
    /**
     * Handle an incoming request.
     * 
     * Verifica se o usuário é um Super Admin (dono do Driver de Vendas)
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user || !$user->is_super_admin) {
            return response()->json([
                'success' => false,
                'message' => 'Acesso negado. Apenas administradores do sistema podem acessar esta área.',
            ], 403);
        }

        return $next($request);
    }
}
