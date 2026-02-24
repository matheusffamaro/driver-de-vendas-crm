// User types
export interface User {
  id: string
  name: string
  email: string
  avatar_url?: string
  email_verified_at?: string
  created_at?: string
}

// Tenant types
export interface Tenant {
  id: string
  name: string
  slug: string
  document?: string
  email?: string
  phone?: string
  logo_url?: string
  address?: Address
  settings?: TenantSettings
  is_active: boolean
  created_at?: string
}

export interface Address {
  street?: string
  number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
  zip_code?: string
  country?: string
}

export interface TenantSettings {
  timezone: string
  locale: string
  currency: string
  date_format: string
  fiscal_year_start?: string
  notifications?: {
    email: boolean
    push: boolean
  }
  features?: {
    dark_mode: boolean
    export_csv: boolean
  }
}

// Role types
export interface Role {
  id: string
  name: string
  slug: 'admin' | 'manager' | 'sales' | 'support' | 'viewer' | string
  description?: string
  permissions?: string[]
  permissions_expanded?: string[]
  is_system?: boolean
}

// Client types
export interface Client {
  id: string
  tenant_id: string
  name: string
  email?: string
  phone?: string
  document?: string
  type: 'individual' | 'company'
  company_name?: string
  address?: Address
  notes?: string
  status: 'active' | 'inactive'
  custom_fields?: Record<string, any>
  quotes?: any[]
  metadata?: Record<string, any>
  created_at: string
  updated_at: string
  stats?: ClientStats
}

export interface ClientStats {
  total_transactions: number
  total_revenue: number
  total_expenses: number
  last_transaction_at?: string
  pending_amount: number
}

// Financial types
export interface FinancialCategory {
  id: string
  tenant_id: string
  name: string
  type: 'income' | 'expense'
  color: string
  icon?: string
  transactions_count?: number
}

export interface FinancialTransaction {
  id: string
  tenant_id: string
  client_id?: string
  category_id: string
  type: 'income' | 'expense'
  amount: number
  description: string
  date: string
  due_date?: string
  paid_at?: string
  status: 'pending' | 'paid' | 'overdue' | 'cancelled'
  payment_method?: PaymentMethod
  receipt_url?: string
  notes?: string
  metadata?: Record<string, any>
  created_at: string
  updated_at: string
  client?: Pick<Client, 'id' | 'name'>
  category?: Pick<FinancialCategory, 'id' | 'name' | 'color'>
}

export type PaymentMethod = 
  | 'pix'
  | 'credit_card'
  | 'debit_card'
  | 'bank_transfer'
  | 'cash'
  | 'boleto'
  | 'other'

// Plan types
export interface Plan {
  id: string
  name: string
  slug: 'free' | 'pro' | 'enterprise'
  description?: string
  price_monthly: number
  price_yearly: number
  base_price_monthly?: number
  base_price_yearly?: number
  max_users: number
  max_clients: number
  max_transactions: number
  has_dynamic_pricing?: boolean
  trial_days?: number
  features: PlanFeatures
  limits?: PlanLimits
  yearly_discount?: number
  is_active: boolean
}

export interface PlanLimits {
  users: number
  clients: number
  products: number
  transactions: number
}

export interface PlanFeatures {
  dashboard_advanced: boolean
  export_csv: boolean
  export_pdf: boolean
  api_access: boolean
  custom_reports: boolean
  priority_support: boolean
  white_label: boolean
  multi_currency: boolean
}

export interface PlanFeatureDetail {
  key: string
  name: string
  description?: string
  enabled: boolean
}

export interface PlanWithFeatures {
  id: string
  name: string
  slug: string
  description?: string
  price_monthly: number
  price_yearly: number
  base_price_monthly: number
  base_price_yearly: number
  has_dynamic_pricing: boolean
  trial_days: number
  limits: PlanLimits
  features: PlanFeatureDetail[]
}

// Pricing types
export interface PricingTier {
  min: number
  max: number
  price_per_unit: number
  flat_price: number
}

export interface PricingTierGroup {
  type: string
  label: string
  tiers: PricingTier[]
}

export interface PriceBreakdown {
  included: number
  requested: number
  extra: number
  price: number
}

export interface CalculatedPrice {
  base_price: number
  additional_users: number
  additional_clients: number
  additional_products: number
  additional_transactions: number
  subtotal: number
  discount: number
  total: number
  billing_cycle: 'monthly' | 'yearly'
  breakdown: {
    users: PriceBreakdown
    clients: PriceBreakdown
    products: PriceBreakdown
    transactions: PriceBreakdown
  }
}

export interface UsageLimits {
  has_limits: boolean
  limits: {
    users: number
    clients: number
    products: number
    transactions: number
  }
  usage: {
    users: number
    clients: number
    products: number
    transactions: number
  }
  exceeded: Record<string, {
    limit: number
    current: number
    overage: number
  }>
  can_upgrade: boolean
}

// Subscription types
export interface Subscription {
  id: string
  tenant_id: string
  plan_id: string
  status: 'active' | 'trial' | 'cancelled' | 'expired'
  trial_ends_at?: string
  starts_at?: string
  ends_at?: string
  cancelled_at?: string
  payment_method?: string
  plan?: Plan
}

// Invitation types
export interface Invitation {
  id: string
  tenant_id: string
  email: string
  role_id: string
  invited_by: string
  token: string
  expires_at: string
  accepted_at?: string
  role?: Role
  tenant?: Pick<Tenant, 'id' | 'name'>
}

// Dashboard types
export interface DashboardKPIs {
  total_revenue: number
  total_expenses: number
  balance: number
  total_clients: number
  active_clients: number
  pending_invoices: number
  overdue_invoices: number
}

export interface DashboardChartData {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    color?: string
  }[]
}

export interface DashboardData {
  kpis: DashboardKPIs
  revenue_chart: DashboardChartData
  transactions_by_category: {
    category: string
    color: string
    amount: number
    percentage: number
  }[]
  recent_transactions: FinancialTransaction[]
}

// API types
export interface PaginatedResponse<T> {
  data: T[]
  meta: {
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

// Form types
export interface ClientFormData {
  name: string
  email?: string
  phone?: string
  document?: string
  type: 'individual' | 'company'
  company_name?: string
  address?: Address
  notes?: string
  status?: 'active' | 'inactive'
}

export interface TransactionFormData {
  client_id?: string
  category_id: string
  type: 'income' | 'expense'
  amount: number
  description: string
  date: string
  due_date?: string
  status?: 'pending' | 'paid'
  payment_method?: PaymentMethod
  notes?: string
  products?: TransactionProduct[]
}

// Product types
export interface ProductCategory {
  id: string
  tenant_id: string
  name: string
  color: string
  description?: string
  products_count?: number
}

export interface Product {
  id: string
  tenant_id: string
  name: string
  type?: 'product' | 'service'
  sku?: string
  description?: string
  price: number
  cost?: number
  unit: string
  stock_quantity: number
  min_stock: number
  category_id?: string
  image_url?: string
  is_active: boolean
  track_stock: boolean
  created_at: string
  updated_at: string
  category?: Pick<ProductCategory, 'id' | 'name' | 'color'>
  profit_margin?: number
  is_low_stock?: boolean
  total_sales?: number
  total_revenue?: number
}

export interface TransactionProduct {
  id?: string
  product_id: string
  quantity: number
  unit_price: number
  discount: number
  total: number
  notes?: string
  product?: Pick<Product, 'id' | 'name' | 'sku' | 'unit'>
}

export interface ProductFormData {
  name: string
  sku?: string
  description?: string
  price: number
  cost?: number
  unit: string
  stock_quantity: number
  min_stock?: number
  category_id?: string
  image_url?: string
  is_active?: boolean
  track_stock?: boolean
}

