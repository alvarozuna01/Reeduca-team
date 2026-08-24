import { addDays, addWeeks, format, getWeek, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Status, Task } from '../types'

export const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

export const toKey = (d: Date) => format(d, 'yyyy-MM-dd')
export const todayKey = () => toKey(new Date())

export function weekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor, { weekStartsOn: 0 })
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export const dayName = (d: Date) => format(d, 'EEEE', { locale: es })
export const rangeLabel = (days: Date[]) =>
  `${format(days[0], 'd MMM', { locale: es })} — ${format(days[6], 'd MMM', { locale: es })}`
export const longDate = (d: Date) => format(d, "EEEE d 'de' MMMM", { locale: es })

export const initials = (name: string) => name.trim().charAt(0).toUpperCase()

export const isOverdue = (t: Task) => t.status !== 'done' && !!t.date && t.date < todayKey()

/**
 * ¿Puede esta persona modificar la tarea? Los Gerentes siempre; el resto,
 * solo si está asignada (o si la tarea no tiene responsables todavía).
 * Evita ediciones accidentales de tareas ajenas.
 */
export function canEditTask(t: Task, userId: string | undefined, isAdmin: boolean): boolean {
  if (isAdmin) return true
  if (!userId) return false
  return t.assigneeIds.length === 0 || t.assigneeIds.includes(userId)
}

export const STATUS_LABEL: Record<Status, string> = {
  todo: 'Por hacer',
  doing: 'En progreso',
  done: 'Completado',
}

/**
 * Paleta pastel moderna, compartida por proyectos y personas.
 * Sobre estos fondos el texto va OSCURO (lo resuelve textOn) para
 * mantener contraste accesible.
 */
export const COLOR_PALETTE = [
  '#F9B8C6', // rosa
  '#F7C8DE', // rosa claro
  '#F2B8E8', // orquídea
  '#DCC5F7', // lila
  '#C3C8F7', // lavanda
  '#B8CFF7', // periwinkle
  '#A8D8F0', // celeste
  '#A5E1E8', // aguamarina
  '#A8E6D7', // menta
  '#B8E6B8', // verde suave
  '#CFE8A5', // pistacho
  '#E8E6A0', // lima pastel
  '#F7E39C', // manteca
  '#F7D49C', // durazno claro
  '#F7C09C', // durazno
  '#F2AFA0', // coral
  '#E8B8A8', // terracota suave
  '#D9C3A8', // arena
  '#C9CDD6', // gris azulado
  '#B8C4B8', // salvia
  // Colores oficiales de la marca (playbook ReEduca)
  '#5DADEA', // celeste ReEduca
  '#48A859', // verde ReEduca
  '#F39221', // naranja ReEduca
  '#FFF12C', // amarillo ReEduca
  '#000B96', // azul marino ReEduca
]

export const PROJECT_COLORS = COLOR_PALETTE
export const USER_COLORS = COLOR_PALETTE

/** Color de texto accesible (oscuro o blanco) según la luminosidad del fondo. */
export function textOn(bg: string): string {
  const hex = bg.replace('#', '')
  if (hex.length < 6) return '#1e293b'
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6 ? '#334155' : '#ffffff'
}

/** Tareas de un día, ordenadas por posición */
export function tasksOfDay(tasks: Task[], dateKey: string): Task[] {
  return tasks
    .filter((t) => t.date === dateKey)
    .sort((a, b) => a.position - b.position || a.title.localeCompare(b.title))
}

/* ---- Semanas (filtro y semáforo del Kanban) ---- */

export interface WeekInfo {
  start: string // YYYY-MM-DD (domingo)
  end: string // YYYY-MM-DD (sábado)
  num: number
  label: string
  shortLabel: string
}

export function weekInfo(anchor: Date): WeekInfo {
  const s = startOfWeek(anchor, { weekStartsOn: 0 })
  const e = addDays(s, 6)
  const num = getWeek(s, { weekStartsOn: 0 })
  return {
    start: toKey(s),
    end: toKey(e),
    num,
    label: `Semana ${num} · ${format(s, 'd MMM', { locale: es })} – ${format(e, 'd MMM', { locale: es })}`,
    shortLabel: `S${num}`,
  }
}

export function upcomingWeeks(count: number, from: Date = new Date()): WeekInfo[] {
  return Array.from({ length: count }, (_, i) => weekInfo(addWeeks(from, i)))
}

export const taskInWeek = (t: Task, w: WeekInfo) => !!t.date && t.date >= w.start && t.date <= w.end

/** Tareas sin fecha (bandeja), ordenadas por posición */
export function backlogTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.date).sort((a, b) => a.position - b.position || a.title.localeCompare(b.title))
}

/** Color del semáforo según volumen de tareas pendientes de la semana */
export function weekLoadColor(count: number): { color: string; label: string } {
  if (count > 10) return { color: '#e5484d', label: 'Carga alta' }
  if (count >= 3) return { color: '#F0A62B', label: 'Carga media' }
  return { color: '#34C48E', label: 'Carga liviana' }
}

/* ---- Notas ---- */

export function stripHtml(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  return (div.textContent ?? '').replace(/\s+/g, ' ').trim()
}

export const noteDate = (iso: string) => format(new Date(iso), "d MMM yyyy · HH:mm", { locale: es })
