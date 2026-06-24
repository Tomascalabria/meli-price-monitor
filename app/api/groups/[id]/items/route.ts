import { NextResponse } from 'next/server'
import { getDb, newId } from '@/lib/db'
import { fetchMeliItem, fetchMeliSeller } from '@/lib/meli'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const db = getDb()
  const body = await req.json()
  const { meli_item_id, notes } = body

  if (!meli_item_id) return NextResponse.json({ error: 'meli_item_id is required' }, { status: 400 })

  const meliData = await fetchMeliItem(meli_item_id.toUpperCase())
  if (!meliData) return NextResponse.json({ error: 'Item not found in MercadoLibre' }, { status: 404 })

  const seller = await fetchMeliSeller(meliData.seller_id)
  const itemId = newId()

  db.prepare(
    `INSERT INTO tracked_items (id, meli_item_id, product_group_id, seller_nickname, seller_meli_id, title, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(itemId, meliData.id, params.id, seller?.nickname ?? null, meliData.seller_id, meliData.title, notes ?? null)

  db.prepare(
    `INSERT INTO price_history (id, tracked_item_id, price, original_price, currency, available_quantity, condition)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(newId(), itemId, meliData.price, meliData.original_price ?? null, meliData.currency_id, meliData.available_quantity, meliData.condition)

  return NextResponse.json(db.prepare('SELECT * FROM tracked_items WHERE id = ?').get(itemId), { status: 201 })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const db = getDb()
  const { searchParams } = new URL(req.url)
  const itemId = searchParams.get('item_id')

  if (!itemId) return NextResponse.json({ error: 'item_id required' }, { status: 400 })

  db.prepare(
    'UPDATE tracked_items SET is_active = 0 WHERE id = ? AND product_group_id = ?'
  ).run(itemId, params.id)

  return new Response(null, { status: 204 })
}
