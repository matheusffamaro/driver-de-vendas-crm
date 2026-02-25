import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { Providers } from '@/components/providers'

const outfit = localFont({
  src: '../../public/fonts/outfit-latin.woff2',
  variable: '--font-outfit',
  display: 'swap',
  weight: '100 900',
})

const jetbrains = localFont({
  src: '../../public/fonts/jetbrains-mono-latin.woff2',
  variable: '--font-jetbrains',
  display: 'swap',
  weight: '100 800',
})

export const metadata: Metadata = {
  title: 'Driver de Vendas CRM',
  description: 'CRM inteligente para gestão de vendas e relacionamento com clientes',
  icons: {
    icon: '/favicon.ico',
  },
}

// Script to prevent flash of wrong theme
const themeScript = `
  (function() {
    try {
      var theme = localStorage.getItem('theme');
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (theme === 'dark' || (!theme && prefersDark)) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {}
  })();
`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${outfit.variable} ${jetbrains.variable} font-sans antialiased`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
