'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, AlertTriangle, Calendar } from 'lucide-react'
import { pipelineApi } from '@/lib/api'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { format, subDays } from 'date-fns'

export default function PipelineReportPage() {
  const searchParams = useSearchParams()
  const pipelineId = searchParams.get('id')
  
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
  })

  // Fetch report
  const { data: reportData, isLoading } = useQuery({
    queryKey: ['pipeline-report', pipelineId, dateRange],
    queryFn: () => pipelineApi.report(pipelineId!, { 
      start_date: dateRange.start, 
      end_date: dateRange.end 
    }),
    enabled: !!pipelineId,
  })

  const reportRaw = reportData?.data?.data
  const report = reportRaw ? {
    ...reportRaw,
    metrics: {
      total_cards: 0,
      avg_lead_time: 0,
      last_card_at: null,
      avg_ticket: 0,
      won_count: 0,
      won_value: 0,
      lost_count: 0,
      lost_value: 0,
      conversion_rate: 0,
      ...reportRaw.metrics,
    },
    funnel: reportRaw.funnel || [],
  } : null

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    try {
      return format(new Date(dateString), "dd 'de' MMMM, HH:mm")
    } catch {
      return dateString
    }
  }

  // Calculate funnel percentages
  const funnelData = report?.funnel || []
  const maxCount = Math.max(...funnelData.map((s: any) => s.count), 1)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    )
  }

  if (!report) {
    return (
      <div className="p-6">
        <Link
          href="/crm/pipeline"
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6"
        >
          <ArrowLeft className="h-5 w-5" />
          Voltar
        </Link>
        <p className="text-center text-gray-500">Selecione um pipeline para ver o relatório.</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/crm/pipeline"
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-800">Relatório</h1>
      </div>

      {/* Experimental Warning */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
        <p className="text-sm text-yellow-700">
          <strong>Painel experimental</strong> - Estamos fazendo testes e entendendo como podemos melhorar esta funcionalidade
        </p>
      </div>

      {/* Date Filter */}
      <div className="flex items-center gap-4 mb-8">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-400" />
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <span className="text-gray-400">até</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Funnel Chart */}
      <div className="bg-gray-900 rounded-xl p-6 mb-8">
        <div className="grid grid-cols-6 gap-2">
          {funnelData.map((stage: any, index: number) => {
            const height = (stage.count / maxCount) * 100 || 5
            const percentage = report.metrics.total_cards > 0 
              ? Math.round((stage.count / report.metrics.total_cards) * 100)
              : 0

            return (
              <div key={stage.id} className="flex flex-col items-center">
                {/* Count */}
                <div className="text-2xl font-bold text-white mb-1">{stage.count}</div>
                <div className="text-sm text-emerald-400 mb-2">{stage.name}</div>
                <div className="text-xs text-gray-400 mb-4">{percentage}%</div>
                
                {/* Bar */}
                <div className="w-full flex justify-center">
                  <div 
                    className="w-full max-w-[100px] rounded-t-lg transition-all duration-500"
                    style={{ 
                      height: `${Math.max(height, 20)}px`,
                      backgroundColor: index === 0 ? '#ec4899' : 'transparent',
                      borderLeft: index > 0 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
        
        {/* Funnel Shape Visual */}
        <div className="relative mt-4">
          <svg 
            viewBox="0 0 600 200" 
            className="w-full h-40"
            preserveAspectRatio="none"
          >
            {/* Pink gradient funnel */}
            <defs>
              <linearGradient id="funnelGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ec4899" />
                <stop offset="100%" stopColor="#ec4899" stopOpacity="0.3" />
              </linearGradient>
            </defs>
            <path
              d="M0,0 L600,0 L500,200 L100,200 Z"
              fill="url(#funnelGradient)"
              opacity="0.8"
            />
            {/* Grid lines */}
            {[1, 2, 3, 4, 5].map((i) => (
              <line
                key={i}
                x1={i * 100}
                y1="0"
                x2={100 + (i - 1) * 80}
                y2="200"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="1"
              />
            ))}
          </svg>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <p className="text-sm text-gray-500 mb-1">Lead time *</p>
          <p className="text-2xl font-bold text-gray-800">
            {report.metrics.avg_lead_time > 0 
              ? `${report.metrics.avg_lead_time} dias` 
              : '-'
            }
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <p className="text-sm text-gray-500 mb-1">Último card criado em</p>
          <p className="text-2xl font-bold text-gray-800">
            {formatDate(report.metrics.last_card_at)}
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <p className="text-sm text-gray-500 mb-1">Ticket médio</p>
          <p className="text-2xl font-bold text-gray-800">
            {formatCurrency(report.metrics.avg_ticket)}
          </p>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-4 gap-4 mt-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500">Total de cards</p>
          <p className="text-xl font-semibold text-gray-800">{report.metrics.total_cards}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm text-green-600">Ganhos</p>
          <p className="text-xl font-semibold text-green-700">
            {report.metrics.won_count} ({formatCurrency(report.metrics.won_value)})
          </p>
        </div>
        <div className="bg-red-50 rounded-lg p-4">
          <p className="text-sm text-red-600">Perdidos</p>
          <p className="text-xl font-semibold text-red-700">
            {report.metrics.lost_count} ({formatCurrency(report.metrics.lost_value)})
          </p>
        </div>
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-blue-600">Taxa de conversão</p>
          <p className="text-xl font-semibold text-blue-700">{report.metrics.conversion_rate}%</p>
        </div>
      </div>
    </div>
  )
}
