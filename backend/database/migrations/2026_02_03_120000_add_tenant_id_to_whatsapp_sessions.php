<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('whatsapp_sessions', 'tenant_id')) {
            Schema::table('whatsapp_sessions', function (Blueprint $table) {
                $table->uuid('tenant_id')->nullable()->after('id')->index();
                $table->foreign('tenant_id')->references('id')->on('tenants')->nullOnDelete();
            });

            // Backfill existing sessions to the first tenant (single-tenant default).
            try {
                $tenantId = DB::table('tenants')->orderBy('created_at')->value('id');
                if ($tenantId) {
                    DB::table('whatsapp_sessions')
                        ->whereNull('tenant_id')
                        ->update(['tenant_id' => $tenantId]);
                }
            } catch (\Throwable $e) {
                // Ignore backfill errors (migration should not fail due to data)
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('whatsapp_sessions', 'tenant_id')) {
            Schema::table('whatsapp_sessions', function (Blueprint $table) {
                $table->dropForeign(['tenant_id']);
                $table->dropIndex(['tenant_id']);
                $table->dropColumn('tenant_id');
            });
        }
    }
};

