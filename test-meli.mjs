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
    if (res.ok) {
      const d = await res.json()
      console.log(`   Scopes del token: ${d.scope ?? '(no scope field)'}`)
      return d.access_token
    }
    const errData = await res.json().catch(() => ({}))
    console.log(`   ⚠️  refresh_token falló: ${errData.message ?? res.status}`)
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
  if (res.ok) {
    const d = await res.json()
    console.log(`   Scopes del token: ${d.scope ?? '(no scope field)'}`)
    return d.access_token
  }
  return null
}

async function test() {
  console.log('\n=== MELI Price Monitor — Diagnóstico completo ===\n')

  if (!APP_ID || !APP_SECRET) {
    console.log('❌  Faltan MELI_APP_ID y/o MELI_APP_SECRET en .env.local')
    return
  }
  console.log(`✅  App ID: ${APP_ID}`)

  const token = await getToken()
  if (!token) {
    console.log('❌  No se pudo obtener token. Corré: node setup-meli-auth.mjs')
    return
  }
  console.log(`✅  Token OK: ${token.slice(0, 20)}...`)

  const h = { Authorization: `Bearer ${token}` }

  // ─── Verificar identidad del token ───────────────────────────────────────────
  console.log('\n── Verificando token (/users/me) ──')
  const meRes = await fetch('https://api.mercadolibre.com/users/me', { headers: h })
  const meData = await meRes.json().catch(() => null)
  if (meRes.ok) {
    console.log(`✅  Usuario: ${meData.nickname} (id: ${meData.id})`)
    console.log(`   País: ${meData.country_id} | Tipo: ${meData.user_type}`)
  } else {
    console.log(`❌  /users/me → ${meRes.status}: ${meData?.message ?? ''}`)
    console.log('   El token no es válido. Corré: node setup-meli-auth.mjs')
    return
  }

  // ─── A. Búsqueda por catalog_product_id ──────────────────────────────────────
  console.log('\n── A. Búsqueda por catalog_product_id ──')
  for (const p of CATALOG_PRODUCTS) {
    const url = `https://api.mercadolibre.com/sites/MLA/search?catalog_product_id=${p.catalogId}&limit=5`
    const res = await fetch(url, { headers: h })
    const data = await res.json().catch(() => null)

    if (res.ok && data?.results?.length) {
      console.log(`✅  ${p.name}: ${data.results.length} sellers`)
      data.results.slice(0, 3).forEach((r, i) => {
        console.log(`   [${i+1}] ${r.id}  $${r.price}  seller:${r.seller?.id ?? r.seller_id ?? '?'}`)
      })
    } else {
      console.log(`❌  ${p.name}: status ${res.status} — ${data?.message ?? ''}`)
    }
  }

  // ─── B. Búsqueda por texto ────────────────────────────────────────────────────
  console.log('\n── B. Búsqueda por texto (/sites/MLA/search?q=...) ──')
  const testQuery = 'logitech mx master 3s'
  const qRes = await fetch(
    `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(testQuery)}&limit=3`,
    { headers: h }
  )
  const qData = await qRes.json().catch(() => null)
  if (qRes.ok && qData?.results?.length) {
    console.log(`✅  "${testQuery}": ${qData.paging?.total} resultados`)
    qData.results.slice(0, 3).forEach((r, i) => {
      console.log(`   [${i+1}] ${r.id}  $${r.price}  ${r.title?.slice(0, 45)}`)
    })
  } else {
    console.log(`❌  Búsqueda: status ${qRes.status} — ${qData?.message ?? ''}`)
  }

  // ─── C. Multiget de items conocidos ──────────────────────────────────────────
  console.log('\n── C. Multiget /items?ids=... ──')
  const knownIds = ['MLA844362318', 'MLA1969623656']
  const mRes = await fetch(
    `https://api.mercadolibre.com/items?ids=${knownIds.join(',')}&attributes=id,title,price,currency_id,seller_id`,
    { headers: h }
  )
  const mData = await mRes.json().catch(() => null)
  if (mRes.ok && Array.isArray(mData)) {
    mData.forEach(entry => {
      if (entry.code === 200) {
        const b = entry.body
        console.log(`✅  ${b.id}  $${b.price} ${b.currency_id}  seller:${b.seller_id}`)
        console.log(`   ${b.title}`)
      } else {
        console.log(`❌  code ${entry.code} — ${entry.body?.message ?? JSON.stringify(entry.body)}`)
      }
    })
  } else {
    console.log(`❌  status ${mRes.status} — ${mData?.message ?? ''}`)
  }

  // ─── Diagnóstico final ────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60))
  console.log('DIAGNÓSTICO')
  console.log('═'.repeat(60))
  console.log()
  console.log('Si todos los endpoints devuelven 403 con mensaje')
  console.log('"At least one policy returned UNAUTHORIZED":')
  console.log()
  console.log('  1. Ir a: https://developers.mercadolibre.com.ar/tu-cuenta/aplicaciones')
  console.log('  2. Abrir tu app → sección "Permisos"')
  console.log('  3. Habilitar los siguientes permisos:')
  console.log('     ✓ Ítems y búsquedas → Lectura')
  console.log('     ✓ Publicaciones → Lectura (si aparece)')
  console.log('  4. Guardar cambios')
  console.log('  5. Volver a correr: node setup-meli-auth.mjs')
  console.log('     (para obtener un nuevo token con los scopes actualizados)')
  console.log('  6. Correr de nuevo: node test-meli.mjs')
  console.log()
}

test().catch(console.error)
