<?php

namespace Database\Factories;

use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class ProductFactory extends Factory
{
    protected $model = Product::class;

    public function definition(): array
    {
        return [
            'id' => Str::uuid(),
            'tenant_id' => null,
            'name' => fake()->words(3, true),
            'type' => 'product',
            'description' => fake()->sentence(),
            'sku' => strtoupper(fake()->unique()->bothify('???-####')),
            'price' => fake()->randomFloat(2, 10, 5000),
            'cost' => fake()->randomFloat(2, 5, 2000),
            'stock' => fake()->numberBetween(0, 500),
            'min_stock' => 0,
            'unit' => fake()->randomElement(['un', 'kg', 'l', 'm', 'h', 'pc']),
            'is_active' => true,
        ];
    }

    public function service(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => 'service',
            'stock' => 0,
            'min_stock' => 0,
        ]);
    }

    public function withStock(int $quantity = 100, int $minStock = 10): static
    {
        return $this->state(fn (array $attributes) => [
            'stock' => $quantity,
            'min_stock' => $minStock,
        ]);
    }

    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => false,
        ]);
    }
}
