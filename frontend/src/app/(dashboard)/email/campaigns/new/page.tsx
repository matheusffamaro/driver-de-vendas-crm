'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Save, Send } from 'lucide-react'
import { emailMarketingApi, emailApi, clientsApi } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

export default function NewCampaignPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [emailAccountId, setEmailAccountId] = useState('')
  const [emailTemplateId, setEmailTemplateId] = useState('')
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([])

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

  const { data: clientsData } = useQuery({
    queryKey: ['clients', 'for-campaign'],
    queryFn: async () => {
      const res = await clientsApi.list({ per_page: 500 })
      const list = res.data?.data ?? []
      return list.filter((c: { email?: string }) => c.email && c.email.trim() !== '')
    },
  })
  const clientsWithEmail = Array.isArray(clientsData) ? clientsData : []

  useEffect(() => {
    if (accounts.length > 0 && !emailAccountId) {
      setEmailAccountId(accounts[0].id)
    }
  }, [accounts, emailAccountId])

  useEffect(() => {
    if (emailTemplateId && templates.length) {
      const t = templates.find((x: { id: string }) => x.id === emailTemplateId)
      if (t) {
        setSubject(t.subject)
        setBodyHtml(t.body_html ?? '')
      }
    }
  }, [emailTemplateId, templates])

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string
      subject: string
      body_html?: string
      email_template_id?: string
      email_account_id: string
      client_ids: string[]
    }) => emailMarketingApi.campaigns.create(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['email-marketing', 'campaigns'] })
    },
  })

  const sendMutation = useMutation({
    mutationFn: (id: string) => emailMarketingApi.campaigns.send(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-marketing', 'campaigns'] })
    },
  })

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !subject.trim() || !emailAccountId || selectedClientIds.length === 0) {
      toast.error('Preencha todos os campos', 'Nome, assunto, remetente e pelo menos um destinatário.')
      return
    }
    try {
      const res = await createMutation.mutateAsync({
        name: name.trim(),
        subject: subject.trim(),
        body_html: bodyHtml || undefined,
        email_template_id: emailTemplateId || undefined,
        email_account_id: emailAccountId,
        client_ids: selectedClientIds,
      })
      const campaign = res.data ?? res
      toast.success('Rascunho salvo', 'A campanha foi criada.')
      router.push(`/email/campaigns/${campaign.id}`)
    } catch (err: any) {
      toast.error('Erro', err?.response?.data?.message || 'Não foi possível criar a campanha.')
    }
  }

  const handleSendNow = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !subject.trim() || !emailAccountId || selectedClientIds.length === 0) {
      toast.error('Preencha todos os campos', 'Nome, assunto, remetente e pelo menos um destinatário.')
      return
    }
    try {
      const createRes = await createMutation.mutateAsync({
        name: name.trim(),
        subject: subject.trim(),
        body_html: bodyHtml || undefined,
        email_template_id: emailTemplateId || undefined,
        email_account_id: emailAccountId,
        client_ids: selectedClientIds,
      })
      const campaign = createRes.data ?? createRes
      await sendMutation.mutateAsync(campaign.id)
      toast.success('Campanha enviada', 'O envio foi iniciado.')
      router.push(`/email/campaigns/${campaign.id}`)
    } catch (err: any) {
      toast.error('Erro', err?.response?.data?.message || 'Não foi possível criar ou enviar a campanha.')
    }
  }

  const toggleClient = (id: string) => {
    setSelectedClientIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const selectAllClients = () => {
    const ids = clientsWithEmail.map((c: { id: string }) => c.id)
    setSelectedClientIds(ids)
  }

  const isPending = createMutation.isPending || sendMutation.isPending

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/email/campaigns"
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-display">
            Nova campanha de e-mail
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Preencha os dados e escolha os destinatários
          </p>
        </div>
      </div>

      <form onSubmit={handleSaveDraft} className="space-y-6 max-w-3xl">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">Informações</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nome da campanha
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
              placeholder="Ex: Lançamento produto X"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Remetente (conta de e-mail)
            </label>
            <select
              value={emailAccountId}
              onChange={(e) => setEmailAccountId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
              required
            >
              <option value="">Selecione</option>
              {accounts.map((acc: { id: string; email: string; account_name?: string }) => (
                <option key={acc.id} value={acc.id}>
                  {acc.account_name || acc.email} ({acc.email})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">Conteúdo</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Usar modelo (opcional)
            </label>
            <select
              value={emailTemplateId}
              onChange={(e) => setEmailTemplateId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
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
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
              required
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
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 font-mono text-sm"
              placeholder="<p>Olá, ...</p>"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white">Destinatários</h2>
            <button
              type="button"
              onClick={selectAllClients}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Selecionar todos com e-mail
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Contatos com e-mail: {clientsWithEmail.length}. Selecionados: {selectedClientIds.length}
          </p>
          <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-2 space-y-1">
            {clientsWithEmail.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">Nenhum contato com e-mail.</p>
            ) : (
              clientsWithEmail.map((client: { id: string; name: string; email: string }) => (
                <label
                  key={client.id}
                  className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedClientIds.includes(client.id)}
                    onChange={() => toggleClient(client.id)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-900 dark:text-white truncate">
                    {client.name}
                  </span>
                  <span className="text-xs text-gray-500 truncate">({client.email})</span>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            <Save className="w-4 h-4" />
            Salvar rascunho
          </button>
          <button
            type="button"
            onClick={handleSendNow}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            {(createMutation.isPending || sendMutation.isPending) && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            <Send className="w-4 h-4" />
            Enviar agora
          </button>
        </div>
      </form>
    </div>
  )
}
