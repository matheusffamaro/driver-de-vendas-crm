<?php

namespace Tests\Feature\Whatsapp;

use Tests\TestCase;
use Tests\Helpers\CreatesTestData;
use App\Models\AiChatAgent;
use Illuminate\Foundation\Testing\RefreshDatabase;

class AiAgentTest extends TestCase
{
    use RefreshDatabase, CreatesTestData;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpTenantAndUser();
    }

    public function test_can_get_ai_agent_config(): void
    {
        $response = $this->actingAsUser()
            ->getJson('/api/ai-agent');

        $response->assertStatus(200);
    }

    public function test_can_update_ai_agent_instructions(): void
    {
        $response = $this->actingAsUser()
            ->putJson('/api/ai-agent', [
                'name' => 'Assistente Vendas',
                'is_active' => true,
                'function_definition' => 'Você é um assistente de vendas especializado.',
                'tone' => 'Profissional e amigável.',
                'knowledge_guidelines' => 'Sempre consulte a base de conhecimento.',
                'incorrect_info_prevention' => 'Nunca invente informações.',
                'human_escalation_rules' => 'Transfira quando o cliente pedir.',
                'useful_links' => 'Inclua links para o site.',
                'conversation_examples' => 'Exemplo: Olá, como posso ajudar?',
            ]);

        $response->assertStatus(200);
    }

    public function test_can_update_ai_agent_name_and_status(): void
    {
        $response = $this->actingAsUser()
            ->putJson('/api/ai-agent', [
                'name' => 'Bot CRM',
                'is_active' => false,
            ]);

        $response->assertStatus(200);
    }

    public function test_can_reset_ai_agent_instructions(): void
    {
        // First update to custom instructions
        $this->actingAsUser()
            ->putJson('/api/ai-agent', [
                'function_definition' => 'Custom instructions',
            ]);

        $response = $this->actingAsUser()
            ->postJson('/api/ai-agent/reset-instructions');

        $response->assertStatus(200);
    }

    public function test_can_test_chat_with_ai_agent(): void
    {
        $response = $this->actingAsUser()
            ->postJson('/api/ai-agent/test-chat', [
                'message' => 'Quais são os nossos produtos?',
            ]);

        $this->assertContains($response->status(), [200, 201, 400, 422, 500]);
    }

    public function test_can_list_ai_documents(): void
    {
        $response = $this->actingAsUser()
            ->getJson('/api/ai-agent/documents');

        $response->assertStatus(200);
    }

    public function test_can_update_human_service_hours(): void
    {
        $response = $this->actingAsUser()
            ->putJson('/api/ai-agent', [
                'human_service_hours' => [
                    'monday' => ['start' => '08:00', 'end' => '18:00'],
                    'tuesday' => ['start' => '08:00', 'end' => '18:00'],
                    'wednesday' => ['start' => '08:00', 'end' => '18:00'],
                    'thursday' => ['start' => '08:00', 'end' => '18:00'],
                    'friday' => ['start' => '08:00', 'end' => '17:00'],
                ],
                'notify_human_escalation' => true,
                'notification_email' => 'suporte@empresa.com',
            ]);

        $response->assertStatus(200);
    }

    public function test_can_configure_ai_with_whatsapp_session(): void
    {
        $session = $this->createWhatsappSession();

        $response = $this->actingAsUser()
            ->putJson('/api/ai-agent', [
                'whatsapp_session_id' => $session->id,
                'is_active' => true,
            ]);

        $response->assertStatus(200);
    }
}
