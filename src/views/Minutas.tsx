import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { CheckCircle2, ClipboardList, Plus, Trash2, Wand2 } from 'lucide-react'
import type { Minute, MinuteAction, Task } from '../types'
import { textOn, todayKey, uid } from '../lib/utils'
import { useApp } from '../state/AppContext'
import { Avatar, AvatarStack } from '../components/Avatar'
import Modal, { Field, inputCls } from '../components/Modal'

export default function Minutas({ onEditTask }: { onEditTask: (t: Task) => void }) {
  const { minutes, users, tasks, currentUser, upsertMinute, removeMinute } = useApp()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [convert, setConvert] = useState<{ minute: Minute; action: MinuteAction } | null>(null)

  const sorted = useMemo(() => [...minutes].sort((a, b) => b.date.localeCompare(a.date)), [minutes])
  const sel = minutes.find((m) => m.id === selectedId) ?? sorted[0] ?? null

  const createMinute = () => {
    const m: Minute = {
      id: uid(),
      title: 'Nueva minuta',
      date: todayKey(),
      participantIds: currentUser ? [currentUser.id] : [],
      summary: '',
      actions: [],
    }
    upsertMinute(m)
    setSelectedId(m.id)
  }

  const deleteMinute = (m: Minute) => {
    if (confirm(`¿Eliminar la minuta "${m.title}"? Las tareas ya creadas desde sus acciones no se borran.`)) {
      removeMinute(m.id)
      if (selectedId === m.id) setSelectedId(null)
    }
  }

  const patchSel = (patch: Partial<Minute>) => sel && upsertMinute({ ...sel, ...patch })

  const patchAction = (id: string, patch: Partial<MinuteAction>) =>
    sel && patchSel({ actions: sel.actions.map((a) => (a.id === id ? { ...a, ...patch } : a)) })

  return (
    <div className="flex h-full">
      {/* Lista de minutas */}
      <div className="flex w-80 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <span className="font-extrabold text-slate-700">Minutas de reuniones</span>
          <button
            onClick={createMinute}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-extrabold text-white hover:bg-blue-700"
          >
            <Plus size={13} /> Nueva
          </button>
        </div>
        <div className="flex-1 space-y-1.5 overflow-y-auto px-3 pb-3">
          {sorted.length === 0 && (
            <p className="px-3 py-8 text-center text-sm font-semibold text-slate-300">
              Todavía no hay minutas. Creá la primera con “+ Nueva”.
            </p>
          )}
          {sorted.map((m) => {
            const active = sel?.id === m.id
            const converted = m.actions.filter((a) => a.taskId).length
            return (
              <button
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                className={`block w-full rounded-xl border px-3.5 py-3 text-left transition ${
                  active ? 'border-blue-300 bg-blue-50/70 shadow-sm' : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm'
                }`}
              >
                <span className="block truncate text-sm font-extrabold text-slate-700">{m.title}</span>
                <span className="mt-0.5 block text-[11px] font-semibold text-slate-400 capitalize">
                  {format(parseISO(m.date), "EEEE d 'de' MMMM", { locale: es })}
                </span>
                <span className="mt-2 flex items-center justify-between">
                  <AvatarStack users={users.filter((u) => m.participantIds.includes(u.id))} size={18} />
                  <span className="text-[10px] font-extrabold text-slate-400">
                    {m.actions.length} accion{m.actions.length === 1 ? '' : 'es'}
                    {converted > 0 && <span className="text-emerald-500"> · {converted} → tareas</span>}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Detalle */}
      <div className="min-w-0 flex-1 overflow-y-auto">
        {!sel ? (
          <div className="grid h-full place-items-center">
            <div className="text-center">
              <ClipboardList size={40} className="mx-auto text-slate-200" />
              <p className="mt-3 text-sm font-bold text-slate-300">Elegí una minuta o creá una nueva</p>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl px-6 py-5">
            <div className="flex items-start justify-between gap-3">
              <input
                value={sel.title}
                onChange={(e) => patchSel({ title: e.target.value })}
                className="w-full text-2xl font-black text-slate-800 outline-none placeholder:text-slate-200"
                placeholder="Título de la reunión"
              />
              <button
                onClick={() => deleteMinute(sel)}
                title="Eliminar minuta"
                className="rounded-lg p-2 text-slate-300 hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 size={17} />
              </button>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Fecha">
                <input type="date" value={sel.date} onChange={(e) => patchSel({ date: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Participantes">
                <div className="flex flex-wrap gap-1.5">
                  {users.map((u) => {
                    const active = sel.participantIds.includes(u.id)
                    return (
                      <button
                        key={u.id}
                        type="button"
                        title={u.name}
                        onClick={() =>
                          patchSel({
                            participantIds: active
                              ? sel.participantIds.filter((id) => id !== u.id)
                              : [...sel.participantIds, u.id],
                          })
                        }
                        className={`rounded-full transition ${active ? 'ring-2 ring-blue-400 ring-offset-1' : 'opacity-35 hover:opacity-70'}`}
                      >
                        <Avatar user={u} size={28} />
                      </button>
                    )
                  })}
                </div>
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Resumen de la reunión">
                <textarea
                  rows={5}
                  value={sel.summary}
                  onChange={(e) => patchSel({ summary: e.target.value })}
                  placeholder="¿Qué se habló? ¿Qué se decidió?"
                  className={`${inputCls} resize-none leading-relaxed`}
                />
              </Field>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <p className="text-[11px] font-extrabold tracking-wide text-slate-400 uppercase">Acciones acordadas</p>
              <p className="mb-3 text-[11px] font-semibold text-slate-400">
                Cada punto se puede convertir en una tarea del sistema con un clic ✨
              </p>
              <div className="space-y-2">
                {sel.actions.map((a) => {
                  const task = a.taskId ? tasks.find((t) => t.id === a.taskId) : undefined
                  return (
                    <div key={a.id} className="flex items-center gap-2">
                      <span className="size-1.5 shrink-0 rounded-full bg-slate-300" />
                      <input
                        value={a.text}
                        onChange={(e) => patchAction(a.id, { text: e.target.value })}
                        placeholder="¿Qué se acordó hacer?"
                        className={`${inputCls} bg-white`}
                      />
                      {task ? (
                        <button
                          onClick={() => onEditTask(task)}
                          title="Ver la tarea creada"
                          className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-2 text-xs font-extrabold text-emerald-700 hover:bg-emerald-200"
                        >
                          <CheckCircle2 size={14} /> Tarea creada
                        </button>
                      ) : (
                        <button
                          onClick={() => setConvert({ minute: sel, action: a })}
                          title="Convertir en tarea"
                          className="flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-2 text-xs font-extrabold text-white hover:bg-blue-700"
                        >
                          <Wand2 size={14} /> Convertir en tarea
                        </button>
                      )}
                      <button
                        onClick={() => patchSel({ actions: sel.actions.filter((x) => x.id !== a.id) })}
                        className="shrink-0 rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )
                })}
              </div>
              <button
                onClick={() => patchSel({ actions: [...sel.actions, { id: uid(), text: '' }] })}
                className="mt-3 flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"
              >
                <Plus size={14} /> Agregar acción
              </button>
            </div>
          </div>
        )}
      </div>

      {convert && (
        <ConvertModal
          minute={convert.minute}
          action={convert.action}
          onClose={() => setConvert(null)}
          onConverted={(taskId) => {
            const m = minutes.find((x) => x.id === convert.minute.id)
            if (m) upsertMinute({ ...m, actions: m.actions.map((a) => (a.id === convert.action.id ? { ...a, taskId } : a)) })
            setConvert(null)
          }}
        />
      )}
    </div>
  )
}

/* ---- Modal rápido: acción acordada → tarea ---- */

function ConvertModal({
  minute,
  action,
  onClose,
  onConverted,
}: {
  minute: Minute
  action: MinuteAction
  onClose: () => void
  onConverted: (taskId: string) => void
}) {
  const { projects, users, tasks, upsertTask } = useApp()
  const [title, setTitle] = useState(action.text)
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const [date, setDate] = useState(todayKey())
  const [assigneeIds, setAssigneeIds] = useState<string[]>(minute.participantIds)

  const create = () => {
    const sameDay = tasks.filter((t) => t.date === date)
    const task: Task = {
      id: uid(),
      projectId,
      title: title.trim(),
      description: `Acción acordada en la minuta: "${minute.title}".`,
      date,
      assigneeIds,
      status: 'todo',
      position: sameDay.length ? Math.max(...sameDay.map((t) => t.position)) + 1 : 0,
      checklist: [],
      links: [],
      urgent: false,
      importance: 0,
    }
    upsertTask(task)
    onConverted(task.id)
  }

  return (
    <Modal title="Convertir acción en tarea" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Título de la tarea">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={`${inputCls} font-bold`} autoFocus />
        </Field>
        <Field label="Proyecto">
          <div className="flex flex-wrap gap-1.5">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProjectId(p.id)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold transition ${
                  projectId === p.id ? 'border-transparent' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
                style={projectId === p.id ? { background: p.color, color: textOn(p.color) } : undefined}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ background: projectId === p.id ? textOn(p.color) : p.color }}
                />
                {p.name}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Fecha">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Responsables">
          <div className="flex flex-wrap gap-1.5">
            {users.map((u) => {
              const active = assigneeIds.includes(u.id)
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() =>
                    setAssigneeIds(active ? assigneeIds.filter((id) => id !== u.id) : [...assigneeIds, u.id])
                  }
                  className={`flex items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-1 text-xs font-bold transition ${
                    active ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <Avatar user={u} size={20} />
                  {u.name}
                </button>
              )
            })}
          </div>
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100">
            Cancelar
          </button>
          <button
            onClick={create}
            disabled={!title.trim() || !projectId}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            Crear tarea
          </button>
        </div>
      </div>
    </Modal>
  )
}
