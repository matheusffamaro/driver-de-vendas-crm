<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('client_custom_fields')) {
            Schema::create('client_custom_fields', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('tenant_id')->nullable()->index();
                $table->string('name');
                $table->string('field_key');
                $table->string('type')->default('text'); // text, number, date, select
                $table->json('options')->nullable();
                $table->boolean('is_required')->default(false);
                $table->integer('position')->default(0);
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('client_custom_fields');
    }
};
