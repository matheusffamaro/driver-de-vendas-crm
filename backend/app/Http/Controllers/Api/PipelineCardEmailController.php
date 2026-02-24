<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PipelineCard;
use App\Models\PipelineCardEmail;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class PipelineCardEmailController extends Controller
{
    /**
     * SECURITY: Get card for tenant (prevents cross-tenant access)
     */
    private function getCardForTenant(string $cardId, string $tenantId): PipelineCard
    {
        return PipelineCard::whereHas('pipeline', fn($q) => $q->where('tenant_id', $tenantId))
            ->where('id', $cardId)
            ->firstOrFail();
    }

    /**
     * List emails for a card
     */
    public function index(Request $request, string $pipelineId, string $cardId): JsonResponse
    {
        // SECURITY: Verify tenant ownership
        $card = $this->getCardForTenant($cardId, $request->user()->tenant_id);
        
        $emails = PipelineCardEmail::where('pipeline_card_id', $cardId)
            ->with('user:id,name,email')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $emails,
        ]);
    }

    /**
     * Send and store an email
     */
    public function store(Request $request, string $pipelineId, string $cardId): JsonResponse
    {
        // SECURITY: Verify tenant ownership
        $card = $this->getCardForTenant($cardId, $request->user()->tenant_id);

        // BUSINESS RULE: Email addon must be active to send proposals
        $tenant = $request->user()->tenant;
        if (!$tenant->email_addon_enabled) {
            return response()->json([
                'success' => false,
                'message' => 'Para enviar propostas por email, você precisa ativar o módulo de Email.',
                'error_code' => 'EMAIL_ADDON_REQUIRED',
                'addon_url' => '/settings?tab=plan',
            ], 403);
        }

        $validated = $request->validate([
            'to' => 'required|email',
            'cc' => 'nullable|string',
            'bcc' => 'nullable|string',
            'subject' => 'required|string|max:255',
            'body' => 'required|string',
        ]);

        try {
            // Create email record
            $email = PipelineCardEmail::create([
                'id' => Str::uuid(),
                'pipeline_card_id' => $cardId,
                'user_id' => auth()->id(),
                'to' => $validated['to'],
                'cc' => $validated['cc'] ?? null,
                'bcc' => $validated['bcc'] ?? null,
                'subject' => $validated['subject'],
                'body' => $validated['body'],
                'status' => 'sent',
                'sent_at' => now(),
            ]);

            // TODO: Actually send email via Mail facade
            // Mail::to($validated['to'])->send(new CardEmail($email));

            return response()->json([
                'success' => true,
                'message' => 'Email enviado com sucesso',
                'data' => $email->load('user:id,name,email'),
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erro ao enviar email: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete an email record
     */
    public function destroy(Request $request, string $pipelineId, string $cardId, string $emailId): JsonResponse
    {
        // SECURITY: Verify tenant ownership first
        $card = $this->getCardForTenant($cardId, $request->user()->tenant_id);
        
        $email = PipelineCardEmail::where('pipeline_card_id', $cardId)
            ->where('id', $emailId)
            ->firstOrFail();

        $email->delete();

        return response()->json([
            'success' => true,
            'message' => 'Email removido',
        ]);
    }
}
