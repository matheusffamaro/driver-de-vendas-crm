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
        Schema::create('email_messages', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('email_thread_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('email_account_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('message_id')->index(); // Provider's message ID
            $table->string('from_email');
            $table->string('from_name')->nullable();
            $table->json('to'); // Array of {email, name}
            $table->json('cc')->nullable();
            $table->json('bcc')->nullable();
            $table->string('subject');
            $table->longText('body_text')->nullable(); // Plain text (stored)
            $table->longText('body_html')->nullable(); // HTML (stored for offline, cache)
            $table->json('attachments')->nullable(); // [{name, size, type, url, message_attachment_id}]
            $table->boolean('is_draft')->default(false);
            $table->boolean('is_sent')->default(false);
            $table->boolean('is_read')->default(false);
            $table->timestamp('sent_at')->nullable()->index();
            $table->timestamp('received_at')->nullable();
            $table->foreignUuid('sent_by_user_id')->nullable()->constrained('users')->nullOnDelete(); // If sent via CRM
            $table->json('tracking')->nullable(); // {opened_at, clicked_at, opens_count, clicks_count}
            $table->timestamps();
            $table->softDeletes();
            
            $table->index(['email_account_id', 'message_id']);
            $table->index(['tenant_id', 'sent_at']);
            $table->index(['from_email']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('email_messages');
    }
};
