<?php

namespace App\Console\Commands;

use App\Models\Subscription;
use Illuminate\Console\Command;

class ExpireTrialsCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'subscriptions:expire-trials';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Expire trial subscriptions that have reached their end date';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Checking for expired trials...');

        // Find all trial subscriptions where trial_ends_at is in the past
        $expiredTrials = Subscription::where('status', Subscription::STATUS_TRIAL)
            ->where('trial_ends_at', '<', now())
            ->get();

        if ($expiredTrials->isEmpty()) {
            $this->info('No expired trials found.');
            return 0;
        }

        $count = 0;

        foreach ($expiredTrials as $subscription) {
            $subscription->update([
                'status' => Subscription::STATUS_EXPIRED,
                'ends_at' => now(),
            ]);

            $count++;

            $this->line("Expired trial for tenant ID: {$subscription->tenant_id}");
        }

        $this->info("Successfully expired {$count} trial subscription(s).");

        return 0;
    }
}
