import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _browserClient: SupabaseClient | null = null

// Client for use in browser (Client Components) — created lazily
export function getSupabaseBrowser(): SupabaseClient {
  if (!_browserClient) {
    _browserClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return _browserClient
}

// Client for use in server (API Routes, Server Components) — new instance per call, bypasses RLS
export function createServerClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
