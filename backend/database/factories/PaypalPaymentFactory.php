<?php

namespace Database\Factories;

use App\Models\PaypalPayment;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class PaypalPaymentFactory extends Factory
{
    protected $model = PaypalPayment::class;

    public function definition(): array
    {
        return [
            'id' => Str::uuid(),
            'tenant_id' => null,
            'paypal_order_id' => 'ORDER_' . Str::upper(Str::random(10)),
            'amount' => fake()->randomFloat(2, 10, 1000),
            'currency' => 'BRL',
            'status' => 'pending',
            'type' => 'order',
        ];
    }
}
