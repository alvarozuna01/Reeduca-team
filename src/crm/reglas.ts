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

/** Los colores del CRM de la planilla: verde hecha, naranja pendiente, rojo vencida. */
export const COLOR_SEMAFORO: Record<Semaforo, { chip: string; punto: string; fondo: string }> = {
  hecha: { chip: 'border-[#48A859]/30 bg-[#EFF7F0] text-[#2E6B38]', punto: '#48A859', fondo: '#EFF7F0' },
  pendiente: { chip: 'border-[#F39221]/30 bg-[#FEF4E8] text-[#8A4B0B]', punto: '#F39221', fondo: '#FEF4E8' },
  vencida: { chip: 'border-[#C63A2B]/30 bg-[#FBEBEA] text-[#9B2C20]', punto: '#C63A2B', fondo: '#FBEBEA' },
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

export function semanaActual(hoy = new Date()) {
  const lunes = startOfWeek(hoy, { weekStartsOn: 1 })
  return { desde: toKey(lunes), hasta: toKey(addDays(lunes, 6)) }
}

/**
 * En qué desplegables aparece una oportunidad: en cada uno donde tenga al menos
 * una acción pendiente (vencida, de esta semana, o futura / sin fecha).
 */
export function urgenciasDe(cadena: CrmAccion[], hoy = todayKey()) {
  const { hasta } = semanaActual(parseISO(hoy))
  const u = { vencidas: false, semana: false, futuras: false }
  for (const a of cadena) {
    if (a.estado === 'CONCRETADO') continue
    if (a.fecha && a.fecha < hoy) u.vencidas = true
    else if (a.fecha && a.fecha <= hasta) u.semana = true
    else u.futuras = true
  }
  return u
}

/** Marcar hecha: queda CONCRETADO con la fecha de hoy (como en la planilla). */
export const comoHecha = (a: CrmAccion): CrmAccion => ({ ...a, estado: 'CONCRETADO', fecha: todayKey() })

/** Adivina el tipo de acción por el texto (la misma regla de la planilla). */
export function adivinarTipo(texto: string) {
  const t = texto.toLowerCase()
  if (/invitaci.n lnr|liga nacional|\blnr\b|invitar a la liga/.test(t)) return 'lnr'
  if (/presupuesto|cotiz/.test(t)) return 'presupuesto'
  if (/flyer|folleto|volante|pedir contacto|dejar material/.test(t)) return 'flyer'
  if (/whatsapp|wpp|mensaje|msj/.test(t)) return 'mensaje'
  if (/mail|correo|email|escrib|invita/.test(t)) return 'mail'
  if (/reuni|presencial|en persona|taller|visita/.test(t)) return 'reunion'
  if (/llamar|llamada|llam/.test(t)) return 'llamada'
  return 'otro'
}

export const etiquetaTipo = (a: CrmAccion, opp?: CrmOportunidad) =>
  a.esLnr ? 'LNR' : opp ? tipoDe(opp.etapa) : 'sin venta'

export const etiquetaTipoAccion = (tipo: string) => TIPOS_ACCION.find((t) => t.id === tipo)?.label ?? (tipo || 'Acción')
export const iconoTipo = (tipo: string) => TIPOS_ACCION.find((t) => t.id === tipo)?.icono ?? '•'
