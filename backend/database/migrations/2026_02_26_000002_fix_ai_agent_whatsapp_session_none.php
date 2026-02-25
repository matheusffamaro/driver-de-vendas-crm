<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Agents with null whatsapp_session_id that are inactive should be 'none'
        DB::table('ai_chat_agents')
            ->whereNull('whatsapp_session_id')
            ->where('is_active', false)
            ->update(['whatsapp_session_id' => 'none']);
    }

    public function down(): void
    {
        DB::table('ai_chat_agents')
            ->where('whatsapp_session_id', 'none')
            ->update(['whatsapp_session_id' => null]);
    }
};
