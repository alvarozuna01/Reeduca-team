import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Hito, Kickoff, KickoffBriefing, KickoffNotas, Minute, Task, User } from '../types'
import { toKey, todayKey } from './utils'

/**
 * Datos reales de los cinco bloques del kickoff. Todo se calcula al abrir la
 * pantalla con lo que ya está en la base (sin procesos programados).
 */

/** El lunes que corresponde: de lunes a jueves, el de esta semana; de viernes a domingo, el próximo. */
export function lunesObjetivo(hoy: Date = new Date()): string {
  const dia = hoy.getDay() // 0 domingo … 6 sábado
  const lunes = startOfWeek(hoy, { weekStartsOn: 1 })
  return toKey(dia === 0 || dia >= 5 ? addDays(lunes, 7) : lunes)
}

/** La semana que arranca ese lunes (lunes a domingo). */
export function semanaDe(fecha: string) {
  const lunes = parseISO(fecha)
  return { desde: fecha, hasta: toKey(addDays(lunes, 6)) }
}

export const fechaLarga = (fecha: string) => format(parseISO(fecha), "EEEE d 'de' MMMM", { locale: es })

export interface CerroPersona {
  user: User
  tareas: Task[]
}

export interface Incumplido {
  id: string
  texto: string
  responsables: User[]
  dias: number
  task?: Task
  convertida: boolean
}

export interface SemanaPersona {
  user: User
  briefing?: KickoffBriefing
  tareas: Task[]
}

export interface FechaProxima {
  id: string
  titulo: string
  fecha: string
  hora?: string
  tipo: 'hito' | 'agenda'
  color: string
  involucra: string[] // ids de responsables (para el briefing personal)
}

export interface BloquesKickoff {
  cerradas: CerroPersona[]
  totalCerradas: number
  incumplidos: Incumplido[]
  anterior?: Kickoff
  semana: SemanaPersona[]
  fechas: FechaProxima[]
  decisiones: Task[]
}

export interface DatosKickoff {
  kickoff: Kickoff
  kickoffs: Kickoff[]
  minutes: Minute[]
  tasks: Task[]
  users: User[]
  hitos: Hito[]
  briefings: KickoffBriefing[]
  colorDeProyecto: (projectId: string) => string
}

export function calcularBloques(d: DatosKickoff): BloquesKickoff {
  const { kickoff, kickoffs, minutes, tasks, users, hitos, briefings, colorDeProyecto } = d
  const hoy = todayKey()
  const { desde: lunes, hasta: domingo } = semanaDe(kickoff.fecha)
  const userById = new Map(users.map((u) => [u.id, u]))

  // Bloque 1 — lo que se cerró en los siete días previos al lunes, por persona.
  const desdeCierre = toKey(addDays(parseISO(kickoff.fecha), -7))
  const cerradasTodas = tasks.filter(
    (t) => t.completedAt && t.completedAt.slice(0, 10) >= desdeCierre && t.completedAt.slice(0, 10) <= kickoff.fecha,
  )
  const cerradas = users
    .map((user) => ({ user, tareas: cerradasTodas.filter((t) => t.assigneeIds.includes(user.id)) }))
    .filter((c) => c.tareas.length > 0)
    .sort((a, b) => b.tareas.length - a.tareas.length)

  // Bloque 2 — lo acordado en el kickoff anterior que sigue sin cumplirse.
  const anterior = kickoffs
    .filter((k) => k.fecha < kickoff.fecha && k.minutaId)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
  const minutaAnterior = anterior ? minutes.find((m) => m.id === anterior.minutaId) : undefined
  const incumplidos: Incumplido[] = (minutaAnterior?.actions ?? [])
    .filter((a) => a.text.trim() && !a.descartada)
    .flatMap((a) => {
      const task = a.taskId ? tasks.find((t) => t.id === a.taskId) : undefined
      if (task && task.status === 'done') return []
      const referencia = task?.date ?? anterior!.fecha
      return [
        {
          id: a.id,
          texto: a.text,
          task,
          convertida: !!task,
          responsables: (task?.assigneeIds ?? (a.responsableSugeridoId ? [a.responsableSugeridoId] : []))
            .map((id) => userById.get(id))
            .filter((u): u is User => !!u),
          dias: Math.max(0, differenceInCalendarDays(parseISO(hoy), parseISO(referencia))),
        },
      ]
    })
    .sort((a, b) => b.dias - a.dias)

  // Bloque 3 — la semana de cada uno: quien tenga tareas esta semana, briefing o esté presente.
  const notas: KickoffNotas = kickoff.notas ?? {}
  const presentes = notas.presentes ?? []
  const semana = users
    .map((user) => ({
      user,
      briefing: briefings.find((b) => b.kickoffId === kickoff.id && b.usuarioId === user.id),
      tareas: tasks.filter(
        (t) => t.assigneeIds.includes(user.id) && t.date && t.date >= lunes && t.date <= domingo,
      ),
    }))
    .filter((s) => s.tareas.length > 0 || s.briefing || presentes.includes(s.user.id))
    .sort((a, b) => a.user.name.localeCompare(b.user.name, 'es'))

  // Bloque 4 — hitos y tareas con horario de los próximos catorce días.
  const hasta14 = toKey(addDays(parseISO(kickoff.fecha), 14))
  const fechas: FechaProxima[] = ([
    ...hitos
      .filter((h) => h.date && h.date >= kickoff.fecha && h.date <= hasta14)
      .map((h) => ({
        id: `h-${h.id}`,
        titulo: h.name,
        fecha: h.date!,
        tipo: 'hito' as const,
        color: colorDeProyecto(h.projectId),
        involucra: tasks.filter((t) => t.hitoId === h.id).flatMap((t) => t.assigneeIds),
      })),
    ...tasks
      .filter((t) => t.startTime && t.date && t.date >= kickoff.fecha && t.date <= hasta14 && t.status !== 'done')
      .map((t) => ({
        id: `t-${t.id}`,
        titulo: t.title,
        fecha: t.date!,
        hora: t.startTime,
        tipo: 'agenda' as const,
        color: colorDeProyecto(t.projectId),
        involucra: t.assigneeIds,
      })),
  ] as FechaProxima[]).sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora ?? '').localeCompare(b.hora ?? ''))

  // Bloque 5 — lo que espera una decisión del Gerente.
  const decisiones = tasks
    .filter((t) => t.necesitaDecisionGg && t.status !== 'done')
    .sort((a, b) => (a.necesitaDecisionDesde ?? '9999').localeCompare(b.necesitaDecisionDesde ?? '9999'))

  return { cerradas, totalCerradas: cerradasTodas.length, incumplidos, anterior, semana, fechas, decisiones }
}

/** El resumen en texto plano que queda en la minuta al cerrar el kickoff. */
export function resumenParaMinuta(b: BloquesKickoff, notas: KickoffNotas, users: User[]): string {
  const nombre = (id: string) => users.find((u) => u.id === id)?.name ?? 'Alguien'
  const partes: string[] = []

  partes.push(
    b.cerradas.length
      ? `SE CERRÓ LA SEMANA PASADA (${b.totalCerradas})\n` +
          b.cerradas.map((c) => `- ${c.user.name}: ${c.tareas.map((t) => t.title).join('; ')}`).join('\n')
      : 'SE CERRÓ LA SEMANA PASADA\n- Sin tareas completadas registradas.',
  )

  partes.push(
    b.incumplidos.length
      ? 'QUEDÓ PENDIENTE DEL KICKOFF ANTERIOR\n' +
          b.incumplidos
            .map(
              (i) =>
                `- ${i.texto}${i.responsables.length ? ` (${i.responsables.map((u) => u.name).join(', ')})` : ''} · ${i.dias} día${i.dias === 1 ? '' : 's'}`,
            )
            .join('\n')
      : 'QUEDÓ PENDIENTE DEL KICKOFF ANTERIOR\n- Nada pendiente.',
  )

  const lineas = b.semana
    .map((s) => {
      const linea = notas.bloque3?.[s.user.id]?.trim() || s.briefing?.enQueTrabajo?.trim()
      return linea ? `- ${s.user.name}: ${linea}` : null
    })
    .filter(Boolean)
  if (lineas.length) partes.push(`LA SEMANA DE CADA UNO\n${lineas.join('\n')}`)

  const pedidos = b.semana
    .map((s) => (s.briefing?.necesitoAlgo?.trim() ? `- ${s.user.name}: ${s.briefing.necesitoAlgo.trim()}` : null))
    .filter(Boolean)
  if (pedidos.length) partes.push(`PIDIERON AYUDA\n${pedidos.join('\n')}`)

  if (b.fechas.length)
    partes.push(
      'FECHAS QUE SE VIENEN\n' +
        b.fechas.map((f) => `- ${f.titulo} · ${format(parseISO(f.fecha), "d 'de' MMMM", { locale: es })}`).join('\n'),
    )

  if (b.decisiones.length)
    partes.push('DECISIONES QUE NECESITAN AL GERENTE\n' + b.decisiones.map((t) => `- ${t.title}`).join('\n'))

  if (notas.presentes?.length) partes.push(`PRESENTES\n- ${notas.presentes.map(nombre).join(', ')}`)

  return partes.join('\n\n')
}
