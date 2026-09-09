import { useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

export interface BloqueKickoff {
  numero: number
  titulo: string
  minutos: number
  contenido: ReactNode
}

/**
 * Modo reunión del kickoff: pantalla completa, un bloque por vez, con
 * navegación adelante/atrás bien grande (se proyecta o se muestra desde
 * el celular). Tiempo sugerido por bloque, sin cronómetro ni alarmas.
 */
export default function KickoffReunion({ bloques, onClose }: { bloques: BloqueKickoff[]; onClose: () => void }) {
  const [idx, setIdx] = useState(0)
  const bloque = bloques[idx]

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3 md:px-8">
        <span className="text-xs font-extrabold tracking-wide text-slate-400 uppercase">
          Kickoff semanal · bloque {idx + 1} de {bloques.length}
        </span>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-extrabold text-blue-700">
            ≈ {bloque.minutos} min
          </span>
          <button
            onClick={onClose}
            title="Salir del modo reunión"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-extrabold text-blue-600">Bloque {bloque.numero}</p>
          <h2 className="mt-1 text-2xl font-black text-slate-800 md:text-3xl">{bloque.titulo}</h2>
          <div className="mt-5">{bloque.contenido}</div>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 md:px-8">
        <button
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="flex items-center gap-1 rounded-xl bg-slate-100 px-5 py-3 text-sm font-extrabold text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft size={18} /> Anterior
        </button>
        <div className="flex items-center gap-1.5">
          {bloques.map((b, i) => (
            <button
              key={b.numero}
              onClick={() => setIdx(i)}
              title={b.titulo}
              className={`size-2.5 rounded-full transition ${i === idx ? 'bg-blue-600' : 'bg-slate-200 hover:bg-slate-300'}`}
            />
          ))}
        </div>
        <button
          onClick={() => setIdx((i) => Math.min(bloques.length - 1, i + 1))}
          disabled={idx === bloques.length - 1}
          className="flex items-center gap-1 rounded-xl bg-blue-600 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Siguiente <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}
