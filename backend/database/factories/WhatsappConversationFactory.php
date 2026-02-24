<?php

namespace Database\Factories;

use App\Models\WhatsappConversation;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class WhatsappConversationFactory extends Factory
{
    protected $model = WhatsappConversation::class;

    public function definition(): array
    {
        $phone = fake()->numerify('55119########');
        return [
            'id' => Str::uuid(),
            'session_id' => null,
            'remote_jid' => $phone . '@s.whatsapp.net',
            'is_group' => false,
            'contact_phone' => $phone,
            'contact_name' => fake()->name(),
            'unread_count' => 0,
            'last_message_at' => now(),
        ];
    }

    public function group(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_group' => true,
            'group_name' => fake()->words(3, true),
            'remote_jid' => fake()->numerify('############') . '@g.us',
        ]);
    }
}
