<?php

namespace Tests\Feature\Products;

use Tests\TestCase;
use Tests\Helpers\CreatesTestData;
use App\Models\Product;
use App\Models\ProductCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;

class ProductTest extends TestCase
{
    use RefreshDatabase, CreatesTestData;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpTenantAndUser();
    }

    public function test_can_create_product(): void
    {
        $category = $this->createCategory();

        $response = $this->actingAsUser()
            ->postJson('/api/products', [
                'name' => 'Produto Teste',
                'type' => 'product',
                'price' => 99.90,
                'cost' => 45.00,
                'sku' => 'PROD-001',
                'unit' => 'un',
                'description' => 'Um produto de teste',
                'category_id' => $category->id,
                'is_active' => true,
            ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('products', [
            'name' => 'Produto Teste',
            'tenant_id' => $this->tenant->id,
        ]);
    }

    public function test_can_create_service(): void
    {
        $response = $this->actingAsUser()
            ->postJson('/api/products', [
                'name' => 'Consultoria',
                'type' => 'service',
                'price' => 250.00,
                'unit' => 'h',
            ]);

        $response->assertStatus(201);
        $response->assertJsonFragment(['type' => 'service']);
    }

    public function test_product_requires_name_and_price(): void
    {
        $response = $this->actingAsUser()
            ->postJson('/api/products', []);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['name', 'price']);
    }

    public function test_can_update_product(): void
    {
        $product = $this->createProduct(['name' => 'Original']);

        $response = $this->actingAsUser()
            ->putJson("/api/products/{$product->id}", [
                'name' => 'Atualizado',
                'price' => 149.90,
            ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('products', [
            'id' => $product->id,
            'name' => 'Atualizado',
        ]);
    }

    public function test_can_delete_product(): void
    {
        $product = $this->createProduct();

        $response = $this->actingAsUser()
            ->deleteJson("/api/products/{$product->id}");

        $response->assertStatus(200);
    }

    public function test_can_list_products(): void
    {
        $this->createProduct(['name' => 'Produto A']);
        $this->createProduct(['name' => 'Produto B']);

        $response = $this->actingAsUser()
            ->getJson('/api/products');

        $response->assertStatus(200);
    }

    public function test_can_list_products_with_search(): void
    {
        $this->createProduct(['name' => 'Widget Alpha']);
        $this->createProduct(['name' => 'Gadget Beta']);

        $response = $this->actingAsUser()
            ->getJson('/api/products?search=Widget');

        $response->assertStatus(200);
    }

    public function test_can_filter_products_by_category(): void
    {
        $cat = $this->createCategory(['name' => 'Eletrônicos']);
        $this->createProduct(['name' => 'Celular', 'category_id' => $cat->id]);
        $this->createProduct(['name' => 'Mesa']);

        $response = $this->actingAsUser()
            ->getJson("/api/products?category_id={$cat->id}");

        $response->assertStatus(200);
    }

    public function test_can_view_single_product(): void
    {
        $product = $this->createProduct(['name' => 'Detalhe Produto']);

        $response = $this->actingAsUser()
            ->getJson("/api/products/{$product->id}");

        $response->assertStatus(200);
        $response->assertJsonFragment(['name' => 'Detalhe Produto']);
    }

    public function test_can_create_category(): void
    {
        $response = $this->actingAsUser()
            ->postJson('/api/products/categories', [
                'name' => 'Nova Categoria',
                'description' => 'Descrição da categoria',
                'color' => '#FF5733',
            ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('product_categories', [
            'name' => 'Nova Categoria',
            'tenant_id' => $this->tenant->id,
        ]);
    }

    public function test_can_update_category(): void
    {
        $cat = $this->createCategory(['name' => 'Original']);

        $response = $this->actingAsUser()
            ->putJson("/api/products/categories/{$cat->id}", [
                'name' => 'Atualizada',
            ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('product_categories', [
            'id' => $cat->id,
            'name' => 'Atualizada',
        ]);
    }

    public function test_can_delete_category(): void
    {
        $cat = $this->createCategory();

        $response = $this->actingAsUser()
            ->deleteJson("/api/products/categories/{$cat->id}");

        $response->assertStatus(200);
    }

    public function test_can_list_categories(): void
    {
        $this->createCategory(['name' => 'Cat 1']);
        $this->createCategory(['name' => 'Cat 2']);

        $response = $this->actingAsUser()
            ->getJson('/api/products/categories');

        $response->assertStatus(200);
        $data = $response->json('data');
        $this->assertGreaterThanOrEqual(2, count($data));
    }

    public function test_can_list_units(): void
    {
        $response = $this->actingAsUser()
            ->getJson('/api/products/units');

        $response->assertStatus(200);
    }

    public function test_can_export_products(): void
    {
        $this->createProduct();

        $response = $this->actingAsUser()
            ->getJson('/api/products/export');

        $response->assertStatus(200);
    }

    public function test_can_import_products_csv(): void
    {
        $csv = "name,price,sku,type\nProduto CSV,29.90,CSV-001,product\nServico CSV,59.90,CSV-002,service";
        $file = UploadedFile::fake()->createWithContent('products.csv', $csv);

        $response = $this->actingAsUser()
            ->postJson('/api/products/import', [
                'file' => $file,
            ]);

        $response->assertStatus(200);
    }

    public function test_product_with_stock_tracking(): void
    {
        $response = $this->actingAsUser()
            ->postJson('/api/products', [
                'name' => 'Produto Estoque',
                'price' => 50.00,
                'stock_quantity' => 100,
                'min_stock' => 10,
                'track_stock' => true,
            ]);

        $response->assertStatus(201);
    }

    public function test_price_cannot_be_negative(): void
    {
        $response = $this->actingAsUser()
            ->postJson('/api/products', [
                'name' => 'Negativo',
                'price' => -10,
            ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['price']);
    }

    public function test_can_filter_inactive_products(): void
    {
        $this->createProduct(['name' => 'Ativo', 'is_active' => true]);
        $this->createProduct(['name' => 'Inativo', 'is_active' => false]);

        $response = $this->actingAsUser()
            ->getJson('/api/products?is_active=1');

        $response->assertStatus(200);
    }
}
