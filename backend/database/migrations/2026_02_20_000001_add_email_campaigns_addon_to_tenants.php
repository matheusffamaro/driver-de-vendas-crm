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
        Schema::table('tenants', function (Blueprint $table) {
            $table->boolean('email_campaigns_addon_enabled')->default(false)->after('pipelines_count');
            $table->timestamp('email_campaigns_addon_activated_at')->nullable()->after('email_campaigns_addon_enabled');
            $table->string('email_campaigns_addon_leads_tier', 32)->nullable()->after('email_campaigns_addon_activated_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn([
                'email_campaigns_addon_enabled',
                'email_campaigns_addon_activated_at',
                'email_campaigns_addon_leads_tier',
            ]);
        });
    }
};
