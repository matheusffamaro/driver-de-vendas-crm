<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('whatsapp_conversations', function (Blueprint $table) {
            $table->string('contact_phone')->nullable()->change();
            $table->string('lid_jid')->nullable()->after('remote_jid')->index();
        });
    }

    public function down(): void
    {
        Schema::table('whatsapp_conversations', function (Blueprint $table) {
            $table->string('contact_phone')->nullable(false)->change();
            $table->dropColumn('lid_jid');
        });
    }
};
