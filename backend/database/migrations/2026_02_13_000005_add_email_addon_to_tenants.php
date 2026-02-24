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
            $table->boolean('email_addon_enabled')->default(false)->after('settings');
            $table->timestamp('email_addon_activated_at')->nullable()->after('email_addon_enabled');
            $table->string('email_addon_tier')->nullable()->after('email_addon_activated_at'); // tier-1000, tier-5000, tier-15000, tier-unlimited
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn(['email_addon_enabled', 'email_addon_activated_at', 'email_addon_tier']);
        });
    }
};
