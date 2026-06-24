'use client'

import { useState, useRef } from 'react'
import { Upload, FileText, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import Papa from 'papaparse'
import { cn } from '@/lib/utils'
import type { ImportRow, ImportJsonGroup } from '@/lib/types'

interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

export function ImportForm() {
  const [preview, setPreview] = useState<ImportRow[] | null>(null)
  const [format, setFormat] = useState<'csv' | 'json'>('csv')
  const [jsonGroups, setJsonGroups] = useState<ImportJsonGroup[] | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase()
    const isJson = ext === 'json'
    setFormat(isJson ? 'json' : 'csv')

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string

      if (isJson) {
        try {
          const parsed = JSON.parse(text) as ImportJsonGroup[]
          setJsonGroups(parsed)
          // Flatten for preview
          const flat: ImportRow[] = []
          for (const g of parsed) {
            for (const item of g.items) {
              flat.push({ group_name: g.group_name, meli_item_id: item.meli_item_id, notes: item.notes })
            }
          }
          setPreview(flat)
        } catch {
          alert('JSON inválido. Revisá el formato.')
        }
      } else {
        Papa.parse<ImportRow>(text, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            setPreview(results.data)
            setJsonGroups(null)
          },
        })
      }
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!preview || preview.length === 0) return
    setStatus('loading')

    try {
      const body =
        format === 'json' && jsonGroups
          ? { format: 'json', rows: jsonGroups }
          : { format: 'csv', rows: preview }

      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      setResult(data)
      setStatus(data.imported > 0 ? 'success' : 'error')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="space-y-6">
      {/* Format examples */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-400 mb-2">Formato CSV</p>
          <pre className="text-xs text-green-400 font-mono leading-relaxed">{`group_name,meli_item_id,notes
"Auriculares BT",MLA123456789,Seller principal
"Auriculares BT",MLA987654321,Seller secundario
"Mouse Gamer",MLA111222333,`}</pre>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-400 mb-2">Formato JSON</p>
          <pre className="text-xs text-blue-400 font-mono leading-relaxed">{`[{
  "group_name": "Auriculares BT",
  "reference_price": 15000,
  "items": [
    { "meli_item_id": "MLA123" },
    { "meli_item_id": "MLA456" }
  ]
}]`}</pre>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const file = e.dataTransfer.files[0]
          if (file) handleFile(file)
        }}
        onClick={() => fileRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
          dragOver
            ? 'border-brand-500 bg-brand-50'
            : 'border-slate-300 hover:border-brand-400 hover:bg-slate-50'
        )}
      >
        <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-700">
          Arrastrá tu archivo CSV o JSON acá
        </p>
        <p className="text-xs text-slate-500 mt-1">o hacé click para seleccionar</p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />
      </div>

      {/* Preview */}
      {preview && preview.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">
                {preview.length} items para importar
              </span>
            </div>
            <button
              onClick={handleImport}
              disabled={status === 'loading'}
              className="flex items-center gap-2 px-4 py-1.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-60"
            >
              {status === 'loading' ? 'Importando...' : 'Importar'}
            </button>
          </div>
          <div className="overflow-x-auto max-h-72 scrollbar-thin">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-200">
                  <th className="text-left px-4 py-2 font-medium text-slate-500">Grupo</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-500">MELI ID</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-500">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.slice(0, 50).map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-800">{row.group_name}</td>
                    <td className="px-4 py-2 font-mono text-brand-600">{row.meli_item_id}</td>
                    <td className="px-4 py-2 text-slate-500">{row.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div
          className={cn(
            'flex items-start gap-3 rounded-xl p-4',
            result.imported > 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          )}
        >
          {result.imported > 0 ? (
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          )}
          <div>
            <p className="text-sm font-medium text-slate-900">
              {result.imported} importados · {result.skipped} saltados
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-2 space-y-1">
                {result.errors.map((e, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-red-700">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    {e}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
