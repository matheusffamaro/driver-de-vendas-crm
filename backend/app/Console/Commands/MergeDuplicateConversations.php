<?php

namespace App\Console\Commands;

use App\Models\WhatsappConversation;
use App\Models\WhatsappMessage;
use App\Models\WhatsappSession;
use Illuminate\Console\Command;

class MergeDuplicateConversations extends Command
{
    protected $signature = 'whatsapp:merge-duplicates {--session= : Session ID to process} {--dry-run : Show what would be merged without making changes}';
    protected $description = 'Merge duplicate WhatsApp conversations based on normalized phone numbers';

    public function handle()
    {
        $sessionId = $this->option('session');
        $dryRun = $this->option('dry-run');

        if ($dryRun) {
            $this->warn('🔍 DRY RUN MODE - No changes will be made');
            $this->newLine();
        }

        $sessions = $sessionId 
            ? WhatsappSession::where('id', $sessionId)->get()
            : WhatsappSession::all();

        if ($sessions->isEmpty()) {
            $this->error('No sessions found');
            return 1;
        }

        $totalMerged = 0;
        $totalDuplicates = 0;

        foreach ($sessions as $session) {
            $this->info("Processing session: {$session->phone_number} ({$session->id})");
            
            $result = $this->processSession($session, $dryRun);
            $totalMerged += $result['merged'];
            $totalDuplicates += $result['duplicates'];
        }

        $this->newLine();
        $this->info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        $this->info("✅ Total duplicates found: {$totalDuplicates}");
        $this->info("✅ Total conversations merged: {$totalMerged}");
        $this->info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        return 0;
    }

    private function processSession(WhatsappSession $session, bool $dryRun): array
    {
        $conversations = WhatsappConversation::where('session_id', $session->id)
            ->where('is_group', false)
            ->get();

        if ($conversations->isEmpty()) {
            return ['merged' => 0, 'duplicates' => 0];
        }

        // Group by normalized phone
        $byPhone = [];
        foreach ($conversations as $conv) {
            $normalized = preg_replace('/\D/', '', $conv->contact_phone ?? '');
            if (strlen($normalized) >= 10) {
                $byPhone[$normalized] = $byPhone[$normalized] ?? [];
                $byPhone[$normalized][] = $conv;
            }
        }

        // Find duplicates
        $duplicates = array_filter($byPhone, fn($group) => count($group) > 1);

        if (empty($duplicates)) {
            $this->line('  No duplicates found');
            return ['merged' => 0, 'duplicates' => 0];
        }

        $mergedCount = 0;
        $duplicatesCount = count($duplicates);

        foreach ($duplicates as $phone => $group) {
            $contactName = $group[0]->contact_name ?? 'Unnamed';
            $this->line("  📱 {$contactName} (+{$phone}): " . count($group) . " conversations");

            // Select best conversation
            $best = $this->selectBestConversation($group);
            $toMerge = array_filter($group, fn($c) => $c->id !== $best->id);

            $this->line("     → Keeping: {$best->remote_jid} (" . $this->getMessageCount($best->id) . " messages)");

            foreach ($toMerge as $duplicate) {
                $msgCount = $this->getMessageCount($duplicate->id);
                $this->line("     → Merging: {$duplicate->remote_jid} ({$msgCount} messages)");

                if (!$dryRun) {
                    // Move messages
                    WhatsappMessage::where('conversation_id', $duplicate->id)
                        ->update(['conversation_id' => $best->id]);

                    // Delete duplicate
                    $duplicate->delete();
                }

                $mergedCount++;
            }

            $this->newLine();
        }

        return ['merged' => $mergedCount, 'duplicates' => $duplicatesCount];
    }

    private function selectBestConversation(array $conversations): WhatsappConversation
    {
        usort($conversations, function ($a, $b) {
            $scoreA = $this->calculateConversationScore($a);
            $scoreB = $this->calculateConversationScore($b);
            return $scoreB <=> $scoreA;
        });

        return $conversations[0];
    }

    private function calculateConversationScore(WhatsappConversation $conv): int
    {
        $score = 0;

        // Prefer @s.whatsapp.net
        if (str_ends_with($conv->remote_jid, '@s.whatsapp.net')) {
            $score += 1000000;
        }

        // Message count
        $msgCount = $this->getMessageCount($conv->id);
        $score += $msgCount * 100;

        // Recency
        if ($conv->last_message_at) {
            $score += $conv->last_message_at->timestamp;
        }

        return $score;
    }

    private function getMessageCount(string $conversationId): int
    {
        return WhatsappMessage::where('conversation_id', $conversationId)->count();
    }
}
