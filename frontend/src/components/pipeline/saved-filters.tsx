'use client'

import { Star, StarOff, Trash2, Play, Filter } from 'lucide-react'
import { FilterGroup } from './filter-builder'

interface SavedFilter {
  id: string
  name: string
  filters: FilterGroup
  is_favorite: boolean
  created_at?: string
}

interface SavedFiltersProps {
  filters: SavedFilter[]
  onLoad: (filterId: string) => void
  onDelete?: (filterId: string) => Promise<void>
  onToggleFavorite?: (filterId: string) => Promise<void>
}

export function SavedFilters({ filters, onLoad, onDelete, onToggleFavorite }: SavedFiltersProps) {
  const favorites = filters.filter((f) => f.is_favorite)
  const others = filters.filter((f) => !f.is_favorite)

  const FilterCard = ({ filter }: { filter: SavedFilter }) => (
    <div className="group p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 transition-all">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-purple-500" />
            <h4 className="font-medium text-gray-900 dark:text-white">{filter.name}</h4>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {filter.filters.conditions.length} {filter.filters.conditions.length === 1 ? 'condição' : 'condições'}
            {filter.filters.operator && ` • ${filter.filters.operator === 'AND' ? 'E' : 'OU'}`}
          </p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onToggleFavorite && (
            <button
              onClick={() => onToggleFavorite(filter.id)}
              className="p-1.5 text-gray-400 hover:text-yellow-500 rounded transition-colors"
              title={filter.is_favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            >
              {filter.is_favorite ? (
                <StarOff className="w-4 h-4" />
              ) : (
                <Star className="w-4 h-4" />
              )}
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => {
                if (confirm(`Tem certeza que deseja excluir o filtro "${filter.name}"?`)) {
                  onDelete(filter.id)
                }
              }}
              className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
              title="Excluir filtro"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Conditions Preview */}
      <div className="space-y-1 mb-3">
        {filter.filters.conditions.slice(0, 2).map((condition, idx) => (
          <div key={idx} className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-purple-400"></span>
            <span className="truncate">
              {condition.field} {condition.operator} {condition.value !== null && condition.value !== undefined ? String(condition.value) : ''}
            </span>
          </div>
        ))}
        {filter.filters.conditions.length > 2 && (
          <div className="text-xs text-gray-500 italic">
            + {filter.filters.conditions.length - 2} condições
          </div>
        )}
      </div>

      <button
        onClick={() => onLoad(filter.id)}
        className="w-full px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        <Play className="w-3 h-3" />
        Aplicar Filtro
      </button>
    </div>
  )

  return (
    <div className="space-y-6">
      {filters.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
            <Filter className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Nenhum filtro salvo
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Crie e salve filtros para reutilizá-los rapidamente
          </p>
        </div>
      ) : (
        <>
          {favorites.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Favoritos</h3>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {favorites.map((filter) => (
                  <FilterCard key={filter.id} filter={filter} />
                ))}
              </div>
            </div>
          )}

          {others.length > 0 && (
            <div>
              {favorites.length > 0 && (
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Outros Filtros</h3>
              )}
              <div className="grid grid-cols-1 gap-3">
                {others.map((filter) => (
                  <FilterCard key={filter.id} filter={filter} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
