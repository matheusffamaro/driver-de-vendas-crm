'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
  FileText,
  Plus,
  Loader2,
  Edit,
  Trash2,
  Calendar,
} from 'lucide-react'
import { emailMarketingApi } from '@/lib/api'
import { stripScriptsFromHtml } from '@/lib/email-template-builder'
import { toast } from '@/hooks/use-toast'

interface EmailTemplate {
  id: string
  name: string
  subject: string
  body_html: string | null
  body_json?: { blocks?: unknown[] } | null
  created_at: string
  updated_at: string
}

export default function EmailTemplatesPage() {
  const queryClient = useQueryClient()

  const { data: templates = [], isLoading, isError, error } = useQuery({
    queryKey: ['email-marketing', 'templates'],
    queryFn: async () => {
      const res = await emailMarketingApi.templates.list()
      return res.data ?? []
    },
    retry: 1,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => emailMarketingApi.templates.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-marketing', 'templates'] })
      toast.success('Modelo excluído', 'O modelo foi removido.')
    },
    onError: (err: any) => {
      toast.error('Erro', err?.response?.data?.message || 'Não foi possível excluir.')
    },
  })

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-display">
            Modelos de e-mail
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Modelos reutilizáveis para suas campanhas. Crie com o editor visual.
          </p>
        </div>
        <Link
          href="/email/templates/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          Modelo
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : isError ? (
        <div className="text-center py-16 text-amber-600 dark:text-amber-400 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium">Erro ao carregar modelos</p>
          <p className="text-sm mt-1">
            {(error as any)?.response?.data?.message || 'Execute as migrations no backend: php artisan migrate'}
          </p>
        </div>
      ) : (templates as EmailTemplate[]).length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium">Nenhum modelo ainda</p>
          <p className="text-sm mt-1">Crie um modelo para usar nas campanhas</p>
          <Link
            href="/email/templates/new"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
          >
            <Plus className="w-4 h-4" />
            Modelo
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {(templates as EmailTemplate[]).map((template) => (
            <div
              key={template.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:border-gray-300 dark:hover:border-gray-600 transition-colors flex flex-col"
            >
              <Link href={`/email/templates/${template.id}/edit`} className="flex-1 flex flex-col">
                <div className="aspect-[4/3] bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 overflow-hidden">
                  <iframe
                    title={`Preview ${template.name}`}
                    srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:8px;transform:scale(0.4);transform-origin:0 0;width:250%;min-height:250%;">${stripScriptsFromHtml(template.body_html || '<p style="color:#999;">Sem conteúdo</p>')}</body></html>`}
                    className="w-full h-full pointer-events-none border-0"
                    sandbox="allow-same-origin"
                  />
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {template.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
                    {template.subject}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(template.updated_at)}
                  </p>
                </div>
              </Link>
              <div className="flex items-center gap-2 p-3 border-t border-gray-100 dark:border-gray-700">
                <Link
                  href={`/email/templates/${template.id}/edit`}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium"
                >
                  <Edit className="w-4 h-4" />
                  Editar
                </Link>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    if (confirm('Excluir este modelo?')) deleteMutation.mutate(template.id)
                  }}
                  className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                  title="Excluir"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
