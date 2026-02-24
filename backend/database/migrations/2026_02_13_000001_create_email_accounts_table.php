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
        Schema::create('email_accounts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('email')->index();
            $table->string('provider'); // 'gmail', 'outlook', 'imap'
            $table->string('account_name');
            $table->text('access_token')->nullable(); // OAuth2
            $table->text('refresh_token')->nullable(); // OAuth2
            $table->timestamp('token_expires_at')->nullable();
            $table->json('imap_config')->nullable(); // For IMAP: host, port, encryption
            $table->json('smtp_config')->nullable(); // For SMTP: host, port, encryption
            $table->text('password')->nullable(); // Encrypted, for IMAP/SMTP
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_sync_at')->nullable();
            $table->string('sync_status')->default('pending'); // pending, syncing, synced, error
            $table->text('sync_error')->nullable();
            $table->timestamps();
            $table->softDeletes();
            
            $table->index(['tenant_id', 'email']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('email_accounts');
    }
};
