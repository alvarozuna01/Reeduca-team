import { useState } from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { MessageCircle, Send, Trash2 } from 'lucide-react'
import { FEATURE_COMENTARIOS, type TaskComment } from '../types'
import { uid } from '../lib/utils'
import { useApp } from '../state/AppContext'
import { Avatar } from './Avatar'
import { MentionField, TextoConMenciones } from './Menciones'
import { inputCls } from './Modal'

/**
 * Pastilla "💬 N" para tarjetas y filas de tareas.
 * No renderiza nada si la tarea no tiene comentarios o la llave está apagada.
 */
export function CommentBadge({ taskId }: { taskId: string }) {
  const { taskComments, hasFlag } = useApp()
  if (!hasFlag(FEATURE_COMENTARIOS)) return null
  const n = taskComments.reduce((acc, c) => (c.taskId === taskId ? acc + 1 : acc), 0)
  if (n === 0) return null
  return (
    <span
      title={`${n} comentario${n === 1 ? '' : 's'}`}
      className="flex items-center gap-0.5 rounded-sm bg-blue-100 px-1.5 py-0.5 text-[9px] font-extrabold text-blue-700"
    >
      <MessageCircle size={9} className="fill-blue-700 text-blue-700" /> {n}
    </span>
  )
}

/**
 * Hilo de comentarios de una tarea, para el panel de la tarea.
 * Comentar NO requiere poder editar la tarea: justamente sirve para
 * opinar sobre las tareas de otros. Borra el autor o un Gerente.
 */
export function TaskComments({ taskId }: { taskId: string }) {
  const { taskComments, users, currentUser, isAdmin, upsertTaskComment, removeTaskComment } = useApp()
  const [text, setText] = useState('')
  const list = taskComments
    .filter((c) => c.taskId === taskId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const send = () => {
    const t = text.trim()
    if (!t || !currentUser) return
    upsertTaskComment({ id: uid(), taskId, userId: currentUser.id, text: t, createdAt: new Date().toISOString() })
    setText('')
  }

  const del = (c: TaskComment) => {
    if (confirm('¿Borrar este comentario?')) removeTaskComment(c.id)
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-wide text-slate-400 uppercase">
        <MessageCircle size={12} /> Comentarios{list.length > 0 ? ` (${list.length})` : ''}
      </p>
      <p className="text-[11px] font-semibold text-slate-400">
        Los ve todo el equipo. Podés comentar aunque la tarea no sea tuya.
      </p>

      <div className="mt-2.5 space-y-2.5">
        {list.map((c) => {
          const author = users.find((u) => u.id === c.userId)
          const own = c.userId === currentUser?.id
          return (
            <div key={c.id} className="group flex items-start gap-2">
              {author && <Avatar user={author} size={24} />}
              <div className="min-w-0 flex-1 rounded-lg rounded-tl-none bg-white px-2.5 py-1.5 shadow-sm">
                <p className="flex flex-wrap items-baseline gap-x-2 text-[11px]">
                  <span className="font-extrabold text-slate-600">{author?.name ?? 'Alguien'}</span>
                  <span className="font-semibold text-slate-300">
                    {formatDistanceToNow(parseISO(c.createdAt), { addSuffix: true, locale: es })}
                  </span>
                </p>
                <p className="text-sm leading-snug font-semibold whitespace-pre-wrap text-slate-700">
                  <TextoConMenciones texto={c.text} />
                </p>
              </div>
              {(own || isAdmin) && (
                <button
                  onClick={() => del(c)}
                  title={own ? 'Borrar tu comentario' : 'Borrar comentario (Gerente)'}
                  className="mt-1 shrink-0 rounded-lg p-1 text-slate-300 transition hover:bg-red-50 hover:text-red-500 md:opacity-0 md:group-hover:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        {currentUser && <Avatar user={currentUser} size={24} />}
        <MentionField
          value={text}
          onChange={setText}
          onEnter={send}
          hacia="arriba"
          placeholder="Escribí un comentario… (con @ mencionás a alguien)"
          className={`${inputCls} bg-white`}
          wrapperClassName="relative min-w-0 flex-1"
        />
        <button
          onClick={send}
          disabled={!text.trim()}
          title="Comentar"
          className="shrink-0 rounded-lg bg-blue-600 p-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  )
}
