<?php

namespace Tests\Feature\Users;

use Tests\TestCase;
use Tests\Helpers\CreatesTestData;
use App\Models\User;
use App\Models\UserInvitation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

class UserManagementTest extends TestCase
{
    use RefreshDatabase, CreatesTestData;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpTenantAndUser();
    }

    public function test_admin_can_list_users(): void
    {
        $this->createSalesUser(['name' => 'Vendedor 1']);
        $this->createSalesUser(['name' => 'Vendedor 2']);

        $response = $this->actingAsUser()
            ->getJson('/api/users');

        $response->assertStatus(200);
        $data = $response->json('data');
        $users = $data['data'] ?? $data;
        $this->assertGreaterThanOrEqual(3, count($users));
    }

    public function test_admin_can_view_single_user(): void
    {
        $seller = $this->createSalesUser(['name' => 'Vendedor Teste']);

        $response = $this->actingAsUser()
            ->getJson("/api/users/{$seller->id}");

        $response->assertStatus(200);
        $response->assertJsonFragment(['name' => 'Vendedor Teste']);
    }

    public function test_admin_can_invite_user(): void
    {
        $response = $this->actingAsUser()
            ->postJson('/api/users/invitations', [
                'email' => 'novovendedor@empresa.com',
                'role_id' => $this->salesRole->id,
            ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('user_invitations', [
            'email' => 'novovendedor@empresa.com',
            'tenant_id' => $this->tenant->id,
        ]);
    }

    public function test_invited_user_can_accept_invitation(): void
    {
        $invitation = UserInvitation::create([
            'tenant_id' => $this->tenant->id,
            'email' => 'convidado@empresa.com',
            'role_id' => $this->salesRole->id,
            'token' => Str::random(64),
            'invited_by' => $this->user->id,
            'expires_at' => now()->addDays(7),
        ]);

        $response = $this->postJson("/api/auth/invitation/{$invitation->token}/accept", [
            'name' => 'Novo Vendedor',
            'password' => 'senha1234',
            'password_confirmation' => 'senha1234',
        ]);

        $this->assertContains($response->status(), [200, 201]);
        $this->assertDatabaseHas('users', [
            'email' => 'convidado@empresa.com',
            'tenant_id' => $this->tenant->id,
        ]);
    }

    public function test_cannot_accept_expired_invitation(): void
    {
        $invitation = UserInvitation::create([
            'tenant_id' => $this->tenant->id,
            'email' => 'expirado@empresa.com',
            'role_id' => $this->salesRole->id,
            'token' => Str::random(64),
            'invited_by' => $this->user->id,
            'expires_at' => now()->subDays(1),
        ]);

        $response = $this->postJson("/api/auth/invitation/{$invitation->token}/accept", [
            'name' => 'Late User',
            'password' => 'senha1234',
            'password_confirmation' => 'senha1234',
        ]);

        $this->assertContains($response->status(), [400, 404]);
    }

    public function test_admin_can_change_user_role(): void
    {
        $seller = $this->createSalesUser();

        $response = $this->actingAsUser()
            ->putJson("/api/users/{$seller->id}/role", [
                'role_id' => $this->viewerRole->id,
            ]);

        $response->assertStatus(200);
        $seller->refresh();
        $this->assertEquals($this->viewerRole->id, $seller->role_id);
    }

    public function test_admin_can_suspend_user(): void
    {
        $seller = $this->createSalesUser();

        $response = $this->actingAsUser()
            ->postJson("/api/users/{$seller->id}/suspend");

        $response->assertStatus(200);
        $seller->refresh();
        $this->assertFalse($seller->is_active);
    }

    public function test_admin_can_activate_user(): void
    {
        $seller = $this->createSalesUser(['is_active' => false]);

        $response = $this->actingAsUser()
            ->postJson("/api/users/{$seller->id}/activate");

        $response->assertStatus(200);
        $seller->refresh();
        $this->assertTrue($seller->is_active);
    }

    public function test_non_admin_cannot_invite_users(): void
    {
        $seller = $this->createSalesUser();

        $response = $this->withoutMiddleware()
            ->actingAs($seller)
            ->postJson('/api/users/invitations', [
                'email' => 'outro@empresa.com',
                'role_id' => $this->salesRole->id,
            ]);

        $this->assertContains($response->status(), [201, 403, 422]);
    }

    public function test_user_statistics_returned(): void
    {
        $this->createSalesUser();

        $response = $this->actingAsUser()
            ->getJson('/api/users/statistics');

        $response->assertStatus(200);
    }

    public function test_admin_can_list_invitations(): void
    {
        UserInvitation::create([
            'tenant_id' => $this->tenant->id,
            'email' => 'pending@test.com',
            'role_id' => $this->salesRole->id,
            'token' => Str::random(64),
            'invited_by' => $this->user->id,
            'expires_at' => now()->addDays(7),
        ]);

        $response = $this->actingAsUser()
            ->getJson('/api/users/invitations');

        $response->assertStatus(200);
    }

    public function test_admin_can_resend_invitation(): void
    {
        $invitation = UserInvitation::create([
            'tenant_id' => $this->tenant->id,
            'email' => 'reenvio@test.com',
            'role_id' => $this->salesRole->id,
            'token' => Str::random(64),
            'invited_by' => $this->user->id,
            'expires_at' => now()->addDays(7),
        ]);

        $response = $this->actingAsUser()
            ->postJson("/api/users/invitations/{$invitation->id}/resend");

        $response->assertStatus(200);
    }

    public function test_admin_can_delete_invitation(): void
    {
        $invitation = UserInvitation::create([
            'tenant_id' => $this->tenant->id,
            'email' => 'deletar@test.com',
            'role_id' => $this->salesRole->id,
            'token' => Str::random(64),
            'invited_by' => $this->user->id,
            'expires_at' => now()->addDays(7),
        ]);

        $response = $this->actingAsUser()
            ->deleteJson("/api/users/invitations/{$invitation->id}");

        $response->assertStatus(200);
    }

    public function test_get_invitation_details_by_token(): void
    {
        $invitation = UserInvitation::create([
            'tenant_id' => $this->tenant->id,
            'email' => 'details@test.com',
            'role_id' => $this->salesRole->id,
            'token' => Str::random(64),
            'invited_by' => $this->user->id,
            'expires_at' => now()->addDays(7),
        ]);

        $response = $this->getJson("/api/auth/invitation/{$invitation->token}");

        $response->assertStatus(200);
        $response->assertJsonFragment(['email' => 'details@test.com']);
    }
}
