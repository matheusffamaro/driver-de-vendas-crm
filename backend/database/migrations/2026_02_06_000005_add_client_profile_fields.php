<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            if (!Schema::hasColumn('clients', 'type')) {
                $table->string('type')->default('individual')->after('document');
            }
            if (!Schema::hasColumn('clients', 'company_name')) {
                $table->string('company_name')->nullable()->after('type');
            }
            if (!Schema::hasColumn('clients', 'status')) {
                $table->string('status')->default('active')->after('notes');
            }
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            if (Schema::hasColumn('clients', 'company_name')) {
                $table->dropColumn('company_name');
            }
            if (Schema::hasColumn('clients', 'type')) {
                $table->dropColumn('type');
            }
            if (Schema::hasColumn('clients', 'status')) {
                $table->dropColumn('status');
            }
        });
    }
};
