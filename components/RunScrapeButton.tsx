'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ScrapeResult {
  scraped: number
  total: number
  failed: number
  timestamp: string
}

export function RunScrapeButton() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [result, setResult] = useState<ScrapeResult | null>(null)

  async function handleScrape() {
    setStatus('loading')
    setResult(null)
    try {
      const res = await fetch('/api/scrape', { method: 'POST' })
      const data = await res.json()
      setResult(data)
      setStatus('success')
      setTimeout(() => setStatus('idle'), 5000)
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 5000)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {status === 'success' && result && (
        <span className="flex items-center gap-1.5 text-sm text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
          <CheckCircle className="w-4 h-4" />
          {result.scraped}/{result.total} items actualizados
        </span>
      )}
      {status === 'error' && (
        <span className="flex items-center gap-1.5 text-sm text-red-700 bg-red-50 px-3 py-1.5 rounded-lg">
          <XCircle className="w-4 h-4" />
          Error al scrapear
        </span>
      )}
      <button
        onClick={handleScrape}
        disabled={status === 'loading'}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
          'bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed'
        )}
      >
        <RefreshCw className={cn('w-4 h-4', status === 'loading' && 'animate-spin')} />
        {status === 'loading' ? 'Actualizando...' : 'Actualizar precios'}
      </button>
    </div>
  )
}
