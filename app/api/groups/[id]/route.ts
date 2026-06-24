import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const db = getDb()

  const group = db.prepare('SELECT * FROM product_groups WHERE id = ?').get(params.id)
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const items = db
    .prepare('SELECT * FROM tracked_items WHERE product_group_id = ? ORDER BY created_at')
    .all(params.id) as Record<string, unknown>[]

  const activeIds = items.filter((i) => i.is_active).map((i) => i.id as string)

  let latestMap = new Map<string, { price: number; snapshot_at: string }>()
  let prevMap = new Map<string, { price: number }>()

  if (activeIds.length > 0) {
    const ph = activeIds.map(() => '?').join(',')

    const latest = db
      .prepare(
        `SELECT ph.tracked_item_id, ph.price, ph.snapshot_at
         FROM price_history ph
         INNER JOIN (
           SELECT tracked_item_id, MAX(snapshot_at) AS max_at
           FROM price_history WHERE tracked_item_id IN (${ph}) GROUP BY tracked_item_id
         ) lp ON ph.tracked_item_id = lp.tracked_item_id AND ph.snapshot_at = lp.max_at`
      )
      .all(...activeIds) as { tracked_item_id: string; price: number; snapshot_at: string }[]

    const prev = db
      .prepare(
        `SELECT tracked_item_id, price FROM (
           SELECT tracked_item_id, price, snapshot_at,
             ROW_NUMBER() OVER (PARTITION BY tracked_item_id ORDER BY snapshot_at DESC) AS rn
           FROM price_history WHERE tracked_item_id IN (${ph})
         ) WHERE rn = 2`
      )
      .all(...activeIds) as { tracked_item_id: string; price: number }[]

    latestMap = new Map(latest.map((r) => [r.tracked_item_id, r]))
    prevMap = new Map(prev.map((r) => [r.tracked_item_id, r]))
  }

  const itemsWithPrices = items.map((item) => {
    const id = item.id as string
    const l = latestMap.get(id)
    const p = prevMap.get(id)
    const price_change_pct =
      l && p && p.price > 0 ? ((l.price - p.price) / p.price) * 100 : null
    return {
      ...item,
      latest_price: l?.price ?? null,
      previous_price: p?.price ?? null,
      latest_snapshot_at: l?.snapshot_at ?? null,
      price_change_pct,
    }
  })

  return NextResponse.json({ ...group, items: itemsWithPrices })
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const db = getDb()
  const body = await req.json()

  db.prepare(
    `UPDATE product_groups SET name=?, description=?, reference_price=?, alert_threshold_pct=?
     WHERE id=?`
  ).run(body.name, body.description ?? null, body.reference_price ?? null, body.alert_threshold_pct ?? 5.0, params.id)

  return NextResponse.json(db.prepare('SELECT * FROM product_groups WHERE id = ?').get(params.id))
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const db = getDb()
  db.prepare('DELETE FROM product_groups WHERE id = ?').run(params.id)
  return new Response(null, { status: 204 })
}
