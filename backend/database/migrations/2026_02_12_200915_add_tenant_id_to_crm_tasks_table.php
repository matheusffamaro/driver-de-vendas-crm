<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Step 1: Add nullable tenant_id column
        Schema::table('crm_tasks', function (Blueprint $table) {
            $table->uuid('tenant_id')->nullable()->after('id');
            $table->index('tenant_id');
        });

        // Step 2: Backfill tenant_id from related card or contact
        DB::statement("
            UPDATE crm_tasks t
            SET tenant_id = COALESCE(
                (SELECT c.tenant_id 
                 FROM pipeline_cards c 
                 WHERE c.id = t.card_id 
                 LIMIT 1),
                (SELECT cl.tenant_id 
                 FROM clients cl 
                 WHERE cl.id = t.contact_id 
                 LIMIT 1)
            )
            WHERE tenant_id IS NULL
        ");

        // Step 2.5: For orphaned tasks (no card, no contact), use first active tenant
        DB::statement("
            UPDATE crm_tasks
            SET tenant_id = (SELECT id FROM tenants WHERE is_active = true ORDER BY created_at LIMIT 1)
            WHERE tenant_id IS NULL
        ");

        // Step 3: Make tenant_id required and add foreign key
        Schema::table('crm_tasks', function (Blueprint $table) {
            $table->uuid('tenant_id')->nullable(false)->change();
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('crm_tasks', function (Blueprint $table) {
            $table->dropForeign(['tenant_id']);
            $table->dropIndex(['tenant_id']);
            $table->dropColumn('tenant_id');
        });
    }
};
