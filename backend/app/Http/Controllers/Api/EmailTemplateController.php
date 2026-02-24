<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EmailTemplate;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class EmailTemplateController extends Controller
{
    protected function ensureEmailAddon(Request $request): void
    {
        $tenant = $request->user()->tenant;
        if (! $tenant || ! $tenant->email_addon_enabled) {
            abort(403, 'Módulo de Email não está ativo.');
        }
        if (! ($tenant->email_campaigns_addon_enabled ?? false)) {
            abort(403, 'Add-on Campanhas de E-mail não está ativo. Ative em Configurações → Meu Plano.');
        }
    }

    public function index(Request $request)
    {
        $this->ensureEmailAddon($request);

        try {
            $templates = EmailTemplate::orderBy('updated_at', 'desc')->get();

            return response()->json($templates->map(function ($t) {
                $arr = $t->toArray();
                if (array_key_exists('body_json', $arr) && $arr['body_json'] === null) {
                    $arr['body_json'] = [];
                }
                return $arr;
            }));
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('EmailTemplateController::index', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'message' => 'Erro ao listar modelos. Execute as migrations: php artisan migrate',
                'error' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    public function store(Request $request)
    {
        $this->ensureEmailAddon($request);

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'subject' => 'required|string|max:255',
            'body_html' => 'nullable|string',
            'body_json' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $template = EmailTemplate::create([
            'tenant_id' => $request->user()->tenant_id,
            'name' => $request->name,
            'subject' => $request->subject,
            'body_html' => $request->body_html,
            'body_json' => $request->body_json,
            'created_by' => $request->user()->id,
        ]);

        return response()->json($template, 201);
    }

    public function show(Request $request, string $id)
    {
        $this->ensureEmailAddon($request);

        $template = EmailTemplate::findOrFail($id);

        return response()->json($template);
    }

    public function update(Request $request, string $id)
    {
        $this->ensureEmailAddon($request);

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'subject' => 'sometimes|string|max:255',
            'body_html' => 'nullable|string',
            'body_json' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $template = EmailTemplate::findOrFail($id);
        $template->update($request->only(['name', 'subject', 'body_html', 'body_json']));

        return response()->json($template);
    }

    public function destroy(Request $request, string $id)
    {
        $this->ensureEmailAddon($request);

        $template = EmailTemplate::findOrFail($id);
        $template->delete();

        return response()->json(['message' => 'Template deleted'], 200);
    }
}
