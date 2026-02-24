<?php

namespace Tests\Helpers;

use App\Models\Client;
use App\Models\CrmTask;
use App\Models\Pipeline;
use App\Models\PipelineCard;
use App\Models\PipelineStage;
use App\Models\Plan;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Role;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WhatsappConversation;
use App\Models\WhatsappSession;

trait CreatesTestData
{
    protected Tenant $tenant;
    protected User $user;
    protected Role $adminRole;
    protected Role $salesRole;
    protected Role $viewerRole;

    protected function setUpTenantAndUser(): void
    {
        $this->tenant = Tenant::factory()->create();
        $this->tenant->refresh();

        $this->createRoles();
        $this->createSubscription();

        $this->user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'role_id' => $this->adminRole->id,
        ]);
        $this->user->refresh();
    }

    protected function createRoles(): void
    {
        $this->adminRole = Role::firstOrCreate(
            ['slug' => 'admin'],
            [
                'name' => 'Administrador',
                'description' => 'Acesso total',
                'permissions' => ['*'],
                'is_system' => true,
            ]
        );

        $this->salesRole = Role::firstOrCreate(
            ['slug' => 'sales'],
            [
                'name' => 'Vendedor',
                'description' => 'Acesso vendas',
                'permissions' => Role::SYSTEM_ROLES['sales']['permissions'],
                'is_system' => true,
            ]
        );

        $this->viewerRole = Role::firstOrCreate(
            ['slug' => 'viewer'],
            [
                'name' => 'Visualizador',
                'description' => 'Apenas visualização',
                'permissions' => Role::SYSTEM_ROLES['viewer']['permissions'],
                'is_system' => true,
            ]
        );
    }

    protected function createSubscription(): void
    {
        $plan = Plan::where('slug', 'business')->first();

        if (!$plan) {
            $plan = Plan::create([
                'name' => 'Business',
                'slug' => 'business-test-' . uniqid(),
                'description' => 'Test plan',
                'price_monthly' => 199.90,
                'price_yearly' => 1918.80,
                'max_users' => 30,
                'max_clients' => 10000,
                'max_transactions' => 20000,
                'included_users' => 30,
                'included_clients' => 10000,
                'included_products' => 2000,
                'included_transactions' => 20000,
                'trial_days' => 14,
                'features' => [
                    'whatsapp_integration' => true,
                    'ai_agent' => true,
                    'pipeline_kanban' => true,
                ],
                'is_active' => true,
            ]);
        }

        Subscription::create([
            'tenant_id' => $this->tenant->id,
            'plan_id' => $plan->id,
            'status' => 'active',
            'starts_at' => now(),
            'ends_at' => now()->addYear(),
        ]);
    }

    protected function createSalesUser(array $overrides = []): User
    {
        $user = User::factory()->create(array_merge([
            'tenant_id' => $this->tenant->id,
            'role_id' => $this->salesRole->id,
        ], $overrides));
        $user->refresh();
        return $user;
    }

    protected function createClient(array $overrides = []): Client
    {
        return Client::factory()->create(array_merge([
            'tenant_id' => $this->tenant->id,
        ], $overrides));
    }

    protected function createProduct(array $overrides = []): Product
    {
        return Product::factory()->create(array_merge([
            'tenant_id' => $this->tenant->id,
        ], $overrides));
    }

    protected function createCategory(array $overrides = []): ProductCategory
    {
        return ProductCategory::factory()->create(array_merge([
            'tenant_id' => $this->tenant->id,
        ], $overrides));
    }

    protected function createPipelineWithStages(int $stageCount = 3): array
    {
        $pipeline = Pipeline::factory()->create([
            'tenant_id' => $this->tenant->id,
            'is_default' => true,
        ]);

        $stages = [];
        $stageNames = ['Novo', 'Em Negociação', 'Proposta', 'Ganho', 'Perdido'];
        for ($i = 0; $i < $stageCount; $i++) {
            $stages[] = PipelineStage::factory()->create([
                'pipeline_id' => $pipeline->id,
                'name' => $stageNames[$i] ?? "Stage {$i}",
                'position' => $i,
                'is_won' => ($i === $stageCount - 2) ? true : false,
                'is_lost' => ($i === $stageCount - 1) ? true : false,
            ]);
        }

        return ['pipeline' => $pipeline, 'stages' => $stages];
    }

    protected function createCard(Pipeline $pipeline, PipelineStage $stage, array $overrides = []): PipelineCard
    {
        return PipelineCard::factory()->create(array_merge([
            'pipeline_id' => $pipeline->id,
            'stage_id' => $stage->id,
            'tenant_id' => $this->tenant->id,
        ], $overrides));
    }

    protected function createTask(array $overrides = []): CrmTask
    {
        return CrmTask::factory()->create(array_merge([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
        ], $overrides));
    }

    protected function createWhatsappSession(array $overrides = []): WhatsappSession
    {
        return WhatsappSession::factory()->create(array_merge([
            'tenant_id' => $this->tenant->id,
        ], $overrides));
    }

    protected function createConversation(WhatsappSession $session, array $overrides = []): WhatsappConversation
    {
        return WhatsappConversation::factory()->create(array_merge([
            'session_id' => $session->id,
        ], $overrides));
    }

    protected function actingAsUser(?User $user = null): static
    {
        return $this->withoutMiddleware()->actingAs($user ?? $this->user);
    }
}
