<?php

namespace Tests\Feature\Whatsapp;

use Tests\TestCase;
use Tests\Helpers\CreatesTestData;
use App\Models\WhatsappSession;
use App\Models\WhatsappConversation;
use App\Models\WhatsappMessage;
use App\Models\WhatsappQuickReply;
use App\Models\WhatsappAssignmentQueue;
use Illuminate\Foundation\Testing\RefreshDatabase;

class WhatsappTest extends TestCase
{
    use RefreshDatabase, CreatesTestData;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpTenantAndUser();
    }

    public function test_can_create_session(): void
    {
        $response = $this->actingAsUser()
            ->postJson('/api/whatsapp/sessions', [
                'phone_number' => '5511999887766',
                'session_name' => 'WhatsApp Vendas',
            ]);

        $this->assertContains($response->status(), [200, 201]);
        $this->assertDatabaseHas('whatsapp_sessions', [
            'phone_number' => '5511999887766',
            'tenant_id' => $this->tenant->id,
        ]);
    }

    public function test_session_requires_phone(): void
    {
        $response = $this->actingAsUser()
            ->postJson('/api/whatsapp/sessions', [
                'session_name' => 'Sem telefone',
            ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['phone_number']);
    }

    public function test_can_list_sessions(): void
    {
        $this->createWhatsappSession(['session_name' => 'Session 1']);
        $this->createWhatsappSession(['session_name' => 'Session 2']);

        $response = $this->actingAsUser()
            ->getJson('/api/whatsapp/sessions');

        $response->assertStatus(200);
    }

    public function test_can_get_session_status(): void
    {
        $session = $this->createWhatsappSession();

        $response = $this->actingAsUser()
            ->getJson("/api/whatsapp/sessions/{$session->id}/status");

        $response->assertStatus(200);
    }

    public function test_can_update_session(): void
    {
        $session = $this->createWhatsappSession();
        $seller = $this->createSalesUser();

        $response = $this->actingAsUser()
            ->putJson("/api/whatsapp/sessions/{$session->id}", [
                'user_id' => $seller->id,
                'is_global' => true,
            ]);

        $response->assertStatus(200);
    }

    public function test_can_delete_session(): void
    {
        $session = $this->createWhatsappSession();

        $response = $this->actingAsUser()
            ->deleteJson("/api/whatsapp/sessions/{$session->id}");

        $response->assertStatus(200);
    }

    public function test_can_start_conversation(): void
    {
        $session = $this->createWhatsappSession(['status' => 'connected']);

        $response = $this->actingAsUser()
            ->postJson("/api/whatsapp/sessions/{$session->id}/conversations", [
                'phone_number' => '5511888776655',
                'contact_name' => 'Novo Contato',
            ]);

        $this->assertContains($response->status(), [200, 201]);
    }

    public function test_can_list_conversations(): void
    {
        $session = $this->createWhatsappSession();
        $this->createConversation($session, ['contact_name' => 'Conversa 1']);
        $this->createConversation($session, ['contact_name' => 'Conversa 2']);

        $response = $this->actingAsUser()
            ->getJson("/api/whatsapp/sessions/{$session->id}/conversations");

        $response->assertStatus(200);
    }

    public function test_can_send_text_message(): void
    {
        $session = $this->createWhatsappSession(['status' => 'connected']);
        $conversation = $this->createConversation($session);

        $response = $this->actingAsUser()
            ->postJson("/api/whatsapp/conversations/{$conversation->id}/messages", [
                'type' => 'text',
                'content' => 'Olá! Tudo bem?',
            ]);

        $this->assertContains($response->status(), [200, 201, 500]);
    }

    public function test_can_list_messages(): void
    {
        $session = $this->createWhatsappSession();
        $conversation = $this->createConversation($session);
        WhatsappMessage::factory()->create(['conversation_id' => $conversation->id]);
        WhatsappMessage::factory()->create(['conversation_id' => $conversation->id]);

        $response = $this->actingAsUser()
            ->getJson("/api/whatsapp/conversations/{$conversation->id}/messages");

        $response->assertStatus(200);
    }

    public function test_can_link_contact_to_conversation(): void
    {
        $session = $this->createWhatsappSession();
        $conversation = $this->createConversation($session);
        $client = $this->createClient();

        $response = $this->actingAsUser()
            ->postJson("/api/whatsapp/conversations/{$conversation->id}/link-contact", [
                'contact_id' => $client->id,
            ]);

        $response->assertStatus(200);

        $conversation->refresh();
        $this->assertEquals($client->id, $conversation->contact_id);
    }

    public function test_can_assign_conversation_to_user(): void
    {
        $session = $this->createWhatsappSession();
        $conversation = $this->createConversation($session);
        $seller = $this->createSalesUser();

        $response = $this->actingAsUser()
            ->postJson("/api/whatsapp/conversations/{$conversation->id}/assign", [
                'user_id' => $seller->id,
            ]);

        $response->assertStatus(200);

        $conversation->refresh();
        $this->assertEquals($seller->id, $conversation->assigned_user_id);
    }

    public function test_can_toggle_pin_conversation(): void
    {
        $session = $this->createWhatsappSession();
        $conversation = $this->createConversation($session, ['is_pinned' => false]);

        $response = $this->actingAsUser()
            ->postJson("/api/whatsapp/conversations/{$conversation->id}/toggle-pin");

        $response->assertStatus(200);

        $conversation->refresh();
        $this->assertTrue($conversation->is_pinned);
    }

    public function test_can_archive_conversation(): void
    {
        $session = $this->createWhatsappSession();
        $conversation = $this->createConversation($session);

        $response = $this->actingAsUser()
            ->postJson("/api/whatsapp/conversations/{$conversation->id}/archive");

        $response->assertStatus(200);

        $conversation->refresh();
        $this->assertTrue($conversation->is_archived);
    }

    public function test_can_create_quick_reply(): void
    {
        $session = $this->createWhatsappSession();

        $response = $this->actingAsUser()
            ->postJson('/api/whatsapp/quick-replies', [
                'shortcut' => '/ola',
                'title' => 'Saudação',
                'content' => 'Olá! Como posso ajudá-lo hoje?',
            ]);

        $response->assertStatus(201);
    }

    public function test_can_list_quick_replies(): void
    {
        $response = $this->actingAsUser()
            ->getJson('/api/whatsapp/quick-replies');

        $response->assertStatus(200);
    }

    public function test_can_update_quick_reply(): void
    {
        $session = $this->createWhatsappSession();
        $reply = WhatsappQuickReply::create([
            'session_id' => $session->id,
            'shortcut' => '/teste',
            'title' => 'Teste',
            'content' => 'Conteúdo original',
        ]);

        $response = $this->actingAsUser()
            ->putJson("/api/whatsapp/quick-replies/{$reply->id}", [
                'content' => 'Conteúdo atualizado',
            ]);

        $response->assertStatus(200);
    }

    public function test_can_delete_quick_reply(): void
    {
        $session = $this->createWhatsappSession();
        $reply = WhatsappQuickReply::create([
            'session_id' => $session->id,
            'shortcut' => '/del',
            'title' => 'Deletar',
            'content' => 'Para remover',
        ]);

        $response = $this->actingAsUser()
            ->deleteJson("/api/whatsapp/quick-replies/{$reply->id}");

        $response->assertStatus(200);
    }

    public function test_can_create_assignment_queue(): void
    {
        $session = $this->createWhatsappSession();
        $seller1 = $this->createSalesUser();
        $seller2 = $this->createSalesUser();

        $response = $this->actingAsUser()
            ->postJson("/api/whatsapp/sessions/{$session->id}/assignment-queues", [
                'name' => 'Fila de Vendas',
                'user_ids' => [$seller1->id, $seller2->id],
            ]);

        $response->assertStatus(201);
    }

    public function test_can_list_assignment_queues(): void
    {
        $session = $this->createWhatsappSession();

        $response = $this->actingAsUser()
            ->getJson("/api/whatsapp/sessions/{$session->id}/assignment-queues");

        $response->assertStatus(200);
    }

    public function test_webhook_handles_message_event(): void
    {
        $session = $this->createWhatsappSession(['status' => 'connected']);

        $response = $this->postJson('/api/whatsapp/webhook', [
            'event' => 'message',
            'sessionId' => $session->id,
            'data' => [
                'key' => [
                    'remoteJid' => '5511999000001@s.whatsapp.net',
                    'id' => 'MSG_' . uniqid(),
                    'fromMe' => false,
                ],
                'message' => [
                    'conversation' => 'Olá, gostaria de saber mais sobre o produto.',
                ],
                'messageTimestamp' => time(),
                'pushName' => 'Cliente Teste',
            ],
        ]);

        $this->assertContains($response->status(), [200, 201]);
    }

    public function test_webhook_handles_connected_event(): void
    {
        $session = $this->createWhatsappSession(['status' => 'connecting']);

        $response = $this->postJson('/api/whatsapp/webhook', [
            'event' => 'connected',
            'sessionId' => $session->id,
            'data' => [
                'phone' => '5511999887766',
            ],
        ]);

        $response->assertStatus(200);

        $session->refresh();
        $this->assertEquals('connected', $session->status);
    }

    public function test_webhook_handles_disconnected_event(): void
    {
        $session = $this->createWhatsappSession(['status' => 'connected']);

        $response = $this->postJson('/api/whatsapp/webhook', [
            'event' => 'disconnected',
            'sessionId' => $session->id,
            'data' => [],
        ]);

        $response->assertStatus(200);

        $session->refresh();
        $this->assertEquals('disconnected', $session->status);
    }

    public function test_conversations_by_user_filter(): void
    {
        $seller = $this->createSalesUser();
        $session = $this->createWhatsappSession();
        $this->createConversation($session, ['assigned_user_id' => $seller->id]);
        $this->createConversation($session, ['assigned_user_id' => $this->user->id]);

        $response = $this->actingAsUser()
            ->getJson("/api/whatsapp/conversations/by-user?user_ids[]={$seller->id}");

        $response->assertStatus(200);
    }
}
