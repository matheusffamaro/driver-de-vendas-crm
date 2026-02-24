<?php

namespace App\Jobs;

use App\Models\EmailCampaign;
use App\Models\EmailCampaignRecipient;
use App\Models\EmailCampaignTrackingLink;
use App\Models\EmailAddonUsage;
use App\Services\Email\CampaignSendService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendCampaignJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 600;

    public $tries = 1;

    public function __construct(
        public string $campaignId
    ) {}

    public function handle(): void
    {
        $campaign = EmailCampaign::withoutGlobalScopes()
            ->with(['emailAccount', 'recipients'])
            ->find($this->campaignId);

        if (!$campaign || $campaign->status !== EmailCampaign::STATUS_SENDING) {
            return;
        }

        $account = $campaign->emailAccount;
        $fromName = $account->account_name;
        $subject = $campaign->subject;
        $sendService = new CampaignSendService();
        $trackingBase = rtrim(config('app.url'), '/') . '/api/email/track';
        $delivered = 0;

        foreach ($campaign->recipients()->where('status', EmailCampaignRecipient::STATUS_PENDING)->get() as $recipient) {
            try {
                $body = $this->buildBodyWithTracking(
                    $campaign->body_html ?? '',
                    $recipient->tracking_token,
                    $recipient->id,
                    $trackingBase
                );

                $sent = $sendService->sendOne(
                    $account,
                    ['email' => $recipient->email, 'name' => $recipient->name],
                    $subject,
                    $body,
                    $fromName
                );

                if ($sent) {
                    $recipient->update([
                        'status' => EmailCampaignRecipient::STATUS_SENT,
                        'sent_at' => now(),
                    ]);
                    $delivered++;

                    $usage = EmailAddonUsage::getCurrentMonthUsage($campaign->tenant_id);
                    $usage->incrementSent();
                } else {
                    $recipient->update([
                        'status' => EmailCampaignRecipient::STATUS_FAILED,
                        'error_message' => 'Send returned false',
                    ]);
                }
            } catch (\Throwable $e) {
                Log::warning("Campaign send failed for recipient {$recipient->email}: " . $e->getMessage());
                $recipient->update([
                    'status' => EmailCampaignRecipient::STATUS_FAILED,
                    'error_message' => $e->getMessage(),
                ]);
            }
        }

        $campaign->withoutGlobalScopes()->where('id', $campaign->id)->update([
            'status' => EmailCampaign::STATUS_SENT,
            'sent_at' => now(),
            'delivered_count' => $delivered,
        ]);
    }

    protected function buildBodyWithTracking(string $bodyHtml, string $token, string $recipientId, string $trackingBase): string
    {
        $openUrl = $trackingBase . '/' . $token . '/open';
        $body = $bodyHtml . '<img src="' . $openUrl . '" width="1" height="1" alt="" style="display:block" />';

        if (preg_match_all('/<a\s+[^>]*href=(["\'])([^"\']+)\1[^>]*>/i', $body, $matches, PREG_SET_ORDER)) {
            $seen = [];
            foreach ($matches as $m) {
                $url = $m[2];
                if (isset($seen[$url]) || str_starts_with($url, 'mailto:') || str_starts_with($url, '#')) {
                    continue;
                }
                $seen[$url] = true;
                $linkHash = substr(md5($url), 0, 16);
                EmailCampaignTrackingLink::create([
                    'email_campaign_recipient_id' => $recipientId,
                    'link_hash' => $linkHash,
                    'original_url' => $url,
                ]);
                $trackUrl = $trackingBase . '/' . $token . '/click/' . $linkHash;
                $body = str_replace('href="' . $url . '"', 'href="' . $trackUrl . '"', $body);
                $body = str_replace("href='" . $url . "'", "href='" . $trackUrl . "'", $body);
            }
        }

        return $body;
    }
}
