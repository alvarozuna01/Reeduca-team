import { useMemo, useState } from 'react'
import { addDays, differenceInCalendarDays, format, formatDistanceToNow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { CheckCircle2, ClipboardList, Clock, LayoutDashboard, MessageCircle, RefreshCw, Scale } from 'lucide-react'
import type { Task } from '../types'
import { isOverdue, longDate, toKey, todayKey, weekDays } from '../lib/utils'
import { useApp } from '../state/AppContext'
import { Avatar, AvatarStack } from '../components/Avatar'
import { MiembrosEquipo } from './Equipo'

/**
 * Panel PM del Gerente (Dirección A del mockup aprobado): centro de mando
 * con KPIs, salud por proyecto, cola de decisiones, radar de atrasos,
 * carga del equipo, hitos en el horizonte y actividad reciente.
 * Solo Gerentes con FEATURE_PANEL. El equipo no ve nada de esto.
 */
export default function Panel({ onEditTask }: { onEditTask: (t: Task) => void }) {
  const { tasks, projects, users, hitos, minutes, taskComments, reload } = useApp()
  const [refreshing, setRefreshing] = useState(false)

  const hoy = todayKey()
  const semana = useMemo(() => weekDays(new Date()).map(toKey), [])
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])

  const activas = useMemo(() => tasks.filter((t) => t.status !== 'done'), [tasks])
  const atrasadas = useMemo(() => tasks.filter(isOverdue), [tasks])
  const completadasSemana = useMemo(
    () => tasks.filter((t) => t.completedAt && t.completedAt.slice(0, 10) >= semana[0] && t.completedAt.slice(0, 10) <= semana[6]),
    [tasks, semana],
  )
  const decisiones = useMemo(
    () =>
      tasks
        .filter((t) => t.necesitaDecisionGg && t.status !== 'done')
        .sort((a, b) => (a.necesitaDecisionDesde ?? '9999').localeCompare(b.necesitaDecisionDesde ?? '9999')),
    [tasks],
  )
  const comentariosSemana = useMemo(() => {
    const corte = toKey(addDays(parseISO(hoy), -7))
    return taskComments.filter((c) => c.createdAt.slice(0, 10) > corte)
  }, [taskComments, hoy])

  const salud = useMemo(
    () =>
      projects.map((p) => {
        const list = tasks.filter((t) => t.projectId === p.id)
        const done = list.filter((t) => t.status === 'done').length
        const atras = list.filter(isOverdue).length
        const proximoHito = hitos
          .filter((h) => h.projectId === p.id && h.date && h.date >= hoy)
          .sort((a, b) => a.date!.localeCompare(b.date!))[0]
        // Semáforo simple y honesto: rojo con 3+ atrasadas, ámbar con 1-2, verde al día.
        const semaforo = atras >= 3 ? '#e5484d' : atras >= 1 ? '#f59e0b' : '#34C48E'
        return { p, total: list.length, done, atras, proximoHito, semaforo }
      }),
    [projects, tasks, hitos, hoy],
  )

  const radar = useMemo(
    () => [...atrasadas].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')).slice(0, 6),
    [atrasadas],
  )

  const carga = useMemo(
    () =>
      users
        .map((u) => {
          const mias = tasks.filter((t) => t.assigneeIds.includes(u.id))
          const enSemana = mias.filter((t) => t.date && t.date >= semana[0] && t.date <= semana[6])
          return {
            u,
            total: enSemana.length,
            done: enSemana.filter((t) => t.status === 'done').length,
            doing: enSemana.filter((t) => t.status === 'doing').length,
            todo: enSemana.filter((t) => t.status === 'todo').length,
            atras: mias.filter(isOverdue).length,
          }
        })
        .filter((c) => c.total > 0 || c.atras > 0)
        .sort((a, b) => b.total - a.total),
    [users, tasks, semana],
  )
  const maxCarga = Math.max(1, ...carga.map((c) => c.total))

  const HORIZONTE = 45
  const hitosHorizonte = useMemo(
    () =>
      hitos
        .filter((h) => h.date && h.date >= hoy && differenceInCalendarDays(parseISO(h.date), parseISO(hoy)) <= HORIZONTE)
        .sort((a, b) => a.date!.localeCompare(b.date!))
        .slice(0, 8)
        .map((h) => ({
          h,
          // Clamp para que la etiqueta (120px centrada) no se recorte en los bordes.
          pos: Math.min(94, Math.max(6, (differenceInCalendarDays(parseISO(h.date!), parseISO(hoy)) / HORIZONTE) * 100)),
          color: projectById.get(h.projectId)?.color ?? '#94A3B8',
        })),
    [hitos, hoy, projectById],
  )

  const actividad = useMemo(() => {
    const eventos: { when: string; tipo: 'comentario' | 'completada' | 'minuta'; quien: string; que: string; extra?: string }[] = []
    for (const c of taskComments) {
      const t = tasks.find((x) => x.id === c.taskId)
      if (!t) continue
      const resumen = c.text.length > 60 ? `${c.text.slice(0, 60)}…` : c.text
      eventos.push({ when: c.createdAt, tipo: 'comentario', quien: userById.get(c.userId)?.name ?? 'Alguien', que: t.title, extra: resumen })
    }
    for (const t of tasks) {
      if (!t.completedAt) continue
      const quien = t.assigneeIds.map((id) => userById.get(id)?.name).filter(Boolean)[0] ?? 'Alguien'
      eventos.push({ when: t.completedAt, tipo: 'completada', quien, que: t.title })
    }
    for (const m of minutes) {
      eventos.push({ when: `${m.date}T12:00:00`, tipo: 'minuta', quien: userById.get(m.participantIds[0] ?? '')?.name ?? 'El equipo', que: m.title })
    }
    return eventos.sort((a, b) => b.when.localeCompare(a.when)).slice(0, 8)
  }, [taskComments, tasks, minutes, userById])

  const refresh = () => {
    setRefreshing(true)
    reload()
    setTimeout(() => setRefreshing(false), 800)
  }

  const diasEsperando = (t: Task) => {
    if (!t.necesitaDecisionDesde) return null
    return Math.max(0, differenceInCalendarDays(parseISO(hoy), parseISO(t.necesitaDecisionDesde)))
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-5">
        {/* Encabezado */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-black text-slate-800">
              <LayoutDashboard size={22} className="text-blue-600" /> Centro de mando
            </h2>
            <p className="mt-0.5 text-sm font-semibold text-slate-400 capitalize">
              {longDate(new Date())} · todo el equipo, todos los proyectos
            </p>
          </div>
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-blue-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Actualizar
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <KpiTile valor={activas.length} label="Tareas activas" />
          <KpiTile valor={completadasSemana.length} label="Completadas esta semana" accent="#34C48E" />
          <KpiTile valor={atrasadas.length} label="Atrasadas" accent="#e5484d" />
          <KpiTile valor={decisiones.length} label="Decisiones que me necesitan" accent="#0e4afb" destacado />
          <KpiTile valor={comentariosSemana.length} label="Comentarios · 7 días" accent="#5AB6E8" />
        </div>

        {/* Fila 1: salud por proyecto + decisiones */}
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-700">Salud por proyecto</h3>
              <span className="text-[11px] font-bold text-slate-400">avance · atrasadas · próximo hito</span>
            </div>
            <div className="space-y-3.5">
              {salud.map(({ p, total, done, atras, proximoHito, semaforo }) => (
                <div key={p.id} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-slate-600">
                    <i className="size-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
                    <span className="truncate">{p.name}</span>
                  </span>
                  <span className="block h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <i
                      className="block h-full rounded-full"
                      style={{ width: total ? `${(done / total) * 100}%` : 0, background: p.color }}
                    />
                  </span>
                  <span className="flex items-center gap-2 text-[11px] font-bold whitespace-nowrap text-slate-400">
                    <span>{total ? Math.round((done / total) * 100) : 0}%</span>
                    {atras > 0 ? (
                      <span className="font-extrabold text-[#e5484d]">
                        {atras} atrasada{atras === 1 ? '' : 's'}
                      </span>
                    ) : (
                      <span className="font-extrabold text-emerald-500">al día</span>
                    )}
                    {proximoHito && (
                      <span className="hidden sm:inline">
                        · {proximoHito.name} · <b className="text-slate-600">{format(parseISO(proximoHito.date!), 'd MMM', { locale: es })}</b>
                      </span>
                    )}
                    <i className="size-3 shrink-0 rounded-full" style={{ background: semaforo }} title="Semáforo: rojo 3+ atrasadas, ámbar 1-2, verde al día" />
                  </span>
                </div>
              ))}
              {salud.length === 0 && (
                <p className="py-4 text-center text-sm font-semibold text-slate-300">Todavía no hay proyectos.</p>
              )}
            </div>
            <p className="mt-3 border-t border-slate-100 pt-2 text-[10px] font-bold text-slate-400">
              Avance = completadas / totales · Semáforo: 🔴 3+ atrasadas · 🟡 1–2 · 🟢 al día
            </p>
          </section>

          <section className="rounded-xl border-2 border-blue-300 bg-white p-4 shadow-sm">
            <div className="mb-1 flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-blue-50">
                <Scale size={15} className="text-blue-600" />
              </span>
              <div>
                <h3 className="leading-tight font-extrabold text-slate-700">Decisiones que me necesitan</h3>
                <p className="text-[11px] font-semibold text-slate-400">Lo que el equipo marcó esperando tu palabra</p>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {decisiones.length === 0 && (
                <p className="py-5 text-center text-sm font-semibold text-slate-300">
                  Nada esperando tu decisión. 🎉
                  <span className="mt-1 block text-[11px]">
                    Se marcan desde la tarea: «¿Necesita una decisión del Gerente?»
                  </span>
                </p>
              )}
              {decisiones.map((t) => {
                const dias = diasEsperando(t)
                const p = projectById.get(t.projectId)
                return (
                  <button
                    key={t.id}
                    onClick={() => onEditTask(t)}
                    className="flex w-full items-center gap-2.5 px-1 py-2.5 text-left transition hover:bg-slate-50"
                  >
                    <AvatarStack users={users.filter((u) => t.assigneeIds.includes(u.id))} size={20} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-extrabold text-slate-700">{t.title}</span>
                      <span className="text-[11px] font-semibold text-slate-400">{p?.name}</span>
                    </span>
                    {dias !== null && (
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-extrabold ${
                          dias >= 4 ? 'bg-red-50 text-[#e5484d]' : dias >= 2 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {dias === 0 ? 'hoy' : `hace ${dias} día${dias === 1 ? '' : 's'}`}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        </div>

        {/* Fila 2: radar de atrasos + carga del equipo */}
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-red-50">
                <Clock size={15} className="text-[#e5484d]" />
              </span>
              <div>
                <h3 className="leading-tight font-extrabold text-slate-700">Radar de atrasos</h3>
                <p className="text-[11px] font-semibold text-slate-400">Las que más días llevan vencidas, de todo el equipo</p>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {radar.length === 0 && (
                <p className="py-5 text-center text-sm font-semibold text-slate-300">Sin tareas atrasadas. 🎉</p>
              )}
              {radar.map((t) => {
                const dias = differenceInCalendarDays(parseISO(hoy), parseISO(t.date!))
                const p = projectById.get(t.projectId)
                return (
                  <button
                    key={t.id}
                    onClick={() => onEditTask(t)}
                    className="flex w-full items-center gap-2.5 px-1 py-2 text-left transition hover:bg-slate-50"
                  >
                    <i className="size-2 shrink-0 rounded-full" style={{ background: p?.color ?? '#94A3B8' }} />
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-700">{t.title}</span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-extrabold ${
                        dias >= 5 ? 'bg-[#e5484d] text-white' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {dias} día{dias === 1 ? '' : 's'}
                    </span>
                    <AvatarStack users={users.filter((u) => t.assigneeIds.includes(u.id))} size={18} />
                  </button>
                )
              })}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-extrabold text-slate-700">Carga del equipo · esta semana</h3>
              <span className="flex items-center gap-2.5 text-[9px] font-extrabold text-slate-400">
                <span className="flex items-center gap-1"><i className="size-2 rounded-full" style={{ background: '#34C48E' }} />Completado</span>
                <span className="flex items-center gap-1"><i className="size-2 rounded-full" style={{ background: '#5AB6E8' }} />En progreso</span>
                <span className="flex items-center gap-1"><i className="size-2 rounded-full" style={{ background: '#CBD5E1' }} />Por hacer</span>
              </span>
            </div>
            <div className="space-y-3">
              {carga.length === 0 && (
                <p className="py-5 text-center text-sm font-semibold text-slate-300">Sin tareas agendadas esta semana.</p>
              )}
              {carga.map(({ u, total, done, doing, todo, atras }) => (
                <div key={u.id} className="flex items-center gap-3">
                  <span className="flex w-28 shrink-0 items-center gap-2">
                    <Avatar user={u} size={24} />
                    <span className="truncate text-sm font-bold text-slate-600">{u.name}</span>
                  </span>
                  <span className="flex h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <span className="flex h-full" style={{ width: `${(total / maxCarga) * 100}%` }}>
                      {done > 0 && <i style={{ flex: done, background: '#34C48E' }} />}
                      {doing > 0 && <i style={{ flex: doing, background: '#5AB6E8' }} />}
                      {todo > 0 && <i style={{ flex: todo, background: '#CBD5E1' }} />}
                    </span>
                  </span>
                  <span className="w-24 shrink-0 text-right text-[11px] font-bold text-slate-400">
                    {total}
                    {atras > 0 && <span className="text-[#e5484d]"> · {atras} atras.</span>}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 border-t border-slate-100 pt-2 text-[10px] font-bold text-slate-400">
              Solo para tus ojos: el equipo no ve métricas individuales.
            </p>
          </section>
        </div>

        {/* Hitos en el horizonte (en celular se ven en la pestaña Hitos) */}
        <section className="hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:block">
          <h3 className="font-extrabold text-slate-700">Hitos en el horizonte · próximos {HORIZONTE} días</h3>
          {hitosHorizonte.length === 0 ? (
            <p className="py-5 text-center text-sm font-semibold text-slate-300">
              No hay hitos con fecha en los próximos {HORIZONTE} días.
            </p>
          ) : (
            <div className="relative mt-2 h-[150px]">
              <div className="absolute inset-x-0 top-[78px] h-[3px] rounded-full bg-slate-200" />
              <div className="absolute top-[69px] left-0 size-[15px] rounded-full border-[3px] border-white bg-blue-600 shadow-[0_0_0_1px_#e2e8f0]" />
              <span className="absolute top-[98px] left-0 text-[10px] font-extrabold text-blue-600">HOY</span>
              {hitosHorizonte.map(({ h, pos, color }, i) => (
                <div
                  key={h.id}
                  className={`absolute flex w-[120px] items-center gap-1 ${
                    i % 2 === 0 ? 'bottom-[61px] flex-col' : 'top-[70px] flex-col-reverse'
                  }`}
                  style={{ left: `calc(${pos}% - 60px)` }}
                >
                  <span className="text-center text-[11px] leading-tight font-extrabold text-slate-700">{h.name}</span>
                  <span className="text-[10px] font-bold text-slate-400">
                    {format(parseISO(h.date!), 'EEE d MMM', { locale: es })}
                  </span>
                  <i className="size-[13px] shrink-0 rounded-full border-[3px] border-white shadow-[0_0_0_1px_#e2e8f0]" style={{ background: color }} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Actividad reciente */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-extrabold text-slate-700">Actividad reciente</h3>
            <span className="text-[11px] font-bold text-slate-400">comentarios · completadas · minutas</span>
          </div>
          <div className="grid gap-x-6 md:grid-cols-2">
            {actividad.length === 0 && (
              <p className="py-5 text-center text-sm font-semibold text-slate-300 md:col-span-2">
                Todavía no hay actividad para mostrar.
              </p>
            )}
            {actividad.map((e, i) => (
              <div key={`${e.when}-${i}`} className="flex items-start gap-2.5 border-b border-slate-100 py-2 last:border-0">
                <span
                  className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${
                    e.tipo === 'comentario' ? 'bg-blue-50' : e.tipo === 'completada' ? 'bg-emerald-50' : 'bg-amber-50'
                  }`}
                >
                  {e.tipo === 'comentario' && <MessageCircle size={12} className="text-blue-600" />}
                  {e.tipo === 'completada' && <CheckCircle2 size={12} className="text-emerald-500" />}
                  {e.tipo === 'minuta' && <ClipboardList size={12} className="text-amber-600" />}
                </span>
                <p className="min-w-0 text-xs leading-relaxed font-semibold text-slate-500">
                  <b className="text-slate-700">{e.quien}</b>{' '}
                  {e.tipo === 'comentario' ? 'comentó en' : e.tipo === 'completada' ? 'completó' : 'participó de la minuta'}{' '}
                  <b className="text-slate-700">{e.que}</b>
                  {e.extra && <span className="text-slate-400"> «{e.extra}»</span>}{' '}
                  <span className="font-bold whitespace-nowrap text-slate-300">
                    · {formatDistanceToNow(parseISO(e.when), { addSuffix: true, locale: es })}
                  </span>
                </p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] font-bold text-slate-400">
            Las tareas completadas y la cola de decisiones se registran desde que corriste la migración del Panel: lo
            histórico anterior no tiene fecha.
          </p>
        </section>

        {/* Gestión de miembros (lo que antes vivía en la pestaña Equipo) */}
        <MiembrosEquipo />
      </div>
    </div>
  )
}

function KpiTile({ valor, label, accent = '#334155', destacado }: { valor: number; label: string; accent?: string; destacado?: boolean }) {
  return (
    <div className={`rounded-xl bg-white p-4 shadow-sm ${destacado ? 'border-2 border-blue-300' : 'border border-slate-200'}`}>
      <p className="text-2xl font-black" style={{ color: accent }}>
        {valor}
      </p>
      <p className="text-[11px] leading-tight font-extrabold tracking-wide text-slate-400 uppercase">{label}</p>
    </div>
  )
}
