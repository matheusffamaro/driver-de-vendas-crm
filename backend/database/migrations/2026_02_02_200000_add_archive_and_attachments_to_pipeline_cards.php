<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add is_archived to pipeline_cards
        Schema::table('pipeline_cards', function (Blueprint $table) {
            $table->boolean('is_archived')->default(false)->after('metadata');
            $table->timestamp('archived_at')->nullable()->after('is_archived');
        });

        // Create attachments table
        Schema::create('pipeline_card_attachments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('card_id')->constrained('pipeline_cards')->onDelete('cascade');
            $table->foreignUuid('uploaded_by')->nullable()->constrained('users')->onDelete('set null');
            $table->string('filename');
            $table->string('original_name');
            $table->string('mime_type');
            $table->bigInteger('size'); // bytes
            $table->string('path');
            $table->string('disk')->default('local');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pipeline_card_attachments');
        
        Schema::table('pipeline_cards', function (Blueprint $table) {
            $table->dropColumn(['is_archived', 'archived_at']);
        });
    }
};
