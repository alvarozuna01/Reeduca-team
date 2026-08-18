import { useState } from 'react'
import { Flame, Plus, Trash2, X } from 'lucide-react'
import type { Status, Task } from '../types'
import { STATUS_LABEL, todayKey, uid } from '../lib/utils'
import { useApp } from '../state/AppContext'
import { Avatar } from './Avatar'
import { Field, inputCls } from './Modal'
import { StarRating } from './Stars'

interface Props {
  task?: Task
  defaults?: Partial<Task>
  onClose: () => void
}

export default function TaskEditor({ task, defaults, onClose }: Props) {
  const { projects, users, tasks, currentUser, upsertTask, removeTask } = useApp()
  const isNew = !task

  const [draft, setDraft] = useState<Task>(() =>
    task
      ? { ...task, checklist: task.checklist.map((c) => ({ ...c })), links: task.links.map((l) => ({ ...l })) }
      : {
          id: uid(),
          projectId: defaults?.projectId ?? projects[0]?.id ?? '',
          title: '',
          description: '',
          date: defaults?.date ?? todayKey(),
          startTime: '',
          endTime: '',
          assigneeIds: defaults?.assigneeIds ?? (currentUser ? [currentUser.id] : []),
          status: defaults?.status ?? 'todo',
          position: 0,
          checklist: [],
          links: [],
          urgent: defaults?.urgent ?? false,
          importance: defaults?.importance ?? 0,
        },
  )

  const set = <K extends keyof Task>(key: K, value: Task[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const project = projects.find((p) => p.id === draft.projectId)

  const save = () => {
    const clean: Task = {
      ...draft,
      title: draft.title.trim(),
      description: draft.description?.trim() || undefined,
      startTime: draft.startTime || undefined,
      endTime: draft.endTime || undefined,
      links: draft.links.filter((l) => l.url.trim()),
      checklist: draft.checklist.filter((c) => c.text.trim()),
    }
    if (isNew || task.date !== clean.date) {
      const sameDay = tasks.filter((t) => t.date === clean.date && t.id !== clean.id)
      clean.position = sameDay.length ? Math.max(...sameDay.map((t) => t.position)) + 1 : 0
    }
    upsertTask(clean)
    onClose()
  }

  const del = () => {
    if (task && confirm(`¿Eliminar la tarea "${task.title}"?`)) {
      removeTask(task.id)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="absolute top-0 right-0 flex h-full w-full max-w-md animate-[slidein_0.18s_ease-out] flex-col bg-white shadow-2xl">
        <div className="h-1.5 w-full" style={{ background: project?.color ?? '#cbd5e1' }} />
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h3 className="font-extrabold text-slate-800">{isNew ? 'Nueva tarea' : 'Editar tarea'}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <Field label="Título">
            <input
              autoFocus={isNew}
              value={draft.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="¿Qué hay que hacer?"
              className={`${inputCls} font-bold`}
            />
          </Field>

          <Field label="Proyecto">
            <div className="flex flex-wrap gap-1.5">
              {projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => set('projectId', p.id)}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold transition ${
                    draft.projectId === p.id
                      ? 'border-transparent text-white'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                  style={draft.projectId === p.id ? { background: p.color } : undefined}
                >
                  <span className="size-2 rounded-full" style={{ background: draft.projectId === p.id ? '#fff' : p.color }} />
                  {p.name}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-3 gap-2">
            <Field label="Fecha">
              <input type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Inicio">
              <input type="time" value={draft.startTime ?? ''} onChange={(e) => set('startTime', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Fin">
              <input type="time" value={draft.endTime ?? ''} onChange={(e) => set('endTime', e.target.value)} className={inputCls} />
            </Field>
          </div>

          <Field label="Estado">
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
              {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set('status', s)}
                  className={`rounded-md px-2 py-1.5 text-xs font-extrabold transition ${
                    draft.status === s ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="¿Es urgente?">
              <button
                type="button"
                onClick={() => set('urgent', !draft.urgent)}
                className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm font-extrabold transition ${
                  draft.urgent
                    ? 'border-red-300 bg-red-50 text-red-600'
                    : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'
                }`}
              >
                <Flame size={16} className={draft.urgent ? 'fill-red-500 text-red-500' : ''} />
                {draft.urgent ? 'Urgente' : 'No urgente'}
                <span
                  className={`ml-auto flex h-5 w-9 items-center rounded-full p-0.5 transition ${
                    draft.urgent ? 'justify-end bg-red-500' : 'justify-start bg-slate-200'
                  }`}
                >
                  <span className="size-4 rounded-full bg-white shadow-sm" />
                </span>
              </button>
            </Field>
            <Field label="Importancia">
              <StarRating value={draft.importance} onChange={(v) => set('importance', v)} />
            </Field>
          </div>

          <Field label="Responsables">
            <div className="flex flex-wrap gap-1.5">
              {users.map((u) => {
                const active = draft.assigneeIds.includes(u.id)
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() =>
                      set(
                        'assigneeIds',
                        active ? draft.assigneeIds.filter((id) => id !== u.id) : [...draft.assigneeIds, u.id],
                      )
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

          <Field label="Descripción">
            <textarea
              rows={3}
              value={draft.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Detalles de la acción a realizar…"
              className={`${inputCls} resize-none`}
            />
          </Field>

          <Field label="Checklist / Entregables">
            <div className="space-y-1.5">
              {draft.checklist.map((c, i) => (
                <div key={c.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={c.done}
                    onChange={(e) => {
                      const list = [...draft.checklist]
                      list[i] = { ...c, done: e.target.checked }
                      set('checklist', list)
                    }}
                    className="size-4 accent-emerald-500"
                  />
                  <input
                    value={c.text}
                    onChange={(e) => {
                      const list = [...draft.checklist]
                      list[i] = { ...c, text: e.target.value }
                      set('checklist', list)
                    }}
                    placeholder="Ítem del checklist"
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => set('checklist', draft.checklist.filter((x) => x.id !== c.id))}
                    className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => set('checklist', [...draft.checklist, { id: uid(), text: '', done: false }])}
                className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"
              >
                <Plus size={14} /> Agregar ítem
              </button>
            </div>
          </Field>

          <Field label="Enlaces (Drive, Notion…)">
            <div className="space-y-1.5">
              {draft.links.map((l, i) => (
                <div key={l.id} className="flex items-center gap-2">
                  <input
                    value={l.label}
                    onChange={(e) => {
                      const list = [...draft.links]
                      list[i] = { ...l, label: e.target.value }
                      set('links', list)
                    }}
                    placeholder="Nombre"
                    className={`${inputCls} w-32 shrink-0`}
                  />
                  <input
                    value={l.url}
                    onChange={(e) => {
                      const list = [...draft.links]
                      list[i] = { ...l, url: e.target.value }
                      set('links', list)
                    }}
                    placeholder="https://…"
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => set('links', draft.links.filter((x) => x.id !== l.id))}
                    className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => set('links', [...draft.links, { id: uid(), label: 'Abrir en Drive', url: '' }])}
                className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"
              >
                <Plus size={14} /> Agregar enlace
              </button>
            </div>
          </Field>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
          {!isNew ? (
            <button onClick={del} className="rounded-lg px-3 py-2 text-sm font-bold text-red-500 hover:bg-red-50">
              Eliminar
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100">
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={!draft.title.trim() || !draft.projectId}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
