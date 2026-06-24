'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatPrice, CHART_COLORS } from '@/lib/utils'

interface PricePoint {
  snapshot_at: string
  price: number
  tracked_item_id: string
}

interface Props {
  history: PricePoint[]
  sellers: Array<{ id: string; label: string }>
  currency?: string
}

export function PriceChart({ history, sellers, currency = 'ARS' }: Props) {
  // Build chart data: one row per timestamp, one column per seller
  const timeMap = new Map<string, Record<string, number>>()

  for (const point of history) {
    const key = format(new Date(point.snapshot_at), 'dd/MM HH:mm', { locale: es })
    if (!timeMap.has(key)) timeMap.set(key, { time: key as unknown as number })
    timeMap.get(key)![point.tracked_item_id] = point.price
  }

  const chartData = Array.from(timeMap.values())

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 shadow-sm">
        No hay historial de precios aún. Ejecutá una actualización para empezar.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <h3 className="font-semibold text-slate-900 mb-4">Historial de precios</h3>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={(v) => formatPrice(v, currency)}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            width={90}
          />
          <Tooltip
            formatter={(value: number, name: string) => {
              const seller = sellers.find((s) => s.id === name)
              return [formatPrice(value, currency), seller?.label ?? name]
            }}
            contentStyle={{
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <Legend
            formatter={(value) => {
              const seller = sellers.find((s) => s.id === value)
              return seller?.label ?? value
            }}
            wrapperStyle={{ fontSize: '12px' }}
          />
          {sellers.map((seller, idx) => (
            <Line
              key={seller.id}
              type="monotone"
              dataKey={seller.id}
              stroke={CHART_COLORS[idx % CHART_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
