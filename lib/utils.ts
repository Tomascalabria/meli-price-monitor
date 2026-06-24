import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number, currency = 'ARS') {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)
}

export function formatPct(pct: number) {
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

export function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)

  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins}m`
  if (hours < 24) return `hace ${hours}h`
  return `hace ${days}d`
}

export function getPriceChangeColor(pct: number | null) {
  if (pct === null) return 'text-gray-500'
  if (pct > 0) return 'text-red-600'
  if (pct < 0) return 'text-green-600'
  return 'text-gray-500'
}

export function getPriceChangeBg(pct: number | null) {
  if (pct === null) return 'bg-gray-100 text-gray-600'
  if (pct > 0) return 'bg-red-50 text-red-700'
  if (pct < 0) return 'bg-green-50 text-green-700'
  return 'bg-gray-100 text-gray-600'
}

export const CHART_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#06B6D4',
  '#F97316',
  '#EC4899',
  '#84CC16',
  '#6366F1',
]
