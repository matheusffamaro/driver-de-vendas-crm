'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2,
  Save,
  Loader2,
  Mail,
  Phone,
  Globe,
  Clock,
  CreditCard,
  Crown,
  Check,
  X,
  Sparkles,
  Zap,
  Rocket,
  Users,
  UserCircle,
  Package,
  Receipt,
  TrendingUp,
  BarChart3,
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  MessageSquare,
  FileText,
  Target,
  Brain,
  RefreshCw,
  Calendar,
  Activity,
  Palette,
  Sun,
  Moon,
  Monitor,
  Info,
  Calculator,
  ArrowRight,
  Kanban,
  Send,
  History,
  ShieldX,
  Wallet,
  BadgeCheck,
  CircleDot,
} from 'lucide-react'
import { tenantApi, subscriptionApi, pricingApi, aiPlansApi, paypalApi, emailApi, pipelineAddonApi, emailCampaignsAddonApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { useTenantStore } from '@/stores/tenant-store'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { CancelSubscriptionModal } from '@/components/ui/cancel-subscription-modal'

const settingsSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  document: z.string().optional(),
  timezone: z.string(),
  locale: z.string(),
  currency: z.string(),
})

type SettingsFormData = z.infer<typeof settingsSchema>
type BillingCycle = 'monthly' | 'yearly'

const tabs = [
  { id: 'general', label: 'Geral', icon: Building2 },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'plan', label: 'Meu Plano', icon: CreditCard },
  { id: 'appearance', label: 'Aparência', icon: Palette },
]

// Email Accounts List Component
function EmailAccountsList() {
  const queryClient = useQueryClient()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: accountsData, isLoading } = useQuery({
    queryKey: ['email', 'accounts'],
    queryFn: async () => {
      const response = await emailApi.accounts.list()
      return response.data
    },
  })

  const deleteAccount = useMutation({
    mutationFn: (id: string) => emailApi.accounts.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email', 'accounts'] })
      toast.success('Conta removida', 'A conta de email foi desconectada')
      setDeletingId(null)
    },
    onError: () => {
      toast.error('Erro', 'Não foi possível remover a conta')
      setDeletingId(null)
    },
  })

  const syncAccount = useMutation({
    mutationFn: (id: string) => emailApi.accounts.sync(id),
    onSuccess: () => {
      toast.success('Sincronização iniciada', 'Os emails estão sendo sincronizados')
    },
  })

  const accounts = accountsData || []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (accounts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 mb-6">
        <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm">Nenhuma conta conectada ainda</p>
        <p className="text-xs mt-1">Conecte uma conta abaixo para começar</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 mb-6">
      {accounts.map((account: any) => (
        <div
          key={account.id}
          className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <div className="flex items-center gap-3 flex-1">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              account.provider === 'gmail' && "bg-red-100 dark:bg-red-900/30",
              account.provider === 'outlook' && "bg-blue-100 dark:bg-blue-900/30",
              account.provider === 'imap' && "bg-purple-100 dark:bg-purple-900/30"
            )}>
              <Mail className={cn(
                "w-5 h-5",
                account.provider === 'gmail' && "text-red-600 dark:text-red-400",
                account.provider === 'outlook' && "text-blue-600 dark:text-blue-400",
                account.provider === 'imap' && "text-purple-600 dark:text-purple-400"
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-900 dark:text-white truncate">
                  {account.account_name}
                </p>
                {account.is_active ? (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                    Ativo
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                    Inativo
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {account.email}
              </p>
              {account.last_sync_at && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Última sincronização: {new Date(account.last_sync_at).toLocaleString('pt-BR')}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => syncAccount.mutate(account.id)}
              disabled={syncAccount.isPending}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-gray-500 disabled:opacity-50"
              title="Sincronizar agora"
            >
              <RefreshCw className={cn("w-4 h-4", syncAccount.isPending && "animate-spin")} />
            </button>
            <button
              onClick={() => setDeletingId(account.id)}
              className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-500"
              title="Remover conta"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setDeletingId(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-sm w-full"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Remover conta de email?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Você não poderá mais enviar ou receber emails através desta conta. Os emails já sincronizados serão mantidos.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingId(null)}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => deleteAccount.mutate(deletingId)}
                  disabled={deleteAccount.isPending}
                  className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleteAccount.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Removendo...
                    </>
                  ) : (
                    'Remover'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { updateTenant } = useAuthStore()
  const { setAddons } = useTenantStore()

  // Custom styles for range sliders
  useEffect(() => {
    const style = document.createElement('style')
    style.innerHTML = `
      input[type="range"] {
        -webkit-appearance: none;
        appearance: none;
      }
      input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: white;
        cursor: pointer;
        border: 3px solid #a855f7;
        box-shadow: 0 2px 6px rgba(168, 85, 247, 0.4);
      }
      input[type="range"]::-moz-range-thumb {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: white;
        cursor: pointer;
        border: 3px solid #a855f7;
        box-shadow: 0 2px 6px rgba(168, 85, 247, 0.4);
      }
      input[type="range"]::-webkit-slider-runnable-track {
        height: 8px;
        border-radius: 4px;
      }
      input[type="range"]::-moz-range-track {
        height: 8px;
        border-radius: 4px;
      }
    `
    document.head.appendChild(style)
    return () => {
      document.head.removeChild(style)
    }
  }, [])
  
  // Get tab from URL or default to 'general'
  const tabFromUrl = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(tabFromUrl || 'general')
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [selectedAiPlanId, setSelectedAiPlanId] = useState<string | null>(null)
  const [showCalculator, setShowCalculator] = useState(false)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [aiAddonEnabled, setAiAddonEnabled] = useState(false)
  const [showCancelAddonModal, setShowCancelAddonModal] = useState(false)
  
  // Email Add-on States
  const [emailAddonEnabled, setEmailAddonEnabled] = useState(false)
  const [showCancelEmailAddonModal, setShowCancelEmailAddonModal] = useState(false)
  
  // Pipeline Add-on States
  const [pipelinesAddonEnabled, setPipelinesAddonEnabled] = useState(false)
  const [pipelinesCount, setPipelinesCount] = useState(0)
  const [pipelinesLimit, setPipelinesLimit] = useState(1)

  // Email Campaigns Add-on States (base de leads)
  const [emailCampaignsAddonEnabled, setEmailCampaignsAddonEnabled] = useState(false)
  const [emailCampaignsLeadsTier, setEmailCampaignsLeadsTier] = useState<string>('')
  const [showCancelEmailCampaignsAddonModal, setShowCancelEmailCampaignsAddonModal] = useState(false)
  const [showCancelSubscriptionModal, setShowCancelSubscriptionModal] = useState(false)
  const EMAIL_CAMPAIGNS_TIERS = [
    { id: '1000', label: '0 - 1.000 leads', price_monthly: 29.90 },
    { id: '5000', label: '1.001 - 5.000 leads', price_monthly: 79.90 },
    { id: '15000', label: '5.001 - 15.000 leads', price_monthly: 149.90 },
    { id: 'unlimited', label: 'Acima de 15.000 leads', price_monthly: 299.90 },
  ] as const
  
  const [estimatedInputTokens, setEstimatedInputTokens] = useState(10500000) // 10.5M tokens
  const [estimatedOutputTokens, setEstimatedOutputTokens] = useState(5200000) // 5.2M tokens
  
  // Groq API - Modelo fixo usado no sistema
  const groqModel = {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B Versatile',
    input: 0.59, // USD por milhão de tokens
    output: 0.79, // USD por milhão de tokens
    rateLimit: '15 requests/minute',
    contextWindow: '128k tokens'
  }
  
  const exchangeRate = 5.80 // USD para BRL
  const minimumMonthlyFee = 59.90 // Valor mínimo mensal em BRL para usar IA

  // Descrição comercial do uso (evita mostrar "X tokens" para o cliente)
  const getUsageDescription = (inputTokens: number, outputTokens: number) => {
    const totalM = (inputTokens + outputTokens) / 1_000_000
    if (totalM <= 12) return { level: 'Leve', desc: 'Ideal para 1–2 usuários (chat, propostas e insights ocasionais)' }
    if (totalM <= 25) return { level: 'Moderado', desc: 'Ideal para pequenas equipes (uso diário de IA no atendimento e vendas)' }
    if (totalM <= 45) return { level: 'Intenso', desc: 'Para equipes maiores com alto volume de conversas e análises' }
    return { level: 'Alto volume', desc: 'Uso avançado — milhares de interações com a IA por mês' }
  }

  // Update active tab when URL changes
  useEffect(() => {
    if (tabFromUrl && tabs.some(t => t.id === tabFromUrl)) {
      setActiveTab(tabFromUrl)
    }
  }, [tabFromUrl])

  // Update URL when tab changes
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    if (tabId === 'general') {
      router.push('/settings')
    } else {
      router.push(`/settings?tab=${tabId}`)
    }
  }
  
  // Sync activeTab with URL parameter
  useEffect(() => {
    const currentTab = searchParams.get('tab') || 'general'
    setActiveTab(currentTab)
    
    // Invalidate pricing plans cache when switching to plans tab
    if (currentTab === 'plans') {
      queryClient.invalidateQueries({ queryKey: ['pricing-plans'] })
    }
  }, [searchParams, queryClient])
  
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')
  
  const [quantities, setQuantities] = useState({
    users: 5,
    clients: 100,
    products: 200,
    transactions: 1000,
  })

  // Load theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null
    if (savedTheme) {
      setTheme(savedTheme)
    }
  }, [])

  // Apply theme
  const applyTheme = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    
    if (newTheme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      document.documentElement.classList.toggle('dark', systemTheme === 'dark')
    } else {
      document.documentElement.classList.toggle('dark', newTheme === 'dark')
    }
    
    toast.success('Tema alterado', `Tema ${newTheme === 'light' ? 'claro' : newTheme === 'dark' ? 'escuro' : 'do sistema'} aplicado`)
  }

  // Tenant data
  const { data: tenantData, isLoading: loadingTenant } = useQuery({
    queryKey: ['tenant'],
    queryFn: () => tenantApi.get(),
  })

  // System plans
  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['pricing-plans'],
    queryFn: async () => {
      const response = await pricingApi.plans()
      return response.data.data
    },
  })

  const { data: usageData } = useQuery({
    queryKey: ['pricing-usage'],
    queryFn: async () => {
      const response = await pricingApi.usage()
      return response.data.data
    },
  })

  const { data: subscriptionData } = useQuery({
    queryKey: ['current-subscription'],
    queryFn: async () => {
      const response = await subscriptionApi.current()
      return response.data.data
    },
  })

  // Payment History
  const { data: paymentHistoryData } = useQuery({
    queryKey: ['payment-history'],
    queryFn: async () => {
      const response = await paypalApi.paymentHistory()
      return response.data.data
    },
    enabled: activeTab === 'plan',
  })

  // AI Plans
  const { data: aiPlansData, isLoading: aiPlansLoading } = useQuery({
    queryKey: ['ai-plans'],
    queryFn: async () => {
      const response = await aiPlansApi.list()
      return response.data.data
    },
  })

  const { data: aiCurrentData, isLoading: aiCurrentLoading } = useQuery({
    queryKey: ['ai-current-plan'],
    queryFn: async () => {
      const response = await aiPlansApi.current()
      return response.data.data
    },
  })

  const { data: aiUsageData } = useQuery({
    queryKey: ['ai-usage'],
    queryFn: async () => {
      const response = await aiPlansApi.usage()
      return response.data.data
    },
  })

  // Calculate mutation
  const calculateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await pricingApi.calculate(data)
      return response.data.data
    },
  })

  // Change AI plan mutation
  const changeAiPlanMutation = useMutation({
    mutationFn: (planId: string) => aiPlansApi.changePlan(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-current-plan'] })
      setSelectedAiPlanId(null)
      toast.success('Plano alterado', 'Seu plano de IA foi atualizado com sucesso!')
    },
    onError: () => {
      toast.error('Erro', 'Não foi possível alterar o plano.')
    },
  })

  const cancelSubscriptionMutation = useMutation({
    mutationFn: (reason: string) => subscriptionApi.cancel({ reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-subscription'] })
      queryClient.invalidateQueries({ queryKey: ['tenant'] })
      queryClient.invalidateQueries({ queryKey: ['pricing-usage'] })
      setShowCancelSubscriptionModal(false)
      toast.success('Assinatura cancelada', 'Você foi movido para o plano gratuito.')
      router.push('/dashboard')
    },
    onError: () => {
      toast.error('Erro', 'Não foi possível cancelar a assinatura. Tente novamente.')
    },
  })

  const fullTenant = tenantData?.data?.data
  const plans = plansData || []
  const freePlan = plans.find((p: any) => p.slug === 'free')
  // Agrupar planos por nome base (Essential, Business, Enterprise)
  const groupedPlans = plans
    .filter((p: any) => p.slug !== 'free')
    .reduce((acc: any, plan: any) => {
      const baseName = plan.name
      if (!acc[baseName]) {
        acc[baseName] = { withAI: null, withoutAI: null }
      }
      if (plan.includes_ai) {
        acc[baseName].withAI = plan
      } else {
        acc[baseName].withoutAI = plan
      }
      return acc
    }, {})
  const paidPlans = Object.values(groupedPlans)
  const currentPlanSlug = subscriptionData?.plan?.slug

  const aiPlans = aiPlansData || []
  const aiCurrent = aiCurrentData || {}
  const aiUsage = aiUsageData || {}

  // Sync addon states with backend data
  useEffect(() => {
    if (tenantData?.data?.data) {
      const tenant = tenantData.data.data
      console.log('Tenant data synced:', {
        pipelines_addon_enabled: tenant.pipelines_addon_enabled,
        pipelines_count: tenant.pipelines_count,
        pipelines_limit: tenant.pipelines_limit
      })
      setEmailAddonEnabled(tenant.email_addon_enabled ?? false)
      setPipelinesAddonEnabled(tenant.pipelines_addon_enabled ?? false)
      setPipelinesCount(tenant.pipelines_count ?? 0)
      setPipelinesLimit(tenant.pipelines_limit ?? 1)
      setEmailCampaignsAddonEnabled(tenant.email_campaigns_addon_enabled ?? false)
      setEmailCampaignsLeadsTier(tenant.email_campaigns_addon_leads_tier ?? '')
      setAiAddonEnabled(tenant.ai_addon_enabled ?? false)
    }
  }, [tenantData])

  useEffect(() => {
    // AI addon status is loaded from tenant data (not from aiCurrent)
    // Only Enterprise plans with ai_addon_enabled can use AI
  }, [aiCurrent])

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    values: {
      name: fullTenant?.name || '',
      email: fullTenant?.email || '',
      phone: fullTenant?.phone || '',
      document: fullTenant?.document || '',
      timezone: fullTenant?.settings?.timezone || 'America/Sao_Paulo',
      locale: fullTenant?.settings?.locale || 'pt-BR',
      currency: fullTenant?.settings?.currency || 'BRL',
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: SettingsFormData) => {
      const payload = {
        name: data.name,
        email: data.email || undefined,
        phone: data.phone || undefined,
        document: data.document || undefined,
        settings: {
          timezone: data.timezone,
          locale: data.locale,
          currency: data.currency,
        },
      }
      return tenantApi.update(payload)
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['tenant'] })
      updateTenant(response.data.data)
      toast.success('Configurações salvas', 'Suas alterações foram aplicadas')
    },
    onError: () => {
      toast.error('Erro', 'Não foi possível salvar as configurações')
    },
  })

  const onSubmit = (data: SettingsFormData) => {
    updateMutation.mutate(data)
  }

  // PayPal checkout
  const handlePayPalCheckout = async (planId: string, hasDynamicPricing: boolean) => {
    setIsProcessingPayment(true)
    try {
      const response = await paypalApi.createOrder({
        plan_id: planId,
        billing_cycle: billingCycle,
        quantities: hasDynamicPricing ? quantities : undefined,
      })
      
      const { approval_url, order_id } = response.data.data
      
      if (approval_url) {
        localStorage.setItem('paypal_order_id', order_id)
        localStorage.setItem('paypal_plan_id', planId)
        window.location.href = approval_url
      } else {
        toast.error('Erro', 'Não foi possível iniciar o pagamento')
      }
    } catch (error: any) {
      toast.error('Erro no pagamento', error.response?.data?.message || 'Tente novamente mais tarde')
    } finally {
      setIsProcessingPayment(false)
    }
  }

  // Recalculate price when quantities change
  useEffect(() => {
    if (selectedPlanId && showCalculator) {
      const timeoutId = setTimeout(() => {
        calculateMutation.mutate({
          plan_id: selectedPlanId,
          ...quantities,
          billing_cycle: billingCycle,
        })
      }, 300)
      return () => clearTimeout(timeoutId)
    }
  }, [selectedPlanId, quantities, billingCycle, showCalculator])

  // Helper functions
  const formatCurrency = (value: number | undefined | null) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0)
  }

  const formatNumber = (num: number | undefined | null) => {
    if (num === undefined || num === null) return '0'
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const getEmailAccountsLimit = (planSlug: string | undefined): number => {
    if (!planSlug) return 0
    if (planSlug.includes('essential')) return 1
    if (planSlug.includes('business')) return 3
    if (planSlug.includes('enterprise')) return -1 // Ilimitado
    return 0
  }

  const getEmailAccountsLimitLabel = (limit: number): string => {
    if (limit === -1) return 'Ilimitadas'
    if (limit === 1) return '1 conta'
    return `${limit} contas`
  }

  const getEmailAddonPrice = (planSlug: string | undefined): number => {
    if (!planSlug) return 19.90
    if (planSlug.includes('essential')) return 19.90 // 1 conta
    if (planSlug.includes('business')) return 49.90 // 3 contas
    if (planSlug.includes('enterprise')) return 89.90 // Ilimitado
    return 19.90
  }

  const getPipelinesAddonPrice = (): number => {
    // Fixed price of R$ 29.90/month for unlimited pipelines
    const additionalPipelines = Math.max(0, pipelinesCount - 1)
    return additionalPipelines > 0 ? 29.90 : 0
  }

  const getEmailCampaignsAddonPrice = (tierId: string | undefined): number => {
    if (!tierId) return 0
    const tier = EMAIL_CAMPAIGNS_TIERS.find((t) => t.id === tierId)
    return tier ? tier.price_monthly : 0
  }

  const getPlanIcon = (slug: string) => {
    switch (slug) {
      case 'free': case 'gratuito': return <Zap className="w-5 h-5" />
      case 'starter': return <Rocket className="w-5 h-5" />
      case 'pro': case 'professional': return <Building2 className="w-5 h-5" />
      case 'enterprise': return <Crown className="w-5 h-5" />
      default: return <Sparkles className="w-5 h-5" />
    }
  }

  const getPlanColor = (slug: string) => {
    switch (slug) {
      case 'free': case 'gratuito': return 'from-gray-500 to-gray-600'
      case 'starter': return 'from-emerald-500 to-teal-600'
      case 'pro': case 'professional': return 'from-blue-500 to-indigo-600'
      case 'enterprise': return 'from-amber-500 to-orange-600'
      default: return 'from-gray-500 to-gray-600'
    }
  }

  const featureIcons: Record<string, any> = {
    chat: MessageSquare,
    autofill: FileText,
    email: Mail,
    lead_analysis: Target,
    advanced_learning: Brain,
  }

  const calculatedPrice = calculateMutation.data?.pricing

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-display">Configurações</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Gerencie as configurações da sua empresa e planos</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors whitespace-nowrap",
              activeTab === tab.id 
                ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            )}
          >
            <tab.icon className="w-5 h-5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ==================== GENERAL TAB ==================== */}
      {activeTab === 'general' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl"
        >
          <form onSubmit={handleSubmit(onSubmit)} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Informações da Empresa</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nome da Empresa
                  </label>
                  <input
                    type="text"
                    {...register('name')}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                  />
                  {errors.name && (
                    <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      {...register('email')}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Telefone
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      {...register('phone')}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    CNPJ
                  </label>
                  <input
                    type="text"
                    {...register('document')}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Preferências</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Clock className="w-4 h-4 inline mr-2" />
                    Fuso Horário
                  </label>
                  <select {...register('timezone')} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white">
                    <option value="America/Sao_Paulo">São Paulo (GMT-3)</option>
                    <option value="America/Manaus">Manaus (GMT-4)</option>
                    <option value="America/Belem">Belém (GMT-3)</option>
                    <option value="America/Fortaleza">Fortaleza (GMT-3)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Globe className="w-4 h-4 inline mr-2" />
                    Idioma
                  </label>
                  <select {...register('locale')} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white">
                    <option value="pt-BR">Português (Brasil)</option>
                    <option value="en-US">English (US)</option>
                    <option value="es">Español</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Moeda
                  </label>
                  <select {...register('currency')} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white">
                    <option value="BRL">Real (R$)</option>
                    <option value="USD">Dólar (US$)</option>
                    <option value="EUR">Euro (€)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="submit"
                disabled={!isDirty || updateMutation.isPending}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                Salvar Alterações
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* ==================== EMAIL TAB ==================== */}
      {activeTab === 'email' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl space-y-6"
        >
          {/* Header */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  Configurações de Email
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Conecte suas contas de email para enviar e receber mensagens diretamente pelo CRM.
                  Você pode conectar Gmail, Outlook ou qualquer provedor via IMAP/SMTP.
                </p>
              </div>
            </div>
          </div>

          {/* Email Addon Required Warning */}
          {!emailAddonEnabled && (
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex-shrink-0">
                  <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    Módulo de Email Não Ativo
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                    Para conectar suas contas de email e usar a inbox integrada, ative o módulo de Email na aba "Meu Plano".
                  </p>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 mb-4">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                      💰 Planos e Preços
                    </p>
                    <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
                      <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900/50 rounded">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-green-500" />
                          <span><strong>1 conta de email</strong></span>
                        </div>
                        <span className="font-bold text-green-600 dark:text-green-400">{formatCurrency(19.90)}/mês</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900/50 rounded">
                        <div className="flex items-center gap-2">
                          <Rocket className="w-4 h-4 text-blue-500" />
                          <span><strong>3 contas de email</strong></span>
                        </div>
                        <span className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(49.90)}/mês</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900/50 rounded">
                        <div className="flex items-center gap-2">
                          <Crown className="w-4 h-4 text-amber-500" />
                          <span><strong>Contas ilimitadas</strong></span>
                        </div>
                        <span className="font-bold text-amber-600 dark:text-amber-400">{formatCurrency(89.90)}/mês</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('plan')}
                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white rounded-lg transition-all font-medium text-sm flex items-center gap-2 shadow-lg hover:shadow-xl"
                  >
                    <Zap className="w-4 h-4" />
                    Contratar Módulo de Email
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Connected Accounts */}
          {emailAddonEnabled && (
            <>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Contas Conectadas
              </h3>
              <button
                onClick={() => {
                  // Refresh accounts
                  queryClient.invalidateQueries({ queryKey: ['email', 'accounts'] })
                }}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Accounts List */}
            <EmailAccountsList />

            {/* Connect Buttons */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                Conectar Nova Conta
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Gmail */}
                <button
                  onClick={async () => {
                    try {
                      const response = await emailApi.accounts.getOAuthUrl('gmail')
                      window.location.href = response.data.url
                    } catch (error: any) {
                      const errorMessage = error?.response?.data?.message || error?.response?.data?.error || 'Não foi possível iniciar conexão com Gmail'
                      if (errorMessage.includes('OAuth credentials not configured')) {
                        toast.error(
                          'Credenciais OAuth Não Configuradas', 
                          'Configure as credenciais do Google OAuth2 no arquivo .env do backend. Consulte EMAIL_OAUTH_SETUP.md para instruções.'
                        )
                      } else {
                        toast.error('Erro', errorMessage)
                      }
                    }
                  }}
                  className="flex items-center justify-center gap-3 px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-red-500 dark:hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all group"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#4285F4" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#34A853" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span className="font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                    Gmail
                  </span>
                </button>

                {/* Outlook */}
                <button
                  onClick={async () => {
                    try {
                      const response = await emailApi.accounts.getOAuthUrl('outlook')
                      window.location.href = response.data.url
                    } catch (error: any) {
                      const errorMessage = error?.response?.data?.message || error?.response?.data?.error || 'Não foi possível iniciar conexão com Outlook'
                      if (errorMessage.includes('OAuth credentials not configured')) {
                        toast.error(
                          'Credenciais OAuth Não Configuradas', 
                          'Configure as credenciais do Microsoft OAuth2 no arquivo .env do backend. Consulte EMAIL_OAUTH_SETUP.md para instruções.'
                        )
                      } else {
                        toast.error('Erro', errorMessage)
                      }
                    }
                  }}
                  className="flex items-center justify-center gap-3 px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all group"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#0078D4">
                    <path d="M12 0L3 4v8c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V4l-9-4zm0 3.6L19.5 6.8v5.2c0 4.47-3.09 8.64-7.5 9.84-4.41-1.2-7.5-5.37-7.5-9.84V6.8L12 3.6z"/>
                  </svg>
                  <span className="font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                    Outlook
                  </span>
                </button>

                {/* IMAP/SMTP */}
                <button
                  onClick={() => {
                    toast.info('Em breve', 'Configuração IMAP/SMTP estará disponível em breve')
                  }}
                  className="flex items-center justify-center gap-3 px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all group"
                >
                  <Mail className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <span className="font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                    IMAP/SMTP
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Help Section */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-6">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                      Como funciona?
                    </h4>
                    <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                      <li>• Conecte sua conta de email com segurança usando OAuth2 (Gmail/Outlook)</li>
                      <li>• Todos os emails são sincronizados automaticamente a cada 5 minutos</li>
                      <li>• Você pode enviar e receber emails diretamente pelo CRM</li>
                      <li>• Emails são vinculados automaticamente a contatos e oportunidades</li>
                      <li>• Suas credenciais são armazenadas de forma segura e criptografada</li>
                    </ul>
                  </div>
                </div>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* ==================== MEU PLANO TAB ==================== */}
      {activeTab === 'plan' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Current Plan Summary */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl border border-blue-200 dark:border-blue-800 p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center">
                  <Crown className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Plano Atual</p>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {subscriptionData?.plan?.name || 'Free'}
                  </h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full",
                      subscriptionData?.status === 'active' && 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
                      subscriptionData?.status === 'trial' && 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
                      subscriptionData?.status === 'cancelled' && 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
                      !subscriptionData?.status && 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
                    )}>
                      <CircleDot className="w-3 h-3" />
                      {subscriptionData?.status === 'active' ? 'Ativo' :
                       subscriptionData?.status === 'trial' ? 'Trial' :
                       subscriptionData?.status === 'cancelled' ? 'Cancelado' : 'Ativo'}
                    </span>
                    {subscriptionData?.billing_cycle && parseFloat(subscriptionData?.plan?.price_monthly || '0') > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                        <Calendar className="w-3 h-3" />
                        Cobrança {subscriptionData.billing_cycle === 'yearly' ? 'Anual' : 'Mensal'}
                      </span>
                    )}
                    {subscriptionData?.status === 'trial' && subscriptionData?.days_remaining != null && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300">
                        <Clock className="w-3 h-3" />
                        {subscriptionData.days_remaining} dias restantes
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {parseFloat(subscriptionData?.plan?.price_monthly || '0') > 0 && (
                <div className="text-right">
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {(() => {
                      const basePlanPrice = parseFloat(subscriptionData.plan.price_monthly || '0')
                      
                      const aiAddonCost = aiAddonEnabled ? (() => {
                        const inputCostUSD = (estimatedInputTokens / 1000000) * groqModel.input
                        const outputCostUSD = (estimatedOutputTokens / 1000000) * groqModel.output
                        const usageCostBRL = (inputCostUSD + outputCostUSD) * exchangeRate
                        return Math.max(usageCostBRL, minimumMonthlyFee)
                      })() : 0
                      
                      const emailAddonCost = emailAddonEnabled ? getEmailAddonPrice(currentPlanSlug) : 0
                      const pipelinesAddonCost = pipelinesAddonEnabled ? getPipelinesAddonPrice() : 0
                      const emailCampaignsAddonCost = emailCampaignsAddonEnabled ? getEmailCampaignsAddonPrice(emailCampaignsLeadsTier) : 0
                      
                      const total = basePlanPrice + aiAddonCost + emailAddonCost + pipelinesAddonCost + emailCampaignsAddonCost
                      
                      return formatCurrency(total)
                    })()}
                  </p>
                  <p className="text-sm text-gray-500">/mês</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {(() => {
                      const addonsCount = (aiAddonEnabled ? 1 : 0) + (emailAddonEnabled ? 1 : 0) + (pipelinesAddonEnabled ? 1 : 0) + (emailCampaignsAddonEnabled ? 1 : 0)
                      if (addonsCount === 0) return 'Valor base do plano'
                      if (addonsCount === 1) return 'Incluindo 1 add-on'
                      return `Incluindo ${addonsCount} add-ons`
                    })()}
                  </p>
                </div>
              )}
            </div>

            {/* Subscription Details Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-5 border-t border-blue-200 dark:border-blue-700">
              <div className="p-3 bg-white/60 dark:bg-gray-800/40 rounded-xl">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Início
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {subscriptionData?.starts_at
                    ? new Date(subscriptionData.starts_at).toLocaleDateString('pt-BR')
                    : 'Plano gratuito'}
                </p>
              </div>
              <div className="p-3 bg-white/60 dark:bg-gray-800/40 rounded-xl">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  Próx. Cobrança
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {subscriptionData?.ends_at
                    ? new Date(subscriptionData.ends_at).toLocaleDateString('pt-BR')
                    : 'Sem cobrança'}
                </p>
              </div>
              <div className="p-3 bg-white/60 dark:bg-gray-800/40 rounded-xl">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <Wallet className="w-3.5 h-3.5" />
                  Pagamento
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {subscriptionData?.id ? 'PayPal' : 'Nenhum'}
                </p>
              </div>
              <div className="p-3 bg-white/60 dark:bg-gray-800/40 rounded-xl">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <BadgeCheck className="w-3.5 h-3.5" />
                  Status
                </div>
                <p className={cn(
                  "text-sm font-semibold",
                  (!subscriptionData?.status || subscriptionData?.status === 'active') && 'text-emerald-600 dark:text-emerald-400',
                  subscriptionData?.status === 'trial' && 'text-amber-600 dark:text-amber-400',
                  subscriptionData?.status === 'cancelled' && 'text-red-600 dark:text-red-400',
                )}>
                  {subscriptionData?.status === 'active' ? 'Ativo' :
                   subscriptionData?.status === 'trial' ? 'Período de Teste' :
                   subscriptionData?.status === 'cancelled' ? 'Cancelado' : 'Ativo'}
                </p>
              </div>
            </div>

            {/* Monthly Billing Summary */}
            <div className="mt-6 p-6 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl border-2 border-emerald-200 dark:border-emerald-700">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                  Resumo de Cobrança Mensal
                </h4>
              </div>

              <div className="space-y-3">
                {/* Base Plan */}
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-gray-700 dark:text-gray-300 font-medium">
                      Plano {subscriptionData?.plan?.name || 'Free'}
                    </span>
                  </div>
                  <span className="text-gray-900 dark:text-white font-semibold">
                    {formatCurrency(parseFloat(subscriptionData?.plan?.price_monthly || '0'))}
                  </span>
                </div>

                {/* AI Add-on */}
                {aiAddonEnabled && (
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                      <span className="text-gray-700 dark:text-gray-300 font-medium">
                        Add-on Inteligência Artificial
                      </span>
                    </div>
                    <span className="text-gray-900 dark:text-white font-semibold">
                      {(() => {
                        const inputCostUSD = (estimatedInputTokens / 1000000) * groqModel.input
                        const outputCostUSD = (estimatedOutputTokens / 1000000) * groqModel.output
                        const usageCostBRL = (inputCostUSD + outputCostUSD) * exchangeRate
                        const finalCost = Math.max(usageCostBRL, minimumMonthlyFee)
                        return formatCurrency(finalCost)
                      })()}
                    </span>
                  </div>
                )}

                {/* Email Add-on */}
                {emailAddonEnabled && (
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-cyan-500" />
                      <span className="text-gray-700 dark:text-gray-300 font-medium">
                        Add-on Módulo de Email
                      </span>
                    </div>
                    <span className="text-gray-900 dark:text-white font-semibold">
                      {formatCurrency(getEmailAddonPrice(currentPlanSlug))}
                    </span>
                  </div>
                )}

                {/* Pipelines Add-on */}
                {pipelinesAddonEnabled && (
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                      <span className="text-gray-700 dark:text-gray-300 font-medium">
                        Add-on: Pipelines ({pipelinesCount > 1 ? `${pipelinesCount - 1} adicional${pipelinesCount > 2 ? 'is' : ''}` : '0 adicionais'})
                      </span>
                    </div>
                    <span className="text-gray-900 dark:text-white font-semibold">
                      {formatCurrency(getPipelinesAddonPrice())}
                    </span>
                  </div>
                )}

                {/* Email Campaigns Add-on */}
                {emailCampaignsAddonEnabled && emailCampaignsLeadsTier && (
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-cyan-500" />
                      <span className="text-gray-700 dark:text-gray-300 font-medium">
                        Add-on: Campanhas de E-mail ({EMAIL_CAMPAIGNS_TIERS.find(t => t.id === emailCampaignsLeadsTier)?.label ?? emailCampaignsLeadsTier})
                      </span>
                    </div>
                    <span className="text-gray-900 dark:text-white font-semibold">
                      {formatCurrency(getEmailCampaignsAddonPrice(emailCampaignsLeadsTier))}
                    </span>
                  </div>
                )}

                {/* Divider */}
                <div className="border-t-2 border-emerald-300 dark:border-emerald-600 my-3" />

                {/* Total */}
                <div className="flex items-center justify-between py-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl px-4">
                  <div className="flex items-center gap-3">
                    <Zap className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-lg font-bold text-gray-900 dark:text-white">
                      Total Mensal
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                      {(() => {
                        const basePlanPrice = parseFloat(subscriptionData?.plan?.price_monthly || '0')
                        
                        const aiAddonCost = aiAddonEnabled ? (() => {
                          const inputCostUSD = (estimatedInputTokens / 1000000) * groqModel.input
                          const outputCostUSD = (estimatedOutputTokens / 1000000) * groqModel.output
                          const usageCostBRL = (inputCostUSD + outputCostUSD) * exchangeRate
                          return Math.max(usageCostBRL, minimumMonthlyFee)
                        })() : 0
                        
                        const emailAddonCost = emailAddonEnabled ? getEmailAddonPrice(currentPlanSlug) : 0
                        const pipelinesAddonCost = pipelinesAddonEnabled ? getPipelinesAddonPrice() : 0
                        const emailCampaignsAddonCost = emailCampaignsAddonEnabled ? getEmailCampaignsAddonPrice(emailCampaignsLeadsTier) : 0
                        
                        const total = basePlanPrice + aiAddonCost + emailAddonCost + pipelinesAddonCost + emailCampaignsAddonCost
                        
                        return formatCurrency(total)
                      })()}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      por mês
                    </p>
                  </div>
                </div>

                {/* Helpful info */}
                <div className="flex items-start gap-2 mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                  <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Este é o valor total que será cobrado mensalmente. Você pode cancelar add-ons a qualquer momento.
                  </p>
                </div>
              </div>
            </div>

            {/* Usage Bars */}
            {/* System Resources Usage */}
            {usageData && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-blue-200 dark:border-blue-700">
                {[
                  { label: 'Usuários', current: usageData.users?.current, limit: usageData.users?.limit, icon: Users },
                  { label: 'Clientes', current: usageData.clients?.current, limit: usageData.clients?.limit, icon: UserCircle },
                  { label: 'Produtos', current: usageData.products?.current, limit: usageData.products?.limit, icon: Package },
                  { label: 'Transações/mês', current: usageData.transactions?.current, limit: usageData.transactions?.limit, icon: Receipt },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
                        <item.icon className="w-4 h-4" />
                        {item.label}
                      </span>
                      <span className="text-gray-900 dark:text-white font-medium">
                        {item.current || 0} / {item.limit === -1 ? '∞' : item.limit || 0}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          item.limit && item.limit !== -1 && (item.current || 0) / item.limit > 0.8
                            ? 'bg-red-500'
                            : 'bg-emerald-500'
                        )}
                        style={{ 
                          width: item.limit === -1 ? '10%' : `${Math.min(((item.current || 0) / (item.limit || 1)) * 100, 100)}%` 
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Active Add-ons */}
            {aiAddonEnabled && (
              <div className="mt-6 pt-6 border-t border-blue-200 dark:border-blue-700">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  Add-ons Ativos
                </h4>
                <div className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl border-2 border-purple-200 dark:border-purple-700">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex-shrink-0">
                        <Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="font-semibold text-gray-900 dark:text-white mb-1">
                          Recursos de Inteligência Artificial
                        </h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {(() => {
                            const { level, desc } = getUsageDescription(estimatedInputTokens, estimatedOutputTokens)
                            return <>Add-on de IA — uso {level.toLowerCase()}. {desc}</>
                          })()}
                        </p>
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400">
                          <Check className="w-3 h-3" />
                          Ativo
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                        {(() => {
                          const inputCostUSD = (estimatedInputTokens / 1000000) * groqModel.input
                          const outputCostUSD = (estimatedOutputTokens / 1000000) * groqModel.output
                          const usageCostBRL = (inputCostUSD + outputCostUSD) * exchangeRate
                          const finalCost = Math.max(usageCostBRL, minimumMonthlyFee)
                          return formatCurrency(finalCost)
                        })()}
                      </p>
                      <p className="text-xs text-gray-500">/mês</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCancelAddonModal(true)}
                    className="w-full px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Cancelar Add-on
                  </button>
                </div>
              </div>
            )}

            {/* Email Add-on Active */}
            {emailAddonEnabled && (
              <div className="mt-4">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
                  Add-ons Ativos
                </h4>
                <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl border-2 border-blue-200 dark:border-blue-700">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex-shrink-0">
                        <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="font-semibold text-gray-900 dark:text-white mb-1">
                          Módulo de Email
                        </h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {getEmailAccountsLimitLabel(getEmailAccountsLimit(currentPlanSlug))} • Add-on Ativo
                        </p>
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400">
                          <Check className="w-3 h-3" />
                          Ativo
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                        {formatCurrency(getEmailAddonPrice(currentPlanSlug))}
                      </p>
                      <p className="text-xs text-gray-500">/mês</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCancelEmailAddonModal(true)}
                    className="w-full px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Cancelar Add-on
                  </button>
                </div>
              </div>
            )}

            {/* AI Usage */}
            {aiCurrent && (
              <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-700">
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Uso de IA</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    {(() => {
                      const dailyLimit = aiCurrent.limits?.daily || (subscriptionData?.plan?.features?.ai_tokens_month > 0 ? Math.floor(subscriptionData?.plan?.features?.ai_tokens_month / 30) : null)
                      const isUnlimited = !dailyLimit || dailyLimit < 0 || subscriptionData?.plan?.features?.ai_tokens_month === -1
                      const used = aiCurrent.usage?.tokens_used_today || 0
                      return (
                        <>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-gray-600 dark:text-gray-400">Tokens Hoje</span>
                            <span className="text-gray-900 dark:text-white font-medium">
                              {formatNumber(used)} / {isUnlimited ? '∞' : formatNumber(dailyLimit)}
                            </span>
                          </div>
                          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                !isUnlimited && (used / dailyLimit) > 0.8 ? 'bg-red-500' : 'bg-purple-500'
                              )}
                              style={{ width: isUnlimited ? '5%' : `${Math.min((used / dailyLimit) * 100, 100)}%` }}
                            />
                          </div>
                        </>
                      )
                    })()}
                  </div>
                  <div>
                    {(() => {
                      const monthlyLimit = subscriptionData?.plan?.features?.ai_tokens_month || aiCurrent.limits?.monthly
                      const isUnlimited = !monthlyLimit || monthlyLimit < 0
                      const used = aiCurrent.usage?.tokens_used_this_month || 0
                      return (
                        <>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-gray-600 dark:text-gray-400">Tokens este Mês</span>
                            <span className="text-gray-900 dark:text-white font-medium">
                              {formatNumber(used)} / {isUnlimited ? '∞' : formatNumber(monthlyLimit)}
                            </span>
                          </div>
                          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                !isUnlimited && (used / monthlyLimit) > 0.8 ? 'bg-red-500' : 'bg-blue-500'
                              )}
                              style={{ width: isUnlimited ? '5%' : `${Math.min((used / monthlyLimit) * 100, 100)}%` }}
                            />
                          </div>
                        </>
                      )
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4">
            <span className={cn(
              "text-sm font-medium transition-colors",
              billingCycle === 'monthly' ? 'text-gray-900 dark:text-white' : 'text-gray-500'
            )}>
              Mensal
            </span>
            <button
              onClick={() => setBillingCycle(prev => prev === 'monthly' ? 'yearly' : 'monthly')}
              className="relative w-14 h-7 rounded-full bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 transition-colors"
            >
              <motion.div
                className="absolute top-1 w-5 h-5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                animate={{ left: billingCycle === 'monthly' ? 4 : 32 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
            <span className={cn(
              "text-sm font-medium transition-colors",
              billingCycle === 'yearly' ? 'text-gray-900 dark:text-white' : 'text-gray-500'
            )}>
              Anual
            </span>
            <span className="ml-2 px-2 py-1 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
              2 meses grátis
            </span>
          </div>

          {/* Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {paidPlans.map((planGroup: any, index: number) => {
              // Sempre usar plano sem IA como base
              const plan = planGroup.withoutAI || planGroup.withAI
              
              // Debug - remover depois
              if (index === 0) {
                console.log('DEBUG - Plan data:', {
                  name: plan?.name,
                  max_users: plan?.max_users,
                  max_clients: plan?.max_clients,
                  included_products: plan?.included_products,
                  max_transactions: plan?.max_transactions,
                  fullPlan: plan
                })
              }
              
              return (
              <motion.div
                key={plan.name + index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  "relative bg-white dark:bg-gray-800 rounded-2xl border p-6 transition-all",
                  selectedPlanId === plan?.id 
                    ? 'border-blue-500 ring-2 ring-blue-500/20' 
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
                  plan.name === 'Business' && 'md:-mt-4 md:mb-4'
                )}
              >
                {/* Popular Badge */}
                {plan.name === 'Business' && (
                  <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-blue-500 to-indigo-600 py-2 text-center rounded-t-2xl">
                    <span className="text-xs font-semibold text-white flex items-center justify-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      MAIS POPULAR
                    </span>
                  </div>
                )}

                {/* Current Badge */}
                {currentPlanSlug === plan?.slug && (
                  <div className="absolute -top-3 right-4 px-3 py-1 bg-emerald-500 text-white text-xs font-medium rounded-full">
                    Atual
                  </div>
                )}

                <div className={cn(plan.name === 'Business' && 'pt-6')}>
                  {/* Plan Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={cn(
                      "p-2.5 rounded-xl bg-gradient-to-br text-white",
                      getPlanColor(plan?.slug)
                    )}>
                      {getPlanIcon(plan?.slug)}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">{plan.name}</h3>
                      <p className="text-sm text-gray-500">{plan?.description}</p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-end gap-1">
                      <span className="text-3xl font-bold text-gray-900 dark:text-white">
                        {formatCurrency(billingCycle === 'yearly' ? parseFloat(plan?.price_yearly || '0') / 12 : parseFloat(plan?.price_monthly || '0'))}
                      </span>
                      <span className="text-gray-400 mb-1">/mês</span>
                    </div>
                  </div>

                  {/* Limits */}
                  <div className="space-y-2 mb-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50">
                    {[
                      { icon: Users, label: 'Usuários', value: plan?.max_users },
                      { icon: UserCircle, label: 'Clientes', value: plan?.max_clients },
                      { icon: Package, label: 'Produtos', value: plan?.included_products },
                      { icon: Receipt, label: 'Transações/mês', value: plan?.max_transactions },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 flex items-center gap-2">
                          <item.icon className="w-4 h-4" /> {item.label}
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {item.value === -1 
                            ? 'Ilimitado' 
                            : typeof item.value === 'number' && item.value >= 0
                              ? `até ${formatNumber(item.value)}` 
                              : '-'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Action Button */}
                  {currentPlanSlug === plan?.slug ? (
                    <button
                      disabled
                      className="w-full py-3 px-4 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-400 font-medium cursor-not-allowed"
                    >
                      Plano Atual
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setSelectedPlanId(plan?.id)
                        if (plan?.has_dynamic_pricing) {
                          setShowCalculator(true)
                        } else {
                          handlePayPalCheckout(plan?.id, false)
                        }
                      }}
                      disabled={isProcessingPayment || !plan}
                      className={cn(
                        "w-full py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 text-white",
                        plan.name === 'Business'
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'
                          : plan.name === 'Enterprise'
                          ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700'
                          : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700',
                        "disabled:opacity-50"
                      )}
                    >
                      {isProcessingPayment && selectedPlanId === plan?.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          {plan?.has_dynamic_pricing ? 'Calcular Preço' : 'Fazer Upgrade'}
                          <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </motion.div>
              )
            })}
          </div>

          {/* AI Add-ons Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-12"
          >
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 flex items-center justify-center gap-2">
                <Brain className="w-6 h-6 text-purple-500" />
                Add-ons de Inteligência Artificial
              </h3>
              <p className="text-gray-500">Potencialize seu CRM com recursos de IA personalizados</p>
            </div>

            <div className="max-w-4xl mx-auto">
              {/* Minimum Fee Alert */}
              <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex-shrink-0">
                    <Zap className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-gray-900 dark:text-white mb-1">
                      Taxa Mínima Mensal de IA
                    </h5>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Para ativar os recursos de Inteligência Artificial, há uma taxa mínima de <span className="font-bold text-amber-600 dark:text-amber-400">{formatCurrency(minimumMonthlyFee)}/mês</span>. 
                      Se o uso ultrapassar esse valor, você paga apenas pelo que consumir.
                    </p>
                  </div>
                </div>
              </div>

              <div className={cn(
                "bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-2xl border-2 p-8 transition-all",
                aiAddonEnabled
                  ? 'border-purple-500 ring-2 ring-purple-500/20'
                  : 'border-gray-200 dark:border-gray-700'
              )}>
                {!aiAddonEnabled && (
                  <>
                    {/* Header with Checkbox */}
                    <div className="flex items-start gap-4 mb-6">
                      <button
                        onClick={() => {
                          // AI addon available only for Enterprise plans
                          toast.info('Plano Enterprise Necessário', 'O add-on de IA está disponível apenas para planos Enterprise. Entre em contato para upgrade.')
                        }}
                        disabled={currentPlanSlug !== 'enterprise'}
                        className={cn(
                          "flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all",
                          currentPlanSlug !== 'enterprise' && "opacity-50 cursor-not-allowed",
                          aiAddonEnabled
                            ? 'bg-purple-500 border-purple-500'
                            : 'border-gray-300 dark:border-gray-600 hover:border-purple-400'
                        )}
                      >
                        {aiAddonEnabled && <Check className="w-4 h-4 text-white" />}
                      </button>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="text-xl font-bold text-gray-900 dark:text-white">Recursos de IA</h4>
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400">
                            Add-on
                          </span>
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400">
                            A partir de {formatCurrency(minimumMonthlyFee)}/mês
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Adicione capacidades de IA ao seu plano: geração de conteúdo, análise preditiva, insights automáticos e muito mais.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 p-4 bg-white/50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-purple-200 dark:border-purple-700 mb-6">
                      <div className="text-center">
                        <Sparkles className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Clique no checkbox acima para adicionar recursos de IA ao seu plano e transformar seu CRM com inteligência artificial.
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {aiAddonEnabled && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Check className="w-5 h-5 text-emerald-500" />
                        Add-on de IA Ativo
                      </h4>
                      <button
                        onClick={() => setShowCancelAddonModal(true)}
                        className="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        Cancelar Add-on
                      </button>
                    </div>
                  </div>
                )}

                {/* AI Features List - Always visible */}
                <div>
                  {/* AI Features List */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-white/50 dark:bg-gray-800/50 rounded-xl">
                        {[
                          { icon: MessageSquare, label: 'Chat de IA para atendimento', desc: 'Respostas automáticas inteligentes' },
                          { icon: FileText, label: 'Geração de propostas', desc: 'Crie propostas personalizadas instantaneamente' },
                          { icon: Target, label: 'Lead scoring preditivo', desc: 'IA analisa e pontua leads automaticamente' },
                          { icon: Brain, label: 'Insights automáticos', desc: 'Análises e recomendações inteligentes' },
                        ].map((feature) => (
                          <div key={feature.label} className="flex items-start gap-3">
                            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex-shrink-0">
                              <feature.icon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{feature.label}</p>
                              <p className="text-xs text-gray-500">{feature.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Usage Calculator */}
                      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-6">
                        <div className="flex items-center gap-2 mb-4">
                          <Calculator className="w-5 h-5 text-purple-500" />
                          <h5 className="font-semibold text-gray-900 dark:text-white">Calculadora de Uso</h5>
                          <button
                            onClick={() => setShowCalculator(!showCalculator)}
                            className="ml-auto text-sm text-purple-600 dark:text-purple-400 hover:underline"
                          >
                            {showCalculator ? 'Ocultar' : 'Personalizar'}
                          </button>
                        </div>

                        <AnimatePresence>
                          {showCalculator ? (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="space-y-5"
                            >
                              {/* Input Tokens Slider */}
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <label className="text-sm text-gray-600 dark:text-gray-400">
                                    Tokens de Input por mês
                                  </label>
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    {formatNumber(estimatedInputTokens)}
                                  </span>
                                </div>
                                {(() => {
                                  const minValue = 10500000 // 10.5M - mínimo para R$ 59,90
                                  const maxValue = 50000000 // 50M
                                  const percentage = ((estimatedInputTokens - minValue) / (maxValue - minValue)) * 100
                                  return (
                                    <input
                                      type="range"
                                      min={minValue}
                                      max={maxValue}
                                      step="500000"
                                      value={estimatedInputTokens}
                                      onChange={(e) => setEstimatedInputTokens(parseInt(e.target.value))}
                                      style={{
                                        background: `linear-gradient(to right, #a855f7 ${percentage}%, #e5e7eb ${percentage}%)`
                                      }}
                                      className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                                    />
                                  )
                                })()}
                                <div className="flex justify-between text-xs text-gray-400 mt-1">
                                  <span>10.5M</span>
                                  <span>50M</span>
                                </div>
                              </div>

                              {/* Output Tokens Slider */}
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <label className="text-sm text-gray-600 dark:text-gray-400">
                                    Tokens de Output por mês
                                  </label>
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    {formatNumber(estimatedOutputTokens)}
                                  </span>
                                </div>
                                {(() => {
                                  const minValue = 5200000 // 5.2M - mínimo para R$ 59,90
                                  const maxValue = 25000000 // 25M
                                  const percentage = ((estimatedOutputTokens - minValue) / (maxValue - minValue)) * 100
                                  return (
                                    <input
                                      type="range"
                                      min={minValue}
                                      max={maxValue}
                                      step="250000"
                                      value={estimatedOutputTokens}
                                      onChange={(e) => setEstimatedOutputTokens(parseInt(e.target.value))}
                                      style={{
                                        background: `linear-gradient(to right, #6366f1 ${percentage}%, #e5e7eb ${percentage}%)`
                                      }}
                                      className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                                    />
                                  )
                                })()}
                                <div className="flex justify-between text-xs text-gray-400 mt-1">
                                  <span>5.2M</span>
                                  <span>25M</span>
                                </div>
                              </div>
                            </motion.div>
                          ) : (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="text-sm text-gray-600 dark:text-gray-400"
                            >
                              {(() => {
                                const { level, desc } = getUsageDescription(estimatedInputTokens, estimatedOutputTokens)
                                return (
                                  <>
                                    <span className="font-medium text-gray-900 dark:text-white">Uso estimado: {level}</span>
                                    <span className="block mt-1 text-gray-500 dark:text-gray-500">{desc}</span>
                                  </>
                                )
                              })()}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Pricing Breakdown */}
                      <div className="bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 rounded-xl p-6">
                        <h5 className="font-semibold text-gray-900 dark:text-white mb-4">Resumo de Custos</h5>
                        <div className="space-y-3">
                          {(() => {
                            const inputCostUSD = (estimatedInputTokens / 1000000) * groqModel.input
                            const outputCostUSD = (estimatedOutputTokens / 1000000) * groqModel.output
                            const usageCostUSD = inputCostUSD + outputCostUSD
                            const usageCostBRL = usageCostUSD * exchangeRate
                            const finalCostBRL = Math.max(usageCostBRL, minimumMonthlyFee)
                            const isMinimumApplied = finalCostBRL === minimumMonthlyFee
                            
                            return (
                              <>
                                <div className="flex items-center justify-between text-sm">
                                  <div className="flex flex-col">
                                    <span className="text-gray-600 dark:text-gray-400">Processamento (entrada)</span>
                                    <span className="text-xs text-gray-400">Com base no uso estimado</span>
                                  </div>
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {formatCurrency(inputCostUSD * exchangeRate)}
                                  </span>
                                </div>
                                
                                <div className="flex items-center justify-between text-sm">
                                  <div className="flex flex-col">
                                    <span className="text-gray-600 dark:text-gray-400">Respostas da IA (saída)</span>
                                    <span className="text-xs text-gray-400">Com base no uso estimado</span>
                                  </div>
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {formatCurrency(outputCostUSD * exchangeRate)}
                                  </span>
                                </div>

                                {isMinimumApplied && (
                                  <>
                                    <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                                      <span>Subtotal de uso</span>
                                      <span>{formatCurrency(usageCostBRL)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                      <div className="flex items-center gap-1">
                                        <span className="text-amber-600 dark:text-amber-400">Taxa mínima mensal</span>
                                        <Info className="w-3.5 h-3.5 text-amber-500" />
                                      </div>
                                      <span className="font-medium text-amber-600 dark:text-amber-400">
                                        {formatCurrency(minimumMonthlyFee)}
                                      </span>
                                    </div>
                                  </>
                                )}
                                
                                <div className="pt-3 border-t border-purple-200 dark:border-purple-700">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="font-semibold text-gray-900 dark:text-white">Total Add-on IA/mês</span>
                                    <div className="text-right">
                                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                                        {formatCurrency(finalCostBRL)}
                                      </div>
                                      {!isMinimumApplied && (
                                        <div className="text-xs text-gray-500">
                                          ≈ ${usageCostUSD.toFixed(2)} USD
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </>
                            )
                          })()}
                        </div>
                        
                        {/* Action Button */}
                        <button
                          onClick={() => {
                            const inputCostUSD = (estimatedInputTokens / 1000000) * groqModel.input
                            const outputCostUSD = (estimatedOutputTokens / 1000000) * groqModel.output
                            const usageCostBRL = (inputCostUSD + outputCostUSD) * exchangeRate
                            const finalCost = Math.max(usageCostBRL, minimumMonthlyFee)
                            
                            // AI addon only for Enterprise
                            if (currentPlanSlug !== 'enterprise') {
                              toast.info('Plano Enterprise Necessário', 'O add-on de IA está disponível apenas para planos Enterprise.')
                              return
                            }
                            
                            // Activate AI addon
                            setAiAddonEnabled(true)
                            toast.success(
                              'Add-on de IA Ativado', 
                              `Add-on de IA adicionado ao seu plano por ${formatCurrency(finalCost)}/mês`
                            )
                            
                            // Scroll para o topo para ver o add-on ativo
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                            
                            // TODO: Implementar lógica de backend para salvar o add-on
                          }}
                          className="w-full mt-4 py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 text-white bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 shadow-lg hover:shadow-xl"
                        >
                          <Zap className="w-5 h-5" />
                          Adicionar ao Plano
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
              </div>
            </div>
          </motion.div>

          {/* Email Add-on Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-12"
          >
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 flex items-center justify-center gap-2">
                <Mail className="w-6 h-6 text-blue-500" />
                Módulo de Email
              </h3>
              <p className="text-gray-500">Centralize seus emails e aumente sua produtividade</p>
            </div>

            <div className="max-w-4xl mx-auto">
              <div className={cn(
                "bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-2xl border-2 p-8 transition-all",
                emailAddonEnabled
                  ? 'border-blue-500 ring-2 ring-blue-500/20'
                  : 'border-gray-200 dark:border-gray-700'
              )}>
                {!emailAddonEnabled && (
                  <>
                    {/* Header with Checkbox */}
                    <div className="flex items-start gap-4 mb-6">
                      <button
                        onClick={() => setEmailAddonEnabled(!emailAddonEnabled)}
                        className={cn(
                          "flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all",
                          emailAddonEnabled
                            ? 'bg-blue-500 border-blue-500'
                            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                        )}
                      >
                        {emailAddonEnabled && <Check className="w-4 h-4 text-white" />}
                      </button>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="text-xl font-bold text-gray-900 dark:text-white">Módulo de Email</h4>
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
                            Add-on Pago
                          </span>
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400">
                            A partir de {formatCurrency(19.90)}/mês
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Sincronize Gmail, Outlook ou qualquer email via IMAP. Escolha o número de contas de acordo com sua necessidade. Envie e receba emails diretamente no CRM com vinculação automática a contatos e oportunidades.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 p-4 bg-white/50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-blue-200 dark:border-blue-700 mb-6">
                      <div className="text-center">
                        <Mail className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Clique no checkbox acima para adicionar o módulo de Email ao seu plano e gerenciar todos os seus emails no CRM.
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {emailAddonEnabled && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Check className="w-5 h-5 text-emerald-500" />
                        Add-on de Email Ativo
                      </h4>
                      <button
                        onClick={() => setShowCancelEmailAddonModal(true)}
                        className="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        Cancelar Add-on
                      </button>
                    </div>
                  </div>
                )}

                {/* Email Features List - Always visible */}
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-white/50 dark:bg-gray-800/50 rounded-xl">
                    {[
                      { icon: Mail, label: 'Inbox integrada no CRM', desc: 'Centralize todos os seus emails' },
                      { icon: Zap, label: 'Sincronização automática', desc: 'Gmail, Outlook e IMAP a cada 5min' },
                      { icon: Users, label: 'Vinculação inteligente', desc: 'Emails linkados a contatos automaticamente' },
                      { icon: BarChart3, label: 'Tracking de emails', desc: 'Veja aberturas e cliques em tempo real' },
                    ].map((feature) => (
                      <div key={feature.label} className="flex items-start gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex-shrink-0">
                          <feature.icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{feature.label}</p>
                          <p className="text-xs text-gray-500">{feature.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Email Add-on Pricing Options */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <CreditCard className="w-5 h-5 text-blue-500" />
                      <h5 className="font-semibold text-gray-900 dark:text-white">Planos de Email</h5>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                      Escolha o plano de acordo com o número de contas de email que você precisa conectar:
                    </p>

                    {/* Pricing Options */}
                    <div className="space-y-3 mb-6">
                      {[
                        { name: 'Básico', accounts: 1, price: 19.90, icon: Sparkles, description: 'Ideal para começar', color: 'green' },
                        { name: 'Profissional', accounts: 3, price: 49.90, icon: Rocket, description: 'Para equipes pequenas', color: 'blue' },
                        { name: 'Empresarial', accounts: -1, price: 89.90, icon: Crown, description: 'Contas ilimitadas', color: 'amber' },
                      ].map((option) => (
                        <div
                          key={option.name}
                          className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900/50 dark:to-gray-800/50 border-2 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 transition-all cursor-pointer"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className={cn(
                              "p-2 rounded-lg",
                              option.color === 'green' && "bg-green-100 dark:bg-green-900/30",
                              option.color === 'blue' && "bg-blue-100 dark:bg-blue-900/30",
                              option.color === 'amber' && "bg-amber-100 dark:bg-amber-900/30"
                            )}>
                              <option.icon className={cn(
                                "w-5 h-5",
                                option.color === 'green' && "text-green-600 dark:text-green-400",
                                option.color === 'blue' && "text-blue-600 dark:text-blue-400",
                                option.color === 'amber' && "text-amber-600 dark:text-amber-400"
                              )} />
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900 dark:text-white">
                                {option.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {option.accounts === -1 ? 'Contas ilimitadas' : `${option.accounts} conta${option.accounts > 1 ? 's' : ''} de email`} • {option.description}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={cn(
                              "text-2xl font-bold",
                              option.color === 'green' && "text-green-600 dark:text-green-400",
                              option.color === 'blue' && "text-blue-600 dark:text-blue-400",
                              option.color === 'amber' && "text-amber-600 dark:text-amber-400"
                            )}>
                              {formatCurrency(option.price)}
                            </div>
                            <div className="text-xs text-gray-500">
                              por mês
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {!emailAddonEnabled && (
                      <button
                        onClick={() => {
                          setEmailAddonEnabled(true)
                          const price = getEmailAddonPrice(currentPlanSlug)
                          toast.success(
                            'Add-on de Email Ativado',
                            `Módulo de Email adicionado por ${formatCurrency(price)}/mês. Configure suas contas na aba Email!`
                          )
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        className="w-full py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 text-white bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 shadow-lg hover:shadow-xl"
                      >
                        <Mail className="w-5 h-5" />
                        Adicionar ao Plano
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Pipelines Add-on Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-12"
          >
            <div className="mt-6 p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                    <Kanban className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      Add-on: Múltiplos Pipelines
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Crie pipelines adicionais para diferentes processos de venda
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pipelinesAddonEnabled}
                    onChange={async (e) => {
                      const enable = e.target.checked
                      try {
                        if (enable) {
                          await pipelineAddonApi.activate()
                          // Force refetch tenant data to get updated pipelines_count
                          await queryClient.invalidateQueries({ queryKey: ['tenant'] })
                          await queryClient.refetchQueries({ queryKey: ['tenant'] })
                          
                          // Update local state from tenantData (will update automatically from query)
                          setPipelinesAddonEnabled(true)
                          
                          toast.success('Add-on Ativado', 'Múltiplos Pipelines ativado com sucesso!')
                        } else {
                          if (pipelinesCount > 1) {
                            toast.error(
                              'Erro ao Desativar',
                              `Você tem ${pipelinesCount} pipelines. Delete os extras (mantenha apenas 1) antes de desativar.`
                            )
                            e.target.checked = true
                            return
                          }
                          await pipelineAddonApi.deactivate()
                          await queryClient.invalidateQueries({ queryKey: ['tenant'] })
                          await queryClient.refetchQueries({ queryKey: ['tenant'] })
                          setPipelinesAddonEnabled(false)
                          toast.success('Add-on Desativado', 'Múltiplos Pipelines foi desativado')
                        }
                      } catch (error) {
                        console.error('Pipeline addon error:', error)
                        toast.error('Erro', 'Não foi possível atualizar o add-on')
                        e.target.checked = !enable
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {pipelinesAddonEnabled && (
                <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-700">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Pipelines atuais
                      </span>
                      <span className="text-xl font-bold text-purple-600 dark:text-purple-400">
                        {pipelinesCount} {pipelinesCount === 1 ? 'pipeline' : 'pipelines'}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Pipeline gratuito
                      </span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        1 pipeline (incluído)
                      </span>
                    </div>
                    
                    {pipelinesCount > 1 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Pipelines Ilimitados
                        </span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {pipelinesCount} pipelines ativos
                        </span>
                      </div>
                    )}
                    
                    <div className="pt-3 border-t border-purple-200 dark:border-purple-700">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900 dark:text-white">
                          Total Mensal
                        </span>
                        <span className="text-2xl font-black text-purple-600 dark:text-purple-400">
                          {formatCurrency(getPipelinesAddonPrice())}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                    <div className="flex items-start gap-2">
                      <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-blue-800 dark:text-blue-200">
                        <p className="font-semibold mb-1">Como funciona:</p>
                        <ul className="space-y-1 list-disc list-inside">
                          <li>1 pipeline é sempre gratuito</li>
                          <li><strong>R$ 29,90/mês</strong> para pipelines ilimitados</li>
                          <li>Crie quantos pipelines precisar</li>
                          <li>Gerencie em Funil de Vendas → Configurações</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {!pipelinesAddonEnabled && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/20 rounded-xl">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Ative este add-on para criar múltiplos pipelines e organizar diferentes processos de vendas (ex: vendas recorrentes, projetos customizados, etc.)
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    Preço: R$ 29,90/mês para pipelines ilimitados (1 pipeline sempre gratuito)
                  </p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Add-on Campanhas de E-mail (base de leads) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-12"
          >
            <div className="mt-6 p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-cyan-100 dark:bg-cyan-900/30 rounded-xl">
                    <Send className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      Add-on: Campanhas de E-mail
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Envio em massa e campanhas por base de leads (faixas)
                    </p>
                  </div>
                </div>
              </div>

              {emailCampaignsAddonEnabled ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border-2 border-cyan-200 dark:border-cyan-700 bg-cyan-50 dark:bg-cyan-900/20">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">Add-on Campanhas de E-mail ativo</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Faixa: {EMAIL_CAMPAIGNS_TIERS.find(t => t.id === emailCampaignsLeadsTier)?.label ?? emailCampaignsLeadsTier} — {formatCurrency(getEmailCampaignsAddonPrice(emailCampaignsLeadsTier))}/mês
                        </p>
                      </div>
                      <div className="flex items-end gap-2">
                        <span className="text-xl font-bold text-cyan-600 dark:text-cyan-400">
                          {formatCurrency(getEmailCampaignsAddonPrice(emailCampaignsLeadsTier))}
                        </span>
                        <span className="text-xs text-gray-500">/mês</span>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <select
                        value={emailCampaignsLeadsTier}
                        onChange={async (e) => {
                          const newTier = e.target.value
                          try {
                            await emailCampaignsAddonApi.updateTier(newTier)
                            await queryClient.invalidateQueries({ queryKey: ['tenant'] })
                            setEmailCampaignsLeadsTier(newTier)
                            const tier = EMAIL_CAMPAIGNS_TIERS.find(t => t.id === newTier)
                            toast.success('Faixa atualizada', `Campanhas de E-mail: ${tier?.label} — ${formatCurrency(tier?.price_monthly ?? 0)}/mês`)
                          } catch {
                            toast.error('Erro', 'Não foi possível alterar a faixa de leads.')
                          }
                        }}
                        className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      >
                        {EMAIL_CAMPAIGNS_TIERS.map((t) => (
                          <option key={t.id} value={t.id}>{t.label} — {formatCurrency(t.price_monthly)}/mês</option>
                        ))}
                      </select>
                      <button
                        onClick={() => setShowCancelEmailCampaignsAddonModal(true)}
                        className="px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        Cancelar Add-on
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Contrate por faixa de leads. Escolha a base de leads que você precisa para campanhas de e-mail.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    {EMAIL_CAMPAIGNS_TIERS.map((tier) => (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={async () => {
                          try {
                            await emailCampaignsAddonApi.activate(tier.id)
                            await queryClient.invalidateQueries({ queryKey: ['tenant'] })
                            setEmailCampaignsAddonEnabled(true)
                            setEmailCampaignsLeadsTier(tier.id)
                            setAddons({ email_addon_enabled: fullTenant?.email_addon_enabled ?? false, pipelines_addon_enabled: fullTenant?.pipelines_addon_enabled ?? false, ai_addon_enabled: fullTenant?.ai_addon_enabled ?? false, email_campaigns_addon_enabled: true })
                            toast.success('Add-on ativado', `Campanhas de E-mail: ${tier.label} — ${formatCurrency(tier.price_monthly)}/mês`)
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          } catch {
                            toast.error('Erro', 'Não foi possível ativar o add-on Campanhas de E-mail.')
                          }
                        }}
                        className="p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-cyan-500 dark:hover:border-cyan-500 bg-white dark:bg-gray-800 text-left transition-all"
                      >
                        <div className="font-medium text-gray-900 dark:text-white">{tier.label}</div>
                        <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400 mt-1">{formatCurrency(tier.price_monthly)}<span className="text-sm font-normal text-gray-500">/mês</span></div>
                      </button>
                    ))}
                  </div>
                  {!emailAddonEnabled && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700 text-sm text-amber-800 dark:text-amber-200">
                      <strong>Recomendado:</strong> ative o Módulo de Email antes para usar contas de envio nas campanhas.
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>

          {/* Payment History Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mt-12"
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                    <History className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Histórico de Pagamentos</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Últimas transações realizadas</p>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {paymentHistoryData && paymentHistoryData.length > 0 ? (
                  paymentHistoryData.slice(0, 5).map((payment: any) => (
                    <div key={payment.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center",
                          payment.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-gray-100 dark:bg-gray-700',
                        )}>
                          {payment.status === 'completed' ? (
                            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Clock className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {payment.type === 'subscription' ? 'Assinatura' : 'Pagamento'} — {payment.paypal_payer_email || 'PayPal'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {payment.paid_at
                              ? new Date(payment.paid_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
                              : new Date(payment.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          {formatCurrency(parseFloat(payment.amount || '0'))}
                        </p>
                        <p className={cn(
                          "text-xs font-medium",
                          payment.status === 'completed' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400',
                        )}>
                          {payment.status === 'completed' ? 'Pago' : payment.status === 'pending' ? 'Pendente' : payment.status}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-6 py-10 text-center">
                    <Receipt className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum pagamento registrado ainda</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Seus pagamentos aparecerão aqui após a primeira cobrança</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Manage Subscription / Cancel Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mt-12"
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-red-100 dark:bg-red-900/30 rounded-xl">
                  <ShieldX className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Cancelar Assinatura</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Encerrar o plano atual e voltar para o plano gratuito</p>
                </div>
              </div>

              {subscriptionData?.plan?.slug && subscriptionData.plan.slug !== 'free' && subscriptionData?.status !== 'cancelled' ? (
                <>
                  <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl mb-4">
                    <p className="text-sm text-red-700 dark:text-red-300">
                      Ao cancelar sua assinatura, você perderá acesso a todos os recursos do plano <strong>{subscriptionData?.plan?.name}</strong> e 
                      todos os add-ons ativos serão desativados. Você será movido para o plano gratuito com limites reduzidos.
                      <strong> Esta ação é irreversível.</strong>
                    </p>
                  </div>

                  <button
                    onClick={() => setShowCancelSubscriptionModal(true)}
                    className="px-6 py-3 rounded-xl border-2 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 font-medium hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors flex items-center gap-2"
                  >
                    <ShieldX className="w-4 h-4" />
                    Cancelar minha assinatura
                  </button>
                </>
              ) : (
                <div className="p-4 bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded-xl">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Você está no plano <strong>gratuito</strong>. Faça upgrade para um plano pago acima para desbloquear mais recursos.
                    Caso tenha um plano ativo, a opção de cancelamento aparecerá aqui.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* ==================== APPEARANCE TAB ==================== */}
      {activeTab === 'appearance' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <Palette className="w-5 h-5 text-blue-500" />
              Tema da Interface
            </h3>

            <div className="grid grid-cols-3 gap-4">
              {[
                { id: 'light', label: 'Claro', icon: Sun, desc: 'Tema claro para uso diurno' },
                { id: 'dark', label: 'Escuro', icon: Moon, desc: 'Tema escuro para reduzir fadiga ocular' },
                { id: 'system', label: 'Sistema', icon: Monitor, desc: 'Segue as configurações do sistema' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => applyTheme(item.id as 'light' | 'dark' | 'system')}
                  className={cn(
                    "p-4 rounded-xl border-2 transition-all text-left",
                    theme === item.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-lg flex items-center justify-center mb-3",
                    theme === item.id
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  )}>
                    <item.icon className="w-6 h-6" />
                  </div>
                  <h4 className={cn(
                    "font-semibold mb-1",
                    theme === item.id
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-900 dark:text-white'
                  )}>
                    {item.label}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {item.desc}
                  </p>
                  {theme === item.id && (
                    <div className="mt-3 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                      <Check className="w-4 h-4" />
                      Ativo
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ==================== MODALS ==================== */}

      {/* AI Plan Change Confirmation Modal */}
      <AnimatePresence>
        {selectedAiPlanId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setSelectedAiPlanId(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  Confirmar Mudança de Plano
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
                  Você está prestes a alterar para o plano{' '}
                  <strong>{aiPlans.find((p: any) => p.id === selectedAiPlanId)?.name || 'selecionado'}</strong>.
                  {(aiPlans.find((p: any) => p.id === selectedAiPlanId)?.price_monthly || 0) > 0 &&
                    ' Este plano requer pagamento mensal.'}
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedAiPlanId(null)}
                    className="flex-1 py-2.5 px-4 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => changeAiPlanMutation.mutate(selectedAiPlanId)}
                    disabled={changeAiPlanMutation.isPending}
                    className="flex-1 py-2.5 px-4 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                  >
                    {changeAiPlanMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Confirmar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calculator Modal for Dynamic Pricing */}
      <AnimatePresence>
        {showCalculator && selectedPlanId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowCalculator(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Calculator className="w-6 h-6 text-blue-400" />
                  Calculadora de Preço
                </h2>
                <p className="text-gray-500 mt-1">
                  Ajuste os recursos conforme sua necessidade
                </p>
              </div>

              <div className="p-6 space-y-6">
                {/* Sliders */}
                {[
                  { key: 'users' as const, label: 'Usuários', icon: Users, min: 1, max: 50, step: 1 },
                  { key: 'clients' as const, label: 'Clientes', icon: UserCircle, min: 0, max: 2000, step: 25 },
                  { key: 'products' as const, label: 'Produtos', icon: Package, min: 0, max: 3000, step: 50 },
                  { key: 'transactions' as const, label: 'Transações/mês', icon: Receipt, min: 0, max: 10000, step: 100 },
                ].map(({ key, label, icon: Icon, min, max, step }) => (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <Icon className="w-4 h-4 text-gray-500" />
                        {label}
                      </label>
                      <span className="text-lg font-bold text-gray-900 dark:text-white">
                        {quantities[key].toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={step}
                      value={quantities[key]}
                      onChange={(e) => setQuantities(prev => ({ ...prev, [key]: parseInt(e.target.value) }))}
                      className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{min}</span>
                      <span>{max.toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                ))}

                {/* Price Result */}
                {calculateMutation.isPending ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  </div>
                ) : calculatedPrice ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700"
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Preço base</span>
                        <span className="text-gray-900 dark:text-white">{formatCurrency(calculatedPrice.base_price)}</span>
                      </div>
                      
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
                        <div className="flex justify-between items-end">
                          <span className="text-lg font-medium text-gray-900 dark:text-white">Total</span>
                          <div className="text-right">
                            <span className="text-3xl font-bold text-gray-900 dark:text-white">
                              {formatCurrency(calculatedPrice.total)}
                            </span>
                            <span className="text-gray-400 text-sm">
                              /{billingCycle === 'yearly' ? 'ano' : 'mês'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </div>

              {/* Actions */}
              <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
                <button
                  onClick={() => setShowCalculator(false)}
                  disabled={isProcessingPayment}
                  className="flex-1 py-3 px-4 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (selectedPlanId) {
                      const selectedPlan = plans.find((p: any) => p.id === selectedPlanId)
                      handlePayPalCheckout(selectedPlanId, selectedPlan?.has_dynamic_pricing || false)
                    }
                  }}
                  disabled={isProcessingPayment}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium hover:from-blue-600 hover:to-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isProcessingPayment ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      Continuar Pagamento
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Confirmação de Cancelamento do Add-on */}
      <AnimatePresence>
        {showCancelAddonModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowCancelAddonModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md rounded-2xl shadow-2xl"
            >
              <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl">
                {/* Icon */}
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">
                  Cancelar Add-on de IA?
                </h3>

                {/* Description */}
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
                  Você perderá o acesso aos seguintes recursos:
                </p>

                {/* Features List */}
                <div className="space-y-2 mb-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  {[
                    'Chat de IA para atendimento',
                    'Geração de propostas automáticas',
                    'Lead scoring preditivo',
                    'Insights automáticos',
                  ].map((feature) => (
                    <div key={feature} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <X className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-center text-gray-500 dark:text-gray-400 mb-6">
                  A remoção do add-on entrará em vigor no próximo ciclo de cobrança.
                </p>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCancelAddonModal(false)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-sm"
                  >
                    Manter
                  </button>
                  <button
                    onClick={() => {
                      setAiAddonEnabled(false)
                      setShowCancelAddonModal(false)
                      toast.success('Add-on Removido', 'O add-on de IA foi removido do seu plano.')
                    }}
                    className="flex-1 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium flex items-center justify-center gap-1.5 text-sm whitespace-nowrap"
                  >
                    <X className="w-4 h-4 flex-shrink-0" />
                    <span>Confirmar</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel Email Add-on Modal */}
      <AnimatePresence>
        {showCancelEmailAddonModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCancelEmailAddonModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                    Cancelar Módulo de Email
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Você perderá acesso aos seguintes recursos:
                  </p>
                </div>
              </div>

              {/* Features List */}
              <div className="space-y-2 mb-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                {[
                  'Inbox integrada no CRM',
                  'Sincronização de emails',
                  'Vinculação a contatos e oportunidades',
                  'Tracking de emails',
                ].map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <X className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-center text-gray-500 dark:text-gray-400 mb-6">
                A remoção do add-on entrará em vigor no próximo ciclo de cobrança.
              </p>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelEmailAddonModal(false)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-sm"
                >
                  Manter
                </button>
                <button
                  onClick={() => {
                    setEmailAddonEnabled(false)
                    setShowCancelEmailAddonModal(false)
                    toast.success('Add-on Removido', 'O módulo de Email foi removido do seu plano.')
                  }}
                  className="flex-1 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium flex items-center justify-center gap-1.5 text-sm whitespace-nowrap"
                >
                  <X className="w-4 h-4 flex-shrink-0" />
                  <span>Confirmar</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel Email Campaigns Add-on Modal */}
      <AnimatePresence>
        {showCancelEmailCampaignsAddonModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCancelEmailCampaignsAddonModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                    Cancelar Add-on Campanhas de E-mail
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Você perderá acesso a campanhas de e-mail em massa e envio por base de leads.
                  </p>
                </div>
              </div>

              <div className="space-y-2 mb-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                {['Campanhas de e-mail em massa', 'Modelos de template', 'Tracking de abertura e cliques', 'Envio por faixa de leads'].map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <X className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-center text-gray-500 dark:text-gray-400 mb-6">
                A remoção do add-on entrará em vigor no próximo ciclo de cobrança.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelEmailCampaignsAddonModal(false)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-sm"
                >
                  Manter
                </button>
                <button
                  onClick={async () => {
                    try {
                      await emailCampaignsAddonApi.deactivate()
                      await queryClient.invalidateQueries({ queryKey: ['tenant'] })
                      setEmailCampaignsAddonEnabled(false)
                      setEmailCampaignsLeadsTier('')
                      setAddons({ email_addon_enabled: fullTenant?.email_addon_enabled ?? false, pipelines_addon_enabled: fullTenant?.pipelines_addon_enabled ?? false, ai_addon_enabled: fullTenant?.ai_addon_enabled ?? false, email_campaigns_addon_enabled: false })
                      setShowCancelEmailCampaignsAddonModal(false)
                      toast.success('Add-on Removido', 'Campanhas de E-mail foi removido do seu plano.')
                    } catch {
                      toast.error('Erro', 'Não foi possível cancelar o add-on.')
                    }
                  }}
                  className="flex-1 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium flex items-center justify-center gap-1.5 text-sm whitespace-nowrap"
                >
                  <X className="w-4 h-4 flex-shrink-0" />
                  <span>Confirmar</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel Subscription Modal */}
      <CancelSubscriptionModal
        isOpen={showCancelSubscriptionModal}
        onClose={() => setShowCancelSubscriptionModal(false)}
        onConfirm={async (reason) => {
          await cancelSubscriptionMutation.mutateAsync(reason)
        }}
        planName={subscriptionData?.plan?.name || 'Atual'}
        activeAddons={{
          ai: aiAddonEnabled,
          email: emailAddonEnabled,
          pipelines: pipelinesAddonEnabled,
          emailCampaigns: emailCampaignsAddonEnabled,
        }}
      />
    </div>
  )
}
