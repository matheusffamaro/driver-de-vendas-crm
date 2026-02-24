<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // AI Chat Agent Configuration
        Schema::create('ai_chat_agents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name')->default('Agente de Chat');
            $table->boolean('is_active')->default(false);
            $table->string('whatsapp_session_id')->nullable();
            $table->boolean('notify_human_escalation')->default(false);
            $table->string('notification_email')->nullable();
            
            // Schedule for human service hours
            $table->json('human_service_hours')->nullable();
            
            // Instructions configuration
            $table->string('instruction_type')->default('structured'); // structured, custom
            $table->text('function_definition')->nullable();
            $table->text('company_info')->nullable();
            $table->text('tone')->nullable();
            $table->text('knowledge_guidelines')->nullable();
            $table->text('incorrect_info_prevention')->nullable();
            $table->text('human_escalation_rules')->nullable();
            $table->text('useful_links')->nullable();
            $table->text('conversation_examples')->nullable();
            $table->text('custom_instructions')->nullable();
            
            $table->timestamps();
        });

        // Knowledge Base Documents
        Schema::create('ai_knowledge_documents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('agent_id');
            $table->string('name');
            $table->string('file_path');
            $table->string('file_type');
            $table->integer('file_size');
            $table->text('content')->nullable(); // Extracted text content
            $table->text('embedding')->nullable(); // Vector embedding for semantic search
            $table->timestamps();

            $table->foreign('agent_id')->references('id')->on('ai_chat_agents')->onDelete('cascade');
        });

        // Chat Agent Conversations Log
        Schema::create('ai_chat_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('agent_id');
            $table->uuid('whatsapp_conversation_id')->nullable();
            $table->string('contact_phone')->nullable();
            $table->string('contact_name')->nullable();
            $table->text('user_message');
            $table->text('ai_response');
            $table->boolean('escalated_to_human')->default(false);
            $table->string('escalation_reason')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->foreign('agent_id')->references('id')->on('ai_chat_agents')->onDelete('cascade');
            $table->index(['agent_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ai_chat_logs');
        Schema::dropIfExists('ai_knowledge_documents');
        Schema::dropIfExists('ai_chat_agents');
    }
};
