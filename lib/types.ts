export interface ProductGroup {
  id: string
  name: string
  description: string | null
  reference_price: number | null
  alert_threshold_pct: number
  created_at: string
}

export interface TrackedItem {
  id: string
  meli_item_id: string
  product_group_id: string
  seller_nickname: string | null
  seller_meli_id: number | null
  title: string | null
  is_active: boolean
  notes: string | null
  created_at: string
}

export interface PriceSnapshot {
  id: string
  tracked_item_id: string
  price: number
  original_price: number | null
  currency: string
  available_quantity: number | null
  condition: string | null
  snapshot_at: string
}

export interface TrackedItemWithLatestPrice extends TrackedItem {
  latest_price: number | null
  previous_price: number | null
  latest_snapshot_at: string | null
  price_change_pct: number | null
}

export interface ProductGroupWithStats extends ProductGroup {
  item_count: number
  min_price: number | null
  max_price: number | null
  avg_price: number | null
  alert_count: number
  items?: TrackedItemWithLatestPrice[]
}

export interface MeliItemResponse {
  id: string
  title: string
  price: number
  original_price: number | null
  currency_id: string
  available_quantity: number
  condition: string
  seller_id: number
  seller?: {
    id: number
    nickname: string
  }
  thumbnail: string
}

export interface ImportRow {
  group_name: string
  meli_item_id: string
  notes?: string
  reference_price?: string
  alert_threshold_pct?: string
}

export interface ImportJsonGroup {
  group_name: string
  reference_price?: number
  alert_threshold_pct?: number
  description?: string
  items: Array<{
    meli_item_id: string
    notes?: string
  }>
}
