import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Check } from 'lucide-react'
import { COLOR_SEMAFORO, etiquetaTipoAccion, semaforoDe } from './reglas'
import type { CrmAccion } from './tipos'

/**
 * Una acción como "eslabón" de la cadena: verde = hecha, amarillo = pendiente,
 * rojo = vencida. Tocarla la abre; el ✓ la marca como hecha al instante.
 */
export default function ChipAccion({
  accion,
  onAbrir,
  onHecha,
  ancho = 'w-44',
}: {
  accion: CrmAccion
  onAbrir: () => void
  onHecha?: () => void
  ancho?: string
}) {
  const s = semaforoDe(accion)
  return (
    <div
      className={`group relative flex ${ancho} shrink-0 flex-col rounded-lg border px-2 py-1.5 text-left transition hover:shadow-sm ${COLOR_SEMAFORO[s].chip}`}
    >
      <button type="button" onClick={onAbrir} className="min-w-0 text-left">
        <span className="flex items-center gap-1 text-[10px] font-extrabold tracking-wide uppercase opacity-80">
          <span className="truncate">{etiquetaTipoAccion(accion.tipo)}</span>
          <span className="ml-auto shrink-0">
            {accion.fecha ? format(parseISO(accion.fecha), 'd MMM', { locale: es }) : 'sin fecha'}
          </span>
        </span>
        <span className={`mt-0.5 line-clamp-2 block text-xs leading-snug font-bold ${s === 'hecha' ? 'opacity-70' : ''}`}>
          {accion.accion || '—'}
        </span>
      </button>
      {onHecha && s !== 'hecha' && (
        <button
          type="button"
          onClick={onHecha}
          title="Marcar como hecha"
          className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full border border-emerald-300 bg-white text-emerald-600 opacity-100 shadow-sm transition hover:bg-emerald-500 hover:text-white md:opacity-0 md:group-hover:opacity-100"
        >
          <Check size={13} strokeWidth={3} />
        </button>
      )}
    </div>
  )
}
