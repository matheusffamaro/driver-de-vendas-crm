<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\ClientCustomField;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ClientController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        
        // PERFORMANCE: Use eager loading to prevent N+1 queries
        $query = Client::query()->with(['pipelineCards' => function ($q) {
            $q->select('id', 'contact_id', 'title', 'value', 'pipeline_id')
              ->limit(5); // Limit to recent cards
        }, 'responsibleUser:id,name,email']);

        if ($user?->tenant_id) {
            $query->where('tenant_id', $user->tenant_id);
        }

        // SECURITY: Sales users only see their assigned clients
        $query->forUser($user);

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                  ->orWhere('email', 'ilike', "%{$search}%")
                  ->orWhere('phone', 'ilike', "%{$search}%")
                  ->orWhere('document', 'ilike', "%{$search}%");
            });
        }

        // PERFORMANCE: Use index-optimized ordering
        $clients = $query->orderBy('name')->paginate($request->get('per_page', 20));

        return response()->json([
            'success' => true,
            'data' => $clients->items(),
            'meta' => [
                'current_page' => $clients->currentPage(),
                'last_page' => $clients->lastPage(),
                'per_page' => $clients->perPage(),
                'total' => $clients->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:30',
            'document' => 'nullable|string|max:30',
            'document_type' => 'nullable|string|in:cpf,cnpj,other',
            'address' => 'nullable|string|max:500',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:50',
            'zip_code' => 'nullable|string|max:20',
            'country' => 'nullable|string|max:100',
            'notes' => 'nullable|string',
            'tags' => 'nullable|array',
            'custom_fields' => 'nullable|array',
            'company_name' => 'nullable|string|max:255',
            'status' => 'nullable|string|in:active,inactive',
            'type' => 'nullable|string|in:individual,company',
            'responsible_user_id' => 'nullable|uuid|exists:users,id',
        ]);

        $user = $request->user();
        
        // Auto-assign responsible_user_id
        $responsibleUserId = $request->responsible_user_id;
        
        // If not provided and user is sales, assign to themselves
        if (!$responsibleUserId && !$user->isAdmin() && !$user->isManager()) {
            $responsibleUserId = $user->id;
        }
        
        $client = Client::create([
            ...$request->except('responsible_user_id'),
            'created_by' => auth()->id(),
            'tenant_id' => $user?->tenant_id,
            'responsible_user_id' => $responsibleUserId,
        ]);

        return response()->json([
            'success' => true,
            'data' => $client->load('responsibleUser:id,name,email'),
        ], 201);
    }

    public function show(string $id): JsonResponse
    {
        $client = Client::with(['pipelineCards', 'tasks'])->findOrFail($id);
        $user = request()->user();
        if ($user?->tenant_id && $client->tenant_id !== $user->tenant_id) {
            return response()->json([
                'success' => false,
                'message' => 'Acesso negado.',
            ], 403);
        }

        return response()->json([
            'success' => true,
            'data' => $client,
        ]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $client = Client::findOrFail($id);
        $user = $request->user();
        if ($user?->tenant_id && $client->tenant_id !== $user->tenant_id) {
            return response()->json([
                'success' => false,
                'message' => 'Acesso negado.',
            ], 403);
        }

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|nullable|email|max:255',
            'phone' => 'sometimes|nullable|string|max:30',
            'document' => 'sometimes|nullable|string|max:30',
            'document_type' => 'sometimes|nullable|string|in:cpf,cnpj,other',
            'address' => 'sometimes|nullable|string|max:500',
            'city' => 'sometimes|nullable|string|max:100',
            'state' => 'sometimes|nullable|string|max:50',
            'zip_code' => 'sometimes|nullable|string|max:20',
            'country' => 'sometimes|nullable|string|max:100',
            'notes' => 'sometimes|nullable|string',
            'tags' => 'sometimes|nullable|array',
            'custom_fields' => 'sometimes|nullable|array',
            'company_name' => 'sometimes|nullable|string|max:255',
            'status' => 'sometimes|nullable|string|in:active,inactive',
            'type' => 'sometimes|nullable|string|in:individual,company',
            'responsible_user_id' => 'sometimes|nullable|uuid|exists:users,id',
        ]);

        // Only admin/manager can change responsible_user_id
        $data = $request->except('responsible_user_id');
        if ($request->has('responsible_user_id') && ($user->isAdmin() || $user->isManager())) {
            $data['responsible_user_id'] = $request->responsible_user_id;
        }

        $client->update($data);

        return response()->json([
            'success' => true,
            'data' => $client->fresh()->load('responsibleUser:id,name,email'),
        ]);
    }

    public function destroy(string $id): JsonResponse
    {
        $client = Client::findOrFail($id);
        $user = request()->user();
        
        if ($user?->tenant_id && $client->tenant_id !== $user->tenant_id) {
            return response()->json([
                'success' => false,
                'message' => 'Acesso negado.',
            ], 403);
        }

        // SECURITY: Only admin and manager can delete clients
        // Sales role cannot delete clients
        if (!$user->isAdmin() && !$user->isManager()) {
            return response()->json([
                'success' => false,
                'message' => 'Você não tem permissão para excluir clientes.',
            ], 403);
        }

        $client->delete();

        return response()->json([
            'success' => true,
            'message' => 'Cliente excluído com sucesso',
        ]);
    }

    public function search(Request $request): JsonResponse
    {
        $request->validate([
            'q' => 'required|string|min:2',
        ]);

        $user = $request->user();
        $clients = Client::where('name', 'ilike', "%{$request->q}%")
            ->orWhere('email', 'ilike', "%{$request->q}%")
            ->orWhere('phone', 'ilike', "%{$request->q}%")
            ->when($user?->tenant_id, fn($q) => $q->where('tenant_id', $user->tenant_id))
            ->limit(10)
            ->get(['id', 'name', 'email', 'phone']);

        return response()->json([
            'success' => true,
            'data' => $clients,
        ]);
    }

    public function customFields(Request $request): JsonResponse
    {
        $user = $request->user();
        $fields = ClientCustomField::query()
            ->when($user?->tenant_id, fn($q) => $q->where('tenant_id', $user->tenant_id))
            ->orderBy('position')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $fields,
        ]);
    }

    public function updateCustomFields(Request $request): JsonResponse
    {
        $request->validate([
            'fields' => 'array',
            'fields.*.name' => 'required|string|max:255',
            'fields.*.field_key' => 'nullable|string|max:255',
            'fields.*.type' => 'required|string|in:text,number,date,select',
            'fields.*.options' => 'nullable|array',
            'fields.*.is_required' => 'nullable|boolean',
            'fields.*.position' => 'nullable|integer|min:0',
        ]);

        $user = $request->user();
        $tenantId = $user?->tenant_id;
        $fields = $request->get('fields', []);

        ClientCustomField::when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
            ->delete();

        foreach ($fields as $index => $field) {
            $key = $field['field_key'] ?? Str::slug($field['name'], '_');
            ClientCustomField::create([
                'id' => Str::uuid(),
                'tenant_id' => $tenantId,
                'name' => $field['name'],
                'field_key' => $key,
                'type' => $field['type'],
                'options' => $field['options'] ?? null,
                'is_required' => $field['is_required'] ?? false,
                'position' => $field['position'] ?? $index,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Campos personalizados atualizados.',
        ]);
    }

    public function exportCsv(Request $request)
    {
        $user = $request->user();
        $query = Client::query();
        if ($user?->tenant_id) {
            $query->where('tenant_id', $user->tenant_id);
        }

        $filename = 'clientes-' . now()->format('Ymd-His') . '.csv';
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        $columns = [
            'name',
            'email',
            'phone',
            'document',
            'type',
            'company_name',
            'status',
            'notes',
        ];

        $callback = function () use ($query, $columns) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, $columns);

            $query->orderBy('name')->chunk(200, function ($clients) use ($handle) {
                foreach ($clients as $client) {
                    fputcsv($handle, [
                        $client->name,
                        $client->email,
                        $client->phone,
                        $client->document,
                        $client->type,
                        $client->company_name,
                        $client->status,
                        $client->notes,
                    ]);
                }
            });

            fclose($handle);
        };

        return response()->streamDownload($callback, $filename, $headers);
    }

    public function importCsv(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt',
        ]);

        $user = $request->user();
        $file = $request->file('file');
        $handle = fopen($file->getRealPath(), 'r');
        if (!$handle) {
            return response()->json([
                'success' => false,
                'message' => 'Não foi possível ler o arquivo.',
            ], 422);
        }

        $header = fgetcsv($handle);
        if (!$header) {
            fclose($handle);
            return response()->json([
                'success' => false,
                'message' => 'Arquivo CSV vazio.',
            ], 422);
        }

        $map = array_flip(array_map('strtolower', $header));
        $created = 0;
        $updated = 0;

        while (($row = fgetcsv($handle)) !== false) {
            $name = $row[$map['name'] ?? -1] ?? null;
            if (!$name) {
                continue;
            }

            $data = [
                'name' => $name,
                'email' => $row[$map['email'] ?? -1] ?? null,
                'phone' => $row[$map['phone'] ?? -1] ?? null,
                'document' => $row[$map['document'] ?? -1] ?? null,
                'type' => $row[$map['type'] ?? -1] ?? 'individual',
                'company_name' => $row[$map['company_name'] ?? -1] ?? null,
                'status' => $row[$map['status'] ?? -1] ?? 'active',
                'notes' => $row[$map['notes'] ?? -1] ?? null,
                'tenant_id' => $user?->tenant_id,
                'created_by' => $user?->id,
            ];

            $client = Client::updateOrCreate(
                ['name' => $data['name'], 'tenant_id' => $data['tenant_id']],
                $data
            );

            if ($client->wasRecentlyCreated) {
                $created++;
            } else {
                $updated++;
            }
        }

        fclose($handle);

        return response()->json([
            'success' => true,
            'message' => 'Importação concluída.',
            'data' => [
                'created' => $created,
                'updated' => $updated,
            ],
        ]);
    }
}
