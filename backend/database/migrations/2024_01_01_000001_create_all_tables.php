<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Users
        Schema::create('users', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->string('role')->default('user'); // admin, manager, user
            $table->string('avatar')->nullable();
            $table->string('phone')->nullable();
            $table->boolean('is_active')->default(true);
            $table->rememberToken();
            $table->timestamps();
        });

        // Password reset tokens
        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        // Sessions
        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignUuid('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });

        // Clients
        Schema::create('clients', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->string('document')->nullable();
            $table->string('document_type')->nullable(); // cpf, cnpj, other
            $table->text('address')->nullable();
            $table->string('city')->nullable();
            $table->string('state')->nullable();
            $table->string('zip_code')->nullable();
            $table->string('country')->nullable();
            $table->text('notes')->nullable();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->json('tags')->nullable();
            $table->json('custom_fields')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        // Product Categories
        Schema::create('product_categories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('color')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        // Products
        Schema::create('products', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('sku')->nullable();
            $table->decimal('price', 15, 2)->default(0);
            $table->decimal('cost', 15, 2)->nullable();
            $table->integer('stock')->nullable();
            $table->foreignUuid('category_id')->nullable()->constrained('product_categories')->nullOnDelete();
            $table->string('unit')->nullable();
            $table->boolean('is_active')->default(true);
            $table->json('images')->nullable();
            $table->json('attributes')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        // Pipelines
        Schema::create('pipelines', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('is_default')->default(false);
            $table->timestamps();
            $table->softDeletes();
        });

        // Pipeline Stages
        Schema::create('pipeline_stages', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('pipeline_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('color')->nullable();
            $table->integer('position')->default(0);
            $table->boolean('is_won')->default(false);
            $table->boolean('is_lost')->default(false);
            $table->timestamps();
        });

        // Pipeline Custom Fields
        Schema::create('pipeline_custom_fields', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('pipeline_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('field_key');
            $table->string('type'); // text, number, date, select, checkbox
            $table->json('options')->nullable();
            $table->boolean('is_required')->default(false);
            $table->integer('position')->default(0);
            $table->timestamps();
        });

        // Pipeline Cards
        Schema::create('pipeline_cards', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('pipeline_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('stage_id')->constrained('pipeline_stages')->cascadeOnDelete();
            $table->foreignUuid('contact_id')->nullable()->constrained('clients')->nullOnDelete();
            $table->foreignUuid('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->decimal('value', 15, 2)->default(0);
            $table->integer('position')->default(0);
            $table->string('priority')->default('medium'); // low, medium, high, urgent
            $table->date('expected_close_date')->nullable();
            $table->timestamp('won_at')->nullable();
            $table->timestamp('lost_at')->nullable();
            $table->text('lost_reason')->nullable();
            $table->json('custom_fields')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        // Pipeline Card Products
        Schema::create('pipeline_card_products', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('card_id')->constrained('pipeline_cards')->cascadeOnDelete();
            $table->foreignUuid('product_id')->constrained()->cascadeOnDelete();
            $table->decimal('quantity', 15, 2)->default(1);
            $table->decimal('unit_price', 15, 2)->default(0);
            $table->decimal('discount', 15, 2)->default(0);
            $table->decimal('total', 15, 2)->default(0);
            $table->timestamps();
        });

        // Pipeline Card History
        Schema::create('pipeline_card_histories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('card_id')->constrained('pipeline_cards')->cascadeOnDelete();
            $table->foreignUuid('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action'); // created, moved, updated, won, lost
            $table->foreignUuid('from_stage_id')->nullable()->constrained('pipeline_stages')->nullOnDelete();
            $table->foreignUuid('to_stage_id')->nullable()->constrained('pipeline_stages')->nullOnDelete();
            $table->json('changes')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        // CRM Tasks
        Schema::create('crm_tasks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('card_id')->nullable()->constrained('pipeline_cards')->cascadeOnDelete();
            $table->foreignUuid('contact_id')->nullable()->constrained('clients')->nullOnDelete();
            $table->foreignUuid('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('type')->default('task'); // task, call, meeting, email, follow_up
            $table->string('status')->default('pending'); // pending, in_progress, completed, cancelled
            $table->string('priority')->default('medium'); // low, medium, high, urgent
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('reminder_at')->nullable();
            $table->integer('duration_minutes')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        // CRM Task Attachments
        Schema::create('crm_task_attachments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('task_id')->constrained('crm_tasks')->cascadeOnDelete();
            $table->string('filename');
            $table->string('original_filename');
            $table->string('mime_type')->nullable();
            $table->integer('size')->nullable();
            $table->string('path');
            $table->timestamps();
        });

        // WhatsApp Sessions
        Schema::create('whatsapp_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('phone_number');
            $table->string('session_name')->nullable();
            $table->string('status')->default('disconnected'); // disconnected, connecting, qr_code, connected
            $table->text('qr_code')->nullable();
            $table->timestamp('connected_at')->nullable();
            $table->timestamp('last_activity_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        // WhatsApp Conversations
        Schema::create('whatsapp_conversations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('session_id')->constrained('whatsapp_sessions')->cascadeOnDelete();
            $table->string('remote_jid');
            $table->string('contact_phone');
            $table->string('contact_name')->nullable();
            $table->string('profile_picture')->nullable();
            $table->foreignUuid('contact_id')->nullable()->constrained('clients')->nullOnDelete();
            $table->foreignUuid('assigned_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('is_pinned')->default(false);
            $table->boolean('is_archived')->default(false);
            $table->integer('unread_count')->default(0);
            $table->timestamp('last_message_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['session_id', 'remote_jid']);
        });

        // WhatsApp Messages
        Schema::create('whatsapp_messages', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('conversation_id')->constrained('whatsapp_conversations')->cascadeOnDelete();
            $table->string('message_id')->nullable();
            $table->string('direction'); // incoming, outgoing
            $table->string('type')->default('text'); // text, image, video, audio, document, sticker, location, contact
            $table->text('content')->nullable();
            $table->string('media_url')->nullable();
            $table->string('media_filename')->nullable();
            $table->string('media_mimetype')->nullable();
            $table->string('status')->default('pending'); // pending, sent, delivered, read, failed
            $table->foreignUuid('sender_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });

        // WhatsApp Quick Replies
        Schema::create('whatsapp_quick_replies', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('shortcut');
            $table->string('title');
            $table->text('content');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // WhatsApp Assignment Queues
        Schema::create('whatsapp_assignment_queues', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('session_id')->constrained('whatsapp_sessions')->cascadeOnDelete();
            $table->string('name');
            $table->json('user_ids')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('whatsapp_assignment_queues');
        Schema::dropIfExists('whatsapp_quick_replies');
        Schema::dropIfExists('whatsapp_messages');
        Schema::dropIfExists('whatsapp_conversations');
        Schema::dropIfExists('whatsapp_sessions');
        Schema::dropIfExists('crm_task_attachments');
        Schema::dropIfExists('crm_tasks');
        Schema::dropIfExists('pipeline_card_histories');
        Schema::dropIfExists('pipeline_card_products');
        Schema::dropIfExists('pipeline_cards');
        Schema::dropIfExists('pipeline_custom_fields');
        Schema::dropIfExists('pipeline_stages');
        Schema::dropIfExists('pipelines');
        Schema::dropIfExists('products');
        Schema::dropIfExists('product_categories');
        Schema::dropIfExists('clients');
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('users');
    }
};
