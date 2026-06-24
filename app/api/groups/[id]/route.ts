import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient()

  const { data: group, error } = await supabase
    .from('product_groups')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  const { data: items } = await supabase
    .from('tracked_items')
    .select('*')
    .eq('product_group_id', params.id)
    .order('created_at', { ascending: true })

  const activeItemIds = (items ?? [])
    .filter((i) => i.is_active)
    .map((i) => i.id)

  const { data: latestPrices } = await supabase
    .from('latest_prices')
    .select('*')
    .in('tracked_item_id', activeItemIds)

  const { data: prevPrices } = await supabase
    .from('previous_prices')
    .select('*')
    .in('tracked_item_id', activeItemIds)

  const latestMap = new Map((latestPrices ?? []).map((p) => [p.tracked_item_id, p]))
  const prevMap = new Map((prevPrices ?? []).map((p) => [p.tracked_item_id, p]))

  const itemsWithPrices = (items ?? []).map((item) => {
    const latest = latestMap.get(item.id)
    const prev = prevMap.get(item.id)
    const price_change_pct =
      latest && prev && prev.price > 0
        ? ((latest.price - prev.price) / prev.price) * 100
        : null

    return {
      ...item,
      latest_price: latest?.price ?? null,
      previous_price: prev?.price ?? null,
      latest_snapshot_at: latest?.snapshot_at ?? null,
      price_change_pct,
    }
  })

  return NextResponse.json({ ...group, items: itemsWithPrices })
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('product_groups')
    .update({
      name: body.name,
      description: body.description ?? null,
      reference_price: body.reference_price ?? null,
      alert_threshold_pct: body.alert_threshold_pct ?? 5.0,
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient()

  const { error } = await supabase
    .from('product_groups')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
