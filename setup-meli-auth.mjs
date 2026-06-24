/**
 * Setup de autenticación con MercadoLibre — ejecutar UNA sola vez
 *
 * USO: node setup-meli-auth.mjs
 *
 * Requiere que MELI_APP_ID y MELI_APP_SECRET estén en .env.local
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { createInterface } from 'readline'

// Cargar .env.local
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

const APP_ID = process.env.MELI_APP_ID
const APP_SECRET = process.env.MELI_APP_SECRET

if (!APP_ID || !APP_SECRET) {
  console.error('❌  MELI_APP_ID y MELI_APP_SECRET no encontrados en .env.local')
  process.exit(1)
}

// IMPORTANTE: en la consola de MELI developer, tenés que agregar esta URL como redirect URI
const REDIRECT_URI = 'https://httpbin.org/get'

const authUrl =
  `https://auth.mercadolibre.com.ar/authorization` +
  `?response_type=code` +
  `&client_id=${APP_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`

console.log('\n=== Setup de autenticación MELI ===\n')
console.log('PASO 1 — Agregá la siguiente URL como Redirect URI en tu app de MELI:')
console.log(`   ${REDIRECT_URI}`)
console.log('   → developers.mercadolibre.com.ar → tu app → Configuración → Redirect URI\n')
console.log('PASO 2 — Abrí esta URL en tu navegador e iniciá sesión con tu cuenta de MELI:')
console.log(`   ${authUrl}\n`)
console.log('PASO 3 — Vas a ser redirigido a httpbin.org. En la respuesta JSON vas a ver:')
console.log('   { "args": { "code": "TG-XXXXXXXXXXXXXXXX-XXXXXXXXX" } }')
console.log('   Copiá ese valor completo (empieza con TG-)\n')

const rl = createInterface({ input: process.stdin, output: process.stdout })
const code = await new Promise((resolve) => rl.question('PASO 4 — Pegá el código acá: ', resolve))
rl.close()

if (!code.trim()) {
  console.error('❌  No pegaste ningún código.')
  process.exit(1)
}

console.log('\n   Canjeando código por tokens...')

const tokenRes = await fetch('https://api.mercadolibre.com/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: APP_ID,
    client_secret: APP_SECRET,
    code: code.trim(),
    redirect_uri: REDIRECT_URI,
  }),
})

const tokenData = await tokenRes.json()

if (!tokenRes.ok) {
  console.error('\n❌  Error al canjear código:', tokenData.message ?? JSON.stringify(tokenData))
  console.log('\n   Verificá que:')
  console.log('   • El redirect URI en tu app de MELI sea exactamente: ' + REDIRECT_URI)
  console.log('   • El código no expiró (tienen validez de ~10 minutos)')
  process.exit(1)
}

// Guardar refresh token en .env.local
let envContent = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : ''

function upsertEnvLine(content, key, value) {
  const regex = new RegExp(`^${key}=.*$`, 'm')
  const line = `${key}=${value}`
  return regex.test(content) ? content.replace(regex, line) : content.trimEnd() + '\n' + line + '\n'
}

envContent = upsertEnvLine(envContent, 'MELI_REFRESH_TOKEN', tokenData.refresh_token)
writeFileSync('.env.local', envContent)

console.log('\n✅  ¡Autenticación completada!')
console.log(`   Access token (válido 6hs): ${tokenData.access_token?.slice(0, 30)}...`)
console.log(`   Refresh token guardado en .env.local (válido 6 meses)`)
console.log('\n   Ahora podés correr: node test-meli.mjs\n')
