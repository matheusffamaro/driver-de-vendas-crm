import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/auth-store'
import { useSuperAdminAuthStore } from '@/stores/super-admin-auth-store'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
})

// SUPER ADMIN HTTP (separate auth storage)
export const superAdminHttp = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
})

// Request interceptor - add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const state = useAuthStore.getState()
    
    if (state.accessToken) {
      config.headers.Authorization = `Bearer ${state.accessToken}`
    }
    
    return config
  },
  (error) => Promise.reject(error)
)

// Super Admin request interceptor - add super admin token
superAdminHttp.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const state = useSuperAdminAuthStore.getState()
    if (state.accessToken) {
      config.headers.Authorization = `Bearer ${state.accessToken}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    
    // If 401 and not already retried, try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      
      const state = useAuthStore.getState()
      
      if (state.refreshToken) {
        try {
          const response = await axios.post(`${API_URL}/auth/refresh`, {
            refresh_token: state.refreshToken,
          })
          
          const { access_token, refresh_token } = response.data.data
          
          state.setTokens({ access_token, refresh_token })
          
          originalRequest.headers.Authorization = `Bearer ${access_token}`
          return api(originalRequest)
        } catch (refreshError) {
          // Refresh failed, logout
          state.logout()
          window.location.href = '/auth/login'
          return Promise.reject(refreshError)
        }
      }
    }
    
    return Promise.reject(error)
  }
)

// Super Admin response interceptor - handle token refresh
superAdminHttp.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      const state = useSuperAdminAuthStore.getState()
      if (state.refreshToken) {
        try {
          const response = await axios.post(`${API_URL}/auth/refresh`, {
            refresh_token: state.refreshToken,
          })

          const { access_token, refresh_token } = response.data.data
          state.setTokens({ access_token, refresh_token })

          originalRequest.headers.Authorization = `Bearer ${access_token}`
          return superAdminHttp(originalRequest)
        } catch (refreshError) {
          state.logout()
          window.location.href = '/super-admin/login'
          return Promise.reject(refreshError)
        }
      }
    }
    
    return Promise.reject(error)
  }
)

// API response types
export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
  meta?: {
    current_page: number
    per_page: number
    total: number
    last_page: number
  }
}

export interface ApiError {
  success: false
  message: string
  errors?: Record<string, string[]>
  error_code?: string
}

// Auth API
export const authApi = {
  login: (data: { email: string; password: string; tenant_id?: string }) =>
    api.post('/auth/login', data),
  
  register: (data: {
    name: string
    email: string
    password: string
    password_confirmation: string
    tenant_name: string
    tenant_document?: string
  }) => api.post('/auth/register', data),
  
  logout: () => api.post('/auth/logout'),
  
  refresh: (refresh_token: string) =>
    api.post('/auth/refresh', { refresh_token }),
  
  me: () => api.get('/auth/me'),
  
  switchTenant: (tenant_id: string) =>
    api.post('/auth/switch-tenant', { tenant_id }),
  
  updateProfile: (data: { name?: string; avatar_url?: string }) =>
    api.put('/auth/profile', data),
  
  updatePassword: (data: {
    current_password: string
    password: string
    password_confirmation: string
  }) => api.put('/auth/password', data),
  
  // Invitation methods
  getInvitation: (token: string) =>
    api.get(`/auth/invitation/${token}`),
  
  acceptInvitation: (token: string, data: { name: string; password: string; password_confirmation: string }) =>
    api.post(`/auth/invitation/${token}/accept`, data),
}

// Dashboard API
export const dashboardApi = {
  getData: (params?: { period?: string; start_date?: string; end_date?: string }) =>
    api.get('/dashboard', { params }),
}

// Clients API
export const clientsApi = {
  list: (params?: { page?: number; per_page?: number; search?: string; status?: string }) =>
    api.get('/clients', { params }),
  
  get: (id: string) => api.get(`/clients/${id}`),
  
  create: (data: any) => api.post('/clients', data),
  
  update: (id: string, data: any) => api.put(`/clients/${id}`, data),
  
  delete: (id: string) => api.delete(`/clients/${id}`),
  
  transactions: (id: string, params?: { page?: number }) =>
    api.get(`/clients/${id}/transactions`, { params }),

  exportCsv: () => api.get('/clients/export', { responseType: 'blob' }),

  importCsv: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/clients/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  customFields: {
    list: () => api.get('/clients/custom-fields'),
    update: (fields: any[]) => api.put('/clients/custom-fields', { fields }),
  },
}

// Proposals API
export const proposalsApi = {
  send: (data: {
    to: string
    subject: string
    message?: string
    client_id?: string
    pipeline_card_id?: string
    file?: File
  }) => {
    const formData = new FormData()
    formData.append('to', data.to)
    formData.append('subject', data.subject)
    if (data.message) formData.append('message', data.message)
    if (data.client_id) formData.append('client_id', data.client_id)
    if (data.pipeline_card_id) formData.append('pipeline_card_id', data.pipeline_card_id)
    if (data.file) formData.append('file', data.file)
    return api.post('/proposals/send', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

// Financial API
export const financialApi = {
  transactions: {
    list: (params?: any) => api.get('/financial/transactions', { params }),
    get: (id: string) => api.get(`/financial/transactions/${id}`),
    create: (data: any) => api.post('/financial/transactions', data),
    update: (id: string, data: any) => api.put(`/financial/transactions/${id}`, data),
    markAsPaid: (id: string, data?: any) => api.patch(`/financial/transactions/${id}/pay`, data),
    delete: (id: string) => api.delete(`/financial/transactions/${id}`),
    export: (params?: any) => api.get('/financial/transactions/export', { params, responseType: 'blob' }),
  },
  categories: {
    list: () => api.get('/financial/categories'),
    create: (data: any) => api.post('/financial/categories', data),
    update: (id: string, data: any) => api.put(`/financial/categories/${id}`, data),
    delete: (id: string) => api.delete(`/financial/categories/${id}`),
  },
  attachments: {
    list: (transactionId: string) => api.get(`/financial/transactions/${transactionId}/attachments`),
    upload: (transactionId: string, file: File, description?: string) => {
      const formData = new FormData()
      formData.append('file', file)
      if (description) formData.append('description', description)
      return api.post(`/financial/transactions/${transactionId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    download: (transactionId: string, attachmentId: string) =>
      api.get(`/financial/transactions/${transactionId}/attachments/${attachmentId}/download`, { responseType: 'blob' }),
    delete: (transactionId: string, attachmentId: string) =>
      api.delete(`/financial/transactions/${transactionId}/attachments/${attachmentId}`),
  },
}

// Bank Accounts API
export const bankAccountsApi = {
  list: (params?: { active_only?: boolean }) => api.get('/bank-accounts', { params }),
  get: (id: string) => api.get(`/bank-accounts/${id}`),
  create: (data: any) => api.post('/bank-accounts', data),
  update: (id: string, data: any) => api.put(`/bank-accounts/${id}`, data),
  delete: (id: string) => api.delete(`/bank-accounts/${id}`),
  banks: () => api.get('/bank-accounts/banks'),
  types: () => api.get('/bank-accounts/types'),
}

// Bank Reconciliation API
export const reconciliationApi = {
  import: (file: File, bankAccountId: string) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('bank_account_id', bankAccountId)
    return api.post('/reconciliation/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  statements: (params?: { bank_account_id?: string; page?: number }) =>
    api.get('/reconciliation/statements', { params }),
  getStatement: (id: string) => api.get(`/reconciliation/statements/${id}`),
  pendingEntries: (params?: { bank_account_id?: string; statement_id?: string; page?: number }) =>
    api.get('/reconciliation/pending', { params }),
  getSuggestions: (entryId: string) => api.get(`/reconciliation/entries/${entryId}/suggestions`),
  matchEntry: (entryId: string, transactionId: string) =>
    api.post(`/reconciliation/entries/${entryId}/match`, { transaction_id: transactionId }),
  createFromEntry: (entryId: string, data?: { category_id?: string; client_id?: string; description?: string }) =>
    api.post(`/reconciliation/entries/${entryId}/create`, data),
  ignoreEntry: (entryId: string) => api.post(`/reconciliation/entries/${entryId}/ignore`),
  bulkProcess: (action: 'create' | 'ignore', entryIds: string[], categoryId?: string) =>
    api.post('/reconciliation/bulk', { action, entry_ids: entryIds, category_id: categoryId }),
  summary: (bankAccountId?: string) =>
    api.get('/reconciliation/summary', { params: { bank_account_id: bankAccountId } }),
}

// Cash Flow API
export const cashFlowApi = {
  dashboard: (period?: 'week' | 'month' | 'quarter' | 'year') =>
    api.get('/cashflow/dashboard', { params: { period } }),
  forecast: (params?: { months?: number; start_date?: string }) =>
    api.get('/cashflow/forecast', { params }),
  payables: (params?: { page?: number; per_page?: number }) =>
    api.get('/cashflow/payables', { params }),
  receivables: (params?: { page?: number; per_page?: number }) =>
    api.get('/cashflow/receivables', { params }),
  categoryBreakdown: (type: 'income' | 'expense', startDate?: string, endDate?: string) =>
    api.get('/cashflow/category-breakdown', { params: { type, start_date: startDate, end_date: endDate } }),
}

// Accounting Export API
export const accountingApi = {
  formats: () => api.get('/accounting/formats'),
  export: (data: {
    format: 'csv' | 'contabilidade' | 'dominio' | 'fortes' | 'alterdata'
    start_date: string
    end_date: string
    status?: 'all' | 'paid' | 'pending'
    include_cancelled?: boolean
  }) => api.post('/accounting/export', data, { responseType: 'blob' }),
}

// Users API
export const usersApi = {
  list: (params?: { page?: number; per_page?: number; search?: string; role?: string; is_active?: boolean }) =>
    api.get('/users', { params }),
  
  get: (id: string) => api.get(`/users/${id}`),
  
  me: () => api.get('/users/me'), // Get current user profile
  
  updateSignature: (signature: string) => api.put('/users/me/signature', { signature }), // Update signature
  
  create: (data: { name: string; email: string; password: string; role_id?: string; role?: string; phone?: string }) =>
    api.post('/users', data),
  
  update: (id: string, data: any) => api.put(`/users/${id}`, data),
  
  remove: (id: string) => api.delete(`/users/${id}`),
  
  // User actions
  suspend: (id: string, reason?: string) => api.post(`/users/${id}/suspend`, { reason }),
  
  activate: (id: string) => api.post(`/users/${id}/activate`),
  
  updateRole: (id: string, role_id: string) => api.put(`/users/${id}/role`, { role_id }),
  
  // Statistics
  statistics: () => api.get('/users/statistics'),
  
  // My permissions
  myPermissions: () => api.get('/users/my-permissions'),
  
  // Roles
  listRoles: () => api.get('/roles'),
  
  // Invitation methods
  pendingInvitations: () => api.get('/users/invitations'),
  
  sendInvitation: (data: { email: string; name?: string; role_id?: string; role?: string }) =>
    api.post('/users/invitations', data),
  
  // Alias for sendInvitation (used by invite modal)
  invite: (data: { email: string; role_id: string }) =>
    api.post('/users/invitations', data),
  
  resendInvitation: (id: string) =>
    api.post(`/users/invitations/${id}/resend`),
  
  cancelInvitation: (id: string) =>
    api.delete(`/users/invitations/${id}`),
}

// Roles API
export const rolesApi = {
  list: () => api.get('/roles'),
  
  listPermissions: () => api.get('/permissions'),
  
  create: (data: { name: string; slug: string; description?: string; permissions: string[] }) =>
    api.post('/roles', data),
  
  update: (id: string, data: { name?: string; description?: string; permissions?: string[] }) =>
    api.put(`/roles/${id}`, data),
  
  remove: (id: string) => api.delete(`/roles/${id}`),
}

// Tenant API
export const tenantApi = {
  get: () => api.get('/tenant'),
  
  update: (data: any) => api.put('/tenant', data),
  
  uploadLogo: (file: File) => {
    const formData = new FormData()
    formData.append('logo', file)
    return api.post('/tenant/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  
  deleteLogo: () => api.delete('/tenant/logo'),
}

// Subscription API
export const subscriptionApi = {
  current: () => api.get('/subscription'),
  plans: () => api.get('/plans'),
  upgrade: (data: { plan_id: string; billing_cycle: string }) =>
    api.post('/subscription/upgrade', data),
  cancel: (data?: { reason?: string }) => api.post('/subscription/cancel', data),
}

// Pricing API
export const pricingApi = {
  plans: () => api.get('/pricing/plans'),
  tiers: () => api.get('/pricing/tiers'),
  calculate: (data: {
    plan_id: string
    users: number
    clients: number
    products: number
    transactions: number
    billing_cycle?: 'monthly' | 'yearly'
  }) => api.post('/pricing/calculate', data),
  recommend: (data: {
    users: number
    clients: number
    products: number
    transactions: number
  }) => api.post('/pricing/recommend', data),
  usage: () => api.get('/pricing/usage'),
  simulateUpgrade: (data: {
    plan_id: string
    users: number
    clients: number
    products: number
    transactions: number
    billing_cycle?: 'monthly' | 'yearly'
  }) => api.post('/pricing/simulate-upgrade', data),
}

// Reports API
export const reportsApi = {
  monthly: (params?: { year?: number; month?: number }) =>
    api.get('/reports/monthly', { params }),
  yearly: (params?: { year?: number }) =>
    api.get('/reports/yearly', { params }),
  cashflow: (params?: { start_date?: string; end_date?: string }) =>
    api.get('/reports/cashflow', { params }),
}

// PayPal API
export const paypalApi = {
  createOrder: (data: { 
    plan_id: string
    billing_cycle: 'monthly' | 'yearly'
    quantities?: {
      users?: number
      clients?: number
      products?: number
      transactions?: number
    }
  }) => api.post('/paypal/create-order', data),
  
  captureOrder: (data: { order_id: string }) => 
    api.post('/paypal/capture-order', data),
  
  createSubscription: (data: {
    plan_id: string
    billing_cycle: 'monthly' | 'yearly'
  }) => api.post('/paypal/create-subscription', data),
  
  cancelSubscription: (data: { subscription_id: string }) =>
    api.post('/paypal/cancel-subscription', data),
  
  paymentHistory: () => api.get('/paypal/payment-history'),
}

// Quotes API (Orçamentos)
export const quotesApi = {
  list: (params?: { 
    page?: number
    per_page?: number
    search?: string
    status?: string
    client_id?: string
    start_date?: string
    end_date?: string
  }) => api.get('/quotes', { params }),
  
  stats: () => api.get('/quotes/stats'),
  
  get: (id: string) => api.get(`/quotes/${id}`),
  
  create: (data: {
    client_id: string
    valid_until?: string
    notes?: string
    internal_notes?: string
    payment_terms?: string
    delivery_terms?: string
    delivery_days?: number
    discount_percent?: number
    discount_amount?: number
    tax_percent?: number
    shipping_cost?: number
    items: Array<{
      product_id?: string
      description: string
      sku?: string
      unit?: string
      quantity: number
      unit_price: number
      discount_percent?: number
      notes?: string
    }>
  }) => api.post('/quotes', data),
  
  update: (id: string, data: any) => api.put(`/quotes/${id}`, data),
  
  delete: (id: string) => api.delete(`/quotes/${id}`),
  
  send: (id: string) => api.post(`/quotes/${id}/send`),
  
  approve: (id: string, data?: { 
    create_transaction?: boolean
    payment_status?: 'pending' | 'paid'
    due_date?: string 
  }) => api.post(`/quotes/${id}/approve`, data),
  
  reject: (id: string, reason: string) => api.post(`/quotes/${id}/reject`, { reason }),
  
  duplicate: (id: string) => api.post(`/quotes/${id}/duplicate`),
}

// Products API
export const productsApi = {
  list: (params?: { page?: number; per_page?: number; search?: string; category_id?: string; is_active?: boolean }) =>
    api.get('/products', { params }),
  
  get: (id: string) => api.get(`/products/${id}`),
  
  create: (data: any) => api.post('/products', data),
  
  update: (id: string, data: any) => api.put(`/products/${id}`, data),
  
  delete: (id: string) => api.delete(`/products/${id}`),
  
  updateStock: (id: string, data: { quantity: number; operation: 'set' | 'add' | 'subtract'; notes?: string }) =>
    api.patch(`/products/${id}/stock`, data),
  
  units: () => api.get('/products/units'),
  
  categories: {
    list: () => api.get('/products/categories'),
    create: (data: any) => api.post('/products/categories', data),
    update: (id: string, data: any) => api.put(`/products/categories/${id}`, data),
    delete: (id: string) => api.delete(`/products/categories/${id}`),
  },

  exportCsv: (params?: { type?: 'product' | 'service' }) =>
    api.get('/products/export', { params, responseType: 'blob' }),

  importCsv: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/products/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

// ==========================================
// CRM APIs
// ==========================================

// Pipeline (Sales Funnel) API
export const pipelineApi = {
  list: (params?: { active_only?: boolean }) => api.get('/pipelines', { params }),
  get: (id: string) => api.get(`/pipelines/${id}`),
  create: (data: { name: string; description?: string; is_default?: boolean }) =>
    api.post('/pipelines', data),
  update: (id: string, data: any) => api.put(`/pipelines/${id}`, data),
  delete: (id: string) => api.delete(`/pipelines/${id}`),
  updateStages: (id: string, stages: any[]) =>
    api.put(`/pipelines/${id}/stages`, { stages }),
  updateCustomFields: (id: string, fields: any[]) =>
    api.put(`/pipelines/${id}/custom-fields`, { fields }),
  report: (id: string, params?: { start_date?: string; end_date?: string; assigned_to?: string; by_salesperson?: boolean }) =>
    api.get(`/pipelines/${id}/report`, { params }),
    
  // Cards
  cards: {
    list: (pipelineId: string, params?: { contact_id?: string; assigned_to?: string; priority?: string; search?: string }) =>
      api.get(`/pipelines/${pipelineId}/cards`, { params }),
    listView: (pipelineId: string, params?: { page?: number; per_page?: number; stage_id?: string; sort_by?: string; sort_dir?: string }) =>
      api.get(`/pipelines/${pipelineId}/cards/list`, { params }),
    get: (pipelineId: string, id: string) => api.get(`/pipelines/${pipelineId}/cards/${id}`),
    create: (pipelineId: string, data: any) => api.post(`/pipelines/${pipelineId}/cards`, data),
    update: (pipelineId: string, id: string, data: any) =>
      api.put(`/pipelines/${pipelineId}/cards/${id}`, data),
    move: (pipelineId: string, id: string, data: { stage_id: string; position?: number; lost_reason?: string }) =>
      api.post(`/pipelines/${pipelineId}/cards/${id}/move`, data),
    reorder: (pipelineId: string, stageId: string, cards: { id: string; position: number }[]) =>
      api.post(`/pipelines/${pipelineId}/cards/reorder`, { stage_id: stageId, cards }),
    updateProducts: (pipelineId: string, id: string, products: any[]) =>
      api.put(`/pipelines/${pipelineId}/cards/${id}/products`, { products }),
    delete: (pipelineId: string, id: string) =>
      api.delete(`/pipelines/${pipelineId}/cards/${id}`),
    
    // Comments (Timeline)
    comments: {
      list: (pipelineId: string, cardId: string) =>
        api.get(`/pipelines/${pipelineId}/cards/${cardId}/comments`),
      create: (pipelineId: string, cardId: string, content: string) =>
        api.post(`/pipelines/${pipelineId}/cards/${cardId}/comments`, { content }),
      update: (pipelineId: string, cardId: string, commentId: string, content: string) =>
        api.put(`/pipelines/${pipelineId}/cards/${cardId}/comments/${commentId}`, { content }),
      delete: (pipelineId: string, cardId: string, commentId: string) =>
        api.delete(`/pipelines/${pipelineId}/cards/${cardId}/comments/${commentId}`),
    },

    // Emails
    emails: {
      list: (pipelineId: string, cardId: string) =>
        api.get(`/pipelines/${pipelineId}/cards/${cardId}/emails`),
      create: (pipelineId: string, cardId: string, data: { to: string; cc?: string; bcc?: string; subject: string; body: string }) =>
        api.post(`/pipelines/${pipelineId}/cards/${cardId}/emails`, data),
      delete: (pipelineId: string, cardId: string, emailId: string) =>
        api.delete(`/pipelines/${pipelineId}/cards/${cardId}/emails/${emailId}`),
    },

    // AI Auto-fill
    aiAutoFill: (pipelineId: string, cardId: string) =>
      api.post(`/pipelines/${pipelineId}/cards/${cardId}/ai-autofill`),

    // Archive
    archive: (pipelineId: string, cardId: string) =>
      api.post(`/pipelines/${pipelineId}/cards/${cardId}/archive`),
    unarchive: (pipelineId: string, cardId: string) =>
      api.post(`/pipelines/${pipelineId}/cards/${cardId}/unarchive`),

    // Attachments
    attachments: {
      list: (pipelineId: string, cardId: string) =>
        api.get(`/pipelines/${pipelineId}/cards/${cardId}/attachments`),
      upload: (pipelineId: string, cardId: string, file: File) => {
        const formData = new FormData()
        formData.append('file', file)
        return api.post(`/pipelines/${pipelineId}/cards/${cardId}/attachments`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      },
      delete: (pipelineId: string, cardId: string, attachmentId: string) =>
        api.delete(`/pipelines/${pipelineId}/cards/${cardId}/attachments/${attachmentId}`),
      downloadUrl: (pipelineId: string, cardId: string, attachmentId: string) =>
        `${api.defaults.baseURL}/pipelines/${pipelineId}/cards/${cardId}/attachments/${attachmentId}/download`,
    },
  },

  // Archived cards
  archived: (pipelineId: string, params?: { page?: number; per_page?: number }) =>
    api.get(`/pipelines/${pipelineId}/archived`, { params }),
}

// CRM Tasks API
export const crmTasksApi = {
  list: (params?: {
    page?: number
    per_page?: number
    status?: string
    assigned_to?: string
    my_tasks?: boolean
    card_id?: string
    contact_id?: string
    scheduled_from?: string
    scheduled_to?: string
    search?: string
    sort_by?: string
    sort_dir?: string
  }) => api.get('/crm/tasks', { params }),
  get: (id: string) => api.get(`/crm/tasks/${id}`),
  create: (data: {
    title: string
    description?: string
    card_id?: string
    contact_id?: string
    assigned_to?: string
    status?: string
    priority?: string
    scheduled_at?: string
  }) => api.post('/crm/tasks', data),
  update: (id: string, data: any) => api.put(`/crm/tasks/${id}`, data),
  delete: (id: string) => api.delete(`/crm/tasks/${id}`),
  addAttachment: (id: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`/crm/tasks/${id}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  removeAttachment: (id: string, attachmentId: string) =>
    api.delete(`/crm/tasks/${id}/attachments/${attachmentId}`),
}

// WhatsApp API
export const whatsappApi = {
  // Conversations with user filter (for managers)
  conversationsByUser: (params?: { user_ids?: string[]; page?: number; per_page?: number; search?: string; unread_only?: boolean }) =>
    api.get('/whatsapp/conversations/by-user', { params }),

  // Sessions (Legacy - keeping for backward compatibility)
  sessions: () => api.get('/whatsapp/sessions'),
  createSession: (data: { phone_number: string; session_name?: string }) =>
    api.post('/whatsapp/sessions', data),
  getQRCode: (sessionId: string) => api.get(`/whatsapp/sessions/${sessionId}/qr-code`),
  sessionStatus: (sessionId: string) => api.get(`/whatsapp/sessions/${sessionId}/status`),
  updateSession: (sessionId: string, data: { user_id?: string | null; is_global?: boolean }) =>
    api.put(`/whatsapp/sessions/${sessionId}`, data),
  disconnectSession: (sessionId: string) => api.post(`/whatsapp/sessions/${sessionId}/disconnect`),
  deleteSession: (sessionId: string) => api.delete(`/whatsapp/sessions/${sessionId}`),
  refreshProfilePictures: (sessionId: string) => api.post(`/whatsapp/sessions/${sessionId}/refresh-profile-pictures`),
  refreshGroupNames: (sessionId: string) => api.post(`/whatsapp/sessions/${sessionId}/refresh-group-names`),
  fixContactNames: (sessionId: string) => api.post(`/whatsapp/sessions/${sessionId}/fix-contact-names`),
  clearSessionData: (sessionId: string) => api.post(`/whatsapp/sessions/${sessionId}/clear-data`),
  reconnectSession: (sessionId: string) => api.post(`/whatsapp/sessions/${sessionId}/reconnect`),
  syncSession: (sessionId: string) => api.post(`/whatsapp/sessions/${sessionId}/sync`),
  fetchHistory: (conversationId: string, count?: number) => 
    api.post(`/whatsapp/conversations/${conversationId}/fetch-history`, { count: count || 50 }),
  
  // Conversations
  conversations: (sessionId: string, params?: {
    assigned_to?: string
    assigned_signature?: string
    my_conversations?: boolean
    unread_only?: boolean
    search?: string
    page?: number
    per_page?: number
  }) => api.get(`/whatsapp/sessions/${sessionId}/conversations`, { params }),
  startConversation: (sessionId: string, data: { phone_number: string; contact_id?: string; message?: string }) =>
    api.post(`/whatsapp/sessions/${sessionId}/conversations`, data),
  messages: (conversationId: string, params?: { page?: number; per_page?: number; limit?: number; mark_as_read?: boolean }) =>
    api.get(`/whatsapp/conversations/${conversationId}/messages`, { params }),
  sendMessage: (conversationId: string, data: { type: string; content?: string; media?: File }) => {
    if (data.media) {
      const formData = new FormData()
      formData.append('type', data.type)
      if (data.content) formData.append('content', data.content)
      formData.append('media', data.media)
      return api.post(`/whatsapp/conversations/${conversationId}/messages`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    }
    return api.post(`/whatsapp/conversations/${conversationId}/messages`, data)
  },
  linkContact: (conversationId: string, contactId: string) =>
    api.post(`/whatsapp/conversations/${conversationId}/link-contact`, { contact_id: contactId }),
  assignConversation: (conversationId: string, userId: string | null) =>
    api.post(`/whatsapp/conversations/${conversationId}/assign`, { user_id: userId }),
  togglePin: (conversationId: string) =>
    api.post(`/whatsapp/conversations/${conversationId}/pin`),
  archiveConversation: (conversationId: string) =>
    api.post(`/whatsapp/conversations/${conversationId}/archive`),
  
  // Quick Replies
  quickReplies: () => api.get('/whatsapp/quick-replies'),
  createQuickReply: (data: { shortcut: string; title: string; content: string }) =>
    api.post('/whatsapp/quick-replies', data),
  updateQuickReply: (id: string, data: any) => api.put(`/whatsapp/quick-replies/${id}`, data),
  deleteQuickReply: (id: string) => api.delete(`/whatsapp/quick-replies/${id}`),
  
  // Assignment Queues
  assignmentQueues: (sessionId: string) => api.get(`/whatsapp/sessions/${sessionId}/queues`),
  createAssignmentQueue: (sessionId: string, data: { name: string; user_ids: string[]; distribution_method?: string }) =>
    api.post(`/whatsapp/sessions/${sessionId}/queues`, data),
}

// AI Plans API
export const aiPlansApi = {
  list: () => api.get('/ai-plans'),
  current: () => api.get('/ai-plans/current'),
  usage: () => api.get('/ai-plans/usage'),
  compare: () => api.get('/ai-plans/compare'),
  changePlan: (planId: string) => api.post('/ai-plans/change', { plan_id: planId }),
}

// AI Learning API
export const aiLearningApi = {
  // Stats
  stats: () => api.get('/ai-learning/stats'),
  
  // Feedback
  feedback: (data: { 
    user_message: string
    ai_response: string
    rating: 'positive' | 'negative' | 'neutral'
    correction?: string
    conversation_id?: string
  }) => api.post('/ai-learning/feedback', data),
  feedbackHistory: (params?: { rating?: string; limit?: number }) => 
    api.get('/ai-learning/feedback', { params }),
  processFeedback: () => api.post('/ai-learning/feedback/process'),
  
  // Memories
  memories: (params?: { type?: string; limit?: number }) => 
    api.get('/ai-learning/memories', { params }),
  addMemory: (data: { key: string; value: string; type: string; category?: string }) =>
    api.post('/ai-learning/memories', data),
  updateMemory: (id: string, data: any) => api.put(`/ai-learning/memories/${id}`, data),
  deleteMemory: (id: string) => api.delete(`/ai-learning/memories/${id}`),
  
  // FAQ
  faq: (params?: { limit?: number }) => api.get('/ai-learning/faq', { params }),
  verifyFaq: (id: string, answer?: string) => api.put(`/ai-learning/faq/${id}/verify`, { answer }),
  
  // Patterns
  patterns: (params?: { limit?: number }) => api.get('/ai-learning/patterns', { params }),
}

// ==========================================
// SUPER ADMIN API (Driver de Vendas Owners)
// ==========================================
export const superAdminApi = {
  // Dashboard
  dashboard: () => superAdminHttp.get('/super-admin/dashboard'),
  tenantsGrowthChart: (period?: string) => 
    superAdminHttp.get('/super-admin/charts/tenants-growth', { params: { period } }),
  aiUsageChart: (period?: string) => 
    superAdminHttp.get('/super-admin/charts/ai-usage', { params: { period } }),
  
  // Tenants
  tenants: {
    list: (params?: { 
      page?: number
      per_page?: number
      search?: string
      status?: string
      plan_id?: string
      sort?: string
      direction?: string
    }) => superAdminHttp.get('/super-admin/tenants', { params }),
    get: (id: string) => superAdminHttp.get(`/super-admin/tenants/${id}`),
    update: (id: string, data: any) => superAdminHttp.put(`/super-admin/tenants/${id}`, data),
    suspend: (id: string, reason?: string) => 
      superAdminHttp.post(`/super-admin/tenants/${id}/suspend`, { reason }),
    activate: (id: string) => superAdminHttp.post(`/super-admin/tenants/${id}/activate`),
    changePlan: (id: string, planId: string) =>
      superAdminHttp.post(`/super-admin/tenants/${id}/change-plan`, { plan_id: planId }),
  },
  
  // AI Usage & Costs
  ai: {
    usageByTenant: (period?: string) => 
      superAdminHttp.get('/super-admin/ai/usage-by-tenant', { params: { period } }),
    costProjection: () => superAdminHttp.get('/super-admin/ai/cost-projection'),
    topFeatures: (period?: string) => 
      superAdminHttp.get('/super-admin/ai/top-features', { params: { period } }),
  },
  
  // Subscriptions
  subscriptions: {
    list: (params?: { status?: string; search?: string; page?: number; per_page?: number }) =>
      superAdminHttp.get('/super-admin/subscriptions', { params }),
  },
  
  // Audit Logs
  auditLogs: (params?: { action?: string; search?: string; user_id?: string; page?: number; per_page?: number }) =>
    superAdminHttp.get('/super-admin/audit-logs', { params }),
  
  // Super Admin Management
  admins: {
    list: () => superAdminHttp.get('/super-admin/admins'),
    add: (email: string) => superAdminHttp.post('/super-admin/admins', { email }),
    remove: (userId: string) => superAdminHttp.delete(`/super-admin/admins/${userId}`),
  },
}

// Super Admin Auth API (separate login)
export const superAdminAuthApi = {
  login: (data: { email: string; password: string }) =>
    superAdminHttp.post('/super-admin/auth/login', data),
  logout: () => superAdminHttp.post('/super-admin/auth/logout'),
}

// ==========================================
// EMAIL API
// ==========================================
export const emailApi = {
  // Email Accounts
  accounts: {
    list: () => api.get('/email/accounts'),
    getOAuthUrl: (provider: 'gmail' | 'outlook') => 
      api.post(`/email/accounts/oauth/${provider}/auth`),
    handleOAuthCallback: (provider: 'gmail' | 'outlook', code: string, state: string) =>
      api.post(`/email/accounts/oauth/${provider}/callback`, { code, state }),
    connectImap: (data: {
      email: string
      account_name: string
      imap_host: string
      imap_port: number
      imap_encryption: 'ssl' | 'tls' | 'none'
      imap_username?: string
      smtp_host: string
      smtp_port: number
      smtp_encryption: 'ssl' | 'tls' | 'none'
      smtp_username?: string
      password: string
    }) => api.post('/email/accounts/imap', data),
    update: (id: string, data: { account_name?: string; is_active?: boolean }) =>
      api.put(`/email/accounts/${id}`, data),
    delete: (id: string) => api.delete(`/email/accounts/${id}`),
    sync: (id: string) => api.post(`/email/accounts/${id}/sync`),
  },

  // Email Inbox
  inbox: {
    list: (params?: { 
      filter?: 'inbox' | 'unread' | 'starred' | 'archived' | 'sent'
      search?: string
      account_id?: string
      page?: number
      per_page?: number
    }) => api.get('/email/inbox', { params }),
    get: (id: string) => api.get(`/email/inbox/${id}`),
    markAsRead: (id: string, is_read: boolean) => 
      api.post(`/email/inbox/${id}/read`, { is_read }),
    archive: (id: string, is_archived: boolean) =>
      api.post(`/email/inbox/${id}/archive`, { is_archived }),
    star: (id: string, is_starred: boolean) =>
      api.post(`/email/inbox/${id}/star`, { is_starred }),
    link: (id: string, data: { contact_id?: string; pipeline_card_id?: string }) =>
      api.post(`/email/inbox/${id}/link`, data),
    delete: (id: string) => api.delete(`/email/inbox/${id}`),
    getUnreadCount: () => api.get('/email/inbox/unread-count'),
    getContactThreads: (contactId: string) => 
      api.get(`/email/contacts/${contactId}/threads`),
    getPipelineCardThreads: (cardId: string) =>
      api.get(`/email/pipeline-cards/${cardId}/threads`),
  },

  // Email Messages
  messages: {
    send: (data: {
      account_id: string
      to: Array<{ email: string; name?: string }>
      cc?: Array<{ email: string; name?: string }>
      bcc?: Array<{ email: string; name?: string }>
      subject: string
      body_html?: string
      body_text?: string
      track_opens?: boolean
      track_clicks?: boolean
    }) => api.post('/email/send', data),
    reply: (id: string, data: {
      body_html?: string
      body_text?: string
      reply_all?: boolean
    }) => api.post(`/email/messages/${id}/reply`, data),
    forward: (id: string, data: {
      to: Array<{ email: string; name?: string }>
      body_html?: string
      body_text?: string
    }) => api.post(`/email/messages/${id}/forward`, data),
  },
}

// Email template builder: block-based structure for professional editor
export type EmailTemplateBodyJson = {
  config?: { width?: number; bgColor?: string; fontFamily?: string }
  blocks?: EmailTemplateBlock[]
}
export type EmailTemplateBlock =
  | { type: 'title'; level?: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'image'; src: string; alt?: string; width?: string }
  | { type: 'button'; text: string; href: string }
  | { type: 'divider' }
  | { type: 'html'; content: string }

// Email Marketing API (campaigns & templates)
export const emailMarketingApi = {
  templates: {
    list: () => api.get('/email/marketing/templates'),
    get: (id: string) => api.get(`/email/marketing/templates/${id}`),
    create: (data: {
      name: string
      subject: string
      body_html?: string
      body_json?: EmailTemplateBodyJson
    }) => api.post('/email/marketing/templates', data),
    update: (id: string, data: {
      name?: string
      subject?: string
      body_html?: string
      body_json?: EmailTemplateBodyJson
    }) => api.put(`/email/marketing/templates/${id}`, data),
    delete: (id: string) => api.delete(`/email/marketing/templates/${id}`),
  },
  campaigns: {
    list: (params?: { status?: string }) => api.get('/email/marketing/campaigns', { params }),
    get: (id: string) => api.get(`/email/marketing/campaigns/${id}`),
    create: (data: {
      name: string
      subject: string
      body_html?: string
      email_template_id?: string
      email_account_id: string
      client_ids: string[]
    }) => api.post('/email/marketing/campaigns', data),
    update: (id: string, data: {
      name?: string
      subject?: string
      body_html?: string
      email_template_id?: string
      email_account_id?: string
      client_ids?: string[]
    }) => api.put(`/email/marketing/campaigns/${id}`, data),
    delete: (id: string) => api.delete(`/email/marketing/campaigns/${id}`),
    send: (id: string) => api.post(`/email/marketing/campaigns/${id}/send`),
    recipients: (id: string) => api.get(`/email/marketing/campaigns/${id}/recipients`),
  },
}

// Pipeline Addon API
export const pipelineAddonApi = {
  activate: () => api.post('/pipeline-addon/activate'),
  deactivate: () => api.post('/pipeline-addon/deactivate'),
  usage: () => api.get('/pipeline-addon/usage'),
  usageHistory: () => api.get('/pipeline-addon/usage/history'),
}

// Email Campaigns Addon API (base de leads)
export const emailCampaignsAddonApi = {
  tiers: () => api.get<{ data: Array<{ id: string; label: string; min_leads: number; max_leads: number | null; price_monthly: number }> }>('/email-campaigns-addon/tiers'),
  activate: (leadsTier: string) => api.post('/email-campaigns-addon/activate', { leads_tier: leadsTier }),
  deactivate: () => api.post('/email-campaigns-addon/deactivate'),
  updateTier: (leadsTier: string) => api.put('/email-campaigns-addon/tier', { leads_tier: leadsTier }),
}
