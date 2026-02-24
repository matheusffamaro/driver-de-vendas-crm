<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use App\Models\Subscription;

class CheckSubscriptionMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = auth()->user();

        // Super admins bypass subscription check
        if ($user && $user->isSuperAdmin()) {
            return $next($request);
        }

        // Check if user has a tenant
        if (!$user || !$user->tenant_id) {
            return response()->json([
                'success' => false,
                'message' => 'No tenant associated with this user',
                'error_code' => 'NO_TENANT',
            ], 403);
        }

        // Get active subscription for the tenant
        $subscription = Subscription::where('tenant_id', $user->tenant_id)
            ->whereIn('status', [Subscription::STATUS_ACTIVE, Subscription::STATUS_TRIAL])
            ->first();

        // No subscription found
        if (!$subscription) {
            return response()->json([
                'success' => false,
                'message' => 'No active subscription found. Please subscribe to a plan.',
                'error_code' => 'NO_SUBSCRIPTION',
                'redirect' => '/subscription/plans',
            ], 403);
        }

        // Check if subscription has access
        if (!$subscription->hasAccess()) {
            $message = 'Your subscription has expired.';
            $errorCode = 'SUBSCRIPTION_EXPIRED';

            if ($subscription->trialExpired()) {
                $message = 'Your 14-day trial has expired. Please subscribe to continue using the system.';
                $errorCode = 'TRIAL_EXPIRED';
            }

            return response()->json([
                'success' => false,
                'message' => $message,
                'error_code' => $errorCode,
                'subscription' => [
                    'status' => $subscription->status,
                    'trial_ends_at' => $subscription->trial_ends_at,
                    'ends_at' => $subscription->ends_at,
                ],
                'redirect' => '/subscription/plans',
            ], 403);
        }

        // Add subscription info to request for later use
        $request->merge([
            'subscription' => $subscription,
            'on_trial' => $subscription->onTrial(),
            'trial_days_remaining' => $subscription->trialDaysRemaining(),
        ]);

        return $next($request);
    }
}
