<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CrmTaskAttachment extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'task_id',
        'filename',
        'original_filename',
        'mime_type',
        'size',
        'path',
    ];

    protected function casts(): array
    {
        return [
            'size' => 'integer',
        ];
    }

    public function task()
    {
        return $this->belongsTo(CrmTask::class, 'task_id');
    }
}
