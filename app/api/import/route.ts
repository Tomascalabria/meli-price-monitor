import { NextResponse } from 'next/server'
import { getDb, newId } from '@/lib/db'
import { fetchMeliItemsBatch, fetchMeliSeller } from '@/lib/meli'
import type { ImportRow, ImportJsonGroup } from '@/lib/types'

export async function POST(req: Request) {
  const db = getDb()
  const body = await req.json()
  const { rows, format } = body as { rows: ImportRow[] | ImportJsonGroup[]; format: 'csv' | 'json' }

  let normalized: ImportRow[] = []

  if (format === 'json') {
    for (const group of rows as ImportJsonGroup[]) {
      for (const item of group.items) {
        normalized.push({
          group_name: group.group_name,
          meli_item_id: item.meli_item_id,
          notes: item.notes,
          reference_price: group.reference_price?.toString(),
          alert_threshold_pct: group.alert_threshold_pct?.toString(),
        })
      }
    }
  } else {
    normalized = rows as ImportRow[]
  }

  if (normalized.length === 0) return NextResponse.json({ error: 'No rows to import' }, { status: 400 })

  // Upsert groups
  const groupNames = Array.from(new Set(normalized.map((r) => r.group_name.trim())))
  const groupMap = new Map<string, string>()

  for (const name of groupNames) {
    const existing = db.prepare('SELECT id FROM product_groups WHERE name = ?').get(name) as { id: string } | undefined
    if (existing) {
      groupMap.set(name, existing.id)
    } else {
      const sample = normalized.find((r) => r.group_name.trim() === name)
      const id = newId()
      db.prepare(
        `INSERT INTO product_groups (id, name, reference_price, alert_threshold_pct) VALUES (?, ?, ?, ?)`
      ).run(
        id,
        name,
        sample?.reference_price ? parseFloat(sample.reference_price) : null,
        sample?.alert_threshold_pct ? parseFloat(sample.alert_threshold_pct) : 5.0
      )
      groupMap.set(name, id)
    }
  }

  // Batch fetch MELI
  const allMeliIds = normalized.map((r) => r.meli_item_id.toUpperCase())
  const meliData = await fetchMeliItemsBatch(allMeliIds)

  // Seller nicknames
  const sellerIds = Array.from(new Set(Array.from(meliData.values()).map((d) => d.seller_id)))
  const sellerMap = new Map<number, string>()
  await Promise.all(
    sellerIds.map(async (id) => {
      const seller = await fetchMeliSeller(id)
      if (seller) sellerMap.set(id, seller.nickname)
    })
  )

  let imported = 0
  let skipped = 0
  const errors: string[] = []

  const insertItem = db.prepare(
    `INSERT INTO tracked_items (id, meli_item_id, product_group_id, seller_nickname, seller_meli_id, title, notes, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)
     ON CONFLICT(meli_item_id) DO UPDATE SET
       product_group_id=excluded.product_group_id,
       seller_nickname=excluded.seller_nickname,
       title=excluded.title,
       notes=excluded.notes,
       is_active=1`
  )
  const insertPrice = db.prepare(
    `INSERT INTO price_history (id, tracked_item_id, price, original_price, currency, available_quantity, condition)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )

  const doImport = db.transaction(() => {
    for (const row of normalized) {
      const meliId = row.meli_item_id.toUpperCase()
      const groupId = groupMap.get(row.group_name.trim())

      if (!groupId) { errors.push(`Group not found: ${row.group_name}`); skipped++; continue }

      const data = meliData.get(meliId)
      if (!data) { errors.push(`MELI item not found: ${meliId}`); skipped++; continue }

      const itemId = newId()
      insertItem.run(itemId, meliId, groupId, sellerMap.get(data.seller_id) ?? null, data.seller_id, data.title, row.notes ?? null)

      // Get the actual item id (might differ if conflict update happened)
      const item = db.prepare('SELECT id FROM tracked_items WHERE meli_item_id = ?').get(meliId) as { id: string }
      insertPrice.run(newId(), item.id, data.price, data.original_price ?? null, data.currency_id, data.available_quantity, data.condition)
      imported++
    }
  })

  doImport()

  return NextResponse.json({ imported, skipped, errors })
}
