import type { EmailTemplateBlock, EmailTemplateBodyJson } from '@/lib/api'

export type { EmailTemplateBlock, EmailTemplateBodyJson }

export const BLOCK_LABELS: Record<string, string> = {
  title: 'Título',
  paragraph: 'Parágrafo',
  image: 'Imagem',
  button: 'Botão',
  divider: 'Divisor',
  html: 'HTML',
}

export const DEFAULT_BLOCKS: Record<string, () => EmailTemplateBlock> = {
  title: () => ({ type: 'title', level: 2, text: 'Novo título' }),
  paragraph: () => ({ type: 'paragraph', text: 'Digite seu texto aqui.' }),
  image: () => ({ type: 'image', src: '', alt: '' }),
  button: () => ({ type: 'button', text: 'Clique aqui', href: 'https://' }),
  divider: () => ({ type: 'divider' }),
  html: () => ({ type: 'html', content: '<p>HTML personalizado</p>' }),
}
