import { Star } from 'lucide-react'

/** Estrellas de solo lectura (0 no muestra nada). */
export function Stars({ value, size = 13 }: { value: number; size?: number }) {
  if (!value) return null
  return (
    <span className="inline-flex items-center gap-px" title={`Importancia: ${value}/5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={size}
          className={i < value ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}
        />
      ))}
    </span>
  )
}

/** Selector de importancia (clic en la misma estrella para quitar la calificación). */
export function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2">
      {Array.from({ length: 5 }, (_, i) => {
        const n = i + 1
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n === value ? 0 : n)}
            className="transition hover:scale-110"
            title={`${n} estrella${n > 1 ? 's' : ''}`}
          >
            <Star size={20} className={n <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} />
          </button>
        )
      })}
      <span className="ml-auto text-xs font-bold text-slate-400">{value ? `${value}/5` : '—'}</span>
    </div>
  )
}

/** Pastilla compacta de importancia para tarjetas. Destacada si es 4–5. */
export function ImportancePill({ value }: { value: number }) {
  if (!value) return null
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-[9px] font-extrabold ${
        value >= 4 ? 'bg-amber-400 text-white' : 'bg-amber-100 text-amber-600'
      }`}
      title={`Importancia: ${value}/5`}
    >
      <Star size={9} className="fill-current" /> {value}
    </span>
  )
}

export function UrgentPill() {
  return (
    <span className="rounded-sm bg-[#e5484d] px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-white uppercase">
      Urgente
    </span>
  )
}
