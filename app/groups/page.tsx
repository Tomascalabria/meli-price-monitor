'use client'

import { useState, useEffect } from 'react'
import { ProductGroupCard } from '@/components/ProductGroupCard'
import { Plus, X, Boxes } from 'lucide-react'
import type { ProductGroupWithStats } from '@/lib/types'
import Link from 'next/link'

export default function GroupsPage() {
  const [groups, setGroups] = useState<ProductGroupWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', reference_price: '', alert_threshold_pct: '5' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/groups')
      .then((r) => r.json())
      .then((data) => { setGroups(data); setLoading(false) })
  }, [])

  async function handleCreate() {
    if (!form.name.trim()) return
    setSaving(true)
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(),
        description: form.description.trim() || null,
        reference_price: form.reference_price ? parseFloat(form.reference_price) : null,
        alert_threshold_pct: parseFloat(form.alert_threshold_pct) || 5,
      }),
    })
    const created = await res.json()
    setGroups((prev) => [{ ...created, item_count: 0, alert_count: 0, min_price: null, max_price: null, avg_price: null }, ...prev])
    setForm({ name: '', description: '', reference_price: '', alert_threshold_pct: '5' })
    setShowForm(false)
    setSaving(false)
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Productos</h1>
          <p className="text-sm text-slate-500 mt-1">
            {groups.length} grupo{groups.length !== 1 ? 's' : ''} de productos
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/import"
            className="px-4 py-2 border border-slate-200 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50"
          >
            Importar CSV/JSON
          </Link>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700"
          >
            <Plus className="w-4 h-4" />
            Nuevo grupo
          </button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Nuevo grupo de productos</h2>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="ej. Auriculares BT"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="ej. Auriculares Sony WH-1000XM5"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Precio de referencia (ARS)</label>
              <input
                type="number"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="ej. 15000"
                value={form.reference_price}
                onChange={(e) => setForm((f) => ({ ...f, reference_price: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Umbral de alerta (%)</label>
              <input
                type="number"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="5"
                value={form.alert_threshold_pct}
                onChange={(e) => setForm((f) => ({ ...f, alert_threshold_pct: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button
              onClick={handleCreate}
              disabled={saving || !form.name.trim()}
              className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-60"
            >
              {saving ? 'Guardando...' : 'Crear grupo'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 h-40 animate-pulse" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Boxes className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No hay grupos aún. Creá uno o importá desde CSV/JSON.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {groups.map((group) => (
            <ProductGroupCard key={group.id} group={group} />
          ))}
        </div>
      )}
    </div>
  )
}
