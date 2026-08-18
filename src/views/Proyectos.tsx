import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { Project } from '../types'
import { PROJECT_COLORS, uid } from '../lib/utils'
import { useApp } from '../state/AppContext'
import Modal, { Field, inputCls } from '../components/Modal'

export default function Proyectos() {
  const { projects, tasks, removeProject } = useApp()
  const [editing, setEditing] = useState<Project | 'new' | null>(null)

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
              <div key={p.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="h-2" style={{ background: p.color }} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-extrabold text-slate-700">{p.name}</p>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditing(p)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        title="Editar"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => del(p)}
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
