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
        Schema::create('email_addon_usage', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->integer('year');
            $table->integer('month');
            $table->integer('emails_sent')->default(0);
            $table->integer('emails_received')->default(0);
            $table->integer('total_emails')->default(0);
            $table->decimal('calculated_cost', 10, 2)->default(0);
            $table->timestamps();
            
            $table->unique(['tenant_id', 'year', 'month']);
            $table->index(['year', 'month']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('email_addon_usage');
    }
};
