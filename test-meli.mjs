/**
 * Test de conexión con la API de MercadoLibre
 * No requiere ninguna dependencia extra — solo Node.js
 *
 * USO:
 *   node test-meli.mjs                 → usa MLA1670651449 por defecto
 *   node test-meli.mjs MLA123456789    → item específico
 */

import { readFileSync, existsSync } from 'fs'

// Leer .env.local sin dependencias (maneja Windows \r\n y Unix \n)
if (existsSync('.env.local')) {
  const lines = readFileSync('.env.local', 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim()
    if (key) process.env[key] = value
  }
}

const ITEM_ID = process.argv[2] ?? 'MLA1670651449'
const APP_ID = process.env.MELI_APP_ID
const APP_SECRET = process.env.MELI_APP_SECRET

async function getToken() {
  const res = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: APP_ID,
      client_secret: APP_SECRET,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    console.error('  ❌ Error obteniendo token:', err.message ?? JSON.stringify(err))
    return null
  }
  const data = await res.json()
  return data.access_token
}

async function test() {
  console.log(`\n=== MELI API Test — Item: ${ITEM_ID} ===\n`)

  if (!APP_ID || !APP_SECRET) {
    console.log('❌  Credenciales no encontradas en .env.local')
    console.log('    Asegurate de que el archivo tiene:')
    console.log('      MELI_APP_ID=tu_app_id')
    console.log('      MELI_APP_SECRET=tu_secret_key\n')
    return
  }

  console.log(`🔑  App ID: ${APP_ID}`)
  console.log('    Obteniendo token...')
  const token = await getToken()
  if (!token) return
  console.log('    ✅ Token OK\n')

  const h = { Authorization: `Bearer ${token}` }

  // 1. Item
  console.log('1️⃣  GET /items/:id')
  const itemRes = await fetch(`https://api.mercadolibre.com/items/${ITEM_ID}`, { headers: h })
  console.log('   Status:', itemRes.status)
  if (!itemRes.ok) { console.error('   ❌', await itemRes.text()); return }

  const item = await itemRes.json()
  console.log('   title:             ', item.title)
  console.log('   price:            $', item.price, item.currency_id)
  console.log('   original_price:   $', item.original_price)
  console.log('   condition:         ', item.condition)
  console.log('   available_quantity:', item.available_quantity)
  console.log('   seller_id:         ', item.seller_id)

  // 2. Descripción
  console.log('\n2️⃣  GET /items/:id/description')
  const descRes = await fetch(`https://api.mercadolibre.com/items/${ITEM_ID}/description`, { headers: h })
  console.log('   Status:', descRes.status)
  if (descRes.ok) {
    const desc = await descRes.json()
    const preview = desc.plain_text?.replace(/\s+/g, ' ').trim().slice(0, 250)
    console.log('   descripción:', preview ? `"${preview}..."` : '(vacía)')
  }

  // 3. Seller
  console.log('\n3️⃣  GET /users/:seller_id')
  const sellerRes = await fetch(`https://api.mercadolibre.com/users/${item.seller_id}`, { headers: h })
  console.log('   Status:', sellerRes.status)
  if (sellerRes.ok) {
    const s = await sellerRes.json()
    console.log('   nickname:      ', s.nickname)
    console.log('   reputation:    ', s.seller_reputation?.level_id ?? 'N/A')
    console.log('   transacciones: ', s.seller_reputation?.transactions?.total ?? 'N/A')
  }

  // 4. Batch
  console.log('\n4️⃣  GET /items?ids=... (batch)')
  const batchRes = await fetch(`https://api.mercadolibre.com/items?ids=${ITEM_ID}`, { headers: h })
  const batch = await batchRes.json()
  const first = batch[0]
  console.log('   code:', first?.code, '| price: $', first?.body?.price, first?.body?.currency_id)

  // 5. Todos los sellers del mismo producto
  const CATALOG_ID = 'MLA37106988'
  console.log(`\n5️⃣  GET /products/${CATALOG_ID}/items (todos los sellers)`)
  const catalogRes = await fetch(`https://api.mercadolibre.com/products/${CATALOG_ID}/items`, { headers: h })
  console.log('   Status:', catalogRes.status)
  if (catalogRes.ok) {
    const catalog = await catalogRes.json()
    const results = catalog.results ?? []
    console.log(`   Total sellers: ${results.length}`)
    results.slice(0, 5).forEach((r, i) => {
      console.log(`   [${i+1}] id: ${r.id} | price: $${r.price}`)
    })
    if (results.length > 5) console.log(`   ... y ${results.length - 5} más`)
  }

  console.log('\n✅  API OK — el bot puede trackear estos items.\n')
}

test().catch(console.error)
