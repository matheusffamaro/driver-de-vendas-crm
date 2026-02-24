'use client'

import { Plus, Trash2, X } from 'lucide-react'

export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'greater_or_equal'
  | 'less_or_equal'
  | 'between'
  | 'is_empty'
  | 'is_not_empty'
  | 'is_today'
  | 'is_yesterday'
  | 'is_this_week'
  | 'is_this_month'
  | 'is_before'
  | 'is_after'
  | 'in'
  | 'not_in'

export interface FilterCondition {
  field: string
  operator: FilterOperator
  value: any
}

export interface FilterGroup {
  operator: 'AND' | 'OR'
  conditions: FilterCondition[]
}

interface FilterBuilderProps {
  filters: FilterGroup
  onChange: (filters: FilterGroup) => void
  customFields: any[]
}

const FIELD_OPTIONS = [
  { value: 'title', label: 'Título', type: 'text' },
  { value: 'value', label: 'Valor', type: 'number' },
  { value: 'priority', label: 'Prioridade', type: 'select', options: ['low', 'medium', 'high', 'urgent'] },
  { value: 'assigned_to', label: 'Atribuído para', type: 'user' },
  { value: 'contact', label: 'Cliente', type: 'text' },
  { value: 'created_at', label: 'Data de criação', type: 'date' },
  { value: 'updated_at', label: 'Última atualização', type: 'date' },
  { value: 'stage', label: 'Etapa', type: 'stage' },
]

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: 'é igual a',
  not_equals: 'é diferente de',
  contains: 'contém',
  not_contains: 'não contém',
  starts_with: 'começa com',
  ends_with: 'termina com',
  greater_than: 'maior que',
  less_than: 'menor que',
  greater_or_equal: 'maior ou igual a',
  less_or_equal: 'menor ou igual a',
  between: 'entre',
  is_empty: 'está vazio',
  is_not_empty: 'não está vazio',
  is_today: 'é hoje',
  is_yesterday: 'foi ontem',
  is_this_week: 'é esta semana',
  is_this_month: 'é este mês',
  is_before: 'é antes de',
  is_after: 'é depois de',
  in: 'está em',
  not_in: 'não está em',
}

const getOperatorsForType = (type: string): FilterOperator[] => {
  switch (type) {
    case 'text':
      return ['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty']
    case 'number':
      return ['equals', 'not_equals', 'greater_than', 'less_than', 'greater_or_equal', 'less_or_equal', 'between', 'is_empty', 'is_not_empty']
    case 'date':
      return ['is_today', 'is_yesterday', 'is_this_week', 'is_this_month', 'is_before', 'is_after', 'between', 'is_empty', 'is_not_empty']
    case 'select':
      return ['equals', 'not_equals', 'in', 'not_in', 'is_empty', 'is_not_empty']
    case 'user':
    case 'stage':
      return ['equals', 'not_equals', 'is_empty', 'is_not_empty']
    default:
      return ['equals', 'not_equals', 'is_empty', 'is_not_empty']
  }
}

const needsValue = (operator: FilterOperator): boolean => {
  return !['is_empty', 'is_not_empty', 'is_today', 'is_yesterday', 'is_this_week', 'is_this_month'].includes(operator)
}

export function FilterBuilder({ filters, onChange, customFields }: FilterBuilderProps) {
  const allFields = [
    ...FIELD_OPTIONS,
    ...customFields.map((cf) => ({
      value: `custom.${cf.field_key}`,
      label: `${cf.name} (Campo Customizado)`,
      type: cf.type === 'money' ? 'number' : cf.type === 'multiselect' ? 'select' : cf.type,
      options: cf.options,
    })),
  ]

  const addCondition = () => {
    onChange({
      ...filters,
      conditions: [
        ...filters.conditions,
        {
          field: allFields[0].value,
          operator: 'equals',
          value: null,
        },
      ],
    })
  }

  const updateCondition = (index: number, updates: Partial<FilterCondition>) => {
    const newConditions = [...filters.conditions]
    newConditions[index] = { ...newConditions[index], ...updates }
    onChange({ ...filters, conditions: newConditions })
  }

  const removeCondition = (index: number) => {
    onChange({
      ...filters,
      conditions: filters.conditions.filter((_, i) => i !== index),
    })
  }

  const toggleOperator = () => {
    onChange({
      ...filters,
      operator: filters.operator === 'AND' ? 'OR' : 'AND',
    })
  }

  return (
    <div className="space-y-3">
      {filters.conditions.length > 1 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-gray-500 dark:text-gray-400">Combinar condições com:</span>
          <button
            onClick={toggleOperator}
            className={`px-3 py-1.5 rounded-lg font-medium text-sm transition-colors ${
              filters.operator === 'AND'
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
            }`}
          >
            {filters.operator === 'AND' ? 'E (AND)' : 'OU (OR)'}
          </button>
        </div>
      )}

      {filters.conditions.map((condition, index) => {
        const field = allFields.find((f) => f.value === condition.field)
        const fieldType = field?.type || 'text'
        const operators = getOperatorsForType(fieldType)

        return (
          <div
            key={index}
            className="flex items-start gap-2 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            {/* Field Select */}
            <div className="flex-1">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Campo</label>
              <select
                value={condition.field}
                onChange={(e) => {
                  const newField = allFields.find((f) => f.value === e.target.value)
                  const newType = newField?.type || 'text'
                  const newOperators = getOperatorsForType(newType)
                  updateCondition(index, {
                    field: e.target.value,
                    operator: newOperators[0],
                    value: null,
                  })
                }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
              >
                {allFields.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Operator Select */}
            <div className="flex-1">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Condição</label>
              <select
                value={condition.operator}
                onChange={(e) => updateCondition(index, { operator: e.target.value as FilterOperator, value: null })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
              >
                {operators.map((op) => (
                  <option key={op} value={op}>
                    {OPERATOR_LABELS[op]}
                  </option>
                ))}
              </select>
            </div>

            {/* Value Input */}
            {needsValue(condition.operator) && (
              <div className="flex-1">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Valor</label>
                {fieldType === 'number' ? (
                  <input
                    type="number"
                    value={condition.value || ''}
                    onChange={(e) => updateCondition(index, { value: parseFloat(e.target.value) || null })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                    placeholder="Digite um número"
                  />
                ) : fieldType === 'date' ? (
                  <input
                    type="date"
                    value={condition.value || ''}
                    onChange={(e) => updateCondition(index, { value: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                  />
                ) : fieldType === 'select' && field?.options ? (
                  <select
                    value={condition.value || ''}
                    onChange={(e) => updateCondition(index, { value: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                  >
                    <option value="">Selecione...</option>
                    {field.options.map((opt: string) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={condition.value || ''}
                    onChange={(e) => updateCondition(index, { value: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                    placeholder="Digite o valor"
                  />
                )}
              </div>
            )}

            {/* Remove Button */}
            <button
              onClick={() => removeCondition(index)}
              className="mt-6 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Remover condição"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )
      })}

      {/* Add Condition Button */}
      <button
        onClick={addCondition}
        className="w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-purple-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex items-center justify-center gap-2 font-medium"
      >
        <Plus className="w-4 h-4" />
        {filters.conditions.length === 0 ? 'Adicionar Primeira Condição' : 'Adicionar Condição'}
      </button>

      {filters.conditions.length === 0 && (
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 mb-3">
            <Plus className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma condição adicionada</p>
          <p className="text-xs text-gray-400 mt-1">Clique no botão acima para começar</p>
        </div>
      )}
    </div>
  )
}
