'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
  Mail,
  Plus,
  MoreVertical,
  Loader2,
  Send,
  Calendar,
} from 'lucide-react'
import { emailMarketingApi } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent'

interface EmailCampaign {
  id: string
  name: string
  subject: string
  status: CampaignStatus
  sent_at: string | null
  created_at: string
  updated_at: string
  recipients_count: number
  delivered_count: number
  opened_count: number
  clicked_count: number
  open_rate: number | null
  click_rate: number | null
  created_by_user?: { name: string }
}

const statusLabels: Record<CampaignStatus, string> = {
  draft: 'RASCUNHO',
  scheduled: 'Agendada',
  sending: 'Enviando',
  sent: 'ENVIADO',
}

export default function EmailCampaignsPage() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string>('')

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['email-marketing', 'campaigns', statusFilter],
    queryFn: async () => {
      const res = await emailMarketingApi.campaigns.list(
        statusFilter ? { status: statusFilter } : undefined
      )
      return res.data ?? []
    },
  })

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-display">
            Campanhas de e-mail
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Crie e envie campanhas de email marketing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm"
          >
            <option value="">Todos os estados</option>
            <option value="draft">Rascunho</option>
            <option value="sent">Enviado</option>
          </select>
          <Link
            href="/email/campaigns/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            Campanha de e-mail
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">
            <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">Nenhuma campanha ainda</p>
            <p className="text-sm mt-1">Crie sua primeira campanha de e-mail</p>
            <Link
              href="/email/campaigns/new"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
            >
              <Plus className="w-4 h-4" />
              Campanha de e-mail
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {(campaigns as EmailCampaign[]).map((campaign) => (
              <li
                key={campaign.id}
                className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/email/campaigns/${campaign.id}`}
                      className="font-medium text-gray-900 dark:text-white hover:underline truncate"
                    >
                      {campaign.name}
                    </Link>
                    <span
                      className={cn(
                        'inline-flex px-2 py-0.5 text-xs font-medium rounded',
                        campaign.status === 'sent'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                      )}
                    >
                      {statusLabels[campaign.status] ?? campaign.status}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-x-4 gap-y-1">
                    {campaign.status === 'sent' && campaign.sent_at ? (
                      <>
                        <span className="flex items-center gap-1">
                          <Send className="w-3.5 h-3.5" />
                          Enviado em {formatDate(campaign.sent_at)}
                          {campaign.created_by_user?.name &&
                            ` por ${campaign.created_by_user.name}`}
                        </span>
                      </>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Atualizado em {formatDate(campaign.updated_at)}
                        {campaign.created_by_user?.name &&
                          ` por ${campaign.created_by_user.name}`}
                      </span>
                    )}
                  </div>
                  {campaign.status === 'sent' && (
                    <div className="mt-2 flex flex-wrap gap-4 text-sm">
                      <span className="text-gray-600 dark:text-gray-300">
                        Entregue: <strong>{campaign.delivered_count}</strong>
                      </span>
                      <span className="text-gray-600 dark:text-gray-300">
                        Aberto:{' '}
                        <strong>
                          {campaign.open_rate != null
                            ? `${campaign.open_rate}%`
                            : '-'}
                        </strong>
                      </span>
                      <span className="text-gray-600 dark:text-gray-300">
                        Clicado:{' '}
                        <strong>
                          {campaign.click_rate != null
                            ? `${campaign.click_rate}%`
                            : '-'}
                        </strong>
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/email/campaigns/${campaign.id}`}
                    className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400"
                    title="Ver / Editar"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
