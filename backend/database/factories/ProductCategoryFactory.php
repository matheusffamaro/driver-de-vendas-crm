<?php

namespace Database\Factories;

use App\Models\ProductCategory;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class ProductCategoryFactory extends Factory
{
    protected $model = ProductCategory::class;

    public function definition(): array
    {
        return [
            'id' => Str::uuid(),
            'tenant_id' => null,
            'name' => fake()->word(),
            'description' => fake()->sentence(),
            'is_active' => true,
        ];
    }
}
