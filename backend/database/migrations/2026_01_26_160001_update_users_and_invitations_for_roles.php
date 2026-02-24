<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Add suspended fields to users table if they don't exist
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'suspended_at')) {
                $table->timestamp('suspended_at')->nullable();
            }
            if (!Schema::hasColumn('users', 'suspended_reason')) {
                $table->string('suspended_reason', 500)->nullable();
            }
        });

        // Add role_id to user_invitations table if it doesn't exist
        Schema::table('user_invitations', function (Blueprint $table) {
            if (!Schema::hasColumn('user_invitations', 'role_id')) {
                $table->uuid('role_id')->nullable()->after('role');
                $table->foreign('role_id')->references('id')->on('roles')->onDelete('set null');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['suspended_at', 'suspended_reason']);
        });

        Schema::table('user_invitations', function (Blueprint $table) {
            $table->dropForeign(['role_id']);
            $table->dropColumn('role_id');
        });
    }
};
