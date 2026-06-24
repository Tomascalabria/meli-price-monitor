import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient()

  // Get all active tracked items for this group
  const { data: items } = await supabase
    .from('tracked_items')
    .select('id')
    .eq('product_group_id', params.id)
    .eq('is_active', true)

  if (!items || items.length === 0) return NextResponse.json([])

  const itemIds = items.map((i) => i.id)

  // Fetch last 7 days of price history
  const since = new Date()
  since.setDate(since.getDate() - 7)

  const { data: history, error } = await supabase
    .from('price_history')
    .select('tracked_item_id, price, snapshot_at')
    .in('tracked_item_id', itemIds)
    .gte('snapshot_at', since.toISOString())
    .order('snapshot_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(history ?? [])
}
