<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\Pipeline;
use App\Models\PipelineStage;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Seed roles first
        $this->call(RoleSeeder::class);
        
        // Get or create default tenant
        $tenant = Tenant::firstOrCreate(
            ['slug' => 'crm-demo'],
            [
                'id' => Str::uuid(),
                'name' => 'CRM Demo',
                'email' => 'contato@crm-demo.com',
                'phone' => '(11) 99999-9999',
                'is_active' => true,
            ]
        );
        
        // Get admin role (roles are system-wide, not tenant-specific)
        $adminRole = Role::where('slug', 'admin')->first();
        
        // Create admin user
        $admin = User::create([
            'id' => Str::uuid(),
            'name' => 'Administrador',
            'email' => 'admin@crm.com',
            'password' => Hash::make('admin123'),
            'role_id' => $adminRole?->id,
            'tenant_id' => $tenant->id,
            'is_active' => true,
            'is_super_admin' => true,
        ]);

        // Create default pipeline
        $pipeline = Pipeline::create([
            'id' => Str::uuid(),
            'tenant_id' => $tenant->id,
            'name' => 'Funil de Vendas',
            'description' => 'Funil de vendas padrão',
            'is_active' => true,
            'is_default' => true,
        ]);

        // Create pipeline stages
        $stages = [
            ['name' => 'Novo contato', 'color' => '#10B981', 'position' => 0],
            ['name' => 'Em contato', 'color' => '#3B82F6', 'position' => 1],
            ['name' => 'Apresentação', 'color' => '#8B5CF6', 'position' => 2],
            ['name' => 'Negociação', 'color' => '#F59E0B', 'position' => 3],
            ['name' => 'Ganho', 'color' => '#22C55E', 'position' => 4, 'is_won' => true],
            ['name' => 'Perdido', 'color' => '#EF4444', 'position' => 5, 'is_lost' => true],
        ];

        foreach ($stages as $stage) {
            PipelineStage::create([
                'id' => Str::uuid(),
                'pipeline_id' => $pipeline->id,
                'name' => $stage['name'],
                'color' => $stage['color'],
                'position' => $stage['position'],
                'is_won' => $stage['is_won'] ?? false,
                'is_lost' => $stage['is_lost'] ?? false,
            ]);
        }

        $this->command->info('Database seeded successfully!');
        $this->command->info('Admin credentials: admin@crm.com / admin123');
    }
}
