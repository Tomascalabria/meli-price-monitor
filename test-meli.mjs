/**
 * Test de conexión con la API de MercadoLibre
 *
 * SETUP (1 vez):
 *   1. Copiá .env.example a .env.local
 *   2. Entrá a https://developers.mercadolibre.com.ar/ y creá una app (gratis)
 *   3. Pegá el App ID y Secret Key en .env.local
 *
 * USO:
 *   node test-meli.mjs                    → usa MLA1670651449 por defecto
 *   node test-meli.mjs MLA123456789       → item específico
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

// Cargar .env.local si existe
try {
  const env = readFileSync(resolve('.env.local'), 'utf8')
  for (const line of env.split('\n')) {
    const [key, ...rest] = line.split('=')
    if (key && rest.length && !key.startsWith('#')) {
      process.env[key.trim()] = rest.join('=').trim()
    }
  }
} catch { /* .env.local no existe todavía */ }

const ITEM_ID = process.argv[2] ?? 'MLA1670651449'
const APP_ID = process.env.MELI_APP_ID
const APP_SECRET = process.env.MELI_APP_SECRET

async function getToken() {
  if (!APP_ID || !APP_SECRET) return null
  const res = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: APP_ID,
      client_secret: APP_SECRET,
    }),
  })
  if (!res.ok) { console.error('  ❌ Error obteniendo token:', await res.text()); return null }
  const data = await res.json()
  return data.access_token
}

async function test() {
  console.log(`\n=== MELI API Test — Item: ${ITEM_ID} ===\n`)

  // 0. Auth
  if (!APP_ID || !APP_SECRET) {
    console.log('⚠️  Sin credenciales MELI. Algunas requests pueden dar 403.')
    console.log('   → Creá .env.local con MELI_APP_ID y MELI_APP_SECRET')
    console.log('   → https://developers.mercadolibre.com.ar/\n')
  } else {
    console.log('🔑  Obteniendo token OAuth...')
    const token = await getToken()
    if (token) {
      console.log('   ✅ Token OK\n')
    } else {
      console.log('   ❌ No se pudo obtener token. Revisá las credenciales.\n')
      return
    }
  }

  const token = APP_ID && APP_SECRET ? await getToken() : null
  const headers = token ? { Authorization: `Bearer ${token}` } : {}

  // 1. Item básico
  console.log('1️⃣  GET /items/:id')
  const itemRes = await fetch(`https://api.mercadolibre.com/items/${ITEM_ID}`, { headers })
  console.log('   Status:', itemRes.status)

  if (!itemRes.ok) {
    const err = await itemRes.text()
    console.error('   ❌ Error:', err)
    return
  }

  const item = await itemRes.json()
  console.log('   title:             ', item.title)
  console.log('   price:             ', item.price, item.currency_id)
  console.log('   original_price:    ', item.original_price)
  console.log('   condition:         ', item.condition)
  console.log('   available_quantity:', item.available_quantity)
  console.log('   seller_id:         ', item.seller_id)
  console.log('   thumbnail:         ', item.thumbnail)

  // 2. Descripción
  console.log('\n2️⃣  GET /items/:id/description')
  const descRes = await fetch(`https://api.mercadolibre.com/items/${ITEM_ID}/description`, { headers })
  console.log('   Status:', descRes.status)
  if (descRes.ok) {
    const desc = await descRes.json()
    const preview = desc.plain_text?.replace(/\n+/g, ' ').trim().slice(0, 250)
    console.log('   descripción:', preview ? `"${preview}..."` : '(vacía)')
  }

  // 3. Seller
  console.log('\n3️⃣  GET /users/:seller_id')
  const sellerRes = await fetch(`https://api.mercadolibre.com/users/${item.seller_id}`, { headers })
  console.log('   Status:', sellerRes.status)
  if (sellerRes.ok) {
    const s = await sellerRes.json()
    console.log('   nickname:        ', s.nickname)
    console.log('   reputation:      ', s.seller_reputation?.level_id ?? 'N/A')
    console.log('   transacciones:   ', s.seller_reputation?.transactions?.total ?? 'N/A')
  }

  // 4. Batch
  console.log('\n4️⃣  GET /items?ids=... (batch — así trabaja el bot)')
  const batchRes = await fetch(`https://api.mercadolibre.com/items?ids=${ITEM_ID}`, { headers })
  const batch = await batchRes.json()
  const first = batch[0]
  console.log('   code:', first?.code, '| price:', first?.body?.price, first?.body?.currency_id)

  // 5. Catálogo — todos los sellers del mismo producto
  const CATALOG_ID = 'MLA37106988'
  console.log(`\n5️⃣  GET /products/${CATALOG_ID}/items (todos los sellers)`)
  const catalogRes = await fetch(`https://api.mercadolibre.com/products/${CATALOG_ID}/items`, { headers })
  console.log('   Status:', catalogRes.status)
  if (catalogRes.ok) {
    const catalog = await catalogRes.json()
    const results = catalog.results ?? []
    console.log(`   Total sellers encontrados: ${results.length}`)
    results.slice(0, 5).forEach((r, i) => {
      console.log(`   [${i+1}] id: ${r.id} | price: $${r.price} | seller: ${r.seller_id}`)
    })
    if (results.length > 5) console.log(`   ... y ${results.length - 5} más`)
  }

  console.log('\n✅  Test completo.\n')
}

test().catch(console.error)
