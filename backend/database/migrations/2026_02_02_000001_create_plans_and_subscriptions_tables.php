<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Models\Plan;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Create tenants table
        if (!Schema::hasTable('tenants')) {
            Schema::create('tenants', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->string('name');
                $table->string('slug')->unique();
                $table->string('document')->nullable();
                $table->string('email')->nullable();
                $table->string('phone', 20)->nullable();
                $table->string('logo_url')->nullable();
                $table->json('address')->nullable();
                $table->json('settings')->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }

        // Add tenant_id to users if not exists
        if (!Schema::hasColumn('users', 'tenant_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->uuid('tenant_id')->nullable()->after('id');
                $table->foreign('tenant_id')->references('id')->on('tenants')->nullOnDelete();
            });
        }

        // Create plans table
        if (!Schema::hasTable('plans')) {
            Schema::create('plans', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->string('name');
                $table->string('slug')->unique();
                $table->text('description')->nullable();
                $table->decimal('price_monthly', 10, 2)->default(0);
                $table->decimal('price_yearly', 10, 2)->default(0);
                $table->decimal('base_price_monthly', 10, 2)->nullable();
                $table->decimal('base_price_yearly', 10, 2)->nullable();
                $table->integer('max_users')->default(3);
                $table->integer('max_clients')->default(100);
                $table->integer('max_transactions')->default(500);
                $table->integer('included_users')->default(3);
                $table->integer('included_clients')->default(100);
                $table->integer('included_products')->default(50);
                $table->integer('included_transactions')->default(500);
                $table->boolean('has_dynamic_pricing')->default(false);
                $table->integer('trial_days')->default(0);
                $table->integer('sort_order')->default(0);
                $table->json('features')->nullable();
                $table->boolean('is_active')->default(true);
                $table->string('paypal_plan_id_monthly')->nullable();
                $table->string('paypal_plan_id_yearly')->nullable();
                $table->timestamps();
            });
        }

        // Create plan_features table
        if (!Schema::hasTable('plan_features')) {
            Schema::create('plan_features', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('plan_id');
                $table->string('feature_key');
                $table->string('feature_name');
                $table->text('description')->nullable();
                $table->string('value_type')->default('boolean'); // boolean, number, string
                $table->string('value')->nullable();
                $table->integer('sort_order')->default(0);
                $table->boolean('is_active')->default(true);
                $table->timestamps();

                $table->foreign('plan_id')->references('id')->on('plans')->cascadeOnDelete();
            });
        }

        // Create pricing_tiers table
        if (!Schema::hasTable('pricing_tiers')) {
            Schema::create('pricing_tiers', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->string('resource_type'); // users, clients, products, transactions
                $table->integer('min_quantity');
                $table->integer('max_quantity')->default(-1); // -1 = unlimited
                $table->decimal('price_per_unit', 10, 2)->default(0);
                $table->decimal('flat_price', 10, 2)->default(0);
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }

        // Create subscriptions table
        if (!Schema::hasTable('subscriptions')) {
            Schema::create('subscriptions', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('tenant_id');
                $table->uuid('plan_id');
                $table->string('status')->default('active'); // active, trial, cancelled, expired, suspended
                $table->timestamp('trial_ends_at')->nullable();
                $table->timestamp('starts_at')->nullable();
                $table->timestamp('ends_at')->nullable();
                $table->timestamp('cancelled_at')->nullable();
                $table->string('payment_method')->nullable();
                $table->string('billing_cycle')->default('monthly'); // monthly, yearly
                $table->string('paypal_subscription_id')->nullable();
                $table->integer('current_users')->default(0);
                $table->integer('current_clients')->default(0);
                $table->integer('current_products')->default(0);
                $table->integer('current_transactions')->default(0);
                $table->decimal('calculated_price', 10, 2)->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
                $table->foreign('plan_id')->references('id')->on('plans')->cascadeOnDelete();
            });
        }

        // Create paypal_payments table
        if (!Schema::hasTable('paypal_payments')) {
            Schema::create('paypal_payments', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('tenant_id');
                $table->uuid('subscription_id')->nullable();
                $table->string('paypal_order_id')->nullable();
                $table->string('paypal_subscription_id')->nullable();
                $table->string('paypal_payer_id')->nullable();
                $table->string('paypal_payer_email')->nullable();
                $table->string('type')->default('one_time'); // one_time, subscription
                $table->string('status')->default('pending'); // pending, completed, failed, refunded
                $table->decimal('amount', 10, 2)->default(0);
                $table->string('currency', 3)->default('BRL');
                $table->json('paypal_response')->nullable();
                $table->timestamp('paid_at')->nullable();
                $table->timestamps();

                $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
                $table->foreign('subscription_id')->references('id')->on('subscriptions')->nullOnDelete();
            });
        }

        // Create paypal_webhooks table
        if (!Schema::hasTable('paypal_webhooks')) {
            Schema::create('paypal_webhooks', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->string('webhook_id');
                $table->string('event_type');
                $table->string('resource_type')->nullable();
                $table->string('resource_id')->nullable();
                $table->json('payload')->nullable();
                $table->string('status')->default('pending'); // pending, processed, failed
                $table->text('error_message')->nullable();
                $table->timestamp('processed_at')->nullable();
                $table->timestamps();
            });
        }

        // Add tenant_id to clients if not exists
        if (!Schema::hasColumn('clients', 'tenant_id')) {
            Schema::table('clients', function (Blueprint $table) {
                $table->uuid('tenant_id')->nullable()->after('id');
                $table->foreign('tenant_id')->references('id')->on('tenants')->nullOnDelete();
            });
        }

        // Add tenant_id to products if not exists
        if (!Schema::hasColumn('products', 'tenant_id')) {
            Schema::table('products', function (Blueprint $table) {
                $table->uuid('tenant_id')->nullable()->after('id');
                $table->foreign('tenant_id')->references('id')->on('tenants')->nullOnDelete();
            });
        }

        // Add tenant_id to pipeline_cards if not exists
        if (!Schema::hasColumn('pipeline_cards', 'tenant_id')) {
            Schema::table('pipeline_cards', function (Blueprint $table) {
                $table->uuid('tenant_id')->nullable()->after('id');
                $table->foreign('tenant_id')->references('id')->on('tenants')->nullOnDelete();
            });
        }

        // Seed default plans
        $this->seedDefaultPlans();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Drop foreign keys first
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'tenant_id')) {
                $table->dropForeign(['tenant_id']);
                $table->dropColumn('tenant_id');
            }
        });

        Schema::table('clients', function (Blueprint $table) {
            if (Schema::hasColumn('clients', 'tenant_id')) {
                $table->dropForeign(['tenant_id']);
                $table->dropColumn('tenant_id');
            }
        });

        Schema::table('products', function (Blueprint $table) {
            if (Schema::hasColumn('products', 'tenant_id')) {
                $table->dropForeign(['tenant_id']);
                $table->dropColumn('tenant_id');
            }
        });

        Schema::table('pipeline_cards', function (Blueprint $table) {
            if (Schema::hasColumn('pipeline_cards', 'tenant_id')) {
                $table->dropForeign(['tenant_id']);
                $table->dropColumn('tenant_id');
            }
        });

        Schema::dropIfExists('paypal_webhooks');
        Schema::dropIfExists('paypal_payments');
        Schema::dropIfExists('subscriptions');
        Schema::dropIfExists('pricing_tiers');
        Schema::dropIfExists('plan_features');
        Schema::dropIfExists('plans');
        Schema::dropIfExists('tenants');
    }

    /**
     * Seed default plans.
     */
    private function seedDefaultPlans(): void
    {
        $sortOrder = 1;
        foreach (Plan::PLANS as $slug => $planData) {
            if (!Plan::where('slug', $slug)->exists()) {
                Plan::create(array_merge($planData, [
                    'slug' => $slug,
                    'sort_order' => $sortOrder++,
                ]));
            }
        }
    }
};
