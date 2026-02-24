<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use App\Models\User;
use Illuminate\Support\Facades\Log;

class JwtAuthMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        $token = $request->bearerToken();

        if (!$token) {
            return response()->json([
                'success' => false,
                'message' => 'Token not provided',
                'error_code' => 'UNAUTHORIZED'
            ], 401);
        }

        try {
            $decoded = JWT::decode($token, new Key(config('jwt.secret'), config('jwt.algo')));
            
            $user = User::find($decoded->sub);
            
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not found',
                    'error_code' => 'UNAUTHORIZED'
                ], 401);
            }

            auth()->setUser($user);
            $request->merge(['current_user_id' => $user->id]);

            return $next($request);
        } catch (\Exception $e) {
            Log::error('JWT Auth Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Invalid token',
                'error_code' => 'UNAUTHORIZED'
            ], 401);
        }
    }
}
