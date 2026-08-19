import { useState } from 'react'
import {
  CalendarDays,
  ClipboardList,
  FolderOpen,
  LogOut,
  NotebookPen,
  Plus,
  SquareKanban,
  Sunrise,
  UserRound,
  Users,
} from 'lucide-react'
import { useApp } from '../state/AppContext'
import { USER_COLORS } from '../lib/utils'
import { Avatar } from './Avatar'
import Modal, { Field, inputCls } from './Modal'

export type View = 'midia' | 'agenda' | 'kanban' | 'minutas' | 'cuaderno' | 'proyectos' | 'equipo'

const TABS: { id: View; label: string; icon: typeof CalendarDays; adminOnly?: boolean }[] = [
  { id: 'midia', label: 'Mi Día', icon: Sunrise },
  { id: 'agenda', label: 'Agenda', icon: CalendarDays },
  { id: 'kanban', label: 'Kanban', icon: SquareKanban },
  { id: 'minutas', label: 'Minutas', icon: ClipboardList },
  { id: 'cuaderno', label: 'Cuaderno', icon: NotebookPen },
  { id: 'proyectos', label: 'Proyectos', icon: FolderOpen },
  { id: 'equipo', label: 'Equipo', icon: Users, adminOnly: true },
]

export default function TopBar({
  view,
  setView,
  onNew,
}: {
  view: View
  setView: (v: View) => void
  onNew: () => void
}) {
  const { currentUser, isAdmin, logout, demo } = useApp()
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  if (!currentUser) return null

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-blue-600 text-sm font-black text-white">R</span>
        <span className="hidden font-black text-slate-800 sm:block">
          ReEduca <span className="font-bold text-slate-400">· Equipo</span>
        </span>
      </div>

      <nav className="mx-auto hidden items-center gap-1 md:flex">
        {TABS.filter((t) => !t.adminOnly || isAdmin).map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold transition ${
              view === t.id ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
            title={t.label}
          >
            <t.icon size={16} />
            <span className="hidden lg:block">{t.label}</span>
          </button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2.5 md:ml-0">
        {demo && (
          <span
            className="hidden rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-extrabold text-amber-700 lg:block"
            title="Los datos se guardan en este navegador. Conectá Supabase para usar cuentas reales (ver README)."
          >
            Modo demo
          </span>
        )}
        <button
          onClick={onNew}
          className="flex items-center gap-1 rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-extrabold text-white shadow-sm hover:bg-blue-700"
        >
          <Plus size={16} /> Nueva
        </button>
        <button onClick={() => setMenuOpen((o) => !o)} className="rounded-full transition hover:opacity-80">
          <Avatar user={currentUser} size={32} />
        </button>
      </div>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute top-14 right-4 z-50 w-60 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-xl">
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="font-extrabold text-slate-800">{currentUser.name}</p>
              <p className="truncate text-xs text-slate-400">{currentUser.email}</p>
              <span className="mt-1.5 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-slate-500 uppercase">
                {currentUser.role === 'admin' ? 'Gerente' : 'Equipo'}
              </span>
            </div>
            <button
              onClick={() => {
                setMenuOpen(false)
                setProfileOpen(true)
              }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              <UserRound size={15} /> Editar mi perfil
            </button>
            <button
              onClick={logout}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50"
            >
              <LogOut size={15} /> Cerrar sesión
            </button>
          </div>
        </>
      )}

      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
    </header>
  )
}

/** Navegación inferior para celulares (en pantallas grandes se usa la barra superior). */
export function BottomNav({ view, setView }: { view: View; setView: (v: View) => void }) {
  const { isAdmin } = useApp()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-slate-200 bg-white/95 pt-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
      {TABS.filter((t) => !t.adminOnly || isAdmin).map((t) => (
        <button
          key={t.id}
          onClick={() => setView(t.id)}
          className={`flex min-w-0 flex-col items-center gap-0.5 rounded-lg px-1.5 py-1 text-[9px] font-extrabold transition ${
            view === t.id ? 'text-blue-600' : 'text-slate-400'
          }`}
        >
          <t.icon size={19} />
          <span className="truncate">{t.label}</span>
        </button>
      ))}
    </nav>
  )
}

function ProfileModal({ onClose }: { onClose: () => void }) {
  const { currentUser, upsertUser, changePassword, demo } = useApp()
  const [name, setName] = useState(currentUser!.name)
  const [color, setColor] = useState(currentUser!.color)
  const [avatarUrl, setAvatarUrl] = useState(currentUser!.avatarUrl ?? '')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  const save = async () => {
    upsertUser({ ...currentUser!, name: name.trim() || currentUser!.name, color, avatarUrl: avatarUrl.trim() || undefined })
    if (!demo && password.trim()) {
      const err = await changePassword(password.trim())
      if (err) {
        setMsg(err)
        return
      }
    }
    onClose()
  }

  return (
    <Modal title="Mi perfil" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Nombre">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
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
        {!demo && (
          <Field label="Nueva contraseña (opcional)">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Dejar vacío para no cambiarla"
              className={inputCls}
            />
          </Field>
        )}
        {msg && <p className="text-sm font-bold text-red-500">{msg}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100">
            Cancelar
          </button>
          <button onClick={save} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-700">
            Guardar
          </button>
        </div>
      </div>
    </Modal>
  )
}
