<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\PipelineController;
use App\Http\Controllers\Api\PipelineCardEmailController;
use App\Http\Controllers\Api\ProposalController;
use App\Http\Controllers\Api\CrmTaskController;
use App\Http\Controllers\Api\WhatsappController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\AiChatAgentController;
use App\Http\Controllers\Api\AiPlanController;
use App\Http\Controllers\Api\AILearningController;
use App\Http\Controllers\Api\TenantController;
use App\Http\Controllers\Api\PricingController;
use App\Http\Controllers\Api\SubscriptionController;
use App\Http\Controllers\Api\PayPalController;
use App\Http\Controllers\Api\SuperAdminController;

// Health check
Route::get('/health', fn () => response()->json(['status' => 'ok']));

// Public routes
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/refresh', [AuthController::class, 'refresh']);
    
    // Public invitation routes (for accepting invites without auth)
    Route::get('/invitation/{token}', [AuthController::class, 'getInvitation']);
    Route::post('/invitation/{token}/accept', [AuthController::class, 'acceptInvitation']);
});

// ==========================================
// SUPER ADMIN AUTH (public)
// ==========================================
Route::prefix('super-admin/auth')->group(function () {
    Route::post('/login', [AuthController::class, 'superAdminLogin']);
    Route::post('/logout', [AuthController::class, 'logout']); // stateless
});

// Public pricing routes (for landing page)
Route::prefix('pricing')->group(function () {
    Route::get('plans', [PricingController::class, 'plans']);
    Route::get('tiers', [PricingController::class, 'tiers']);
    Route::post('calculate', [PricingController::class, 'calculate']);
    Route::post('recommend', [PricingController::class, 'recommend']);
});

// List available plans (public)
Route::get('plans', [SubscriptionController::class, 'listPlans']);

// OAuth callbacks (public - Google/Microsoft redirect here without JWT token)
Route::get('email/accounts/oauth/{provider}/callback', [App\Http\Controllers\Api\EmailAccountController::class, 'handleOAuthCallback']);

// Email campaign tracking (public - pixel and click redirect without auth)
Route::get('email/track/{token}/open', [App\Http\Controllers\Api\EmailCampaignTrackingController::class, 'open']);
Route::get('email/track/{token}/click/{linkHash}', [App\Http\Controllers\Api\EmailCampaignTrackingController::class, 'click']);

// Protected routes (with tenant validation and subscription check)
Route::middleware(['jwt.auth', 'tenant', 'subscription'])->group(function () {
    // Auth
    Route::prefix('auth')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
        Route::put('/profile', [AuthController::class, 'updateProfile']);
        Route::put('/password', [AuthController::class, 'changePassword']);
    });

    // Roles Management
    Route::get('roles', [UserController::class, 'listRoles']);
    Route::get('permissions', [UserController::class, 'listPermissions']);
    Route::post('roles', [UserController::class, 'createRole']);
    Route::put('roles/{id}', [UserController::class, 'updateRole']);
    Route::delete('roles/{id}', [UserController::class, 'destroyRole']);
    
    // Users
    Route::get('users/me', [UserController::class, 'me']); // Get current user profile
    Route::put('users/me/signature', [UserController::class, 'updateSignature']); // Update signature
    Route::get('users/statistics', [UserController::class, 'statistics'])->middleware('permission:users.view');
    Route::get('users/my-permissions', [UserController::class, 'myPermissions']);
    Route::get('users/invitations', [UserController::class, 'pendingInvitations'])->middleware('permission:users.view');
    Route::post('users/invitations', [UserController::class, 'sendInvitation'])->middleware('permission:users.edit');
    Route::post('users/invitations/{id}/resend', [UserController::class, 'resendInvitation'])->middleware('permission:users.edit');
    Route::delete('users/invitations/{id}', [UserController::class, 'cancelInvitation'])->middleware('permission:users.edit');
    Route::post('users/{id}/suspend', [UserController::class, 'suspend'])->middleware('permission:users.edit');
    Route::post('users/{id}/activate', [UserController::class, 'activate'])->middleware('permission:users.edit');
    Route::put('users/{id}/role', [UserController::class, 'updateUserRole'])->middleware('permission:users.roles');
    
    // Users CRUD with permissions
    Route::get('users', [UserController::class, 'index'])->middleware('permission:users.view');
    Route::post('users', [UserController::class, 'store'])->middleware('permission:users.edit');
    Route::get('users/{id}', [UserController::class, 'show'])->middleware('permission:users.view');
    Route::put('users/{id}', [UserController::class, 'update'])->middleware('permission:users.edit');
    Route::delete('users/{id}', [UserController::class, 'destroy'])->middleware('permission:users.delete');

    // Clients
    Route::get('clients/search', [ClientController::class, 'search'])->middleware('permission:clients.view');
    Route::get('clients/export', [ClientController::class, 'exportCsv'])->middleware('permission:clients.view');
    Route::post('clients/import', [ClientController::class, 'importCsv'])->middleware('permission:clients.create');
    Route::get('clients/custom-fields', [ClientController::class, 'customFields'])->middleware('permission:clients.view');
    Route::put('clients/custom-fields', [ClientController::class, 'updateCustomFields'])->middleware('permission:clients.edit');
    Route::post('proposals/send', [ProposalController::class, 'send'])->middleware('permission:clients.view');
    
    // Clients CRUD with permissions
    Route::get('clients', [ClientController::class, 'index'])->middleware('permission:clients.view');
    Route::post('clients', [ClientController::class, 'store'])->middleware('permission:clients.create');
    Route::get('clients/{id}', [ClientController::class, 'show'])->middleware('permission:clients.view');
    Route::put('clients/{id}', [ClientController::class, 'update'])->middleware('permission:clients.edit');
    Route::delete('clients/{id}', [ClientController::class, 'destroy'])->middleware('permission:clients.delete');

    // Products
    Route::get('product-categories', [ProductController::class, 'categories'])->middleware('permission:products.view');
    Route::post('product-categories', [ProductController::class, 'storeCategory'])->middleware('permission:products.edit');
    Route::put('product-categories/{id}', [ProductController::class, 'updateCategory'])->middleware('permission:products.edit');
    Route::delete('product-categories/{id}', [ProductController::class, 'destroyCategory'])->middleware('permission:products.delete');
    
    // Products Categories (frontend compatibility)
    Route::get('products/export', [ProductController::class, 'exportCsv'])->middleware('permission:products.view');
    Route::post('products/import', [ProductController::class, 'importCsv'])->middleware('permission:products.create');
    Route::get('products/categories', [ProductController::class, 'categories'])->middleware('permission:products.view');
    Route::post('products/categories', [ProductController::class, 'storeCategory'])->middleware('permission:products.edit');
    Route::put('products/categories/{id}', [ProductController::class, 'updateCategory'])->middleware('permission:products.edit');
    Route::delete('products/categories/{id}', [ProductController::class, 'destroyCategory'])->middleware('permission:products.delete');
    Route::get('products/units', [ProductController::class, 'units'])->middleware('permission:products.view');
    
    // Products CRUD with permissions
    Route::get('products', [ProductController::class, 'index'])->middleware('permission:products.view');
    Route::post('products', [ProductController::class, 'store'])->middleware('permission:products.create');
    Route::get('products/{id}', [ProductController::class, 'show'])->middleware('permission:products.view');
    Route::put('products/{id}', [ProductController::class, 'update'])->middleware('permission:products.edit');
    Route::delete('products/{id}', [ProductController::class, 'destroy'])->middleware('permission:products.delete');

    // Pipelines
    Route::prefix('pipelines')->group(function () {
        Route::get('/', [PipelineController::class, 'index']);
        Route::post('/', [PipelineController::class, 'store']);
        Route::get('/{id}', [PipelineController::class, 'show']);
        Route::put('/{id}', [PipelineController::class, 'update']);
        Route::delete('/{id}', [PipelineController::class, 'destroy']);
        Route::put('/{id}/stages', [PipelineController::class, 'updateStages']);
        Route::put('/{id}/custom-fields', [PipelineController::class, 'updateCustomFields']);
        Route::get('/{id}/report', [PipelineController::class, 'report']);

        // Pipeline Cards
        Route::get('/{pipelineId}/cards', [PipelineController::class, 'listCards']);
        Route::get('/{pipelineId}/cards/list', [PipelineController::class, 'listCardsView']);
        Route::post('/{pipelineId}/cards', [PipelineController::class, 'storeCard']);
        Route::get('/{pipelineId}/cards/{cardId}', [PipelineController::class, 'showCard']);
        Route::put('/{pipelineId}/cards/{cardId}', [PipelineController::class, 'updateCard']);
        Route::delete('/{pipelineId}/cards/{cardId}', [PipelineController::class, 'destroyCard']);
        Route::post('/{pipelineId}/cards/{cardId}/move', [PipelineController::class, 'moveCard']);
        Route::post('/{pipelineId}/cards/reorder', [PipelineController::class, 'reorderCards']);
        Route::put('/{pipelineId}/cards/{cardId}/products', [PipelineController::class, 'updateCardProducts']);

        // Card Comments (Timeline)
        Route::get('/{pipelineId}/cards/{cardId}/comments', [PipelineController::class, 'listComments']);
        Route::post('/{pipelineId}/cards/{cardId}/comments', [PipelineController::class, 'storeComment']);
        Route::put('/{pipelineId}/cards/{cardId}/comments/{commentId}', [PipelineController::class, 'updateComment']);
        Route::delete('/{pipelineId}/cards/{cardId}/comments/{commentId}', [PipelineController::class, 'destroyComment']);

        // Card Emails
        Route::get('/{pipelineId}/cards/{cardId}/emails', [PipelineCardEmailController::class, 'index']);
        Route::post('/{pipelineId}/cards/{cardId}/emails', [PipelineCardEmailController::class, 'store']);
        Route::delete('/{pipelineId}/cards/{cardId}/emails/{emailId}', [PipelineCardEmailController::class, 'destroy']);

        // AI Auto-fill
        Route::post('/{pipelineId}/cards/{cardId}/ai-autofill', [PipelineController::class, 'aiAutoFill']);

        // Card Archive
        Route::post('/{pipelineId}/cards/{cardId}/archive', [PipelineController::class, 'archiveCard']);
        Route::post('/{pipelineId}/cards/{cardId}/unarchive', [PipelineController::class, 'unarchiveCard']);
        Route::get('/{pipelineId}/archived', [PipelineController::class, 'listArchivedCards']);

        // Card Attachments
        Route::get('/{pipelineId}/cards/{cardId}/attachments', [PipelineController::class, 'listAttachments']);
        Route::post('/{pipelineId}/cards/{cardId}/attachments', [PipelineController::class, 'uploadAttachment']);
        Route::delete('/{pipelineId}/cards/{cardId}/attachments/{attachmentId}', [PipelineController::class, 'deleteAttachment']);
        Route::get('/{pipelineId}/cards/{cardId}/attachments/{attachmentId}/download', [PipelineController::class, 'downloadAttachment']);
    });

    // CRM Tasks
    Route::prefix('crm/tasks')->group(function () {
        Route::get('/', [CrmTaskController::class, 'index']);
        Route::post('/', [CrmTaskController::class, 'store']);
        Route::get('/{id}', [CrmTaskController::class, 'show']);
        Route::put('/{id}', [CrmTaskController::class, 'update']);
        Route::delete('/{id}', [CrmTaskController::class, 'destroy']);
        Route::post('/{id}/complete', [CrmTaskController::class, 'complete']);
    });

    // WhatsApp
    Route::prefix('whatsapp')->group(function () {
        Route::get('/conversations/by-user', [WhatsappController::class, 'getConversationsByUser']);

        // Sessions
        Route::get('/sessions', [WhatsappController::class, 'listSessions']);
        Route::post('/sessions', [WhatsappController::class, 'createSession']);
        Route::put('/sessions/{sessionId}', [WhatsappController::class, 'updateSession']);
        Route::get('/sessions/{sessionId}/qr-code', [WhatsappController::class, 'getQRCode']);
        Route::get('/sessions/{sessionId}/status', [WhatsappController::class, 'getSessionStatus']);
        Route::get('/sessions/{sessionId}/conversations', [WhatsappController::class, 'listConversations']);
        Route::post('/sessions/{sessionId}/disconnect', [WhatsappController::class, 'disconnectSession']);
        Route::delete('/sessions/{sessionId}', [WhatsappController::class, 'deleteSession']);
        Route::post('/sessions/{sessionId}/clear-data', [WhatsappController::class, 'clearSessionData']);
        Route::post('/sessions/{sessionId}/reconnect', [WhatsappController::class, 'reconnectSession']);
        Route::post('/sessions/{sessionId}/refresh-profile-pictures', [WhatsappController::class, 'refreshProfilePictures']);
        Route::post('/sessions/{sessionId}/refresh-group-names', [WhatsappController::class, 'refreshGroupNames']);
        Route::post('/sessions/{sessionId}/fix-contact-names', [WhatsappController::class, 'fixContactNames']);
        Route::post('/sessions/{sessionId}/sync', [WhatsappController::class, 'syncSession']);

        // Conversations
        Route::get('/conversations/{conversationId}/messages', [WhatsappController::class, 'listMessages']);
        Route::post('/sessions/{sessionId}/conversations', [WhatsappController::class, 'startConversation']);
        Route::post('/conversations/{conversationId}/messages', [WhatsappController::class, 'sendMessage']);
        Route::post('/conversations/{conversationId}/link-contact', [WhatsappController::class, 'linkContact']);
        Route::post('/conversations/{conversationId}/assign', [WhatsappController::class, 'assignConversation']);
        Route::post('/conversations/{conversationId}/toggle-pin', [WhatsappController::class, 'togglePin']);
        Route::post('/conversations/{conversationId}/archive', [WhatsappController::class, 'archiveConversation']);
        Route::post('/conversations/{conversationId}/fetch-history', [WhatsappController::class, 'fetchConversationHistory']);

        // Quick Replies
        Route::get('/quick-replies', [WhatsappController::class, 'listQuickReplies']);
        Route::post('/quick-replies', [WhatsappController::class, 'createQuickReply']);
        Route::put('/quick-replies/{id}', [WhatsappController::class, 'updateQuickReply']);
        Route::delete('/quick-replies/{id}', [WhatsappController::class, 'deleteQuickReply']);

        // Assignment Queues
        Route::get('/sessions/{sessionId}/assignment-queues', [WhatsappController::class, 'listAssignmentQueues']);
        Route::post('/sessions/{sessionId}/assignment-queues', [WhatsappController::class, 'createAssignmentQueue']);
        Route::put('/assignment-queues/{id}', [WhatsappController::class, 'updateAssignmentQueue']);
        Route::delete('/assignment-queues/{id}', [WhatsappController::class, 'deleteAssignmentQueue']);
    });

    // Reports (protected by permission)
    Route::prefix('reports')->middleware('permission:reports.view')->group(function () {
        Route::get('/dashboard', [ReportController::class, 'dashboard']);
        Route::get('/sales', [ReportController::class, 'sales']);
        Route::get('/clients', [ReportController::class, 'clients']);
        Route::get('/products', [ReportController::class, 'products']);
    });

    // AI Chat Agent (Powered by Google Gemini - Free Tier)
    Route::prefix('ai-agent')->group(function () {
        Route::get('/', [AiChatAgentController::class, 'show']);
        Route::get('/model-info', [AiChatAgentController::class, 'modelInfo']);
        Route::put('/', [AiChatAgentController::class, 'update']);
        Route::post('/reset-instructions', [AiChatAgentController::class, 'resetInstructions']);
        Route::post('/test-chat', [AiChatAgentController::class, 'testChat']);
        Route::get('/documents', [AiChatAgentController::class, 'listDocuments']);
        Route::post('/documents', [AiChatAgentController::class, 'uploadDocument']);
        Route::delete('/documents/{id}', [AiChatAgentController::class, 'deleteDocument']);
        Route::get('/logs', [AiChatAgentController::class, 'listLogs']);
    });

    // AI Plans and Token Usage (tenant-facing routes only)
    Route::prefix('ai-plans')->group(function () {
        Route::get('/', [AiPlanController::class, 'index']); // List all plans
        Route::get('/current', [AiPlanController::class, 'current']); // Get current tenant plan & usage
        Route::get('/usage', [AiPlanController::class, 'usage']); // Detailed usage stats
        Route::get('/compare', [AiPlanController::class, 'compare']); // Plan comparison table
        Route::post('/change', [AiPlanController::class, 'changePlan']); // Change plan
    });

    // AI Learning - Generative AI that learns and improves
    Route::prefix('ai-learning')->group(function () {
        // Feedback
        Route::post('/feedback', [AILearningController::class, 'feedback']); // Record feedback
        Route::get('/feedback', [AILearningController::class, 'feedbackHistory']); // View feedback history
        Route::post('/feedback/process', [AILearningController::class, 'processFeedback']); // Process pending
        
        // Statistics & Insights
        Route::get('/stats', [AILearningController::class, 'stats']); // Learning stats
        
        // Memories (learned facts)
        Route::get('/memories', [AILearningController::class, 'memories']); // List memories
        Route::post('/memories', [AILearningController::class, 'addMemory']); // Add memory manually
        Route::put('/memories/{id}', [AILearningController::class, 'updateMemory']); // Update memory
        Route::delete('/memories/{id}', [AILearningController::class, 'deleteMemory']); // Delete memory
        
        // FAQ Cache
        Route::get('/faq', [AILearningController::class, 'faq']); // List auto-generated FAQs
        Route::put('/faq/{id}/verify', [AILearningController::class, 'verifyFaq']); // Verify/approve FAQ
        
        // Patterns
        Route::get('/patterns', [AILearningController::class, 'patterns']); // View learned patterns
    });

    // Tenant Settings
    Route::prefix('tenant')->group(function () {
        Route::get('/', [TenantController::class, 'show']);
        Route::get('/current', [TenantController::class, 'current']); // Alias for show (for PermissionProvider)
        Route::put('/', [TenantController::class, 'update']);
        Route::post('logo', [TenantController::class, 'uploadLogo']);
        Route::delete('logo', [TenantController::class, 'deleteLogo']);
        Route::get('usage', [TenantController::class, 'usage']);
        Route::get('limits', [TenantController::class, 'limits']);
        Route::get('subscription-status', [TenantController::class, 'subscriptionStatus']);
    });

    // Subscription Management
    Route::prefix('subscription')->group(function () {
        Route::get('/', [SubscriptionController::class, 'current']);
        Route::post('upgrade', [SubscriptionController::class, 'upgrade']);
        Route::post('cancel', [SubscriptionController::class, 'cancel']);
        Route::get('invoices', [SubscriptionController::class, 'invoices']);
    });

    // Pricing (authenticated)
    Route::prefix('pricing')->group(function () {
        Route::get('usage', [PricingController::class, 'usage']);
        Route::post('simulate-upgrade', [PricingController::class, 'simulateUpgrade']);
    });

    // PayPal Payment Routes
    Route::prefix('paypal')->group(function () {
        Route::post('create-order', [PayPalController::class, 'createOrder']);
        Route::post('create-subscription', [PayPalController::class, 'createSubscription']);
        Route::post('capture-order', [PayPalController::class, 'captureOrder']);
        Route::post('cancel-subscription', [PayPalController::class, 'cancelSubscription']);
        Route::get('payment-history', [PayPalController::class, 'paymentHistory']);
    });

    // ==========================================
    // EMAIL MODULE
    // ==========================================
    Route::prefix('email')->group(function () {
        // Email Accounts
        Route::get('accounts', [App\Http\Controllers\Api\EmailAccountController::class, 'index']);
        Route::post('accounts/oauth/{provider}/auth', [App\Http\Controllers\Api\EmailAccountController::class, 'getOAuthUrl']);
        // OAuth callback is public (defined outside jwt.auth middleware)
        Route::post('accounts/imap', [App\Http\Controllers\Api\EmailAccountController::class, 'connectImap']);
        Route::put('accounts/{id}', [App\Http\Controllers\Api\EmailAccountController::class, 'update']);
        Route::delete('accounts/{id}', [App\Http\Controllers\Api\EmailAccountController::class, 'destroy']);
        Route::post('accounts/{id}/sync', [App\Http\Controllers\Api\EmailAccountController::class, 'syncAccount']);

        // Email Inbox
        Route::get('inbox', [App\Http\Controllers\Api\EmailInboxController::class, 'index']);
        Route::get('inbox/unread-count', [App\Http\Controllers\Api\EmailInboxController::class, 'getUnreadCount']);
        Route::get('inbox/{id}', [App\Http\Controllers\Api\EmailInboxController::class, 'show']);
        Route::post('inbox/{id}/read', [App\Http\Controllers\Api\EmailInboxController::class, 'markAsRead']);
        Route::post('inbox/{id}/archive', [App\Http\Controllers\Api\EmailInboxController::class, 'archive']);
        Route::post('inbox/{id}/star', [App\Http\Controllers\Api\EmailInboxController::class, 'star']);
        Route::post('inbox/{id}/link', [App\Http\Controllers\Api\EmailInboxController::class, 'link']);
        Route::delete('inbox/{id}', [App\Http\Controllers\Api\EmailInboxController::class, 'destroy']);
        
        // Email by Contact/Pipeline Card
        Route::get('contacts/{contactId}/threads', [App\Http\Controllers\Api\EmailInboxController::class, 'getContactThreads']);
        Route::get('pipeline-cards/{cardId}/threads', [App\Http\Controllers\Api\EmailInboxController::class, 'getPipelineCardThreads']);

        // Email Messages
        Route::post('send', [App\Http\Controllers\Api\EmailMessageController::class, 'send']);
        Route::post('messages/{id}/reply', [App\Http\Controllers\Api\EmailMessageController::class, 'reply']);
        Route::post('messages/{id}/forward', [App\Http\Controllers\Api\EmailMessageController::class, 'forward']);

        // Email Marketing (campaigns & templates)
        Route::prefix('marketing')->group(function () {
            Route::get('templates', [App\Http\Controllers\Api\EmailTemplateController::class, 'index']);
            Route::post('templates', [App\Http\Controllers\Api\EmailTemplateController::class, 'store']);
            Route::get('templates/{id}', [App\Http\Controllers\Api\EmailTemplateController::class, 'show']);
            Route::put('templates/{id}', [App\Http\Controllers\Api\EmailTemplateController::class, 'update']);
            Route::delete('templates/{id}', [App\Http\Controllers\Api\EmailTemplateController::class, 'destroy']);
            Route::get('campaigns', [App\Http\Controllers\Api\EmailCampaignController::class, 'index']);
            Route::post('campaigns', [App\Http\Controllers\Api\EmailCampaignController::class, 'store']);
            Route::get('campaigns/{id}', [App\Http\Controllers\Api\EmailCampaignController::class, 'show']);
            Route::put('campaigns/{id}', [App\Http\Controllers\Api\EmailCampaignController::class, 'update']);
            Route::delete('campaigns/{id}', [App\Http\Controllers\Api\EmailCampaignController::class, 'destroy']);
            Route::post('campaigns/{id}/send', [App\Http\Controllers\Api\EmailCampaignController::class, 'send']);
            Route::get('campaigns/{id}/recipients', [App\Http\Controllers\Api\EmailCampaignController::class, 'recipients']);
        });
    });

    // ==========================================
    // PIPELINE ADDON
    // ==========================================
    Route::prefix('pipeline-addon')->group(function () {
        Route::post('activate', [App\Http\Controllers\Api\PipelineAddonController::class, 'activate']);
        Route::post('deactivate', [App\Http\Controllers\Api\PipelineAddonController::class, 'deactivate']);
        Route::get('usage', [App\Http\Controllers\Api\PipelineAddonController::class, 'currentUsage']);
        Route::get('usage/history', [App\Http\Controllers\Api\PipelineAddonController::class, 'usageHistory']);
    });

    // ==========================================
    // EMAIL CAMPAIGNS ADDON (base de leads)
    // ==========================================
    Route::prefix('email-campaigns-addon')->group(function () {
        Route::get('tiers', [App\Http\Controllers\Api\EmailCampaignsAddonController::class, 'tiers']);
        Route::post('activate', [App\Http\Controllers\Api\EmailCampaignsAddonController::class, 'activate']);
        Route::post('deactivate', [App\Http\Controllers\Api\EmailCampaignsAddonController::class, 'deactivate']);
        Route::put('tier', [App\Http\Controllers\Api\EmailCampaignsAddonController::class, 'updateTier']);
    });

    // ==========================================
    // SUPER ADMIN ROUTES (Driver de Vendas Owners Only)
    // ==========================================
    Route::prefix('super-admin')->middleware(\App\Http\Middleware\SuperAdminMiddleware::class)->group(function () {
        // Dashboard
        Route::get('/dashboard', [SuperAdminController::class, 'dashboard']);
        Route::get('/charts/tenants-growth', [SuperAdminController::class, 'tenantsGrowthChart']);
        Route::get('/charts/ai-usage', [SuperAdminController::class, 'aiUsageChart']);
        
        // Tenants Management
        Route::get('/tenants', [SuperAdminController::class, 'listTenants']);
        Route::get('/tenants/{id}', [SuperAdminController::class, 'showTenant']);
        Route::put('/tenants/{id}', [SuperAdminController::class, 'updateTenant']);
        Route::post('/tenants/{id}/suspend', [SuperAdminController::class, 'suspendTenant']);
        Route::post('/tenants/{id}/activate', [SuperAdminController::class, 'activateTenant']);
        Route::post('/tenants/{id}/change-plan', [SuperAdminController::class, 'changeTenantPlan']);
        
        // AI Costs & Usage
        Route::get('/ai/usage-by-tenant', [SuperAdminController::class, 'aiUsageByTenant']);
        Route::get('/ai/cost-projection', [SuperAdminController::class, 'aiCostProjection']);
        Route::get('/ai/top-features', [SuperAdminController::class, 'aiTopFeatures']);
        
        // Subscriptions
        Route::get('/subscriptions', [SuperAdminController::class, 'listSubscriptions']);
        
        // Audit Logs
        Route::get('/audit-logs', [SuperAdminController::class, 'auditLogs']);
        
        // Super Admin Management
        Route::get('/admins', [SuperAdminController::class, 'listSuperAdmins']);
        Route::post('/admins', [SuperAdminController::class, 'addSuperAdmin']);
        Route::delete('/admins/{userId}', [SuperAdminController::class, 'removeSuperAdmin']);
        
        // SECURITY: AI Plans CRUD (super admin only)
        Route::post('/ai-plans', [AiPlanController::class, 'store']);
        Route::put('/ai-plans/{id}', [AiPlanController::class, 'update']);
        Route::delete('/ai-plans/{id}', [AiPlanController::class, 'destroy']);
        Route::post('/ai-plans/custom-limits', [AiPlanController::class, 'setCustomLimits']);
    });
});

// Webhook for WhatsApp service (no auth required)
Route::post('/whatsapp/webhook', [WhatsappController::class, 'webhook']);

// WhatsApp media proxy (no auth required, serves media from WhatsApp service)
Route::get('/whatsapp/media/{filename}', [WhatsappController::class, 'proxyMedia'])
    ->where('filename', '.*');

// PayPal Webhook (no auth required, verified by signature)
Route::post('paypal/webhook', [PayPalController::class, 'webhook']);
