<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EmailAccount;
use App\Services\Email\OAuthEmailService;
use App\Services\Email\ImapEmailService;
use App\Jobs\SyncEmailAccountJob;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class EmailAccountController extends Controller
{
    /**
     * Check if tenant can add more email accounts based on plan
     */
    private function canAddEmailAccount($tenantId): array
    {
        $tenant = \App\Models\Tenant::with('subscription.plan')->find($tenantId);
        
        if (!$tenant) {
            return ['allowed' => false, 'message' => 'Tenant not found'];
        }

        // Check if email addon is enabled
        if (!$tenant->email_addon_enabled) {
            return ['allowed' => false, 'message' => 'Email add-on is not enabled. Please activate it in your plan settings.'];
        }

        $currentCount = EmailAccount::where('tenant_id', $tenantId)->count();
        $plan = $tenant->subscription?->plan;
        
        if (!$plan) {
            // No subscription, default to 0
            return ['allowed' => false, 'message' => 'No active subscription. Please upgrade your plan.'];
        }

        // Determine limit based on plan
        $limit = 0;
        $planSlug = $plan->slug ?? '';
        
        if (strpos($planSlug, 'essential') !== false) {
            $limit = 1;
        } elseif (strpos($planSlug, 'business') !== false) {
            $limit = 3;
        } elseif (strpos($planSlug, 'enterprise') !== false) {
            $limit = -1; // Unlimited
        }

        if ($limit === -1) {
            return ['allowed' => true];
        }

        if ($currentCount >= $limit) {
            return [
                'allowed' => false, 
                'message' => "You have reached the maximum number of email accounts ({$limit}) for your plan. Please upgrade to connect more accounts.",
                'current' => $currentCount,
                'limit' => $limit
            ];
        }

        return ['allowed' => true, 'current' => $currentCount, 'limit' => $limit];
    }

    /**
     * List all email accounts for the authenticated user's tenant
     */
    public function index(Request $request)
    {
        $accounts = EmailAccount::where('tenant_id', $request->user()->tenant_id)
            ->with('user')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($accounts);
    }

    /**
     * Get OAuth authorization URL
     */
    public function getOAuthUrl(Request $request, string $provider)
    {
        $validator = Validator::make(['provider' => $provider], [
            'provider' => 'required|in:gmail,outlook',
        ]);

        if ($validator->fails()) {
            return response()->json(['error' => 'Invalid provider'], 400);
        }

        // Check if OAuth credentials are configured
        $clientId = config("services.{$provider}.client_id");
        $clientSecret = config("services.{$provider}.client_secret");
        $redirectUri = config("services.{$provider}.redirect");

        if (empty($clientId) || empty($clientSecret) || empty($redirectUri)) {
            return response()->json([
                'error' => 'OAuth credentials not configured',
                'message' => "Please configure {$provider} OAuth credentials in your .env file (CLIENT_ID, CLIENT_SECRET, and REDIRECT_URI)."
            ], 503);
        }

        try {
            $oauthService = new OAuthEmailService();
            $state = bin2hex(random_bytes(16));
            
            // Store state in cache for validation (expires in 10 minutes)
            \Cache::put("oauth_state_{$provider}_{$state}", [
                'tenant_id' => $request->user()->tenant_id,
                'user_id' => $request->user()->id,
                'created_at' => now(),
            ], now()->addMinutes(10));
            
            $authUrl = $oauthService->getAuthUrl($provider, $redirectUri, $state);

            return response()->json(['url' => $authUrl, 'state' => $state]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Handle OAuth callback
     */
    public function handleOAuthCallback(Request $request, string $provider)
    {
        $validator = Validator::make($request->all(), [
            'code' => 'required|string',
            'state' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['error' => 'Invalid callback parameters'], 400);
        }

        // Validate state and get stored data
        $stateData = \Cache::get("oauth_state_{$provider}_{$request->state}");
        if (!$stateData) {
            $frontendUrl = config('app.frontend_url', 'http://localhost:3100');
            return redirect()->to("{$frontendUrl}/settings?tab=email&status=error&message=" . urlencode("Invalid or expired OAuth session. Please try again."));
        }

        // Clear the state from cache
        \Cache::forget("oauth_state_{$provider}_{$request->state}");

        try {
            $oauthService = new OAuthEmailService();
            $redirectUri = config("services.{$provider}.redirect");
            
            $accountData = $oauthService->handleCallback($provider, $request->code, $redirectUri);

            // Get tenant and user from state data
            $tenantId = $stateData['tenant_id'];
            $userId = $stateData['user_id'];

            // Check if account already exists
            $existingAccount = EmailAccount::where('tenant_id', $tenantId)
                ->where('email', $accountData['email'])
                ->first();

            if ($existingAccount) {
                // Update existing account
                $existingAccount->update([
                    'access_token' => $accountData['access_token'],
                    'refresh_token' => $accountData['refresh_token'],
                    'token_expires_at' => $accountData['token_expires_at'],
                    'is_active' => true,
                    'sync_status' => 'pending',
                ]);

                $account = $existingAccount;
            } else {
                // Check if tenant can add more accounts
                $limitCheck = $this->canAddEmailAccount($tenantId);
                if (!$limitCheck['allowed']) {
                    return response()->json(['error' => $limitCheck['message']], 403);
                }

                // Create new account
                $account = EmailAccount::create([
                    'user_id' => $userId,
                    'tenant_id' => $tenantId,
                    'email' => $accountData['email'],
                    'provider' => $provider,
                    'account_name' => $accountData['account_name'],
                    'access_token' => $accountData['access_token'],
                    'refresh_token' => $accountData['refresh_token'],
                    'token_expires_at' => $accountData['token_expires_at'],
                    'is_active' => true,
                    'sync_status' => 'pending',
                ]);
            }

            // Dispatch sync job
            SyncEmailAccountJob::dispatch($account);

            $frontendUrl = config('app.frontend_url', 'http://localhost:3100');
            return redirect()->to("{$frontendUrl}/settings?tab=email&status=success&message=" . urlencode("Email connected successfully"));
        } catch (\Exception $e) {
            $frontendUrl = config('app.frontend_url', 'http://localhost:3100');
            return redirect()->to("{$frontendUrl}/settings?tab=email&status=error&message=" . urlencode($e->getMessage()));
        }
    }

    /**
     * Connect IMAP/SMTP account
     */
    public function connectImap(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'account_name' => 'required|string',
            'imap_host' => 'required|string',
            'imap_port' => 'required|integer',
            'imap_encryption' => 'required|in:ssl,tls,none',
            'imap_username' => 'nullable|string',
            'smtp_host' => 'required|string',
            'smtp_port' => 'required|integer',
            'smtp_encryption' => 'required|in:ssl,tls,none',
            'smtp_username' => 'nullable|string',
            'password' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            // Test IMAP connection first
            $testAccount = new EmailAccount([
                'email' => $request->email,
                'provider' => 'imap',
                'imap_config' => [
                    'host' => $request->imap_host,
                    'port' => $request->imap_port,
                    'encryption' => $request->imap_encryption,
                    'username' => $request->imap_username ?? $request->email,
                ],
                'password' => encrypt($request->password),
            ]);

            $imapService = new ImapEmailService();
            $imapService->connect($testAccount);
            $imapService->disconnect();

            // Check if tenant can add more accounts
            $limitCheck = $this->canAddEmailAccount($request->user()->tenant_id);
            if (!$limitCheck['allowed']) {
                return response()->json(['error' => $limitCheck['message']], 403);
            }

            // Connection successful, save account
            $account = EmailAccount::create([
                'user_id' => $request->user()->id,
                'tenant_id' => $request->user()->tenant_id,
                'email' => $request->email,
                'provider' => 'imap',
                'account_name' => $request->account_name,
                'imap_config' => [
                    'host' => $request->imap_host,
                    'port' => $request->imap_port,
                    'encryption' => $request->imap_encryption,
                    'username' => $request->imap_username ?? $request->email,
                ],
                'smtp_config' => [
                    'host' => $request->smtp_host,
                    'port' => $request->smtp_port,
                    'encryption' => $request->smtp_encryption,
                    'username' => $request->smtp_username ?? $request->email,
                ],
                'password' => encrypt($request->password),
                'is_active' => true,
                'sync_status' => 'pending',
            ]);

            // Dispatch sync job
            SyncEmailAccountJob::dispatch($account);

            return response()->json([
                'message' => 'IMAP account connected successfully',
                'account' => $account,
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Connection failed: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Update email account
     */
    public function update(Request $request, string $id)
    {
        $account = EmailAccount::where('id', $id)
            ->where('tenant_id', $request->user()->tenant_id)
            ->firstOrFail();

        $validator = Validator::make($request->all(), [
            'account_name' => 'sometimes|string',
            'is_active' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $account->update($request->only(['account_name', 'is_active']));

        return response()->json([
            'message' => 'Account updated successfully',
            'account' => $account,
        ]);
    }

    /**
     * Delete email account
     */
    public function destroy(Request $request, string $id)
    {
        $account = EmailAccount::where('id', $id)
            ->where('tenant_id', $request->user()->tenant_id)
            ->firstOrFail();

        $account->delete();

        return response()->json(['message' => 'Account deleted successfully']);
    }

    /**
     * Force sync for an account
     */
    public function syncAccount(Request $request, string $id)
    {
        $account = EmailAccount::where('id', $id)
            ->where('tenant_id', $request->user()->tenant_id)
            ->firstOrFail();

        if (!$account->is_active) {
            return response()->json(['error' => 'Account is not active'], 400);
        }

        try {
            // Run sync synchronously so the user sees new emails when the request completes (no queue worker required)
            SyncEmailAccountJob::dispatchSync($account);

            return response()->json([
                'message' => 'Sincronização concluída.',
                'last_sync_at' => $account->fresh()->last_sync_at?->toIso8601String(),
            ]);
        } catch (\Exception $e) {
            $msg = $e->getMessage();
            // Token refresh failures: ask user to reconnect (400 instead of 500)
            if (str_contains($msg, 'token refresh') || str_contains($msg, 'Reconnect the account')) {
                return response()->json(['error' => $msg], 400);
            }
            return response()->json(['error' => $msg ?: 'Sync failed'], 500);
        }
    }
}
