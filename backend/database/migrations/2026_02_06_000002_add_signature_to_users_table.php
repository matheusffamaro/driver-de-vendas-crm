<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'signature')) {
                $table->string('signature', 5)->nullable()->after('phone');
                $table->unique(['tenant_id', 'signature'], 'users_tenant_signature_unique');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'signature')) {
                $table->dropUnique('users_tenant_signature_unique');
                $table->dropColumn('signature');
            }
        });
    }
};
