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
  return null
}

async function check(label, url, opts = {}) {
  try {
    const res = await fetch(url, opts)
    const body = await res.json().catch(() => null)
    const ok = res.ok ? '✅' : '❌'
    const msg = body?.message ?? body?.error ?? ''
    console.log(`${ok}  [${res.status}]  ${label}`)
    if (!res.ok && msg) console.log(`      → ${msg}`)
    return { ok: res.ok, status: res.status, body }
  } catch (e) {
    console.log(`💥  [ERR]  ${label}`)
    console.log(`      → ${e.message}`)
    return { ok: false, status: 0, body: null }
  }
}

async function test() {
  console.log('\n=== MELI — Diagnóstico de conectividad ===\n')

  // ── FASE 0: variables de entorno que pueden afectar la red ───────────────
  console.log('FASE 0 — Variables de entorno de red')
  console.log('─'.repeat(55))
  const proxyVars = ['HTTPS_PROXY','https_proxy','HTTP_PROXY','http_proxy','NO_PROXY','NODE_TLS_REJECT_UNAUTHORIZED']
  for (const v of proxyVars) {
    if (process.env[v]) console.log(`   ${v} = ${process.env[v]}`)
  }
  const hasProxy = proxyVars.some(v => process.env[v])
  if (!hasProxy) console.log('   (ninguna variable de proxy detectada)')
  console.log()

  // ── FASE 1: conectividad básica (sin auth, endpoints simples) ─────────────
  console.log('FASE 1 — Conectividad básica (sin auth)')
  console.log('─'.repeat(55))

  const site = await check(
    '/sites/MLA (info del sitio)',
    'https://api.mercadolibre.com/sites/MLA'
  )

  const currency = await check(
    '/currencies/ARS',
    'https://api.mercadolibre.com/currencies/ARS'
  )

  const searchNoAuth = await check(
    '/sites/MLA/search?q=logitech (SIN token)',
    'https://api.mercadolibre.com/sites/MLA/search?q=logitech&limit=1'
  )

  if (!site.ok && !currency.ok) {
    console.log('\n💥  No hay conectividad con la API de MELI.')
    console.log('   Verificá tu conexión a internet o si hay un proxy/firewall bloqueando.')
    return
  }

  if (searchNoAuth.ok) {
    const first = searchNoAuth.body?.results?.[0]
    console.log(`      Primer resultado: ${first?.id} — $${first?.price} — ${first?.title?.slice(0,40)}`)
  }

  // ── FASE 2: token ─────────────────────────────────────────────────────────
  console.log('\nFASE 2 — Autenticación')
  console.log('─'.repeat(55))

  if (!APP_ID || !APP_SECRET) {
    console.log('❌  Faltan MELI_APP_ID / MELI_APP_SECRET en .env.local')
    return
  }
  console.log(`✅  App ID: ${APP_ID}`)

  const token = await getToken()
  if (!token) {
    console.log('❌  No se pudo obtener token. Corré: node setup-meli-auth.mjs')
    return
  }
  console.log(`✅  Token: ${token.slice(0, 30)}...`)

  const h = { Authorization: `Bearer ${token}` }

  const me = await check('/users/me', 'https://api.mercadolibre.com/users/me', { headers: h })
  if (me.ok) {
    console.log(`      Usuario: ${me.body.nickname} | tipo: ${me.body.user_type} | país: ${me.body.country_id}`)
    if (me.body.user_type === 'normal') {
      console.log('   ⚠️   user_type = "normal" (cuenta de comprador, no de vendedor)')
    }
  }

  // ── FASE 3: search con y sin token ────────────────────────────────────────
  console.log('\nFASE 3 — Search con token')
  console.log('─'.repeat(55))

  const searchWithAuth = await check(
    '/sites/MLA/search?q=logitech (CON token)',
    'https://api.mercadolibre.com/sites/MLA/search?q=logitech&limit=1',
    { headers: h }
  )
  if (searchWithAuth.ok) {
    const first = searchWithAuth.body?.results?.[0]
    console.log(`      Primer resultado: ${first?.id} — $${first?.price}`)
  }

  await check(
    '/sites/MLA/search?catalog_product_id=MLA19473530 (MX Master 3S)',
    'https://api.mercadolibre.com/sites/MLA/search?catalog_product_id=MLA19473530&limit=3',
    { headers: h }
  )

  // ── FASE 4: items directos ────────────────────────────────────────────────
  console.log('\nFASE 4 — Items directos')
  console.log('─'.repeat(55))

  const item = await check(
    '/items/MLA1969623656 (MX Master 3S — item específico)',
    'https://api.mercadolibre.com/items/MLA1969623656',
    { headers: h }
  )
  if (item.ok) {
    console.log(`      Precio: $${item.body.price} | Seller: ${item.body.seller_id}`)
  }

  await check(
    '/items?ids=MLA1969623656,MLA844362318 (multiget)',
    'https://api.mercadolibre.com/items?ids=MLA1969623656,MLA844362318&attributes=id,price,seller_id',
    { headers: h }
  )

  // ── Resumen final ─────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(55))
  console.log('QUÉ HACER SEGÚN LOS RESULTADOS')
  console.log('═'.repeat(55))

  if (!searchNoAuth.ok && !searchWithAuth.ok) {
    console.log()
    console.log('🔴 PROBLEMA DE RED / CUENTA:')
    console.log('   La búsqueda falla con Y sin token. Probá:')
    console.log('   1. Abrir en tu navegador:')
    console.log('      https://api.mercadolibre.com/sites/MLA/search?q=logitech')
    console.log('      ¿Ves resultados JSON? Si no → hay un bloqueo de red.')
    console.log()
    console.log('   2. Si el navegador SÍ muestra resultados pero el script no,')
    console.log('      puede ser un proxy de Windows interceptando HTTPS:')
    console.log('      • Desactivar VPN si estás usando una')
    console.log('      • Probar desde otra red (celular con hotspot)')
    console.log()
    console.log('   3. Si la cuenta tiene user_type="normal" (comprador):')
    console.log('      MELI puede restringir el acceso a la API de búsqueda')
    console.log('      a cuentas de vendedor. Usar la cuenta de vendedor de')
    console.log('      tu novia para autenticar la app.')
  } else if (searchNoAuth.ok && !searchWithAuth.ok) {
    console.log()
    console.log('🟡 PROBLEMA CON EL TOKEN:')
    console.log('   Sin auth funciona, con auth falla.')
    console.log('   El token puede estar causando un error. Probá:')
    console.log('   1. Borrar MELI_REFRESH_TOKEN de .env.local')
    console.log('   2. Correr: node setup-meli-auth.mjs')
    console.log('   3. Autenticar con la cuenta VENDEDORA (no compradora)')
  } else if (searchWithAuth.ok) {
    console.log()
    console.log('✅ El search básico funciona. Si algún endpoint de items falla,')
    console.log('   los scopes específicos podrían necesitar ajuste.')
  }
  console.log()
}

test().catch(console.error)
