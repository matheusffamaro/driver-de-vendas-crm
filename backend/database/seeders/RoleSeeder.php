<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        foreach (Role::SYSTEM_ROLES as $slug => $roleData) {
            Role::updateOrCreate(
                ['slug' => $slug],
                [
                    'id' => Str::uuid(),
                    'name' => $roleData['name'],
                    'description' => $roleData['description'],
                    'permissions' => $roleData['permissions'],
                    'is_system' => $roleData['is_system'],
                ]
            );
        }

        $this->command->info('System roles created successfully!');
    }
}
