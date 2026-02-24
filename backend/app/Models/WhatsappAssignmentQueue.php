<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WhatsappAssignmentQueue extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'session_id',
        'name',
        'user_ids',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'user_ids' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function session()
    {
        return $this->belongsTo(WhatsappSession::class, 'session_id');
    }
}
