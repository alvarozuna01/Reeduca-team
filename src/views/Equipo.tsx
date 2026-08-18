import { useMemo, useState } from 'react'
import { Pencil, Plus, Star, Trash2 } from 'lucide-react'
import type { Role, Task, User } from '../types'
import { STATUS_LABEL, USER_COLORS, isOverdue, uid } from '../lib/utils'
import { useApp } from '../state/AppContext'
import { Avatar, AvatarStack } from '../components/Avatar'
import Modal, { Field, inputCls } from '../components/Modal'
import { Stars, UrgentPill } from '../components/Stars'

export default function Equipo({ onEditTask }: { onEditTask: (t: Task) => void }) {
  const { users, projects, tasks, isAdmin, currentUser, removeUser, demo } = useApp()
  const [editing, setEditing] = useState<User | 'new' | null>(null)

  const stats = useMemo(
    () => ({
      total: tasks.length,
      done: tasks.filter((t) => t.status === 'done').length,
      doing: tasks.filter((t) => t.status === 'doing').length,
      overdue: tasks.filter(isOverdue).length,
    }),
    [tasks],
  )

  const perUser = useMemo(
    () =>
      users.map((u) => {
        const mine = tasks.filter((t) => t.assigneeIds.includes(u.id))
        return {
          u,
          total: mine.length,
          done: mine.filter((t) => t.status === 'done').length,
          doing: mine.filter((t) => t.status === 'doing').length,
          todo: mine.filter((t) => t.status === 'todo').length,
          overdue: mine.filter(isOverdue).length,
        }
      }),
    [users, tasks],
  )
  const maxLoad = Math.max(1, ...perUser.map((p) => p.total))

  const critical = useMemo(
    () =>
      tasks
        .filter((t) => t.importance >= 4 && t.status !== 'done')
        .sort((a, b) => b.importance - a.importance || Number(b.urgent) - Number(a.urgent) || a.date.localeCompare(b.date)),
    [tasks],
  )

  const perProject = useMemo(
    () =>
      projects.map((p) => {
        const list = tasks.filter((t) => t.projectId === p.id)
        return { p, total: list.length, done: list.filter((t) => t.status === 'done').length }
      }),
    [projects, tasks],
  )

  if (!isAdmin) {
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div>
          <p className="text-lg font-black text-slate-700">Vista exclusiva del Gerente</p>
          <p className="mt-1 text-sm text-slate-400">
            Tu rol actual es de Equipo. Pedile a un Gerente que te cambie el rol si necesitás acceso.
          </p>
        </div>
      </div>
    )
  }

  const del = (u: User) => {
    if (u.id === currentUser?.id) return
    if (confirm(`¿Eliminar a ${u.name}? Sus tareas quedarán sin asignar.`)) removeUser(u.id)
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-5">
        <div>
          <h2 className="text-xl font-black text-slate-800">Panel del Gerente</h2>
          <p className="text-sm text-slate-400">Rendimiento del equipo, carga de trabajo y gestión de RRHH.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Tareas totales" value={stats.total} />
          <StatTile label="Completadas" value={stats.done} accent="#34C48E" />
          <StatTile label="En progreso" value={stats.doing} accent="#5AB6E8" />
          <StatTile label="Atrasadas" value={stats.overdue} accent="#e5484d" />
        </div>

        {/* Control de tareas críticas (4–5 estrellas) de todo el equipo */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-1 flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-amber-100">
              <Star size={15} className="fill-amber-500 text-amber-500" />
            </span>
            <div>
              <h3 className="leading-tight font-extrabold text-slate-700">Tareas críticas del equipo</h3>
              <p className="text-[11px] font-semibold text-slate-400">
                Todas las tareas de 4–5 estrellas pendientes, de cualquier persona
              </p>
            </div>
          </div>
          <div className="divide-y divide-slate-50">
            {critical.length === 0 && (
              <p className="py-5 text-center text-sm font-semibold text-slate-300">
                No hay tareas críticas pendientes. 🎉
              </p>
            )}
            {critical.map((t) => {
              const p = projects.find((x) => x.id === t.projectId)
              return (
                <button
                  key={t.id}
                  onClick={() => onEditTask(t)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition hover:bg-slate-50"
                >
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: p?.color ?? '#94A3B8' }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-extrabold text-slate-700">{t.title}</span>
                    <span className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                      <Stars value={t.importance} />
                      {t.urgent && <UrgentPill />}
                      <span>{p?.name}</span>·<span>{t.date}</span>·<span>{STATUS_LABEL[t.status]}</span>
                    </span>
                  </span>
                  <AvatarStack users={users.filter((u) => t.assigneeIds.includes(u.id))} size={20} />
                </button>
              )
            })}
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 font-extrabold text-slate-700">Carga de trabajo por persona</h3>
            <div className="space-y-3">
              {perUser.map(({ u, total, done, doing, todo, overdue }) => (
                <div key={u.id} className="flex items-center gap-3">
                  <div className="flex w-32 shrink-0 items-center gap-2">
                    <Avatar user={u} size={26} />
                    <span className="truncate text-sm font-bold text-slate-600">{u.name}</span>
                  </div>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="flex h-full" style={{ width: `${(total / maxLoad) * 100}%` }}>
                      {done > 0 && <div style={{ flex: done, background: '#34C48E' }} />}
                      {doing > 0 && <div style={{ flex: doing, background: '#5AB6E8' }} />}
                      {todo > 0 && <div style={{ flex: todo, background: '#CBD5E1' }} />}
                    </div>
                  </div>
                  <span className="w-28 shrink-0 text-right text-[11px] font-bold text-slate-400">
                    {total} tarea{total === 1 ? '' : 's'}
                    {overdue > 0 && <span className="text-[#e5484d]"> · {overdue} atrasada{overdue === 1 ? '' : 's'}</span>}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 flex items-center gap-3 text-[10px] font-bold text-slate-400">
              <span className="flex items-center gap-1"><i className="size-2 rounded-full" style={{ background: '#34C48E' }} /> Completado</span>
              <span className="flex items-center gap-1"><i className="size-2 rounded-full" style={{ background: '#5AB6E8' }} /> En progreso</span>
              <span className="flex items-center gap-1"><i className="size-2 rounded-full" style={{ background: '#CBD5E1' }} /> Por hacer</span>
            </p>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 font-extrabold text-slate-700">Estado global por proyecto</h3>
            <div className="space-y-3">
              {perProject.map(({ p, total, done }) => (
                <div key={p.id}>
                  <div className="mb-1 flex items-center gap-2 text-sm">
                    <span className="size-2.5 rounded-full" style={{ background: p.color }} />
                    <span className="font-bold text-slate-600">{p.name}</span>
                    <span className="ml-auto text-[11px] font-bold text-slate-400">
                      {done}/{total} completadas
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: total ? `${(done / total) * 100}%` : 0, background: p.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-extrabold text-slate-700">Miembros del equipo</h3>
            <button
              onClick={() => setEditing('new')}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-blue-700"
            >
              <Plus size={14} /> Agregar miembro
            </button>
          </div>
          {!demo && (
            <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500">
              Con Supabase conectado, cada persona crea su cuenta desde la pantalla de inicio. Acá podés editar su
              perfil y su rol una vez registrada.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
                <Avatar user={u} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-extrabold text-slate-700">{u.name}</p>
                  <p className="truncate text-xs text-slate-400">{u.email}</p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase ${
                      u.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {u.role === 'admin' ? 'Gerente' : 'Equipo'}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => setEditing(u)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    title="Editar"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => del(u)}
                    disabled={u.id === currentUser?.id}
                    className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                    title={u.id === currentUser?.id ? 'No podés eliminarte a vos mismo' : 'Eliminar'}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {editing && <MemberModal user={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function StatTile({ label, value, accent = '#334155' }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-2xl font-black" style={{ color: accent }}>
        {value}
      </p>
      <p className="text-[11px] font-extrabold tracking-wide text-slate-400 uppercase">{label}</p>
    </div>
  )
}

function MemberModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { upsertUser } = useApp()
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [role, setRole] = useState<Role>(user?.role ?? 'member')
  const [color, setColor] = useState(user?.color ?? USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)])
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '')

  const save = () => {
    upsertUser({
      id: user?.id ?? uid(),
      name: name.trim(),
      email: email.trim(),
      role,
      color,
      avatarUrl: avatarUrl.trim() || undefined,
    })
    onClose()
  }

  return (
    <Modal title={user ? `Editar a ${user.name}` : 'Nuevo miembro'} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Nombre">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre y apellido" className={inputCls} autoFocus />
        </Field>
        <Field label="Email">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="persona@equipo.com" className={inputCls} />
        </Field>
        <Field label="Rol">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
            {(['member', 'admin'] as Role[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`rounded-md px-2 py-1.5 text-xs font-extrabold transition ${
                  role === r ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {r === 'admin' ? 'Gerente / Admin' : 'Equipo'}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Color">
          <div className="flex flex-wrap gap-2">
            {USER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`size-7 rounded-full transition ${color === c ? 'ring-2 ring-slate-700 ring-offset-2' : 'hover:scale-110'}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </Field>
        <Field label="Foto (URL de imagen, opcional)">
          <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" className={inputCls} />
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
