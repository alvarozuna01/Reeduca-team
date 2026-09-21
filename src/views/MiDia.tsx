import { useMemo, useState } from 'react'
import { addDays, formatDistanceToNow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { AtSign, CheckCircle2, FileText, MessageCircle, NotebookPen, Pin, Star, Sun, X } from 'lucide-react'
import { FEATURE_COMENTARIOS, type Task, type User } from '../types'
import { longDate, toKey, todayKey, uid } from '../lib/utils'
import { mencionaA } from '../lib/menciones'
import { useApp } from '../state/AppContext'
import { AvatarStack } from '../components/Avatar'
import { CommentBadge } from '../components/Comments'
import { TextoConMenciones } from '../components/Menciones'
import { ImportancePill, Stars, UrgentPill } from '../components/Stars'

/** Una mención a mí: en un comentario (con autor y hora) o en la descripción de una tarea. */
interface MencionAMi {
  clave: string
  task: Task
  texto: string
  autor?: User
  cuando?: string
}

export default function MiDia({
  onEdit,
  onOpenNote,
}: {
  onEdit: (t: Task) => void
  onOpenNote: (noteId: string) => void
}) {
  const { tasks, projects, users, notes, noteFolders, pins, taskComments, currentUser, hasFlag, upsertTask, upsertPin, removePin } =
    useApp()
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
            b.importance - a.importance ||
            Number(b.urgent) - Number(a.urgent) ||
            (a.date ?? '9999-99').localeCompare(b.date ?? '9999-99'),
        ),
    [mine],
  )

  const today = useMemo(
    () => mine.filter((t) => t.date === todayKey()).sort((a, b) => a.position - b.position),
    [mine],
  )
  const pendingToday = today.filter((t) => t.status !== 'done').length

  const toggleDone = (t: Task) => upsertTask({ ...t, status: t.status === 'done' ? 'todo' : 'done' })

  // Dónde me arrobaron: comentarios de otros de las últimas 2 semanas, y
  // descripciones de tareas abiertas. Así el mencionado se entera sin avisos.
  const comentariosOn = hasFlag(FEATURE_COMENTARIOS)
  const menciones = useMemo<MencionAMi[]>(() => {
    const taskById = new Map(tasks.map((t) => [t.id, t]))
    const corte = toKey(addDays(parseISO(todayKey()), -14))
    const deComentarios: MencionAMi[] = comentariosOn
      ? taskComments
          .filter((c) => c.userId !== me.id && c.createdAt.slice(0, 10) >= corte && mencionaA(c.text, me.id, users))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .flatMap((c) => {
            const task = taskById.get(c.taskId)
            return task
              ? [{ clave: c.id, task, texto: c.text, autor: users.find((u) => u.id === c.userId), cuando: c.createdAt }]
              : []
          })
      : []
    const deDescripciones: MencionAMi[] = tasks
      .filter((t) => t.status !== 'done' && mencionaA(t.description, me.id, users))
      .map((t) => ({ clave: `d-${t.id}`, task: t, texto: t.description! }))
    return [...deComentarios, ...deDescripciones].slice(0, 8)
  }, [comentariosOn, taskComments, tasks, users, me.id])

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

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
                        <span>{p?.name}</span>·<span>{t.date ?? '📥 sin fecha'}</span>
                        <CommentBadge taskId={t.id} />
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
                        <CommentBadge taskId={t.id} />
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        {/* Te mencionaron: aparece solo si alguien te arrobó */}
        {menciones.length > 0 && (
          <section className="mt-4 rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <span className="grid size-7 place-items-center rounded-lg bg-amber-100">
                <AtSign size={15} className="text-amber-600" />
              </span>
              <div>
                <h3 className="leading-tight font-extrabold text-slate-700">Te mencionaron</h3>
                <p className="text-[11px] font-semibold text-slate-400">
                  Comentarios de las últimas 2 semanas y descripciones de tareas abiertas donde aparece tu @
                </p>
              </div>
            </div>
            <div className="divide-y divide-slate-50 p-1.5">
              {menciones.map((m) => (
                <button
                  key={m.clave}
                  onClick={() => onEdit(m.task)}
                  className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-slate-50"
                >
                  {m.autor ? (
                    <MessageCircle size={16} className="mt-0.5 shrink-0 text-blue-500" />
                  ) : (
                    <FileText size={16} className="mt-0.5 shrink-0 text-slate-400" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-semibold text-slate-400">
                      {m.autor ? (
                        <>
                          <b className="text-slate-600">{m.autor.name}</b> te mencionó en{' '}
                        </>
                      ) : (
                        'En la descripción de '
                      )}
                      <b className="text-slate-600">{m.task.title}</b>
                      {m.cuando && ` · ${formatDistanceToNow(parseISO(m.cuando), { addSuffix: true, locale: es })}`}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-sm font-semibold text-slate-600">
                      <TextoConMenciones texto={m.texto} />
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

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
