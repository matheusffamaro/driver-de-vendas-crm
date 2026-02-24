<?php

namespace Database\Factories;

use App\Models\PipelineStage;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class PipelineStageFactory extends Factory
{
    protected $model = PipelineStage::class;

    public function definition(): array
    {
        return [
            'id' => Str::uuid(),
            'pipeline_id' => null,
            'name' => fake()->words(2, true),
            'position' => fake()->numberBetween(0, 10),
            'color' => fake()->hexColor(),
        ];
    }
}
