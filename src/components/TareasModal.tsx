import { useMemo, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Inbox, Plus, SquareKanban } from 'lucide-react'
import type { Status, Task } from '../types'
import { canEditTask, isOverdue, textOn, toKey, todayKey } from '../lib/utils'
import { useIsMobile } from '../lib/useIsMobile'
import { useApp } from '../state/AppContext'
import Modal from './Modal'
import { AvatarStack } from './Avatar'
import { CommentBadge } from './Comments'
import { HideToggle } from './MultiFilter'
import { ImportancePill, UrgentPill } from './Stars'

/** Fila compacta de una tarea: check rápido, título, marcas y responsables. */
export function TaskRow({ task, onEdit }: { task: Task; onEdit: () => void }) {
  const { users, currentUser, isAdmin, upsertTask } = useApp()
  const done = task.status === 'done'
  const editable = canEditTask(task, currentUser?.id, isAdmin)
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 transition hover:bg-slate-50">
      <button
        disabled={!editable}
        onClick={() => upsertTask({ ...task, status: done ? 'todo' : 'done' })}
        title={!editable ? 'Solo sus responsables o un Gerente' : done ? 'Marcar pendiente' : 'Marcar completada'}
        className={`${done ? 'text-emerald-500' : 'text-slate-300 hover:text-emerald-400'} disabled:cursor-not-allowed disabled:opacity-40`}
      >
        <CheckCircle2 size={17} className={done ? 'fill-emerald-100' : ''} />
      </button>
      <button onClick={onEdit} className="min-w-0 flex-1 text-left">
        <span className={`block truncate text-sm font-bold ${done ? 'text-slate-300 line-through' : 'text-slate-600'}`}>
          {task.title}
        </span>
      </button>
      {task.urgent && !done && <UrgentPill />}
      {isOverdue(task) && (
        <span className="rounded-sm bg-[#e5484d] px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-white uppercase">
          Atrasada
        </span>
      )}
      <ImportancePill value={task.importance} />
      <CommentBadge taskId={task.id} />
      <span className="text-[11px] font-semibold whitespace-nowrap text-slate-400">
        {task.date ? format(parseISO(task.date), 'd MMM', { locale: es }) : '📥'}
        {task.startTime ? ` · ${task.startTime}` : ''}
      </span>
      <AvatarStack users={users.filter((u) => task.assigneeIds.includes(u.id))} size={17} />
    </div>
  )
}

const COLUMNAS: { status: Status; label: string; dot: string }[] = [
  { status: 'todo', label: 'Por hacer', dot: '#94A3B8' },
  { status: 'doing', label: 'En progreso', dot: '#5AB6E8' },
  { status: 'done', label: 'Completado', dot: '#34C48E' },
]

/** Tablero compacto de tres columnas (o dos, si se ocultan las completadas). */
export function TareasKanban({
  list,
  onEditTask,
  ocultarHechas,
}: {
  list: Task[]
  onEditTask: (t: Task) => void
  ocultarHechas?: boolean
}) {
  const cols = ocultarHechas ? COLUMNAS.filter((c) => c.status !== 'done') : COLUMNAS
  return (
    <div className={`grid gap-3 ${cols.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
      {cols.map((col) => {
        const colTasks = list.filter((t) => t.status === col.status)
        return (
          <div key={col.status} className="rounded-xl bg-slate-100/70 p-2">
            <div className="flex items-center gap-2 px-1.5 pb-1.5">
              <span className="size-2.5 rounded-full" style={{ background: col.dot }} />
              <span className="text-xs font-extrabold text-slate-600">{col.label}</span>
              <span className="ml-auto rounded-full bg-white px-1.5 text-[10px] font-extrabold text-slate-400">
                {colTasks.length}
              </span>
            </div>
            <div className="divide-y divide-slate-100 rounded-lg bg-white">
              {colTasks.length === 0 && <p className="py-4 text-center text-[11px] font-semibold text-slate-300">Vacío</p>}
              {colTasks.map((t) => (
                <TaskRow key={t.id} task={t} onEdit={() => onEditTask(t)} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Mes que conviene mostrar primero: el actual, o el de la tarea más cercana a hoy si este mes no tiene. */
function mesInicial(fechadas: Task[], hoy: string): Date {
  const actual = startOfMonth(parseISO(hoy))
  if (!fechadas.length || fechadas.some((t) => t.date!.slice(0, 7) === hoy.slice(0, 7))) return actual
  const ref = Date.parse(hoy)
  const cercana = [...fechadas].sort(
    (a, b) => Math.abs(Date.parse(a.date!) - ref) - Math.abs(Date.parse(b.date!) - ref),
  )[0]
  return startOfMonth(parseISO(cercana.date!))
}

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

/**
 * Calendario mensual: cada día muestra sus tareas con el color del proyecto
 * (en celular, como puntitos). Tocar un día lista sus tareas debajo.
 */
export function CalendarioMes({ list, onEditTask }: { list: Task[]; onEditTask: (t: Task) => void }) {
  const { projects } = useApp()
  const isMobile = useIsMobile()
  const hoy = todayKey()
  const colorDe = useMemo(() => new Map(projects.map((p) => [p.id, p.color])), [projects])
  const fechadas = useMemo(() => list.filter((t) => t.date), [list])
  const sinFecha = useMemo(() => list.filter((t) => !t.date), [list])
  const [mes, setMes] = useState(() => mesInicial(fechadas, hoy))
  const [diaSel, setDiaSel] = useState<string | null>(null)

  const porDia = useMemo(() => {
    const m = new Map<string, Task[]>()
    for (const t of fechadas) m.set(t.date!, [...(m.get(t.date!) ?? []), t])
    for (const v of m.values()) v.sort((a, b) => a.position - b.position)
    return m
  }, [fechadas])
  const dias = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(mes), { weekStartsOn: 0 }),
        end: endOfWeek(endOfMonth(mes), { weekStartsOn: 0 }),
      }),
    [mes],
  )
  const claveMes = format(mes, 'yyyy-MM')
  const enMes = fechadas.filter((t) => t.date!.startsWith(claveMes)).length
  const delDia = diaSel ? (porDia.get(diaSel) ?? []) : []

  const irA = (m: Date) => {
    setMes(m)
    setDiaSel(null)
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => irA(addMonths(mes, -1))}
          title="Mes anterior"
          className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="min-w-32 text-center text-sm font-extrabold text-slate-700 capitalize">
          {format(mes, 'MMMM yyyy', { locale: es })}
        </span>
        <button
          onClick={() => irA(addMonths(mes, 1))}
          title="Mes siguiente"
          className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={() => irA(startOfMonth(parseISO(hoy)))}
          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-extrabold text-slate-500 hover:bg-slate-50"
        >
          Hoy
        </button>
        <span className="ml-auto text-[11px] font-bold text-slate-400">
          {enMes} tarea{enMes === 1 ? '' : 's'} este mes
        </span>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200">
        {DIAS.map((d) => (
          <div key={d} className="bg-slate-50 py-1.5 text-center text-[10px] font-extrabold tracking-wide text-slate-400 uppercase">
            {d}
          </div>
        ))}
        {dias.map((d) => {
          const k = toKey(d)
          const ts = porDia.get(k) ?? []
          const fuera = !isSameMonth(d, mes)
          const sel = k === diaSel
          return (
            <div
              key={k}
              onClick={() => setDiaSel(sel ? null : k)}
              className={`min-h-14 cursor-pointer p-1 transition md:min-h-24 ${fuera ? 'bg-slate-50' : 'bg-white'} ${
                sel ? 'ring-2 ring-blue-400 ring-inset' : 'hover:bg-blue-50/50'
              }`}
            >
              <span
                className={`inline-grid size-5 place-items-center rounded-full text-[11px] font-extrabold ${
                  k === hoy ? 'bg-blue-600 text-white' : fuera ? 'text-slate-300' : 'text-slate-500'
                }`}
              >
                {d.getDate()}
              </span>
              {isMobile ? (
                <div className="mt-1 flex flex-wrap gap-0.5">
                  {ts.slice(0, 6).map((t) => (
                    <i
                      key={t.id}
                      className="size-1.5 rounded-full"
                      style={{ background: colorDe.get(t.projectId) ?? '#94A3B8', opacity: t.status === 'done' ? 0.4 : 1 }}
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-1 space-y-0.5">
                  {ts.slice(0, 3).map((t) => {
                    const c = colorDe.get(t.projectId) ?? '#94A3B8'
                    return (
                      <button
                        key={t.id}
                        type="button"
                        title={t.title}
                        onClick={(e) => {
                          e.stopPropagation()
                          onEditTask(t)
                        }}
                        className={`block w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-bold ${
                          t.status === 'done' ? 'line-through opacity-50' : ''
                        }`}
                        style={{ background: c, color: textOn(c) }}
                      >
                        {t.title}
                      </button>
                    )
                  })}
                  {ts.length > 3 && (
                    <span className="block px-1 text-[10px] font-extrabold text-slate-400">+{ts.length - 3} más</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {diaSel && (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-extrabold tracking-wide text-slate-400 uppercase">
            {format(parseISO(diaSel), "EEEE d 'de' MMMM", { locale: es })} · {delDia.length}
          </p>
          <div className="divide-y divide-slate-50 rounded-xl border border-slate-100">
            {delDia.length ? (
              delDia.map((t) => <TaskRow key={t.id} task={t} onEdit={() => onEditTask(t)} />)
            ) : (
              <p className="py-4 text-center text-xs font-semibold text-slate-300">Sin tareas este día.</p>
            )}
          </div>
        </div>
      )}

      {sinFecha.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-extrabold tracking-wide text-slate-400 uppercase">
            <Inbox size={12} /> Sin fecha · {sinFecha.length}
          </p>
          <div className="divide-y divide-slate-50 rounded-xl border border-slate-100">
            {sinFecha.map((t) => (
              <TaskRow key={t.id} task={t} onEdit={() => onEditTask(t)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Pop-up con un grupo de tareas (un proyecto, una persona, un hito, un número
 * del Panel…) en formato Kanban o calendario. El filtro se aplica en vivo:
 * si alguien cambia una tarea, el pop-up se actualiza solo.
 */
export default function TareasModal({
  titulo,
  subtitulo,
  color,
  filtro,
  nuevaTarea,
  onClose,
  onEditTask,
  onNewTask,
}: {
  titulo: string
  subtitulo?: string
  color?: string
  filtro: (t: Task) => boolean
  nuevaTarea?: Partial<Task>
  onClose: () => void
  onEditTask: (t: Task) => void
  onNewTask?: (defaults: Partial<Task>) => void
}) {
  const { tasks } = useApp()
  const [modo, setModo] = useState<'kanban' | 'calendario'>('kanban')
  const [ocultarHechas, setOcultarHechas] = useState(false)

  const todas = useMemo(
    () =>
      tasks
        .filter(filtro)
        .sort((a, b) => (a.date ?? '0000').localeCompare(b.date ?? '0000') || a.position - b.position),
    [tasks, filtro],
  )
  const list = useMemo(() => (ocultarHechas ? todas.filter((t) => t.status !== 'done') : todas), [todas, ocultarHechas])
  const hechas = todas.length - todas.filter((t) => t.status !== 'done').length

  const pestana = (m: typeof modo) =>
    `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-extrabold transition ${
      modo === m ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
    }`

  return (
    <Modal title={titulo} onClose={onClose} width="max-w-5xl">
      {color && <div className="-mx-5 -mt-4 mb-4 h-1.5" style={{ background: color }} />}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-400">
          {subtitulo ? `${subtitulo} · ` : ''}
          {todas.length} tarea{todas.length === 1 ? '' : 's'} · {hechas} completada{hechas === 1 ? '' : 's'}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <HideToggle hidden={ocultarHechas} onChange={setOcultarHechas} label="Completadas" />
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
            <button onClick={() => setModo('kanban')} className={pestana('kanban')}>
              <SquareKanban size={13} /> Kanban
            </button>
            <button onClick={() => setModo('calendario')} className={pestana('calendario')}>
              <CalendarDays size={13} /> Calendario
            </button>
          </div>
          {nuevaTarea && onNewTask && (
            <button
              onClick={() => onNewTask(nuevaTarea)}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-blue-700"
            >
              <Plus size={14} /> Nueva tarea
            </button>
          )}
        </div>
      </div>

      {todas.length === 0 ? (
        <p className="py-10 text-center text-sm font-semibold text-slate-300">No hay tareas acá.</p>
      ) : modo === 'kanban' ? (
        <TareasKanban list={list} onEditTask={onEditTask} ocultarHechas={ocultarHechas} />
      ) : (
        <CalendarioMes list={list} onEditTask={onEditTask} />
      )}
    </Modal>
  )
}
