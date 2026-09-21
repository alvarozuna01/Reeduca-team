import { useState } from 'react'
import { useApp } from '../state/AppContext'
import { useCrm } from './contexto'
import { COLOR_SEMAFORO, etiquetaTipoAccion, iconoTipo, semaforoDe } from './reglas'
import { ARRASTRE_ACCION, LU, fechaTexto, nombresCortos } from './estilo'
import OpcionesTipo from './OpcionesTipo'
import type { CrmAccion } from './tipos'

/**
 * Una acción de la cadena, como en la planilla: verde hecha, naranja pendiente,
 * rojo vencida. Tocarla despliega los arreglos rápidos (hecha, editar, fecha,
 * tipo); se puede arrastrar sobre otra institución para moverla.
 */
export default function BloqueAccion({ accion }: { accion: CrmAccion }) {
  const { users } = useApp()
  const crm = useCrm()
  const [abierto, setAbierto] = useState(false)
  const [arrastrando, setArrastrando] = useState(false)
  const s = semaforoDe(accion)
  const color = COLOR_SEMAFORO[s]
  const resp = nombresCortos(accion.responsableIds, users)

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={!abierto}
      onDragStart={(e) => {
        e.dataTransfer.setData(ARRASTRE_ACCION, accion.id)
        e.dataTransfer.effectAllowed = 'move'
        setArrastrando(true)
      }}
      onDragEnd={() => setArrastrando(false)}
      onClick={() => setAbierto((o) => !o)}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          setAbierto((o) => !o)
        }
      }}
      title={abierto ? undefined : 'Tocá para editarla · arrastrala sobre otra institución para moverla'}
      className={`w-[178px] shrink-0 rounded-lg border px-[11px] py-[9px] text-left outline-none focus-visible:ring-2 focus-visible:ring-[#5DADEA] ${
        abierto ? 'cursor-default' : 'cursor-grab'
      } ${arrastrando ? 'opacity-45' : ''}`}
      style={{ borderColor: LU.linea, borderLeft: `4px solid ${color.punto}`, background: color.fondo }}
    >
      <div className="mb-[3px] max-h-[70px] overflow-hidden text-[11.5px] leading-snug font-semibold" style={{ color: LU.txt }}>
        {accion.accion || '—'}
      </div>
      <div className="text-[10.5px] leading-snug" style={{ color: LU.muted }}>
        <b title={etiquetaTipoAccion(accion.tipo)}>{iconoTipo(accion.tipo)}</b> {accion.fecha ? fechaTexto(accion.fecha) : 'sin fecha'}
        {resp && ` · ${resp}`} · <b>{accion.estado}</b>
      </div>

      {abierto && (
        // Los controles de adentro no vuelven a plegar el bloque.
        <div onClick={(e) => e.stopPropagation()} className="mt-2 cursor-default border-t border-dashed pt-2" style={{ borderColor: LU.linea }}>
          <div className="flex flex-wrap items-center gap-2">
            {s !== 'hecha' && (
              <button
                type="button"
                onClick={() => crm.marcarHecha(accion)}
                className="rounded-md px-[9px] py-1 text-[11.5px] font-bold text-white"
                style={{ background: LU.ok }}
              >
                ✓ hecha
              </button>
            )}
            <button
              type="button"
              onClick={() => crm.abrirAccion(accion)}
              className="rounded-md px-[9px] py-1 text-[11.5px] font-bold text-white"
              style={{ background: LU.accent }}
            >
              ✏️ editar
            </button>
            <input
              key={accion.fecha ?? ''}
              type="date"
              aria-label="Cambiar la fecha"
              defaultValue={accion.fecha ?? ''}
              onChange={(e) => {
                // Solo fechas completas (mientras se tipea el año pasa por 0002, 0020…).
                if (/^20\d\d-\d\d-\d\d$/.test(e.target.value)) crm.guardarAccion({ ...accion, fecha: e.target.value })
              }}
              className="w-full rounded-[7px] border border-[#ccc] bg-white px-2 py-1 text-[11.5px]"
              style={{ color: LU.txt }}
            />
          </div>
          <label className="mt-[9px] mb-[3px] block text-[10px] font-bold tracking-[.3px] uppercase" style={{ color: LU.muted }}>
            Tipo de acción
            <select
              value={accion.tipo}
              onChange={(e) => crm.guardarAccion({ ...accion, tipo: e.target.value })}
              className="mt-[3px] block w-full cursor-pointer rounded-lg border border-[#ccc] bg-white px-2 py-1.5 text-[11.5px] font-normal tracking-normal normal-case"
              style={{ color: LU.txt }}
            >
              <OpcionesTipo actual={accion.tipo} />
            </select>
          </label>
        </div>
      )}
    </div>
  )
}
