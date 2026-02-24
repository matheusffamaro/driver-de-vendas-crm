<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;
use App\Models\Tenant;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\AiPlan;
use App\Models\AiTenantPlan;

class ActivateTenantAllForTestsCommand extends Command
{
    protected $signature = 'tenant:activate-all-for-tests
                            {slug? : Slug do tenant (opcional)}
                            {--email= : E-mail do usuário admin (ex: admin@crm.com) — ativa o tenant desse usuário}';

    protected $description = 'Ativa plano pago e todos os add-ons para um tenant (uso em testes)';

    public function handle(): int
    {
        $email = $this->option('email');
        $slug = $this->argument('slug');

        if ($email) {
            $user = User::where('email', $email)->first();
            if (! $user) {
                $this->error("Usuário com e-mail \"{$email}\" não encontrado.");
                return 1;
            }
            if (! $user->tenant_id) {
                $this->error("Usuário \"{$email}\" não está vinculado a nenhum tenant.");
                return 1;
            }
            $tenant = Tenant::find($user->tenant_id);
            if (! $tenant) {
                $this->error("Tenant do usuário \"{$email}\" não encontrado.");
                return 1;
            }
            $this->info("Usuário: {$user->name} ({$user->email})");
        } else {
            $tenant = $slug
                ? Tenant::where('slug', $slug)->first()
                : Tenant::orderBy('created_at')->first();

            if (! $tenant) {
                $this->error($slug ? "Tenant com slug \"{$slug}\" não encontrado." : 'Nenhum tenant encontrado no banco.');
                return 1;
            }
        }

        $this->info("Tenant: {$tenant->name} ({$tenant->slug})");

        // 1) Plano pago (CRM): Enterprise (mais top), depois Business, depois Essential
        $plan = Plan::where('slug', 'enterprise')->where('is_active', true)->first()
            ?? Plan::where('slug', 'business')->first()
            ?? Plan::where('slug', 'essential')->first()
            ?? Plan::where('is_active', true)->where('slug', '!=', 'free')->first();

        if (! $plan) {
            $this->warn('Nenhum plano pago (business/essential) encontrado na tabela plans. Crie os planos com php artisan migrate ou seed.');
        } else {
            $sub = $tenant->subscription;
            if ($sub) {
                $sub->update([
                    'plan_id' => $plan->id,
                    'status' => Subscription::STATUS_ACTIVE,
                    'cancelled_at' => null,
                    'starts_at' => $sub->starts_at ?? now(),
                ]);
                $this->line("  ✓ Assinatura atualizada para o plano: {$plan->name}");
            } else {
                Subscription::create([
                    'tenant_id' => $tenant->id,
                    'plan_id' => $plan->id,
                    'status' => Subscription::STATUS_ACTIVE,
                    'starts_at' => now(),
                    'billing_cycle' => 'monthly',
                ]);
                $this->line("  ✓ Assinatura criada com o plano: {$plan->name}");
            }
        }

        // 2) Add-ons no tenant
        $tenant->email_addon_enabled = true;
        $tenant->email_addon_activated_at = $tenant->email_addon_activated_at ?? now();
        $tenant->pipelines_addon_enabled = true;
        $tenant->pipelines_addon_activated_at = $tenant->pipelines_addon_activated_at ?? now();
        $tenant->ai_addon_enabled = true;
        $tenant->ai_addon_activated_at = $tenant->ai_addon_activated_at ?? now();
        $tenant->email_campaigns_addon_enabled = true;
        $tenant->email_campaigns_addon_activated_at = $tenant->email_campaigns_addon_activated_at ?? now();
        $tenant->email_campaigns_addon_leads_tier = $tenant->email_campaigns_addon_leads_tier ?? '5000';
        $tenant->updatePipelinesCount();
        $tenant->save();

        $this->line('  ✓ Add-ons ativados: Módulo de Email, Pipelines, IA, Campanhas de E-mail (faixa 5.000 leads)');

        // 3) Plano de IA (ai_tenant_plans)
        $aiPlan = AiPlan::where('slug', 'business')->where('is_active', true)->first()
            ?? AiPlan::where('slug', 'enterprise')->where('is_active', true)->first()
            ?? AiPlan::where('is_active', true)->orderBy('sort_order')->skip(1)->first();

        if ($aiPlan) {
            $aiTenantPlan = AiTenantPlan::getOrCreateForTenant($tenant->id);
            $aiTenantPlan->update([
                'plan_id' => $aiPlan->id,
                'status' => 'active',
                'started_at' => $aiTenantPlan->started_at ?? now(),
            ]);
            $this->line("  ✓ Plano de IA definido: {$aiPlan->name}");
        } else {
            $this->warn('  Nenhum plano de IA pago encontrado (ai_plans). Rode o AiPlanSeeder se necessário.');
        }

        $this->newLine();
        $this->info('Pronto. Faça logout e login de novo (ou recarregue a página de Configurações) para ver tudo ativo.');

        return 0;
    }
}
