import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Project, Status, Task, User } from '../types'
import { isOverdue, taskInWeek, upcomingWeeks, weekInfo, weekLoadColor } from '../lib/utils'
import { addWeeks } from 'date-fns'
import { useApp } from '../state/AppContext'
import { AvatarStack } from '../components/Avatar'
import { ImportancePill, UrgentPill } from '../components/Stars'
import MultiFilter from '../components/MultiFilter'

const COLS: { status: Status; label: string; dot: string }[] = [
  { status: 'todo', label: 'Por hacer', dot: '#94A3B8' },
  { status: 'doing', label: 'En progreso', dot: '#5AB6E8' },
  { status: 'done', label: 'Completado', dot: '#34C48E' },
]

const collisionDetection: CollisionDetection = (args) => {
  const within = pointerWithin(args)
  return within.length ? within : rectIntersection(args)
}

const selCls =
  'rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 focus:border-blue-400 focus:outline-none'

export default function Kanban({ onEdit }: { onEdit: (t: Task) => void }) {
  const { tasks, projects, users, upsertTask } = useApp()
  const [projectFilter, setProjectFilter] = useState<string[]>([])
  const [userFilter, setUserFilter] = useState<string[]>([])
  const [weekFilter, setWeekFilter] = useState('') // clave del domingo de la semana, '' = todas
  const [activeId, setActiveId] = useState<string | null>(null)

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])

  // Opciones del filtro de semana: la anterior, la actual y las próximas 6
  const weekOptions = useMemo(() => upcomingWeeks(8, addWeeks(new Date(), -1)), [])
  // Semáforo: la semana actual y las próximas 5
  const semaphore = useMemo(() => {
    const weeks = upcomingWeeks(6)
    return weeks.map((w) => {
      const count = tasks.filter((t) => t.status !== 'done' && taskInWeek(t, w)).length
      return { week: w, count, ...weekLoadColor(count) }
    })
  }, [tasks])
  const currentWeekStart = weekInfo(new Date()).start

  const filtered = useMemo(() => {
    const week = weekFilter ? weekOptions.find((w) => w.start === weekFilter) : undefined
    return tasks
      .filter(
        (t) =>
          (projectFilter.length === 0 || projectFilter.includes(t.projectId)) &&
          (userFilter.length === 0 || t.assigneeIds.some((a) => userFilter.includes(a))) &&
          (!week || taskInWeek(t, week)),
      )
      .sort((a, b) => (a.date ?? '9999-99').localeCompare(b.date ?? '9999-99') || a.position - b.position)
  }, [tasks, projectFilter, userFilter, weekFilter, weekOptions])

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : undefined
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const status = String(over.id) as Status
    const task = tasks.find((t) => t.id === String(active.id))
    if (task && COLS.some((c) => c.status === status) && task.status !== status) {
      upsertTask({ ...task, status })
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-1">
        <span className="text-sm font-black text-slate-700">Tablero</span>
        <span className="hidden text-[11px] font-bold text-slate-400 sm:block">
          · Arrastrá una tarjeta a otra columna para cambiar su estado
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <MultiFilter
            label="Proyectos"
            options={projects.map((p) => ({ id: p.id, label: p.name, color: p.color }))}
            selected={projectFilter}
            onChange={setProjectFilter}
          />
          <select value={weekFilter} onChange={(e) => setWeekFilter(e.target.value)} className={selCls}>
            <option value="">Todas las semanas</option>
            {weekOptions.map((w) => (
              <option key={w.start} value={w.start}>
                {w.label}
              </option>
            ))}
          </select>
          <MultiFilter
            label="Personas"
            options={users.map((u) => ({ id: u.id, label: u.name, user: u }))}
            selected={userFilter}
            onChange={setUserFilter}
          />
        </div>
      </div>

      {/* Semáforo de carga por semana */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 pt-1.5">
        <span className="mr-1 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">
          Carga próximas semanas
        </span>
        {semaphore.map(({ week, count, color, label }) => {
          const active = weekFilter === week.start
          return (
            <button
              key={week.start}
              onClick={() => setWeekFilter(active ? '' : week.start)}
              title={`${week.label} — ${count} tarea${count === 1 ? '' : 's'} pendiente${count === 1 ? '' : 's'} (${label})`}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold transition ${
                active
                  ? 'border-blue-400 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
              }`}
            >
              <span className="size-2.5 rounded-full" style={{ background: color }} />
              {week.shortLabel}
              {week.start === currentWeekStart && <span className="text-[9px] font-black text-blue-500">HOY</span>}
              <span className="text-slate-300">·</span>
              <span className="text-slate-400">{count}</span>
            </button>
          )
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 pt-2 pb-4">
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div className="grid grid-cols-1 gap-3 md:h-full md:min-w-[760px] md:grid-cols-3">
            {COLS.map((col) => {
              const colTasks = filtered.filter((t) => t.status === col.status)
              return (
                <Column key={col.status} status={col.status} label={col.label} dot={col.dot} count={colTasks.length}>
                  {colTasks.map((t) => (
                    <DraggableCard key={t.id} id={t.id}>
                      <KanbanCard
                        task={t}
                        project={projectById.get(t.projectId)}
                        assignees={t.assigneeIds.map((id) => userById.get(id)!).filter(Boolean)}
                        onOpen={() => onEdit(t)}
                      />
                    </DraggableCard>
                  ))}
                </Column>
              )
            })}
          </div>
          <DragOverlay>
            {activeTask ? (
              <div className="rotate-2">
                <KanbanCard
                  task={activeTask}
                  project={projectById.get(activeTask.projectId)}
                  assignees={activeTask.assigneeIds.map((id) => userById.get(id)!).filter(Boolean)}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}

function Column({
  status,
  label,
  dot,
  count,
  children,
}: {
  status: Status
  label: string
  dot: string
  count: number
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <div className={`flex min-h-32 flex-col rounded-xl bg-slate-100/80 p-2.5 transition md:min-h-[300px] ${isOver ? 'ring-2 ring-blue-300' : ''}`}>
      <div className="flex items-center gap-2 px-1 pb-2">
        <span className="size-2.5 rounded-full" style={{ background: dot }} />
        <span className="text-sm font-extrabold text-slate-600">{label}</span>
        <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[11px] font-extrabold text-slate-400">{count}</span>
      </div>
      <div ref={setNodeRef} className="flex-1 space-y-2">
        {children}
      </div>
    </div>
  )
}

function DraggableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ touchAction: 'manipulation' }}
      className={isDragging ? 'opacity-30' : undefined}
    >
      {children}
    </div>
  )
}

function KanbanCard({
  task,
  project,
  assignees,
  onOpen,
}: {
  task: Task
  project?: Project
  assignees: User[]
  onOpen?: () => void
}) {
  const done = task.status === 'done'
  return (
    <div
      onClick={onOpen}
      className={`cursor-pointer rounded-lg border-l-4 bg-white p-2.5 shadow-sm transition select-none hover:shadow-md ${
        task.urgent && !done ? 'ring-2 ring-[#e5484d]/70' : ''
      }`}
      style={{ borderLeftColor: project?.color ?? '#94A3B8' }}
    >
      <p className={`text-xs leading-snug font-extrabold text-slate-700 ${done ? 'line-through opacity-60' : ''}`}>
        {task.title}
      </p>
      <p className="mt-1 text-[11px] font-semibold text-slate-400 capitalize">
        {task.date ? format(parseISO(task.date), 'EEE d MMM', { locale: es }) : '📥 Sin fecha'}
        {task.startTime ? ` · ${task.startTime} hs.` : ''}
        {project ? ` · ${project.name}` : ''}
      </p>
      <div className="mt-1.5 flex items-center justify-between gap-1">
        <span className="flex flex-wrap items-center gap-1">
          {task.urgent && !done && <UrgentPill />}
          {isOverdue(task) && (
            <span className="rounded-sm bg-[#e5484d] px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-white uppercase">
              Atrasada
            </span>
          )}
          <ImportancePill value={task.importance} />
        </span>
        <AvatarStack users={assignees} size={18} />
      </div>
    </div>
  )
}
