<?php

namespace Tests\Feature\Pipeline;

use Tests\TestCase;
use Tests\Helpers\CreatesTestData;
use App\Models\Pipeline;
use App\Models\PipelineStage;
use Illuminate\Foundation\Testing\RefreshDatabase;

class PipelineTest extends TestCase
{
    use RefreshDatabase, CreatesTestData;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpTenantAndUser();
    }

    public function test_can_create_pipeline(): void
    {
        $response = $this->actingAsUser()
            ->postJson('/api/pipelines', [
                'name' => 'Funil de Vendas',
                'description' => 'Pipeline principal',
                'is_default' => false,
            ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('pipelines', [
            'name' => 'Funil de Vendas',
            'tenant_id' => $this->tenant->id,
        ]);
    }

    public function test_pipeline_requires_name(): void
    {
        $response = $this->actingAsUser()
            ->postJson('/api/pipelines', [
                'description' => 'Sem nome',
            ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['name']);
    }

    public function test_can_update_pipeline(): void
    {
        $data = $this->createPipelineWithStages(3);

        $response = $this->actingAsUser()
            ->putJson("/api/pipelines/{$data['pipeline']->id}", [
                'name' => 'Funil Atualizado',
                'description' => 'Nova descrição',
            ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('pipelines', [
            'id' => $data['pipeline']->id,
            'name' => 'Funil Atualizado',
        ]);
    }

    public function test_can_delete_pipeline(): void
    {
        $pipeline = Pipeline::factory()->create([
            'tenant_id' => $this->tenant->id,
            'is_default' => false,
        ]);

        $response = $this->actingAsUser()
            ->deleteJson("/api/pipelines/{$pipeline->id}");

        $response->assertStatus(200);
    }

    public function test_can_list_pipelines(): void
    {
        Pipeline::factory()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Pipeline 1',
        ]);
        Pipeline::factory()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Pipeline 2',
        ]);

        $response = $this->actingAsUser()
            ->getJson('/api/pipelines');

        $response->assertStatus(200);
    }

    public function test_can_view_single_pipeline(): void
    {
        $data = $this->createPipelineWithStages(3);

        $response = $this->actingAsUser()
            ->getJson("/api/pipelines/{$data['pipeline']->id}");

        $response->assertStatus(200);
    }

    public function test_can_update_stages(): void
    {
        $data = $this->createPipelineWithStages(2);
        $pipeline = $data['pipeline'];

        $response = $this->actingAsUser()
            ->putJson("/api/pipelines/{$pipeline->id}/stages", [
                'stages' => [
                    [
                        'name' => 'Novo Lead',
                        'color' => '#3B82F6',
                        'position' => 0,
                        'is_won' => false,
                        'is_lost' => false,
                    ],
                    [
                        'name' => 'Qualificação',
                        'color' => '#F59E0B',
                        'position' => 1,
                        'is_won' => false,
                        'is_lost' => false,
                    ],
                    [
                        'name' => 'Proposta',
                        'color' => '#8B5CF6',
                        'position' => 2,
                        'is_won' => false,
                        'is_lost' => false,
                    ],
                    [
                        'name' => 'Ganho',
                        'color' => '#10B981',
                        'position' => 3,
                        'is_won' => true,
                        'is_lost' => false,
                    ],
                    [
                        'name' => 'Perdido',
                        'color' => '#EF4444',
                        'position' => 4,
                        'is_won' => false,
                        'is_lost' => true,
                    ],
                ],
            ]);

        $response->assertStatus(200);

        $stages = PipelineStage::where('pipeline_id', $pipeline->id)
            ->orderBy('position')
            ->get();

        $this->assertCount(5, $stages);
        $this->assertEquals('Novo Lead', $stages[0]->name);
        $this->assertTrue($stages[3]->is_won);
        $this->assertTrue($stages[4]->is_lost);
    }

    public function test_stages_have_correct_order(): void
    {
        $data = $this->createPipelineWithStages(5);
        $pipeline = $data['pipeline'];

        $stages = PipelineStage::where('pipeline_id', $pipeline->id)
            ->orderBy('position')
            ->get();

        for ($i = 0; $i < $stages->count(); $i++) {
            $this->assertEquals($i, $stages[$i]->position);
        }
    }

    public function test_won_lost_stages_configuration(): void
    {
        $data = $this->createPipelineWithStages(5);
        $pipeline = $data['pipeline'];
        $stages = $data['stages'];

        $wonStages = collect($stages)->filter(fn ($s) => $s->is_won);
        $lostStages = collect($stages)->filter(fn ($s) => $s->is_lost);

        $this->assertCount(1, $wonStages);
        $this->assertCount(1, $lostStages);
    }

    public function test_can_update_custom_fields(): void
    {
        $data = $this->createPipelineWithStages(2);

        $response = $this->actingAsUser()
            ->putJson("/api/pipelines/{$data['pipeline']->id}/custom-fields", [
                'fields' => [
                    [
                        'name' => 'Origem do Lead',
                        'field_key' => 'lead_source',
                        'type' => 'select',
                        'options' => ['Google', 'Indicação', 'Redes Sociais'],
                        'is_required' => false,
                        'position' => 0,
                    ],
                    [
                        'name' => 'Valor Estimado',
                        'field_key' => 'estimated_value',
                        'type' => 'money',
                        'is_required' => false,
                        'position' => 1,
                    ],
                    [
                        'name' => 'Data de Fechamento',
                        'field_key' => 'close_date',
                        'type' => 'date',
                        'is_required' => false,
                        'position' => 2,
                    ],
                ],
            ]);

        $response->assertStatus(200);
    }

    public function test_can_get_pipeline_report(): void
    {
        $data = $this->createPipelineWithStages(3);
        $this->createCard($data['pipeline'], $data['stages'][0], [
            'value' => 1000,
        ]);

        $response = $this->actingAsUser()
            ->getJson("/api/pipelines/{$data['pipeline']->id}/report");

        $response->assertStatus(200);
    }

    public function test_pipeline_creates_default_stages(): void
    {
        $response = $this->actingAsUser()
            ->postJson('/api/pipelines', [
                'name' => 'Auto Stages',
            ]);

        $response->assertStatus(201);
        $pipelineId = $response->json('data.id');

        $stages = PipelineStage::where('pipeline_id', $pipelineId)->get();
        $this->assertGreaterThan(0, $stages->count());
    }
}
