import { useEffect, useRef, useState, type ReactNode } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Flag,
  Lock,
  MessageCircle,
  Plus,
  Presentation,
  RefreshCw,
  Rocket,
  Scale,
  Send,
  Share2,
  Trash2,
  Users,
} from 'lucide-react'
import type { Kickoff as KickoffRow, KickoffNotas, Minute, Task } from '../types'
import { toKey, uid } from '../lib/utils'
import { calcularBloques, fechaLarga, lunesObjetivo, resumenParaMinuta, semanaDe, type BloquesKickoff } from '../lib/kickoffData'
import { useApp } from '../state/AppContext'
import { Avatar, AvatarStack } from '../components/Avatar'
import KickoffReunion, { type BloqueKickoff } from '../components/KickoffReunion'

/**
 * Kickoff semanal (Módulo C) con datos reales: los cinco bloques se calculan
 * al abrir la pantalla, el modo reunión se proyecta, y al cerrar se genera la
 * minuta con los presentes, el resumen y las acciones acordadas — así el lunes
 * siguiente el bloque 2 existe solo. Detrás de FEATURE_KICKOFF.
 */
export default function Kickoff({
  onEditTask,
  onIrAMinutas,
}: {
  onEditTask: (t: Task) => void
  onIrAMinutas: () => void
}) {
  const {
    isAdmin,
    users,
    tasks,
    hitos,
    projects,
    minutes,
    kickoffs,
    kickoffBriefings,
    upsertKickoff,
    upsertMinute,
    reload,
  } = useApp()
  const objetivo = lunesObjetivo()
  const [fecha, setFecha] = useState(objetivo)
  const [vista, setVista] = useState<'gg' | 'mio'>(isAdmin ? 'gg' : 'mio')
  const [reunion, setReunion] = useState(false)
  const [refrescando, setRefrescando] = useState(false)
  const [nuevaAccion, setNuevaAccion] = useState('')
  const [lineas, setLineas] = useState<Record<string, string>>({})
  const creando = useRef<string | null>(null)

  const kickoff = kickoffs.find((k) => k.fecha === fecha)
  const notas: KickoffNotas = kickoff?.notas ?? {}
  const cerrado = kickoff?.estado === 'cerrado'
  const puedeEditar = isAdmin && !cerrado

  // El lunes que corresponde se prepara solo al abrir la pantalla (sin cron).
  useEffect(() => {
    if (kickoff || fecha !== objetivo || creando.current === fecha) return
    creando.current = fecha
    upsertKickoff({ id: uid(), fecha, estado: 'preparado', notas: {} })
  }, [kickoff, fecha, objetivo, upsertKickoff])

  // Se calcula al vuelo con lo que ya está en la base (sin procesos programados).
  const bloques = kickoff
    ? calcularBloques({
        kickoff,
        kickoffs,
        minutes,
        tasks,
        users,
        hitos,
        briefings: kickoffBriefings,
        colorDeProyecto: (id) => projects.find((p) => p.id === id)?.color ?? '#94A3B8',
      })
    : null

  const guardarNotas = (patch: Partial<KickoffNotas>) => {
    if (!kickoff) return
    upsertKickoff({ ...kickoff, notas: { ...kickoff.notas, ...patch } })
  }

  /** La línea de la semana de cada uno se escribe en vivo y se guarda sola. */
  const escribirLinea = (userId: string, texto: string) => setLineas((l) => ({ ...l, [userId]: texto }))

  useEffect(() => {
    if (!kickoff) return
    const pendientes = Object.entries(lineas).filter(([id, txt]) => (kickoff.notas.bloque3?.[id] ?? '') !== txt)
    if (!pendientes.length) return
    const t = window.setTimeout(
      () =>
        upsertKickoff({
          ...kickoff,
          notas: { ...kickoff.notas, bloque3: { ...(kickoff.notas.bloque3 ?? {}), ...Object.fromEntries(pendientes) } },
        }),
      700,
    )
    return () => window.clearTimeout(t)
  }, [lineas, kickoff, upsertKickoff])
  const lineaDe = (userId: string, delBriefing?: string) =>
    lineas[userId] ?? notas.bloque3?.[userId] ?? delBriefing ?? ''

  const agregarAccion = () => {
    const texto = nuevaAccion.trim()
    if (!texto) return
    guardarNotas({ acciones: [...(notas.acciones ?? []), { id: uid(), texto }] })
    setNuevaAccion('')
  }

  const refrescar = () => {
    setRefrescando(true)
    reload()
    window.setTimeout(() => setRefrescando(false), 800)
  }

  const abrirReunion = () => {
    if (kickoff && kickoff.estado === 'preparado') upsertKickoff({ ...kickoff, estado: 'en_curso' })
    setReunion(true)
  }

  const cerrarKickoff = () => {
    if (!kickoff || !bloques) return
    const acciones = (notas.acciones ?? []).filter((a) => a.texto.trim())
    const aviso = acciones.length
      ? `Se va a generar la minuta con el resumen, los presentes y ${acciones.length} acción${acciones.length === 1 ? '' : 'es'} acordada${acciones.length === 1 ? '' : 's'}.`
      : 'Ojo: no anotaste ninguna acción acordada. El lunes que viene el bloque 2 va a estar vacío.'
    if (!confirm(`¿Cerrar el kickoff?\n\n${aviso}`)) return
    const minuta: Minute = {
      id: uid(),
      title: `Kickoff semanal · ${fechaLarga(kickoff.fecha)}`,
      date: kickoff.fecha,
      participantIds: notas.presentes?.length ? notas.presentes : bloques.semana.map((s) => s.user.id),
      summary: resumenParaMinuta(bloques, notas, users),
      actions: acciones.map((a) => ({ id: a.id, text: a.texto, origen: 'manual' as const })),
      estadoProcesamiento: 'sin_transcripcion',
    }
    upsertMinute(minuta)
    upsertKickoff({ ...kickoff, estado: 'cerrado', minutaId: minuta.id })
    setReunion(false)
  }

  const togglePresente = (userId: string) => {
    const actuales = notas.presentes ?? []
    guardarNotas({
      presentes: actuales.includes(userId) ? actuales.filter((x) => x !== userId) : [...actuales, userId],
    })
  }

  const irA = (dias: number) => {
    setFecha(toKey(addDays(parseISO(fecha), dias)))
    setLineas({})
  }

  if (!kickoff || !bloques) {
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div>
          <Rocket size={34} className="mx-auto text-slate-200" />
          <p className="mt-3 text-lg font-black text-slate-700">Kickoff del {fechaLarga(fecha)}</p>
          <p className="mt-1 text-sm font-semibold text-slate-400">
            {fecha === objetivo
              ? 'Preparándolo…'
              : isAdmin
                ? 'Este lunes todavía no está preparado.'
                : 'Tu Gerente todavía no preparó este lunes. Cuando lo abra vas a poder dejar tus respuestas.'}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button onClick={() => irA(-7)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-extrabold text-slate-500 hover:bg-slate-50">
              ← Lunes anterior
            </button>
            <button onClick={() => irA(7)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-extrabold text-slate-500 hover:bg-slate-50">
              Lunes siguiente →
            </button>
            {isAdmin && fecha !== objetivo && (
              <button
                onClick={() => upsertKickoff({ id: uid(), fecha, estado: 'preparado', notas: {} })}
                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-blue-700"
              >
                Preparar este lunes
              </button>
            )}
            {fecha !== objetivo && (
              <button onClick={() => setFecha(objetivo)} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-extrabold text-blue-700 hover:bg-blue-100">
                Ir al lunes que corresponde
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const bloquesUI = construirBloques({
    bloques,
    puedeEditar,
    lineaDe,
    escribirLinea,
    onEditTask,
    kickoffId: kickoff.id,
  })

  const estadoChip =
    kickoff.estado === 'cerrado'
      ? { texto: 'Cerrado', clase: 'bg-emerald-100 text-emerald-700' }
      : kickoff.estado === 'en_curso'
        ? { texto: 'En curso', clase: 'bg-amber-100 text-amber-700' }
        : { texto: 'Preparado', clase: 'bg-blue-100 text-blue-700' }

  const pieReunion = puedeEditar ? (
    <div className="mx-auto flex max-w-3xl items-center gap-2">
      <input
        value={nuevaAccion}
        onChange={(e) => setNuevaAccion(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && agregarAccion()}
        placeholder="Acción acordada (empezá con un verbo: Enviar, Definir, Confirmar…)"
        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-300 focus:border-blue-400"
      />
      <button
        onClick={agregarAccion}
        disabled={!nuevaAccion.trim()}
        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2.5 text-sm font-extrabold text-white hover:bg-blue-700 disabled:opacity-40"
      >
        <Plus size={15} /> Acordado
      </button>
      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-extrabold text-slate-500">
        {(notas.acciones ?? []).length}
      </span>
    </div>
  ) : undefined

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-5">
        {/* Encabezado */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-black text-slate-800">
              <Rocket size={22} className="text-blue-600" /> Kickoff semanal
            </h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-400">
              <button onClick={() => irA(-7)} title="Lunes anterior" className="rounded-lg p-1 hover:bg-slate-100">
                <ChevronLeft size={15} />
              </button>
              <span className="capitalize">{fechaLarga(fecha)}</span>
              <button onClick={() => irA(7)} title="Lunes siguiente" className="rounded-lg p-1 hover:bg-slate-100">
                <ChevronRight size={15} />
              </button>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase ${estadoChip.clase}`}>
                {estadoChip.texto}
              </span>
              {fecha !== objetivo && (
                <button onClick={() => setFecha(objetivo)} className="text-[11px] font-extrabold text-blue-600 hover:text-blue-700">
                  ir al lunes que corresponde
                </button>
              )}
            </p>
          </div>
          {isAdmin && vista === 'gg' && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={refrescar}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-blue-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
              >
                <RefreshCw size={13} className={refrescando ? 'animate-spin' : ''} /> Actualizar
              </button>
              <button
                onClick={abrirReunion}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-blue-700"
              >
                <Presentation size={14} /> Modo reunión
              </button>
              {cerrado ? (
                <button
                  onClick={onIrAMinutas}
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-extrabold text-emerald-700 hover:bg-emerald-100"
                >
                  <ClipboardList size={14} /> Ver la minuta
                </button>
              ) : (
                <button
                  onClick={cerrarKickoff}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-600 hover:bg-slate-50"
                >
                  <CheckCircle2 size={14} /> Cerrar kickoff
                </button>
              )}
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="grid w-fit grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
            <button
              onClick={() => setVista('gg')}
              className={`rounded-md px-3 py-1.5 text-xs font-extrabold transition ${
                vista === 'gg' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Mi vista (los 5 bloques)
            </button>
            <button
              onClick={() => setVista('mio')}
              className={`rounded-md px-3 py-1.5 text-xs font-extrabold transition ${
                vista === 'mio' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Mi briefing
            </button>
          </div>
        )}

        {vista === 'gg' ? (
          <div className="space-y-4">
            {/* Presentes */}
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-wide text-slate-400 uppercase">
                <Users size={12} /> Presentes {notas.presentes?.length ? `· ${notas.presentes.length}` : ''}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {users.map((u) => {
                  const activo = (notas.presentes ?? []).includes(u.id)
                  return (
                    <button
                      key={u.id}
                      type="button"
                      disabled={!puedeEditar}
                      onClick={() => togglePresente(u.id)}
                      title={u.name}
                      className={`rounded-full transition disabled:cursor-not-allowed ${
                        activo ? 'ring-2 ring-blue-400 ring-offset-1' : 'opacity-35 hover:opacity-70'
                      }`}
                    >
                      <Avatar user={u} size={28} />
                    </button>
                  )
                })}
              </div>
            </section>

            {bloquesUI.map((b) => (
              <section key={b.numero} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 font-extrabold text-slate-700">
                    <span className="grid size-6 place-items-center rounded-lg bg-blue-50 text-xs font-black text-blue-600">
                      {b.numero}
                    </span>
                    {b.titulo}
                  </h3>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-400">
                    ≈ {b.minutos} min
                  </span>
                </div>
                {b.contenido}
              </section>
            ))}

            {/* Acciones acordadas hoy */}
            <section className="rounded-xl border-2 border-blue-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-extrabold tracking-wide text-slate-400 uppercase">Acciones acordadas hoy</p>
              <p className="mb-3 text-[11px] font-semibold text-slate-400">
                Al cerrar el kickoff pasan a la minuta, y el lunes que viene aparecen en el bloque 2 si no se cumplieron.
              </p>
              <div className="space-y-1.5">
                {(notas.acciones ?? []).map((a) => (
                  <div key={a.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                    <span className="size-1.5 shrink-0 rounded-full bg-blue-400" />
                    <span className="min-w-0 flex-1 text-sm font-semibold text-slate-700">{a.texto}</span>
                    {puedeEditar && (
                      <button
                        onClick={() => guardarNotas({ acciones: (notas.acciones ?? []).filter((x) => x.id !== a.id) })}
                        className="shrink-0 rounded-lg p-1 text-slate-300 hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
                {!(notas.acciones ?? []).length && (
                  <p className="py-3 text-center text-sm font-semibold text-slate-300">
                    Todavía no anotaste ninguna acción acordada.
                  </p>
                )}
              </div>
              {puedeEditar && (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    value={nuevaAccion}
                    onChange={(e) => setNuevaAccion(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && agregarAccion()}
                    placeholder="Acción acordada (empezá con un verbo: Enviar, Definir, Confirmar…)"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-300 focus:border-blue-400"
                  />
                  <button
                    onClick={agregarAccion}
                    disabled={!nuevaAccion.trim()}
                    className="flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-blue-700 disabled:opacity-40"
                  >
                    <Plus size={14} /> Agregar
                  </button>
                </div>
              )}
            </section>

            {cerrado && (
              <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-[11px] font-extrabold text-emerald-700">
                <Lock size={13} /> Este kickoff está cerrado y su minuta ya está generada. Queda como registro.
              </p>
            )}
          </div>
        ) : (
          <BriefingPersonal kickoff={kickoff} bloques={bloques} onEditTask={onEditTask} />
        )}
      </div>

      {reunion && <KickoffReunion bloques={bloquesUI} pie={pieReunion} onClose={() => setReunion(false)} />}
    </div>
  )
}

/* ---------- Los cinco bloques, con los datos reales ---------- */

function construirBloques({
  bloques,
  puedeEditar,
  lineaDe,
  escribirLinea,
  onEditTask,
  kickoffId,
}: {
  bloques: BloquesKickoff
  puedeEditar: boolean
  lineaDe: (userId: string, delBriefing?: string) => string
  escribirLinea: (userId: string, texto: string) => void
  onEditTask: (t: Task) => void
  kickoffId: string
}): BloqueKickoff[] {
  return [
    {
      numero: 1,
      titulo: 'Lo que se cerró la semana pasada',
      minutos: 2,
      contenido: bloques.cerradas.length ? (
        <div className="space-y-3">
          {bloques.cerradas.map(({ user, tareas }) => (
            <div key={user.id}>
              <p className="mb-1 flex items-center gap-2 text-xs font-extrabold text-slate-500">
                <Avatar user={user} size={22} /> {user.name} · {tareas.length}
              </p>
              {tareas.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onEditTask(t)}
                  className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <CheckCircle2 size={15} className="shrink-0 fill-emerald-100 text-emerald-500" />
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <p className="py-3 text-center text-sm font-semibold text-slate-300">
          No hay tareas completadas registradas en la semana.
          <span className="mt-1 block text-[11px]">
            Se cuentan desde que marcan las tareas como completadas en la plataforma.
          </span>
        </p>
      ),
    },
    {
      numero: 2,
      titulo: 'Lo que se comprometió y no se cumplió',
      minutos: 5,
      contenido: bloques.incumplidos.length ? (
        <div className="space-y-1">
          {bloques.incumplidos.map((i) => (
            <div key={i.id} className="flex items-center gap-2.5 border-b border-slate-50 py-2 last:border-0">
              <AvatarStack users={i.responsables} size={22} />
              <span className="min-w-0 flex-1">
                {i.task ? (
                  <button onClick={() => onEditTask(i.task!)} className="block w-full truncate text-left text-sm font-bold text-slate-700 hover:text-blue-700">
                    {i.texto}
                  </button>
                ) : (
                  <span className="block truncate text-sm font-bold text-slate-700">{i.texto}</span>
                )}
                {!i.convertida && (
                  <span className="text-[10px] font-extrabold tracking-wide text-amber-600 uppercase">
                    nunca se convirtió en tarea
                  </span>
                )}
              </span>
              <span className="shrink-0 rounded bg-[#e5484d] px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                {i.dias} día{i.dias === 1 ? '' : 's'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-3 text-center text-sm font-semibold text-slate-300">
          {bloques.anterior
            ? 'Se cumplió todo lo acordado en el kickoff anterior. 🎉'
            : 'Todavía no hay un kickoff anterior cerrado: este bloque se llena solo a partir del próximo lunes.'}
        </p>
      ),
    },
    {
      numero: 3,
      titulo: 'La semana de cada uno',
      minutos: 12,
      contenido: (
        <div className="space-y-3">
          {bloques.semana.map(({ user, briefing, tareas }) => (
            <div key={user.id} className="flex items-start gap-2.5">
              <Avatar user={user} size={26} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-xs font-extrabold text-slate-500">
                  {user.name}
                  {briefing?.completadoAt ? (
                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-700">
                      briefing ✓
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-extrabold text-slate-400">
                      sin briefing
                    </span>
                  )}
                  <span className="font-semibold text-slate-400">
                    {tareas.length} tarea{tareas.length === 1 ? '' : 's'} esta semana
                  </span>
                </p>
                {puedeEditar ? (
                  <input
                    value={lineaDe(user.id, briefing?.enQueTrabajo)}
                    onChange={(e) => escribirLinea(user.id, e.target.value)}
                    placeholder="¿En qué trabaja esta semana? (se escribe acá en la reunión)"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-300 focus:border-blue-400"
                  />
                ) : (
                  <p className="mt-1 rounded-lg bg-slate-50 px-2.5 py-1.5 text-sm font-semibold text-slate-600">
                    {lineaDe(user.id, briefing?.enQueTrabajo) || '—'}
                  </p>
                )}
                {briefing?.necesitoAlgo?.trim() && (
                  <p className="mt-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800">
                    Necesita: {briefing.necesitoAlgo}
                  </p>
                )}
                <AnotacionesCompartidas kickoffId={kickoffId} usuarioId={user.id} />
              </div>
            </div>
          ))}
          {!bloques.semana.length && (
            <p className="py-3 text-center text-sm font-semibold text-slate-300">
              Nadie tiene tareas con fecha esta semana. Marcá a los presentes arriba para escribir su línea igual.
            </p>
          )}
        </div>
      ),
    },
    {
      numero: 4,
      titulo: 'Fechas que se vienen · próximos 14 días',
      minutos: 3,
      contenido: bloques.fechas.length ? (
        <div className="space-y-1">
          {bloques.fechas.map((f) => (
            <div key={f.id} className="flex items-center gap-2.5 border-b border-slate-50 py-2 last:border-0">
              <Flag size={14} style={{ color: f.color }} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-700">{f.titulo}</span>
              <span className="shrink-0 text-xs font-extrabold text-slate-500 capitalize">
                {format(parseISO(f.fecha), 'EEE d MMM', { locale: es })}
                {f.hora ? ` · ${f.hora}` : ''}
              </span>
              <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-extrabold text-slate-400 uppercase">
                {f.tipo}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-3 text-center text-sm font-semibold text-slate-300">
          No hay hitos ni actividades con horario en los próximos 14 días.
        </p>
      ),
    },
    {
      numero: 5,
      titulo: 'Decisiones que me necesitan',
      minutos: 6,
      contenido: bloques.decisiones.length ? (
        <div className="space-y-1">
          {bloques.decisiones.map((t) => (
            <button
              key={t.id}
              onClick={() => onEditTask(t)}
              className="flex w-full items-center gap-2.5 border-b border-slate-50 py-2 text-left last:border-0 hover:bg-slate-50"
            >
              <Scale size={14} className="shrink-0 text-blue-600" />
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-700">{t.title}</span>
              {t.necesitaDecisionDesde && (
                <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-700">
                  espera desde el {format(parseISO(t.necesitaDecisionDesde.slice(0, 10)), 'd MMM', { locale: es })}
                </span>
              )}
            </button>
          ))}
        </div>
      ) : (
        <p className="py-3 text-center text-sm font-semibold text-slate-300">
          Nada esperando tu decisión.
          <span className="mt-1 block text-[11px]">Se marcan desde la tarea: «¿Necesita una decisión del Gerente?».</span>
        </p>
      ),
    },
  ]
}

/** Las anotaciones que su dueño decidió compartir (las privadas no llegan ni acá). */
function AnotacionesCompartidas({ kickoffId, usuarioId }: { kickoffId: string; usuarioId: string }) {
  const { kickoffAnotaciones, currentUser } = useApp()
  const compartidas = kickoffAnotaciones.filter(
    (a) => a.kickoffId === kickoffId && a.usuarioId === usuarioId && a.visibilidad === 'compartida' && a.usuarioId !== currentUser?.id,
  )
  if (!compartidas.length) return null
  return (
    <div className="mt-1.5 space-y-1">
      {compartidas.map((a) => (
        <p key={a.id} className="rounded-lg border border-blue-100 bg-blue-50/60 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600">
          <MessageCircle size={11} className="mr-1 inline text-blue-500" />
          {a.textoResaltado && <span className="font-extrabold text-slate-500">{a.textoResaltado}: </span>}
          {a.comentario}
        </p>
      ))}
    </div>
  )
}

/* ---------- Briefing personal (lo que ve cada uno, desde el viernes) ---------- */

function BriefingPersonal({
  kickoff,
  bloques,
  onEditTask,
}: {
  kickoff: KickoffRow
  bloques: BloquesKickoff
  onEditTask: (t: Task) => void
}) {
  const {
    currentUser,
    kickoffBriefings,
    kickoffAnotaciones,
    upsertKickoffBriefing,
    upsertKickoffAnotacion,
    removeKickoffAnotacion,
  } = useApp()
  const me = currentUser!
  const mio = kickoffBriefings.find((b) => b.kickoffId === kickoff.id && b.usuarioId === me.id)
  const [q1, setQ1] = useState(mio?.enQueTrabajo ?? '')
  const [q2, setQ2] = useState(mio?.necesitoAlgo ?? '')
  const [guardado, setGuardado] = useState(false)
  const [nota, setNota] = useState('')

  const misCerradas = bloques.cerradas.find((c) => c.user.id === me.id)?.tareas ?? []
  const misIncumplidos = bloques.incumplidos.filter((i) => i.responsables.some((u) => u.id === me.id))
  const miSemana = bloques.semana.find((s) => s.user.id === me.id)
  const misFechas = bloques.fechas.filter((f) => f.involucra.includes(me.id))
  const misAnotaciones = kickoffAnotaciones.filter((a) => a.kickoffId === kickoff.id && a.usuarioId === me.id)
  const { desde, hasta } = semanaDe(kickoff.fecha)

  const guardar = () => {
    upsertKickoffBriefing({
      id: mio?.id ?? uid(),
      kickoffId: kickoff.id,
      usuarioId: me.id,
      enQueTrabajo: q1.trim(),
      necesitoAlgo: q2.trim(),
      completadoAt: q1.trim() || q2.trim() ? new Date().toISOString() : null,
    })
    setGuardado(true)
    window.setTimeout(() => setGuardado(false), 2500)
  }

  const anotar = (bloque: string, comentario: string, referencia?: { id: string; titulo: string }) =>
    upsertKickoffAnotacion({
      id: uid(),
      kickoffId: kickoff.id,
      usuarioId: me.id,
      bloque,
      referenciaId: referencia?.id ?? null,
      textoResaltado: referencia?.titulo ?? null,
      comentario,
      visibilidad: 'privada',
      createdAt: new Date().toISOString(),
    })

  const agregarNota = () => {
    const texto = nota.trim()
    if (!texto) return
    anotar('general', texto)
    setNota('')
  }

  return (
    <div className="space-y-4">
      <p className="text-[11px] font-semibold text-slate-400">
        Tu briefing del kickoff del {fechaLarga(kickoff.fecha)}. Nadie ve el briefing de otro.
      </p>

      <Tarjeta titulo={`Cerraste ${misCerradas.length} tarea${misCerradas.length === 1 ? '' : 's'} la semana pasada`}>
        {misCerradas.length ? (
          misCerradas.map((t) => (
            <FilaAnotable
              key={t.id}
              titulo={t.title}
              icono={<CheckCircle2 size={15} className="shrink-0 fill-emerald-100 text-emerald-500" />}
              onAbrir={() => onEditTask(t)}
              onAnotar={(c) => anotar('cerradas', c, { id: t.id, titulo: t.title })}
            />
          ))
        ) : (
          <p className="py-2 text-sm font-semibold text-slate-300">Nada registrado como completado.</p>
        )}
      </Tarjeta>

      <Tarjeta titulo="Te comprometiste y quedó pendiente">
        {misIncumplidos.length ? (
          misIncumplidos.map((i) => (
            <div key={i.id} className="flex items-center gap-2 py-1">
              <span className="min-w-0 flex-1 text-sm font-bold text-slate-700">{i.texto}</span>
              <span className="shrink-0 rounded bg-[#e5484d] px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                {i.dias} día{i.dias === 1 ? '' : 's'}
              </span>
            </div>
          ))
        ) : (
          <p className="py-2 text-sm font-semibold text-slate-300">Nada pendiente del kickoff anterior. 🎉</p>
        )}
      </Tarjeta>

      <Tarjeta titulo={`Tu semana · ${format(parseISO(desde), 'd MMM', { locale: es })} al ${format(parseISO(hasta), 'd MMM', { locale: es })}`}>
        {miSemana?.tareas.length ? (
          miSemana.tareas.map((t) => (
            <FilaAnotable
              key={t.id}
              titulo={`${t.title}${t.date ? ` · ${format(parseISO(t.date), 'EEE d', { locale: es })}` : ''}`}
              onAbrir={() => onEditTask(t)}
              onAnotar={(c) => anotar('semana', c, { id: t.id, titulo: t.title })}
            />
          ))
        ) : (
          <p className="py-2 text-sm font-semibold text-slate-300">No tenés tareas con fecha esta semana.</p>
        )}
      </Tarjeta>

      {misFechas.length > 0 && (
        <Tarjeta titulo="Fechas que te involucran">
          {misFechas.map((f) => (
            <p key={f.id} className="flex items-center gap-2 py-1 text-sm font-semibold text-slate-600">
              <Flag size={13} style={{ color: f.color }} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate">{f.titulo}</span>
              <span className="shrink-0 text-xs font-extrabold text-slate-500 capitalize">
                {format(parseISO(f.fecha), 'EEE d MMM', { locale: es })}
                {f.hora ? ` · ${f.hora}` : ''}
              </span>
            </p>
          ))}
        </Tarjeta>
      )}

      <section className="rounded-xl border-2 border-blue-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-extrabold text-slate-700">Dos preguntas antes del lunes</h3>
        <p className="mb-3 text-[11px] font-semibold text-slate-400">
          Tus respuestas precargan tu línea del bloque 3: el lunes se confirma en dos minutos en vez de improvisarse.
        </p>
        <label className="mb-1 block text-[11px] font-extrabold tracking-wide text-slate-400 uppercase">
          ¿En qué vas a trabajar esta semana?
        </label>
        <textarea
          rows={2}
          value={q1}
          onChange={(e) => setQ1(e.target.value)}
          placeholder="Una o dos líneas…"
          className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-300 focus:border-blue-300"
        />
        <label className="mt-3 mb-1 block text-[11px] font-extrabold tracking-wide text-slate-400 uppercase">
          ¿Necesitás algo de alguien para poder avanzar?
        </label>
        <textarea
          rows={2}
          value={q2}
          onChange={(e) => setQ2(e.target.value)}
          placeholder="Nombralo acá y se habla el lunes…"
          className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-300 focus:border-blue-300"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={guardar}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-700"
          >
            Guardar mis respuestas
          </button>
          {guardado && <span className="text-xs font-extrabold text-emerald-600">Guardado ✓</span>}
          {!guardado && mio?.completadoAt && (
            <span className="text-xs font-semibold text-slate-400">
              Ya lo completaste. El Gerente ve estas dos respuestas (nada más).
            </span>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-slate-700">
          <MessageCircle size={14} className="text-blue-600" /> Tus anotaciones
        </h3>
        <p className="mb-2 text-[11px] font-semibold text-slate-400">
          Privadas de verdad: ni el Gerente las ve, salvo que toques «Compartir en la reunión».
        </p>
        <div className="space-y-1.5">
          {misAnotaciones.map((a) => (
            <div key={a.id} className="rounded-lg bg-slate-50 px-3 py-2">
              {a.textoResaltado && (
                <p className="text-[10px] font-extrabold tracking-wide text-slate-400 uppercase">{a.textoResaltado}</p>
              )}
              <p className="text-sm font-semibold text-slate-600">{a.comentario}</p>
              <div className="mt-1.5 flex items-center gap-2">
                {a.visibilidad === 'privada' ? (
                  <>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-extrabold text-slate-500">
                      🔒 Solo la ves vos
                    </span>
                    <button
                      onClick={() => upsertKickoffAnotacion({ ...a, visibilidad: 'compartida' })}
                      className="flex items-center gap-1 text-[10px] font-extrabold text-blue-600 hover:text-blue-700"
                    >
                      <Share2 size={11} /> Compartir en la reunión
                    </button>
                  </>
                ) : (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-extrabold text-blue-700">
                    Compartida con el equipo
                  </span>
                )}
                <button
                  onClick={() => removeKickoffAnotacion(a.id)}
                  className="ml-auto rounded-lg p-1 text-slate-300 hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
          {!misAnotaciones.length && (
            <p className="py-2 text-sm font-semibold text-slate-300">
              Todavía no anotaste nada. Podés comentar una línea de arriba con 💬 o dejar una nota suelta acá.
            </p>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && agregarNota()}
            placeholder="Nota para vos, para el lunes…"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-300 focus:border-blue-400"
          />
          <button
            onClick={agregarNota}
            disabled={!nota.trim()}
            title="Guardar la nota"
            className="shrink-0 rounded-lg bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:opacity-40"
          >
            <Send size={15} />
          </button>
        </div>
      </section>
    </div>
  )
}

function Tarjeta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-extrabold text-slate-700">{titulo}</h3>
      {children}
    </section>
  )
}

/** Una línea del briefing que se puede abrir y comentar (la anotación nace privada). */
function FilaAnotable({
  titulo,
  icono,
  onAbrir,
  onAnotar,
}: {
  titulo: string
  icono?: ReactNode
  onAbrir: () => void
  onAnotar: (comentario: string) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')

  const guardar = () => {
    const c = texto.trim()
    if (!c) return
    onAnotar(c)
    setTexto('')
    setAbierto(false)
  }

  return (
    <div className="border-b border-slate-50 py-1 last:border-0">
      <div className="flex items-center gap-2">
        {icono}
        <button onClick={onAbrir} className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-slate-600 hover:text-blue-700">
          {titulo}
        </button>
        <button
          onClick={() => setAbierto((o) => !o)}
          title="Anotar algo sobre esta línea (privado)"
          className={`shrink-0 rounded-lg p-1 transition ${abierto ? 'bg-blue-50 text-blue-600' : 'text-slate-300 hover:bg-slate-100 hover:text-slate-500'}`}
        >
          <MessageCircle size={14} />
        </button>
      </div>
      {abierto && (
        <div className="mt-1 flex items-center gap-2 pb-1">
          <input
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && guardar()}
            placeholder="Tu anotación (privada)…"
            className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 outline-none placeholder:text-slate-300 focus:border-blue-400"
          />
          <button
            onClick={guardar}
            disabled={!texto.trim()}
            className="shrink-0 rounded-lg bg-blue-600 p-1.5 text-white hover:bg-blue-700 disabled:opacity-40"
          >
            <Send size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
