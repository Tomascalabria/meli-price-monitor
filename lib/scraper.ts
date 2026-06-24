import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { fetchMeliItemsBatch } from '@/lib/meli'

export async function runScrape() {
  const supabase = createServerClient()

  const { data: items, error } = await supabase
    .from('tracked_items')
    .select('id, meli_item_id')
    .eq('is_active', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!items || items.length === 0) {
    return NextResponse.json({ scraped: 0, message: 'No active items to scrape' })
  }

  const itemIds = items.map((i) => i.meli_item_id)
  const meliData = await fetchMeliItemsBatch(itemIds)

  const idMap = new Map(items.map((i) => [i.meli_item_id, i.id]))

  const snapshots = []

  for (const [meliId, data] of Array.from(meliData.entries())) {
    const trackedId = idMap.get(meliId)
    if (!trackedId) continue

    snapshots.push({
      tracked_item_id: trackedId,
      price: data.price,
      original_price: data.original_price,
      currency: data.currency_id,
      available_quantity: data.available_quantity,
      condition: data.condition,
    })
  }

  if (snapshots.length > 0) {
    await supabase.from('price_history').insert(snapshots)
  }

  return NextResponse.json({
    scraped: snapshots.length,
    total: items.length,
    failed: items.length - snapshots.length,
    timestamp: new Date().toISOString(),
  })
}
