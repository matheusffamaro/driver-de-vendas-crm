<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CrmTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CrmTaskController extends Controller
{
    /**
     * List all tasks.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        
        // SECURITY: Filter by tenant
        $query = CrmTask::where('tenant_id', $user->tenant_id)
            ->with(['card', 'contact', 'assignedTo', 'createdBy']);

        // SECURITY: Sales users can only see their own tasks
        // Admins and Managers can see all tasks
        if (!$user->isAdmin() && !$user->isManager()) {
            $query->where('assigned_to', $user->id);
        } elseif ($request->has('my_tasks') && $request->boolean('my_tasks')) {
            // Admins/Managers can still filter to see only their tasks if they want
            $query->where('assigned_to', $user->id);
        }

        if ($request->has('card_id')) {
            $query->where('card_id', $request->card_id);
        }

        if ($request->has('contact_id')) {
            $query->where('contact_id', $request->contact_id);
        }

        if ($request->has('assigned_to')) {
            $query->where('assigned_to', $request->assigned_to);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        if ($request->has('priority')) {
            $query->where('priority', $request->priority);
        }

        if ($request->has('date_from')) {
            $query->where('scheduled_at', '>=', $request->date_from);
        }

        if ($request->has('date_to')) {
            $query->where('scheduled_at', '<=', $request->date_to);
        }

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'ilike', "%{$search}%")
                  ->orWhere('description', 'ilike', "%{$search}%");
            });
        }

        $sortBy = $request->get('sort_by', 'scheduled_at');
        $sortDir = $request->get('sort_dir', 'asc');
        $query->orderBy($sortBy, $sortDir);

        $tasks = $query->paginate($request->get('per_page', 20));

        return response()->json([
            'success' => true,
            'data' => $tasks->items(),
            'meta' => [
                'current_page' => $tasks->currentPage(),
                'last_page' => $tasks->lastPage(),
                'per_page' => $tasks->perPage(),
                'total' => $tasks->total(),
            ],
        ]);
    }

    /**
     * Store a new task.
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'card_id' => 'nullable|uuid|exists:pipeline_cards,id',
            'contact_id' => 'nullable|uuid|exists:clients,id',
            'assigned_to' => 'nullable|uuid|exists:users,id',
            'type' => 'nullable|string|in:task,call,meeting,email,follow_up',
            'status' => 'nullable|string|in:pending,in_progress,completed,cancelled',
            'priority' => 'nullable|string|in:low,medium,high,urgent',
            'scheduled_at' => 'nullable|date',
            'reminder_at' => 'nullable|date',
            'duration_minutes' => 'nullable|integer|min:0',
        ]);

        $task = CrmTask::create([
            'id' => Str::uuid(),
            'tenant_id' => $request->user()->tenant_id, // SECURITY: Set tenant_id
            'title' => $request->title,
            'description' => $request->description,
            'card_id' => $request->card_id,
            'contact_id' => $request->contact_id,
            'assigned_to' => $request->assigned_to ?? auth()->id(),
            'created_by' => auth()->id(),
            'type' => $request->type ?? 'task',
            'status' => $request->status ?? 'pending',
            'priority' => $request->priority ?? 'medium',
            'scheduled_at' => $request->scheduled_at,
            'reminder_at' => $request->reminder_at,
            'duration_minutes' => $request->duration_minutes,
        ]);

        return response()->json([
            'success' => true,
            'data' => $task->load(['card', 'contact', 'assignedTo', 'createdBy']),
        ], 201);
    }

    /**
     * Show a task.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        
        // SECURITY: Verify tenant ownership
        $task = CrmTask::where('id', $id)
            ->where('tenant_id', $user->tenant_id)
            ->with(['card', 'contact', 'assignedTo', 'createdBy', 'attachments'])
            ->firstOrFail();

        // SECURITY: Sales users can only see their own tasks
        if (!$user->isAdmin() && !$user->isManager() && $task->assigned_to !== $user->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        return response()->json([
            'success' => true,
            'data' => $task,
        ]);
    }

    /**
     * Update a task.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        
        // SECURITY: Verify tenant ownership
        $task = CrmTask::where('id', $id)
            ->where('tenant_id', $user->tenant_id)
            ->firstOrFail();

        // SECURITY: Sales users can only update their own tasks
        if (!$user->isAdmin() && !$user->isManager() && $task->assigned_to !== $user->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'sometimes|nullable|string',
            'card_id' => 'sometimes|nullable|uuid|exists:pipeline_cards,id',
            'contact_id' => 'sometimes|nullable|uuid|exists:clients,id',
            'assigned_to' => 'sometimes|nullable|uuid|exists:users,id',
            'type' => 'sometimes|nullable|string|in:task,call,meeting,email,follow_up',
            'status' => 'sometimes|nullable|string|in:pending,in_progress,completed,cancelled',
            'priority' => 'sometimes|nullable|string|in:low,medium,high,urgent',
            'scheduled_at' => 'sometimes|nullable|date',
            'reminder_at' => 'sometimes|nullable|date',
            'duration_minutes' => 'sometimes|nullable|integer|min:0',
        ]);

        // Handle nullable fields explicitly
        $updateData = $request->only([
            'title', 'description', 'card_id', 'contact_id', 'assigned_to',
            'type', 'status', 'priority', 'scheduled_at', 'reminder_at', 'duration_minutes'
        ]);
        
        // Ensure null values are preserved for unlinking
        if ($request->has('card_id')) {
            $updateData['card_id'] = $request->input('card_id');
        }
        if ($request->has('contact_id')) {
            $updateData['contact_id'] = $request->input('contact_id');
        }
        
        $task->update($updateData);

        return response()->json([
            'success' => true,
            'data' => $task->fresh()->load(['card', 'contact', 'assignedTo', 'createdBy']),
        ]);
    }

    /**
     * Delete a task.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        
        // SECURITY: Verify tenant ownership
        $task = CrmTask::where('id', $id)
            ->where('tenant_id', $user->tenant_id)
            ->firstOrFail();

        // SECURITY: Sales users can only delete their own tasks
        if (!$user->isAdmin() && !$user->isManager() && $task->assigned_to !== $user->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $task->delete();

        return response()->json([
            'success' => true,
            'message' => 'Task deleted successfully',
        ]);
    }

    /**
     * Mark task as complete.
     */
    public function complete(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        
        // SECURITY: Verify tenant ownership
        $task = CrmTask::where('id', $id)
            ->where('tenant_id', $user->tenant_id)
            ->firstOrFail();

        // SECURITY: Sales users can only complete their own tasks
        if (!$user->isAdmin() && !$user->isManager() && $task->assigned_to !== $user->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $task->update([
            'status' => 'completed',
            'completed_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'data' => $task->fresh()->load(['card', 'contact', 'assignedTo', 'createdBy']),
        ]);
    }
}
