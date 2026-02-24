<?php

namespace App\Actions\Whatsapp;

use App\Models\User;
use App\Models\WhatsappConversation;
use App\Models\WhatsappMessage;
use App\Services\Whatsapp\WhatsappMessageService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/**
 * Action to send a WhatsApp message
 * 
 * Handles validation, authorization, and sending of text and media messages.
 */
class SendMessageAction
{
    public function __construct(
        private WhatsappMessageService $messageService
    ) {}

    /**
     * Execute the action to send a message
     * 
     * @param WhatsappConversation $conversation Target conversation
     * @param User $sender User sending the message
     * @param string $type Message type (text, image, video, audio, document)
     * @param string|null $content Message content or caption
     * @param UploadedFile|null $file Media file for non-text messages
     * @return array Result with success status and message data
     * @throws ValidationException
     */
    public function execute(
        WhatsappConversation $conversation,
        User $sender,
        string $type,
        ?string $content = null,
        ?UploadedFile $file = null
    ): array {
        try {
            // Validate input
            $this->validateInput($type, $content, $file);

            // Check authorization
            $access = $this->messageService->canUserSendMessage($sender, $conversation);
            if (!$access['allowed']) {
                return [
                    'success' => false,
                    'message' => $access['message'],
                    'data' => null,
                ];
            }

            // Check if session is connected
            if (!$this->isSessionConnected($conversation)) {
                return [
                    'success' => false,
                    'message' => 'Sessão WhatsApp não está conectada. Conecte novamente para enviar mensagens.',
                    'data' => null,
                ];
            }

            DB::beginTransaction();

            // Send message based on type
            $result = $this->sendMessage($conversation, $sender, $type, $content, $file);

            if (!$result['success']) {
                DB::rollBack();
                return $result;
            }

            // Log message sent
            Log::info('WhatsApp message sent', [
                'user_id' => $sender->id,
                'conversation_id' => $conversation->id,
                'type' => $type,
                'message_id' => $result['message']->id,
            ]);

            DB::commit();

            return [
                'success' => true,
                'message' => 'Mensagem enviada com sucesso.',
                'data' => $result['message'],
            ];

        } catch (ValidationException $e) {
            throw $e;
        } catch (\Exception $e) {
            DB::rollBack();

            Log::error('Error sending WhatsApp message', [
                'error' => $e->getMessage(),
                'user_id' => $sender->id,
                'conversation_id' => $conversation->id,
            ]);

            return [
                'success' => false,
                'message' => 'Erro ao enviar mensagem: ' . $e->getMessage(),
                'data' => null,
            ];
        }
    }

    /**
     * Validate input parameters
     * 
     * @throws ValidationException
     */
    private function validateInput(string $type, ?string $content, ?UploadedFile $file): void
    {
        $validator = Validator::make([
            'type' => $type,
            'content' => $content,
            'file' => $file,
        ], [
            'type' => 'required|string|in:text,image,video,audio,document',
            'content' => 'nullable|string|max:4096',
            'file' => 'nullable|file|max:' . config('whatsapp.media.max_file_size', 51200),
        ]);

        if ($validator->fails()) {
            throw new ValidationException($validator);
        }

        // Validate that text messages have content
        if ($type === 'text' && empty($content)) {
            throw ValidationException::withMessages([
                'content' => ['Conteúdo é obrigatório para mensagens de texto.'],
            ]);
        }

        // Validate that media messages have a file
        if ($type !== 'text' && !$file) {
            throw ValidationException::withMessages([
                'file' => ['Arquivo é obrigatório para mensagens de mídia.'],
            ]);
        }
    }

    /**
     * Check if session is connected
     */
    private function isSessionConnected(WhatsappConversation $conversation): bool
    {
        return $conversation->session?->status === 'connected';
    }

    /**
     * Send message via service
     */
    private function sendMessage(
        WhatsappConversation $conversation,
        User $sender,
        string $type,
        ?string $content,
        ?UploadedFile $file
    ): array {
        if ($type === 'text') {
            return $this->messageService->sendTextMessage(
                $conversation,
                $content,
                $sender
            );
        }

        return $this->messageService->sendMediaMessage(
            $conversation,
            $file,
            $type,
            $sender,
            $content
        );
    }

    /**
     * Quick send text message (helper method)
     */
    public function sendText(
        WhatsappConversation $conversation,
        User $sender,
        string $content
    ): array {
        return $this->execute($conversation, $sender, 'text', $content, null);
    }

    /**
     * Quick send image (helper method)
     */
    public function sendImage(
        WhatsappConversation $conversation,
        User $sender,
        UploadedFile $file,
        ?string $caption = null
    ): array {
        return $this->execute($conversation, $sender, 'image', $caption, $file);
    }
}
