import { useState } from 'react'
import { Check, ChevronDown, ChevronRight, Handshake } from 'lucide-react'
import { useCrm } from './contexto'
import { COLOR_SEMAFORO, semaforoDe } from './reglas'
import type { CrmAccion } from './tipos'

/**
 * Las acciones del CRM de un día, dentro de la Agenda semanal. Van en un
 * bloque propio (hay días con muchas gestiones juntas, ej. invitaciones a la
 * LNR) que se despliega; tocar una acción la abre, el ✓ la marca hecha.
 */
export default function AccionesCrmDelDia({ acciones }: { acciones: CrmAccion[] }) {
  const crm = useCrm()
  const [abierto, setAbierto] = useState(acciones.length <= 3)
  if (!acciones.length) return null
  const pendientes = acciones.filter((a) => a.estado !== 'CONCRETADO').length

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50">
      <button onClick={() => setAbierto(!abierto)} className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left">
        <Handshake size={12} className="shrink-0 text-blue-600" />
        <span className="text-[10px] font-extrabold tracking-wide text-blue-700 uppercase">CRM</span>
        <span className="text-[10px] font-extrabold text-blue-500">
          {acciones.length}
          {pendientes && pendientes !== acciones.length ? ` · ${pendientes} pend.` : ''}
        </span>
        <span className="ml-auto text-blue-400">{abierto ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</span>
      </button>
      {abierto && (
        <div className="space-y-1 px-1.5 pb-1.5">
          {acciones.map((a) => {
            const s = semaforoDe(a)
            const inst = crm.instituciones.find((i) => i.id === a.institucionId)
            return (
              <div key={a.id} className="group flex items-start gap-1.5 rounded-md bg-white px-1.5 py-1 shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
                <i className="mt-1 size-2 shrink-0 rounded-full" style={{ background: COLOR_SEMAFORO[s].punto }} />
                <button onClick={() => crm.abrirAccion(a)} className="min-w-0 flex-1 text-left">
                  <span className={`block truncate text-[11px] font-extrabold text-slate-700 ${s === 'hecha' ? 'line-through opacity-60' : ''}`}>
                    {inst?.nombre ?? 'Institución'}
                  </span>
                  <span className="line-clamp-2 block text-[10px] leading-snug text-slate-500">{a.accion}</span>
                </button>
                {s !== 'hecha' && (
                  <button
                    onClick={() => crm.marcarHecha(a)}
                    title="Marcar como hecha"
                    className="shrink-0 rounded p-0.5 text-slate-300 hover:bg-emerald-50 hover:text-emerald-600"
                  >
                    <Check size={13} strokeWidth={3} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
