<?php

namespace Database\Factories;

use App\Models\Pipeline;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class PipelineFactory extends Factory
{
    protected $model = Pipeline::class;

    public function definition(): array
    {
        return [
            'id' => Str::uuid(),
            'tenant_id' => null,
            'name' => fake()->words(3, true),
            'description' => fake()->sentence(),
            'is_active' => true,
            'is_default' => false,
        ];
    }
}
