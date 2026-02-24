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
        Schema::table('whatsapp_messages', function (Blueprint $table) {
            $table->string('sender_name')->nullable()->after('sender_id');
            $table->string('sender_phone')->nullable()->after('sender_name');
        });

        Schema::table('whatsapp_conversations', function (Blueprint $table) {
            $table->boolean('is_group')->default(false)->after('remote_jid');
            $table->string('group_name')->nullable()->after('is_group');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('whatsapp_messages', function (Blueprint $table) {
            $table->dropColumn(['sender_name', 'sender_phone']);
        });

        Schema::table('whatsapp_conversations', function (Blueprint $table) {
            $table->dropColumn(['is_group', 'group_name']);
        });
    }
};
