<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use App\Models\Tenant;

class TenantSuspensionMail extends Mailable
{
    use Queueable, SerializesModels;

    public Tenant $tenant;
    public string $reason;
    public string $supportEmail;
    public string $supportPhone;

    public function __construct(Tenant $tenant, ?string $reason = null)
    {
        $this->tenant = $tenant;
        $this->reason = $reason ?? 'Sua conta foi suspensa pelo administrador do sistema.';
        $this->supportEmail = config('mail.from.address', 'suporte@driverdevendas.com');
        $this->supportPhone = config('app.support_phone', '(11) 99999-9999');
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: '⚠️ Sua conta foi suspensa - Driver de Vendas CRM',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.tenant-suspension',
            with: [
                'tenant' => $this->tenant,
                'reason' => $this->reason,
                'supportEmail' => $this->supportEmail,
                'supportPhone' => $this->supportPhone,
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
