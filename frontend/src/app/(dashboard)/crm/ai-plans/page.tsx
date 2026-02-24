'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Zap,
  Rocket,
  Building2,
  Crown,
  Check,
  X,
  TrendingUp,
  Clock,
  BarChart3,
  AlertCircle,
  ChevronRight,
  MessageSquare,
  FileText,
  Mail,
  Target,
  Brain,
  RefreshCw,
  Calendar,
  Activity
} from 'lucide-react'
import { aiPlansApi } from '@/lib/api'

export default function AIPlansPage() {
  const queryClient = useQueryClient()
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)

  // Fetch all plans
  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['ai-plans'],
    queryFn: async () => {
      const response = await aiPlansApi.list()
      return response.data.data
    },
  })

  // Fetch current plan and usage
  const { data: currentData, isLoading: currentLoading } = useQuery({
    queryKey: ['ai-current-plan'],
    queryFn: async () => {
      const response = await aiPlansApi.current()
      return response.data.data
    },
  })

  // Fetch detailed usage
  const { data: usageData } = useQuery({
    queryKey: ['ai-usage'],
    queryFn: async () => {
      const response = await aiPlansApi.usage()
      return response.data.data
    },
  })

  // Change plan mutation
  const changePlanMutation = useMutation({
    mutationFn: (planId: string) => aiPlansApi.changePlan(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-current-plan'] })
      setSelectedPlanId(null)
      alert('Plano alterado com sucesso!')
    },
    onError: () => {
      alert('Erro ao alterar plano.')
    },
  })

  const plans = plansData || []
  const current = currentData || {}
  const usage = usageData || {}

  const getPlanIcon = (slug: string) => {
    switch (slug) {
      case 'gratuito': return <Zap className="h-6 w-6" />
      case 'starter': return <Rocket className="h-6 w-6" />
      case 'professional': return <Building2 className="h-6 w-6" />
      case 'enterprise': return <Crown className="h-6 w-6" />
      default: return <Sparkles className="h-6 w-6" />
    }
  }

  const getPlanColor = (slug: string) => {
    switch (slug) {
      case 'gratuito': return 'from-gray-500 to-gray-600'
      case 'starter': return 'from-emerald-500 to-teal-600'
      case 'professional': return 'from-blue-500 to-indigo-600'
      case 'enterprise': return 'from-amber-500 to-orange-600'
      default: return 'from-gray-500 to-gray-600'
    }
  }

  const formatNumber = (num: number | undefined | null) => {
    if (num === undefined || num === null) return '0'
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const formatCurrency = (value: number | undefined | null) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0)
  }

  const featureIcons: Record<string, any> = {
    chat: MessageSquare,
    autofill: FileText,
    email: Mail,
    lead_analysis: Target,
    advanced_learning: Brain,
  }

  if (plansLoading || currentLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Planos de IA</h1>
            <p className="text-sm text-gray-500">Gerencie os limites e recursos de IA do seu sistema</p>
          </div>
        </div>
      </div>

      {/* Current Plan & Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Plan Card */}
        <div className="lg:col-span-2 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl border border-blue-200 dark:border-blue-800 p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-1">Seu Plano Atual</p>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                {current.plan?.name || 'Gratuito'}
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                  current.plan?.slug === 'enterprise' 
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    : current.plan?.slug === 'professional'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : current.plan?.slug === 'starter'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {current.subscription_status === 'active' ? 'Ativo' : 'Inativo'}
                </span>
              </h2>
            </div>
            {(current.plan?.price_monthly || 0) > 0 && (
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-800 dark:text-white">
                  {formatCurrency(current.plan?.price_monthly)}
                </p>
                <p className="text-sm text-gray-500">/mês</p>
              </div>
            )}
          </div>

          {/* Usage Bars */}
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Tokens Hoje</span>
                <span className="font-medium text-gray-800 dark:text-white">
                  {formatNumber(current.usage?.tokens_used_today)} / {formatNumber(current.limits?.daily || current.plan?.daily_token_limit)}
                </span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    ((current.usage?.tokens_used_today || 0) / (current.limits?.daily || current.plan?.daily_token_limit || 1000)) > 0.8
                      ? 'bg-red-500'
                      : ((current.usage?.tokens_used_today || 0) / (current.limits?.daily || current.plan?.daily_token_limit || 1000)) > 0.5
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(((current.usage?.tokens_used_today || 0) / (current.limits?.daily || current.plan?.daily_token_limit || 1000)) * 100, 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Tokens este Mês</span>
                <span className="font-medium text-gray-800 dark:text-white">
                  {formatNumber(current.usage?.tokens_used_this_month)} / {formatNumber(current.limits?.monthly || current.plan?.monthly_token_limit)}
                </span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    ((current.usage?.tokens_used_this_month || 0) / (current.limits?.monthly || current.plan?.monthly_token_limit || 10000)) > 0.8
                      ? 'bg-red-500'
                      : ((current.usage?.tokens_used_this_month || 0) / (current.limits?.monthly || current.plan?.monthly_token_limit || 10000)) > 0.5
                      ? 'bg-amber-500'
                      : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(((current.usage?.tokens_used_this_month || 0) / (current.limits?.monthly || current.plan?.monthly_token_limit || 10000)) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Warning if near limit */}
          {((current.usage?.tokens_used_today || 0) / (current.limits?.daily || current.plan?.daily_token_limit || 1000)) > 0.8 && (
            <div className="mt-4 p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm">
              <AlertCircle className="h-4 w-4" />
              Você está próximo do limite diário. Considere fazer upgrade.
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Activity className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Requisições/min</span>
            </div>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">
              {current.limits?.per_minute || current.plan?.rate_limit_per_minute || 15}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Renova em</span>
            </div>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">
              {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </p>
          </div>
        </div>
      </div>

      {/* Feature Usage */}
      {usage?.by_feature && Object.keys(usage.by_feature).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-500" />
            Uso por Funcionalidade
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(usage.by_feature).map(([feature, tokens]: [string, any]) => {
              const Icon = featureIcons[feature] || Sparkles
              return (
                <div
                  key={feature}
                  className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                      {feature.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xl font-bold text-gray-800 dark:text-white">
                    {formatNumber(tokens)}
                  </p>
                  <p className="text-xs text-gray-500">tokens</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Plans Grid */}
      <div>
        <h3 className="font-semibold text-gray-800 dark:text-white mb-4">Planos Disponíveis</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan: any, index: number) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative bg-white dark:bg-gray-800 rounded-xl border p-5 transition-all ${
                current.plan?.id === plan.id
                  ? 'border-blue-500 ring-2 ring-blue-500/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {/* Current Badge */}
              {current.plan?.id === plan.id && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-500 text-white text-xs font-medium rounded-full">
                  Atual
                </div>
              )}

              {/* Popular Badge */}
              {plan.is_popular && current.plan?.id !== plan.id && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-amber-500 text-white text-xs font-medium rounded-full">
                  Popular
                </div>
              )}

              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${getPlanColor(plan.slug)}`}>
                  {getPlanIcon(plan.slug)}
                </div>
                <div>
                  <h4 className="font-bold text-gray-800 dark:text-white">{plan.name}</h4>
                  {(plan.price_monthly || 0) > 0 ? (
                    <p className="text-lg font-bold text-blue-600">
                      {formatCurrency(plan.price_monthly)}<span className="text-xs font-normal text-gray-500">/mês</span>
                    </p>
                  ) : (
                    <p className="text-lg font-bold text-emerald-600">Grátis</p>
                  )}
                </div>
              </div>

              {/* Limits */}
              <div className="space-y-2 mb-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Tokens/dia</span>
                  <span className="font-medium text-gray-800 dark:text-white">
                    {formatNumber(plan.daily_token_limit)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Tokens/mês</span>
                  <span className="font-medium text-gray-800 dark:text-white">
                    {formatNumber(plan.monthly_token_limit)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Req/minuto</span>
                  <span className="font-medium text-gray-800 dark:text-white">
                    {plan.rate_limit_per_minute}
                  </span>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-1 mb-4">
                {plan.features && Object.entries(typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features).slice(0, 4).map(([key, enabled]: [string, any]) => (
                  <div key={key} className="flex items-center gap-2 text-sm">
                    {enabled ? (
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <X className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    )}
                    <span className={enabled ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400'}>
                      {key.replace(/_/g, ' ')}
                    </span>
                  </div>
                ))}
              </div>

              {/* Action Button */}
              {current.plan?.id === plan.id ? (
                <button
                  disabled
                  className="w-full py-2.5 px-4 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg font-medium cursor-not-allowed"
                >
                  Plano Atual
                </button>
              ) : (
                <button
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`w-full py-2.5 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                    plan.slug === 'enterprise'
                      ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700'
                      : plan.slug === 'professional'
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700'
                      : plan.slug === 'starter'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700'
                      : 'bg-gray-800 text-white hover:bg-gray-900'
                  }`}
                >
                  {(plan.price_monthly || 0) > (current.plan?.price_monthly || 0) ? 'Fazer Upgrade' : 'Selecionar'}
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Confirm Plan Change Modal */}
      <AnimatePresence>
        {selectedPlanId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setSelectedPlanId(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                  Confirmar Mudança de Plano
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
                  Você está prestes a alterar para o plano{' '}
                  <strong>{plans.find((p: any) => p.id === selectedPlanId)?.name || 'selecionado'}</strong>.
                  {(plans.find((p: any) => p.id === selectedPlanId)?.price_monthly || 0) > 0 &&
                    ' Este plano requer pagamento mensal.'}
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedPlanId(null)}
                    className="flex-1 py-2.5 px-4 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => changePlanMutation.mutate(selectedPlanId)}
                    disabled={changePlanMutation.isPending}
                    className="flex-1 py-2.5 px-4 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {changePlanMutation.isPending ? (
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

      {/* Info Footer */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium mb-1">Sobre os limites de tokens</p>
            <p className="text-blue-600 dark:text-blue-400">
              Os tokens são usados para processar mensagens de IA. Cada funcionalidade (chat, auto-preenchimento, análise) 
              consome uma quantidade diferente de tokens. Os limites são resetados diariamente e mensalmente.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
