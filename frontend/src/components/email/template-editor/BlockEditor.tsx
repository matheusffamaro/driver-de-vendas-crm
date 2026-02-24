'use client'

import { useState } from 'react'
import type { EmailTemplateBlock } from '@/lib/api'
import { BLOCK_LABELS } from './types'
import { ChevronUp, ChevronDown, Trash2 } from 'lucide-react'

export function BlockEditor({
  block,
  index,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  block: EmailTemplateBlock
  index: number
  onUpdate: (b: EmailTemplateBlock) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  canMoveUp: boolean
  canMoveDown: boolean
}) {
  const [expanded, setExpanded] = useState(true)
  const label = BLOCK_LABELS[block.type] ?? block.type

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 overflow-hidden">
      <div className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex-1 text-left min-w-0"
        >
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {index + 1}. {label}
          </span>
        </button>
        <div className="flex items-center gap-1 flex-shrink-0">
          {canMoveUp && (
            <button type="button" onClick={onMoveUp} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="Mover para cima">
              <ChevronUp className="w-4 h-4" />
            </button>
          )}
          {canMoveDown && (
            <button type="button" onClick={onMoveDown} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="Mover para baixo">
              <ChevronDown className="w-4 h-4" />
            </button>
          )}
          <button type="button" onClick={onRemove} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600" title="Remover">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="p-3 pt-0 space-y-2 border-t border-gray-100 dark:border-gray-700">
          {block.type === 'title' && (
            <>
              <label className="block text-xs font-medium text-gray-500">Nível</label>
              <select
                value={block.level ?? 2}
                onChange={(e) => onUpdate({ ...block, level: Number(e.target.value) as 1 | 2 | 3 })}
                className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-sm"
              >
                <option value={1}>Título 1</option>
                <option value={2}>Título 2</option>
                <option value={3}>Título 3</option>
              </select>
              <label className="block text-xs font-medium text-gray-500">Texto</label>
              <input
                type="text"
                value={block.text}
                onChange={(e) => onUpdate({ ...block, text: e.target.value })}
                className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-sm"
              />
            </>
          )}
          {block.type === 'paragraph' && (
            <>
              <label className="block text-xs font-medium text-gray-500">Texto</label>
              <textarea
                value={block.text}
                onChange={(e) => onUpdate({ ...block, text: e.target.value })}
                rows={3}
                className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-sm"
              />
            </>
          )}
          {block.type === 'image' && (
            <>
              <label className="block text-xs font-medium text-gray-500">URL da imagem</label>
              <input
                type="url"
                value={block.src}
                onChange={(e) => onUpdate({ ...block, src: e.target.value })}
                placeholder="https://"
                className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-sm"
              />
              <label className="block text-xs font-medium text-gray-500">Texto alternativo</label>
              <input
                type="text"
                value={block.alt ?? ''}
                onChange={(e) => onUpdate({ ...block, alt: e.target.value })}
                className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-sm"
              />
            </>
          )}
          {block.type === 'button' && (
            <>
              <label className="block text-xs font-medium text-gray-500">Texto do botão</label>
              <input
                type="text"
                value={block.text}
                onChange={(e) => onUpdate({ ...block, text: e.target.value })}
                className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-sm"
              />
              <label className="block text-xs font-medium text-gray-500">Link (URL)</label>
              <input
                type="url"
                value={block.href}
                onChange={(e) => onUpdate({ ...block, href: e.target.value })}
                placeholder="https://"
                className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-sm"
              />
            </>
          )}
          {block.type === 'html' && (
            <>
              <label className="block text-xs font-medium text-gray-500">HTML</label>
              <textarea
                value={block.content}
                onChange={(e) => onUpdate({ ...block, content: e.target.value })}
                rows={6}
                className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-sm font-mono"
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}
