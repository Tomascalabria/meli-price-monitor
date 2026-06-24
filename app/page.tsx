import { createServerClient } from '@/lib/supabase'
import { StatsCard } from '@/components/StatsCard'
import { ProductGroupCard } from '@/components/ProductGroupCard'
import { RunScrapeButton } from '@/components/RunScrapeButton'
import { Boxes, AlertTriangle, Users, Clock } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import type { ProductGroupWithStats } from '@/lib/types'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = createServerClient()

  const [{ data: rawGroups }, { count: totalItems }, { data: lastSnapshot }] = await Promise.all([
    supabase.from('product_groups').select(`
      *,
      tracked_items(id, is_active)
    `),
    supabase.from('tracked_items').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase
      .from('price_history')
      .select('snapshot_at')
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .single(),
  ])

  const groups = rawGroups ?? []

  // Enrich groups with price stats
  const enrichedGroups: ProductGroupWithStats[] = await Promise.all(
    groups.map(async (group) => {
      const activeIds = (group.tracked_items as Array<{ id: string; is_active: boolean }>)
        .filter((i) => i.is_active)
        .map((i) => i.id)

      if (activeIds.length === 0) {
        return { ...group, item_count: 0, min_price: null, max_price: null, avg_price: null, alert_count: 0 }
      }

      const { data: prices } = await supabase
        .from('latest_prices')
        .select('price')
        .in('tracked_item_id', activeIds)

      const vals = (prices ?? []).map((p: { price: number }) => p.price)

      if (vals.length === 0) {
        return { ...group, item_count: activeIds.length, min_price: null, max_price: null, avg_price: null, alert_count: 0 }
      }

      const min_price = Math.min(...vals)
      const max_price = Math.max(...vals)
      const avg_price = vals.reduce((a: number, b: number) => a + b, 0) / vals.length
      const threshold = group.alert_threshold_pct / 100
      const ref = group.reference_price ?? avg_price
      const alert_count = vals.filter((p: number) => Math.abs(p - ref) / ref > threshold).length

      return { ...group, item_count: activeIds.length, min_price, max_price, avg_price, alert_count }
    })
  )

  const totalGroups = enrichedGroups.length
  const totalAlerts = enrichedGroups.reduce((sum, g) => sum + g.alert_count, 0)
  const totalSellers = totalItems ?? 0

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
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

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatsCard
          title="Grupos de productos"
          value={totalGroups}
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

      {/* Groups */}
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
              <strong>{totalAlerts} alerta{totalAlerts > 1 ? 's'  : ''}</strong> de precios fuera de rango detectada{totalAlerts > 1 ? 's' : ''}.
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
