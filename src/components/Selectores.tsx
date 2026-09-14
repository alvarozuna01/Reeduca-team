import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { textOn } from '../lib/utils'
import { normalizar } from '../lib/menciones'
import { useApp } from '../state/AppContext'
import { Avatar } from './Avatar'

/** Abre/cierra un desplegable; se cierra con un clic afuera o con Escape. */
function useDesplegable() {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!abierto) return
    const afuera = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('mousedown', afuera)
    document.addEventListener('touchstart', afuera)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', afuera)
      document.removeEventListener('touchstart', afuera)
      document.removeEventListener('keydown', escape)
    }
  }, [abierto])
  return { abierto, setAbierto, ref }
}

const disparadorCls =
  'flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left text-sm transition hover:border-slate-300 focus:border-blue-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60'

/**
 * Lista desplegable de proyectos, siempre con sus colores, en el orden que
 * configura el Gerente desde su panel.
 */
export function ProjectSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { projects } = useApp()
  const { abierto, setAbierto, ref } = useDesplegable()
  const sel = projects.find((p) => p.id === value)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        className={`${disparadorCls} min-h-[42px]`}
      >
        {sel ? (
          <span
            className="flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold"
            style={{ background: sel.color, color: textOn(sel.color) }}
          >
            <span className="size-2 shrink-0 rounded-full" style={{ background: textOn(sel.color) }} />
            <span className="truncate">{sel.name}</span>
          </span>
        ) : (
          <span className="px-1 text-slate-300">Elegí un proyecto…</span>
        )}
        <ChevronDown size={16} className={`ml-auto shrink-0 text-slate-400 transition ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto && (
        <div
          role="listbox"
          className="absolute top-full left-0 z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
        >
          {projects.map((p) => {
            const activo = p.id === value
            return (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={activo}
                onClick={() => {
                  onChange(p.id)
                  setAbierto(false)
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                style={activo ? { background: `${p.color}22` } : undefined}
              >
                <span className="size-3.5 shrink-0 rounded-md" style={{ background: p.color }} />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                {activo && <Check size={15} className="shrink-0 text-slate-500" />}
              </button>
            )
          })}
          {projects.length === 0 && (
            <p className="px-3 py-3 text-center text-xs font-semibold text-slate-300">Todavía no hay proyectos.</p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Lista desplegable de responsables (se pueden elegir varios), cada uno con su
 * foto o su color. Vos aparecés primero.
 */
export function PeopleSelect({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { users } = useApp()
  const { abierto, setAbierto, ref } = useDesplegable()
  const elegidos = users.filter((u) => value.includes(u.id))

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        className={`${disparadorCls} min-h-[42px]`}
      >
        {elegidos.length ? (
          <span className="flex min-w-0 flex-1 flex-wrap gap-1">
            {elegidos.map((u) => (
              <span
                key={u.id}
                className="flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pr-2 pl-0.5 text-xs font-bold text-slate-600"
              >
                <Avatar user={u} size={20} />
                <span className="max-w-[9rem] truncate">{u.name}</span>
              </span>
            ))}
          </span>
        ) : (
          <span className="flex-1 px-1 text-slate-300">Sin responsables</span>
        )}
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto && (
        <ListaPersonas
          value={value}
          onToggle={(id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])}
          onListo={() => setAbierto(false)}
        />
      )}
    </div>
  )
}

/** El contenido del desplegable (se monta al abrir, así la búsqueda arranca vacía). */
function ListaPersonas({
  value,
  onToggle,
  onListo,
}: {
  value: string[]
  onToggle: (id: string) => void
  onListo: () => void
}) {
  const { users, currentUser } = useApp()
  const [busca, setBusca] = useState('')
  const lista = useMemo(() => {
    const q = normalizar(busca.trim())
    const base = q ? users.filter((u) => normalizar(u.name).includes(q)) : users
    return [...base].sort((a, b) => Number(b.id === currentUser?.id) - Number(a.id === currentUser?.id))
  }, [users, busca, currentUser])

  return (
    <div className="absolute top-full left-0 z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
      {users.length > 6 && (
        <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
          <Search size={14} className="shrink-0 text-slate-300" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar persona…"
            className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-300"
          />
        </div>
      )}
      <div role="listbox" aria-multiselectable className="max-h-64 overflow-y-auto p-1">
        {lista.map((u) => {
          const activo = value.includes(u.id)
          return (
            <button
              key={u.id}
              type="button"
              role="option"
              aria-selected={activo}
              onClick={() => onToggle(u.id)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm font-bold transition ${
                activo ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Avatar user={u} size={26} />
              <span className="min-w-0 flex-1 truncate">
                {u.name}
                {u.id === currentUser?.id && <span className="ml-1.5 text-[10px] font-extrabold text-slate-400">(vos)</span>}
              </span>
              <span
                className={`grid size-5 shrink-0 place-items-center rounded-md border ${
                  activo ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white'
                }`}
              >
                {activo && <Check size={13} />}
              </span>
            </button>
          )
        })}
        {lista.length === 0 && (
          <p className="px-3 py-3 text-center text-xs font-semibold text-slate-300">Nadie con ese nombre.</p>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2">
        <span className="text-[11px] font-bold text-slate-400">
          {value.length} elegido{value.length === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          onClick={onListo}
          className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-extrabold text-white hover:bg-blue-700"
        >
          Listo
        </button>
      </div>
    </div>
  )
}

/**
 * Lista desplegable de UNA persona (responsable de una acción acordada).
 * Compacta, para usar dentro de una fila.
 */
export function PersonSelect({
  value,
  onChange,
  placeholder = 'Sin responsable',
}: {
  value?: string | null
  onChange: (id: string | null) => void
  placeholder?: string
}) {
  const { users, currentUser } = useApp()
  const { abierto, setAbierto, ref } = useDesplegable()
  const sel = users.find((u) => u.id === value)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white py-1 pr-1.5 pl-1 text-xs font-bold text-slate-600 transition hover:border-slate-300"
      >
        {sel ? (
          <>
            <Avatar user={sel} size={18} />
            <span className="max-w-[7rem] truncate">{sel.name}</span>
          </>
        ) : (
          <span className="px-1 text-slate-300">{placeholder}</span>
        )}
        <ChevronDown size={13} className={`shrink-0 text-slate-400 transition ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto && (
        <div
          role="listbox"
          className="absolute top-full left-0 z-30 mt-1 max-h-64 w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
        >
          <button
            type="button"
            onClick={() => {
              onChange(null)
              setAbierto(false)
            }}
            className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-slate-400 transition hover:bg-slate-50"
          >
            {placeholder}
          </button>
          {users.map((u) => (
            <button
              key={u.id}
              type="button"
              role="option"
              aria-selected={u.id === value}
              onClick={() => {
                onChange(u.id)
                setAbierto(false)
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm font-bold transition ${
                u.id === value ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Avatar user={u} size={22} />
              <span className="min-w-0 flex-1 truncate">{u.name}</span>
              {u.id === currentUser?.id && <span className="text-[10px] font-extrabold text-slate-400">(vos)</span>}
              {u.id === value && <Check size={14} className="shrink-0 text-blue-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
