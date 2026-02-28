<?php

namespace App\Console\Commands;

use App\Models\EmailAccount;
use App\Jobs\SyncEmailAccountJob;
use Illuminate\Console\Command;

class SyncEmailAccountsCommand extends Command
{
    protected $signature = 'email:sync-accounts';

    protected $description = 'Dispatch sync jobs for all active email accounts';

    public function handle(): int
    {
        $accounts = EmailAccount::where('is_active', true)
            ->where(function ($query) {
                $query->whereNull('last_sync_at')
                      ->orWhere('last_sync_at', '<', now()->subMinutes(4));
            })
            ->get();

        if ($accounts->isEmpty()) {
            $this->info('No accounts need syncing.');
            return 0;
        }

        $count = 0;
        foreach ($accounts as $account) {
            SyncEmailAccountJob::dispatch($account);
            $count++;
        }

        $this->info("Dispatched sync for {$count} email account(s).");

        return 0;
    }
}
