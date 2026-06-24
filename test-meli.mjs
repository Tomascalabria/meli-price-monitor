/**
 * Test de conexión con la API de MercadoLibre
 * USO: node test-meli.mjs [ITEM_ID]
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

// Item del link compartido (catálogo) y un item público normal como fallback
const CATALOG_PRODUCT_ID = 'MLA37106988'
const ITEM_ID = process.argv[2] ?? 'MLA1670651449'
// Items de prueba con acceso público conocido
const FALLBACK_ITEMS = ['MLA1968490983', 'MLA2052005918']

async function getToken() {
  if (!APP_ID || !APP_SECRET) return null

  // Intentar con refresh token primero
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

  // Fallback: client_credentials
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

async function fetchJson(url, headers) {
  const res = await fetch(url, { headers })
  return { status: res.status, ok: res.ok, body: await res.json().catch(() => null) }
}

async function test() {
  console.log('\n=== MELI API Test ===\n')

  const token = await getToken()
  if (!token) {
    console.log('❌  No se pudo obtener token. Corré: node setup-meli-auth.mjs')
    return
  }
  console.log('✅  Token OK\n')
  const h = { Authorization: `Bearer ${token}` }

  // 1. Intentar el item del link (puede dar 403 si es catálogo restringido)
  console.log(`1️⃣  GET /items/${ITEM_ID}`)
  const r1 = await fetchJson(`https://api.mercadolibre.com/items/${ITEM_ID}`, h)
  console.log('   Status:', r1.status)
  if (r1.ok) {
    console.log('   ✅ título:', r1.body.title)
    console.log('   precio:  $', r1.body.price, r1.body.currency_id)
    console.log('   seller:  ', r1.body.seller_id)
  } else {
    console.log('   ⚠️  Este item específico requiere permiso especial de catálogo.')
    console.log('   Probando con items públicos alternativos...')
  }

  // 2. Endpoint de producto/catálogo — trae TODOS los sellers del mismo producto
  console.log(`\n2️⃣  GET /products/${CATALOG_PRODUCT_ID}/items (todos los sellers del producto)`)
  const r2 = await fetchJson(`https://api.mercadolibre.com/products/${CATALOG_PRODUCT_ID}/items`, h)
  console.log('   Status:', r2.status)
  if (r2.ok) {
    const results = r2.body?.results ?? []
    console.log(`   ✅ ${results.length} sellers encontrados:`)
    results.slice(0, 5).forEach((r, i) =>
      console.log(`   [${i+1}] id: ${r.id} | precio: $${r.price} | seller: ${r.seller_id}`)
    )
    if (results.length > 5) console.log(`   ... y ${results.length - 5} más`)
  } else {
    console.log('   body:', JSON.stringify(r2.body))
  }

  // 3. Buscar por seller (si tenemos un seller_id del item 1 o del catálogo)
  console.log(`\n3️⃣  GET /sites/MLA/search?seller_id=... (publicaciones de un seller)`)
  // Usar seller del resultado de catálogo o un seller de prueba
  const sampleSellerId = r2.ok ? r2.body?.results?.[0]?.seller_id : null
  if (sampleSellerId) {
    const r3 = await fetchJson(
      `https://api.mercadolibre.com/sites/MLA/search?seller_id=${sampleSellerId}&limit=3`,
      h
    )
    console.log('   Status:', r3.status)
    if (r3.ok) {
      const items = r3.body?.results ?? []
      console.log(`   ✅ ${r3.body?.paging?.total} publicaciones del seller ${sampleSellerId}`)
      items.slice(0, 3).forEach((it, i) =>
        console.log(`   [${i+1}] ${it.id} | $${it.price} | ${it.title?.slice(0, 40)}`)
      )
    }
  } else {
    console.log('   (saltado — no hay seller_id disponible)')
  }

  // 4. Probar items públicos alternativos (batch)
  console.log(`\n4️⃣  GET /items?ids=... (batch con items públicos de prueba)`)
  const batchIds = FALLBACK_ITEMS.join(',')
  const r4 = await fetchJson(`https://api.mercadolibre.com/items?ids=${batchIds}`, h)
  console.log('   Status:', r4.status)
  if (Array.isArray(r4.body)) {
    for (const entry of r4.body) {
      const ok = entry.code === 200
      console.log(
        `   ${ok ? '✅' : '❌'} ${entry.body?.id ?? '?'} | code: ${entry.code}`,
        ok ? `| $${entry.body.price} | ${entry.body.title?.slice(0, 40)}` : ''
      )
    }
  }

  console.log('\n─────────────────────────────────────────')
  const apiWorks = r2.ok || (Array.isArray(r4.body) && r4.body.some(e => e.code === 200))
  if (apiWorks) {
    console.log('✅  API funciona. El bot puede trackear precios.')
    console.log('   → El item del link original (MLA1670651449) es un catálogo privado.')
    console.log('   → Usá los item IDs individuales de cada seller (los que aparecen en paso 2).')
  } else {
    console.log('❌  Algo no funciona. Revisá los scopes de la app en developers.mercadolibre.com.ar')
  }
  console.log()
}

test().catch(console.error)
