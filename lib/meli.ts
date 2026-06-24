import type { MeliItemResponse } from './types'
import { getMeliToken } from './meli-auth'

const MELI_API = 'https://api.mercadolibre.com'

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getMeliToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function fetchMeliItem(itemId: string): Promise<MeliItemResponse | null> {
  try {
    const res = await fetch(`${MELI_API}/items/${itemId}`, {
      headers: await authHeaders(),
      next: { revalidate: 0 },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function fetchMeliItemsBatch(
  itemIds: string[]
): Promise<Map<string, MeliItemResponse>> {
  const result = new Map<string, MeliItemResponse>()
  const headers = await authHeaders()
  const chunks = chunkArray(itemIds, 20)

  for (const chunk of chunks) {
    try {
      const ids = chunk.join(',')
      const res = await fetch(`${MELI_API}/items?ids=${ids}`, {
        headers,
        next: { revalidate: 0 },
      })
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

export async function fetchMeliDescription(itemId: string): Promise<string | null> {
  try {
    const res = await fetch(`${MELI_API}/items/${itemId}/description`, {
      headers: await authHeaders(),
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    const data = await res.json()
    return (data.plain_text as string | null) ?? null
  } catch {
    return null
  }
}

export async function fetchMeliSeller(sellerId: number) {
  try {
    const res = await fetch(`${MELI_API}/users/${sellerId}`, {
      headers: await authHeaders(),
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    const data = await res.json()
    return { id: data.id as number, nickname: data.nickname as string }
  } catch {
    return null
  }
}

export async function fetchCatalogItems(
  productId: string
): Promise<Array<{ id: string; price: number; seller_id: number }>> {
  // Primary: search endpoint — doesn't require catalog-level scopes (no 403 PolicyAgent)
  const results = await fetchCatalogItemsViaSearch(productId)
  if (results.length > 0) return results

  // Fallback: direct catalog endpoint (requires read_catalog_products scope)
  try {
    const res = await fetch(`${MELI_API}/products/${productId}/items`, {
      headers: await authHeaders(),
      next: { revalidate: 0 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.results ?? []) as Array<{ id: string; price: number; seller_id: number }>
  } catch {
    return []
  }
}

async function fetchCatalogItemsViaSearch(
  productId: string
): Promise<Array<{ id: string; price: number; seller_id: number }>> {
  try {
    const url = `${MELI_API}/sites/MLA/search?catalog_product_id=${productId}&limit=50`
    const res = await fetch(url, {
      headers: await authHeaders(),
      next: { revalidate: 0 },
    })
    if (!res.ok) return []
    const data = await res.json()
    const items = (data.results ?? []) as Array<{
      id: string
      price: number
      seller?: { id: number }
      seller_id?: number
    }>
    return items.map((r) => ({
      id: r.id,
      price: r.price,
      seller_id: r.seller?.id ?? r.seller_id ?? 0,
    }))
  } catch {
    return []
  }
}

export async function searchItemsBySeller(
  sellerId: number,
  query?: string
): Promise<Array<{ id: string; price: number; title: string }>> {
  try {
    const params = new URLSearchParams({ seller_id: String(sellerId), limit: '50' })
    if (query) params.set('q', query)
    const res = await fetch(`${MELI_API}/sites/MLA/search?${params}`, {
      headers: await authHeaders(),
      next: { revalidate: 0 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.results ?? []).map((r: { id: string; price: number; title: string }) => ({
      id: r.id,
      price: r.price,
      title: r.title,
    }))
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
