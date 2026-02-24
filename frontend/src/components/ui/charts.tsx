'use client'

import { ReactNode, useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  TooltipProps,
} from 'recharts'

const GRADIENT_PAIRS: [string, string][] = [
  ['#34d399', '#059669'],
  ['#60a5fa', '#2563eb'],
  ['#a78bfa', '#7c3aed'],
  ['#f472b6', '#db2777'],
  ['#fbbf24', '#d97706'],
  ['#fb923c', '#ea580c'],
  ['#2dd4bf', '#0d9488'],
  ['#818cf8', '#4f46e5'],
]

function getGradientPair(index: number): [string, string] {
  return GRADIENT_PAIRS[index % GRADIENT_PAIRS.length]
}

/* ─── Glassmorphism Tooltip ─────────────────────────────────── */

interface GlassTooltipPayload {
  name: string
  value: number
  color?: string
  payload?: Record<string, unknown>
}

function GlassTooltip({
  active,
  payload,
  label,
  formatter,
}: TooltipProps<number, string> & {
  formatter?: (value: number, name: string, payload?: Record<string, unknown>) => ReactNode
}) {
  if (!active || !payload?.length) return null

  return (
    <div
      className="rounded-xl border border-white/10 px-4 py-3 shadow-2xl"
      style={{
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {label && (
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">
          {label}
        </p>
      )}
      <div className="space-y-1.5">
        {(payload as GlassTooltipPayload[]).map((entry, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span
              className="h-2.5 w-2.5 rounded-full ring-2 ring-white/20"
              style={{ backgroundColor: entry.color || '#10B981' }}
            />
            <span className="text-sm text-gray-300">{entry.name}</span>
            <span className="ml-auto text-sm font-semibold text-white">
              {formatter
                ? formatter(entry.value, entry.name, entry.payload)
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Modern Bar Chart ──────────────────────────────────────── */

interface BarChartItem {
  name: string
  [key: string]: unknown
}

interface ModernBarChartProps {
  data: BarChartItem[]
  dataKey: string
  layout?: 'horizontal' | 'vertical'
  height?: number
  accentColor?: string
  showGrid?: boolean
  tooltipFormatter?: (value: number, name: string, payload?: Record<string, unknown>) => ReactNode
  emptyState?: ReactNode
  barName?: string
}

export function ModernBarChart({
  data,
  dataKey,
  layout = 'horizontal',
  height = 256,
  accentColor,
  showGrid = false,
  tooltipFormatter,
  emptyState,
  barName,
}: ModernBarChartProps) {
  const gradientId = useMemo(
    () => `bar-gradient-${Math.random().toString(36).slice(2, 8)}`,
    [],
  )

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        {emptyState || (
          <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum dado disponível</p>
        )}
      </div>
    )
  }

  const [colorStart, colorEnd] = accentColor
    ? [accentColor, accentColor]
    : getGradientPair(0)

  const isVertical = layout === 'vertical'

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={isVertical ? 'vertical' : 'horizontal'}
          margin={
            isVertical
              ? { top: 4, right: 24, bottom: 4, left: 0 }
              : { top: 4, right: 8, bottom: 4, left: -16 }
          }
        >
          <defs>
            <linearGradient
              id={gradientId}
              x1={isVertical ? '0' : '0'}
              y1={isVertical ? '0' : '1'}
              x2={isVertical ? '1' : '0'}
              y2="0"
            >
              <stop offset="0%" stopColor={colorStart} stopOpacity={0.9} />
              <stop offset="100%" stopColor={colorEnd} stopOpacity={1} />
            </linearGradient>
          </defs>

          {showGrid && (
            <CartesianGrid
              strokeDasharray="0"
              stroke="currentColor"
              className="text-gray-200 dark:text-gray-800"
              vertical={false}
              horizontal={!isVertical}
            />
          )}

          {isVertical ? (
            <>
              <XAxis
                type="number"
                stroke="currentColor"
                className="text-gray-400 dark:text-gray-500"
                fontSize={11}
                fontWeight={500}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="currentColor"
                className="text-gray-500 dark:text-gray-400"
                fontSize={12}
                fontWeight={500}
                width={110}
                tickLine={false}
                axisLine={false}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey="name"
                stroke="currentColor"
                className="text-gray-500 dark:text-gray-400"
                fontSize={12}
                fontWeight={500}
                tickLine={false}
                axisLine={false}
                dy={8}
              />
              <YAxis
                stroke="currentColor"
                className="text-gray-400 dark:text-gray-500"
                fontSize={11}
                fontWeight={500}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
            </>
          )}

          <Tooltip
            content={<GlassTooltip formatter={tooltipFormatter} />}
            cursor={{
              fill: 'currentColor',
              className: 'text-gray-200/40 dark:text-gray-700/40',
              radius: 6,
            }}
          />

          <Bar
            dataKey={dataKey}
            name={barName || dataKey}
            fill={`url(#${gradientId})`}
            radius={isVertical ? [0, 8, 8, 0] : [8, 8, 0, 0]}
            maxBarSize={isVertical ? 28 : 48}
            animationDuration={800}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ─── Multi-color Bar Chart (each bar gets its own color) ───── */

interface ColoredBarItem {
  name: string
  value: number
  color?: string
  [key: string]: unknown
}

interface ModernColoredBarChartProps {
  data: ColoredBarItem[]
  height?: number
  showGrid?: boolean
  tooltipFormatter?: (value: number, name: string, payload?: Record<string, unknown>) => ReactNode
  emptyState?: ReactNode
}

export function ModernColoredBarChart({
  data,
  height = 256,
  showGrid = false,
  tooltipFormatter,
  emptyState,
}: ModernColoredBarChartProps) {
  const gradientIds = useMemo(
    () => data.map((_, i) => `cbar-g-${i}-${Math.random().toString(36).slice(2, 6)}`),
    [data],
  )

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        {emptyState || (
          <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum dado disponível</p>
        )}
      </div>
    )
  }

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 4, right: 8, bottom: 4, left: -16 }}
        >
          <defs>
            {data.map((item, i) => {
              const [start, end] = item.color
                ? [item.color, item.color]
                : getGradientPair(i)
              return (
                <linearGradient key={gradientIds[i]} id={gradientIds[i]} x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor={start} stopOpacity={0.7} />
                  <stop offset="100%" stopColor={end} stopOpacity={1} />
                </linearGradient>
              )
            })}
          </defs>

          {showGrid && (
            <CartesianGrid
              strokeDasharray="0"
              stroke="currentColor"
              className="text-gray-200 dark:text-gray-800"
              vertical={false}
            />
          )}

          <XAxis
            dataKey="name"
            stroke="currentColor"
            className="text-gray-500 dark:text-gray-400"
            fontSize={11}
            fontWeight={500}
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={data.length > 5 ? -35 : 0}
            textAnchor={data.length > 5 ? 'end' : 'middle'}
            height={data.length > 5 ? 72 : 36}
            dy={8}
          />
          <YAxis
            stroke="currentColor"
            className="text-gray-400 dark:text-gray-500"
            fontSize={11}
            fontWeight={500}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />

          <Tooltip
            content={<GlassTooltip formatter={tooltipFormatter} />}
            cursor={{
              fill: 'currentColor',
              className: 'text-gray-200/40 dark:text-gray-700/40',
              radius: 6,
            }}
          />

          <Bar
            dataKey="value"
            name="Leads"
            radius={[8, 8, 0, 0]}
            maxBarSize={48}
            animationDuration={800}
            animationEasing="ease-out"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={`url(#${gradientIds[i]})`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ─── Modern Donut Chart ────────────────────────────────────── */

interface DonutItem {
  name: string
  value: number
  color: string
}

interface ModernDonutChartProps {
  data: DonutItem[]
  height?: number
  innerRadius?: number
  outerRadius?: number
  centerLabel?: string
  centerValue?: string | number
  showLegend?: boolean
  emptyState?: ReactNode
}

export function ModernDonutChart({
  data,
  height = 192,
  innerRadius = 54,
  outerRadius = 82,
  centerLabel,
  centerValue,
  showLegend = true,
  emptyState,
}: ModernDonutChartProps) {
  const gradientIds = useMemo(
    () => data.map((_, i) => `donut-g-${i}-${Math.random().toString(36).slice(2, 6)}`),
    [data],
  )

  const total = data.reduce((sum, d) => sum + d.value, 0)

  if (data.length === 0 || total === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        {emptyState || (
          <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum dado disponível</p>
        )}
      </div>
    )
  }

  return (
    <div>
      <div style={{ height }} className="relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              {data.map((item, i) => {
                const lighter = item.color + '99'
                return (
                  <linearGradient key={gradientIds[i]} id={gradientIds[i]} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={lighter} />
                    <stop offset="100%" stopColor={item.color} />
                  </linearGradient>
                )
              })}
            </defs>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
              animationDuration={900}
              animationEasing="ease-out"
            >
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={`url(#${gradientIds[i]})`}
                  className="drop-shadow-sm transition-opacity hover:opacity-80"
                />
              ))}
            </Pie>
            <Tooltip content={<GlassTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {(centerLabel || centerValue !== undefined) && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              {centerValue !== undefined && (
                <p className="text-2xl font-bold text-gray-900 dark:text-white leading-none">
                  {centerValue}
                </p>
              )}
              {centerLabel && (
                <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {centerLabel}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {showLegend && (
        <div className="mt-4 space-y-2">
          {data.map((item) => {
            const pct = total > 0 ? Math.round((item.value / total) * 100) : 0
            return (
              <div key={item.name} className="flex items-center justify-between group">
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full ring-2 ring-white/20 dark:ring-gray-900/20"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                    {item.value}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums w-9 text-right">
                    {pct}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ─── Progress Ring ─────────────────────────────────────────── */

interface ProgressRingProps {
  value: number
  size?: number
  strokeWidth?: number
  color?: string
  trackColor?: string
  label?: string
}

export function ProgressRing({
  value,
  size = 128,
  strokeWidth = 10,
  color = '#22C55E',
  trackColor,
  label,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(value, 100) / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor || 'currentColor'}
          className={trackColor ? '' : 'text-gray-200 dark:text-gray-800'}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-gray-900 dark:text-white leading-none tabular-nums">
          {value}%
        </span>
        {label && (
          <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {label}
          </span>
        )}
      </div>
    </div>
  )
}
