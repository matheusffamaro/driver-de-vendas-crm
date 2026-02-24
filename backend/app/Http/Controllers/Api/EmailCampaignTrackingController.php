<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EmailCampaign;
use App\Models\EmailCampaignRecipient;
use App\Models\EmailCampaignTrackingLink;
use Illuminate\Support\Facades\Response;

class EmailCampaignTrackingController extends Controller
{
    /**
     * 1x1 transparent GIF (for open tracking pixel)
     */
    private const TRACKING_PIXEL = "\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\x00\x00\x00\x21\xf9\x04\x01\x00\x00\x00\x00\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b";

    /**
     * Record open and return 1x1 pixel. Public route (no auth).
     */
    public function open(string $token)
    {
        $recipient = EmailCampaignRecipient::withoutGlobalScopes()
            ->where('tracking_token', $token)
            ->first();

        if ($recipient && !$recipient->opened_at) {
            $recipient->update([
                'opened_at' => now(),
                'status' => $recipient->status === EmailCampaignRecipient::STATUS_CLICKED
                    ? EmailCampaignRecipient::STATUS_CLICKED
                    : EmailCampaignRecipient::STATUS_OPENED,
            ]);
            EmailCampaign::withoutGlobalScopes()
                ->where('id', $recipient->email_campaign_id)
                ->increment('opened_count');
        }

        return Response::make(self::TRACKING_PIXEL, 200, [
            'Content-Type' => 'image/gif',
            'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma' => 'no-cache',
        ]);
    }

    /**
     * Record click and redirect to original URL. Public route (no auth).
     */
    public function click(string $token, string $linkHash)
    {
        $recipient = EmailCampaignRecipient::withoutGlobalScopes()
            ->where('tracking_token', $token)
            ->first();

        if (!$recipient) {
            return redirect()->away('https://example.com');
        }

        $trackingLink = EmailCampaignTrackingLink::where('email_campaign_recipient_id', $recipient->id)
            ->where('link_hash', $linkHash)
            ->first();

        if (!$trackingLink) {
            return redirect()->away('https://example.com');
        }

        if (!$recipient->clicked_at) {
            $recipient->update([
                'clicked_at' => now(),
                'status' => EmailCampaignRecipient::STATUS_CLICKED,
            ]);
            EmailCampaign::withoutGlobalScopes()
                ->where('id', $recipient->email_campaign_id)
                ->increment('clicked_count');
        }

        return redirect()->away($trackingLink->original_url, 302);
    }
}
