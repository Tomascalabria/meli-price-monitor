'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PriceComparisonTable } from '@/components/PriceComparisonTable'
import { PriceChart } from '@/components/PriceChart'
import { RunScrapeButton } from '@/components/RunScrapeButton'
import { ArrowLeft, Plus, Settings, Trash2, X } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import Link from 'next/link'
import type { ProductGroup, TrackedItemWithLatestPrice } from '@/lib/types'

interface GroupDetail extends ProductGroup {
  items: TrackedItemWithLatestPrice[]
}

interface PricePoint {
  snapshot_at: string
  price: number
  tracked_item_id: string
}

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [history, setHistory] = useState<PricePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [addingItem, setAddingItem] = useState(false)
  const [newItemId, setNewItemId] = useState('')
  const [newItemNotes, setNewItemNotes] = useState('')
  const [addError, setAddError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState({ reference_price: '', alert_threshold_pct: '5' })

  const loadGroup = useCallback(async () => {
    const [groupRes, histRes] = await Promise.all([
      fetch(`/api/groups/${id}`),
      fetch(`/api/groups/${id}/history`),
    ])
    const groupData = await groupRes.json()
    const histData = await histRes.json()
    setGroup(groupData)
    setHistory(histData)
    setSettings({
      reference_price: groupData.reference_price?.toString() ?? '',
      alert_threshold_pct: groupData.alert_threshold_pct?.toString() ?? '5',
    })
    setLoading(false)
  }, [id])

  useEffect(() => { loadGroup() }, [loadGroup])

  async function handleAddItem() {
    if (!newItemId.trim()) return
    setSaving(true)
    setAddError('')

    const res = await fetch(`/api/groups/${id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meli_item_id: newItemId.trim(), notes: newItemNotes.trim() || undefined }),
    })

    if (!res.ok) {
      const err = await res.json()
      setAddError(err.error ?? 'Error al agregar')
      setSaving(false)
      return
    }

    await loadGroup()
    setNewItemId('')
    setNewItemNotes('')
    setAddingItem(false)
    setSaving(false)
  }

  async function handleRemoveItem(itemId: string) {
    await fetch(`/api/groups/${id}/items?item_id=${itemId}`, { method: 'DELETE' })
    await loadGroup()
  }

  async function handleSaveSettings() {
    await fetch(`/api/groups/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: group!.name,
        description: group!.description,
        reference_price: settings.reference_price ? parseFloat(settings.reference_price) : null,
        alert_threshold_pct: parseFloat(settings.alert_threshold_pct) || 5,
      }),
    })
    setShowSettings(false)
    await loadGroup()
  }

  async function handleDeleteGroup() {
    if (!confirm(`¿Eliminar el grupo "${group?.name}"? Se perderá todo el historial.`)) return
    await fetch(`/api/groups/${id}`, { method: 'DELETE' })
    router.push('/groups')
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="h-8 bg-slate-200 animate-pulse rounded w-48" />
        <div className="h-48 bg-white animate-pulse rounded-xl border border-slate-200" />
        <div className="h-80 bg-white animate-pulse rounded-xl border border-slate-200" />
      </div>
    )
  }

  if (!group) {
    return (
      <div className="max-w-5xl mx-auto text-center py-20 text-slate-500">
        Grupo no encontrado.{' '}
        <Link href="/groups" className="text-brand-600 hover:underline">Volver</Link>
      </div>
    )
  }

  const sellers = (group.items ?? [])
    .filter((i) => i.is_active)
    .map((i) => ({
      id: i.id,
      label: i.seller_nickname ?? i.meli_item_id,
    }))

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link
            href="/groups"
            className="mt-1 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{group.name}</h1>
            {group.description && (
              <p className="text-sm text-slate-500 mt-0.5">{group.description}</p>
            )}
            {group.reference_price && (
              <p className="text-xs text-slate-400 mt-1">
                Precio referencia: <span className="font-medium text-slate-700">{formatPrice(group.reference_price)}</span>
                {' '}· alerta si desvía más de {group.alert_threshold_pct}%
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <RunScrapeButton />
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={handleDeleteGroup}
            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Configuración del grupo</h3>
            <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Precio de referencia (ARS)</label>
              <input
                type="number"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={settings.reference_price}
                onChange={(e) => setSettings((s) => ({ ...s, reference_price: e.target.value }))}
                placeholder="ej. 15000"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Umbral de alerta (%)</label>
              <input
                type="number"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={settings.alert_threshold_pct}
                onChange={(e) => setSettings((s) => ({ ...s, alert_threshold_pct: e.target.value }))}
                placeholder="5"
              />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button
              onClick={handleSaveSettings}
              className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700"
            >
              Guardar cambios
            </button>
          </div>
        </div>
      )}

      {/* Price chart */}
      <PriceChart history={history} sellers={sellers} />

      {/* Comparison table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-900">Sellers trackeados</h2>
          <button
            onClick={() => setAddingItem(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-brand-600 bg-brand-50 rounded-lg hover:bg-brand-100"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar item
          </button>
        </div>

        {addingItem && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-3 shadow-sm">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  MELI Item ID (ej: MLA123456789)
                </label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="MLA123456789"
                  value={newItemId}
                  onChange={(e) => setNewItemId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notas</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="opcional"
                  value={newItemNotes}
                  onChange={(e) => setNewItemNotes(e.target.value)}
                />
              </div>
            </div>
            {addError && <p className="text-xs text-red-600 mt-2">{addError}</p>}
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleAddItem}
                disabled={saving || !newItemId.trim()}
                className="px-4 py-1.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-60"
              >
                {saving ? 'Agregando...' : 'Agregar'}
              </button>
              <button
                onClick={() => { setAddingItem(false); setAddError('') }}
                className="px-4 py-1.5 text-sm text-slate-600 hover:text-slate-900"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <PriceComparisonTable
          items={group.items ?? []}
          referencePrice={group.reference_price}
          alertThreshold={group.alert_threshold_pct}
          onRemove={handleRemoveItem}
        />
      </div>
    </div>
  )
}
