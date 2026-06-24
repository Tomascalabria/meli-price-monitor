import { ImportForm } from '@/components/ImportForm'
import { Upload } from 'lucide-react'

export default function ImportPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center">
            <Upload className="w-4 h-4 text-brand-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Importar productos</h1>
        </div>
        <p className="text-sm text-slate-500 ml-11">
          Cargá un CSV o JSON con los IDs de los items de MercadoLibre.
          El bot va a obtener los precios actuales y empezar a trackear automáticamente.
        </p>
      </div>

      <ImportForm />

      <div className="mt-8 bg-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Cómo encontrar el ID de un item en MELI</h3>
        <ol className="text-xs text-slate-400 space-y-2 list-decimal list-inside">
          <li>Abrí el listing del producto en MercadoLibre</li>
          <li>Fijate en la URL: <code className="text-green-400">mercadolibre.com.ar/p/<strong>MLA123456789</strong></code></li>
          <li>El ID empieza con MLA (Argentina), MLB (Brasil), MLM (México), etc.</li>
          <li>También lo podés ver en la URL del vendedor específico</li>
        </ol>
      </div>
    </div>
  )
}
