import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { CheckCircle2, ChevronRight, Flag, Link2, Pencil, Plus, Trash2, X } from 'lucide-react'
import type { Hito, Task } from '../types'
import { textOn, todayKey, uid } from '../lib/utils'
import { useApp } from '../state/AppContext'
import { AvatarStack } from '../components/Avatar'
import Modal, { Field, inputCls } from '../components/Modal'

export default function Hitos({ onEditTask }: { onEditTask: (t: Task) => void }) {
  const { hitos, projects, tasks, users, upsertTask, removeHito } = useApp()
  const [editing, setEditing] = useState<Hito | 'new' | null>(null)
  const [linking, setLinking] = useState<Hito | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const byProject = useMemo(() => {
    const m = new Map<string, Hito[]>()
    for (const h of [...hitos].sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || a.position - b.position)) {
      m.set(h.projectId, [...(m.get(h.projectId) ?? []), h])
    }
    return m
  }, [hitos])

  const toggleExpand = (id: string) =>
    setExpanded((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const del = (h: Hito) => {
    const n = tasks.filter((t) => t.hitoId === h.id).length
    if (confirm(`¿Eliminar el hito "${h.name}"?${n ? ` Sus ${n} tareas vinculadas NO se borran, solo quedan sin hito.` : ''}`))
      removeHito(h.id)
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-4 py-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-black text-slate-800">Hitos</h2>
            <p className="text-sm text-slate-400">
              Las metas grandes de cada proyecto, con las tareas que aportan a cumplirlas.
            </p>
          </div>
          <button
            onClick={() => setEditing('new')}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-extrabold text-white hover:bg-blue-700"
          >
            <Plus size={16} /> Nuevo hito
          </button>
        </div>

        {hitos.length === 0 && (
          <div className="grid place-items-center rounded-xl border-2 border-dashed border-slate-200 py-16 text-center">
            <div>
              <Flag size={36} className="mx-auto text-slate-200" />
              <p className="mt-3 text-sm font-bold text-slate-400">Todavía no hay hitos.</p>
              <p className="text-xs text-slate-300">Creá el primero con "+ Nuevo hito".</p>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {projects
            .filter((p) => byProject.has(p.id))
            .map((p) => (
              <section key={p.id}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="size-3 rounded-full" style={{ background: p.color }} />
                  <h3 className="font-extrabold text-slate-700">{p.name}</h3>
                </div>
                <div className="space-y-3">
                  {byProject.get(p.id)!.map((h) => {
                    const linked = tasks
                      .filter((t) => t.hitoId === h.id)
                      .sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || a.position - b.position)
                    const done = linked.filter((t) => t.status === 'done').length
                    const pct = linked.length ? Math.round((done / linked.length) * 100) : 0
                    const open = expanded.has(h.id)
                    const late = !!h.date && h.date < todayKey() && done < linked.length
                    return (
                      <div key={h.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-start gap-3 p-4">
                          <button
                            onClick={() => toggleExpand(h.id)}
                            className="mt-0.5 rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                            title={open ? 'Colapsar' : 'Ver tareas'}
                          >
                            <ChevronRight size={16} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="font-extrabold text-slate-800">{h.name}</p>
                            <p className={`text-xs font-bold ${late ? 'text-red-500' : 'text-slate-400'}`}>
                              {h.date
                                ? `🎯 ${format(parseISO(h.date), "d 'de' MMMM yyyy", { locale: es })}${late ? ' · vencido' : ''}`
                                : 'Sin fecha objetivo'}
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{ width: `${pct}%`, background: p.color }}
                                />
                              </div>
                              <span className="text-[11px] font-extrabold whitespace-nowrap text-slate-400">
                                {done}/{linked.length} · {pct}%
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setLinking(h)}
                              title="Vincular tareas"
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                            >
                              <Link2 size={15} />
                            </button>
                            <button
                              onClick={() => setEditing(h)}
                              title="Editar hito"
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => del(h)}
                              title="Eliminar hito"
                              className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>

                        {open && (
                          <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-2">
                            {linked.length === 0 && (
                              <p className="py-3 text-center text-xs font-semibold text-slate-300">
                                Sin tareas vinculadas. Usá el botón 🔗 para vincular.
                              </p>
                            )}
                            <div className="divide-y divide-slate-100">
                              {linked.map((t) => {
                                const doneT = t.status === 'done'
                                return (
                                  <div key={t.id} className="group flex items-center gap-2.5 py-1.5">
                                    <button
                                      onClick={() =>
                                        upsertTask({ ...t, status: doneT ? 'todo' : 'done' })
                                      }
                                      title={doneT ? 'Marcar pendiente' : 'Marcar completada'}
                                      className={doneT ? 'text-emerald-500' : 'text-slate-300 hover:text-emerald-400'}
                                    >
                                      <CheckCircle2 size={17} className={doneT ? 'fill-emerald-100' : ''} />
                                    </button>
                                    <button onClick={() => onEditTask(t)} className="min-w-0 flex-1 text-left">
                                      <span
                                        className={`block truncate text-sm font-bold ${doneT ? 'text-slate-300 line-through' : 'text-slate-600'}`}
                                      >
                                        {t.title}
                                      </span>
                                    </button>
                                    <span className="text-[11px] font-semibold whitespace-nowrap text-slate-400">
                                      {t.date ? format(parseISO(t.date), 'd MMM', { locale: es }) : '📥'}
                                    </span>
                                    <AvatarStack users={users.filter((u) => t.assigneeIds.includes(u.id))} size={17} />
                                    <button
                                      onClick={() => upsertTask({ ...t, hitoId: null })}
                                      title="Desvincular del hito"
                                      className="rounded p-1 text-slate-300 transition hover:bg-red-50 hover:text-red-500 md:opacity-0 md:group-hover:opacity-100"
                                    >
                                      <X size={13} />
                                    </button>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
        </div>
      </div>

      {editing && <HitoModal hito={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {linking && <LinkModal hito={linking} onClose={() => setLinking(null)} />}
    </div>
  )
}

function HitoModal({ hito, onClose }: { hito: Hito | null; onClose: () => void }) {
  const { projects, hitos, upsertHito } = useApp()
  const [name, setName] = useState(hito?.name ?? '')
  const [projectId, setProjectId] = useState(hito?.projectId ?? projects[0]?.id ?? '')
  const [date, setDate] = useState(hito?.date ?? '')

  const save = () => {
    upsertHito({
      id: hito?.id ?? uid(),
      projectId,
      name: name.trim(),
      date: date || null,
      position: hito?.position ?? hitos.length,
    })
    onClose()
  }

  return (
    <Modal title={hito ? 'Editar hito' : 'Nuevo hito'} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Nombre del hito">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Cierre de la Cohorte 1"
            className={inputCls}
            autoFocus
          />
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
                <span className="size-2 rounded-full" style={{ background: projectId === p.id ? textOn(p.color) : p.color }} />
                {p.name}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Fecha objetivo (opcional)">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100">
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={!name.trim() || !projectId}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            Guardar
          </button>
        </div>
      </div>
    </Modal>
  )
}

/** Vincular tareas existentes del proyecto a un hito (clic para vincular/desvincular). */
function LinkModal({ hito, onClose }: { hito: Hito; onClose: () => void }) {
  const { tasks, upsertTask } = useApp()
  const [q, setQ] = useState('')
  const candidates = tasks
    .filter((t) => t.projectId === hito.projectId)
    .filter((t) => !q || t.title.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(!!a.hitoId && a.hitoId !== hito.id) - Number(!!b.hitoId && b.hitoId !== hito.id)
      || (a.date ?? '9999').localeCompare(b.date ?? '9999'))

  return (
    <Modal title={`Vincular tareas a "${hito.name}"`} onClose={onClose}>
      <div className="space-y-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar tarea del proyecto…"
          className={inputCls}
        />
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {candidates.length === 0 && (
            <p className="py-4 text-center text-sm font-semibold text-slate-300">No hay tareas en este proyecto.</p>
          )}
          {candidates.map((t) => {
            const linked = t.hitoId === hito.id
            const otro = !!t.hitoId && !linked
            return (
              <button
                key={t.id}
                onClick={() => upsertTask({ ...t, hitoId: linked ? null : hito.id })}
                className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                  linked ? 'border-blue-300 bg-blue-50' : 'border-slate-100 hover:border-slate-200'
                }`}
              >
                <span
                  className={`grid size-4 shrink-0 place-items-center rounded border ${
                    linked ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white'
                  }`}
                >
                  {linked && <CheckCircle2 size={11} />}
                </span>
                <span className={`min-w-0 flex-1 truncate font-bold ${t.status === 'done' ? 'text-slate-300 line-through' : 'text-slate-600'}`}>
                  {t.title}
                </span>
                {otro && <span className="text-[10px] font-bold text-amber-500">en otro hito</span>}
                <span className="text-[11px] font-semibold text-slate-400">{t.date ?? '📥'}</span>
              </button>
            )
          })}
        </div>
        <div className="flex justify-end">
          <button onClick={onClose} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-700">
            Listo
          </button>
        </div>
      </div>
    </Modal>
  )
}
