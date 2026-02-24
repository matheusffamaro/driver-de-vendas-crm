'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Predefined color palettes
export const colorPalettes = {
  green: { primary: '#10B981', name: 'Verde', light: '#D1FAE5', dark: '#065F46' },
  blue: { primary: '#3B82F6', name: 'Azul', light: '#DBEAFE', dark: '#1E40AF' },
  purple: { primary: '#8B5CF6', name: 'Roxo', light: '#EDE9FE', dark: '#5B21B6' },
  pink: { primary: '#EC4899', name: 'Rosa', light: '#FCE7F3', dark: '#9D174D' },
  orange: { primary: '#F97316', name: 'Laranja', light: '#FED7AA', dark: '#9A3412' },
  teal: { primary: '#14B8A6', name: 'Teal', light: '#CCFBF1', dark: '#0F766E' },
  indigo: { primary: '#6366F1', name: 'Índigo', light: '#E0E7FF', dark: '#3730A3' },
  red: { primary: '#EF4444', name: 'Vermelho', light: '#FEE2E2', dark: '#991B1B' },
  amber: { primary: '#F59E0B', name: 'Âmbar', light: '#FEF3C7', dark: '#92400E' },
  cyan: { primary: '#06B6D4', name: 'Ciano', light: '#CFFAFE', dark: '#0E7490' },
}

export type ColorKey = keyof typeof colorPalettes

interface ThemeState {
  primaryColor: string
  colorKey: ColorKey
  companyName: string
  logoUrl: string | null
  setPrimaryColor: (color: string, key?: ColorKey) => void
  setCompanyName: (name: string) => void
  setLogoUrl: (url: string | null) => void
}

// Convert hex to RGB
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (result) {
    return `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`
  }
  return '16 185 129' // default green
}

// Apply color to CSS variables
function applyPrimaryColor(color: string) {
  if (typeof document !== 'undefined') {
    const root = document.documentElement
    const rgb = hexToRgb(color)
    
    // Get light and dark variants
    const palette = Object.values(colorPalettes).find(p => p.primary === color)
    const lightRgb = palette ? hexToRgb(palette.light) : rgb
    const darkRgb = palette ? hexToRgb(palette.dark) : rgb
    
    root.style.setProperty('--primary', rgb)
    root.style.setProperty('--primary-light', lightRgb)
    root.style.setProperty('--primary-dark', darkRgb)
    root.style.setProperty('--ring', rgb)
    root.style.setProperty('--accent', lightRgb)
    root.style.setProperty('--accent-foreground', darkRgb)
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      primaryColor: '#10B981',
      colorKey: 'green',
      companyName: 'Driver',
      logoUrl: null,
      setPrimaryColor: (color, key) => {
        applyPrimaryColor(color)
        set({ primaryColor: color, colorKey: key || 'green' })
      },
      setCompanyName: (name) => set({ companyName: name }),
      setLogoUrl: (url) => set({ logoUrl: url }),
    }),
    {
      name: 'crm-theme',
      onRehydrateStorage: () => (state) => {
        // Apply saved color on page load
        if (state?.primaryColor) {
          applyPrimaryColor(state.primaryColor)
        }
      },
    }
  )
)
