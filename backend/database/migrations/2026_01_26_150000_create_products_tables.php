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
        // Product Categories
        if (!Schema::hasTable('product_categories')) {
            Schema::create('product_categories', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->string('name');
                $table->text('description')->nullable();
                $table->string('color', 7)->default('#3B82F6');
                $table->boolean('is_active')->default(true);
                $table->timestamps();
                $table->softDeletes();
            });
        }

        // Products
        if (!Schema::hasTable('products')) {
            Schema::create('products', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->string('name');
                $table->text('description')->nullable();
                $table->string('sku', 50)->nullable()->unique();
                $table->decimal('price', 15, 2)->default(0);
                $table->decimal('cost', 15, 2)->nullable();
                $table->integer('stock')->default(0);
                $table->integer('min_stock')->default(0);
                $table->foreignUuid('category_id')->nullable()->constrained('product_categories')->nullOnDelete();
                $table->string('unit', 20)->default('un');
                $table->boolean('is_active')->default(true);
                $table->json('images')->nullable();
                $table->json('attributes')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('products');
        Schema::dropIfExists('product_categories');
    }
};
