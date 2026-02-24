import type { EmailTemplateBodyJson, EmailTemplateBlock } from '@/lib/api'

const DEFAULT_CONFIG = {
  width: 600,
  bgColor: '#ffffff',
  fontFamily: 'Arial, sans-serif',
}

function escapeHtml(s: string): string {
  const div = document.createElement('div')
  div.textContent = s
  return div.innerHTML
}

function blockToHtml(block: EmailTemplateBlock, config: typeof DEFAULT_CONFIG): string {
  const font = config.fontFamily
  switch (block.type) {
    case 'title': {
      const level = block.level ?? 2
      const tag = `h${level}`
      return `<${tag} style="margin:0 0 12px;font-family:${font};font-size:${level === 1 ? '28' : level === 2 ? '22' : '18'}px;line-height:1.3;color:#111;">${escapeHtml(block.text)}</${tag}>`
    }
    case 'paragraph':
      return `<p style="margin:0 0 16px;font-family:${font};font-size:16px;line-height:1.6;color:#333;">${escapeHtml(block.text)}</p>`
    case 'image':
      return `<div style="margin:16px 0;"><img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt ?? '')}" style="max-width:100%;height:auto;${block.width ? `width:${block.width};` : ''}" /></div>`
    case 'button':
      return `<div style="margin:20px 0;"><a href="${escapeHtml(block.href)}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff!important;text-decoration:none;border-radius:6px;font-family:${font};font-size:16px;font-weight:600;">${escapeHtml(block.text)}</a></div>`
    case 'divider':
      return '<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />'
    case 'html':
      return block.content
    default:
      return ''
  }
}

export function compileBodyToHtml(body: EmailTemplateBodyJson | null | undefined): string {
  if (!body?.blocks?.length) {
    return '<p style="font-family:Arial,sans-serif;color:#666;">Adicione blocos de conteúdo ao modelo.</p>'
  }
  const config = { ...DEFAULT_CONFIG, ...body.config }
  const inner = body.blocks.map((b) => blockToHtml(b, config)).join('')
  return `
<table role="presentation" cellPadding="0" cellSpacing="0" style="width:100%;max-width:${config.width}px;margin:0 auto;background:${config.bgColor};font-family:${config.fontFamily};">
  <tr><td style="padding:24px;">${inner}</td></tr>
</table>`.trim()
}

/** Remove script tags from HTML for safe preview in sandboxed iframe (avoids "Blocked script execution" warning) */
export function stripScriptsFromHtml(html: string): string {
  if (typeof document === 'undefined') {
    return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  }
  const div = document.createElement('div')
  div.innerHTML = html
  div.querySelectorAll('script').forEach((el) => el.remove())
  return div.innerHTML
}

export function getDefaultBody(): EmailTemplateBodyJson {
  return {
    config: { width: 600, bgColor: '#ffffff', fontFamily: 'Arial, sans-serif' },
    blocks: [],
  }
}

export const PRESET_LAYOUTS: { id: string; name: string; body: EmailTemplateBodyJson }[] = [
  {
    id: 'blank',
    name: 'Começar do zero',
    body: getDefaultBody(),
  },
  {
    id: 'letter',
    name: 'Carta (simples)',
    body: {
      config: { width: 600, bgColor: '#ffffff', fontFamily: 'Georgia, serif' },
      blocks: [
        { type: 'paragraph', text: 'Prezado(a),' },
        { type: 'paragraph', text: 'Escreva aqui o conteúdo da sua mensagem. Você pode editar este texto no editor.' },
        { type: 'paragraph', text: 'Atenciosamente,' },
        { type: 'paragraph', text: 'Sua equipe' },
      ],
    },
  },
  {
    id: 'welcome',
    name: 'Boas-vindas',
    body: {
      config: { width: 600, bgColor: '#ffffff', fontFamily: 'Arial, sans-serif' },
      blocks: [
        { type: 'title', level: 1, text: 'Bem-vindo(a)!' },
        { type: 'paragraph', text: 'Olá, estamos muito felizes em tê-lo(a) conosco.' },
        { type: 'paragraph', text: 'A partir de agora você receberá nossas novidades e ofertas.' },
        { type: 'button', text: 'Começar', href: 'https://' },
      ],
    },
  },
  {
    id: 'newsletter',
    name: 'Newsletter',
    body: {
      config: { width: 600, bgColor: '#f9fafb', fontFamily: 'Arial, sans-serif' },
      blocks: [
        { type: 'title', level: 2, text: 'Novidades desta semana' },
        { type: 'paragraph', text: 'Confira os destaques que preparamos para você.' },
        { type: 'divider' },
        { type: 'title', level: 3, text: 'Destaque 1' },
        { type: 'paragraph', text: 'Texto do primeiro destaque.' },
        { type: 'divider' },
        { type: 'title', level: 3, text: 'Destaque 2' },
        { type: 'paragraph', text: 'Texto do segundo destaque.' },
        { type: 'button', text: 'Saiba mais', href: 'https://' },
      ],
    },
  },
]

export type { EmailTemplateBlock, EmailTemplateBodyJson }
