'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Eye, Save } from 'lucide-react'
import { emailMarketingApi } from '@/lib/api'
import { compileBodyToHtml, getDefaultBody } from '@/lib/email-template-builder'
import type { EmailTemplateBodyJson } from '@/lib/api'
import { EmailTemplateEditor } from '@/components/email/template-editor/EmailTemplateEditor'
import { toast } from '@/hooks/use-toast'

export default function EditTemplatePage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState<EmailTemplateBodyJson>(getDefaultBody())
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const { data: template, isLoading } = useQuery({
    queryKey: ['email-marketing', 'template', id],
    queryFn: async () => {
      const res = await emailMarketingApi.templates.get(id)
      return res.data
    },
    enabled: !!id,
  })

  useEffect(() => {
    if (template) {
      setName(template.name ?? '')
      setSubject(template.subject ?? '')
      if (template.body_json?.blocks) {
        setBody({
          config: template.body_json.config ?? getDefaultBody().config,
          blocks: template.body_json.blocks,
        })
      } else if (template.body_html) {
        setBody({
          ...getDefaultBody(),
          blocks: [{ type: 'html', content: template.body_html }],
        })
      }
    }
  }, [template])

  const handleSave = async () => {
    if (!id || !name.trim()) {
      toast.error('Nome obrigatório', 'Informe o nome do modelo.')
      return
    }
    if (!subject.trim()) {
      toast.error('Assunto obrigatório', 'Informe o assunto do e-mail.')
      return
    }
    setSaving(true)
    try {
      const bodyHtml = compileBodyToHtml(body)
      await emailMarketingApi.templates.update(id, {
        name: name.trim(),
        subject: subject.trim(),
        body_html: bodyHtml,
        body_json: body,
      })
      toast.success('Modelo atualizado', 'As alterações foram salvas.')
    } catch (err: any) {
      toast.error('Erro', err?.response?.data?.message || 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  const html = compileBodyToHtml(body)

  if (isLoading || !template) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col">
      <div className="flex-shrink-0 flex items-center justify-between gap-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/email/templates"
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-lg font-semibold bg-transparent border-none focus:ring-0 p-0 text-gray-900 dark:text-white w-full max-w-xs"
              placeholder="Nome do modelo"
            />
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="text-sm text-gray-500 dark:text-gray-400 bg-transparent border-none focus:ring-0 p-0 w-full max-w-md truncate"
              placeholder="Assunto do e-mail"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Eye className="w-4 h-4" />
            Pré-visualizar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            <Save className="w-4 h-4" />
            Salvar e fechar
          </button>
        </div>
      </div>

      {showPreview ? (
        <div className="flex-1 overflow-auto p-6 bg-gray-100 dark:bg-gray-900">
          <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Assunto: {subject || '(vazio)'}</p>
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 p-4">
          <EmailTemplateEditor body={body} onChange={setBody} />
        </div>
      )}
    </div>
  )
}
