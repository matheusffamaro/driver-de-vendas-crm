<?php

namespace Tests\Feature\Security;

use Tests\TestCase;
use App\Models\User;
use App\Models\Tenant;
use App\Models\Client;
use App\Models\CrmTask;
use App\Models\WhatsappSession;
use App\Models\ProductCategory;
use App\Models\Pipeline;
use App\Models\PipelineCard;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

class TenantIsolationTest extends TestCase
{
    use RefreshDatabase;

    protected $tenant1;
    protected $tenant2;
    protected $user1;
    protected $user2;

    protected function setUp(): void
    {
        parent::setUp();

        // Create two tenants
        $this->tenant1 = Tenant::factory()->create(['name' => 'Tenant 1']);
        $this->tenant2 = Tenant::factory()->create(['name' => 'Tenant 2']);

        // Create users for each tenant
        $this->user1 = User::factory()->create(['tenant_id' => $this->tenant1->id]);
        $this->user2 = User::factory()->create(['tenant_id' => $this->tenant2->id]);
    }

    /** @test */
    public function test_user_cannot_access_other_tenant_users()
    {
        $response = $this->withoutMiddleware()
            ->actingAs($this->user1)
            ->getJson("/api/users/{$this->user2->id}");

        $response->assertStatus(404);
    }

    /** @test */
    public function test_user_can_only_list_own_tenant_users()
    {
        User::factory()->create(['tenant_id' => $this->tenant1->id, 'name' => 'User Tenant 1']);
        User::factory()->create(['tenant_id' => $this->tenant2->id, 'name' => 'User Tenant 2']);

        $response = $this->withoutMiddleware()
            ->actingAs($this->user1)
            ->getJson('/api/users');

        $response->assertStatus(200);
        $users = $response->json('data.data') ?? $response->json('data');
        
        // Verify user2 (from tenant2) is NOT in the list
        $userIds = array_column($users, 'id');
        $this->assertNotContains($this->user2->id, $userIds);
    }

    /** @test */
    public function test_user_cannot_list_other_tenant_clients()
    {
        Client::factory()->create(['tenant_id' => $this->tenant1->id, 'name' => 'Client 1']);
        Client::factory()->create(['tenant_id' => $this->tenant2->id, 'name' => 'Client 2']);

        $response = $this->withoutMiddleware()
            ->actingAs($this->user1)
            ->getJson('/api/clients');

        $response->assertStatus(200);
        $clients = $response->json('data.data') ?? $response->json('data');
        
        $this->assertCount(1, $clients);
        $this->assertEquals('Client 1', $clients[0]['name']);
    }

    /** @test */
    public function test_user_cannot_view_other_tenant_client()
    {
        $client2 = Client::factory()->create(['tenant_id' => $this->tenant2->id]);

        $response = $this->withoutMiddleware()
            ->actingAs($this->user1)
            ->getJson("/api/clients/{$client2->id}");

        $response->assertStatus(404);
    }

    /** @test */
    public function test_reports_show_only_tenant_data()
    {
        $pipeline1 = Pipeline::factory()->create(['tenant_id' => $this->tenant1->id]);
        $pipeline2 = Pipeline::factory()->create(['tenant_id' => $this->tenant2->id]);

        // Create stages for pipelines
        $stage1 = \App\Models\PipelineStage::factory()->create(['pipeline_id' => $pipeline1->id]);
        $stage2 = \App\Models\PipelineStage::factory()->create(['pipeline_id' => $pipeline2->id]);

        PipelineCard::factory()->create([
            'pipeline_id' => $pipeline1->id,
            'stage_id' => $stage1->id,
            'tenant_id' => $this->tenant1->id,
            'won_at' => now(),
        ]);
        PipelineCard::factory()->create([
            'pipeline_id' => $pipeline2->id,
            'stage_id' => $stage2->id,
            'tenant_id' => $this->tenant2->id,
            'won_at' => now(),
        ]);

        $response = $this->withoutMiddleware()
            ->actingAs($this->user1)
            ->getJson('/api/reports/dashboard');

        $response->assertStatus(200);
        $data = $response->json('data');
        
        $this->assertEquals(1, $data['cards']['won']);
    }

    /** @test */
    public function test_user_cannot_access_other_tenant_tasks()
    {
        $task1 = CrmTask::factory()->create(['tenant_id' => $this->tenant1->id]);
        $task2 = CrmTask::factory()->create(['tenant_id' => $this->tenant2->id]);

        $this->actingAs($this->user1);

        // Can access own tenant task
        $response = $this->getJson("/api/tasks/{$task1->id}");
        $response->assertStatus(200);

        // Cannot access other tenant task
        $response = $this->getJson("/api/tasks/{$task2->id}");
        $response->assertStatus(404);
    }

    /** @test */
    public function test_user_cannot_access_other_tenant_whatsapp_session()
    {
        $session1 = WhatsappSession::factory()->create(['tenant_id' => $this->tenant1->id]);
        $session2 = WhatsappSession::factory()->create(['tenant_id' => $this->tenant2->id]);

        $this->actingAs($this->user1);

        // Cannot access other tenant session
        $response = $this->getJson("/api/whatsapp/{$session2->id}/status");
        $response->assertStatus(404);
    }

    /** @test */
    public function test_user_can_only_see_own_tenant_product_categories()
    {
        ProductCategory::factory()->create(['tenant_id' => $this->tenant1->id, 'name' => 'Category 1']);
        ProductCategory::factory()->create(['tenant_id' => $this->tenant2->id, 'name' => 'Category 2']);

        $response = $this->withoutMiddleware()
            ->actingAs($this->user1)
            ->getJson('/api/products/categories');

        $response->assertStatus(200);
        $categories = $response->json('data');
        
        $this->assertCount(1, $categories);
        $this->assertEquals('Category 1', $categories[0]['name']);
    }

    /** @test */
    public function test_user_cannot_modify_other_tenant_product_category()
    {
        $category2 = ProductCategory::factory()->create(['tenant_id' => $this->tenant2->id]);

        $response = $this->withoutMiddleware()
            ->actingAs($this->user1)
            ->putJson("/api/products/categories/{$category2->id}", [
            'name' => 'Updated Category',
        ]);

        $response->assertStatus(404);
    }
}
