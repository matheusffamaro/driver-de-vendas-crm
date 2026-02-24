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
        Schema::table('product_categories', function (Blueprint $table) {
            $table->uuid('tenant_id')->nullable()->after('id');
            $table->index('tenant_id');
        });

        // Step 2: Backfill tenant_id from products using this category
        DB::statement("
            UPDATE product_categories pc
            SET tenant_id = (
                SELECT p.tenant_id 
                FROM products p 
                WHERE p.category_id = pc.id 
                LIMIT 1
            )
            WHERE tenant_id IS NULL
        ");

        // Step 3: For categories without products, assign to first active tenant
        DB::statement("
            UPDATE product_categories
            SET tenant_id = (SELECT id FROM tenants WHERE is_active = true ORDER BY created_at LIMIT 1)
            WHERE tenant_id IS NULL
        ");

        // Step 4: Make tenant_id required and add foreign key
        Schema::table('product_categories', function (Blueprint $table) {
            $table->uuid('tenant_id')->nullable(false)->change();
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('product_categories', function (Blueprint $table) {
            $table->dropForeign(['tenant_id']);
            $table->dropIndex(['tenant_id']);
            $table->dropColumn('tenant_id');
        });
    }
};
