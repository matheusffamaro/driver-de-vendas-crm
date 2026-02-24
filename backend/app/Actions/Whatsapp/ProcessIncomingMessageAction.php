<?php

namespace App\Actions\Whatsapp;

use App\Models\WhatsappSession;
use App\Services\Whatsapp\WhatsappWebhookService;
use Illuminate\Support\Facades\Log;

/**
 * Action to process incoming WhatsApp messages
 * 
 * This action is called by the webhook and handles all incoming message processing,
 * including conversation creation, message storage, and AI agent triggering.
 */
class ProcessIncomingMessageAction
{
    public function __construct(
        private WhatsappWebhookService $webhookService
    ) {}

    /**
     * Execute the action to process incoming message
     * 
     * @param array $webhookData Raw webhook data from WhatsApp service
     * @return array Result with success status
     */
    public function execute(array $webhookData): array
    {
        try {
            // Validate webhook data
            if (!$this->isValidWebhookData($webhookData)) {
                Log::warning('Invalid webhook data received', [
                    'data' => $webhookData,
                ]);

                return [
                    'success' => false,
                    'message' => 'Invalid webhook data',
                ];
            }

            // Extract event type
            $event = $webhookData['event'] ?? null;
            $sessionId = $webhookData['sessionId'] ?? null;

            // Verify session exists
            $session = WhatsappSession::withTrashed()->find($sessionId);
            if (!$session) {
                Log::warning('Webhook for non-existent session', [
                    'session_id' => $sessionId,
                ]);

                return [
                    'success' => false,
                    'message' => 'Session not found',
                ];
            }

            // Skip if session is deleted
            if ($session->trashed()) {
                return [
                    'success' => true,
                    'message' => 'Session deleted, ignoring webhook',
                ];
            }

            // Process webhook through service
            $result = $this->webhookService->handleWebhook($webhookData);

            // Log successful processing
            if ($result['success']) {
                Log::debug('Webhook processed successfully', [
                    'event' => $event,
                    'session_id' => $sessionId,
                ]);
            }

            return $result;

        } catch (\Exception $e) {
            Log::error('Error processing incoming message', [
                'error' => $e->getMessage(),
                'webhook_data' => $webhookData,
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'message' => 'Error processing message: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Validate webhook data structure
     */
    private function isValidWebhookData(array $data): bool
    {
        // Must have event and sessionId
        if (empty($data['event']) || empty($data['sessionId'])) {
            return false;
        }

        // Validate event type
        $validEvents = config('whatsapp.webhook_events', [
            'qr_code',
            'connected',
            'disconnected',
            'logged_out',
            'message',
            'message_status',
        ]);

        if (!in_array($data['event'], $validEvents)) {
            return false;
        }

        // For message events, validate required fields
        if ($data['event'] === 'message') {
            if (empty($data['from'])) {
                return false;
            }
        }

        return true;
    }

    /**
     * Get event statistics (useful for monitoring)
     */
    public function getEventStats(string $sessionId, int $minutes = 60): array
    {
        // This could be implemented to track webhook events
        // For now, return empty stats
        return [
            'total_events' => 0,
            'message_events' => 0,
            'error_rate' => 0,
            'timeframe_minutes' => $minutes,
        ];
    }
}
