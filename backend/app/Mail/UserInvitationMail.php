<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use App\Models\UserInvitation;

class UserInvitationMail extends Mailable
{
    use Queueable, SerializesModels;

    public UserInvitation $invitation;
    public string $inviteUrl;

    /**
     * Create a new message instance.
     */
    public function __construct(UserInvitation $invitation)
    {
        $this->invitation = $invitation;
        $this->inviteUrl = config('app.frontend_url', 'http://localhost:3000') . '/auth/accept-invite?token=' . $invitation->token;
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Você foi convidado para o Driver de Vendas CRM',
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.invitation',
            with: [
                'invitation' => $this->invitation,
                'inviteUrl' => $this->inviteUrl,
                'inviterName' => $this->invitation->inviter?->name ?? 'Um administrador',
                'roleName' => $this->invitation->roleRelation?->name ?? ucfirst($this->invitation->role ?? 'Usuário'),
            ],
        );
    }

    /**
     * Get the attachments for the message.
     */
    public function attachments(): array
    {
        return [];
    }
}
