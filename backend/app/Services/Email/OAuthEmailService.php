<?php

namespace App\Services\Email;

use App\Models\EmailAccount;
use Google\Client as GoogleClient;
use Microsoft\Graph\Graph;
use Microsoft\Graph\Http\GraphRequest;
use GuzzleHttp\Client as GuzzleClient;
use Illuminate\Support\Facades\Log;

class OAuthEmailService
{
    /**
     * Get OAuth2 authorization URL for the specified provider
     */
    public function getAuthUrl(string $provider, string $redirectUri, ?string $state = null): string
    {
        $state = $state ?? bin2hex(random_bytes(16));

        switch ($provider) {
            case 'gmail':
                return $this->getGmailAuthUrl($redirectUri, $state);
            case 'outlook':
                return $this->getOutlookAuthUrl($redirectUri, $state);
            default:
                throw new \InvalidArgumentException("Unsupported provider: {$provider}");
        }
    }

    /**
     * Get Gmail OAuth2 URL
     */
    protected function getGmailAuthUrl(string $redirectUri, string $state): string
    {
        $client = new GoogleClient();
        $client->setClientId(config('services.google.client_id'));
        $client->setClientSecret(config('services.google.client_secret'));
        $client->setRedirectUri($redirectUri);
        $client->addScope('https://www.googleapis.com/auth/gmail.readonly');
        $client->addScope('https://www.googleapis.com/auth/gmail.send');
        $client->addScope('https://www.googleapis.com/auth/gmail.modify');
        $client->addScope('https://www.googleapis.com/auth/userinfo.email');
        $client->setState($state);
        $client->setAccessType('offline');
        $client->setPrompt('consent');

        return $client->createAuthUrl();
    }

    /**
     * Get Outlook OAuth2 URL
     */
    protected function getOutlookAuthUrl(string $redirectUri, string $state): string
    {
        $clientId = config('services.microsoft.client_id');
        $scope = 'https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access';
        
        $params = http_build_query([
            'client_id' => $clientId,
            'response_type' => 'code',
            'redirect_uri' => $redirectUri,
            'response_mode' => 'query',
            'scope' => $scope,
            'state' => $state,
        ]);

        return "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?{$params}";
    }

    /**
     * Handle OAuth2 callback and exchange code for tokens
     */
    public function handleCallback(string $provider, string $code, string $redirectUri): array
    {
        switch ($provider) {
            case 'gmail':
                return $this->handleGmailCallback($code, $redirectUri);
            case 'outlook':
                return $this->handleOutlookCallback($code, $redirectUri);
            default:
                throw new \InvalidArgumentException("Unsupported provider: {$provider}");
        }
    }

    /**
     * Handle Gmail OAuth2 callback
     */
    protected function handleGmailCallback(string $code, string $redirectUri): array
    {
        $client = new GoogleClient();
        $client->setClientId(config('services.google.client_id'));
        $client->setClientSecret(config('services.google.client_secret'));
        $client->setRedirectUri($redirectUri);

        $token = $client->fetchAccessTokenWithAuthCode($code);

        if (isset($token['error'])) {
            throw new \Exception("Gmail OAuth error: " . $token['error_description']);
        }

        // Get user email
        $client->setAccessToken($token);
        $oauth2 = new \Google\Service\Oauth2($client);
        $userInfo = $oauth2->userinfo->get();

        return [
            'email' => $userInfo->email,
            'account_name' => $userInfo->name ?? $userInfo->email,
            'access_token' => $token['access_token'],
            'refresh_token' => $token['refresh_token'] ?? null,
            'expires_in' => $token['expires_in'] ?? 3600,
            'token_expires_at' => now()->addSeconds($token['expires_in'] ?? 3600),
        ];
    }

    /**
     * Handle Outlook OAuth2 callback
     */
    protected function handleOutlookCallback(string $code, string $redirectUri): array
    {
        $tokenEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
        
        $client = new GuzzleClient();
        $response = $client->post($tokenEndpoint, [
            'form_params' => [
                'client_id' => config('services.microsoft.client_id'),
                'client_secret' => config('services.microsoft.client_secret'),
                'code' => $code,
                'redirect_uri' => $redirectUri,
                'grant_type' => 'authorization_code',
            ],
        ]);

        $token = json_decode($response->getBody()->getContents(), true);

        if (isset($token['error'])) {
            throw new \Exception("Outlook OAuth error: " . $token['error_description']);
        }

        // Get user email using Microsoft Graph
        $graph = new Graph();
        $graph->setAccessToken($token['access_token']);
        
        $user = $graph->createRequest('GET', '/me')
            ->setReturnType(\Microsoft\Graph\Model\User::class)
            ->execute();

        return [
            'email' => $user->getMail() ?? $user->getUserPrincipalName(),
            'account_name' => $user->getDisplayName() ?? $user->getMail(),
            'access_token' => $token['access_token'],
            'refresh_token' => $token['refresh_token'] ?? null,
            'expires_in' => $token['expires_in'] ?? 3600,
            'token_expires_at' => now()->addSeconds($token['expires_in'] ?? 3600),
        ];
    }

    /**
     * Refresh OAuth2 token
     */
    public function refreshToken(EmailAccount $account): array
    {
        if (!$account->refresh_token) {
            throw new \Exception("No refresh token available for this account");
        }

        switch ($account->provider) {
            case 'gmail':
                return $this->refreshGmailToken($account);
            case 'outlook':
                return $this->refreshOutlookToken($account);
            default:
                throw new \InvalidArgumentException("Unsupported provider: {$account->provider}");
        }
    }

    /**
     * Refresh Gmail token
     */
    protected function refreshGmailToken(EmailAccount $account): array
    {
        $client = new GoogleClient();
        $client->setClientId(config('services.google.client_id'));
        $client->setClientSecret(config('services.google.client_secret'));
        $client->refreshToken($account->refresh_token);

        $token = $client->getAccessToken();

        if ($token === null || !is_array($token)) {
            throw new \Exception('Gmail token refresh failed: no token returned. Reconnect the account in settings.');
        }

        if (isset($token['error'])) {
            $desc = $token['error_description'] ?? $token['error'] ?? 'Unknown error';
            throw new \Exception('Gmail token refresh error: ' . $desc);
        }

        if (empty($token['access_token'])) {
            throw new \Exception('Gmail token refresh failed: no access_token. Reconnect the account in settings.');
        }

        return [
            'access_token' => $token['access_token'],
            'refresh_token' => $token['refresh_token'] ?? $account->refresh_token,
            'expires_in' => $token['expires_in'] ?? 3600,
            'token_expires_at' => now()->addSeconds($token['expires_in'] ?? 3600),
        ];
    }

    /**
     * Refresh Outlook token
     */
    protected function refreshOutlookToken(EmailAccount $account): array
    {
        $tokenEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
        
        $client = new GuzzleClient();
        $response = $client->post($tokenEndpoint, [
            'form_params' => [
                'client_id' => config('services.microsoft.client_id'),
                'client_secret' => config('services.microsoft.client_secret'),
                'refresh_token' => $account->refresh_token,
                'grant_type' => 'refresh_token',
            ],
        ]);

        $token = json_decode($response->getBody()->getContents(), true);

        if ($token === null || !is_array($token)) {
            throw new \Exception('Outlook token refresh failed: invalid response. Reconnect the account in settings.');
        }

        if (isset($token['error'])) {
            $desc = $token['error_description'] ?? $token['error'] ?? 'Unknown error';
            throw new \Exception('Outlook token refresh error: ' . $desc);
        }

        if (empty($token['access_token'])) {
            throw new \Exception('Outlook token refresh failed: no access_token. Reconnect the account in settings.');
        }

        return [
            'access_token' => $token['access_token'],
            'refresh_token' => $token['refresh_token'] ?? $account->refresh_token,
            'expires_in' => $token['expires_in'] ?? 3600,
            'token_expires_at' => now()->addSeconds($token['expires_in'] ?? 3600),
        ];
    }

    /**
     * Get Gmail service instance
     */
    public function getGmailService(EmailAccount $account): \Google\Service\Gmail
    {
        if ($account->isTokenExpired() && $account->refresh_token) {
            $newToken = $this->refreshToken($account);
            $account->update($newToken);
        }

        $client = new GoogleClient();
        $client->setAccessToken($account->access_token);

        return new \Google\Service\Gmail($client);
    }

    /**
     * Get Microsoft Graph instance
     */
    public function getGraphClient(EmailAccount $account): Graph
    {
        if ($account->isTokenExpired() && $account->refresh_token) {
            $newToken = $this->refreshToken($account);
            $account->update($newToken);
        }

        $graph = new Graph();
        $graph->setAccessToken($account->access_token);

        return $graph;
    }
}
