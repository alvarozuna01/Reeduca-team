import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { BookOpen, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Plus, Trash2, Wand2 } from 'lucide-react'
import type { Minute, MinuteAction, Task } from '../types'
import { todayKey, uid } from '../lib/utils'
import { useIsMobile } from '../lib/useIsMobile'
import { useApp } from '../state/AppContext'
import { Avatar, AvatarStack } from '../components/Avatar'
import Modal, { Field, FieldDiv, inputCls } from '../components/Modal'
import { PeopleSelect, PersonSelect, ProjectSelect } from '../components/Selectores'

export default function Minutas({ onEditTask }: { onEditTask: (t: Task) => void }) {
  const { minutes, users, tasks, currentUser, upsertMinute, removeMinute } = useApp()
  const isMobile = useIsMobile()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [convert, setConvert] = useState<{ minute: Minute; action: MinuteAction } | null>(null)
  // En celular se ve una pantalla por vez: lista → detalle
  const [pane, setPane] = useState<'list' | 'detail'>('list')

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
    if (isMobile) setPane('detail')
  }

  const deleteMinute = (m: Minute) => {
    if (confirm(`¿Eliminar la minuta "${m.title}"? Las tareas ya creadas desde sus acciones no se borran.`)) {
      removeMinute(m.id)
      if (selectedId === m.id) setSelectedId(null)
      if (isMobile) setPane('list')
    }
  }

  const patchSel = (patch: Partial<Minute>) => sel && upsertMinute({ ...sel, ...patch })

  const patchAction = (id: string, patch: Partial<MinuteAction>) =>
    sel && patchSel({ actions: sel.actions.map((a) => (a.id === id ? { ...a, ...patch } : a)) })

  return (
    <div className="flex h-full">
      {/* Lista de minutas */}
      <div
        className={`${
          isMobile ? (pane === 'list' ? 'flex w-full' : 'hidden') : 'flex w-80'
        } shrink-0 flex-col border-r border-slate-200 bg-white`}
      >
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
                onClick={() => {
                  setSelectedId(m.id)
                  if (isMobile) setPane('detail')
                }}
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
      <div className={`${isMobile && pane !== 'detail' ? 'hidden' : 'block'} min-w-0 flex-1 overflow-y-auto`}>
        {!sel ? (
          <div className="grid h-full place-items-center">
            <div className="text-center">
              <ClipboardList size={40} className="mx-auto text-slate-200" />
              <p className="mt-3 text-sm font-bold text-slate-300">Elegí una minuta o creá una nueva</p>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl px-4 py-5 md:px-6">
            {isMobile && (
              <button
                onClick={() => setPane('list')}
                className="mb-2 flex items-center gap-1 rounded-lg py-1 pr-2 text-sm font-bold text-slate-500 hover:bg-slate-100"
              >
                <ChevronLeft size={16} /> Minutas
              </button>
            )}
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

            <EstandarMinuta minute={sel} onPatch={patchSel} />

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
                Una acción por línea, con responsable y fecha. Lo que tiene que entrar al Kanban se convierte en tarea
                con un clic; el resto queda como registro de la reunión.
              </p>
              <div className="space-y-2">
                {sel.actions.map((a) => {
                  const task = a.taskId ? tasks.find((t) => t.id === a.taskId) : undefined
                  const completa = !!a.text.trim() && !!a.responsableSugeridoId && !!a.fechaSugerida
                  return (
                    <div
                      key={a.id}
                      className={`rounded-xl border p-2.5 ${
                        task || completa ? 'border-slate-200 bg-white' : 'border-amber-200 bg-amber-50/40'
                      }`}
                    >
                    <div className="flex items-center gap-2">
                      <span className="size-1.5 shrink-0 rounded-full bg-slate-300" />
                      <input
                        value={a.text}
                        onChange={(e) => patchAction(a.id, { text: e.target.value })}
                        placeholder="¿Qué se acordó hacer? Empezá con un verbo: Enviar, Definir, Confirmar…"
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
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 pl-3.5">
                      <span className="text-[10px] font-extrabold tracking-wide text-slate-400 uppercase">Responsable</span>
                      <PersonSelect
                        value={a.responsableSugeridoId ?? null}
                        onChange={(id) => patchAction(a.id, { responsableSugeridoId: id ?? undefined })}
                      />
                      <span className="ml-1 text-[10px] font-extrabold tracking-wide text-slate-400 uppercase">
                        Para cuándo
                      </span>
                      <input
                        type="date"
                        value={a.fechaSugerida ?? ''}
                        onChange={(e) => patchAction(a.id, { fechaSugerida: e.target.value || undefined })}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 outline-none focus:border-blue-400"
                      />
                      {!task && !completa && (
                        <span className="text-[10px] font-extrabold text-amber-600">
                          falta el responsable o la fecha
                        </span>
                      )}
                    </div>
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


/* ---- El estándar: cómo se completa una minuta a mano ---- */

const PLANTILLA = `Temas tratados:
- 

Decisiones tomadas:
- 

Trabas o riesgos:
- `

const REGLAS = [
  'Título: qué reunión fue y con quién. Nunca dejarlo en «Nueva minuta».',
  'Participantes: marcá a todos los que estuvieron, aunque hayan entrado un rato.',
  'Resumen: 3 a 6 frases, en pasado. Qué se habló y qué se decidió. Sin relleno.',
  'Acciones acordadas: una por línea, empezando con un verbo (Enviar, Definir, Confirmar), cada una con responsable y fecha.',
  'Si no hay responsable claro, no es una acción: va al resumen como tema o riesgo.',
  'Lo que tiene que entrar al Kanban se convierte en tarea con el botón; el resto queda como registro.',
  'Se escribe el mismo día de la reunión: la memoria dura poco.',
]

/**
 * Guía y control de calidad de la minuta: el estándar del equipo, una plantilla
 * para el resumen, y un chequeo en vivo de lo que falta completar.
 */
function EstandarMinuta({ minute, onPatch }: { minute: Minute; onPatch: (p: Partial<Minute>) => void }) {
  const [abierto, setAbierto] = useState(false)

  const conTexto = minute.actions.filter((a) => a.text.trim())
  const checks = [
    { ok: !!minute.title.trim() && minute.title.trim() !== 'Nueva minuta', label: 'Título claro' },
    { ok: minute.participantIds.length >= 2, label: 'Participantes' },
    { ok: minute.summary.trim().length >= 100, label: 'Resumen completo' },
    { ok: conTexto.length > 0, label: 'Acciones acordadas' },
    {
      ok: conTexto.length > 0 && conTexto.every((a) => a.responsableSugeridoId && a.fechaSugerida),
      label: 'Responsable y fecha en cada acción',
    },
  ]
  const listos = checks.filter((c) => c.ok).length
  const completa = listos === checks.length

  const usarPlantilla = () => {
    if (minute.summary.trim() && !confirm('El resumen ya tiene texto. ¿Reemplazarlo por la plantilla?')) return
    onPatch({ summary: PLANTILLA })
  }

  return (
    <div className={`mt-4 rounded-xl border ${completa ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-slate-50/60'}`}>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <BookOpen size={14} className={completa ? 'text-emerald-600' : 'text-slate-400'} />
        <span className="text-[11px] font-extrabold tracking-wide text-slate-500 uppercase">Estándar de minutas</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
            completa ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-slate-500'
          }`}
        >
          {completa ? 'Completa ✓' : `${listos} de ${checks.length}`}
        </span>
        <button
          onClick={() => setAbierto((o) => !o)}
          className="ml-auto flex items-center gap-1 text-[11px] font-extrabold text-blue-600 hover:text-blue-700"
        >
          {abierto ? <ChevronDown size={13} /> : <ChevronRight size={13} />} cómo se completa
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 px-4 pb-3">
        {checks.map((c) => (
          <span
            key={c.label}
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
              c.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-slate-400'
            }`}
          >
            {c.ok ? <Check size={10} /> : <span className="size-2 rounded-full border border-slate-300" />}
            {c.label}
          </span>
        ))}
      </div>

      {abierto && (
        <div className="border-t border-slate-200 px-4 py-3">
          <ol className="list-decimal space-y-1.5 pl-4">
            {REGLAS.map((r) => (
              <li key={r} className="text-[12px] leading-snug font-semibold text-slate-600">
                {r}
              </li>
            ))}
          </ol>
          <button
            onClick={usarPlantilla}
            className="mt-3 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-600 hover:border-blue-300 hover:text-blue-700"
          >
            <Plus size={13} /> Usar la plantilla del resumen
          </button>
        </div>
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
  const { projects, tasks, upsertTask } = useApp()
  const [title, setTitle] = useState(action.text)
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const [date, setDate] = useState(action.fechaSugerida || todayKey())
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    action.responsableSugeridoId ? [action.responsableSugeridoId] : minute.participantIds,
  )

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
        <FieldDiv label="Proyecto">
          <ProjectSelect value={projectId} onChange={setProjectId} />
        </FieldDiv>
        <Field label="Fecha">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </Field>
        <FieldDiv label="Responsables">
          <PeopleSelect value={assigneeIds} onChange={setAssigneeIds} />
        </FieldDiv>
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
