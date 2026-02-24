<?php

namespace Database\Factories;

use App\Models\PipelineCard;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class PipelineCardFactory extends Factory
{
    protected $model = PipelineCard::class;

    public function definition(): array
    {
        return [
            'id' => Str::uuid(),
            'pipeline_id' => null,
            'tenant_id' => null,
            'title' => fake()->sentence(),
            'description' => fake()->paragraph(),
            'value' => fake()->randomFloat(2, 100, 10000),
            'position' => fake()->numberBetween(0, 100),
        ];
    }
}
