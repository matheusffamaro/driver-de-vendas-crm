'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Eye, Save, FileText, Mail } from 'lucide-react'
import { emailMarketingApi } from '@/lib/api'
import { compileBodyToHtml, getDefaultBody, PRESET_LAYOUTS } from '@/lib/email-template-builder'
import type { EmailTemplateBodyJson } from '@/lib/api'
import { EmailTemplateEditor } from '@/components/email/template-editor/EmailTemplateEditor'
import { toast } from '@/hooks/use-toast'

export default function NewTemplatePage() {
  const router = useRouter()
  const [step, setStep] = useState<'choose' | 'edit'>('choose')
  const [name, setName] = useState('Novo modelo')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState<EmailTemplateBodyJson>(getDefaultBody())
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const chooseLayout = (layout: (typeof PRESET_LAYOUTS)[0]) => {
    setBody(JSON.parse(JSON.stringify(layout.body)))
    if (layout.id !== 'blank') setName(layout.name)
    setStep('edit')
  }

  const handleSave = async () => {
    if (!name.trim()) {
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
      const res = await emailMarketingApi.templates.create({
        name: name.trim(),
        subject: subject.trim(),
        body_html: bodyHtml,
        body_json: body,
      })
      const template = res.data ?? res
      toast.success('Modelo criado', 'O modelo foi salvo com sucesso.')
      router.push(`/email/templates/${template.id}/edit`)
    } catch (err: any) {
      toast.error('Erro', err?.response?.data?.message || 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  const html = compileBodyToHtml(body)

  if (step === 'choose') {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/email/templates"
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Começar do zero ou usar um layout
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Os layouts ajudam você a começar, mas você também pode modificá-los o quanto desejar.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {PRESET_LAYOUTS.map((layout) => (
            <button
              key={layout.id}
              type="button"
              onClick={() => chooseLayout(layout)}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors text-left"
            >
              <div className="w-14 h-14 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                {layout.id === 'blank' ? (
                  <FileText className="w-7 h-7 text-gray-500" />
                ) : (
                  <Mail className="w-7 h-7 text-gray-500" />
                )}
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-white text-center">
                {layout.name}
              </span>
            </button>
          ))}
        </div>
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
