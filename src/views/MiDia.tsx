import { useMemo, useState } from 'react'
import { CheckCircle2, NotebookPen, Pin, Star, Sun, X } from 'lucide-react'
import type { Task } from '../types'
import { longDate, todayKey, uid } from '../lib/utils'
import { useApp } from '../state/AppContext'
import { AvatarStack } from '../components/Avatar'
import { ImportancePill, Stars, UrgentPill } from '../components/Stars'

export default function MiDia({
  onEdit,
  onOpenNote,
}: {
  onEdit: (t: Task) => void
  onOpenNote: (noteId: string) => void
}) {
  const { tasks, projects, users, notes, noteFolders, pins, currentUser, upsertTask, upsertPin, removePin } = useApp()
  const me = currentUser!
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])
  const [reminder, setReminder] = useState('')

  const myPins = useMemo(
    () => pins.filter((p) => p.userId === me.id).sort((a, b) => a.position - b.position),
    [pins, me.id],
  )

  const addReminder = () => {
    const text = reminder.trim()
    if (!text) return
    upsertPin({ id: uid(), userId: me.id, text, position: myPins.length })
    setReminder('')
  }

  const mine = useMemo(() => tasks.filter((t) => t.assigneeIds.includes(me.id)), [tasks, me.id])

  const critical = useMemo(
    () =>
      mine
        .filter((t) => t.importance >= 4 && t.status !== 'done')
        .sort(
          (a, b) =>
            b.importance - a.importance || Number(b.urgent) - Number(a.urgent) || a.date.localeCompare(b.date),
        ),
    [mine],
  )

  const today = useMemo(
    () => mine.filter((t) => t.date === todayKey()).sort((a, b) => a.position - b.position),
    [mine],
  )
  const pendingToday = today.filter((t) => t.status !== 'done').length

  const toggleDone = (t: Task) => upsertTask({ ...t, status: t.status === 'done' ? 'todo' : 'done' })

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-5">
          <h2 className="text-2xl font-black text-slate-800">Hola, {me.name} 👋</h2>
          <p className="mt-0.5 text-sm font-semibold text-slate-400 capitalize">{longDate(new Date())}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-extrabold text-blue-700">
              {pendingToday} pendiente{pendingToday === 1 ? '' : 's'} para hoy
            </span>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-extrabold text-amber-700">
              {critical.length} recordatorio{critical.length === 1 ? '' : 's'} crítico{critical.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Recordatorios críticos */}
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <span className="grid size-7 place-items-center rounded-lg bg-amber-100">
                <Star size={15} className="fill-amber-500 text-amber-500" />
              </span>
              <div>
                <h3 className="leading-tight font-extrabold text-slate-700">Recordatorios críticos</h3>
                <p className="text-[11px] font-semibold text-slate-400">
                  Tus tareas de 4–5 estrellas, sin importar la fecha
                </p>
              </div>
            </div>
            <div className="divide-y divide-slate-50 p-1.5">
              {critical.length === 0 && (
                <p className="px-3 py-6 text-center text-sm font-semibold text-slate-300">
                  Nada crítico pendiente. ¡Bien ahí! 🎉
                </p>
              )}
              {critical.map((t) => {
                const p = projectById.get(t.projectId)
                return (
                  <button
                    key={t.id}
                    onClick={() => onEdit(t)}
                    className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-slate-50"
                  >
                    <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: p?.color ?? '#94A3B8' }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-extrabold text-slate-700">{t.title}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                        <Stars value={t.importance} />
                        {t.urgent && <UrgentPill />}
                        <span>{p?.name}</span>·<span>{t.date}</span>
                      </span>
                    </span>
                    <AvatarStack users={users.filter((u) => t.assigneeIds.includes(u.id))} size={18} />
                  </button>
                )
              })}
            </div>
          </section>

          {/* Agenda de hoy */}
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <span className="grid size-7 place-items-center rounded-lg bg-blue-100">
                <Sun size={15} className="text-blue-600" />
              </span>
              <div>
                <h3 className="leading-tight font-extrabold text-slate-700">Agenda de hoy</h3>
                <p className="text-[11px] font-semibold text-slate-400">
                  Marcá con un clic lo que vayas terminando
                </p>
              </div>
            </div>
            <div className="divide-y divide-slate-50 p-1.5">
              {today.length === 0 && (
                <p className="px-3 py-6 text-center text-sm font-semibold text-slate-300">
                  No tenés tareas agendadas para hoy.
                </p>
              )}
              {today.map((t) => {
                const p = projectById.get(t.projectId)
                const done = t.status === 'done'
                return (
                  <div key={t.id} className="flex items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-slate-50">
                    <button
                      onClick={() => toggleDone(t)}
                      title={done ? 'Marcar como pendiente' : 'Marcar como completada'}
                      className={done ? 'text-emerald-500' : 'text-slate-300 hover:text-emerald-400'}
                    >
                      <CheckCircle2 size={20} className={done ? 'fill-emerald-100' : ''} />
                    </button>
                    <button onClick={() => onEdit(t)} className="min-w-0 flex-1 text-left">
                      <span
                        className={`block truncate text-sm font-extrabold ${
                          done ? 'text-slate-300 line-through' : 'text-slate-700'
                        }`}
                      >
                        {t.title}
                      </span>
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                        {t.startTime && <span>{t.startTime} hs.</span>}
                        <span className="size-1.5 rounded-full" style={{ background: p?.color ?? '#94A3B8' }} />
                        <span>{p?.name}</span>
                        {!done && t.urgent && <UrgentPill />}
                        <ImportancePill value={t.importance} />
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        {/* Fijados: notas ancladas y recordatorios sueltos */}
        <section className="mt-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <span className="grid size-7 place-items-center rounded-lg bg-blue-100">
              <Pin size={15} className="fill-blue-600 text-blue-600" />
            </span>
            <div>
              <h3 className="leading-tight font-extrabold text-slate-700">Fijados</h3>
              <p className="text-[11px] font-semibold text-slate-400">
                Notas y recordatorios anclados acá para que no se te escapen
              </p>
            </div>
          </div>
          <div className="divide-y divide-slate-50 p-1.5">
            {myPins.map((p) => {
              if (p.noteId) {
                const note = notes.find((n) => n.id === p.noteId)
                if (!note) return null
                const folder = note.folderId ? noteFolders.find((f) => f.id === note.folderId) : undefined
                return (
                  <div key={p.id} className="group flex items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-slate-50">
                    <NotebookPen size={16} className="shrink-0 text-blue-500" />
                    <button onClick={() => onOpenNote(note.id)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm font-extrabold text-slate-700">
                        {note.title || 'Nota nueva'}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400">
                        Nota del cuaderno{folder ? ` · ${folder.name}` : ''} — tocá para abrirla
                      </span>
                    </button>
                    <button
                      onClick={() => removePin(p.id)}
                      title="Quitar de fijados"
                      className="rounded-lg p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-500 md:opacity-0 md:group-hover:opacity-100"
                    >
                      <X size={15} />
                    </button>
                  </div>
                )
              }
              return (
                <div key={p.id} className="group flex items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-slate-50">
                  <Pin size={15} className="shrink-0 text-amber-500" />
                  <span className="min-w-0 flex-1 text-sm font-bold text-slate-600">{p.text}</span>
                  <button
                    onClick={() => removePin(p.id)}
                    title="Quitar de fijados"
                    className="rounded-lg p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-500 md:opacity-0 md:group-hover:opacity-100"
                  >
                    <X size={15} />
                  </button>
                </div>
              )
            })}
            <div className="flex items-center gap-3 rounded-lg px-3 py-2">
              <Pin size={15} className="shrink-0 text-slate-300" />
              <input
                value={reminder}
                onChange={(e) => setReminder(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addReminder()
                }}
                placeholder="Escribí un recordatorio y apretá Enter para fijarlo…"
                className="w-full bg-transparent text-sm font-semibold text-slate-600 outline-none placeholder:text-slate-300"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
