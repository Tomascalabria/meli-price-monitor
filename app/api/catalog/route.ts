import { NextResponse } from 'next/server'
import { fetchCatalogItems, fetchMeliItemsBatch, fetchMeliSeller } from '@/lib/meli'
import { getDb, newId } from '@/lib/db'

// POST /api/catalog
// Body: { product_id: "MLA37106988", group_name: "Samsung Galaxy S24", reference_price?: number }
// Auto-imports all seller listings for a catalog product
export async function POST(req: Request) {
  const body = await req.json()
  const { product_id, group_name, reference_price } = body

  if (!product_id || !group_name) {
    return NextResponse.json({ error: 'product_id y group_name son requeridos' }, { status: 400 })
  }

  const listings = await fetchCatalogItems(product_id.toUpperCase())
  if (listings.length === 0) {
    return NextResponse.json({ error: 'No se encontraron listings para ese producto' }, { status: 404 })
  }

  // Batch fetch item details
  const itemIds = listings.map((l) => l.id)
  const meliData = await fetchMeliItemsBatch(itemIds)

  // Unique seller ids
  const sellerIds = Array.from(new Set(Array.from(meliData.values()).map((d) => d.seller_id)))
  const sellerMap = new Map<number, string>()
  await Promise.all(
    sellerIds.map(async (id) => {
      const s = await fetchMeliSeller(id)
      if (s) sellerMap.set(id, s.nickname)
    })
  )

  const db = getDb()

  // Create or find group
  let group = db.prepare('SELECT id FROM product_groups WHERE name = ?').get(group_name) as { id: string } | undefined
  if (!group) {
    const groupId = newId()
    db.prepare(
      'INSERT INTO product_groups (id, name, reference_price, alert_threshold_pct) VALUES (?, ?, ?, ?)'
    ).run(groupId, group_name, reference_price ?? null, 5.0)
    group = { id: groupId }
  }

  const insertItem = db.prepare(
    `INSERT INTO tracked_items (id, meli_item_id, product_group_id, seller_nickname, seller_meli_id, title, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)
     ON CONFLICT(meli_item_id) DO UPDATE SET
       product_group_id=excluded.product_group_id,
       seller_nickname=excluded.seller_nickname,
       title=excluded.title,
       is_active=1`
  )
  const insertPrice = db.prepare(
    `INSERT INTO price_history (id, tracked_item_id, price, original_price, currency, available_quantity, condition)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )

  let imported = 0
  const doImport = db.transaction(() => {
    for (const [meliId, data] of Array.from(meliData.entries())) {
      const itemId = newId()
      insertItem.run(itemId, meliId, group!.id, sellerMap.get(data.seller_id) ?? null, data.seller_id, data.title)
      const item = db.prepare('SELECT id FROM tracked_items WHERE meli_item_id = ?').get(meliId) as { id: string }
      insertPrice.run(newId(), item.id, data.price, data.original_price ?? null, data.currency_id, data.available_quantity, data.condition)
      imported++
    }
  })

  doImport()

  return NextResponse.json({
    group_id: group.id,
    imported,
    total_found: listings.length,
    message: `Importados ${imported} sellers para "${group_name}"`,
  })
}
