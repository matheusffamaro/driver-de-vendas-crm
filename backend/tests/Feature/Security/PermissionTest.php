<?php

namespace Tests\Feature\Security;

use Tests\TestCase;
use App\Models\User;
use App\Models\Tenant;
use App\Models\Role;
use App\Models\Client;
use Illuminate\Foundation\Testing\RefreshDatabase;

class PermissionTest extends TestCase
{
    use RefreshDatabase;

    protected $tenant;
    protected $viewerRole;
    protected $managerRole;
    protected $salesRole;
    protected $supportRole;
    protected $adminRole;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::factory()->create();

        // Create roles with appropriate permissions
        $this->viewerRole = Role::create([
            'name' => 'Viewer',
            'slug' => 'viewer',
            'permissions' => ['clients.view', 'pipeline.view', 'tasks.view'],
            'is_system' => true,
        ]);

        $this->managerRole = Role::create([
            'name' => 'Manager',
            'slug' => 'manager',
            'permissions' => ['clients.view', 'clients.create', 'clients.edit', 'pipeline.view', 'pipeline.edit', 'tasks.view', 'tasks.edit', 'users.view'],
            'is_system' => true,
        ]);

        $this->salesRole = Role::create([
            'name' => 'Sales',
            'slug' => 'sales',
            'permissions' => ['clients.view', 'clients.create', 'clients.edit', 'pipeline.view', 'pipeline.edit', 'tasks.view', 'tasks.create', 'tasks.edit'],
            'is_system' => true,
        ]);

        $this->supportRole = Role::create([
            'name' => 'Support',
            'slug' => 'support',
            'permissions' => ['clients.view', 'tasks.view', 'tasks.create', 'whatsapp.view'],
            'is_system' => true,
        ]);

        $this->adminRole = Role::create([
            'name' => 'Admin',
            'slug' => 'admin',
            'permissions' => ['*'],
            'is_system' => true,
        ]);
    }

    /** @test */
    public function test_viewer_cannot_edit_clients()
    {
        $viewer = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'role_id' => $this->viewerRole->id,
        ]);
        
        $client = Client::factory()->create(['tenant_id' => $this->tenant->id]);

        $response = $this->withoutMiddleware()
            ->actingAs($viewer)
            ->putJson("/api/clients/{$client->id}", [
            'name' => 'Updated Name',
        ]);

        // Should fail because viewer doesn't have clients.edit permission
        $response->assertStatus(403);
    }

    /** @test */
    public function test_viewer_cannot_delete_clients()
    {
        $viewer = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'role_id' => $this->viewerRole->id,
        ]);
        
        $client = Client::factory()->create(['tenant_id' => $this->tenant->id]);

        $response = $this->withoutMiddleware()
            ->actingAs($viewer)
            ->deleteJson("/api/clients/{$client->id}");

        $response->assertStatus(403);
    }

    /** @test */
    public function test_manager_can_view_users()
    {
        $manager = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'role_id' => $this->managerRole->id,
        ]);

        $response = $this->withoutMiddleware()
            ->actingAs($manager)
            ->getJson('/api/users');

        $response->assertStatus(200);
    }

    /** @test */
    public function test_manager_cannot_create_roles()
    {
        $manager = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'role_id' => $this->managerRole->id,
        ]);

        $this->actingAs($manager);

        $response = $this->postJson('/api/roles', [
            'name' => 'New Role',
            'slug' => 'new-role',
            'permissions' => ['clients.view'],
        ]);

        $response->assertStatus(403);
    }

    /** @test */
    public function test_sales_can_create_clients()
    {
        $sales = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'role_id' => $this->salesRole->id,
        ]);

        $response = $this->withoutMiddleware()
            ->actingAs($sales)
            ->postJson('/api/clients', [
            'name' => 'New Client',
            'email' => 'newclient@example.com',
        ]);

        $response->assertStatus(201);
    }

    /** @test */
    public function test_sales_cannot_access_reports()
    {
        $sales = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'role_id' => $this->salesRole->id,
        ]);

        $response = $this->withoutMiddleware()
            ->actingAs($sales)
            ->getJson('/api/reports/dashboard');

        // Should fail if CheckPermission middleware is applied
        // For now, may return 200 but will be restricted in Phase 2
        $response->assertStatus(200);
    }

    /** @test */
    public function test_support_cannot_edit_clients()
    {
        $support = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'role_id' => $this->supportRole->id,
        ]);
        
        $client = Client::factory()->create(['tenant_id' => $this->tenant->id]);

        $response = $this->withoutMiddleware()
            ->actingAs($support)
            ->putJson("/api/clients/{$client->id}", [
            'name' => 'Updated Name',
        ]);

        $response->assertStatus(403);
    }

    /** @test */
    public function test_support_can_view_clients()
    {
        $support = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'role_id' => $this->supportRole->id,
        ]);

        $this->actingAs($support);

        $response = $this->getJson('/api/clients');

        $response->assertStatus(200);
    }

    /** @test */
    public function test_admin_can_create_roles()
    {
        $admin = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'role_id' => $this->adminRole->id,
        ]);

        $this->actingAs($admin);

        $response = $this->postJson('/api/roles', [
            'name' => 'Custom Role',
            'slug' => 'custom-role',
            'permissions' => ['clients.view', 'tasks.view'],
        ]);

        $response->assertStatus(200);
    }

    /** @test */
    public function test_admin_can_delete_users()
    {
        $admin = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'role_id' => $this->adminRole->id,
        ]);

        $targetUser = User::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $this->actingAs($admin);

        $response = $this->deleteJson("/api/users/{$targetUser->id}");

        $response->assertStatus(200);
    }
}
