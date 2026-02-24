<?php

namespace Tests\Feature\Tasks;

use Tests\TestCase;
use Tests\Helpers\CreatesTestData;
use App\Models\CrmTask;
use Illuminate\Foundation\Testing\RefreshDatabase;

class CrmTaskTest extends TestCase
{
    use RefreshDatabase, CreatesTestData;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpTenantAndUser();
    }

    public function test_can_create_task(): void
    {
        $response = $this->actingAsUser()
            ->postJson('/api/crm/tasks', [
                'title' => 'Ligar para cliente',
                'description' => 'Follow-up da proposta enviada',
                'type' => 'call',
                'priority' => 'high',
                'scheduled_at' => now()->addDays(1)->toDateString(),
            ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('crm_tasks', [
            'title' => 'Ligar para cliente',
            'type' => 'call',
            'tenant_id' => $this->tenant->id,
        ]);
    }

    public function test_task_requires_title(): void
    {
        $response = $this->actingAsUser()
            ->postJson('/api/crm/tasks', [
                'description' => 'Sem título',
            ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['title']);
    }

    public function test_can_create_task_linked_to_card(): void
    {
        $data = $this->createPipelineWithStages(3);
        $card = $this->createCard($data['pipeline'], $data['stages'][0]);

        $response = $this->actingAsUser()
            ->postJson('/api/crm/tasks', [
                'title' => 'Tarefa do Card',
                'card_id' => $card->id,
                'type' => 'task',
                'priority' => 'medium',
            ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('crm_tasks', [
            'title' => 'Tarefa do Card',
            'card_id' => $card->id,
        ]);
    }

    public function test_can_create_task_linked_to_contact(): void
    {
        $client = $this->createClient();

        $response = $this->actingAsUser()
            ->postJson('/api/crm/tasks', [
                'title' => 'Tarefa do Contato',
                'contact_id' => $client->id,
                'type' => 'meeting',
                'priority' => 'low',
            ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('crm_tasks', [
            'title' => 'Tarefa do Contato',
            'contact_id' => $client->id,
        ]);
    }

    public function test_can_assign_task_to_user(): void
    {
        $seller = $this->createSalesUser();

        $response = $this->actingAsUser()
            ->postJson('/api/crm/tasks', [
                'title' => 'Tarefa Atribuída',
                'assigned_to' => $seller->id,
                'type' => 'follow_up',
            ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('crm_tasks', [
            'title' => 'Tarefa Atribuída',
            'assigned_to' => $seller->id,
        ]);
    }

    public function test_can_update_task(): void
    {
        $task = $this->createTask(['title' => 'Original']);

        $response = $this->actingAsUser()
            ->putJson("/api/crm/tasks/{$task->id}", [
                'title' => 'Atualizada',
                'priority' => 'urgent',
                'status' => 'in_progress',
            ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('crm_tasks', [
            'id' => $task->id,
            'title' => 'Atualizada',
        ]);
    }

    public function test_can_complete_task(): void
    {
        $task = $this->createTask(['status' => 'pending']);

        $response = $this->actingAsUser()
            ->postJson("/api/crm/tasks/{$task->id}/complete");

        $response->assertStatus(200);

        $task->refresh();
        $this->assertEquals('completed', $task->status);
    }

    public function test_can_delete_task(): void
    {
        $task = $this->createTask();

        $response = $this->actingAsUser()
            ->deleteJson("/api/crm/tasks/{$task->id}");

        $response->assertStatus(200);
    }

    public function test_can_list_tasks(): void
    {
        $this->createTask(['title' => 'Tarefa 1']);
        $this->createTask(['title' => 'Tarefa 2']);
        $this->createTask(['title' => 'Tarefa 3']);

        $response = $this->actingAsUser()
            ->getJson('/api/crm/tasks');

        $response->assertStatus(200);
    }

    public function test_can_view_single_task(): void
    {
        $task = $this->createTask(['title' => 'Detalhe Tarefa']);

        $response = $this->actingAsUser()
            ->getJson("/api/crm/tasks/{$task->id}");

        $response->assertStatus(200);
        $response->assertJsonFragment(['title' => 'Detalhe Tarefa']);
    }

    public function test_can_filter_tasks_by_status(): void
    {
        $this->createTask(['status' => 'pending']);
        $this->createTask(['status' => 'completed']);

        $response = $this->actingAsUser()
            ->getJson('/api/crm/tasks?status=pending');

        $response->assertStatus(200);
    }

    public function test_can_filter_tasks_by_type(): void
    {
        $this->createTask(['type' => 'call']);
        $this->createTask(['type' => 'meeting']);

        $response = $this->actingAsUser()
            ->getJson('/api/crm/tasks?type=call');

        $response->assertStatus(200);
    }

    public function test_can_filter_tasks_by_priority(): void
    {
        $this->createTask(['priority' => 'urgent']);
        $this->createTask(['priority' => 'low']);

        $response = $this->actingAsUser()
            ->getJson('/api/crm/tasks?priority=urgent');

        $response->assertStatus(200);
    }

    public function test_task_types(): void
    {
        $types = ['task', 'call', 'meeting', 'email', 'follow_up'];

        foreach ($types as $type) {
            $response = $this->actingAsUser()
                ->postJson('/api/crm/tasks', [
                    'title' => "Tarefa tipo {$type}",
                    'type' => $type,
                ]);

            $response->assertStatus(201);
        }

        $tasks = CrmTask::where('tenant_id', $this->tenant->id)
            ->whereIn('type', $types)
            ->get();
        $this->assertCount(5, $tasks);
    }

    public function test_task_priorities(): void
    {
        $priorities = ['low', 'medium', 'high', 'urgent'];

        foreach ($priorities as $priority) {
            $response = $this->actingAsUser()
                ->postJson('/api/crm/tasks', [
                    'title' => "Tarefa {$priority}",
                    'priority' => $priority,
                ]);

            $response->assertStatus(201);
        }
    }

    public function test_task_statuses(): void
    {
        $task = $this->createTask(['status' => 'pending']);

        $statuses = ['in_progress', 'completed', 'cancelled'];
        foreach ($statuses as $status) {
            $response = $this->actingAsUser()
                ->putJson("/api/crm/tasks/{$task->id}", [
                    'status' => $status,
                ]);

            $response->assertStatus(200);
            $task->refresh();
            $this->assertEquals($status, $task->status);
        }
    }

    public function test_can_filter_my_tasks(): void
    {
        $seller = $this->createSalesUser();
        $this->createTask(['assigned_to' => $this->user->id]);
        $this->createTask(['assigned_to' => $seller->id]);

        $response = $this->actingAsUser()
            ->getJson('/api/crm/tasks?my_tasks=true');

        $response->assertStatus(200);
    }

    public function test_can_filter_tasks_by_card(): void
    {
        $data = $this->createPipelineWithStages(3);
        $card = $this->createCard($data['pipeline'], $data['stages'][0]);

        $this->createTask(['card_id' => $card->id]);
        $this->createTask();

        $response = $this->actingAsUser()
            ->getJson("/api/crm/tasks?card_id={$card->id}");

        $response->assertStatus(200);
    }

    public function test_can_filter_tasks_by_date_range(): void
    {
        $this->createTask(['scheduled_at' => now()->addDays(1)]);
        $this->createTask(['scheduled_at' => now()->addDays(10)]);

        $from = now()->toDateString();
        $to = now()->addDays(5)->toDateString();

        $response = $this->actingAsUser()
            ->getJson("/api/crm/tasks?date_from={$from}&date_to={$to}");

        $response->assertStatus(200);
    }
}
