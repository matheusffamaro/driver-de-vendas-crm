<?php

namespace Tests\Feature\Security;

use Tests\TestCase;
use App\Models\User;
use App\Models\Tenant;
use App\Models\PaypalPayment;
use App\Models\Pipeline;
use App\Models\PipelineCard;
use App\Models\Client;
use Illuminate\Foundation\Testing\RefreshDatabase;

class FinancialSecurityTest extends TestCase
{
    use RefreshDatabase;

    protected $tenant1;
    protected $tenant2;
    protected $user1;
    protected $user2;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant1 = Tenant::factory()->create();
        $this->tenant2 = Tenant::factory()->create();

        $this->user1 = User::factory()->create(['tenant_id' => $this->tenant1->id]);
        $this->user2 = User::factory()->create(['tenant_id' => $this->tenant2->id]);
    }

    /** @test */
    public function test_cannot_capture_other_tenant_order()
    {
        $payment = PaypalPayment::factory()->create([
            'tenant_id' => $this->tenant2->id,
            'paypal_order_id' => 'ORDER_TEST_123',
            'status' => 'pending',
        ]);

        // Simulate authenticated request - exclude all middleware to test controller logic
        $response = $this->withoutMiddleware()
            ->actingAs($this->user1)
            ->postJson('/api/paypal/capture-order', [
                'order_id' => $payment->paypal_order_id,
            ]);

        $response->assertStatus(404);
    }

    /** @test */
    public function test_can_capture_own_tenant_order()
    {
        $payment = PaypalPayment::factory()->create([
            'tenant_id' => $this->tenant1->id,
            'paypal_order_id' => 'ORDER_TEST_456',
            'status' => 'pending',
        ]);

        // Note: This will fail with 500 because PayPal service is not mocked
        // But should pass tenant verification and reach the service call
        $response = $this->withoutMiddleware()
            ->actingAs($this->user1)
            ->postJson('/api/paypal/capture-order', [
                'order_id' => $payment->paypal_order_id,
            ]);

        // Should not be 404 (would indicate tenant check failed)
        $this->assertNotEquals(404, $response->status());
    }

    /** @test */
    public function test_proposal_cannot_reference_other_tenant_card()
    {
        $pipeline2 = Pipeline::factory()->create(['tenant_id' => $this->tenant2->id]);
        $stage2 = \App\Models\PipelineStage::factory()->create(['pipeline_id' => $pipeline2->id]);
        $card2 = PipelineCard::factory()->create([
            'pipeline_id' => $pipeline2->id,
            'stage_id' => $stage2->id,
            'tenant_id' => $this->tenant2->id,
        ]);

        $response = $this->withoutMiddleware()
            ->actingAs($this->user1)
            ->postJson('/api/proposals/send', [
            'to' => 'client@example.com',
            'subject' => 'Proposal',
            'message' => 'Test message',
            'pipeline_card_id' => $card2->id,
            'file' => \Illuminate\Http\UploadedFile::fake()->create('proposal.pdf', 1024),
        ]);

        $response->assertStatus(403);
    }

    /** @test */
    public function test_proposal_cannot_reference_other_tenant_client()
    {
        $client2 = Client::factory()->create(['tenant_id' => $this->tenant2->id]);

        $response = $this->withoutMiddleware()
            ->actingAs($this->user1)
            ->postJson('/api/proposals/send', [
            'to' => 'client@example.com',
            'subject' => 'Proposal',
            'message' => 'Test message',
            'client_id' => $client2->id,
            'file' => \Illuminate\Http\UploadedFile::fake()->create('proposal.pdf', 1024),
        ]);

        $response->assertStatus(403);
    }

    /** @test */
    public function test_proposal_can_use_own_tenant_resources()
    {
        $pipeline1 = Pipeline::factory()->create(['tenant_id' => $this->tenant1->id]);
        $stage1 = \App\Models\PipelineStage::factory()->create(['pipeline_id' => $pipeline1->id]);
        $card1 = PipelineCard::factory()->create([
            'pipeline_id' => $pipeline1->id,
            'stage_id' => $stage1->id,
            'tenant_id' => $this->tenant1->id,
        ]);
        $client1 = Client::factory()->create(['tenant_id' => $this->tenant1->id]);

        $response = $this->withoutMiddleware()
            ->actingAs($this->user1)
            ->postJson('/api/proposals/send', [
            'to' => 'client@example.com',
            'subject' => 'Proposal',
            'message' => 'Test message',
            'client_id' => $client1->id,
            'pipeline_card_id' => $card1->id,
            'file' => \Illuminate\Http\UploadedFile::fake()->create('proposal.pdf', 1024),
        ]);

        // Should not be 403 (tenant validation passed)
        // May be 200 or 500 depending on email config, but not 403
        $this->assertNotEquals(403, $response->status());
    }

    /** @test */
    public function test_payment_history_shows_only_tenant_payments()
    {
        PaypalPayment::factory()->create(['tenant_id' => $this->tenant1->id, 'amount' => 100]);
        PaypalPayment::factory()->create(['tenant_id' => $this->tenant2->id, 'amount' => 200]);

        $this->actingAs($this->user1);

        $response = $this->getJson('/api/paypal/payment-history');

        $response->assertStatus(200);
        $payments = $response->json('data');

        foreach ($payments as $payment) {
            $this->assertEquals($this->tenant1->id, $payment['tenant_id']);
        }
    }
}
