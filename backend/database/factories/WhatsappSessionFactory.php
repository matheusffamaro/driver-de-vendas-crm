<?php

namespace Database\Factories;

use App\Models\WhatsappSession;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class WhatsappSessionFactory extends Factory
{
    protected $model = WhatsappSession::class;

    public function definition(): array
    {
        return [
            'id' => Str::uuid(),
            'tenant_id' => null,
            'session_name' => fake()->unique()->word(),
            'phone_number' => fake()->phoneNumber(),
            'status' => 'disconnected',
        ];
    }
}
