<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Step 1: Migrate any remaining users with legacy 'role' but no 'role_id'
        $usersWithLegacyRole = DB::table('users')
            ->whereNotNull('role')
            ->whereNull('role_id')
            ->get();

        foreach ($usersWithLegacyRole as $user) {
            // Find or create corresponding role based on legacy role name
            $roleName = $this->mapLegacyRoleToRoleName($user->role);
            
            $role = DB::table('roles')
                ->where('tenant_id', $user->tenant_id)
                ->where('name', $roleName)
                ->first();

            if ($role) {
                DB::table('users')
                    ->where('id', $user->id)
                    ->update(['role_id' => $role->id]);
            } else {
                // If no role exists, assign to default 'user' role or create one
                $defaultRole = DB::table('roles')
                    ->where('tenant_id', $user->tenant_id)
                    ->where('name', 'user')
                    ->first();
                
                if ($defaultRole) {
                    DB::table('users')
                        ->where('id', $user->id)
                        ->update(['role_id' => $defaultRole->id]);
                }
            }
        }

        // Step 2: Set a default role_id for any users that still have NULL
        // (assign them to first available role for their tenant)
        $usersWithoutRole = DB::table('users')
            ->whereNull('role_id')
            ->whereNotNull('tenant_id')
            ->get();

        foreach ($usersWithoutRole as $user) {
            $defaultRole = DB::table('roles')
                ->where('tenant_id', $user->tenant_id)
                ->orderBy('created_at', 'asc')
                ->first();
            
            if ($defaultRole) {
                DB::table('users')
                    ->where('id', $user->id)
                    ->update(['role_id' => $defaultRole->id]);
            }
        }

        // Step 3: Remove the legacy 'role' column
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('role');
        });

        // Step 4: Make role_id non-nullable (all users should have a role now)
        // Skip this if there are still NULL values
        $nullRoleCount = DB::table('users')->whereNull('role_id')->count();
        
        if ($nullRoleCount === 0) {
            Schema::table('users', function (Blueprint $table) {
                $table->uuid('role_id')->nullable(false)->change();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Re-add the legacy role column
        Schema::table('users', function (Blueprint $table) {
            $table->string('role')->nullable()->after('password');
        });

        // Restore legacy role values from role_id (reverse migration)
        $users = DB::table('users')->whereNotNull('role_id')->get();
        
        foreach ($users as $user) {
            $role = DB::table('roles')->where('id', $user->role_id)->first();
            
            if ($role) {
                $legacyRole = $this->mapRoleNameToLegacyRole($role->name);
                DB::table('users')
                    ->where('id', $user->id)
                    ->update(['role' => $legacyRole]);
            }
        }

        // Make role_id nullable again
        Schema::table('users', function (Blueprint $table) {
            $table->uuid('role_id')->nullable()->change();
        });
    }

    /**
     * Map legacy role string to new role name.
     */
    private function mapLegacyRoleToRoleName(string $legacyRole): string
    {
        return match(strtolower($legacyRole)) {
            'admin' => 'admin',
            'manager' => 'manager',
            'user' => 'user',
            'sales' => 'sales',
            'support' => 'support',
            'viewer' => 'viewer',
            default => 'user',
        };
    }

    /**
     * Map role name back to legacy role string.
     */
    private function mapRoleNameToLegacyRole(string $roleName): string
    {
        return match(strtolower($roleName)) {
            'admin' => 'admin',
            'manager' => 'manager',
            'sales' => 'sales',
            'support' => 'support',
            'viewer' => 'viewer',
            default => 'user',
        };
    }
};
