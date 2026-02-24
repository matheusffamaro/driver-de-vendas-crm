<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // AI Plans - define token limits for each plan
        Schema::create('ai_plans', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name'); // Free, Starter, Professional, Enterprise
            $table->string('slug')->unique(); // free, starter, pro, enterprise
            $table->text('description')->nullable();
            
            // Token Limits
            $table->integer('monthly_token_limit')->default(10000); // Total tokens per month
            $table->integer('daily_token_limit')->default(1000); // Daily cap
            $table->integer('request_limit_per_minute')->default(10); // Rate limiting
            
            // Feature Flags
            $table->boolean('ai_chat_enabled')->default(true);
            $table->boolean('ai_autofill_enabled')->default(true);
            $table->boolean('ai_summarize_enabled')->default(false);
            $table->boolean('ai_lead_analysis_enabled')->default(false);
            $table->boolean('ai_email_draft_enabled')->default(false);
            $table->boolean('knowledge_base_enabled')->default(false);
            $table->integer('knowledge_base_docs_limit')->default(0);
            
            // Pricing
            $table->decimal('price_monthly', 10, 2)->default(0);
            $table->decimal('price_yearly', 10, 2)->default(0);
            $table->string('currency', 3)->default('BRL');
            
            // Display
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->boolean('is_featured')->default(false);
            
            $table->timestamps();
        });

        // Token Usage Tracking
        Schema::create('ai_token_usage', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->nullable()->index(); // For multi-tenant
            $table->uuid('user_id')->nullable()->index();
            
            // Usage tracking
            $table->string('feature'); // chat, autofill, summarize, etc.
            $table->integer('prompt_tokens')->default(0);
            $table->integer('completion_tokens')->default(0);
            $table->integer('total_tokens')->default(0);
            
            // Request details
            $table->string('model')->nullable();
            $table->boolean('cache_hit')->default(false);
            $table->integer('response_time_ms')->nullable();
            
            // Period tracking
            $table->date('usage_date')->index();
            $table->integer('year_month')->index(); // YYYYMM format for easy querying
            
            $table->timestamps();
            
            // Index for efficient querying
            $table->index(['tenant_id', 'usage_date']);
            $table->index(['tenant_id', 'year_month']);
        });

        // Tenant Plan Assignment
        Schema::create('ai_tenant_plans', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->unique();
            $table->uuid('plan_id');
            
            // Subscription details
            $table->timestamp('started_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->string('status')->default('active'); // active, suspended, cancelled
            
            // Token overrides (optional per-tenant customization)
            $table->integer('custom_monthly_limit')->nullable();
            $table->integer('custom_daily_limit')->nullable();
            
            // Usage summary (cached for performance)
            $table->integer('tokens_used_this_month')->default(0);
            $table->integer('tokens_used_today')->default(0);
            $table->date('last_reset_date')->nullable();
            
            $table->timestamps();
            
            $table->foreign('plan_id')->references('id')->on('ai_plans');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_tenant_plans');
        Schema::dropIfExists('ai_token_usage');
        Schema::dropIfExists('ai_plans');
    }
};
