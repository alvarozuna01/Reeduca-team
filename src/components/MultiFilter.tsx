import { useState } from 'react'
import { Check, ChevronDown, Eye, EyeOff, X } from 'lucide-react'
import type { User } from '../types'
import { Avatar } from './Avatar'

/** Botón "ojito" para ocultar/mostrar un grupo de tareas (completadas, sin fecha…). */
export function HideToggle({
  hidden,
  onChange,
  label,
}: {
  hidden: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      onClick={() => onChange(!hidden)}
      title={hidden ? `Mostrar ${label.toLowerCase()}` : `Ocultar ${label.toLowerCase()}`}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
        hidden
          ? 'border-slate-300 bg-slate-200 text-slate-500'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
      }`}
    >
      {hidden ? <EyeOff size={13} /> : <Eye size={13} />}
      <span className={hidden ? 'line-through' : ''}>{label}</span>
    </button>
  )
}

export interface FilterOption {
  id: string
  label: string
  color?: string
  user?: User
}

/** Filtro de selección múltiple (proyectos, personas…). Vacío = mostrar todo. */
export default function MultiFilter({
  label,
  options,
  selected,
  onChange,
  align = 'right',
}: {
  label: string
  options: FilterOption[]
  selected: string[]
  onChange: (ids: string[]) => void
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
          selected.length
            ? 'border-blue-300 bg-blue-50 text-blue-700'
            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
        }`}
      >
        {label}
        {selected.length > 0 && (
          <span className="rounded-full bg-blue-600 px-1.5 py-px text-[10px] font-extrabold text-white">
            {selected.length}
          </span>
        )}
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={`absolute z-50 mt-1 max-h-72 w-60 overflow-y-auto rounded-xl border border-slate-100 bg-white p-1.5 shadow-xl ${
              align === 'right' ? 'right-0' : 'left-0'
            }`}
          >
            {options.map((o) => {
              const active = selected.includes(o.id)
              return (
                <button
                  key={o.id}
                  onClick={() => toggle(o.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  <span
                    className={`grid size-4 shrink-0 place-items-center rounded border transition ${
                      active ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white'
                    }`}
                  >
                    {active && <Check size={11} />}
                  </span>
                  {o.user ? (
                    <Avatar user={o.user} size={18} />
                  ) : o.color ? (
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: o.color }} />
                  ) : null}
                  <span className="truncate">{o.label}</span>
                </button>
              )
            })}
            {selected.length > 0 && (
              <button
                onClick={() => onChange([])}
                className="mt-1 flex w-full items-center justify-center gap-1 border-t border-slate-100 px-2 py-1.5 text-[11px] font-bold text-slate-400 hover:text-red-500"
              >
                <X size={11} /> Limpiar filtro
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
