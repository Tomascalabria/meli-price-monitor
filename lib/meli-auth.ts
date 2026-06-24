const MELI_TOKEN_URL = 'https://api.mercadolibre.com/oauth/token'

let cachedToken: { token: string; expiresAt: number } | null = null

export async function getMeliToken(): Promise<string | null> {
  // 1. Usar token cacheado en memoria si no expiró
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token
  }

  const appId = process.env.MELI_APP_ID
  const appSecret = process.env.MELI_APP_SECRET
  const refreshToken = process.env.MELI_REFRESH_TOKEN

  if (!appId || !appSecret) return null

  // 2. Refresh token flow (recomendado — ejecutar setup-meli-auth.mjs para obtenerlo)
  if (refreshToken) {
    const token = await refreshAccessToken(appId, appSecret, refreshToken)
    if (token) return token
  }

  // 3. Client credentials (fallback — puede no estar disponible en todas las apps)
  return tryClientCredentials(appId, appSecret)
}

async function refreshAccessToken(
  appId: string,
  appSecret: string,
  refreshToken: string
): Promise<string | null> {
  try {
    const res = await fetch(MELI_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: appId,
        client_secret: appSecret,
        refresh_token: refreshToken,
      }),
    })

    if (!res.ok) return null

    const data = await res.json()
    cachedToken = {
      token: data.access_token as string,
      expiresAt: Date.now() + (data.expires_in as number) * 1000,
    }
    return cachedToken.token
  } catch {
    return null
  }
}

async function tryClientCredentials(appId: string, appSecret: string): Promise<string | null> {
  try {
    const res = await fetch(MELI_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: appId,
        client_secret: appSecret,
      }),
    })

    if (!res.ok) return null

    const data = await res.json()
    cachedToken = {
      token: data.access_token as string,
      expiresAt: Date.now() + (data.expires_in as number) * 1000,
    }
    return cachedToken.token
  } catch {
    return null
  }
}
