import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarDays, CheckCircle2, Inbox, Pencil, Plus, SquareKanban, Trash2 } from 'lucide-react'
import type { Project, Task } from '../types'
import { PROJECT_COLORS, isOverdue, uid } from '../lib/utils'
import { useApp } from '../state/AppContext'
import Modal, { Field, inputCls } from '../components/Modal'
import { AvatarStack } from '../components/Avatar'
import { ImportancePill, UrgentPill } from '../components/Stars'

export default function Proyectos({
  onEditTask,
  onNewTask,
}: {
  onEditTask: (t: Task) => void
  onNewTask: (defaults: Partial<Task>) => void
}) {
  const { projects, tasks, removeProject } = useApp()
  const [editing, setEditing] = useState<Project | 'new' | null>(null)
  const [viewing, setViewing] = useState<Project | null>(null)

  const del = (p: Project) => {
    const n = tasks.filter((t) => t.projectId === p.id).length
    const warn = n ? ` Se eliminarán también sus ${n} tarea${n === 1 ? '' : 's'}.` : ''
    if (confirm(`¿Eliminar el proyecto "${p.name}"?${warn}`)) removeProject(p.id)
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-5">
        <div className="mb-4">
          <h2 className="text-xl font-black text-slate-800">Proyectos</h2>
          <p className="text-sm text-slate-400">
            Cada tarea pertenece a un proyecto y toma su color en el calendario.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const list = tasks.filter((t) => t.projectId === p.id)
            const done = list.filter((t) => t.status === 'done').length
            return (
              <div
                key={p.id}
                onClick={() => setViewing(p)}
                className="cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="h-2" style={{ background: p.color }} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-extrabold text-slate-700">{p.name}</p>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditing(p)
                        }}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        title="Editar"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          del(p)
                        }}
                        className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500"
                        title="Eliminar"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  {p.description && <p className="mt-1 text-xs leading-snug text-slate-400">{p.description}</p>}
                  <p className="mt-3 text-[11px] font-bold text-slate-400">
                    {list.length} tarea{list.length === 1 ? '' : 's'} · {done} completada{done === 1 ? '' : 's'}
                  </p>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full"
                      style={{ width: list.length ? `${(done / list.length) * 100}%` : 0, background: p.color }}
                    />
                  </div>
                </div>
              </div>
            )
          })}

          <button
            onClick={() => setEditing('new')}
            className="grid min-h-32 place-items-center rounded-xl border-2 border-dashed border-slate-200 text-slate-400 transition hover:border-blue-300 hover:text-blue-500"
          >
            <span className="flex items-center gap-1.5 text-sm font-extrabold">
              <Plus size={16} /> Nuevo proyecto
            </span>
          </button>
        </div>
      </div>

      {editing && <ProjectModal project={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {viewing && (
        <ProjectDetailModal
          project={viewing}
          onClose={() => setViewing(null)}
          onEditTask={onEditTask}
          onNewTask={onNewTask}
        />
      )}
    </div>
  )
}

/* ---- Pop-up de detalle: las acciones del proyecto en vista agenda o kanban ---- */

function ProjectDetailModal({
  project,
  onClose,
  onEditTask,
  onNewTask,
}: {
  project: Project
  onClose: () => void
  onEditTask: (t: Task) => void
  onNewTask: (defaults: Partial<Task>) => void
}) {
  const { tasks } = useApp()
  const [mode, setMode] = useState<'agenda' | 'kanban'>('agenda')

  const list = useMemo(
    () =>
      tasks
        .filter((t) => t.projectId === project.id)
        .sort((a, b) => (a.date ?? '0000').localeCompare(b.date ?? '0000') || a.position - b.position),
    [tasks, project.id],
  )
  const done = list.filter((t) => t.status === 'done').length

  const grupos = useMemo(() => {
    const m = new Map<string, Task[]>()
    for (const t of list) {
      const k = t.date ?? 'backlog'
      m.set(k, [...(m.get(k) ?? []), t])
    }
    // sin fecha primero, después cronológico
    return [...m.entries()].sort(([a], [b]) =>
      a === 'backlog' ? -1 : b === 'backlog' ? 1 : a.localeCompare(b),
    )
  }, [list])

  const COLS: { status: Task['status']; label: string; dot: string }[] = [
    { status: 'todo', label: 'Por hacer', dot: '#94A3B8' },
    { status: 'doing', label: 'En progreso', dot: '#5AB6E8' },
    { status: 'done', label: 'Completado', dot: '#34C48E' },
  ]

  return (
    <Modal title={project.name} onClose={onClose} width="max-w-5xl">
      <div className="-mx-5 -mt-4 mb-4 h-1.5" style={{ background: project.color }} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-400">
          {list.length} tarea{list.length === 1 ? '' : 's'} · {done} completada{done === 1 ? '' : 's'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
            <button
              onClick={() => setMode('agenda')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-extrabold transition ${
                mode === 'agenda' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <CalendarDays size={13} /> Agenda
            </button>
            <button
              onClick={() => setMode('kanban')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-extrabold transition ${
                mode === 'kanban' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <SquareKanban size={13} /> Kanban
            </button>
          </div>
          <button
            onClick={() => onNewTask({ projectId: project.id })}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-blue-700"
          >
            <Plus size={14} /> Nueva tarea
          </button>
        </div>
      </div>

      {list.length === 0 && (
        <p className="py-10 text-center text-sm font-semibold text-slate-300">
          Este proyecto todavía no tiene tareas.
        </p>
      )}

      {mode === 'agenda' ? (
        <div className="space-y-4">
          {grupos.map(([fecha, ts]) => (
            <div key={fecha}>
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-extrabold tracking-wide text-slate-400 uppercase">
                {fecha === 'backlog' ? (
                  <>
                    <Inbox size={12} /> Sin fecha
                  </>
                ) : (
                  format(parseISO(fecha), "EEEE d 'de' MMMM", { locale: es })
                )}
                <span className="text-slate-300">· {ts.length}</span>
              </p>
              <div className="divide-y divide-slate-50 rounded-xl border border-slate-100">
                {ts.map((t) => (
                  <TaskRow key={t.id} task={t} onEdit={() => onEditTask(t)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {COLS.map((col) => {
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
                  {colTasks.length === 0 && (
                    <p className="py-4 text-center text-[11px] font-semibold text-slate-300">Vacío</p>
                  )}
                  {colTasks.map((t) => (
                    <TaskRow key={t.id} task={t} onEdit={() => onEditTask(t)} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}

function TaskRow({ task, onEdit }: { task: Task; onEdit: () => void }) {
  const { users, upsertTask } = useApp()
  const done = task.status === 'done'
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 transition hover:bg-slate-50">
      <button
        onClick={() => upsertTask({ ...task, status: done ? 'todo' : 'done' })}
        title={done ? 'Marcar pendiente' : 'Marcar completada'}
        className={done ? 'text-emerald-500' : 'text-slate-300 hover:text-emerald-400'}
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
      <span className="text-[11px] font-semibold whitespace-nowrap text-slate-400">
        {task.date ? format(parseISO(task.date), 'd MMM', { locale: es }) : '📥'}
        {task.startTime ? ` · ${task.startTime}` : ''}
      </span>
      <AvatarStack users={users.filter((u) => task.assigneeIds.includes(u.id))} size={17} />
    </div>
  )
}

function ProjectModal({ project, onClose }: { project: Project | null; onClose: () => void }) {
  const { upsertProject } = useApp()
  const [name, setName] = useState(project?.name ?? '')
  const [color, setColor] = useState(project?.color ?? PROJECT_COLORS[0])
  const [description, setDescription] = useState(project?.description ?? '')

  const save = () => {
    upsertProject({
      id: project?.id ?? uid(),
      name: name.trim(),
      color,
      description: description.trim() || undefined,
    })
    onClose()
  }

  return (
    <Modal title={project ? 'Editar proyecto' : 'Nuevo proyecto'} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Nombre">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Académico" className={inputCls} autoFocus />
        </Field>
        <Field label="Color identificativo">
          <div className="flex flex-wrap gap-2">
            {PROJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`size-8 rounded-lg transition ${color === c ? 'ring-2 ring-slate-700 ring-offset-2' : 'hover:scale-110'}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </Field>
        <Field label="Descripción (opcional)">
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="¿De qué se trata este proyecto?"
            className={`${inputCls} resize-none`}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100">
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={!name.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            Guardar
          </button>
        </div>
      </div>
    </Modal>
  )
}
