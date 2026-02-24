<?php

namespace Tests\Feature\Pipeline;

use Tests\TestCase;
use Tests\Helpers\CreatesTestData;
use App\Models\Pipeline;
use App\Models\PipelineCard;
use App\Models\PipelineCardComment;
use App\Models\PipelineCardProduct;
use App\Models\PipelineStage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class PipelineCardTest extends TestCase
{
    use RefreshDatabase, CreatesTestData;

    protected Pipeline $pipeline;
    protected array $stages;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpTenantAndUser();

        $data = $this->createPipelineWithStages(5);
        $this->pipeline = $data['pipeline'];
        $this->stages = $data['stages'];
    }

    public function test_can_create_card_with_contact_and_seller(): void
    {
        $client = $this->createClient();
        $seller = $this->createSalesUser(['name' => 'Vendedor João']);

        $response = $this->actingAsUser()
            ->postJson("/api/pipelines/{$this->pipeline->id}/cards", [
                'title' => 'Venda para João',
                'stage_id' => $this->stages[0]->id,
                'contact_id' => $client->id,
                'assigned_to' => $seller->id,
                'value' => 5000.00,
                'priority' => 'high',
            ]);

        $response->assertStatus(201);
        $response->assertJsonFragment(['title' => 'Venda para João']);

        $this->assertDatabaseHas('pipeline_cards', [
            'title' => 'Venda para João',
            'contact_id' => $client->id,
            'assigned_to' => $seller->id,
        ]);
    }

    public function test_can_create_card_with_products(): void
    {
        $product1 = $this->createProduct(['price' => 100.00]);
        $product2 = $this->createProduct(['price' => 200.00]);

        $response = $this->actingAsUser()
            ->postJson("/api/pipelines/{$this->pipeline->id}/cards", [
                'title' => 'Card com Produtos',
                'stage_id' => $this->stages[0]->id,
                'value' => 500.00,
                'products' => [
                    [
                        'product_id' => $product1->id,
                        'quantity' => 2,
                        'unit_price' => 100.00,
                        'discount' => 0,
                    ],
                    [
                        'product_id' => $product2->id,
                        'quantity' => 1,
                        'unit_price' => 200.00,
                        'discount' => 10.00,
                    ],
                ],
            ]);

        $response->assertStatus(201);
        $cardId = $response->json('data.id');

        $cardProducts = PipelineCardProduct::where('card_id', $cardId)->get();
        $this->assertCount(2, $cardProducts);
    }

    public function test_can_create_card_with_custom_fields(): void
    {
        $response = $this->actingAsUser()
            ->postJson("/api/pipelines/{$this->pipeline->id}/cards", [
                'title' => 'Card Customizado',
                'stage_id' => $this->stages[0]->id,
                'custom_fields' => [
                    'lead_source' => 'Google',
                    'estimated_value' => 10000,
                ],
            ]);

        $response->assertStatus(201);
    }

    public function test_can_update_card_products(): void
    {
        $card = $this->createCard($this->pipeline, $this->stages[0]);
        $product = $this->createProduct(['price' => 150.00]);

        $response = $this->actingAsUser()
            ->putJson("/api/pipelines/{$this->pipeline->id}/cards/{$card->id}/products", [
                'products' => [
                    [
                        'product_id' => $product->id,
                        'quantity' => 3,
                        'unit_price' => 150.00,
                        'discount' => 5.00,
                    ],
                ],
            ]);

        $response->assertStatus(200);

        $cardProducts = PipelineCardProduct::where('card_id', $card->id)->get();
        $this->assertCount(1, $cardProducts);
        $this->assertEquals(3, (int)$cardProducts->first()->quantity);
    }

    public function test_can_move_card_between_stages(): void
    {
        $card = $this->createCard($this->pipeline, $this->stages[0]);

        $response = $this->actingAsUser()
            ->postJson("/api/pipelines/{$this->pipeline->id}/cards/{$card->id}/move", [
                'stage_id' => $this->stages[1]->id,
                'position' => 0,
            ]);

        $response->assertStatus(200);

        $card->refresh();
        $this->assertEquals($this->stages[1]->id, $card->stage_id);
    }

    public function test_can_move_card_to_won_stage(): void
    {
        $card = $this->createCard($this->pipeline, $this->stages[0]);
        $wonStage = collect($this->stages)->firstWhere('is_won', true);

        $response = $this->actingAsUser()
            ->postJson("/api/pipelines/{$this->pipeline->id}/cards/{$card->id}/move", [
                'stage_id' => $wonStage->id,
            ]);

        $response->assertStatus(200);
        $card->refresh();
        $this->assertEquals($wonStage->id, $card->stage_id);
    }

    public function test_can_move_card_to_lost_stage_with_reason(): void
    {
        $card = $this->createCard($this->pipeline, $this->stages[0]);
        $lostStage = collect($this->stages)->firstWhere('is_lost', true);

        $response = $this->actingAsUser()
            ->postJson("/api/pipelines/{$this->pipeline->id}/cards/{$card->id}/move", [
                'stage_id' => $lostStage->id,
                'lost_reason' => 'Preço alto para o cliente',
            ]);

        $response->assertStatus(200);
    }

    public function test_can_reorder_cards_in_stage(): void
    {
        $card1 = $this->createCard($this->pipeline, $this->stages[0], ['position' => 0]);
        $card2 = $this->createCard($this->pipeline, $this->stages[0], ['position' => 1]);
        $card3 = $this->createCard($this->pipeline, $this->stages[0], ['position' => 2]);

        $response = $this->actingAsUser()
            ->postJson("/api/pipelines/{$this->pipeline->id}/cards/reorder", [
                'stage_id' => $this->stages[0]->id,
                'cards' => [
                    ['id' => $card3->id, 'position' => 0],
                    ['id' => $card1->id, 'position' => 1],
                    ['id' => $card2->id, 'position' => 2],
                ],
            ]);

        $response->assertStatus(200);

        $card3->refresh();
        $this->assertEquals(0, $card3->position);
    }

    public function test_can_add_comment_to_card(): void
    {
        $card = $this->createCard($this->pipeline, $this->stages[0]);

        $response = $this->actingAsUser()
            ->postJson("/api/pipelines/{$this->pipeline->id}/cards/{$card->id}/comments", [
                'content' => 'Esta é uma observação importante sobre o negócio.',
            ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('pipeline_card_comments', [
            'card_id' => $card->id,
            'content' => 'Esta é uma observação importante sobre o negócio.',
        ]);
    }

    public function test_can_update_comment(): void
    {
        $card = $this->createCard($this->pipeline, $this->stages[0]);
        $comment = PipelineCardComment::create([
            'card_id' => $card->id,
            'user_id' => $this->user->id,
            'content' => 'Comentário original',
        ]);

        $response = $this->actingAsUser()
            ->putJson("/api/pipelines/{$this->pipeline->id}/cards/{$card->id}/comments/{$comment->id}", [
                'content' => 'Comentário atualizado',
            ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('pipeline_card_comments', [
            'id' => $comment->id,
            'content' => 'Comentário atualizado',
        ]);
    }

    public function test_can_delete_comment(): void
    {
        $card = $this->createCard($this->pipeline, $this->stages[0]);
        $comment = PipelineCardComment::create([
            'card_id' => $card->id,
            'user_id' => $this->user->id,
            'content' => 'Para deletar',
        ]);

        $response = $this->actingAsUser()
            ->deleteJson("/api/pipelines/{$this->pipeline->id}/cards/{$card->id}/comments/{$comment->id}");

        $response->assertStatus(200);
    }

    public function test_can_list_comments(): void
    {
        $card = $this->createCard($this->pipeline, $this->stages[0]);
        PipelineCardComment::create([
            'card_id' => $card->id,
            'user_id' => $this->user->id,
            'content' => 'Primeira obs',
        ]);
        PipelineCardComment::create([
            'card_id' => $card->id,
            'user_id' => $this->user->id,
            'content' => 'Segunda obs',
        ]);

        $response = $this->actingAsUser()
            ->getJson("/api/pipelines/{$this->pipeline->id}/cards/{$card->id}/comments");

        $response->assertStatus(200);
    }

    public function test_can_upload_attachment(): void
    {
        Storage::fake('local');
        $card = $this->createCard($this->pipeline, $this->stages[0]);
        $file = UploadedFile::fake()->create('documento.pdf', 500);

        $response = $this->actingAsUser()
            ->postJson("/api/pipelines/{$this->pipeline->id}/cards/{$card->id}/attachments", [
                'file' => $file,
            ]);

        $response->assertStatus(201);
    }

    public function test_can_archive_and_unarchive_card(): void
    {
        $card = $this->createCard($this->pipeline, $this->stages[0]);

        $archiveResponse = $this->actingAsUser()
            ->postJson("/api/pipelines/{$this->pipeline->id}/cards/{$card->id}/archive");
        $archiveResponse->assertStatus(200);

        $card->refresh();
        $this->assertTrue($card->is_archived);

        $unarchiveResponse = $this->actingAsUser()
            ->postJson("/api/pipelines/{$this->pipeline->id}/cards/{$card->id}/unarchive");
        $unarchiveResponse->assertStatus(200);

        $card->refresh();
        $this->assertFalse($card->is_archived);
    }

    public function test_can_list_archived_cards(): void
    {
        $card = $this->createCard($this->pipeline, $this->stages[0]);
        $card->archive();

        $response = $this->actingAsUser()
            ->getJson("/api/pipelines/{$this->pipeline->id}/archived");

        $response->assertStatus(200);
    }

    public function test_card_with_different_sellers(): void
    {
        $seller1 = $this->createSalesUser(['name' => 'Vendedor A']);
        $seller2 = $this->createSalesUser(['name' => 'Vendedor B']);
        $seller3 = $this->createSalesUser(['name' => 'Vendedor C']);

        $this->createCard($this->pipeline, $this->stages[0], [
            'title' => 'Card Vendedor A',
            'assigned_to' => $seller1->id,
        ]);
        $this->createCard($this->pipeline, $this->stages[0], [
            'title' => 'Card Vendedor B',
            'assigned_to' => $seller2->id,
        ]);
        $this->createCard($this->pipeline, $this->stages[1], [
            'title' => 'Card Vendedor C',
            'assigned_to' => $seller3->id,
        ]);

        $response = $this->actingAsUser()
            ->getJson("/api/pipelines/{$this->pipeline->id}/cards");

        $response->assertStatus(200);
    }

    public function test_card_with_multiple_products_and_values(): void
    {
        $product1 = $this->createProduct(['name' => 'Produto X', 'price' => 100.00]);
        $product2 = $this->createProduct(['name' => 'Produto Y', 'price' => 250.00]);
        $product3 = $this->createProduct(['name' => 'Servico Z', 'price' => 500.00]);

        $response = $this->actingAsUser()
            ->postJson("/api/pipelines/{$this->pipeline->id}/cards", [
                'title' => 'Venda Multi-Produto',
                'stage_id' => $this->stages[0]->id,
                'value' => 1350.00,
                'products' => [
                    ['product_id' => $product1->id, 'quantity' => 5, 'unit_price' => 100.00, 'discount' => 0],
                    ['product_id' => $product2->id, 'quantity' => 2, 'unit_price' => 250.00, 'discount' => 50.00],
                    ['product_id' => $product3->id, 'quantity' => 1, 'unit_price' => 500.00, 'discount' => 0],
                ],
            ]);

        $response->assertStatus(201);
        $cardId = $response->json('data.id');

        $products = PipelineCardProduct::where('card_id', $cardId)->get();
        $this->assertCount(3, $products);
    }

    public function test_card_priority_levels(): void
    {
        $priorities = ['low', 'medium', 'high', 'urgent'];

        foreach ($priorities as $priority) {
            $response = $this->actingAsUser()
                ->postJson("/api/pipelines/{$this->pipeline->id}/cards", [
                    'title' => "Card {$priority}",
                    'stage_id' => $this->stages[0]->id,
                    'priority' => $priority,
                ]);

            $response->assertStatus(201);
        }

        $cards = PipelineCard::where('pipeline_id', $this->pipeline->id)
            ->whereIn('priority', $priorities)
            ->get();

        $this->assertCount(4, $cards);
    }

    public function test_card_observation_via_comments(): void
    {
        $card = $this->createCard($this->pipeline, $this->stages[0], [
            'title' => 'Card com Observações',
        ]);

        $observations = [
            'Cliente demonstrou interesse no produto premium.',
            'Agendar follow-up para semana que vem.',
            'Desconto aprovado pelo gerente: 15%.',
        ];

        foreach ($observations as $obs) {
            $response = $this->actingAsUser()
                ->postJson("/api/pipelines/{$this->pipeline->id}/cards/{$card->id}/comments", [
                    'content' => $obs,
                ]);
            $response->assertStatus(201);
        }

        $comments = PipelineCardComment::where('card_id', $card->id)->get();
        $this->assertCount(3, $comments);
    }

    public function test_complete_card_flow(): void
    {
        $client = $this->createClient(['name' => 'Cliente Flow']);
        $seller = $this->createSalesUser(['name' => 'Vendedor Flow']);
        $product = $this->createProduct(['price' => 300.00]);

        // 1. Create card
        $createResponse = $this->actingAsUser()
            ->postJson("/api/pipelines/{$this->pipeline->id}/cards", [
                'title' => 'Negócio Completo',
                'stage_id' => $this->stages[0]->id,
                'contact_id' => $client->id,
                'assigned_to' => $seller->id,
                'value' => 900.00,
                'priority' => 'high',
                'products' => [
                    ['product_id' => $product->id, 'quantity' => 3, 'unit_price' => 300.00, 'discount' => 0],
                ],
            ]);
        $createResponse->assertStatus(201);
        $cardId = $createResponse->json('data.id');

        // 2. Add observation
        $commentResponse = $this->actingAsUser()
            ->postJson("/api/pipelines/{$this->pipeline->id}/cards/{$cardId}/comments", [
                'content' => 'Reunião agendada para apresentação da proposta.',
            ]);
        $commentResponse->assertStatus(201);

        // 3. Move to negotiation stage
        $moveResponse = $this->actingAsUser()
            ->postJson("/api/pipelines/{$this->pipeline->id}/cards/{$cardId}/move", [
                'stage_id' => $this->stages[1]->id,
            ]);
        $moveResponse->assertStatus(200);

        // 4. Add another observation
        $this->actingAsUser()
            ->postJson("/api/pipelines/{$this->pipeline->id}/cards/{$cardId}/comments", [
                'content' => 'Proposta aceita, aguardando assinatura.',
            ]);

        // 5. Move to won stage
        $wonStage = collect($this->stages)->firstWhere('is_won', true);
        $wonResponse = $this->actingAsUser()
            ->postJson("/api/pipelines/{$this->pipeline->id}/cards/{$cardId}/move", [
                'stage_id' => $wonStage->id,
            ]);
        $wonResponse->assertStatus(200);

        // 6. Verify final state
        $card = PipelineCard::find($cardId);
        $this->assertEquals($wonStage->id, $card->stage_id);
        $this->assertEquals($client->id, $card->contact_id);
        $this->assertEquals($seller->id, $card->assigned_to);

        $products = PipelineCardProduct::where('card_id', $cardId)->get();
        $this->assertCount(1, $products);

        $comments = PipelineCardComment::where('card_id', $cardId)->get();
        $this->assertCount(2, $comments);
    }

    public function test_can_list_cards_kanban_view(): void
    {
        $this->createCard($this->pipeline, $this->stages[0], ['title' => 'Card 1']);
        $this->createCard($this->pipeline, $this->stages[1], ['title' => 'Card 2']);

        $response = $this->actingAsUser()
            ->getJson("/api/pipelines/{$this->pipeline->id}/cards");

        $response->assertStatus(200);
    }

    public function test_can_view_single_card(): void
    {
        $card = $this->createCard($this->pipeline, $this->stages[0], [
            'title' => 'Card Detalhe',
        ]);

        $response = $this->actingAsUser()
            ->getJson("/api/pipelines/{$this->pipeline->id}/cards/{$card->id}");

        $response->assertStatus(200);
        $response->assertJsonFragment(['title' => 'Card Detalhe']);
    }

    public function test_can_update_card(): void
    {
        $card = $this->createCard($this->pipeline, $this->stages[0]);

        $response = $this->actingAsUser()
            ->putJson("/api/pipelines/{$this->pipeline->id}/cards/{$card->id}", [
                'title' => 'Título Atualizado',
                'value' => 7500.00,
                'priority' => 'urgent',
            ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('pipeline_cards', [
            'id' => $card->id,
            'title' => 'Título Atualizado',
        ]);
    }

    public function test_can_delete_card(): void
    {
        $card = $this->createCard($this->pipeline, $this->stages[0]);

        $response = $this->actingAsUser()
            ->deleteJson("/api/pipelines/{$this->pipeline->id}/cards/{$card->id}");

        $response->assertStatus(200);
    }

    public function test_card_requires_title_and_stage(): void
    {
        $response = $this->actingAsUser()
            ->postJson("/api/pipelines/{$this->pipeline->id}/cards", []);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['title', 'stage_id']);
    }
}
