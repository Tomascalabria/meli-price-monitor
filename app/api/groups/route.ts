import { NextResponse } from 'next/server'
import { getDb, newId } from '@/lib/db'

export async function GET() {
  const db = getDb()

  const groups = db.prepare('SELECT * FROM product_groups ORDER BY created_at DESC').all() as Record<string, unknown>[]

  const result = groups.map((group) => {
    const activeItems = db
      .prepare('SELECT id FROM tracked_items WHERE product_group_id = ? AND is_active = 1')
      .all(group.id as string) as { id: string }[]

    if (activeItems.length === 0) {
      return { ...group, item_count: 0, min_price: null, max_price: null, avg_price: null, alert_count: 0 }
    }

    const ids = activeItems.map((i) => i.id)
    const placeholders = ids.map(() => '?').join(',')

    const prices = db
      .prepare(
        `SELECT ph.price FROM price_history ph
         INNER JOIN (
           SELECT tracked_item_id, MAX(snapshot_at) AS max_at
           FROM price_history WHERE tracked_item_id IN (${placeholders})
           GROUP BY tracked_item_id
         ) lp ON ph.tracked_item_id = lp.tracked_item_id AND ph.snapshot_at = lp.max_at`
      )
      .all(...ids) as { price: number }[]

    const vals = prices.map((p) => p.price)
    if (vals.length === 0) {
      return { ...group, item_count: ids.length, min_price: null, max_price: null, avg_price: null, alert_count: 0 }
    }

    const min_price = Math.min(...vals)
    const max_price = Math.max(...vals)
    const avg_price = vals.reduce((a, b) => a + b, 0) / vals.length
    const threshold = (group.alert_threshold_pct as number) / 100
    const ref = (group.reference_price as number | null) ?? avg_price
    const alert_count = vals.filter((p) => Math.abs(p - ref) / ref > threshold).length

    return { ...group, item_count: ids.length, min_price, max_price, avg_price, alert_count }
  })

  return NextResponse.json(result)
}

export async function POST(req: Request) {
  const db = getDb()
  const body = await req.json()
  const id = newId()

  db.prepare(
    `INSERT INTO product_groups (id, name, description, reference_price, alert_threshold_pct)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, body.name, body.description ?? null, body.reference_price ?? null, body.alert_threshold_pct ?? 5.0)

  const group = db.prepare('SELECT * FROM product_groups WHERE id = ?').get(id)
  return NextResponse.json(group, { status: 201 })
}
