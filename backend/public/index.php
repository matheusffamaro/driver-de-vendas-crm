<?php

use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// CORS preflight: só para OPTIONS (evita duplicar com o middleware HandleCors)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? 'http://localhost:3100';
    $allowed = ['http://localhost:3000', 'http://localhost:3100', 'http://127.0.0.1:3000', 'http://127.0.0.1:3100'];
    header('Access-Control-Allow-Origin: ' . (in_array($origin, $allowed, true) ? $origin : 'http://localhost:3100'));
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept');
    header('Access-Control-Allow-Credentials: true');
    http_response_code(200);
    exit();
}

if (file_exists($maintenance = __DIR__.'/../storage/framework/maintenance.php')) {
    require $maintenance;
}

require __DIR__.'/../vendor/autoload.php';

(require_once __DIR__.'/../bootstrap/app.php')
    ->handleRequest(Request::capture());
