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
        Schema::create('email_campaign_tracking_links', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('email_campaign_recipient_id')->constrained()->cascadeOnDelete();
            $table->string('link_hash', 64)->index(); // stable id for the link (e.g. hash of original URL)
            $table->text('original_url');
            $table->timestamps();

            $table->unique(['email_campaign_recipient_id', 'link_hash']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('email_campaign_tracking_links');
    }
};
