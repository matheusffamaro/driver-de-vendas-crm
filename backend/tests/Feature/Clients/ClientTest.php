<?php

namespace Tests\Feature\Clients;

use Tests\TestCase;
use Tests\Helpers\CreatesTestData;
use App\Models\Client;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;

class ClientTest extends TestCase
{
    use RefreshDatabase, CreatesTestData;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpTenantAndUser();
    }

    public function test_can_create_client_with_all_fields(): void
    {
        $response = $this->actingAsUser()
            ->postJson('/api/clients', [
                'name' => 'João Silva',
                'email' => 'joao@empresa.com',
                'phone' => '11999887766',
                'document' => '123.456.789-00',
                'document_type' => 'cpf',
                'type' => 'individual',
                'company_name' => null,
                'status' => 'active',
                'notes' => 'Cliente VIP',
                'address' => 'Rua das Flores, 100',
                'city' => 'São Paulo',
                'state' => 'SP',
                'zip_code' => '01001-000',
                'country' => 'Brasil',
            ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('clients', [
            'name' => 'João Silva',
            'email' => 'joao@empresa.com',
            'tenant_id' => $this->tenant->id,
        ]);
    }

    public function test_can_create_individual_client(): void
    {
        $response = $this->actingAsUser()
            ->postJson('/api/clients', [
                'name' => 'Maria Santos',
                'type' => 'individual',
                'email' => 'maria@test.com',
            ]);

        $response->assertStatus(201);
        $response->assertJsonFragment(['name' => 'Maria Santos']);
    }

    public function test_can_create_company_client(): void
    {
        $response = $this->actingAsUser()
            ->postJson('/api/clients', [
                'name' => 'Empresa XPTO',
                'type' => 'company',
                'company_name' => 'XPTO Ltda',
                'document' => '12.345.678/0001-00',
                'document_type' => 'cnpj',
                'email' => 'contato@xpto.com',
            ]);

        $response->assertStatus(201);
        $response->assertJsonFragment(['company_name' => 'XPTO Ltda']);
    }

    public function test_client_requires_name(): void
    {
        $response = $this->actingAsUser()
            ->postJson('/api/clients', [
                'email' => 'semname@test.com',
            ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['name']);
    }

    public function test_can_update_client(): void
    {
        $client = $this->createClient(['name' => 'Original']);

        $response = $this->actingAsUser()
            ->putJson("/api/clients/{$client->id}", [
                'name' => 'Atualizado',
                'phone' => '11888777666',
            ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('clients', [
            'id' => $client->id,
            'name' => 'Atualizado',
        ]);
    }

    public function test_can_delete_client(): void
    {
        $client = $this->createClient();

        $response = $this->actingAsUser()
            ->deleteJson("/api/clients/{$client->id}");

        $response->assertStatus(200);
    }

    public function test_can_list_clients_with_pagination(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->createClient(['name' => "Cliente {$i}"]);
        }

        $response = $this->actingAsUser()
            ->getJson('/api/clients');

        $response->assertStatus(200);
        $data = $response->json('data');
        $clients = $data['data'] ?? $data;
        $this->assertGreaterThanOrEqual(5, count($clients));
    }

    public function test_can_search_clients(): void
    {
        $this->createClient(['name' => 'João Buscavel']);
        $this->createClient(['name' => 'Maria Outra']);

        $response = $this->actingAsUser()
            ->getJson('/api/clients/search?q=Buscavel');

        $response->assertStatus(200);
        $data = $response->json('data');
        $this->assertNotEmpty($data);
    }

    public function test_can_view_single_client(): void
    {
        $client = $this->createClient(['name' => 'Detalhe Cliente']);

        $response = $this->actingAsUser()
            ->getJson("/api/clients/{$client->id}");

        $response->assertStatus(200);
        $response->assertJsonFragment(['name' => 'Detalhe Cliente']);
    }

    public function test_can_export_clients(): void
    {
        $this->createClient();

        $response = $this->actingAsUser()
            ->getJson('/api/clients/export');

        $response->assertStatus(200);
    }

    public function test_can_import_clients_csv(): void
    {
        $csv = "name,email,phone\nImportado 1,imp1@test.com,11999000001\nImportado 2,imp2@test.com,11999000002";
        $file = UploadedFile::fake()->createWithContent('clients.csv', $csv);

        $response = $this->actingAsUser()
            ->postJson('/api/clients/import', [
                'file' => $file,
            ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('clients', ['name' => 'Importado 1']);
    }

    public function test_can_get_custom_fields(): void
    {
        $response = $this->actingAsUser()
            ->getJson('/api/clients/custom-fields');

        $response->assertStatus(200);
    }

    public function test_can_update_custom_fields(): void
    {
        $response = $this->actingAsUser()
            ->putJson('/api/clients/custom-fields', [
                'fields' => [
                    [
                        'name' => 'Segmento',
                        'type' => 'select',
                        'options' => ['Varejo', 'Atacado', 'Industria'],
                        'is_required' => false,
                        'position' => 0,
                    ],
                    [
                        'name' => 'Faturamento Anual',
                        'type' => 'number',
                        'is_required' => false,
                        'position' => 1,
                    ],
                ],
            ]);

        $response->assertStatus(200);
    }

    public function test_can_create_client_with_custom_fields(): void
    {
        $response = $this->actingAsUser()
            ->postJson('/api/clients', [
                'name' => 'Cliente Custom',
                'custom_fields' => [
                    'segmento' => 'Varejo',
                    'faturamento' => 500000,
                ],
            ]);

        $response->assertStatus(201);
    }

    public function test_client_email_format_validation(): void
    {
        $response = $this->actingAsUser()
            ->postJson('/api/clients', [
                'name' => 'Bad Email',
                'email' => 'nao-e-email',
            ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['email']);
    }

    public function test_can_list_clients_with_search_filter(): void
    {
        $this->createClient(['name' => 'Filtro Especial']);
        $this->createClient(['name' => 'Outro Nome']);

        $response = $this->actingAsUser()
            ->getJson('/api/clients?search=Filtro');

        $response->assertStatus(200);
    }
}
