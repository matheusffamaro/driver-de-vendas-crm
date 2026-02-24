<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PipelineCardComment extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'card_id',
        'user_id',
        'content',
    ];

    public function card()
    {
        return $this->belongsTo(PipelineCard::class, 'card_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
