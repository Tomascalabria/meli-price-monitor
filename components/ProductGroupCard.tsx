import Link from 'next/link'
import { AlertTriangle, Users, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { formatPrice, cn } from '@/lib/utils'
import type { ProductGroupWithStats } from '@/lib/types'

export function ProductGroupCard({ group }: { group: ProductGroupWithStats }) {
  const hasAlert = group.alert_count > 0
  const priceSpread =
    group.min_price && group.max_price
      ? ((group.max_price - group.min_price) / group.min_price) * 100
      : null

  return (
    <Link
      href={`/groups/${group.id}`}
      className={cn(
        'block bg-white rounded-xl border shadow-sm p-5 hover:shadow-md transition-shadow',
        hasAlert ? 'border-red-200' : 'border-slate-200'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900 truncate">{group.name}</h3>
          {group.description && (
            <p className="text-xs text-slate-500 mt-0.5 truncate">{group.description}</p>
          )}
        </div>
        {hasAlert && (
          <span className="flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-1 rounded-full flex-shrink-0">
            <AlertTriangle className="w-3 h-3" />
            {group.alert_count} alerta{group.alert_count > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Price range */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Mínimo</p>
          <p className="text-sm font-semibold text-green-700">
            {group.min_price ? formatPrice(group.min_price) : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Promedio</p>
          <p className="text-sm font-semibold text-slate-900">
            {group.avg_price ? formatPrice(group.avg_price) : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Máximo</p>
          <p className="text-sm font-semibold text-red-700">
            {group.max_price ? formatPrice(group.max_price) : '—'}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <Users className="w-3.5 h-3.5" />
          {group.item_count ?? 0} seller{(group.item_count ?? 0) !== 1 ? 's' : ''}
        </span>
        {priceSpread !== null && (
          <span
            className={cn(
              'flex items-center gap-1 text-xs font-medium',
              priceSpread > 10
                ? 'text-red-600'
                : priceSpread > 5
                ? 'text-amber-600'
                : 'text-green-600'
            )}
          >
            {priceSpread > 2 ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : priceSpread < -2 ? (
              <TrendingDown className="w-3.5 h-3.5" />
            ) : (
              <Minus className="w-3.5 h-3.5" />
            )}
            {priceSpread.toFixed(1)}% spread
          </span>
        )}
        {group.reference_price && (
          <span className="text-xs text-slate-500">
            Ref: {formatPrice(group.reference_price)}
          </span>
        )}
      </div>
    </Link>
  )
}
