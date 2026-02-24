'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Palette, 
  Building2, 
  Upload,
  Check,
  Sun,
  Moon,
} from 'lucide-react'
import { useThemeStore, colorPalettes, ColorKey } from '@/stores/theme-store'
import { toast } from '@/hooks/use-toast'

export default function AppearanceSettingsPage() {
  const { 
    primaryColor, 
    colorKey, 
    companyName, 
    logoUrl,
    setPrimaryColor, 
    setCompanyName,
    setLogoUrl,
  } = useThemeStore()

  const [localCompanyName, setLocalCompanyName] = useState(companyName)
  const [isDark, setIsDark] = useState(false)

  const handleColorSelect = (key: ColorKey) => {
    setPrimaryColor(colorPalettes[key].primary, key)
    toast.success('Cor atualizada!', `Tema ${colorPalettes[key].name} aplicado`)
  }

  const handleSaveCompanyName = () => {
    setCompanyName(localCompanyName)
    toast.success('Nome atualizado!', 'O nome da empresa foi salvo')
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoUrl(reader.result as string)
        toast.success('Logo atualizado!', 'A logo foi salva')
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveLogo = () => {
    setLogoUrl(null)
    toast.success('Logo removido!', 'A logo padrão será usada')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <div 
            className="p-2 rounded-xl"
            style={{ backgroundColor: `${primaryColor}20` }}
          >
            <Palette className="w-6 h-6" style={{ color: primaryColor }} />
          </div>
          Aparência
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Personalize as cores e a identidade visual do seu CRM
        </p>
      </div>

      {/* Brand Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Identidade da Marca
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Company Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nome da Empresa
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={localCompanyName}
                onChange={(e) => setLocalCompanyName(e.target.value)}
                className="input flex-1"
                placeholder="Sua Empresa"
              />
              <button
                onClick={handleSaveCompanyName}
                className="btn-primary px-4"
                disabled={localCompanyName === companyName}
              >
                Salvar
              </button>
            </div>
          </div>

          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Logo da Empresa
            </label>
            <div className="flex items-center gap-4">
              <div 
                className="w-16 h-16 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700 overflow-hidden"
                style={{ backgroundColor: logoUrl ? 'transparent' : `${primaryColor}10` }}
              >
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <Building2 className="w-8 h-8" style={{ color: primaryColor }} />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label className="btn-secondary cursor-pointer">
                  <Upload className="w-4 h-4" />
                  Upload
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
                {logoUrl && (
                  <button
                    onClick={handleRemoveLogo}
                    className="text-sm text-red-500 hover:text-red-600"
                  >
                    Remover logo
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Recomendado: PNG ou SVG, máximo 200x60px
            </p>
          </div>
        </div>
      </motion.div>

      {/* Color Palette */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-6"
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Palette className="w-5 h-5" />
          Cor Principal
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Escolha a cor que melhor representa sua marca. Esta cor será usada em botões, links e elementos destacados.
        </p>

        <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
          {(Object.keys(colorPalettes) as ColorKey[]).map((key) => {
            const palette = colorPalettes[key]
            const isSelected = colorKey === key
            
            return (
              <button
                key={key}
                onClick={() => handleColorSelect(key)}
                className={`relative group`}
                title={palette.name}
              >
                <div
                  className={`w-12 h-12 rounded-xl transition-all duration-200 flex items-center justify-center
                             ${isSelected ? 'ring-2 ring-offset-2 scale-110' : 'hover:scale-105'}`}
                  style={{ 
                    backgroundColor: palette.primary,
                    '--tw-ring-color': palette.primary,
                  } as React.CSSProperties}
                >
                  {isSelected && (
                    <Check className="w-5 h-5 text-white" />
                  )}
                </div>
                <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-gray-500 dark:text-gray-400 
                               opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {palette.name}
                </span>
              </button>
            )
          })}
        </div>

        {/* Custom Color Input */}
        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Ou use uma cor personalizada
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-12 h-12 rounded-lg cursor-pointer border-0 p-0"
            />
            <input
              type="text"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="input w-32 font-mono"
              placeholder="#10B981"
            />
          </div>
        </div>
      </motion.div>

      {/* Preview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-6"
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Pré-visualização
        </h2>

        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 space-y-4">
          {/* Sample Buttons */}
          <div className="flex flex-wrap gap-3">
            <button className="btn-primary">
              Botão Primário
            </button>
            <button className="btn-outline">
              Botão Outline
            </button>
            <button className="btn-secondary">
              Botão Secundário
            </button>
          </div>

          {/* Sample Badge */}
          <div className="flex items-center gap-2">
            <span className="badge-primary">Badge Primário</span>
            <span className="badge-success">Sucesso</span>
            <span className="badge-warning">Alerta</span>
          </div>

          {/* Sample Card */}
          <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
              >
                <Check className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">Card de Exemplo</h4>
                <p className="text-sm text-gray-500">Visualize como ficará o design</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div 
                className="h-2 flex-1 rounded-full" 
                style={{ backgroundColor: `${primaryColor}30` }}
              >
                <div 
                  className="h-full w-3/4 rounded-full"
                  style={{ backgroundColor: primaryColor }}
                />
              </div>
              <span className="text-sm font-medium" style={{ color: primaryColor }}>75%</span>
            </div>
          </div>

          {/* Sample Navigation Item */}
          <div className="flex items-center gap-2">
            <div 
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg"
              style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
            >
              <div 
                className="w-1 h-5 rounded-full"
                style={{ backgroundColor: primaryColor }}
              />
              <Building2 className="w-5 h-5" />
              <span className="font-medium">Menu Ativo</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-600 dark:text-gray-400">
              <Building2 className="w-5 h-5" />
              <span>Menu Inativo</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
