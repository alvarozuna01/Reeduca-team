import { useMemo, useState, type ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { addWeeks, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import type { Task } from '../types'
import { dayName, rangeLabel, tasksOfDay, toKey, todayKey, weekDays } from '../lib/utils'
import { useIsMobile } from '../lib/useIsMobile'
import { useApp } from '../state/AppContext'
import TaskCard from '../components/TaskCard'

type Cols = Record<string, string[]>

// Prioriza la posición real del puntero (clave para mover tarjetas entre días,
// incluso hacia zonas vacías de otra columna); si no hay match, usa closestCorners.
const collisionDetection: CollisionDetection = (args) => {
  const within = pointerWithin(args)
  return within.length ? within : closestCorners(args)
}

// En el celular, las pastillas de día son zonas para soltar: usan id "chip-FECHA".
const resolveKey = (id: string) => (id.startsWith('chip-') ? id.slice(5) : id)

export default function Agenda({
  onEdit,
  onNew,
}: {
  onEdit: (t: Task) => void
  onNew: (defaults: Partial<Task>) => void
}) {
  const { tasks, projects, users, upsertTask, upsertTasks } = useApp()
  const isMobile = useIsMobile()
  const [anchor, setAnchor] = useState(() => new Date())
  const [dayIdx, setDayIdx] = useState(() => new Date().getDay())
  const days = useMemo(() => weekDays(anchor), [anchor])
  const dayKeys = useMemo(() => days.map(toKey), [days])

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])

  const derived: Cols = useMemo(() => {
    const m: Cols = {}
    for (const k of dayKeys) m[k] = tasksOfDay(tasks, k).map((t) => t.id)
    return m
  }, [tasks, dayKeys])

  // Durante el drag trabajamos sobre una copia local de las columnas
  const [cols, setCols] = useState<Cols | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const view = cols ?? derived
  const activeTask = activeId ? taskById.get(activeId) : undefined

  // Mouse: arrastra tras 6px de movimiento. Táctil: mantener apretado 250ms
  // (así el scroll con el dedo no se confunde con un arrastre).
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )

  const findCol = (id: string, m: Cols) => (id in m ? id : Object.keys(m).find((k) => m[k].includes(id)))

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id))
    setCols(Object.fromEntries(Object.entries(derived).map(([k, v]) => [k, [...v]])))
  }

  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e
    if (!over) return
    const a = String(active.id)
    const o = resolveKey(String(over.id))
    setCols((prev) => {
      if (!prev) return prev
      const from = findCol(a, prev)
      const to = findCol(o, prev)
      if (!from || !to || from === to) return prev
      const next = { ...prev, [from]: prev[from].filter((x) => x !== a) }
      const target = [...next[to]]
      const overIndex = o in prev ? target.length : target.indexOf(o)
      const insertAt = overIndex === -1 ? target.length : overIndex
      target.splice(insertAt, 0, a)
      next[to] = target
      return next
    })
  }

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    const a = String(active.id)
    setActiveId(null)
    if (!cols) return
    let final = cols
    if (over) {
      const o = resolveKey(String(over.id))
      const from = findCol(a, cols)
      const to = findCol(o, cols)
      if (from && to && from === to && a !== o && !(o in cols)) {
        final = { ...cols, [from]: arrayMove(cols[from], cols[from].indexOf(a), cols[from].indexOf(o)) }
      }
    }
    const changed: Task[] = []
    for (const [dateKey, ids] of Object.entries(final)) {
      ids.forEach((id, i) => {
        const t = taskById.get(id)
        if (t && (t.date !== dateKey || t.position !== i)) changed.push({ ...t, date: dateKey, position: i })
      })
    }
    if (changed.length) upsertTasks(changed)
    setCols(null)
  }

  const onDragCancel = () => {
    setActiveId(null)
    setCols(null)
  }

  const toggleCheck = (t: Task, itemId: string) =>
    upsertTask({ ...t, checklist: t.checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c)) })

  const cardsFor = (key: string) =>
    (view[key] ?? []).map((id) => {
      const t = taskById.get(id)
      if (!t) return null
      return (
        <SortableCard key={id} task={t}>
          <TaskCard
            task={t}
            project={projectById.get(t.projectId)}
            assignees={t.assigneeIds.map((aid) => userById.get(aid)!).filter(Boolean)}
            onOpen={() => onEdit(t)}
            onToggleCheck={(itemId) => toggleCheck(t, itemId)}
          />
        </SortableCard>
      )
    })

  const navBtn =
    'grid size-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50'

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-3 pt-3 pb-1 md:px-4">
        <button onClick={() => setAnchor((d) => addWeeks(d, -1))} className={navBtn} title="Semana anterior">
          <ChevronLeft size={16} />
        </button>
        <button onClick={() => setAnchor((d) => addWeeks(d, 1))} className={navBtn} title="Semana siguiente">
          <ChevronRight size={16} />
        </button>
        <button
          onClick={() => {
            setAnchor(new Date())
            setDayIdx(new Date().getDay())
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-600 hover:bg-slate-50"
        >
          Hoy
        </button>
        <span className="ml-1 text-sm font-black text-slate-700 capitalize md:ml-2">{rangeLabel(days)}</span>
        <span className="ml-auto hidden text-[11px] font-bold text-slate-400 md:block">
          Arrastrá las tarjetas para cambiarlas de día o reordenar su prioridad
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        {isMobile ? (
          <>
            <div className="flex justify-between gap-1 px-3 pt-1.5 pb-2">
              {days.map((d, i) => (
                <DayChip key={toKey(d)} date={d} selected={i === dayIdx} onSelect={() => setDayIdx(i)} />
              ))}
            </div>
            <p className="px-3 pb-1.5 text-center text-[10px] font-bold text-slate-400">
              Mantené apretada una tarjeta para arrastrarla; soltala sobre un día de arriba para moverla.
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
              <div className="flex min-h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <DayColumn
                  date={days[dayIdx]}
                  ids={view[dayKeys[dayIdx]] ?? []}
                  onAdd={() => onNew({ date: dayKeys[dayIdx] })}
                >
                  {cardsFor(dayKeys[dayIdx])}
                </DayColumn>
              </div>
            </div>
          </>
        ) : (
          <div className="min-h-0 flex-1 px-4 pt-2 pb-4">
            <div className="h-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="grid min-h-full min-w-[1080px] grid-cols-7">
                {days.map((d) => {
                  const key = toKey(d)
                  return (
                    <DayColumn key={key} date={d} ids={view[key] ?? []} onAdd={() => onNew({ date: key })}>
                      {cardsFor(key)}
                    </DayColumn>
                  )
                })}
              </div>
            </div>
          </div>
        )}
        <DragOverlay>
          {activeTask ? (
            <TaskCard
              task={activeTask}
              project={projectById.get(activeTask.projectId)}
              assignees={activeTask.assigneeIds.map((aid) => userById.get(aid)!).filter(Boolean)}
              overlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

/** Pastilla de día del modo celular: se toca para cambiar de día y acepta tarjetas soltadas. */
function DayChip({ date, selected, onSelect }: { date: Date; selected: boolean; onSelect: () => void }) {
  const key = toKey(date)
  const isToday = key === todayKey()
  const { setNodeRef, isOver } = useDroppable({ id: `chip-${key}` })
  return (
    <button
      ref={setNodeRef}
      onClick={onSelect}
      className={`flex min-w-0 flex-1 flex-col items-center rounded-xl border py-1.5 transition ${
        selected
          ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
          : isOver
            ? 'scale-105 border-blue-400 bg-blue-50 text-blue-700'
            : 'border-slate-200 bg-white text-slate-500'
      }`}
    >
      <span className="text-[9px] font-extrabold uppercase">{format(date, 'EEEEE', { locale: es })}</span>
      <span className={`text-sm font-black ${!selected && isToday ? 'text-blue-600' : ''}`}>{date.getDate()}</span>
    </button>
  )
}

function DayColumn({
  date,
  ids,
  onAdd,
  children,
}: {
  date: Date
  ids: string[]
  onAdd: () => void
  children: ReactNode
}) {
  const key = toKey(date)
  const isToday = key === todayKey()
  const { setNodeRef, isOver } = useDroppable({ id: key })

  return (
    <div className="group flex min-w-0 flex-1 flex-col border-r border-slate-200 last:border-r-0">
      <div className="sticky top-0 z-10">
        <div
          className={`px-2 py-2 text-center text-[11px] font-extrabold tracking-[0.14em] uppercase ${
            isToday ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600'
          }`}
        >
          {dayName(date)}
        </div>
        <div
          className={`flex items-center justify-end px-2 py-0.5 text-xs font-bold ${
            isToday ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {date.getDate()}
        </div>
      </div>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className={`flex-1 space-y-2 p-2 transition-colors ${isOver ? 'bg-blue-50/60' : ''}`}>
          {children}
          <button
            onClick={onAdd}
            className="w-full rounded-lg border border-dashed border-slate-200 py-1.5 text-[11px] font-bold text-slate-400 transition hover:bg-slate-50 md:opacity-0 md:group-hover:opacity-100"
          >
            <Plus size={12} className="mr-0.5 inline" /> Agregar
          </button>
        </div>
      </SortableContext>
    </div>
  )
}

function SortableCard({ task, children }: { task: Task; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, touchAction: 'manipulation' }}
      {...attributes}
      {...listeners}
      className={isDragging ? 'opacity-30' : undefined}
    >
      {children}
    </div>
  )
}
