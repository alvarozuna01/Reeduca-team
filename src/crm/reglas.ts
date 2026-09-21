import { addDays, parseISO, startOfWeek } from 'date-fns'
import { toKey, todayKey } from '../lib/utils'
import { TIPOS_ACCION, type CrmAccion, type CrmOportunidad } from './tipos'

/**
 * Reglas de negocio del CRM (las mismas de la planilla):
 * venta / posventa / perdida NO se guarda: se deduce de la etapa.
 */
export type TipoOportunidad = 'venta' | 'posventa' | 'perdida'
export function tipoDe(etapa: string): TipoOportunidad {
  if (etapa === 'CERRADO-GANADO') return 'posventa'
  if (etapa === 'CERRADO-NO GANADO') return 'perdida'
  return 'venta'
}

/** Verde = hecha · amarillo = pendiente · rojo = vencida (pendiente con fecha pasada). */
export type Semaforo = 'hecha' | 'pendiente' | 'vencida'
export function semaforoDe(a: CrmAccion, hoy = todayKey()): Semaforo {
  if (a.estado === 'CONCRETADO') return 'hecha'
  return a.fecha && a.fecha < hoy ? 'vencida' : 'pendiente'
}

export const COLOR_SEMAFORO: Record<Semaforo, { chip: string; punto: string }> = {
  hecha: { chip: 'border-emerald-200 bg-emerald-50 text-emerald-800', punto: '#34C48E' },
  pendiente: { chip: 'border-amber-200 bg-amber-50 text-amber-800', punto: '#F0A62B' },
  vencida: { chip: 'border-red-200 bg-red-50 text-red-700', punto: '#e5484d' },
}

/** Las acciones de una oportunidad, en el orden de la cadena. */
export function cadenaDe(opp: CrmOportunidad, acciones: CrmAccion[]): CrmAccion[] {
  return acciones
    .filter((a) => a.oportunidadId === opp.id)
    .sort(
      (a, b) =>
        a.orden - b.orden ||
        (a.fecha ?? '9999').localeCompare(b.fecha ?? '9999') ||
        a.createdAt.localeCompare(b.createdAt),
    )
}

/** La próxima acción: la pendiente más próxima (las sin fecha, al final). */
export function proximaDe(cadena: CrmAccion[]): CrmAccion | undefined {
  return cadena
    .filter((a) => a.estado !== 'CONCRETADO')
    .sort((a, b) => (a.fecha ?? '9999').localeCompare(b.fecha ?? '9999'))[0]
}

export type Grupo = 'vencidas' | 'semana' | 'sinFecha' | 'futuras' | 'sinAccion'
export const GRUPOS: { id: Grupo; label: string; ayuda: string }[] = [
  { id: 'vencidas', label: 'Vencidas', ayuda: 'La próxima acción ya pasó de fecha' },
  { id: 'semana', label: 'Esta semana', ayuda: 'La próxima acción es de lunes a domingo' },
  { id: 'sinFecha', label: 'Sin fecha', ayuda: 'La próxima acción no tiene fecha' },
  { id: 'futuras', label: 'Futuras', ayuda: 'La próxima acción es más adelante' },
  { id: 'sinAccion', label: 'Sin próxima acción', ayuda: 'No hay nada pendiente: ¿cuál es el próximo paso?' },
]

export function semanaActual(hoy = new Date()) {
  const lunes = startOfWeek(hoy, { weekStartsOn: 1 })
  return { desde: toKey(lunes), hasta: toKey(addDays(lunes, 6)) }
}

export function grupoDe(proxima: CrmAccion | undefined, hoy = todayKey()): Grupo {
  if (!proxima) return 'sinAccion'
  if (!proxima.fecha) return 'sinFecha'
  if (proxima.fecha < hoy) return 'vencidas'
  const { hasta } = semanaActual(parseISO(hoy))
  return proxima.fecha <= hasta ? 'semana' : 'futuras'
}

export const etiquetaTipo = (a: CrmAccion, opp?: CrmOportunidad) =>
  a.esLnr ? 'LNR' : opp ? tipoDe(opp.etapa) : 'sin venta'

export const etiquetaTipoAccion = (tipo: string) => TIPOS_ACCION.find((t) => t.id === tipo)?.label ?? (tipo || 'Acción')
