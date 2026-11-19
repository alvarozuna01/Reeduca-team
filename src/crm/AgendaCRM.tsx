import { useState } from 'react'
import { Check, ChevronDown, ChevronRight, Handshake, Plus } from 'lucide-react'
import { useCrm } from './contexto'
import { COLOR_SEMAFORO, semaforoDe } from './reglas'
import type { CrmAccion } from './tipos'

/**
 * Las acciones del CRM de un día, dentro de la Agenda semanal. Van en un
 * bloque propio (hay días con muchas gestiones juntas, ej. invitaciones a la
 * LNR) que se despliega; tocar una acción la abre, el ✓ la marca hecha.
 *
 * El «+» carga una gestión nueva con la fecha de ese día: la ventana pide la
 * institución, porque desde la Agenda no hay una puesta de antemano. Antes
 * desde acá solo se podían abrir las que ya existían.
 */
export default function AccionesCrmDelDia({ acciones, fecha }: { acciones: CrmAccion[]; fecha: string }) {
  const crm = useCrm()
  const [abierto, setAbierto] = useState(acciones.length <= 3)
  if (!crm.tieneAcceso) return null

  const pendientes = acciones.filter((a) => a.estado !== 'CONCRETADO').length
  const agregar = () => crm.abrirAccion({ nueva: true, fecha })

  // Día sin gestiones: solo la invitación a cargar una, sin el recuadro.
  if (!acciones.length)
    return (
      <button
        onClick={agregar}
        className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-blue-200 py-1.5 text-[10px] font-extrabold tracking-wide text-blue-500 uppercase transition hover:border-blue-400 hover:bg-blue-50"
      >
        <Plus size={12} strokeWidth={3} /> Gestión CRM
      </button>
    )

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50">
      <div className="flex items-center px-2 py-1.5">
        <button onClick={() => setAbierto(!abierto)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
          <Handshake size={12} className="shrink-0 text-blue-600" />
          <span className="text-[10px] font-extrabold tracking-wide text-blue-700 uppercase">CRM</span>
          <span className="text-[10px] font-extrabold text-blue-500">
            {acciones.length}
            {pendientes && pendientes !== acciones.length ? ` · ${pendientes} pend.` : ''}
          </span>
          <span className="ml-auto text-blue-400">{abierto ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</span>
        </button>
        <button
          onClick={agregar}
          title="Cargar una gestión del CRM en este día"
          className="ml-1 shrink-0 rounded p-0.5 text-blue-500 transition hover:bg-blue-100 hover:text-blue-700"
        >
          <Plus size={14} strokeWidth={3} />
        </button>
      </div>
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
