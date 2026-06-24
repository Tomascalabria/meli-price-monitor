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

// Productos reales a testear
const PRODUCTS = [
  { name: 'MX Master 4',  catalogId: 'MLA61214391', itemId: null },
  { name: 'G432 Headset', catalogId: 'MLA15508986', itemId: 'MLA844362318' },
  { name: 'MX Master 3S', catalogId: 'MLA19473530', itemId: 'MLA1969623656' },
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
  if (!token) { console.log('❌  Sin token. Corré: node setup-meli-auth.mjs'); return }
  console.log('✅  Token OK\n')
  const h = { Authorization: `Bearer ${token}` }

  for (const product of PRODUCTS) {
    console.log(`\n${'─'.repeat(55)}`)
    console.log(`📦  ${product.name}  (catálogo: ${product.catalogId})`)
    console.log('─'.repeat(55))

    // A. Endpoint de catálogo → trae todos los sellers con precio
    const catalogRes = await fetch(
      `https://api.mercadolibre.com/products/${product.catalogId}/items`,
      { headers: h }
    )
    const catalogData = await catalogRes.json().catch(() => null)

    if (catalogRes.ok && catalogData?.results?.length) {
      const results = catalogData.results
      console.log(`   /products/:id/items → ✅  ${results.length} sellers encontrados`)
      results.slice(0, 6).forEach((r, i) => {
        console.log(`   [${i+1}] item: ${r.id}  |  precio: $${r.price}  |  seller: ${r.seller_id}`)
      })
      if (results.length > 6) console.log(`        ... y ${results.length - 6} más`)
    } else {
      console.log(`   /products/:id/items → ❌  status ${catalogRes.status}`)
      if (catalogData?.message) console.log(`   mensaje: ${catalogData.message}`)
    }

    // B. Item específico (si tenemos el wid del URL)
    if (product.itemId) {
      const itemRes = await fetch(
        `https://api.mercadolibre.com/items/${product.itemId}`,
        { headers: h }
      )
      const itemData = await itemRes.json().catch(() => null)

      if (itemRes.ok) {
        console.log(`\n   /items/${product.itemId} → ✅`)
        console.log(`   título:  ${itemData.title}`)
        console.log(`   precio:  $${itemData.price} ${itemData.currency_id}`)
        console.log(`   seller:  ${itemData.seller_id}`)
        console.log(`   estado:  ${itemData.condition} / qty: ${itemData.available_quantity}`)
      } else {
        console.log(`\n   /items/${product.itemId} → ❌  status ${itemRes.status}`)
      }
    }
  }

  // Resumen final
  console.log(`\n${'─'.repeat(55)}`)
  console.log('RESUMEN')
  console.log('─'.repeat(55))
  console.log('Los IDs de items de cada seller (los que aparecen arriba')
  console.log('como "item: MLA...") son los que hay que importar en el bot.')
  console.log('\nEjemplo de CSV para importar:')
  console.log('group_name,meli_item_id,notes')
  console.log('"MX Master 3S",MLA1969623656,Seller A')
  console.log('"MX Master 3S",MLA2345678901,Seller B')
  console.log()
}

test().catch(console.error)
