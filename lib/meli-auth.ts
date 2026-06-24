let cachedToken: { token: string; expiresAt: number } | null = null

export async function getMeliToken(): Promise<string | null> {
  const appId = process.env.MELI_APP_ID
  const secret = process.env.MELI_APP_SECRET

  if (!appId || !secret) return null

  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token
  }

  try {
    const res = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: appId,
        client_secret: secret,
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
