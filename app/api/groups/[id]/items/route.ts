import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { fetchMeliItem, fetchMeliSeller } from '@/lib/meli'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const body = await req.json()
  const { meli_item_id, notes } = body

  if (!meli_item_id) {
    return NextResponse.json({ error: 'meli_item_id is required' }, { status: 400 })
  }

  // Fetch item info from MELI
  const meliData = await fetchMeliItem(meli_item_id.toUpperCase())
  if (!meliData) {
    return NextResponse.json({ error: 'Item not found in MercadoLibre' }, { status: 404 })
  }

  // Fetch seller nickname
  const seller = await fetchMeliSeller(meliData.seller_id)

  const { data: item, error } = await supabase
    .from('tracked_items')
    .insert({
      meli_item_id: meliData.id,
      product_group_id: params.id,
      seller_nickname: seller?.nickname ?? null,
      seller_meli_id: meliData.seller_id,
      title: meliData.title,
      notes: notes ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Store initial price snapshot
  await supabase.from('price_history').insert({
    tracked_item_id: item.id,
    price: meliData.price,
    original_price: meliData.original_price,
    currency: meliData.currency_id,
    available_quantity: meliData.available_quantity,
    condition: meliData.condition,
  })

  return NextResponse.json(item, { status: 201 })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const { searchParams } = new URL(req.url)
  const itemId = searchParams.get('item_id')

  if (!itemId) return NextResponse.json({ error: 'item_id required' }, { status: 400 })

  const { error } = await supabase
    .from('tracked_items')
    .update({ is_active: false })
    .eq('id', itemId)
    .eq('product_group_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
