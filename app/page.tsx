import { getDb } from '@/lib/db'
import { StatsCard } from '@/components/StatsCard'
import { ProductGroupCard } from '@/components/ProductGroupCard'
import { RunScrapeButton } from '@/components/RunScrapeButton'
import { Boxes, AlertTriangle, Users, Clock } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import type { ProductGroupWithStats } from '@/lib/types'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  const db = getDb()

  const rawGroups = db.prepare('SELECT * FROM product_groups ORDER BY created_at DESC').all() as Record<string, unknown>[]
  const totalSellers = (db.prepare('SELECT COUNT(*) as c FROM tracked_items WHERE is_active = 1').get() as { c: number }).c
  const lastSnapshot = db.prepare('SELECT snapshot_at FROM price_history ORDER BY snapshot_at DESC LIMIT 1').get() as { snapshot_at: string } | undefined

  const enrichedGroups: ProductGroupWithStats[] = rawGroups.map((group) => {
    const activeItems = db
      .prepare('SELECT id FROM tracked_items WHERE product_group_id = ? AND is_active = 1')
      .all(group.id as string) as { id: string }[]

    if (activeItems.length === 0) {
      return { ...(group as unknown as ProductGroupWithStats), item_count: 0, min_price: null, max_price: null, avg_price: null, alert_count: 0 }
    }

    const ids = activeItems.map((i) => i.id)
    const ph = ids.map(() => '?').join(',')

    const prices = db
      .prepare(
        `SELECT ph.price FROM price_history ph
         INNER JOIN (
           SELECT tracked_item_id, MAX(snapshot_at) AS max_at
           FROM price_history WHERE tracked_item_id IN (${ph}) GROUP BY tracked_item_id
         ) lp ON ph.tracked_item_id = lp.tracked_item_id AND ph.snapshot_at = lp.max_at`
      )
      .all(...ids) as { price: number }[]

    const vals = prices.map((p) => p.price)
    if (vals.length === 0) {
      return { ...(group as unknown as ProductGroupWithStats), item_count: ids.length, min_price: null, max_price: null, avg_price: null, alert_count: 0 }
    }

    const min_price = Math.min(...vals)
    const max_price = Math.max(...vals)
    const avg_price = vals.reduce((a, b) => a + b, 0) / vals.length
    const threshold = (group.alert_threshold_pct as number) / 100
    const ref = (group.reference_price as number | null) ?? avg_price
    const alert_count = vals.filter((p) => Math.abs(p - ref) / ref > threshold).length

    return { ...(group as unknown as ProductGroupWithStats), item_count: ids.length, min_price, max_price, avg_price, alert_count }
  })

  const totalAlerts = enrichedGroups.reduce((sum, g) => sum + g.alert_count, 0)

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitoreo de precios en MercadoLibre
            {lastSnapshot?.snapshot_at && (
              <span> · última actualización {formatRelativeTime(lastSnapshot.snapshot_at)}</span>
            )}
          </p>
        </div>
        <RunScrapeButton />
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatsCard
          title="Grupos de productos"
          value={enrichedGroups.length}
          subtitle="grupos monitoreados"
          icon={Boxes}
          accentColor="bg-brand-500"
        />
        <StatsCard
          title="Sellers trackeados"
          value={totalSellers}
          subtitle="listings activos"
          icon={Users}
          accentColor="bg-violet-500"
        />
        <StatsCard
          title="Alertas activas"
          value={totalAlerts}
          subtitle={totalAlerts > 0 ? 'precios fuera de rango' : 'todo en orden'}
          icon={AlertTriangle}
          accentColor={totalAlerts > 0 ? 'bg-red-500' : 'bg-green-500'}
        />
        <StatsCard
          title="Última actualización"
          value={lastSnapshot?.snapshot_at ? formatRelativeTime(lastSnapshot.snapshot_at) : '—'}
          subtitle="próxima: automática en 1h"
          icon={Clock}
          accentColor="bg-amber-500"
        />
      </div>

      {enrichedGroups.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Boxes className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-700 mb-1">No hay productos aún</h3>
          <p className="text-sm text-slate-500 mb-4">
            Importá un CSV o JSON con los items de MercadoLibre para empezar a trackear.
          </p>
          <Link
            href="/import"
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700"
          >
            Importar productos
          </Link>
        </div>
      ) : (
        <>
          {totalAlerts > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl mb-4 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <strong>{totalAlerts} alerta{totalAlerts > 1 ? 's' : ''}</strong> de precios fuera de rango detectada{totalAlerts > 1 ? 's' : ''}.
              Revisá los grupos marcados en rojo.
            </div>
          )}
          <div className="grid grid-cols-3 gap-4">
            {enrichedGroups.map((group) => (
              <ProductGroupCard key={group.id} group={group} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
