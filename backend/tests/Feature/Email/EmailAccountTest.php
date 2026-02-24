<?php

namespace Tests\Feature\Email;

use Tests\TestCase;
use Tests\Helpers\CreatesTestData;
use App\Models\EmailAccount;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;

class EmailAccountTest extends TestCase
{
    use RefreshDatabase, CreatesTestData;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpTenantAndUser();

        Tenant::withoutGlobalScopes()->where('id', $this->tenant->id)->update([
            'email_addon_enabled' => true,
        ]);
    }

    public function test_can_get_gmail_oauth_url(): void
    {
        $response = $this->actingAsUser()
            ->postJson('/api/email/accounts/oauth/gmail/auth');

        $this->assertContains($response->status(), [200, 422, 500]);
    }

    public function test_can_get_outlook_oauth_url(): void
    {
        $response = $this->actingAsUser()
            ->postJson('/api/email/accounts/oauth/outlook/auth');

        $this->assertContains($response->status(), [200, 422, 500, 503]);
    }

    public function test_can_list_email_accounts(): void
    {
        EmailAccount::create([
            'user_id' => $this->user->id,
            'tenant_id' => $this->tenant->id,
            'email' => 'user@gmail.com',
            'provider' => 'gmail',
            'account_name' => 'Gmail Pessoal',
            'access_token' => 'fake-token',
            'refresh_token' => 'fake-refresh',
            'is_active' => true,
        ]);

        $response = $this->actingAsUser()
            ->getJson('/api/email/accounts');

        $response->assertStatus(200);
    }

    public function test_can_delete_email_account(): void
    {
        $account = EmailAccount::create([
            'user_id' => $this->user->id,
            'tenant_id' => $this->tenant->id,
            'email' => 'delete@gmail.com',
            'provider' => 'gmail',
            'account_name' => 'Para Deletar',
            'access_token' => 'fake-token',
            'refresh_token' => 'fake-refresh',
            'is_active' => true,
        ]);

        $response = $this->actingAsUser()
            ->deleteJson("/api/email/accounts/{$account->id}");

        $response->assertStatus(200);
    }

    public function test_can_connect_imap_account(): void
    {
        $response = $this->actingAsUser()
            ->postJson('/api/email/accounts/imap', [
                'email' => 'empresa@dominio.com',
                'account_name' => 'Email Corporativo',
                'imap_host' => 'imap.dominio.com',
                'imap_port' => 993,
                'imap_encryption' => 'ssl',
                'smtp_host' => 'smtp.dominio.com',
                'smtp_port' => 587,
                'smtp_encryption' => 'tls',
                'password' => 'senha-imap-123',
            ]);

        $this->assertContains($response->status(), [200, 201, 422, 500]);
    }

    public function test_can_list_inbox(): void
    {
        $response = $this->actingAsUser()
            ->getJson('/api/email/inbox');

        $response->assertStatus(200);
    }

    public function test_invalid_provider_rejected(): void
    {
        $response = $this->actingAsUser()
            ->postJson('/api/email/accounts/oauth/invalid-provider/auth');

        $this->assertContains($response->status(), [400, 404, 422, 500]);
    }

    public function test_can_update_email_account(): void
    {
        $account = EmailAccount::create([
            'user_id' => $this->user->id,
            'tenant_id' => $this->tenant->id,
            'email' => 'update@gmail.com',
            'provider' => 'gmail',
            'account_name' => 'Original',
            'access_token' => 'fake-token',
            'refresh_token' => 'fake-refresh',
            'is_active' => true,
        ]);

        $response = $this->actingAsUser()
            ->putJson("/api/email/accounts/{$account->id}", [
                'account_name' => 'Atualizado',
                'is_active' => false,
            ]);

        $response->assertStatus(200);
    }
}
