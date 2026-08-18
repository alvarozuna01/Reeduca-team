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

export const isOverdue = (t: Task) => t.status !== 'done' && t.date < todayKey()

export const STATUS_LABEL: Record<Status, string> = {
  todo: 'Por hacer',
  doing: 'En progreso',
  done: 'Completado',
}

export const PROJECT_COLORS = [
  '#F0A62B',
  '#5AB6E8',
  '#F26CA7',
  '#34C48E',
  '#8B7CF6',
  '#F2745F',
  '#26B8B0',
  '#64748B',
]

export const USER_COLORS = [
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
  '#64748B',
  '#3B82F6',
  '#EF4444',
  '#22C55E',
]

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

export const taskInWeek = (t: Task, w: WeekInfo) => t.date >= w.start && t.date <= w.end

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
