<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Models\PaypalPayment;
use App\Services\PayPalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PayPalController extends Controller
{
    public function __construct(
        private PayPalService $paypalService
    ) {}

    /**
     * Create a checkout order for plan upgrade.
     */
    public function createOrder(Request $request): JsonResponse
    {
        $request->validate([
            'plan_id' => 'required|exists:plans,id',
            'billing_cycle' => 'required|in:monthly,yearly',
        ]);

        if (!$this->paypalService->isConfigured()) {
            return response()->json([
                'success' => false,
                'message' => 'PayPal não está configurado. Entre em contato com o suporte.',
            ], 500);
        }

        $user = $request->user();
        $tenant = $user->tenant;
        
        if (!$tenant) {
            return response()->json([
                'success' => false,
                'message' => 'Tenant não encontrado',
            ], 404);
        }
        
        $plan = Plan::findOrFail($request->plan_id);

        // Check if plan is different from current
        if ($tenant->subscription && $tenant->subscription->plan_id === $plan->id) {
            return response()->json([
                'success' => false,
                'message' => 'Você já está neste plano.',
            ], 400);
        }

        try {
            $order = $this->paypalService->createOrder($tenant, $plan, $request->billing_cycle);

            return response()->json([
                'success' => true,
                'data' => $order,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erro ao criar pedido: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Create a subscription (recurring payments).
     */
    public function createSubscription(Request $request): JsonResponse
    {
        $request->validate([
            'plan_id' => 'required|exists:plans,id',
            'billing_cycle' => 'required|in:monthly,yearly',
        ]);

        if (!$this->paypalService->isConfigured()) {
            return response()->json([
                'success' => false,
                'message' => 'PayPal não está configurado. Entre em contato com o suporte.',
            ], 500);
        }

        $user = $request->user();
        $tenant = $user->tenant;
        
        if (!$tenant) {
            return response()->json([
                'success' => false,
                'message' => 'Tenant não encontrado',
            ], 404);
        }
        
        $plan = Plan::findOrFail($request->plan_id);

        try {
            $subscription = $this->paypalService->createSubscription($tenant, $plan, $request->billing_cycle);

            return response()->json([
                'success' => true,
                'data' => $subscription,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erro ao criar assinatura: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Capture a payment after user approval.
     */
    public function captureOrder(Request $request): JsonResponse
    {
        $request->validate([
            'order_id' => 'required|string',
        ]);

        // SECURITY: Verify tenant ownership of the order
        $payment = PaypalPayment::where('paypal_order_id', $request->order_id)
            ->where('tenant_id', $request->user()->tenant_id)
            ->where('status', 'pending')
            ->firstOrFail();

        try {
            $result = $this->paypalService->captureOrder($request->order_id);

            return response()->json([
                'success' => true,
                'data' => $result,
                'message' => $result['status'] === 'COMPLETED' 
                    ? 'Pagamento realizado com sucesso!' 
                    : 'Pagamento pendente.',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erro ao capturar pagamento: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Cancel subscription.
     */
    public function cancelSubscription(Request $request): JsonResponse
    {
        $user = $request->user();
        $tenant = $user->tenant;
        
        if (!$tenant) {
            return response()->json([
                'success' => false,
                'message' => 'Tenant não encontrado',
            ], 404);
        }
        
        $subscription = $tenant->subscription;

        if (!$subscription || !$subscription->paypal_subscription_id) {
            return response()->json([
                'success' => false,
                'message' => 'Nenhuma assinatura PayPal ativa encontrada.',
            ], 404);
        }

        try {
            $this->paypalService->cancelSubscription(
                $subscription->paypal_subscription_id,
                $request->input('reason', 'Cancelado pelo usuário')
            );

            $subscription->update([
                'status' => 'cancelled',
                'ends_at' => $subscription->ends_at ?? now(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Assinatura cancelada com sucesso.',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erro ao cancelar assinatura: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get payment history.
     */
    public function paymentHistory(Request $request): JsonResponse
    {
        $user = $request->user();
        $tenant = $user->tenant;
        
        if (!$tenant) {
            return response()->json([
                'success' => false,
                'message' => 'Tenant não encontrado',
            ], 404);
        }

        $payments = PaypalPayment::where('tenant_id', $tenant->id)
            ->orderByDesc('created_at')
            ->paginate(10);

        return response()->json([
            'success' => true,
            'data' => $payments->items(),
            'meta' => [
                'current_page' => $payments->currentPage(),
                'total' => $payments->total(),
                'last_page' => $payments->lastPage(),
            ],
        ]);
    }

    /**
     * Handle PayPal webhooks.
     */
    public function webhook(Request $request): JsonResponse
    {
        $headers = [
            'PAYPAL-AUTH-ALGO' => $request->header('PAYPAL-AUTH-ALGO'),
            'PAYPAL-CERT-URL' => $request->header('PAYPAL-CERT-URL'),
            'PAYPAL-TRANSMISSION-ID' => $request->header('PAYPAL-TRANSMISSION-ID'),
            'PAYPAL-TRANSMISSION-SIG' => $request->header('PAYPAL-TRANSMISSION-SIG'),
            'PAYPAL-TRANSMISSION-TIME' => $request->header('PAYPAL-TRANSMISSION-TIME'),
        ];

        $body = $request->getContent();

        // Verify signature in production
        if (config('services.paypal.mode') !== 'sandbox') {
            if (!$this->paypalService->verifyWebhookSignature($headers, $body)) {
                return response()->json(['error' => 'Invalid signature'], 401);
            }
        }

        $event = json_decode($body, true);
        
        $this->paypalService->processWebhook($event);

        return response()->json(['status' => 'success']);
    }
}
