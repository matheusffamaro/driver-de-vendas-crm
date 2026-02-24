<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\EmailAccount;
use App\Models\EmailCampaign;
use App\Models\EmailCampaignRecipient;
use App\Jobs\SendCampaignJob;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class EmailCampaignController extends Controller
{
    protected function ensureEmailAddon(Request $request): void
    {
        $tenant = $request->user()->tenant;
        if (! $tenant->email_addon_enabled) {
            abort(403, 'Módulo de Email não está ativo.');
        }
        if (! ($tenant->email_campaigns_addon_enabled ?? false)) {
            abort(403, 'Add-on Campanhas de E-mail não está ativo. Ative em Configurações → Meu Plano.');
        }
    }

    /**
     * Max recipients per campaign by plan (optional limit).
     */
    protected function getMaxRecipientsPerCampaign(string $tenantId): int
    {
        $tenant = \App\Models\Tenant::with('subscription.plan')->find($tenantId);
        $plan = $tenant?->subscription?->plan;
        $planSlug = $plan->slug ?? '';

        if (strpos($planSlug, 'enterprise') !== false) {
            return -1; // unlimited
        }
        if (strpos($planSlug, 'business') !== false) {
            return 2000;
        }
        if (strpos($planSlug, 'essential') !== false) {
            return 500;
        }

        return 500; // default
    }

    public function index(Request $request)
    {
        $this->ensureEmailAddon($request);

        $query = EmailCampaign::with(['template', 'emailAccount', 'createdByUser'])
            ->orderBy('updated_at', 'desc');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $campaigns = $query->get()->map(function ($c) {
            return array_merge($c->toArray(), [
                'open_rate' => $c->open_rate,
                'click_rate' => $c->click_rate,
            ]);
        });

        return response()->json($campaigns);
    }

    public function store(Request $request)
    {
        $this->ensureEmailAddon($request);

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'subject' => 'required|string|max:255',
            'body_html' => 'nullable|string',
            'email_template_id' => 'nullable|uuid|exists:email_templates,id',
            'email_account_id' => 'required|uuid|exists:email_accounts,id',
            'client_ids' => 'required|array',
            'client_ids.*' => 'uuid|exists:clients,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $account = EmailAccount::where('id', $request->email_account_id)
            ->where('tenant_id', $request->user()->tenant_id)
            ->firstOrFail();

        $maxRecipients = $this->getMaxRecipientsPerCampaign($request->user()->tenant_id);
        $clientIds = array_unique($request->client_ids);
        if ($maxRecipients >= 0 && count($clientIds) > $maxRecipients) {
            return response()->json([
                'error' => "Maximum recipients per campaign for your plan is {$maxRecipients}.",
            ], 422);
        }

        $campaign = EmailCampaign::create([
            'tenant_id' => $request->user()->tenant_id,
            'name' => $request->name,
            'email_template_id' => $request->email_template_id,
            'subject' => $request->subject,
            'body_html' => $request->body_html ?? '',
            'email_account_id' => $account->id,
            'status' => EmailCampaign::STATUS_DRAFT,
            'created_by' => $request->user()->id,
        ]);

            $clients = Client::whereIn('id', $clientIds)
                ->whereNotNull('email')
                ->where('email', '!=', '')
                ->get();

        foreach ($clients as $client) {
            EmailCampaignRecipient::create([
                'email_campaign_id' => $campaign->id,
                'client_id' => $client->id,
                'email' => $client->email,
                'name' => $client->name,
                'status' => EmailCampaignRecipient::STATUS_PENDING,
                'tracking_token' => Str::random(48),
            ]);
        }

        $campaign->update(['recipients_count' => $clients->count()]);

        $campaign->load(['template', 'emailAccount', 'createdByUser']);

        return response()->json(array_merge($campaign->toArray(), [
            'open_rate' => $campaign->open_rate,
            'click_rate' => $campaign->click_rate,
        ]), 201);
    }

    public function show(Request $request, string $id)
    {
        $this->ensureEmailAddon($request);

        $campaign = EmailCampaign::with(['template', 'emailAccount', 'createdByUser'])->findOrFail($id);

        return response()->json(array_merge($campaign->toArray(), [
            'open_rate' => $campaign->open_rate,
            'click_rate' => $campaign->click_rate,
        ]));
    }

    public function update(Request $request, string $id)
    {
        $this->ensureEmailAddon($request);

        $campaign = EmailCampaign::findOrFail($id);
        if ($campaign->status !== EmailCampaign::STATUS_DRAFT) {
            return response()->json(['error' => 'Only draft campaigns can be updated.'], 422);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'subject' => 'sometimes|string|max:255',
            'body_html' => 'nullable|string',
            'email_template_id' => 'nullable|uuid|exists:email_templates,id',
            'email_account_id' => 'sometimes|uuid|exists:email_accounts,id',
            'client_ids' => 'sometimes|array',
            'client_ids.*' => 'uuid|exists:clients,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $data = $request->only(['name', 'subject', 'body_html', 'email_template_id']);
        if ($request->filled('email_account_id')) {
            EmailAccount::where('id', $request->email_account_id)
                ->where('tenant_id', $request->user()->tenant_id)
                ->firstOrFail();
            $data['email_account_id'] = $request->email_account_id;
        }
        $campaign->update($data);

        if ($request->has('client_ids')) {
            $clientIds = array_unique($request->client_ids);
            $maxRecipients = $this->getMaxRecipientsPerCampaign($request->user()->tenant_id);
            if ($maxRecipients >= 0 && count($clientIds) > $maxRecipients) {
                return response()->json([
                    'error' => "Maximum recipients per campaign for your plan is {$maxRecipients}.",
                ], 422);
            }
            $campaign->recipients()->delete();
            $clients = Client::whereIn('id', $clientIds)
                ->whereNotNull('email')
                ->where('email', '!=', '')
                ->get();
            foreach ($clients as $client) {
                EmailCampaignRecipient::create([
                    'email_campaign_id' => $campaign->id,
                    'client_id' => $client->id,
                    'email' => $client->email,
                    'name' => $client->name,
                    'status' => EmailCampaignRecipient::STATUS_PENDING,
                    'tracking_token' => Str::random(48),
                ]);
            }
            $campaign->update(['recipients_count' => $clients->count()]);
        }

        $campaign->load(['template', 'emailAccount', 'createdByUser']);

        return response()->json(array_merge($campaign->toArray(), [
            'open_rate' => $campaign->open_rate,
            'click_rate' => $campaign->click_rate,
        ]));
    }

    public function destroy(Request $request, string $id)
    {
        $this->ensureEmailAddon($request);

        $campaign = EmailCampaign::findOrFail($id);
        if ($campaign->status !== EmailCampaign::STATUS_DRAFT) {
            return response()->json(['error' => 'Only draft campaigns can be deleted.'], 422);
        }
        $campaign->delete();

        return response()->json(['message' => 'Campaign deleted'], 200);
    }

    public function send(Request $request, string $id)
    {
        $this->ensureEmailAddon($request);

        $campaign = EmailCampaign::findOrFail($id);
        if ($campaign->status !== EmailCampaign::STATUS_DRAFT) {
            return response()->json(['error' => 'Only draft campaigns can be sent.'], 422);
        }
        if ($campaign->recipients_count < 1) {
            return response()->json(['error' => 'Campaign has no recipients.'], 422);
        }

        $campaign->update(['status' => EmailCampaign::STATUS_SENDING]);
        SendCampaignJob::dispatch($campaign->id);

        return response()->json([
            'message' => 'Campaign send started.',
            'campaign' => array_merge($campaign->fresh()->toArray(), [
                'open_rate' => $campaign->open_rate,
                'click_rate' => $campaign->click_rate,
            ]),
        ]);
    }

    public function recipients(Request $request, string $id)
    {
        $this->ensureEmailAddon($request);

        $campaign = EmailCampaign::findOrFail($id);
        $recipients = $campaign->recipients()->orderBy('email')->get();

        return response()->json($recipients);
    }
}
