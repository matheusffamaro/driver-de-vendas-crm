'use client'

import { useState } from 'react'
import { Calendar as CalendarIcon, Check } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface CustomFieldInputProps {
  field: {
    id: string
    name: string
    field_key: string
    type: 'text' | 'textarea' | 'number' | 'money' | 'date' | 'select' | 'multiselect' | 'checkbox' | 'phone' | 'email' | 'url'
    options?: string[]
    is_required: boolean
  }
  value: any
  onChange: (value: any) => void
  error?: string
}

export function CustomFieldInput({ field, value, onChange, error }: CustomFieldInputProps) {
  const [showCalendar, setShowCalendar] = useState(false)

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
    } else if (cleaned.length === 10) {
      return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
    }
    return phone
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value)
    onChange(formatted)
  }

  const formatMoney = (value: string) => {
    const cleaned = value.replace(/\D/g, '')
    const number = parseFloat(cleaned) / 100
    return number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const handleMoneyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatMoney(e.target.value)
    onChange(formatted)
  }

  const baseInputClass = `w-full px-3 py-2 rounded-lg border transition-colors
    ${error 
      ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/20' 
      : 'border-gray-300 dark:border-gray-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
    }
    bg-white dark:bg-gray-800 text-gray-900 dark:text-white
    placeholder-gray-400 dark:placeholder-gray-500
    disabled:bg-gray-100 dark:disabled:bg-gray-900 disabled:cursor-not-allowed`

  switch (field.type) {
    case 'text':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {field.name}
            {field.is_required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={baseInputClass}
            placeholder={`Digite ${field.name.toLowerCase()}`}
            required={field.is_required}
          />
          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
        </div>
      )

    case 'textarea':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {field.name}
            {field.is_required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={`${baseInputClass} min-h-[100px] resize-y`}
            placeholder={`Digite ${field.name.toLowerCase()}`}
            required={field.is_required}
            rows={4}
          />
          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
        </div>
      )

    case 'number':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {field.name}
            {field.is_required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={baseInputClass}
            placeholder="0"
            required={field.is_required}
          />
          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
        </div>
      )

    case 'money':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {field.name}
            {field.is_required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
            <input
              type="text"
              value={value || ''}
              onChange={handleMoneyChange}
              className={`${baseInputClass} pl-10`}
              placeholder="0,00"
              required={field.is_required}
            />
          </div>
          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
        </div>
      )

    case 'date':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {field.name}
            {field.is_required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type="date"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={baseInputClass}
            required={field.is_required}
          />
          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
        </div>
      )

    case 'select':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {field.name}
            {field.is_required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={baseInputClass}
            required={field.is_required}
          >
            <option value="">Selecione...</option>
            {field.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
        </div>
      )

    case 'multiselect':
      const selectedValues = Array.isArray(value) ? value : []
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {field.name}
            {field.is_required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <div className="space-y-2 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800">
            {field.options?.map((option) => (
              <label key={option} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 p-2 rounded">
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onChange([...selectedValues, option])
                    } else {
                      onChange(selectedValues.filter((v: string) => v !== option))
                    }
                  }}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{option}</span>
              </label>
            ))}
          </div>
          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
        </div>
      )

    case 'checkbox':
      return (
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value === true || value === 'true' || value === 1}
              onChange={(e) => onChange(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {field.name}
              {field.is_required && <span className="text-red-500 ml-1">*</span>}
            </span>
          </label>
          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
        </div>
      )

    case 'phone':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {field.name}
            {field.is_required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type="tel"
            value={value || ''}
            onChange={handlePhoneChange}
            className={baseInputClass}
            placeholder="(11) 98765-4321"
            required={field.is_required}
          />
          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
        </div>
      )

    case 'email':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {field.name}
            {field.is_required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type="email"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={baseInputClass}
            placeholder="exemplo@email.com"
            required={field.is_required}
          />
          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
        </div>
      )

    case 'url':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {field.name}
            {field.is_required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type="url"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={baseInputClass}
            placeholder="https://exemplo.com"
            required={field.is_required}
          />
          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
        </div>
      )

    default:
      return null
  }
}
