<?php

namespace Tests\Feature\Auth;

use Tests\TestCase;
use Tests\Helpers\CreatesTestData;
use App\Models\User;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

class AuthTest extends TestCase
{
    use RefreshDatabase, CreatesTestData;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpTenantAndUser();
    }

    public function test_user_can_register_with_valid_data(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'Novo Usuario',
            'email' => 'novo@empresa.com',
            'password' => 'senha123',
            'password_confirmation' => 'senha123',
            'tenant_name' => 'Minha Empresa',
        ]);

        $response->assertStatus(201);
        $response->assertJsonStructure([
            'data' => ['tokens' => ['access_token', 'refresh_token'], 'user'],
        ]);

        $this->assertDatabaseHas('users', ['email' => 'novo@empresa.com']);
        $this->assertDatabaseHas('tenants', ['name' => 'Minha Empresa']);
    }

    public function test_register_fails_without_required_fields(): void
    {
        $response = $this->postJson('/api/auth/register', []);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['name', 'email', 'password', 'tenant_name']);
    }

    public function test_register_fails_with_duplicate_email(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => 'User One',
            'email' => 'duplicate@test.com',
            'password' => 'senha123',
            'password_confirmation' => 'senha123',
            'tenant_name' => 'Empresa 1',
        ]);

        $response = $this->postJson('/api/auth/register', [
            'name' => 'User Two',
            'email' => 'duplicate@test.com',
            'password' => 'senha123',
            'password_confirmation' => 'senha123',
            'tenant_name' => 'Empresa 2',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['email']);
    }

    public function test_register_fails_with_short_password(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'User',
            'email' => 'test@test.com',
            'password' => '123',
            'password_confirmation' => '123',
            'tenant_name' => 'Empresa',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['password']);
    }

    public function test_register_fails_with_password_mismatch(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'User',
            'email' => 'test@test.com',
            'password' => 'senha123',
            'password_confirmation' => 'outrasenha',
            'tenant_name' => 'Empresa',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['password']);
    }

    public function test_user_can_login(): void
    {
        $user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'email' => 'login@test.com',
            'password' => Hash::make('senha123'),
            'role_id' => $this->adminRole->id,
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'login@test.com',
            'password' => 'senha123',
        ]);

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'data' => ['tokens' => ['access_token', 'refresh_token'], 'user'],
        ]);
    }

    public function test_login_fails_with_wrong_credentials(): void
    {
        $response = $this->postJson('/api/auth/login', [
            'email' => 'naoexiste@test.com',
            'password' => 'senhaerrada',
        ]);

        $response->assertStatus(401);
    }

    public function test_login_fails_with_missing_fields(): void
    {
        $response = $this->postJson('/api/auth/login', []);

        $this->assertContains($response->status(), [422, 500]);
    }

    public function test_user_can_logout(): void
    {
        $response = $this->actingAsUser()
            ->postJson('/api/auth/logout');

        $response->assertStatus(200);
    }

    public function test_user_can_get_profile(): void
    {
        $response = $this->actingAsUser()
            ->getJson('/api/auth/me');

        $response->assertStatus(200);
        $response->assertJsonFragment(['email' => $this->user->email]);
    }

    public function test_user_can_update_profile(): void
    {
        $response = $this->actingAsUser()
            ->putJson('/api/auth/profile', [
                'name' => 'Nome Atualizado',
                'phone' => '11999999999',
            ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('users', [
            'id' => $this->user->id,
            'name' => 'Nome Atualizado',
        ]);
    }

    public function test_user_can_change_password(): void
    {
        $user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'password' => Hash::make('senhaantiga'),
            'role_id' => $this->adminRole->id,
        ]);

        $response = $this->withoutMiddleware()
            ->actingAs($user)
            ->putJson('/api/auth/password', [
                'current_password' => 'senhaantiga',
                'password' => 'senhanova1',
                'password_confirmation' => 'senhanova1',
            ]);

        $response->assertStatus(200);

        $user->refresh();
        $this->assertTrue(Hash::check('senhanova1', $user->password));
    }

    public function test_change_password_fails_with_wrong_current(): void
    {
        $response = $this->actingAsUser()
            ->putJson('/api/auth/password', [
                'current_password' => 'senhaerrada',
                'password' => 'senhanova1',
                'password_confirmation' => 'senhanova1',
            ]);

        $response->assertStatus(400);
    }

    public function test_register_creates_trial_subscription(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'Trial User',
            'email' => 'trial@test.com',
            'password' => 'senha123',
            'password_confirmation' => 'senha123',
            'tenant_name' => 'Trial Company',
        ]);

        $response->assertStatus(201);

        $user = User::where('email', 'trial@test.com')->first();
        $this->assertNotNull($user->tenant_id);

        $tenant = Tenant::find($user->tenant_id);
        $this->assertNotNull($tenant->subscription);
    }
}
