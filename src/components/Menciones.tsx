import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { User } from '../types'
import { encontrarMenciones, normalizar } from '../lib/menciones'
import { useApp } from '../state/AppContext'
import { Avatar } from './Avatar'

/** Texto con las @menciones resaltadas (la tuya, en ámbar para que salte a la vista). */
export function TextoConMenciones({ texto }: { texto: string }) {
  const { users, currentUser } = useApp()
  const partes = useMemo(() => {
    const out: ({ texto: string } | { texto: string; user: User })[] = []
    let desde = 0
    for (const m of encontrarMenciones(texto, users)) {
      if (m.inicio > desde) out.push({ texto: texto.slice(desde, m.inicio) })
      out.push({ texto: texto.slice(m.inicio, m.fin), user: m.user })
      desde = m.fin
    }
    if (desde < texto.length) out.push({ texto: texto.slice(desde) })
    return out
  }, [texto, users])

  return (
    <>
      {partes.map((p, i) =>
        'user' in p ? (
          <span
            key={i}
            title={p.user.name}
            className={`rounded px-0.5 font-extrabold ${
              p.user.id === currentUser?.id ? 'bg-amber-100 text-amber-800' : 'bg-blue-50 text-blue-700'
            }`}
          >
            {p.texto}
          </span>
        ) : (
          <span key={i}>{p.texto}</span>
        ),
      )}
    </>
  )
}

interface MentionFieldProps {
  value: string
  onChange: (v: string) => void
  multiline?: boolean
  rows?: number
  placeholder?: string
  className?: string
  wrapperClassName?: string
  /** Solo en una línea: Enter ejecuta esto (salvo que esté abierta la lista de personas). */
  onEnter?: () => void
  /** Hacia dónde se abre la lista de personas. */
  hacia?: 'abajo' | 'arriba'
}

/**
 * Campo de texto que, al tipear "@", ofrece la lista del equipo para mencionar.
 * Flechas + Enter (o un toque) eligen; Escape cierra. Inserta "@Nombre ".
 */
export function MentionField({
  value,
  onChange,
  multiline,
  rows = 3,
  placeholder,
  className,
  wrapperClassName = 'relative w-full',
  onEnter,
  hacia = 'abajo',
}: MentionFieldProps) {
  const { users, currentUser } = useApp()
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const [consulta, setConsulta] = useState<{ at: number; q: string } | null>(null)
  const [activo, setActivo] = useState(0)

  const sugerencias = useMemo(() => {
    if (!consulta) return []
    const q = normalizar(consulta.q)
    return users
      .filter((u) => {
        const n = normalizar(u.name)
        return !q || n.startsWith(q) || n.split(/\s+/).some((w) => w.startsWith(q))
      })
      .slice(0, 7)
  }, [consulta, users])
  const abierta = !!consulta && sugerencias.length > 0
  const idx = Math.min(activo, sugerencias.length - 1)

  /** Mira si justo antes del cursor hay una "@algo" a medio escribir. */
  const detectar = (texto: string, caret: number) => {
    const antes = texto.slice(0, caret)
    const at = antes.lastIndexOf('@')
    const q = at === -1 ? '' : antes.slice(at + 1)
    if (at === -1 || (at > 0 && !/\s/.test(antes[at - 1])) || q.length > 30 || !/^[\p{L}\p{N} .'-]*$/u.test(q)) {
      setConsulta(null)
      return
    }
    setConsulta({ at, q })
    setActivo(0)
  }

  const elegir = (u: User) => {
    if (!consulta) return
    const el = ref.current
    const caret = el?.selectionStart ?? value.length
    const nuevo = value.slice(0, consulta.at) + '@' + u.name + ' ' + value.slice(caret)
    const pos = consulta.at + u.name.length + 2
    onChange(nuevo)
    setConsulta(null)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(pos, pos)
    })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return
    if (abierta) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const d = e.key === 'ArrowDown' ? 1 : -1
        setActivo((idx + d + sugerencias.length) % sugerencias.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        elegir(sugerencias[idx])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setConsulta(null)
        return
      }
    }
    if (e.key === 'Enter' && !multiline && onEnter) {
      e.preventDefault()
      onEnter()
    }
  }

  const comun = {
    ref,
    value,
    placeholder,
    className,
    onKeyDown,
    onChange: (e: { target: HTMLInputElement | HTMLTextAreaElement }) => {
      onChange(e.target.value)
      detectar(e.target.value, e.target.selectionStart ?? e.target.value.length)
    },
    onSelect: (e: { currentTarget: HTMLInputElement | HTMLTextAreaElement }) =>
      detectar(e.currentTarget.value, e.currentTarget.selectionStart ?? 0),
    // Con demora: en celulares el blur llega antes que el toque en la lista.
    onBlur: () => setTimeout(() => setConsulta(null), 150),
  }

  return (
    <div className={wrapperClassName}>
      {multiline ? <textarea rows={rows} {...comun} /> : <input {...comun} />}
      {abierta && (
        <div
          className={`absolute left-0 z-40 w-full max-w-xs overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl ${
            hacia === 'arriba' ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}
        >
          <p className="px-3 py-1 text-[10px] font-extrabold tracking-wide text-slate-400 uppercase">Mencionar a…</p>
          {sugerencias.map((u, i) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => elegir(u)}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm font-bold transition ${
                i === idx ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Avatar user={u} size={22} />
              <span className="truncate">{u.name}</span>
              {u.id === currentUser?.id && <span className="ml-auto text-[10px] font-extrabold text-slate-400">vos</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
