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
            $table->boolean('pipelines_addon_enabled')->default(false)->after('email_addon_tier');
            $table->timestamp('pipelines_addon_activated_at')->nullable()->after('pipelines_addon_enabled');
            $table->integer('pipelines_count')->default(0)->after('pipelines_addon_activated_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn(['pipelines_addon_enabled', 'pipelines_addon_activated_at', 'pipelines_count']);
        });
    }
};
