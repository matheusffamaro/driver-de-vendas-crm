<?php

namespace App\Services;

use App\Models\PaypalPayment;
use App\Models\PaypalWebhook;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\Tenant;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

class PayPalService
{
    private string $baseUrl;
    private string $clientId;
    private string $clientSecret;

    public function __construct()
    {
        $this->baseUrl = config('services.paypal.mode') === 'sandbox'
            ? 'https://api-m.sandbox.paypal.com'
            : 'https://api-m.paypal.com';
        $this->clientId = config('services.paypal.client_id', '');
        $this->clientSecret = config('services.paypal.client_secret', '');
    }

    /**
     * Check if PayPal is configured.
     */
    public function isConfigured(): bool
    {
        return !empty($this->clientId) && !empty($this->clientSecret);
    }

    /**
     * Get access token from PayPal.
     */
    public function getAccessToken(): string
    {
        if (!$this->isConfigured()) {
            throw new \Exception('PayPal credentials not configured');
        }

        return Cache::remember('paypal_access_token', 3000, function () {
            $response = Http::withBasicAuth($this->clientId, $this->clientSecret)
                ->asForm()
                ->post("{$this->baseUrl}/v1/oauth2/token", [
                    'grant_type' => 'client_credentials',
                ]);

            if (!$response->successful()) {
                Log::error('PayPal: Failed to get access token', ['response' => $response->json()]);
                throw new \Exception('Failed to get PayPal access token');
            }

            return $response->json('access_token');
        });
    }

    /**
     * Create a product in PayPal (needed for subscriptions).
     */
    public function createProduct(Plan $plan): ?string
    {
        $response = Http::withToken($this->getAccessToken())
            ->post("{$this->baseUrl}/v1/catalogs/products", [
                'name' => "CRM WhiteLabel - {$plan->name}",
                'description' => $plan->description ?? "Plano {$plan->name}",
                'type' => 'SERVICE',
                'category' => 'SOFTWARE',
            ]);

        if (!$response->successful()) {
            Log::error('PayPal: Failed to create product', ['response' => $response->json()]);
            return null;
        }

        return $response->json('id');
    }

    /**
     * Create a billing plan in PayPal.
     */
    public function createBillingPlan(Plan $plan, string $productId, string $interval = 'MONTH'): ?string
    {
        $price = $interval === 'MONTH' ? $plan->price_monthly : $plan->price_yearly;
        
        $response = Http::withToken($this->getAccessToken())
            ->post("{$this->baseUrl}/v1/billing/plans", [
                'product_id' => $productId,
                'name' => "{$plan->name} - " . ($interval === 'MONTH' ? 'Mensal' : 'Anual'),
                'description' => $plan->description,
                'status' => 'ACTIVE',
                'billing_cycles' => [
                    [
                        'frequency' => [
                            'interval_unit' => $interval,
                            'interval_count' => 1,
                        ],
                        'tenure_type' => 'REGULAR',
                        'sequence' => 1,
                        'total_cycles' => 0, // Unlimited
                        'pricing_scheme' => [
                            'fixed_price' => [
                                'value' => number_format($price, 2, '.', ''),
                                'currency_code' => 'BRL',
                            ],
                        ],
                    ],
                ],
                'payment_preferences' => [
                    'auto_bill_outstanding' => true,
                    'setup_fee_failure_action' => 'CONTINUE',
                    'payment_failure_threshold' => 3,
                ],
            ]);

        if (!$response->successful()) {
            Log::error('PayPal: Failed to create billing plan', ['response' => $response->json()]);
            return null;
        }

        return $response->json('id');
    }

    /**
     * Create a subscription for a tenant.
     */
    public function createSubscription(Tenant $tenant, Plan $plan, string $billingCycle = 'monthly'): array
    {
        $paypalPlanId = $billingCycle === 'monthly' 
            ? $plan->paypal_plan_id_monthly 
            : $plan->paypal_plan_id_yearly;

        if (!$paypalPlanId) {
            throw new \Exception('PayPal plan ID not configured for this plan');
        }

        $response = Http::withToken($this->getAccessToken())
            ->post("{$this->baseUrl}/v1/billing/subscriptions", [
                'plan_id' => $paypalPlanId,
                'subscriber' => [
                    'name' => [
                        'given_name' => $tenant->name,
                    ],
                    'email_address' => $tenant->email,
                ],
                'application_context' => [
                    'brand_name' => config('app.name', 'CRM WhiteLabel'),
                    'locale' => 'pt-BR',
                    'shipping_preference' => 'NO_SHIPPING',
                    'user_action' => 'SUBSCRIBE_NOW',
                    'return_url' => config('app.frontend_url') . '/settings?tab=system-plan&status=success',
                    'cancel_url' => config('app.frontend_url') . '/settings?tab=system-plan&status=cancel',
                ],
                'custom_id' => $tenant->id,
            ]);

        if (!$response->successful()) {
            Log::error('PayPal: Failed to create subscription', ['response' => $response->json()]);
            throw new \Exception('Failed to create PayPal subscription');
        }

        $data = $response->json();
        
        $approvalUrl = collect($data['links'] ?? [])
            ->firstWhere('rel', 'approve')['href'] ?? null;

        return [
            'subscription_id' => $data['id'],
            'approval_url' => $approvalUrl,
            'status' => $data['status'],
        ];
    }

    /**
     * Create a one-time payment order.
     */
    public function createOrder(Tenant $tenant, Plan $plan, string $billingCycle = 'monthly'): array
    {
        $amount = $billingCycle === 'monthly' ? $plan->price_monthly : $plan->price_yearly;
        
        $response = Http::withToken($this->getAccessToken())
            ->post("{$this->baseUrl}/v2/checkout/orders", [
                'intent' => 'CAPTURE',
                'purchase_units' => [
                    [
                        'reference_id' => $tenant->id,
                        'description' => config('app.name', 'CRM WhiteLabel') . " - Plano {$plan->name} ({$billingCycle})",
                        'custom_id' => json_encode([
                            'tenant_id' => $tenant->id,
                            'plan_id' => $plan->id,
                            'billing_cycle' => $billingCycle,
                        ]),
                        'amount' => [
                            'currency_code' => 'BRL',
                            'value' => number_format($amount, 2, '.', ''),
                        ],
                    ],
                ],
                'application_context' => [
                    'brand_name' => config('app.name', 'CRM WhiteLabel'),
                    'locale' => 'pt-BR',
                    'shipping_preference' => 'NO_SHIPPING',
                    'user_action' => 'PAY_NOW',
                    'return_url' => config('app.frontend_url') . '/settings?tab=system-plan&status=success',
                    'cancel_url' => config('app.frontend_url') . '/settings?tab=system-plan&status=cancel',
                ],
            ]);

        if (!$response->successful()) {
            Log::error('PayPal: Failed to create order', ['response' => $response->json()]);
            throw new \Exception('Failed to create PayPal order');
        }

        $data = $response->json();
        
        // Create payment record
        PaypalPayment::create([
            'tenant_id' => $tenant->id,
            'paypal_order_id' => $data['id'],
            'type' => 'one_time',
            'status' => 'pending',
            'amount' => $amount,
            'currency' => 'BRL',
        ]);

        $approvalUrl = collect($data['links'] ?? [])
            ->firstWhere('rel', 'approve')['href'] ?? null;

        return [
            'order_id' => $data['id'],
            'approval_url' => $approvalUrl,
            'status' => $data['status'],
        ];
    }

    /**
     * Capture a payment order.
     */
    public function captureOrder(string $orderId): array
    {
        $response = Http::withToken($this->getAccessToken())
            ->withHeaders([
                'Content-Type' => 'application/json',
                'Prefer' => 'return=representation',
            ])
            ->withBody('', 'application/json')
            ->post("{$this->baseUrl}/v2/checkout/orders/{$orderId}/capture");

        if (!$response->successful()) {
            Log::error('PayPal: Failed to capture order', ['response' => $response->json()]);
            throw new \Exception('Failed to capture PayPal order');
        }

        $data = $response->json();
        
        // Update payment record
        $payment = PaypalPayment::where('paypal_order_id', $orderId)->first();
        if ($payment) {
            if ($data['status'] === 'COMPLETED') {
                $payment->markAsCompleted($data);
                
                // Activate subscription
                $this->activateSubscriptionFromPayment($payment);
            } else {
                $payment->markAsFailed($data);
            }
        }

        return $data;
    }

    /**
     * Get subscription details.
     */
    public function getSubscription(string $subscriptionId): ?array
    {
        $response = Http::withToken($this->getAccessToken())
            ->get("{$this->baseUrl}/v1/billing/subscriptions/{$subscriptionId}");

        if (!$response->successful()) {
            Log::error('PayPal: Failed to get subscription', ['response' => $response->json()]);
            return null;
        }

        return $response->json();
    }

    /**
     * Cancel a subscription.
     */
    public function cancelSubscription(string $subscriptionId, string $reason = 'Cancelado pelo usuário'): bool
    {
        $response = Http::withToken($this->getAccessToken())
            ->post("{$this->baseUrl}/v1/billing/subscriptions/{$subscriptionId}/cancel", [
                'reason' => $reason,
            ]);

        return $response->successful();
    }

    /**
     * Verify webhook signature.
     */
    public function verifyWebhookSignature(array $headers, string $body): bool
    {
        $webhookId = config('services.paypal.webhook_id');
        
        if (!$webhookId) {
            return true; // Skip verification if webhook ID not configured
        }

        $response = Http::withToken($this->getAccessToken())
            ->post("{$this->baseUrl}/v1/notifications/verify-webhook-signature", [
                'auth_algo' => $headers['PAYPAL-AUTH-ALGO'] ?? '',
                'cert_url' => $headers['PAYPAL-CERT-URL'] ?? '',
                'transmission_id' => $headers['PAYPAL-TRANSMISSION-ID'] ?? '',
                'transmission_sig' => $headers['PAYPAL-TRANSMISSION-SIG'] ?? '',
                'transmission_time' => $headers['PAYPAL-TRANSMISSION-TIME'] ?? '',
                'webhook_id' => $webhookId,
                'webhook_event' => json_decode($body, true),
            ]);

        return $response->successful() && $response->json('verification_status') === 'SUCCESS';
    }

    /**
     * Process webhook event.
     */
    public function processWebhook(array $event): void
    {
        $webhook = PaypalWebhook::create([
            'webhook_id' => $event['id'],
            'event_type' => $event['event_type'],
            'resource_type' => $event['resource_type'] ?? null,
            'resource_id' => $event['resource']['id'] ?? null,
            'payload' => $event,
            'status' => 'pending',
        ]);

        try {
            match($event['event_type']) {
                'BILLING.SUBSCRIPTION.ACTIVATED' => $this->handleSubscriptionActivated($event),
                'BILLING.SUBSCRIPTION.CANCELLED' => $this->handleSubscriptionCancelled($event),
                'BILLING.SUBSCRIPTION.EXPIRED' => $this->handleSubscriptionExpired($event),
                'BILLING.SUBSCRIPTION.SUSPENDED' => $this->handleSubscriptionSuspended($event),
                'PAYMENT.SALE.COMPLETED' => $this->handlePaymentCompleted($event),
                'PAYMENT.SALE.DENIED' => $this->handlePaymentDenied($event),
                'PAYMENT.SALE.REFUNDED' => $this->handlePaymentRefunded($event),
                default => null,
            };

            $webhook->markAsProcessed();
        } catch (\Exception $e) {
            Log::error('PayPal Webhook Error', ['error' => $e->getMessage(), 'event' => $event]);
            $webhook->markAsFailed($e->getMessage());
        }
    }

    /**
     * Handle subscription activated event.
     */
    private function handleSubscriptionActivated(array $event): void
    {
        $resource = $event['resource'];
        $tenantId = $resource['custom_id'] ?? null;
        
        if (!$tenantId) {
            return;
        }

        $tenant = Tenant::find($tenantId);
        if (!$tenant) {
            return;
        }

        $subscription = $tenant->subscription;
        if ($subscription) {
            $subscription->update([
                'status' => 'active',
                'paypal_subscription_id' => $resource['id'],
                'starts_at' => now(),
                'ends_at' => null,
            ]);
        }
    }

    /**
     * Handle subscription cancelled event.
     */
    private function handleSubscriptionCancelled(array $event): void
    {
        $resource = $event['resource'];
        $subscription = Subscription::where('paypal_subscription_id', $resource['id'])->first();
        
        if ($subscription) {
            $subscription->update([
                'status' => 'cancelled',
                'ends_at' => now(),
            ]);
        }
    }

    /**
     * Handle subscription expired event.
     */
    private function handleSubscriptionExpired(array $event): void
    {
        $resource = $event['resource'];
        $subscription = Subscription::where('paypal_subscription_id', $resource['id'])->first();
        
        if ($subscription) {
            $subscription->update([
                'status' => 'expired',
                'ends_at' => now(),
            ]);
            
            // Downgrade to free plan
            $freePlan = Plan::where('slug', 'free')->first();
            if ($freePlan) {
                $subscription->update(['plan_id' => $freePlan->id]);
            }
        }
    }

    /**
     * Handle subscription suspended event.
     */
    private function handleSubscriptionSuspended(array $event): void
    {
        $resource = $event['resource'];
        $subscription = Subscription::where('paypal_subscription_id', $resource['id'])->first();
        
        if ($subscription) {
            $subscription->update(['status' => 'suspended']);
        }
    }

    /**
     * Handle payment completed event.
     */
    private function handlePaymentCompleted(array $event): void
    {
        $resource = $event['resource'];
        
        $subscriptionId = $resource['billing_agreement_id'] ?? null;
        if ($subscriptionId) {
            $subscription = Subscription::where('paypal_subscription_id', $subscriptionId)->first();
            if ($subscription) {
                PaypalPayment::create([
                    'tenant_id' => $subscription->tenant_id,
                    'subscription_id' => $subscription->id,
                    'paypal_order_id' => $resource['id'],
                    'paypal_subscription_id' => $subscriptionId,
                    'type' => 'subscription',
                    'status' => 'completed',
                    'amount' => $resource['amount']['total'] ?? 0,
                    'currency' => $resource['amount']['currency'] ?? 'BRL',
                    'paypal_response' => $event,
                    'paid_at' => now(),
                ]);
            }
        }
    }

    /**
     * Handle payment denied event.
     */
    private function handlePaymentDenied(array $event): void
    {
        $resource = $event['resource'];
        $payment = PaypalPayment::where('paypal_order_id', $resource['id'])->first();
        
        if ($payment) {
            $payment->markAsFailed($event);
        }
    }

    /**
     * Handle payment refunded event.
     */
    private function handlePaymentRefunded(array $event): void
    {
        $resource = $event['resource'];
        $payment = PaypalPayment::where('paypal_order_id', $resource['sale_id'] ?? $resource['id'])->first();
        
        if ($payment) {
            $payment->update([
                'status' => 'refunded',
                'paypal_response' => array_merge($payment->paypal_response ?? [], ['refund' => $event]),
            ]);
        }
    }

    /**
     * Activate subscription from payment.
     */
    private function activateSubscriptionFromPayment(PaypalPayment $payment): void
    {
        $customData = json_decode($payment->paypal_response['purchase_units'][0]['custom_id'] ?? '{}', true);
        
        if (empty($customData)) {
            return;
        }

        $tenant = Tenant::find($customData['tenant_id'] ?? null);
        $plan = Plan::find($customData['plan_id'] ?? null);
        $billingCycle = $customData['billing_cycle'] ?? 'monthly';
        
        if (!$tenant || !$plan) {
            return;
        }

        $subscription = $tenant->subscription;
        if ($subscription) {
            $subscription->update([
                'plan_id' => $plan->id,
                'status' => 'active',
                'billing_cycle' => $billingCycle,
                'starts_at' => now(),
                'ends_at' => $billingCycle === 'monthly' 
                    ? now()->addMonth() 
                    : now()->addYear(),
            ]);
        } else {
            Subscription::create([
                'tenant_id' => $tenant->id,
                'plan_id' => $plan->id,
                'status' => 'active',
                'billing_cycle' => $billingCycle,
                'starts_at' => now(),
                'ends_at' => $billingCycle === 'monthly' 
                    ? now()->addMonth() 
                    : now()->addYear(),
            ]);
        }

        $payment->update(['subscription_id' => $subscription?->id ?? $tenant->fresh()->subscription->id]);
    }
}
