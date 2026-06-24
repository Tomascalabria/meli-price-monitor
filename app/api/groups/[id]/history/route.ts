import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const db = getDb()

  const items = db
    .prepare('SELECT id FROM tracked_items WHERE product_group_id = ? AND is_active = 1')
    .all(params.id) as { id: string }[]

  if (items.length === 0) return NextResponse.json([])

  const ids = items.map((i) => i.id)
  const ph = ids.map(() => '?').join(',')

  const since = new Date()
  since.setDate(since.getDate() - 7)

  const history = db
    .prepare(
      `SELECT tracked_item_id, price, snapshot_at FROM price_history
       WHERE tracked_item_id IN (${ph}) AND snapshot_at >= ?
       ORDER BY snapshot_at ASC`
    )
    .all(...ids, since.toISOString())

  return NextResponse.json(history)
}
