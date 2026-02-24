<?php

return [
    /*
    |--------------------------------------------------------------------------
    | WhatsApp Service Configuration
    |--------------------------------------------------------------------------
    |
    | Configuration for WhatsApp integration service
    |
    */

    'service' => [
        'url' => env('WHATSAPP_SERVICE_URL', 'http://whatsapp:3001'),
        'timeout' => env('WHATSAPP_TIMEOUT', 30),
        'media_timeout' => env('WHATSAPP_MEDIA_TIMEOUT', 60),
    ],

    /*
    |--------------------------------------------------------------------------
    | Message Types
    |--------------------------------------------------------------------------
    |
    | System message types that should be skipped
    |
    */

    'system_message_types' => [
        'messageContextInfo',
        'senderKeyDistributionMessage',
        'protocolMessage',
        'reactionMessage',
        'ephemeralMessage',
        'viewOnceMessage',
        'deviceSentMessage',
        'encReactionMessage',
        'unknown',
    ],

    /*
    |--------------------------------------------------------------------------
    | AI Agent Configuration
    |--------------------------------------------------------------------------
    |
    | Configuration for AI Agent auto-response system
    |
    */

    'ai_agent' => [
        'enabled' => env('WHATSAPP_AI_AGENT_ENABLED', true),
        'rate_limit_per_minute' => env('WHATSAPP_AI_RATE_LIMIT', 30),
        'debounce_seconds' => env('WHATSAPP_AI_DEBOUNCE', 2),
        'recent_message_window_seconds' => env('WHATSAPP_AI_MESSAGE_WINDOW', 60),
        'message_recent_threshold_seconds' => env('WHATSAPP_AI_RECENT_THRESHOLD', 300), // 5 minutes
        'min_message_length' => env('WHATSAPP_AI_MIN_LENGTH', 15),
        'min_keywords' => env('WHATSAPP_AI_MIN_KEYWORDS', 2),
    ],

    /*
    |--------------------------------------------------------------------------
    | Intent Detection
    |--------------------------------------------------------------------------
    |
    | Keywords for detecting message intents
    |
    */

    'intents' => [
        'greeting' => ['oi', 'olá', 'bom dia', 'boa tarde', 'boa noite', 'hello', 'hi'],
        'price_inquiry' => ['preço', 'valor', 'quanto custa', 'custo', 'orçamento', 'budget'],
        'availability' => ['disponível', 'tem', 'existe', 'vocês tem', 'disponibilidade'],
        'support' => ['ajuda', 'suporte', 'problema', 'erro', 'não funciona', 'bug'],
        'scheduling' => ['agendar', 'marcar', 'horário', 'agenda', 'reservar', 'appointment'],
        'info' => ['informação', 'info', 'saber', 'conhecer', 'mais sobre', 'explicar'],
        'complaint' => ['reclamação', 'insatisfeito', 'ruim', 'péssimo', 'problema'],
        'thanks' => ['obrigado', 'obrigada', 'agradeço', 'valeu', 'thanks'],
        'goodbye' => ['tchau', 'até mais', 'bye', 'adeus', 'até logo'],
        'order' => ['pedido', 'comprar', 'quero', 'pedir', 'encomendar'],
        'payment' => ['pagamento', 'pagar', 'pix', 'cartão', 'boleto', 'transferência'],
        'delivery' => ['entrega', 'frete', 'envio', 'prazo', 'chegada'],
    ],

    /*
    |--------------------------------------------------------------------------
    | Allowed FAQ Intents
    |--------------------------------------------------------------------------
    |
    | Intents that are allowed to be stored as FAQ entries
    |
    */

    'allowed_faq_intents' => [
        'price_inquiry',
        'availability',
        'support',
        'scheduling',
        'info',
        'order',
        'payment',
        'delivery',
    ],

    /*
    |--------------------------------------------------------------------------
    | Stop Words (Portuguese)
    |--------------------------------------------------------------------------
    |
    | Common words to exclude from keyword extraction
    |
    */

    'stop_words' => [
        'o', 'a', 'os', 'as', 'um', 'uma', 'de', 'da', 'do', 'em', 'no', 'na', 
        'para', 'com', 'por', 'que', 'qual', 'como', 'quando', 'onde', 'é', 'são', 
        'foi', 'ser', 'ter', 'eu', 'você', 'ele', 'ela', 'nós', 'eles', 'meu', 
        'seu', 'isso', 'este', 'esta', 'esse', 'essa', 'oi', 'olá', 'bom', 'boa', 
        'dia', 'tarde', 'noite', 'obrigado', 'obrigada', 'por favor', 'sim', 'não'
    ],

    /*
    |--------------------------------------------------------------------------
    | Media Configuration
    |--------------------------------------------------------------------------
    |
    | Configuration for media handling
    |
    */

    'media' => [
        'max_file_size' => env('WHATSAPP_MAX_FILE_SIZE', 51200), // 50MB in KB
        'cache_duration' => env('WHATSAPP_MEDIA_CACHE_DAYS', 7),
        'mime_types' => [
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            'mp4' => 'video/mp4',
            'ogg' => 'audio/ogg',
            'mp3' => 'audio/mpeg',
            'pdf' => 'application/pdf',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Webhook Events
    |--------------------------------------------------------------------------
    |
    | Valid webhook event types
    |
    */

    'webhook_events' => [
        'qr_code',
        'connected',
        'disconnected',
        'logged_out',
        'message',
        'message_status',
    ],

    /*
    |--------------------------------------------------------------------------
    | Conversation Settings
    |--------------------------------------------------------------------------
    |
    | Default settings for conversations
    |
    */

    'conversation' => [
        'default_limit' => env('WHATSAPP_CONVERSATION_LIMIT', 50),
        'message_limit' => env('WHATSAPP_MESSAGE_LIMIT', 100),
        'history_count' => env('WHATSAPP_HISTORY_COUNT', 50),
    ],
];
