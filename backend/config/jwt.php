<?php

return [
    'secret' => env('JWT_SECRET', 'your-secret-key-here'),
    'ttl' => env('JWT_TTL', 1440), // 24 hours in minutes
    'refresh_ttl' => env('JWT_REFRESH_TTL', 20160), // 2 weeks in minutes
    'algo' => env('JWT_ALGO', 'HS256'),
];
