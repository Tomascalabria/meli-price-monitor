import type { MeliItemResponse } from './types'

const MELI_API = 'https://api.mercadolibre.com'

export async function fetchMeliItem(itemId: string): Promise<MeliItemResponse | null> {
  try {
    const res = await fetch(`${MELI_API}/items/${itemId}`, { next: { revalidate: 0 } })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// Batch fetch up to 20 items at once
export async function fetchMeliItemsBatch(
  itemIds: string[]
): Promise<Map<string, MeliItemResponse>> {
  const result = new Map<string, MeliItemResponse>()
  const chunks = chunkArray(itemIds, 20)

  for (const chunk of chunks) {
    try {
      const ids = chunk.join(',')
      const res = await fetch(`${MELI_API}/items?ids=${ids}`, { next: { revalidate: 0 } })
      if (!res.ok) continue

      const data: Array<{ code: number; body: MeliItemResponse }> = await res.json()
      for (const entry of data) {
        if (entry.code === 200 && entry.body) {
          result.set(entry.body.id, entry.body)
        }
      }
    } catch {
      // continue with remaining chunks
    }
  }

  return result
}

// Fetch plain-text description for a single item
export async function fetchMeliDescription(itemId: string): Promise<string | null> {
  try {
    const res = await fetch(`${MELI_API}/items/${itemId}/description`, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    const data = await res.json()
    return (data.plain_text as string | null) ?? null
  } catch {
    return null
  }
}

export async function fetchMeliSeller(sellerId: number) {
  try {
    const res = await fetch(`${MELI_API}/users/${sellerId}`, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    const data = await res.json()
    return { id: data.id as number, nickname: data.nickname as string }
  } catch {
    return null
  }
}

// Fetch all seller listings for a catalog product ID (e.g. MLA37106988)
// Returns up to 50 listings so you can auto-discover all sellers of the same product
export async function fetchCatalogItems(
  productId: string
): Promise<Array<{ id: string; price: number; seller_id: number }>> {
  try {
    const res = await fetch(`${MELI_API}/products/${productId}/items`, { next: { revalidate: 0 } })
    if (!res.ok) return []
    const data = await res.json()
    return (data.results ?? []) as Array<{ id: string; price: number; seller_id: number }>
  } catch {
    return []
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}
