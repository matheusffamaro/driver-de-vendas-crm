<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EmailThread;
use App\Models\EmailMessage;
use App\Models\EmailAccount;
use App\Models\Client;
use App\Models\PipelineCard;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class EmailInboxController extends Controller
{
    /**
     * List email threads
     */
    public function index(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'filter' => 'nullable|in:inbox,unread,starred,archived,sent',
            'search' => 'nullable|string',
            'account_id' => 'nullable|uuid',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $query = EmailThread::where('tenant_id', $request->user()->tenant_id)
            ->with(['messages' => function ($q) {
                $q->orderBy('sent_at', 'desc')->limit(1);
            }, 'linkedContact', 'linkedPipelineCard', 'emailAccount'])
            ->orderBy('last_message_at', 'desc');

        // Apply filters
        $filter = $request->input('filter', 'inbox');
        
        switch ($filter) {
            case 'inbox':
                $query->inbox();
                break;
            case 'unread':
                $query->unread();
                break;
            case 'starred':
                $query->starred();
                break;
            case 'archived':
                $query->archived();
                break;
            case 'sent':
                // For sent, we need to filter by messages sent by user
                $query->whereHas('messages', function ($q) use ($request) {
                    $q->where('sent_by_user_id', $request->user()->id);
                });
                break;
        }

        // Filter by account
        if ($request->account_id) {
            $query->where('email_account_id', $request->account_id);
        }

        // Search
        if ($request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('subject', 'ilike', "%{$search}%")
                    ->orWhereJsonContains('participants', $search);
            });
        }

        $perPage = $request->input('per_page', 20);
        $threads = $query->paginate($perPage);

        return response()->json($threads);
    }

    /**
     * Get thread details with all messages
     */
    public function show(Request $request, string $id)
    {
        $thread = EmailThread::where('id', $id)
            ->where('tenant_id', $request->user()->tenant_id)
            ->with([
                'messages' => function ($q) {
                    $q->orderBy('sent_at', 'asc');
                },
                'linkedContact',
                'linkedPipelineCard',
                'emailAccount',
            ])
            ->firstOrFail();

        // Mark as read
        if (!$thread->is_read) {
            $thread->update(['is_read' => true]);
        }

        return response()->json($thread);
    }

    /**
     * Mark thread as read/unread
     */
    public function markAsRead(Request $request, string $id)
    {
        $validator = Validator::make($request->all(), [
            'is_read' => 'required|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $thread = EmailThread::where('id', $id)
            ->where('tenant_id', $request->user()->tenant_id)
            ->firstOrFail();

        $thread->update(['is_read' => $request->is_read]);

        return response()->json([
            'message' => 'Thread updated successfully',
            'thread' => $thread,
        ]);
    }

    /**
     * Archive/unarchive thread
     */
    public function archive(Request $request, string $id)
    {
        $validator = Validator::make($request->all(), [
            'is_archived' => 'required|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $thread = EmailThread::where('id', $id)
            ->where('tenant_id', $request->user()->tenant_id)
            ->firstOrFail();

        $thread->update(['is_archived' => $request->is_archived]);

        return response()->json([
            'message' => 'Thread updated successfully',
            'thread' => $thread,
        ]);
    }

    /**
     * Star/unstar thread
     */
    public function star(Request $request, string $id)
    {
        $validator = Validator::make($request->all(), [
            'is_starred' => 'required|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $thread = EmailThread::where('id', $id)
            ->where('tenant_id', $request->user()->tenant_id)
            ->firstOrFail();

        $thread->update(['is_starred' => $request->is_starred]);

        return response()->json([
            'message' => 'Thread updated successfully',
            'thread' => $thread,
        ]);
    }

    /**
     * Link thread to contact or pipeline card
     */
    public function link(Request $request, string $id)
    {
        $validator = Validator::make($request->all(), [
            'contact_id' => 'nullable|uuid|exists:clients,id',
            'pipeline_card_id' => 'nullable|uuid|exists:pipeline_cards,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $thread = EmailThread::where('id', $id)
            ->where('tenant_id', $request->user()->tenant_id)
            ->firstOrFail();

        // Validate that contact belongs to tenant
        if ($request->contact_id) {
            $contact = Client::where('id', $request->contact_id)
                ->where('tenant_id', $request->user()->tenant_id)
                ->firstOrFail();
        }

        // Validate that pipeline card belongs to tenant
        if ($request->pipeline_card_id) {
            $card = PipelineCard::where('id', $request->pipeline_card_id)
                ->whereHas('pipeline', function ($q) use ($request) {
                    $q->where('tenant_id', $request->user()->tenant_id);
                })
                ->firstOrFail();
        }

        $thread->update([
            'linked_contact_id' => $request->contact_id,
            'linked_pipeline_card_id' => $request->pipeline_card_id,
        ]);

        return response()->json([
            'message' => 'Thread linked successfully',
            'thread' => $thread->load(['linkedContact', 'linkedPipelineCard']),
        ]);
    }

    /**
     * Delete thread
     */
    public function destroy(Request $request, string $id)
    {
        $thread = EmailThread::where('id', $id)
            ->where('tenant_id', $request->user()->tenant_id)
            ->firstOrFail();

        $thread->delete();

        return response()->json(['message' => 'Thread deleted successfully']);
    }

    /**
     * Get unread count
     */
    public function getUnreadCount(Request $request)
    {
        $count = EmailThread::where('tenant_id', $request->user()->tenant_id)
            ->unread()
            ->inbox()
            ->count();

        return response()->json(['unread_count' => $count]);
    }

    /**
     * Get threads for a specific contact
     */
    public function getContactThreads(Request $request, string $contactId)
    {
        $contact = Client::where('id', $contactId)
            ->where('tenant_id', $request->user()->tenant_id)
            ->firstOrFail();

        $threads = EmailThread::where('tenant_id', $request->user()->tenant_id)
            ->where('linked_contact_id', $contactId)
            ->with(['messages' => function ($q) {
                $q->orderBy('sent_at', 'desc')->limit(1);
            }])
            ->orderBy('last_message_at', 'desc')
            ->paginate(20);

        return response()->json($threads);
    }

    /**
     * Get threads for a specific pipeline card
     */
    public function getPipelineCardThreads(Request $request, string $cardId)
    {
        $card = PipelineCard::where('id', $cardId)
            ->whereHas('pipeline', function ($q) use ($request) {
                $q->where('tenant_id', $request->user()->tenant_id);
            })
            ->firstOrFail();

        $threads = EmailThread::where('tenant_id', $request->user()->tenant_id)
            ->where('linked_pipeline_card_id', $cardId)
            ->with(['messages' => function ($q) {
                $q->orderBy('sent_at', 'desc')->limit(1);
            }])
            ->orderBy('last_message_at', 'desc')
            ->paginate(20);

        return response()->json($threads);
    }
}
