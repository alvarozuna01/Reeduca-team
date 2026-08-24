import { Paperclip } from 'lucide-react'
import type { Project, Task, User } from '../types'
import { isOverdue, textOn } from '../lib/utils'
import { AvatarStack } from './Avatar'
import { ImportancePill, UrgentPill } from './Stars'

interface Props {
  task: Task
  project?: Project
  assignees: User[]
  onOpen?: () => void
  onToggleCheck?: (itemId: string) => void
  overlay?: boolean
}

export default function TaskCard({ task, project, assignees, onOpen, onToggleCheck, overlay }: Props) {
  const color = project?.color ?? '#94A3B8'
  const done = task.status === 'done'
  const overdue = isOverdue(task)
  const checked = task.checklist.filter((c) => c.done).length
  const pending = task.checklist.length - checked

  const time =
    task.startTime && task.endTime
      ? `${task.startTime} a ${task.endTime} hs.`
      : task.startTime
        ? `${task.startTime} hs.`
        : null

  return (
    <div
      onClick={onOpen}
      className={`cursor-pointer rounded-lg bg-white shadow-[0_1px_4px_rgba(15,23,42,0.14)] transition select-none hover:shadow-[0_3px_10px_rgba(15,23,42,0.2)] ${
        overlay ? 'rotate-2 shadow-2xl' : ''
      } ${task.urgent && !done ? 'ring-2 ring-[#e5484d]/70' : ''}`}
    >
      <div className="rounded-t-lg px-2.5 py-2" style={{ background: color }}>
        <p
          className={`text-right text-[11px] leading-tight font-extrabold tracking-wide uppercase ${
            done ? 'line-through opacity-75' : ''
          }`}
          style={{ color: textOn(color) }}
        >
          {task.title}
        </p>
      </div>

      <div className="space-y-1.5 px-2.5 pt-1.5 pb-2">
        {task.description && (
          <p className="text-right text-[11px] leading-snug text-slate-500">{task.description}</p>
        )}
        {time && <p className="text-right text-[11px] font-semibold text-slate-500">{time}</p>}

        {task.checklist.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5">
            <p className="mb-1 text-[9px] font-extrabold tracking-wider text-amber-700 uppercase">
              {pending > 0
                ? `Entrega este día · ${pending} pendiente${pending > 1 ? 's' : ''}`
                : 'Checklist completo'}
            </p>
            <ul className="space-y-0.5">
              {task.checklist.map((c) => (
                <li key={c.id} className="flex items-start gap-1.5">
                  <input
                    type="checkbox"
                    checked={c.done}
                    disabled={!onToggleCheck}
                    onChange={() => onToggleCheck?.(c.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-0.5 size-3 accent-emerald-500 disabled:opacity-50"
                  />
                  <span
                    className={`text-[11px] leading-snug text-slate-600 ${c.done ? 'line-through opacity-60' : ''}`}
                  >
                    {c.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {task.links.map((l) => (
          <a
            key={l.id}
            href={l.url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-center gap-1.5 rounded-md bg-slate-100 px-2 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-200"
          >
            <Paperclip size={11} /> {l.label || 'Abrir enlace'}
          </a>
        ))}

        <div className="flex items-center justify-between gap-1 pt-0.5">
          <span className="flex flex-wrap items-center gap-1">
            {task.urgent && !done && <UrgentPill />}
            {overdue && (
              <span className="rounded-sm bg-[#e5484d] px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-white uppercase">
                Atrasada
              </span>
            )}
            <ImportancePill value={task.importance} />
            {task.checklist.length > 0 && (
              <span className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-700">
                {checked}/{task.checklist.length}
              </span>
            )}
          </span>
          <AvatarStack users={assignees} size={20} />
        </div>
      </div>
    </div>
  )
}
