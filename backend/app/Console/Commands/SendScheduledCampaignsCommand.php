<?php

namespace App\Console\Commands;

use App\Models\EmailCampaign;
use App\Jobs\SendCampaignJob;
use Illuminate\Console\Command;

class SendScheduledCampaignsCommand extends Command
{
    protected $signature = 'email:send-scheduled-campaigns';

    protected $description = 'Send email campaigns that have reached their scheduled time';

    public function handle(): int
    {
        $campaigns = EmailCampaign::withoutGlobalScopes()
            ->where('status', EmailCampaign::STATUS_SCHEDULED)
            ->where('scheduled_at', '<=', now())
            ->get();

        if ($campaigns->isEmpty()) {
            $this->info('No scheduled campaigns ready to send.');
            return 0;
        }

        $count = 0;
        foreach ($campaigns as $campaign) {
            $campaign->update(['status' => EmailCampaign::STATUS_SENDING]);
            SendCampaignJob::dispatch($campaign->id);
            $count++;
        }

        $this->info("Dispatched {$count} campaign(s) for sending.");

        return 0;
    }
}
