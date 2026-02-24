<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Tabela de logs de uso de IA para monitoramento de custos
        if (!Schema::hasTable('ai_usage_logs')) {
            Schema::create('ai_usage_logs', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('tenant_id')->index();
                $table->uuid('user_id')->nullable()->index();
                $table->string('feature')->index(); // chat, autofill, summarize, etc
                $table->string('model')->default('llama-3.3-70b-versatile');
                $table->integer('prompt_tokens')->default(0);
                $table->integer('completion_tokens')->default(0);
                $table->integer('tokens_used')->default(0);
                $table->boolean('cache_hit')->default(false);
                $table->json('metadata')->nullable();
                $table->timestamps();
                
                $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            });
        }
        
        // Adicionar coluna price na tabela plans se não existir
        if (Schema::hasTable('plans') && !Schema::hasColumn('plans', 'price')) {
            Schema::table('plans', function (Blueprint $table) {
                $table->decimal('price', 10, 2)->default(0)->after('name');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_usage_logs');
        
        if (Schema::hasTable('plans') && Schema::hasColumn('plans', 'price')) {
            Schema::table('plans', function (Blueprint $table) {
                $table->dropColumn('price');
            });
        }
    }
};
