<?php

namespace App\DTO\Whatsapp;

use Illuminate\Http\Request;

/**
 * Data Transfer Object for creating a WhatsApp session
 */
class CreateSessionDTO
{
    public function __construct(
        public readonly string $phoneNumber,
        public readonly string $userId,
        public readonly string $tenantId,
        public readonly ?string $sessionName = null,
        public readonly bool $isGlobal = false,
    ) {}

    /**
     * Create DTO from HTTP Request
     */
    public static function fromRequest(Request $request): self
    {
        return new self(
            phoneNumber: preg_replace('/\D/', '', $request->phone_number),
            userId: $request->user()->id,
            tenantId: $request->user()->tenant_id,
            sessionName: $request->session_name,
            isGlobal: $request->boolean('is_global', false),
        );
    }

    /**
     * Create DTO from array
     */
    public static function fromArray(array $data): self
    {
        return new self(
            phoneNumber: preg_replace('/\D/', '', $data['phone_number']),
            userId: $data['user_id'],
            tenantId: $data['tenant_id'],
            sessionName: $data['session_name'] ?? null,
            isGlobal: $data['is_global'] ?? false,
        );
    }

    /**
     * Convert to array
     */
    public function toArray(): array
    {
        return [
            'phone_number' => $this->phoneNumber,
            'user_id' => $this->userId,
            'tenant_id' => $this->tenantId,
            'session_name' => $this->sessionName,
            'is_global' => $this->isGlobal,
        ];
    }
}
