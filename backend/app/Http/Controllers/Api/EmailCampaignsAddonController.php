<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmailCampaignsAddonController extends Controller
{
    /**
     * Available lead tiers for the email campaigns addon (base de leads).
     */
    public static function getTiers(): array
    {
        return [
            ['id' => '1000', 'label' => '0 - 1.000 leads', 'min_leads' => 0, 'max_leads' => 1000, 'price_monthly' => 29.90],
            ['id' => '5000', 'label' => '1.001 - 5.000 leads', 'min_leads' => 1001, 'max_leads' => 5000, 'price_monthly' => 79.90],
            ['id' => '15000', 'label' => '5.001 - 15.000 leads', 'min_leads' => 5001, 'max_leads' => 15000, 'price_monthly' => 149.90],
            ['id' => 'unlimited', 'label' => 'Acima de 15.000 leads', 'min_leads' => 15001, 'max_leads' => null, 'price_monthly' => 299.90],
        ];
    }

    /**
     * Get available tiers and pricing.
     */
    public function tiers(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => self::getTiers(),
        ]);
    }

    /**
     * Activate email campaigns addon with a lead tier.
     */
    public function activate(Request $request): JsonResponse
    {
        $request->validate([
            'leads_tier' => 'required|string|in:1000,5000,15000,unlimited',
        ]);

        $tenant = $request->user()->tenant;
        $tiers = collect(self::getTiers());
        $tier = $tiers->firstWhere('id', $request->leads_tier);

        $tenant->email_campaigns_addon_enabled = true;
        $tenant->email_campaigns_addon_activated_at = now();
        $tenant->email_campaigns_addon_leads_tier = $request->leads_tier;
        $tenant->save();

        return response()->json([
            'success' => true,
            'message' => 'Add-on Campanhas de E-mail ativado com sucesso.',
            'data' => [
                'email_campaigns_addon_enabled' => true,
                'email_campaigns_addon_leads_tier' => $tenant->email_campaigns_addon_leads_tier,
                'price_monthly' => $tier ? $tier['price_monthly'] : 0,
            ],
        ]);
    }

    /**
     * Deactivate email campaigns addon.
     */
    public function deactivate(Request $request): JsonResponse
    {
        $tenant = $request->user()->tenant;

        $tenant->email_campaigns_addon_enabled = false;
        $tenant->email_campaigns_addon_activated_at = null;
        $tenant->email_campaigns_addon_leads_tier = null;
        $tenant->save();

        return response()->json([
            'success' => true,
            'message' => 'Add-on Campanhas de E-mail desativado.',
            'data' => [
                'email_campaigns_addon_enabled' => false,
                'email_campaigns_addon_leads_tier' => null,
            ],
        ]);
    }

    /**
     * Update lead tier (when addon is already active).
     */
    public function updateTier(Request $request): JsonResponse
    {
        $request->validate([
            'leads_tier' => 'required|string|in:1000,5000,15000,unlimited',
        ]);

        $tenant = $request->user()->tenant;

        if (! $tenant->email_campaigns_addon_enabled) {
            return response()->json([
                'success' => false,
                'message' => 'O add-on Campanhas de E-mail não está ativo. Ative-o primeiro.',
            ], 400);
        }

        $tiers = collect(self::getTiers());
        $tier = $tiers->firstWhere('id', $request->leads_tier);

        $tenant->email_campaigns_addon_leads_tier = $request->leads_tier;
        $tenant->save();

        return response()->json([
            'success' => true,
            'message' => 'Faixa de leads atualizada.',
            'data' => [
                'email_campaigns_addon_leads_tier' => $tenant->email_campaigns_addon_leads_tier,
                'price_monthly' => $tier ? $tier['price_monthly'] : 0,
            ],
        ]);
    }
}
