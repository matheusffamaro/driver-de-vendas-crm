<?php

namespace App\DTO\Whatsapp;

use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;

/**
 * Data Transfer Object for sending a WhatsApp message
 */
class SendMessageDTO
{
    public function __construct(
        public readonly string $conversationId,
        public readonly string $senderId,
        public readonly string $type,
        public readonly ?string $content = null,
        public readonly ?UploadedFile $file = null,
    ) {}

    /**
     * Create DTO from HTTP Request
     */
    public static function fromRequest(Request $request, string $conversationId): self
    {
        return new self(
            conversationId: $conversationId,
            senderId: $request->user()->id,
            type: $request->type,
            content: $request->content,
            file: $request->file('media'),
        );
    }

    /**
     * Check if this is a text message
     */
    public function isText(): bool
    {
        return $this->type === 'text';
    }

    /**
     * Check if this is a media message
     */
    public function isMedia(): bool
    {
        return in_array($this->type, ['image', 'video', 'audio', 'document']);
    }

    /**
     * Get caption (for media messages)
     */
    public function getCaption(): ?string
    {
        return $this->isMedia() ? $this->content : null;
    }

    /**
     * Validate DTO
     */
    public function validate(): array
    {
        $errors = [];

        if ($this->isText() && empty($this->content)) {
            $errors['content'] = 'Conteúdo é obrigatório para mensagens de texto.';
        }

        if ($this->isMedia() && !$this->file) {
            $errors['file'] = 'Arquivo é obrigatório para mensagens de mídia.';
        }

        return $errors;
    }

    /**
     * Convert to array
     */
    public function toArray(): array
    {
        return [
            'conversation_id' => $this->conversationId,
            'sender_id' => $this->senderId,
            'type' => $this->type,
            'content' => $this->content,
            'has_file' => $this->file !== null,
        ];
    }
}
