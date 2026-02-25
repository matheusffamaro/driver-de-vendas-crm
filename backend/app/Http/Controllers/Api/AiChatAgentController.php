<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiChatAgent;
use App\Models\AiKnowledgeDocument;
use App\Services\AIService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class AiChatAgentController extends Controller
{
    /**
     * Get AI model information.
     */
    public function modelInfo(): JsonResponse
    {
        $aiService = new AIService();
        
        return response()->json([
            'success' => true,
            'data' => $aiService->getModelInfo(),
        ]);
    }

    /**
     * Get the AI Chat Agent configuration.
     */
    public function show(): JsonResponse
    {
        // Get or create the agent (single instance for now)
        $agent = AiChatAgent::with('documents')->first();
        
        if (!$agent) {
            $defaults = AiChatAgent::getDefaultInstructions();
            $agent = AiChatAgent::create([
                'id' => Str::uuid(),
                'name' => 'Agente de Chat',
                'is_active' => false,
                ...$defaults,
            ]);
        }

        // Add AI model info to response
        $aiService = new AIService();

        return response()->json([
            'success' => true,
            'data' => $agent,
            'defaults' => AiChatAgent::getDefaultInstructions(),
            'ai_model' => $aiService->getModelInfo(),
        ]);
    }

    /**
     * Update the AI Chat Agent configuration.
     */
    public function update(Request $request): JsonResponse
    {
        $agent = AiChatAgent::first();
        
        if (!$agent) {
            $agent = AiChatAgent::create([
                'id' => Str::uuid(),
                'name' => 'Agente de Chat',
            ]);
        }

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'is_active' => 'sometimes|boolean',
            'whatsapp_session_id' => 'sometimes|nullable|string',
            'notify_human_escalation' => 'sometimes|boolean',
            'notification_email' => 'sometimes|nullable|email',
            'human_service_hours' => 'sometimes|nullable|array',
            'instruction_type' => 'sometimes|string|in:structured,custom',
            'function_definition' => 'sometimes|nullable|string',
            'company_info' => 'sometimes|nullable|string',
            'tone' => 'sometimes|nullable|string',
            'knowledge_guidelines' => 'sometimes|nullable|string',
            'incorrect_info_prevention' => 'sometimes|nullable|string',
            'human_escalation_rules' => 'sometimes|nullable|string',
            'useful_links' => 'sometimes|nullable|string',
            'conversation_examples' => 'sometimes|nullable|string',
            'custom_instructions' => 'sometimes|nullable|string',
        ]);

        $data = $request->all();
        // Normalize "default" (frontend legacy value) to NULL = all sessions
        if (($data['whatsapp_session_id'] ?? null) === 'default') {
            $data['whatsapp_session_id'] = null;
        }

        $agent->update($data);

        return response()->json([
            'success' => true,
            'data' => $agent->fresh(),
            'message' => 'Configurações atualizadas com sucesso.',
        ]);
    }

    /**
     * Upload a knowledge document.
     */
    public function uploadDocument(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:pdf,txt,doc,docx|max:10240', // 10MB max
        ]);

        $agent = AiChatAgent::first();
        if (!$agent) {
            return response()->json([
                'success' => false,
                'message' => 'Configure o agente primeiro.',
            ], 400);
        }

        $file = $request->file('file');
        $path = $file->store('knowledge-base', 'local');

        // Extract text content from file (basic implementation)
        $content = $this->extractTextContent($file);

        $document = AiKnowledgeDocument::create([
            'id' => Str::uuid(),
            'agent_id' => $agent->id,
            'name' => $file->getClientOriginalName(),
            'file_path' => $path,
            'file_type' => $file->getClientOriginalExtension(),
            'file_size' => $file->getSize(),
            'content' => $content,
        ]);

        return response()->json([
            'success' => true,
            'data' => $document,
            'message' => 'Documento carregado com sucesso.',
        ], 201);
    }

    /**
     * List knowledge documents.
     */
    public function listDocuments(): JsonResponse
    {
        $agent = AiChatAgent::first();
        if (!$agent) {
            return response()->json([
                'success' => true,
                'data' => [],
            ]);
        }

        $documents = AiKnowledgeDocument::where('agent_id', $agent->id)
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $documents,
        ]);
    }

    /**
     * Delete a knowledge document.
     */
    public function deleteDocument(string $id): JsonResponse
    {
        $document = AiKnowledgeDocument::findOrFail($id);
        
        // Delete file from storage
        Storage::disk('local')->delete($document->file_path);
        
        $document->delete();

        return response()->json([
            'success' => true,
            'message' => 'Documento excluído com sucesso.',
        ]);
    }

    /**
     * Reset instructions to default.
     */
    public function resetInstructions(): JsonResponse
    {
        $agent = AiChatAgent::first();
        if (!$agent) {
            return response()->json([
                'success' => false,
                'message' => 'Agente não encontrado.',
            ], 404);
        }

        $defaults = AiChatAgent::getDefaultInstructions();
        $agent->update($defaults);

        return response()->json([
            'success' => true,
            'data' => $agent->fresh(),
            'message' => 'Instruções redefinidas para o padrão.',
        ]);
    }

    /**
     * Test the chatbot with a message.
     */
    public function testChat(Request $request): JsonResponse
    {
        $request->validate([
            'message' => 'required|string|max:1000',
        ]);

        $agent = AiChatAgent::with('documents')->first();
        if (!$agent) {
            return response()->json([
                'success' => false,
                'message' => 'Configure o agente primeiro.',
            ], 400);
        }

        $tenantId = $request->user()?->tenant_id
            ?? DB::table('tenants')->orderBy('created_at')->value('id')
            ?? $request->user()?->id;
        $aiService = new AIService($tenantId, $request->user()?->id);
        
        $knowledgeBase = '';
        foreach ($agent->documents as $doc) {
            if ($doc->content) {
                $knowledgeBase .= "\n\n--- {$doc->name} ---\n{$doc->content}";
            }
        }

        $instructions = $agent->instruction_type === 'custom'
            ? ['custom_instructions' => $agent->custom_instructions]
            : [
                'function_definition' => $agent->function_definition,
                'company_info' => $agent->company_info,
                'tone' => $agent->tone,
                'knowledge_guidelines' => $agent->knowledge_guidelines,
                'incorrect_info_prevention' => $agent->incorrect_info_prevention,
                'human_escalation_rules' => $agent->human_escalation_rules,
                'useful_links' => $agent->useful_links,
                'conversation_examples' => $agent->conversation_examples,
            ];

        $context = [
            'knowledge_base' => $knowledgeBase,
        ];

        $result = $aiService->generateChatResponse($request->message, $context, $instructions);

        return response()->json([
            'success' => $result['success'],
            'data' => [
                'response' => $result['response'] ?? null,
            ],
            'message' => $result['message'] ?? null,
        ]);
    }

    /**
     * Get chat logs.
     */
    public function listLogs(Request $request): JsonResponse
    {
        $agent = AiChatAgent::first();
        if (!$agent) {
            return response()->json([
                'success' => true,
                'data' => [],
            ]);
        }

        $query = $agent->logs()->orderByDesc('created_at');

        if ($request->has('escalated_only') && $request->boolean('escalated_only')) {
            $query->where('escalated_to_human', true);
        }

        $logs = $query->paginate($request->get('per_page', 20));

        return response()->json([
            'success' => true,
            'data' => $logs->items(),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
            ],
        ]);
    }

    private function extractTextContent($file): ?string
    {
        $extension = strtolower($file->getClientOriginalExtension());
        $path = $file->getRealPath();

        try {
            if ($extension === 'txt') {
                return file_get_contents($path);
            }

            if ($extension === 'pdf') {
                $parser = new \Smalot\PdfParser\Parser();
                $pdf = $parser->parseFile($path);
                $text = $pdf->getText();
                return !empty(trim($text)) ? trim($text) : null;
            }

            if (in_array($extension, ['doc', 'docx'])) {
                $phpWord = \PhpOffice\PhpWord\IOFactory::load($path);
                $text = '';
                foreach ($phpWord->getSections() as $section) {
                    foreach ($section->getElements() as $element) {
                        if (method_exists($element, 'getText')) {
                            $text .= $element->getText() . "\n";
                        } elseif (method_exists($element, 'getElements')) {
                            foreach ($element->getElements() as $child) {
                                if (method_exists($child, 'getText')) {
                                    $text .= $child->getText() . "\n";
                                }
                            }
                        }
                    }
                }
                return !empty(trim($text)) ? trim($text) : null;
            }
        } catch (\Exception $e) {
            Log::error('Failed to extract text from document', [
                'extension' => $extension,
                'error' => $e->getMessage(),
            ]);
        }

        return null;
    }
}
