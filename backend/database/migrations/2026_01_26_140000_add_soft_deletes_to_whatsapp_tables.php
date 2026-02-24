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
        // Add soft deletes to whatsapp_conversations if not exists
        if (!Schema::hasColumn('whatsapp_conversations', 'deleted_at')) {
            Schema::table('whatsapp_conversations', function (Blueprint $table) {
                $table->softDeletes();
            });
        }

        // Add soft deletes to whatsapp_messages if not exists
        if (!Schema::hasColumn('whatsapp_messages', 'deleted_at')) {
            Schema::table('whatsapp_messages', function (Blueprint $table) {
                $table->softDeletes();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('whatsapp_conversations', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });

        Schema::table('whatsapp_messages', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};
