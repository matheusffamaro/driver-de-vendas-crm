'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSuperAdminAuthStore } from '@/stores/super-admin-auth-store'
import { superAdminApi } from '@/lib/api'
import {
  Brain,
  Activity,
  DollarSign,
  Zap,
  Building2,
  BarChart3,
  Cpu,
} from 'lucide-react'

export default function AIUsagePage() {
  const { user } = useSuperAdminAuthStore()
  const [period, setPeriod] = useState('month')

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin-ai-usage', period],
    queryFn: async () => {
      try {
        const response = await superAdminApi.ai.usageByTenant(period)
        return response?.data?.data || { tenants: [], totals: {} }
      } catch (e) {
        return { tenants: [], totals: { total_tokens: 0, total_cost_usd: 0, total_cost_brl: 0 } }
      }
    },
    enabled: !!user?.is_super_admin,
  })

  const tenants = data?.tenants || []
  const totals = data?.totals || { total_tokens: 0, total_cost_usd: 0, total_cost_brl: 0, total_requests: 0, cache_hits: 0 }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  const cacheHitRate = totals.total_requests > 0 
    ? ((totals.cache_hits / totals.total_requests) * 100).toFixed(1) 
    : '0'

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Uso de IA</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Monitore o consumo de tokens e custos de IA</p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
        >
          <option value="today">Hoje</option>
          <option value="week">Esta semana</option>
          <option value="month">Este mês</option>
          <option value="year">Este ano</option>
        </select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Tokens Usados</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatNumber(totals.total_tokens || 0)}</p>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <Brain className="w-6 h-6 text-purple-500" />
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Requisições</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{formatNumber(totals.total_requests || 0)}</p>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Activity className="w-6 h-6 text-blue-500" />
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Taxa de Cache</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{cacheHitRate}%</p>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <Zap className="w-6 h-6 text-emerald-500" />
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Custo Total</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                ${(totals.total_cost_usd || 0).toFixed(4)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                ~R$ {(totals.total_cost_brl || 0).toFixed(2)}
              </p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Pricing Info */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-purple-500" />
            Modelo: llama-3.3-70b-versatile
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              <span className="text-gray-600 dark:text-gray-400">Input Tokens</span>
              <span className="text-gray-900 dark:text-white font-mono">$0.59 / 1M tokens</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              <span className="text-gray-600 dark:text-gray-400">Output Tokens</span>
              <span className="text-gray-900 dark:text-white font-mono">$0.79 / 1M tokens</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              <span className="text-gray-600 dark:text-gray-400">Cache Savings</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                ~{cacheHitRate}% economia
              </span>
            </div>
          </div>
        </div>

        {/* Usage by Type */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-500" />
            Distribuição por Tipo
          </h3>
          <div className="space-y-4">
            {[
              { name: 'Chat', percent: 45, color: 'bg-purple-500' },
              { name: 'Autofill', percent: 25, color: 'bg-blue-500' },
              { name: 'Sugestões', percent: 20, color: 'bg-emerald-500' },
              { name: 'Resumos', percent: 10, color: 'bg-amber-500' },
            ].map((item) => (
              <div key={item.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">{item.name}</span>
                  <span className="text-gray-900 dark:text-white font-medium">{item.percent}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${item.color} rounded-full`}
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Uso por Empresa</h3>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Empresa
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Tokens
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Requisições
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Cache Hits
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Custo
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  Carregando...
                </td>
              </tr>
            ) : tenants.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  <Brain className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>Nenhum uso registrado no período</p>
                </td>
              </tr>
            ) : (
              tenants.map((tenant: any, index: number) => (
                <tr key={tenant.tenant_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
                        {index + 1}
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white">{tenant.tenant_name || 'Desconhecido'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-900 dark:text-white font-mono">
                    {formatNumber(tenant.total_tokens || 0)}
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                    {formatNumber(tenant.total_requests || 0)}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {formatNumber(tenant.cache_hits || 0)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div>
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        ${(tenant.cost_usd || 0).toFixed(4)}
                      </span>
                      <p className="text-xs text-gray-500">
                        ~R$ {(tenant.cost_brl || 0).toFixed(2)}
                      </p>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
