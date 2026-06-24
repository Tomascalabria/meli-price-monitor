import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET() {
  const supabase = createServerClient()

  const { data: groups, error } = await supabase
    .from('product_groups')
    .select(`
      *,
      tracked_items!inner(
        id,
        meli_item_id,
        seller_nickname,
        title,
        is_active
      )
    `)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with latest price stats per group
  const groupsWithStats = await Promise.all(
    (groups ?? []).map(async (group) => {
      const itemIds = group.tracked_items
        .filter((i: { is_active: boolean }) => i.is_active)
        .map((i: { id: string }) => i.id)

      if (itemIds.length === 0) {
        return { ...group, min_price: null, max_price: null, avg_price: null, alert_count: 0 }
      }

      const { data: prices } = await supabase
        .from('latest_prices')
        .select('price')
        .in('tracked_item_id', itemIds)

      const priceValues = (prices ?? []).map((p: { price: number }) => p.price)

      if (priceValues.length === 0) {
        return { ...group, min_price: null, max_price: null, avg_price: null, alert_count: 0 }
      }

      const min_price = Math.min(...priceValues)
      const max_price = Math.max(...priceValues)
      const avg_price = priceValues.reduce((a: number, b: number) => a + b, 0) / priceValues.length

      const threshold = group.alert_threshold_pct / 100
      const ref = group.reference_price ?? avg_price
      const alert_count = priceValues.filter(
        (p: number) => Math.abs(p - ref) / ref > threshold
      ).length

      return {
        ...group,
        item_count: itemIds.length,
        min_price,
        max_price,
        avg_price,
        alert_count,
      }
    })
  )

  return NextResponse.json(groupsWithStats)
}

export async function POST(req: Request) {
  const supabase = createServerClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('product_groups')
    .insert({
      name: body.name,
      description: body.description ?? null,
      reference_price: body.reference_price ?? null,
      alert_threshold_pct: body.alert_threshold_pct ?? 5.0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
