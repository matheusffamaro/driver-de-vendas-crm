'use client'

import { Type, AlignLeft, Image, MousePointer, Minus, Code } from 'lucide-react'
import { BLOCK_LABELS, DEFAULT_BLOCKS } from './types'
import type { EmailTemplateBlock } from '@/lib/api'

const icons: Record<string, React.ReactNode> = {
  title: <Type className="w-4 h-4" />,
  paragraph: <AlignLeft className="w-4 h-4" />,
  image: <Image className="w-4 h-4" />,
  button: <MousePointer className="w-4 h-4" />,
  divider: <Minus className="w-4 h-4" />,
  html: <Code className="w-4 h-4" />,
}

export function BlockPalette({
  onAdd,
}: {
  onAdd: (block: EmailTemplateBlock) => void
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
        Blocos de conteúdo
      </p>
      {Object.entries(DEFAULT_BLOCKS).map(([key, factory]) => (
        <button
          key={key}
          type="button"
          onClick={() => onAdd(factory())}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500 transition-colors text-left"
        >
          {icons[key]}
          <span className="text-sm font-medium">{BLOCK_LABELS[key] ?? key}</span>
        </button>
      ))}
    </div>
  )
}
