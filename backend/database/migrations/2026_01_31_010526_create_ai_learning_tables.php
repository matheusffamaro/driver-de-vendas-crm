<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // AI Memory - Stores learned patterns and context for each tenant
        Schema::create('ai_memories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('tenant_id')->index();
            
            // Memory type: fact, preference, correction, pattern, faq
            $table->string('type');
            
            // Category for organization
            $table->string('category')->nullable(); // products, services, policies, etc.
            
            // The learned information
            $table->string('key')->index(); // What triggered this memory
            $table->text('value'); // The learned response/information
            $table->text('context')->nullable(); // Additional context
            
            // Learning metrics
            $table->integer('usage_count')->default(0); // How many times used
            $table->integer('success_count')->default(0); // Positive feedback count
            $table->float('confidence_score')->default(0.5); // 0-1 confidence
            $table->float('relevance_score')->default(0.5); // How relevant this memory is
            
            // Source tracking
            $table->string('source')->nullable(); // manual, conversation, feedback, document
            $table->uuid('source_id')->nullable(); // ID of source (conversation, document, etc)
            
            // Status
            $table->boolean('is_active')->default(true);
            $table->boolean('is_verified')->default(false); // Human verified
            
            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();
            
            // Indexes for efficient retrieval
            $table->index(['tenant_id', 'type']);
            $table->index(['tenant_id', 'category']);
            $table->index(['tenant_id', 'confidence_score']);
        });

        // AI Feedback - Stores user feedback on AI responses
        Schema::create('ai_feedback', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('tenant_id')->index();
            $table->uuid('user_id')->nullable();
            
            // What was the interaction
            $table->text('user_message'); // Original user message
            $table->text('ai_response'); // AI's response
            $table->string('feature'); // chat, autofill, etc.
            
            // Feedback
            $table->enum('rating', ['positive', 'negative', 'neutral'])->default('neutral');
            $table->text('correction')->nullable(); // User's correction if negative
            $table->text('comment')->nullable(); // Additional feedback
            
            // Context
            $table->uuid('conversation_id')->nullable();
            $table->json('metadata')->nullable(); // Additional context data
            
            // Learning status
            $table->boolean('processed')->default(false); // Has been processed for learning
            $table->timestamp('processed_at')->nullable();
            
            $table->timestamps();
            
            $table->index(['tenant_id', 'rating']);
            $table->index(['tenant_id', 'processed']);
        });

        // AI Conversation Context - Stores conversation history for context
        Schema::create('ai_conversation_contexts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('tenant_id')->index();
            $table->uuid('conversation_id')->index();
            
            // Conversation summary
            $table->text('summary')->nullable();
            $table->json('topics')->nullable(); // Main topics discussed
            $table->json('entities')->nullable(); // Named entities (names, products, etc)
            $table->string('sentiment')->nullable(); // Overall sentiment
            
            // Customer profile learned from conversations
            $table->json('customer_preferences')->nullable();
            $table->json('customer_interests')->nullable();
            $table->string('customer_communication_style')->nullable();
            
            // Interaction quality
            $table->integer('message_count')->default(0);
            $table->integer('ai_response_count')->default(0);
            $table->float('satisfaction_score')->nullable();
            
            $table->timestamps();
            
            $table->index(['tenant_id', 'conversation_id']);
        });

        // AI Learning Patterns - Stores successful response patterns
        Schema::create('ai_learning_patterns', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('tenant_id')->index();
            
            // Pattern matching
            $table->string('intent'); // greeting, question, complaint, request, etc.
            $table->json('trigger_keywords'); // Keywords that trigger this pattern
            $table->text('pattern_template'); // Template for matching
            
            // Response
            $table->text('response_template'); // Best response template
            $table->json('response_variations')->nullable(); // Alternative responses
            
            // Performance metrics
            $table->integer('times_used')->default(0);
            $table->integer('times_successful')->default(0);
            $table->float('success_rate')->default(0);
            $table->float('avg_response_time_ms')->nullable();
            
            // Status
            $table->boolean('is_active')->default(true);
            $table->integer('priority')->default(0); // Higher = checked first
            
            $table->timestamps();
            
            $table->index(['tenant_id', 'intent']);
            $table->index(['tenant_id', 'success_rate']);
        });

        // AI FAQ Cache - Auto-generated FAQ from conversations
        Schema::create('ai_faq_cache', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('tenant_id')->index();
            
            $table->text('question');
            $table->string('question_hash')->index(); // For quick lookup
            $table->text('answer');
            
            $table->integer('times_asked')->default(1);
            $table->integer('times_helpful')->default(0);
            $table->float('helpfulness_score')->default(0.5);
            
            $table->boolean('is_verified')->default(false);
            $table->timestamp('last_asked_at')->nullable();
            
            $table->timestamps();
            
            $table->unique(['tenant_id', 'question_hash']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_faq_cache');
        Schema::dropIfExists('ai_learning_patterns');
        Schema::dropIfExists('ai_conversation_contexts');
        Schema::dropIfExists('ai_feedback');
        Schema::dropIfExists('ai_memories');
    }
};
