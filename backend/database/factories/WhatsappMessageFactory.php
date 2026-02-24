<?php

namespace Database\Factories;

use App\Models\WhatsappMessage;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class WhatsappMessageFactory extends Factory
{
    protected $model = WhatsappMessage::class;

    public function definition(): array
    {
        return [
            'id' => Str::uuid(),
            'conversation_id' => null,
            'message_id' => Str::uuid()->toString(),
            'direction' => 'incoming',
            'type' => 'text',
            'content' => fake()->sentence(),
            'status' => 'delivered',
            'sender_name' => fake()->name(),
            'sender_phone' => fake()->numerify('55119########'),
            'sent_at' => now(),
        ];
    }

    public function outgoing(): static
    {
        return $this->state(fn (array $attributes) => [
            'direction' => 'outgoing',
        ]);
    }
}
