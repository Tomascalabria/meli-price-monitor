/**
 * Test de conexión con la API de MercadoLibre
 * USO: node test-meli.mjs
 */

import { readFileSync, existsSync } from 'fs'

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
}

const APP_ID      = process.env.MELI_APP_ID
const APP_SECRET  = process.env.MELI_APP_SECRET
const REFRESH_TOK = process.env.MELI_REFRESH_TOKEN

// Productos reales a testear — catálogo IDs
const CATALOG_PRODUCTS = [
  { name: 'MX Master 4',  catalogId: 'MLA61214391' },
  { name: 'G432 Headset', catalogId: 'MLA15508986' },
  { name: 'MX Master 3S', catalogId: 'MLA19473530' },
]

async function getToken() {
  if (!APP_ID || !APP_SECRET) return null

  if (REFRESH_TOK) {
    const res = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: APP_ID,
        client_secret: APP_SECRET,
        refresh_token: REFRESH_TOK,
      }),
    })
    if (res.ok) { const d = await res.json(); return d.access_token }
  }

  const res = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: APP_ID,
      client_secret: APP_SECRET,
    }),
  })
  if (res.ok) { const d = await res.json(); return d.access_token }
  return null
}

async function test() {
  console.log('\n=== MELI Price Monitor — Test con productos reales ===\n')

  const token = await getToken()
  const h = token ? { Authorization: `Bearer ${token}` } : {}
  console.log(token ? '✅  Token OK\n' : '⚠️   Sin token — usando endpoints públicos\n')

  // ─── 1. Buscar por catalog_product_id (endpoint de búsqueda pública) ─────────
  console.log('─'.repeat(60))
  console.log('ESTRATEGIA A: /sites/MLA/search?catalog_product_id=...')
  console.log('(no requiere scopes especiales)')
  console.log('─'.repeat(60))

  for (const p of CATALOG_PRODUCTS) {
    const url = `https://api.mercadolibre.com/sites/MLA/search?catalog_product_id=${p.catalogId}&limit=10`
    const res = await fetch(url, { headers: h })
    const data = await res.json().catch(() => null)

    console.log(`\n📦  ${p.name} (${p.catalogId})`)
    if (res.ok && data?.results?.length) {
      console.log(`   ✅  ${data.results.length} items encontrados`)
      data.results.slice(0, 5).forEach((r, i) => {
        console.log(`   [${i+1}] id: ${r.id}  |  precio: $${r.price}  |  seller: ${r.seller?.id ?? r.seller_id ?? '?'}  |  ${r.title?.slice(0,40)}`)
      })
    } else {
      console.log(`   ❌  status ${res.status}`)
      if (data?.message) console.log(`   mensaje: ${data.message}`)
    }
  }

  // ─── 2. Buscar por texto (completamente público, sin auth) ───────────────────
  console.log('\n' + '─'.repeat(60))
  console.log('ESTRATEGIA B: /sites/MLA/search?q=... (100% público, sin token)')
  console.log('─'.repeat(60))

  const queries = ['logitech mx master 3s', 'logitech g432']
  for (const q of queries) {
    const url = `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(q)}&limit=5`
    const res = await fetch(url) // sin headers de auth
    const data = await res.json().catch(() => null)

    console.log(`\n🔍  Búsqueda: "${q}"`)
    if (res.ok && data?.results?.length) {
      console.log(`   ✅  ${data.paging?.total} resultados totales, mostrando ${data.results.length}`)
      data.results.slice(0, 3).forEach((r, i) => {
        console.log(`   [${i+1}] id: ${r.id}  |  precio: $${r.price}  |  seller: ${r.seller?.id}  |  ${r.title?.slice(0,45)}`)
      })
    } else {
      console.log(`   ❌  status ${res.status}`)
    }
  }

  // ─── 3. Multiget de items específicos (con token) ────────────────────────────
  const knownItems = ['MLA844362318', 'MLA1969623656']
  console.log('\n' + '─'.repeat(60))
  console.log('ESTRATEGIA C: /items?ids=... (multiget — necesita token)')
  console.log('─'.repeat(60))

  if (token) {
    const url = `https://api.mercadolibre.com/items?ids=${knownItems.join(',')}&attributes=id,title,price,currency_id,seller_id,available_quantity,condition`
    const res = await fetch(url, { headers: h })
    const data = await res.json().catch(() => null)

    if (res.ok && Array.isArray(data)) {
      data.forEach(entry => {
        if (entry.code === 200) {
          const b = entry.body
          console.log(`\n   ✅  ${b.id}`)
          console.log(`   título:  ${b.title}`)
          console.log(`   precio:  $${b.price} ${b.currency_id}`)
          console.log(`   seller:  ${b.seller_id}  |  qty: ${b.available_quantity}  |  ${b.condition}`)
        } else {
          console.log(`\n   ❌  ${entry.body?.id ?? '?'} → code ${entry.code}`)
          if (entry.body?.message) console.log(`   mensaje: ${entry.body.message}`)
        }
      })
    } else {
      console.log(`   ❌  status ${res.status}`)
      if (data?.message) console.log(`   mensaje: ${data.message}`)
    }
  } else {
    console.log('   ⚠️   Saltado — sin token')
  }

  // ─── 4. Buscar items de un seller específico ─────────────────────────────────
  console.log('\n' + '─'.repeat(60))
  console.log('ESTRATEGIA D: /sites/MLA/search?seller_id=... (con token)')
  console.log('Para usarla: necesitás el seller_id numérico del vendedor a monitorear.')
  console.log('─'.repeat(60))

  // Ejemplo con seller de MELI TEST (ajustar al seller real de la novia)
  if (token) {
    // Sacamos el seller_id del item que ya conocemos
    const itemRes = await fetch('https://api.mercadolibre.com/items/MLA1969623656?attributes=seller_id,title', { headers: h })
    const itemData = await itemRes.json().catch(() => null)
    if (itemRes.ok && itemData?.seller_id) {
      const sellerId = itemData.seller_id
      console.log(`\n   seller_id del MX Master 3S: ${sellerId}`)
      const sellerUrl = `https://api.mercadolibre.com/sites/MLA/search?seller_id=${sellerId}&limit=5`
      const sellerRes = await fetch(sellerUrl, { headers: h })
      const sellerData = await sellerRes.json().catch(() => null)
      if (sellerRes.ok && sellerData?.results?.length) {
        console.log(`   ✅  ${sellerData.paging?.total} items activos del seller`)
        sellerData.results.slice(0, 3).forEach((r, i) => {
          console.log(`   [${i+1}] ${r.id}  |  $${r.price}  |  ${r.title?.slice(0,40)}`)
        })
      } else {
        console.log(`   ❌  status ${sellerRes.status}`)
        if (sellerData?.message) console.log(`   mensaje: ${sellerData.message}`)
      }
    } else {
      console.log(`\n   ❌  No se pudo obtener seller_id (status ${itemRes.status})`)
    }
  } else {
    console.log('   ⚠️   Saltado — sin token')
  }

  // ─── Resumen ─────────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60))
  console.log('RESUMEN DE ESTRATEGIAS')
  console.log('─'.repeat(60))
  console.log('A. catalog_product_id → todos los sellers de ese producto (mejor opción)')
  console.log('B. búsqueda por texto → no necesita auth, pero resultados menos exactos')
  console.log('C. multiget ids      → precios exactos por item conocido (necesita token)')
  console.log('D. seller_id         → todos los items de un seller puntual')
  console.log()
  console.log('Recomendación: usar A para descubrir items y C para scrape de precios.')
  console.log()
}

test().catch(console.error)
