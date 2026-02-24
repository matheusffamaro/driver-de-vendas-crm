<?php

namespace Database\Factories;

use App\Models\CrmTask;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class CrmTaskFactory extends Factory
{
    protected $model = CrmTask::class;

    public function definition(): array
    {
        return [
            'id' => Str::uuid(),
            'tenant_id' => null,
            'title' => fake()->sentence(),
            'description' => fake()->paragraph(),
            'type' => fake()->randomElement(['task', 'call', 'meeting', 'email']),
            'status' => 'pending',
            'priority' => 'medium',
            'scheduled_at' => fake()->dateTimeBetween('now', '+30 days'),
        ];
    }
}
