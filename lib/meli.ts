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

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}
