'use client'

import { useEffect, useState } from 'react'
import { Clock, X, Crown } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'

interface SubscriptionStatus {
  has_subscription: boolean
  subscription?: {
    status: string
    trial_days_remaining: number
    is_on_trial: boolean
    trial_expired: boolean
    has_access: boolean
    trial_ends_at: string
  }
  plan?: {
    name: string
    slug: string
  }
  message?: string
}

export function TrialBanner() {
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null)
  const [isVisible, setIsVisible] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSubscriptionStatus()
  }, [])

  const fetchSubscriptionStatus = async () => {
    try {
      const response = await api.get('/tenant/subscription-status')
      setSubscriptionStatus(response.data.data)
    } catch (error) {
      console.error('Error fetching subscription status:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !subscriptionStatus?.has_subscription) {
    return null
  }

  // Only show banner if on trial
  if (!subscriptionStatus.subscription?.is_on_trial) {
    return null
  }

  // Don't show if user manually closed it
  if (!isVisible) {
    return null
  }

  const daysRemaining = subscriptionStatus.subscription.trial_days_remaining

  // Color based on days remaining
  const getBannerStyle = () => {
    if (daysRemaining <= 3) {
      return {
        bg: 'bg-red-50 dark:bg-red-900/10',
        border: 'border-red-200 dark:border-red-800',
        text: 'text-red-800 dark:text-red-200',
        icon: 'text-red-500 dark:text-red-400',
      }
    }
    if (daysRemaining <= 7) {
      return {
        bg: 'bg-yellow-50 dark:bg-yellow-900/10',
        border: 'border-yellow-200 dark:border-yellow-800',
        text: 'text-yellow-800 dark:text-yellow-200',
        icon: 'text-yellow-500 dark:text-yellow-400',
      }
    }
    return {
      bg: 'bg-emerald-50 dark:bg-emerald-900/10',
      border: 'border-emerald-200 dark:border-emerald-800',
      text: 'text-emerald-800 dark:text-emerald-200',
      icon: 'text-emerald-500 dark:text-emerald-400',
    }
  }

  const style = getBannerStyle()

  return (
    <div className={`${style.bg} border ${style.border} rounded-lg p-4 mb-6 relative`}>
      <button
        onClick={() => setIsVisible(false)}
        className={`absolute top-3 right-3 ${style.text} hover:opacity-70 transition-opacity`}
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${style.bg} border ${style.border}`}>
          <Crown className={`w-5 h-5 ${style.icon}`} />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className={`font-semibold ${style.text}`}>
              Trial do Plano {subscriptionStatus.plan?.name || 'Business'}
            </h3>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} border ${style.border} ${style.text}`}>
              <Clock className="w-3 h-3" />
              {daysRemaining} {daysRemaining === 1 ? 'dia' : 'dias'} restantes
            </span>
          </div>

          <p className={`text-sm ${style.text} mb-3`}>
            {daysRemaining <= 3 ? (
              <>
                ⚠️ Seu trial está acabando! Assine agora para não perder o acesso a todas as funcionalidades.
              </>
            ) : daysRemaining <= 7 ? (
              <>
                Você tem {daysRemaining} dias de acesso gratuito a todas as funcionalidades do plano Business.
              </>
            ) : (
              <>
                🎉 Aproveite seu trial de 14 dias com acesso total ao plano Business!
              </>
            )}
          </p>

          <div className="flex items-center gap-3">
            <Link
              href="/subscription/plans"
              className={`inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors`}
            >
              Assinar Agora
            </Link>
            <Link
              href="/subscription/plans"
              className={`text-sm ${style.text} hover:underline`}
            >
              Ver planos disponíveis
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
