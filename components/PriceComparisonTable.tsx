'use client'

import { TrendingUp, TrendingDown, Minus, ExternalLink, Trash2 } from 'lucide-react'
import { formatPrice, formatPct, formatRelativeTime, getPriceChangeBg, cn } from '@/lib/utils'
import type { TrackedItemWithLatestPrice } from '@/lib/types'

interface Props {
  items: TrackedItemWithLatestPrice[]
  referencePrice?: number | null
  alertThreshold?: number
  onRemove?: (itemId: string) => void
}

export function PriceComparisonTable({ items, referencePrice, alertThreshold = 5, onRemove }: Props) {
  const activeItems = items.filter((i) => i.is_active)

  if (activeItems.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
        No hay sellers siendo trackeados aún.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-4 py-3 font-medium text-slate-600">Seller</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Título</th>
            <th className="text-right px-4 py-3 font-medium text-slate-600">Precio actual</th>
            <th className="text-right px-4 py-3 font-medium text-slate-600">Anterior</th>
            <th className="text-right px-4 py-3 font-medium text-slate-600">Cambio</th>
            {referencePrice && (
              <th className="text-right px-4 py-3 font-medium text-slate-600">vs Ref</th>
            )}
            <th className="text-right px-4 py-3 font-medium text-slate-600">Actualizado</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {activeItems.map((item) => {
            const vsRef =
              referencePrice && item.latest_price
                ? ((item.latest_price - referencePrice) / referencePrice) * 100
                : null
            const isAlert = vsRef !== null && Math.abs(vsRef) > alertThreshold

            return (
              <tr
                key={item.id}
                className={cn(
                  'hover:bg-slate-50 transition-colors',
                  isAlert && 'bg-red-50 hover:bg-red-50'
                )}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {isAlert && (
                      <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                    )}
                    <span className="font-medium text-slate-900 truncate max-w-[140px]">
                      {item.seller_nickname ?? `Seller ${item.seller_meli_id}`}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <a
                    href={`https://www.mercadolibre.com.ar/p/${item.meli_item_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-slate-600 hover:text-brand-600 truncate max-w-[200px]"
                  >
                    <span className="truncate">{item.title ?? item.meli_item_id}</span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">
                  {item.latest_price ? formatPrice(item.latest_price) : '—'}
                </td>
                <td className="px-4 py-3 text-right text-slate-500">
                  {item.previous_price ? formatPrice(item.previous_price) : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  {item.price_change_pct !== null ? (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                        getPriceChangeBg(item.price_change_pct)
                      )}
                    >
                      {item.price_change_pct > 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : item.price_change_pct < 0 ? (
                        <TrendingDown className="w-3 h-3" />
                      ) : (
                        <Minus className="w-3 h-3" />
                      )}
                      {formatPct(item.price_change_pct)}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                {referencePrice && (
                  <td className="px-4 py-3 text-right">
                    {vsRef !== null ? (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                          getPriceChangeBg(vsRef)
                        )}
                      >
                        {formatPct(vsRef)}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                )}
                <td className="px-4 py-3 text-right text-slate-400 whitespace-nowrap">
                  {item.latest_snapshot_at ? formatRelativeTime(item.latest_snapshot_at) : '—'}
                </td>
                <td className="px-4 py-3">
                  {onRemove && (
                    <button
                      onClick={() => onRemove(item.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1"
                      title="Dejar de trackear"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
