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
        Schema::create('email_threads', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('email_account_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('thread_id')->index(); // Provider's thread ID
            $table->string('subject');
            $table->text('snippet')->nullable(); // Preview text
            $table->json('participants'); // Array of email addresses
            $table->foreignUuid('linked_contact_id')->nullable()->constrained('clients')->nullOnDelete();
            $table->foreignUuid('linked_pipeline_card_id')->nullable()->constrained('pipeline_cards')->nullOnDelete();
            $table->boolean('is_read')->default(false);
            $table->boolean('is_archived')->default(false);
            $table->boolean('is_starred')->default(false);
            $table->json('labels')->nullable(); // Gmail labels or custom tags
            $table->timestamp('last_message_at')->index();
            $table->timestamps();
            $table->softDeletes();
            
            $table->index(['email_account_id', 'thread_id']);
            $table->index(['tenant_id', 'last_message_at']);
            $table->index(['linked_contact_id']);
            $table->index(['linked_pipeline_card_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('email_threads');
    }
};
