<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Console\Scheduling\Schedule;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->api(prepend: [
            \Illuminate\Http\Middleware\HandleCors::class,
        ]);
        
        $middleware->alias([
            'jwt.auth' => \App\Http\Middleware\JwtAuthMiddleware::class,
            'super.admin' => \App\Http\Middleware\SuperAdminMiddleware::class,
            'permission' => \App\Http\Middleware\CheckPermission::class,
            'tenant' => \App\Http\Middleware\TenantMiddleware::class,
            'subscription' => \App\Http\Middleware\CheckSubscriptionMiddleware::class,
        ]);
    })
    ->withSchedule(function (Schedule $schedule) {
        // Run pipeline addon charges calculation on the 1st day of each month at midnight
        $schedule->command('pipeline-addon:calculate-charges')
                 ->monthlyOn(1, '00:00');
        
        // Check for expired trials every hour
        $schedule->command('subscriptions:expire-trials')
                 ->hourly();
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Adiciona CORS em respostas de exceção (500 etc.) para o frontend poder ler o erro
        $exceptions->respond(function ($response, $e, $request) {
            if ($response && ! $response->headers->has('Access-Control-Allow-Origin')) {
                $origin = $request->header('Origin', '');
                $allowed = ['http://localhost:3000', 'http://localhost:3100', 'http://127.0.0.1:3000', 'http://127.0.0.1:3100'];
                $response->headers->set('Access-Control-Allow-Origin', in_array($origin, $allowed, true) ? $origin : 'http://localhost:3100');
                $response->headers->set('Access-Control-Allow-Credentials', 'true');
                $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
                $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
            }
            return $response;
        });
    })->create();
