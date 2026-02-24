<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    */

    'whatsapp' => [
        'url' => env('WHATSAPP_SERVICE_URL', 'http://whatsapp:3001'),
        'webhook_url' => env('WHATSAPP_WEBHOOK_URL', 'http://api:8000/api/whatsapp/webhook'),
    ],

    // Google OAuth2 for Gmail integration
    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID', ''),
        'client_secret' => env('GOOGLE_CLIENT_SECRET', ''),
        'redirect' => env('GOOGLE_REDIRECT_URI', env('APP_URL') . '/api/email/accounts/oauth/gmail/callback'),
    ],

    // Gmail alias (for backward compatibility)
    'gmail' => [
        'client_id' => env('GOOGLE_CLIENT_ID', ''),
        'client_secret' => env('GOOGLE_CLIENT_SECRET', ''),
        'redirect' => env('GOOGLE_REDIRECT_URI', env('APP_URL') . '/api/email/accounts/oauth/gmail/callback'),
    ],

    // Microsoft OAuth2 for Outlook integration
    'microsoft' => [
        'client_id' => env('MICROSOFT_CLIENT_ID', ''),
        'client_secret' => env('MICROSOFT_CLIENT_SECRET', ''),
        'redirect' => env('MICROSOFT_REDIRECT_URI', env('APP_URL') . '/api/email/accounts/oauth/outlook/callback'),
    ],

    // AI Provider selection
    'ai' => [
        'provider' => env('AI_PROVIDER', 'groq'), // groq, gemini, openai
    ],

    // PayPal configuration
    'paypal' => [
        'mode' => env('PAYPAL_MODE', 'sandbox'), // sandbox or live
        'client_id' => env('PAYPAL_CLIENT_ID', ''),
        'client_secret' => env('PAYPAL_CLIENT_SECRET', ''),
        'webhook_id' => env('PAYPAL_WEBHOOK_ID', ''),
    ],

    // Groq AI - Free tier: 30 RPM, 14,400/day (RECOMMENDED)
    // Preços: llama-3.3-70b = $0.59/$0.79 per 1M tokens | llama-3.1-8b = $0.05/$0.08 per 1M tokens
    'groq' => [
        'api_key' => env('GROQ_API_KEY', ''),
        'model' => env('GROQ_MODEL', 'llama-3.3-70b-versatile'), // Modelo principal (mais inteligente)
        'fast_model' => env('GROQ_FAST_MODEL', 'llama-3.1-8b-instant'), // Modelo rápido (10x mais barato!)
        'base_url' => env('GROQ_BASE_URL', 'https://api.groq.com/openai/v1'),
    ],

    // Gemini AI (Google) - Free tier: 15 RPM, 1,500/day (backup)
    'gemini' => [
        'api_key' => env('GEMINI_API_KEY', ''),
        'model' => env('GEMINI_MODEL', 'gemini-2.0-flash'),
        'base_url' => env('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta'),
    ],

    // OpenAI config (paid)
    'openai' => [
        'api_key' => env('OPENAI_API_KEY', ''),
        'model' => env('OPENAI_MODEL', 'gpt-4o-mini'),
        'base_url' => env('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
    ],

    'mailgun' => [
        'domain' => env('MAILGUN_DOMAIN'),
        'secret' => env('MAILGUN_SECRET'),
        'endpoint' => env('MAILGUN_ENDPOINT', 'api.mailgun.net'),
        'scheme' => 'https',
    ],

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],
];
