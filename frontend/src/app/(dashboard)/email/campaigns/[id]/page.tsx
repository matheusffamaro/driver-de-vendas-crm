'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Loader2,
  Send,
  Trash2,
  Calendar,
} from 'lucide-react'
import { emailMarketingApi, emailApi, clientsApi } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent'

export default function CampaignDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  const queryClient = useQueryClient()

  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [emailAccountId, setEmailAccountId] = useState('')
  const [emailTemplateId, setEmailTemplateId] = useState('')
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([])

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['email-marketing', 'campaign', id],
    queryFn: async () => {
      const res = await emailMarketingApi.campaigns.get(id)
      return res.data
    },
    enabled: !!id,
  })

  const { data: accountsData } = useQuery({
    queryKey: ['email', 'accounts'],
    queryFn: async () => {
      const res = await emailApi.accounts.list()
      return res.data ?? []
    },
  })
  const accounts = Array.isArray(accountsData) ? accountsData : []

  const { data: templatesData } = useQuery({
    queryKey: ['email-marketing', 'templates'],
    queryFn: async () => {
      const res = await emailMarketingApi.templates.list()
      return res.data ?? []
    },
  })
  const templates = Array.isArray(templatesData) ? templatesData : []

  const { data: recipientsData } = useQuery({
    queryKey: ['email-marketing', 'campaign', id, 'recipients'],
    queryFn: async () => {
      const res = await emailMarketingApi.campaigns.recipients(id)
      return res.data ?? []
    },
    enabled: !!id && !!campaign,
  })
  const recipients = Array.isArray(recipientsData) ? recipientsData : []

  const { data: clientsData } = useQuery({
    queryKey: ['clients', 'for-campaign'],
    queryFn: async () => {
      const res = await clientsApi.list({ per_page: 500 })
      const list = res.data?.data ?? []
      return list.filter((c: { email?: string }) => c.email && c.email.trim() !== '')
    },
    enabled: isEditing,
  })
  const clientsWithEmail = Array.isArray(clientsData) ? clientsData : []

  useEffect(() => {
    if (campaign) {
      setName(campaign.name ?? '')
      setSubject(campaign.subject ?? '')
      setBodyHtml(campaign.body_html ?? '')
      setEmailAccountId(campaign.email_account_id ?? '')
      setEmailTemplateId(campaign.email_template_id ?? '')
    }
  }, [campaign])

  useEffect(() => {
    if (recipients.length > 0 && isEditing && selectedClientIds.length === 0) {
      setSelectedClientIds(
        recipients
          .map((r: { client_id?: string }) => r.client_id)
          .filter((x): x is string => !!x)
      )
    }
  }, [recipients, isEditing])

  const updateMutation = useMutation({
    mutationFn: (data: {
      name?: string
      subject?: string
      body_html?: string
      email_template_id?: string
      email_account_id?: string
      client_ids?: string[]
    }) => emailMarketingApi.campaigns.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-marketing', 'campaign', id] })
      queryClient.invalidateQueries({ queryKey: ['email-marketing', 'campaigns'] })
      toast.success('Campanha atualizada')
      setIsEditing(false)
    },
    onError: (err: any) => {
      toast.error('Erro', err?.response?.data?.message || 'Não foi possível atualizar.')
    },
  })

  const sendMutation = useMutation({
    mutationFn: () => emailMarketingApi.campaigns.send(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-marketing', 'campaign', id] })
      queryClient.invalidateQueries({ queryKey: ['email-marketing', 'campaigns'] })
      toast.success('Envio iniciado', 'A campanha está sendo enviada.')
    },
    onError: (err: any) => {
      toast.error('Erro', err?.response?.data?.message || 'Não foi possível enviar.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => emailMarketingApi.campaigns.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-marketing', 'campaigns'] })
      toast.success('Campanha excluída')
      router.push('/email/campaigns')
    },
    onError: (err: any) => {
      toast.error('Erro', err?.response?.data?.message || 'Não foi possível excluir.')
    },
  })

  const handleSave = () => {
    updateMutation.mutate({
      name,
      subject,
      body_html: bodyHtml,
      email_template_id: emailTemplateId || undefined,
      email_account_id: emailAccountId,
      client_ids: selectedClientIds.length > 0 ? selectedClientIds : undefined,
    })
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const isDraft = campaign?.status === 'draft'

  if (isLoading || !campaign) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/email/campaigns"
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-display">
              {campaign.name}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2 text-sm">
              {campaign.status === 'sent' && campaign.sent_at ? (
                <>
                  <Send className="w-4 h-4" />
                  Enviado em {formatDate(campaign.sent_at)}
                  {campaign.created_by_user?.name && ` por ${campaign.created_by_user.name}`}
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4" />
                  Atualizado em {formatDate(campaign.updated_at)}
                </>
              )}
            </p>
          </div>
        </div>
        {isDraft && !isEditing && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Editar
            </button>
            <button
              onClick={() => {
                if (confirm('Enviar esta campanha agora?')) sendMutation.mutate()
              }}
              disabled={sendMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            >
              {sendMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <Send className="w-4 h-4" />
              Enviar agora
            </button>
            <button
              onClick={() => {
                if (confirm('Excluir esta campanha?')) deleteMutation.mutate()
              }}
              disabled={deleteMutation.isPending}
              className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
              title="Excluir"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        )}
        {isDraft && isEditing && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            >
              {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar
            </button>
          </div>
        )}
      </div>

      {campaign.status === 'sent' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Entregues</p>
            <p className="text-xl font-semibold text-gray-900 dark:text-white">
              {campaign.delivered_count ?? 0}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Aberto</p>
            <p className="text-xl font-semibold text-gray-900 dark:text-white">
              {campaign.open_rate != null ? `${campaign.open_rate}%` : '-'}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Clicado</p>
            <p className="text-xl font-semibold text-gray-900 dark:text-white">
              {campaign.click_rate != null ? `${campaign.click_rate}%` : '-'}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Destinatários</p>
            <p className="text-xl font-semibold text-gray-900 dark:text-white">
              {campaign.recipients_count ?? 0}
            </p>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        {isEditing ? (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nome
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Remetente
              </label>
              <select
                value={emailAccountId}
                onChange={(e) => setEmailAccountId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
              >
                {accounts.map((acc: { id: string; email: string; account_name?: string }) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.account_name || acc.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Modelo
              </label>
              <select
                value={emailTemplateId}
                onChange={(e) => setEmailTemplateId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
              >
                <option value="">Nenhum</option>
                {templates.map((t: { id: string; name: string }) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Assunto
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Corpo (HTML)
              </label>
              <textarea
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                rows={10}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Destinatários (selecione para atualizar a lista)
              </label>
              <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
                {clientsWithEmail.map((client: { id: string; name: string; email: string }) => (
                  <label key={client.id} className="flex items-center gap-2 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedClientIds.includes(client.id)}
                      onChange={() =>
                        setSelectedClientIds((prev) =>
                          prev.includes(client.id)
                            ? prev.filter((x) => x !== client.id)
                            : [...prev, client.id]
                        )
                      }
                    />
                    <span className="text-sm">{client.name}</span>
                    <span className="text-xs text-gray-500">({client.email})</span>
                  </label>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Assunto</p>
              <p className="font-medium text-gray-900 dark:text-white">{campaign.subject}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Destinatários</p>
              <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1 max-h-40 overflow-y-auto">
                {recipients.slice(0, 50).map((r: { email: string; name?: string }) => (
                  <li key={r.email}>
                    {r.name || r.email} &lt;{r.email}&gt;
                  </li>
                ))}
                {recipients.length > 50 && (
                  <li className="text-gray-500">... e mais {recipients.length - 50}</li>
                )}
              </ul>
            </div>
            {campaign.body_html && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Preview do corpo</p>
                <div
                  className="prose dark:prose-invert max-w-none rounded-lg border border-gray-200 dark:border-gray-600 p-4 bg-gray-50 dark:bg-gray-900 max-h-60 overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: campaign.body_html }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
