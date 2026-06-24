import type { MeliItemResponse } from './types'

const MELI_API = 'https://api.mercadolibre.com'

export async function fetchMeliItem(itemId: string): Promise<MeliItemResponse | null> {
  try {
    const res = await fetch(`${MELI_API}/items/${itemId}`, {
      next: { revalidate: 0 },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// Batch fetch up to 20 items at once using MELI's multi-get endpoint
export async function fetchMeliItemsBatch(
  itemIds: string[]
): Promise<Map<string, MeliItemResponse>> {
  const result = new Map<string, MeliItemResponse>()
  const chunks = chunkArray(itemIds, 20)

  for (const chunk of chunks) {
    try {
      const ids = chunk.join(',')
      const res = await fetch(`${MELI_API}/items?ids=${ids}`, {
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

export async function fetchMeliSeller(sellerId: number) {
  try {
    const res = await fetch(`${MELI_API}/users/${sellerId}`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    const data = await res.json()
    return { id: data.id as number, nickname: data.nickname as string }
  } catch {
    return null
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}
