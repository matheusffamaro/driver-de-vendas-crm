<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Adds composite indexes for frequently queried combinations
     * to improve performance on critical queries.
     */
    public function up(): void
    {
        // Users: frequently filtered by tenant and status
        Schema::table('users', function (Blueprint $table) {
            $table->index(['tenant_id', 'is_active'], 'idx_users_tenant_active');
            $table->index(['tenant_id', 'role_id'], 'idx_users_tenant_role');
            $table->index(['tenant_id', 'email'], 'idx_users_tenant_email');
        });

        // Clients: frequently filtered by tenant and type/status
        Schema::table('clients', function (Blueprint $table) {
            $table->index(['tenant_id', 'type'], 'idx_clients_tenant_type');
            $table->index(['tenant_id', 'status'], 'idx_clients_tenant_status');
            $table->index(['tenant_id', 'created_at'], 'idx_clients_tenant_created');
        });

        // Pipeline Cards: frequently filtered by tenant, pipeline, and stage
        Schema::table('pipeline_cards', function (Blueprint $table) {
            $table->index(['tenant_id', 'pipeline_id'], 'idx_cards_tenant_pipeline');
            $table->index(['tenant_id', 'stage_id'], 'idx_cards_tenant_stage');
            $table->index(['tenant_id', 'pipeline_id', 'stage_id'], 'idx_cards_tenant_pipeline_stage');
            $table->index(['tenant_id', 'won_at'], 'idx_cards_tenant_won');
            $table->index(['tenant_id', 'created_at'], 'idx_cards_tenant_created');
        });

        // CRM Tasks: frequently filtered by tenant, status, and dates
        Schema::table('crm_tasks', function (Blueprint $table) {
            $table->index(['tenant_id', 'status'], 'idx_tasks_tenant_status');
            $table->index(['tenant_id', 'scheduled_at'], 'idx_tasks_tenant_scheduled');
            $table->index(['tenant_id', 'assigned_to'], 'idx_tasks_tenant_assigned');
        });

        // Products: frequently filtered by tenant and category
        Schema::table('products', function (Blueprint $table) {
            $table->index(['tenant_id', 'category_id'], 'idx_products_tenant_category');
            $table->index(['tenant_id', 'is_active'], 'idx_products_tenant_active');
            $table->index(['tenant_id', 'type'], 'idx_products_tenant_type');
        });

        // WhatsApp Sessions: frequently filtered by tenant and status
        Schema::table('whatsapp_sessions', function (Blueprint $table) {
            $table->index(['tenant_id', 'status'], 'idx_whatsapp_tenant_status');
        });

        // WhatsApp Conversations: frequently filtered by session and updated_at
        if (Schema::hasTable('whatsapp_conversations')) {
            Schema::table('whatsapp_conversations', function (Blueprint $table) {
                $table->index(['session_id', 'updated_at'], 'idx_conversations_session_updated');
                $table->index(['session_id', 'is_archived'], 'idx_conversations_session_archived');
            });
        }

        // WhatsApp Messages: frequently filtered by conversation and created_at
        if (Schema::hasTable('whatsapp_messages')) {
            Schema::table('whatsapp_messages', function (Blueprint $table) {
                // Check column exists before creating index
                if (Schema::hasColumn('whatsapp_messages', 'created_at')) {
                    $table->index(['conversation_id', 'created_at'], 'idx_messages_conv_created');
                }
                if (Schema::hasColumn('whatsapp_messages', 'direction')) {
                    $table->index(['conversation_id', 'direction'], 'idx_messages_conv_direction');
                }
            });
        }

        // Email Messages: frequently filtered by thread and dates
        if (Schema::hasTable('email_messages')) {
            Schema::table('email_messages', function (Blueprint $table) {
                // Check columns exist before creating indexes
                if (Schema::hasColumn('email_messages', 'email_thread_id')) {
                    $table->index(['email_thread_id', 'created_at'], 'idx_email_messages_thread_created');
                    if (Schema::hasColumn('email_messages', 'is_read')) {
                        $table->index(['email_thread_id', 'is_read'], 'idx_email_messages_thread_read');
                    }
                }
            });
        }

        // Paypal Payments: frequently filtered by tenant and status
        if (Schema::hasTable('paypal_payments')) {
            Schema::table('paypal_payments', function (Blueprint $table) {
                $table->index(['tenant_id', 'status'], 'idx_paypal_tenant_status');
                $table->index(['tenant_id', 'paid_at'], 'idx_paypal_tenant_paid');
            });
        }

        // Subscriptions: frequently filtered by tenant and status
        if (Schema::hasTable('subscriptions')) {
            Schema::table('subscriptions', function (Blueprint $table) {
                $table->index(['tenant_id', 'status'], 'idx_subscriptions_tenant_status');
                $table->index(['tenant_id', 'ends_at'], 'idx_subscriptions_tenant_ends');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('idx_users_tenant_active');
            $table->dropIndex('idx_users_tenant_role');
            $table->dropIndex('idx_users_tenant_email');
        });

        Schema::table('clients', function (Blueprint $table) {
            $table->dropIndex('idx_clients_tenant_type');
            $table->dropIndex('idx_clients_tenant_status');
            $table->dropIndex('idx_clients_tenant_created');
        });

        Schema::table('pipeline_cards', function (Blueprint $table) {
            $table->dropIndex('idx_cards_tenant_pipeline');
            $table->dropIndex('idx_cards_tenant_stage');
            $table->dropIndex('idx_cards_tenant_pipeline_stage');
            $table->dropIndex('idx_cards_tenant_won');
            $table->dropIndex('idx_cards_tenant_created');
        });

        Schema::table('crm_tasks', function (Blueprint $table) {
            $table->dropIndex('idx_tasks_tenant_status');
            $table->dropIndex('idx_tasks_tenant_scheduled');
            $table->dropIndex('idx_tasks_tenant_assigned');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex('idx_products_tenant_category');
            $table->dropIndex('idx_products_tenant_active');
            $table->dropIndex('idx_products_tenant_type');
        });

        Schema::table('whatsapp_sessions', function (Blueprint $table) {
            $table->dropIndex('idx_whatsapp_tenant_status');
        });

        if (Schema::hasTable('whatsapp_conversations')) {
            Schema::table('whatsapp_conversations', function (Blueprint $table) {
                $table->dropIndex('idx_conversations_session_updated');
                $table->dropIndex('idx_conversations_session_archived');
            });
        }

        if (Schema::hasTable('whatsapp_messages')) {
            Schema::table('whatsapp_messages', function (Blueprint $table) {
                if (Schema::hasColumn('whatsapp_messages', 'created_at')) {
                    $table->dropIndex('idx_messages_conv_created');
                }
                if (Schema::hasColumn('whatsapp_messages', 'direction')) {
                    $table->dropIndex('idx_messages_conv_direction');
                }
            });
        }

        if (Schema::hasTable('email_messages')) {
            Schema::table('email_messages', function (Blueprint $table) {
                // Safe index dropping
                try {
                    $table->dropIndex('idx_email_messages_thread_created');
                } catch (\Exception $e) {}
                try {
                    $table->dropIndex('idx_email_messages_thread_read');
                } catch (\Exception $e) {}
            });
        }

        if (Schema::hasTable('paypal_payments')) {
            Schema::table('paypal_payments', function (Blueprint $table) {
                $table->dropIndex('idx_paypal_tenant_status');
                $table->dropIndex('idx_paypal_tenant_paid');
            });
        }

        if (Schema::hasTable('subscriptions')) {
            Schema::table('subscriptions', function (Blueprint $table) {
                $table->dropIndex('idx_subscriptions_tenant_status');
                $table->dropIndex('idx_subscriptions_tenant_ends');
            });
        }
    }
};
