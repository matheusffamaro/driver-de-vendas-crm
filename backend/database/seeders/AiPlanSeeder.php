<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

class AiPlanSeeder extends Seeder
{
    public function run(): void
    {
        $plans = [
            [
                'name' => 'Gratuito',
                'slug' => 'free',
                'description' => 'Plano gratuito com recursos básicos de IA',
                'monthly_token_limit' => 5000,
                'daily_token_limit' => 500,
                'request_limit_per_minute' => 5,
                'ai_chat_enabled' => true,
                'ai_autofill_enabled' => false,
                'ai_summarize_enabled' => false,
                'ai_lead_analysis_enabled' => false,
                'ai_email_draft_enabled' => false,
                'knowledge_base_enabled' => false,
                'knowledge_base_docs_limit' => 0,
                'price_monthly' => 0,
                'price_yearly' => 0,
                'currency' => 'BRL',
                'sort_order' => 1,
                'is_active' => true,
                'is_featured' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Business',
                'slug' => 'business',
                'description' => 'Para empresas em crescimento com múltiplas equipes',
                'monthly_token_limit' => 500000,
                'daily_token_limit' => 50000,
                'request_limit_per_minute' => 30,
                'ai_chat_enabled' => true,
                'ai_autofill_enabled' => true,
                'ai_summarize_enabled' => true,
                'ai_lead_analysis_enabled' => true,
                'ai_email_draft_enabled' => true,
                'knowledge_base_enabled' => true,
                'knowledge_base_docs_limit' => 50,
                'price_monthly' => 199.90,
                'price_yearly' => 1918.80,
                'currency' => 'BRL',
                'sort_order' => 2,
                'is_active' => true,
                'is_featured' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Enterprise',
                'slug' => 'enterprise',
                'description' => 'Recursos ilimitados para grandes operações',
                'monthly_token_limit' => 1000000,
                'daily_token_limit' => 100000,
                'request_limit_per_minute' => 60,
                'ai_chat_enabled' => true,
                'ai_autofill_enabled' => true,
                'ai_summarize_enabled' => true,
                'ai_lead_analysis_enabled' => true,
                'ai_email_draft_enabled' => true,
                'knowledge_base_enabled' => true,
                'knowledge_base_docs_limit' => 100,
                'price_monthly' => 499.90,
                'price_yearly' => 4798.80,
                'currency' => 'BRL',
                'sort_order' => 4,
                'is_active' => true,
                'is_featured' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ];

        foreach ($plans as $planData) {
            $existingPlan = DB::table('ai_plans')->where('slug', $planData['slug'])->first();
            
            if ($existingPlan) {
                // Update existing plan without changing ID
                DB::table('ai_plans')
                    ->where('slug', $planData['slug'])
                    ->update(array_merge($planData, [
                        'updated_at' => now(),
                    ]));
            } else {
                // Insert new plan with ID
                DB::table('ai_plans')->insert(array_merge([
                    'id' => Str::uuid(),
                ], $planData, [
                    'created_at' => now(),
                    'updated_at' => now(),
                ]));
            }
        }
    }
}
