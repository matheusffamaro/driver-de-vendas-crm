'use client'

import type { EmailTemplateBodyJson } from '@/lib/api'

export function ConfigPanel({
  config,
  onChange,
}: {
  config: EmailTemplateBodyJson['config']
  onChange: (config: NonNullable<EmailTemplateBodyJson['config']>) => void
}) {
  const c = config ?? { width: 600, bgColor: '#ffffff', fontFamily: 'Arial, sans-serif' }

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
        Configuração do e-mail
      </p>
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          Largura (px)
        </label>
        <input
          type="number"
          min={400}
          max={800}
          value={c.width ?? 600}
          onChange={(e) => onChange({ ...c, width: Number(e.target.value) || 600 })}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          Cor de fundo
        </label>
        <div className="flex gap-2">
          <input
            type="color"
            value={c.bgColor?.startsWith('#') ? c.bgColor : '#ffffff'}
            onChange={(e) => onChange({ ...c, bgColor: e.target.value })}
            className="h-10 w-14 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
          />
          <input
            type="text"
            value={c.bgColor ?? '#ffffff'}
            onChange={(e) => onChange({ ...c, bgColor: e.target.value })}
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 font-mono text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          Fonte
        </label>
        <select
          value={c.fontFamily ?? 'Arial, sans-serif'}
          onChange={(e) => onChange({ ...c, fontFamily: e.target.value })}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
        >
          <option value="Arial, sans-serif">Arial</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="'Times New Roman', serif">Times New Roman</option>
          <option value="Verdana, sans-serif">Verdana</option>
          <option value="'Helvetica Neue', Helvetica, sans-serif">Helvetica</option>
        </select>
      </div>
    </div>
  )
}
