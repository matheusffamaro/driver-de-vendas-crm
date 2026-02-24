'use client'

import { useState, useMemo, useEffect } from 'react'
import { compileBodyToHtml, getDefaultBody, stripScriptsFromHtml } from '@/lib/email-template-builder'
import type { EmailTemplateBodyJson, EmailTemplateBlock } from '@/lib/api'
import { BlockPalette } from './BlockPalette'
import { BlockEditor } from './BlockEditor'
import { ConfigPanel } from './ConfigPanel'
import { PanelRightOpen, PanelRightClose } from 'lucide-react'

type TabId = 'content' | 'rows' | 'config'

export function EmailTemplateEditor({
  body,
  onChange,
}: {
  body: EmailTemplateBodyJson
  onChange: (body: EmailTemplateBodyJson) => void
}) {
  const [activeTab, setActiveTab] = useState<TabId>('content')
  const [showSidebar, setShowSidebar] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const handler = () => setShowSidebar(mq.matches)
    handler()
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  const blocks = body.blocks ?? []
  const config = body.config

  const html = useMemo(() => compileBodyToHtml(body), [body])

  const addBlock = (block: EmailTemplateBlock) => {
    onChange({
      ...body,
      blocks: [...(body.blocks ?? []), block],
    })
  }

  const updateBlock = (index: number, block: EmailTemplateBlock) => {
    const next = [...(body.blocks ?? [])]
    next[index] = block
    onChange({ ...body, blocks: next })
  }

  const removeBlock = (index: number) => {
    const next = (body.blocks ?? []).filter((_, i) => i !== index)
    onChange({ ...body, blocks: next })
  }

  const moveBlock = (index: number, dir: -1 | 1) => {
    const next = [...(body.blocks ?? [])]
    const j = index + dir
    if (j < 0 || j >= next.length) return
    ;[next[index], next[j]] = [next[j], next[index]]
    onChange({ ...body, blocks: next })
  }

  const setConfig = (newConfig: NonNullable<EmailTemplateBodyJson['config']>) => {
    onChange({ ...body, config: newConfig })
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'content', label: 'Conteúdo' },
    { id: 'rows', label: 'Linhas' },
    { id: 'config', label: 'Configuração' },
  ]

  return (
    <div className="flex flex-col lg:flex-row h-full gap-4">
      {/* Preview - left */}
      <div className="flex-1 min-w-0 flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 overflow-hidden">
        <div className="flex-shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400">
          <span>Pré-visualização</span>
          <button
            type="button"
            onClick={() => setShowSidebar((s) => !s)}
            className="lg:hidden p-2 -m-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label={showSidebar ? 'Ocultar painel' : 'Mostrar painel'}
          >
            {showSidebar ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </button>
        </div>
        <div className="flex-1 min-h-0 flex flex-col overflow-auto p-4 bg-gray-200 dark:bg-gray-800">
          <div
            className="mx-auto flex-1 min-h-full w-full bg-white dark:bg-gray-900 shadow-lg rounded overflow-hidden flex flex-col"
            style={{ maxWidth: config?.width ?? 600 }}
          >
            <iframe
              title="Preview"
              srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;">${stripScriptsFromHtml(html)}</body></html>`}
              className="flex-1 w-full min-h-0 border-0"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      </div>

      {/* Sidebar - right: collapsible on mobile, always visible on lg */}
      <div
        className={`${showSidebar ? 'flex' : 'hidden'} lg:flex w-full lg:w-80 flex-shrink-0 flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden`}
      >
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-gray-50 dark:bg-gray-700/50'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'content' && (
            <>
              <BlockPalette onAdd={addBlock} />
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-6 mb-2">
                Blocos no modelo ({blocks.length})
              </p>
              <div className="space-y-2">
                {blocks.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 py-2">
                    Clique em um bloco acima para adicionar.
                  </p>
                ) : (
                  blocks.map((block, i) => (
                    <BlockEditor
                      key={i}
                      block={block}
                      index={i}
                      onUpdate={(b) => updateBlock(i, b)}
                      onRemove={() => removeBlock(i)}
                      onMoveUp={() => moveBlock(i, -1)}
                      onMoveDown={() => moveBlock(i, 1)}
                      canMoveUp={i > 0}
                      canMoveDown={i < blocks.length - 1}
                    />
                  ))
                )}
              </div>
            </>
          )}
          {activeTab === 'rows' && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Ordem dos blocos
              </p>
              {blocks.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-2">
                  Nenhum bloco. Use a aba Conteúdo para adicionar.
                </p>
              ) : (
                blocks.map((block, i) => (
                  <BlockEditor
                    key={i}
                    block={block}
                    index={i}
                    onUpdate={(b) => updateBlock(i, b)}
                    onRemove={() => removeBlock(i)}
                    onMoveUp={() => moveBlock(i, -1)}
                    onMoveDown={() => moveBlock(i, 1)}
                    canMoveUp={i > 0}
                    canMoveDown={i < blocks.length - 1}
                  />
                ))
              )}
            </div>
          )}
          {activeTab === 'config' && (
            <ConfigPanel config={config} onChange={setConfig} />
          )}
        </div>
      </div>
    </div>
  )
}

export { getDefaultBody }
