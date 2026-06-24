import { NextResponse } from 'next/server'
import { getDb, newId } from '@/lib/db'
import { fetchMeliItemsBatch } from '@/lib/meli'

export async function runScrape() {
  const db = getDb()

  const items = db
    .prepare('SELECT id, meli_item_id FROM tracked_items WHERE is_active = 1')
    .all() as { id: string; meli_item_id: string }[]

  if (items.length === 0) {
    return NextResponse.json({ scraped: 0, message: 'No active items to scrape' })
  }

  const meliIds = items.map((i) => i.meli_item_id)
  const meliData = await fetchMeliItemsBatch(meliIds)

  const idMap = new Map(items.map((i) => [i.meli_item_id, i.id]))

  const insert = db.prepare(
    `INSERT INTO price_history (id, tracked_item_id, price, original_price, currency, available_quantity, condition)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )

  const insertMany = db.transaction((entries: typeof items) => {
    let count = 0
    for (const item of entries) {
      const data = meliData.get(item.meli_item_id)
      if (!data) continue
      const trackedId = idMap.get(item.meli_item_id)
      if (!trackedId) continue
      insert.run(newId(), trackedId, data.price, data.original_price ?? null, data.currency_id, data.available_quantity, data.condition)
      count++
    }
    return count
  })

  const scraped = insertMany(items)

  return NextResponse.json({
    scraped,
    total: items.length,
    failed: items.length - scraped,
    timestamp: new Date().toISOString(),
  })
}
