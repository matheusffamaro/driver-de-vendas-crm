<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ai_chat_agents', function (Blueprint $table) {
            $table->uuid('tenant_id')->nullable()->after('id');
            $table->index('tenant_id');
        });

        Schema::table('ai_knowledge_documents', function (Blueprint $table) {
            $table->uuid('tenant_id')->nullable()->after('id');
            $table->index('tenant_id');
        });

        Schema::table('ai_chat_logs', function (Blueprint $table) {
            $table->uuid('tenant_id')->nullable()->after('id');
            $table->index('tenant_id');
        });

        DB::statement("
            UPDATE ai_chat_agents
            SET tenant_id = (
                SELECT ws.tenant_id
                FROM whatsapp_sessions ws
                WHERE ws.id::text = ai_chat_agents.whatsapp_session_id
                LIMIT 1
            )
            WHERE whatsapp_session_id IS NOT NULL AND tenant_id IS NULL
        ");

        // If still null, assign to the first tenant
        DB::statement("
            UPDATE ai_chat_agents
            SET tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1)
            WHERE tenant_id IS NULL
        ");

        // Backfill documents and logs via their agent
        DB::statement("
            UPDATE ai_knowledge_documents
            SET tenant_id = (
                SELECT a.tenant_id FROM ai_chat_agents a WHERE a.id = ai_knowledge_documents.agent_id
            )
            WHERE tenant_id IS NULL
        ");

        DB::statement("
            UPDATE ai_chat_logs
            SET tenant_id = (
                SELECT a.tenant_id FROM ai_chat_agents a WHERE a.id = ai_chat_logs.agent_id
            )
            WHERE tenant_id IS NULL
        ");
    }

    public function down(): void
    {
        Schema::table('ai_chat_agents', function (Blueprint $table) {
            $table->dropIndex(['tenant_id']);
            $table->dropColumn('tenant_id');
        });

        Schema::table('ai_knowledge_documents', function (Blueprint $table) {
            $table->dropIndex(['tenant_id']);
            $table->dropColumn('tenant_id');
        });

        Schema::table('ai_chat_logs', function (Blueprint $table) {
            $table->dropIndex(['tenant_id']);
            $table->dropColumn('tenant_id');
        });
    }
};
