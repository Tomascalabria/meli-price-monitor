import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { fetchMeliItemsBatch, fetchMeliSeller } from '@/lib/meli'
import type { ImportRow, ImportJsonGroup } from '@/lib/types'

export async function POST(req: Request) {
  const supabase = createServerClient()
  const body = await req.json()
  const { rows, format } = body as { rows: ImportRow[] | ImportJsonGroup[]; format: 'csv' | 'json' }

  // Normalize to ImportRow[]
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

  if (normalized.length === 0) {
    return NextResponse.json({ error: 'No rows to import' }, { status: 400 })
  }

  // Deduplicate group names and create/find groups
  const groupNames = Array.from(new Set(normalized.map((r) => r.group_name.trim())))
  const groupMap = new Map<string, string>() // name -> id

  for (const name of groupNames) {
    const sampleRow = normalized.find((r) => r.group_name.trim() === name)

    const { data: existing } = await supabase
      .from('product_groups')
      .select('id')
      .eq('name', name)
      .maybeSingle()

    if (existing) {
      groupMap.set(name, existing.id)
    } else {
      const { data: created } = await supabase
        .from('product_groups')
        .insert({
          name,
          reference_price: sampleRow?.reference_price
            ? parseFloat(sampleRow.reference_price)
            : null,
          alert_threshold_pct: sampleRow?.alert_threshold_pct
            ? parseFloat(sampleRow.alert_threshold_pct)
            : 5.0,
        })
        .select('id')
        .single()

      if (created) groupMap.set(name, created.id)
    }
  }

  // Batch fetch MELI data
  const allMeliIds = normalized.map((r) => r.meli_item_id.toUpperCase())
  const meliData = await fetchMeliItemsBatch(allMeliIds)

  // Fetch seller nicknames for unique seller ids
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

  for (const row of normalized) {
    const meliId = row.meli_item_id.toUpperCase()
    const groupId = groupMap.get(row.group_name.trim())

    if (!groupId) {
      errors.push(`Could not create/find group: ${row.group_name}`)
      skipped++
      continue
    }

    const data = meliData.get(meliId)
    if (!data) {
      errors.push(`Item not found in MELI: ${meliId}`)
      skipped++
      continue
    }

    // Upsert tracked item
    const { data: item, error: itemError } = await supabase
      .from('tracked_items')
      .upsert(
        {
          meli_item_id: meliId,
          product_group_id: groupId,
          seller_nickname: sellerMap.get(data.seller_id) ?? null,
          seller_meli_id: data.seller_id,
          title: data.title,
          notes: row.notes ?? null,
          is_active: true,
        },
        { onConflict: 'meli_item_id' }
      )
      .select('id')
      .single()

    if (itemError) {
      errors.push(`Error saving ${meliId}: ${itemError.message}`)
      skipped++
      continue
    }

    // Store initial price snapshot
    await supabase.from('price_history').insert({
      tracked_item_id: item.id,
      price: data.price,
      original_price: data.original_price,
      currency: data.currency_id,
      available_quantity: data.available_quantity,
      condition: data.condition,
    })

    imported++
  }

  return NextResponse.json({ imported, skipped, errors })
}
