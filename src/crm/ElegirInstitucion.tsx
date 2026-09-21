import { useMemo, useState } from 'react'
import { Building2, Search, X } from 'lucide-react'
import { normalizar } from '../lib/menciones'
import { inputCls } from '../components/Modal'
import { useCrm } from './contexto'

/** Buscador de institución: se escribe parte del nombre y se elige de la lista. */
export default function ElegirInstitucion({
  value,
  onChange,
  excluir,
  autoFocus,
}: {
  value: string | null
  onChange: (id: string | null) => void
  excluir?: string
  autoFocus?: boolean
}) {
  const { instituciones } = useCrm()
  const [texto, setTexto] = useState('')
  const [abierto, setAbierto] = useState(false)
  const sel = instituciones.find((i) => i.id === value)

  const lista = useMemo(() => {
    const q = normalizar(texto.trim())
    return instituciones
      .filter((i) => i.id !== excluir && (!q || normalizar(i.nombre).includes(q)))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .slice(0, 8)
  }, [instituciones, texto, excluir])

  if (sel)
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <Building2 size={15} className="shrink-0 text-slate-400" />
        <span className="min-w-0 flex-1 truncate text-sm font-extrabold text-slate-700">{sel.nombre}</span>
        <span className="shrink-0 text-[11px] font-bold text-slate-400">{sel.segmento}</span>
        <button type="button" onClick={() => onChange(null)} title="Elegir otra" className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-200">
          <X size={14} />
        </button>
      </div>
    )

  return (
    <div className="relative">
      <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-300" />
      <input
        autoFocus={autoFocus}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value)
          setAbierto(true)
        }}
        onFocus={() => setAbierto(true)}
        // Con un respiro, para que el toque en la lista llegue antes de cerrarla.
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && lista[0]) {
            e.preventDefault()
            onChange(lista[0].id)
          }
          if (e.key === 'Escape') setAbierto(false)
        }}
        placeholder="Buscar institución existente…"
        className={`${inputCls} pl-8`}
      />
      {abierto && (
        <div className="absolute top-full left-0 z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
          {lista.map((i) => (
            <button
              key={i.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(i.id)
                setTexto('')
                setAbierto(false)
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm font-bold text-slate-600 hover:bg-blue-50"
            >
              <span className="min-w-0 flex-1 truncate">{i.nombre}</span>
              <span className="shrink-0 text-[10px] font-bold text-slate-400">{i.segmento}</span>
            </button>
          ))}
          {!lista.length && <p className="px-3 py-2 text-xs font-semibold text-slate-400">Ninguna coincide. Creala con «Nueva institución».</p>}
        </div>
      )}
    </div>
  )
}
