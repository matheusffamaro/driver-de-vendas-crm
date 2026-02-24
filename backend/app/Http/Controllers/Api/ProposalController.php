<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class ProposalController extends Controller
{
    public function send(Request $request): JsonResponse
    {
        $request->validate([
            'to' => 'required|email',
            'subject' => 'required|string|max:255',
            'message' => 'nullable|string',
            'client_id' => 'nullable|uuid',
            'pipeline_card_id' => 'nullable|uuid',
            'file' => 'required|file|mimes:pdf|max:10240',
        ]);

        $user = $request->user();
        $client = null;
        if ($request->client_id) {
            $client = Client::find($request->client_id);
            if ($client && $user?->tenant_id && $client->tenant_id !== $user->tenant_id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Acesso negado.',
                ], 403);
            }
        }

        // SECURITY: Verify pipeline_card_id belongs to tenant
        if ($request->pipeline_card_id) {
            $card = PipelineCard::whereHas('pipeline', function($q) use ($user) {
                $q->where('tenant_id', $user->tenant_id);
            })->where('id', $request->pipeline_card_id)
              ->first();
            
            if (!$card) {
                return response()->json([
                    'success' => false,
                    'message' => 'Card não encontrado ou acesso negado.',
                ], 403);
            }
        }

        $file = $request->file('file');
        $to = $request->get('to');
        $subject = $request->get('subject');
        $messageText = $request->get('message', '');
        $clientName = $client?->name ?: 'Cliente';

        $html = $this->buildTemplate([
            'subject' => $subject,
            'clientName' => $clientName,
            'message' => $messageText,
            'sender' => $user?->name ?: 'Equipe Driver',
        ]);

        try {
            Mail::send([], [], function ($message) use ($to, $subject, $html, $file) {
                $message->to($to)
                    ->subject($subject)
                    ->setBody($html, 'text/html')
                    ->attach($file->getRealPath(), [
                        'as' => $file->getClientOriginalName(),
                        'mime' => $file->getMimeType(),
                    ]);
            });
        } catch (\Throwable $e) {
            Log::error('Proposal email send failed', ['error' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'message' => 'Não foi possível enviar a proposta.',
            ], 500);
        }

        return response()->json([
            'success' => true,
            'message' => 'Proposta enviada com sucesso.',
        ]);
    }

    private function buildTemplate(array $data): string
    {
        $subject = e($data['subject'] ?? 'Proposta Comercial');
        $clientName = e($data['clientName'] ?? 'Cliente');
        $message = nl2br(e($data['message'] ?? 'Segue em anexo a proposta comercial.'));
        $sender = e($data['sender'] ?? 'Equipe Driver');

        return <<<HTML
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{$subject}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.08);">
            <tr>
              <td style="padding:24px 28px;background:#0f172a;color:#ffffff;">
                <div style="font-size:20px;font-weight:700;">driver*</div>
                <div style="font-size:10px;letter-spacing:0.3em;text-transform:uppercase;opacity:0.7;">de vendas</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h2 style="margin:0 0 12px 0;font-size:22px;color:#0f172a;">{$subject}</h2>
                <p style="margin:0 0 16px 0;font-size:14px;color:#6b7280;">Olá, {$clientName}!</p>
                <div style="font-size:15px;line-height:1.6;color:#111827;">
                  {$message}
                </div>
                <div style="margin-top:20px;padding:16px;background:#f9fafb;border-radius:12px;">
                  <p style="margin:0;font-size:13px;color:#6b7280;">Anexo: proposta em PDF</p>
                </div>
                <p style="margin-top:24px;font-size:14px;color:#111827;">Atenciosamente,<br/><strong>{$sender}</strong></p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;background:#f3f4f6;color:#6b7280;font-size:12px;">
                Esta mensagem foi enviada pelo Driver de Vendas.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
HTML;
    }
}
