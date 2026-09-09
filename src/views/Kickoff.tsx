import { useMemo, useState, type ReactNode } from 'react'
import { addDays, format, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import { CheckCircle2, ChevronDown, Flag, Lightbulb, MessageCircle, Presentation, RefreshCw, Rocket, Scale } from 'lucide-react'
import { useApp } from '../state/AppContext'
import KickoffReunion, { type BloqueKickoff } from '../components/KickoffReunion'

/**
 * Kickoff semanal (Módulo C) — FASE 3: MAQUETA con datos de mentira.
 * La forma es real (6 bloques, modo reunión, briefing personal); los datos
 * y el guardado llegan en las Fases 7 y 8. Detrás de FEATURE_KICKOFF.
 */

/** Lunes que corresponde: lun-jue muestra el de esta semana; vie-dom, el próximo. */
function lunesObjetivo(hoy: Date): Date {
  const lunes = startOfWeek(hoy, { weekStartsOn: 1 })
  const dia = hoy.getDay() // 0 dom … 6 sáb
  return dia === 5 || dia === 6 || dia === 0 ? addDays(lunes, 7) : lunes
}

export default function Kickoff() {
  const { isAdmin } = useApp()
  const [vista, setVista] = useState<'gg' | 'briefing'>(isAdmin ? 'gg' : 'briefing')
  const [reunion, setReunion] = useState(false)

  const lunes = useMemo(() => lunesObjetivo(new Date()), [])
  const fechaLegible = format(lunes, "EEEE d 'de' MMMM", { locale: es })

  const bloques = useMemo(() => bloquesDeMentira(), [])

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-5">
        <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-extrabold text-amber-700">
          MAQUETA · Todos los datos son de mentira. Es para decidir la forma: los datos reales llegan en las próximas
          fases.
        </p>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-black text-slate-800">
              <Rocket size={22} className="text-blue-600" /> Kickoff semanal
            </h2>
            <p className="mt-0.5 text-sm font-semibold text-slate-400 capitalize">
              {fechaLegible} · 8:30 · 30 minutos
              <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-blue-700 uppercase normal-case">
                Preparado
              </span>
            </p>
          </div>
          {isAdmin && vista === 'gg' && (
            <div className="flex items-center gap-2">
              <button
                disabled
                title="Se activa en la Fase 7 (recalcula los bloques)"
                className="flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-300"
              >
                <RefreshCw size={13} /> Actualizar
              </button>
              <button
                onClick={() => setReunion(true)}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-blue-700"
              >
                <Presentation size={14} /> Modo reunión
              </button>
              <button
                disabled
                title="Se activa en la Fase 7 (genera la minuta automáticamente)"
                className="flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-300"
              >
                Cerrar kickoff
              </button>
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
              Mi vista (los 6 bloques)
            </button>
            <button
              onClick={() => setVista('briefing')}
              className={`rounded-md px-3 py-1.5 text-xs font-extrabold transition ${
                vista === 'briefing' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Briefing personal (ejemplo)
            </button>
          </div>
        )}

        {vista === 'gg' ? (
          <div className="space-y-4">
            {bloques.map((b) => (
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
          </div>
        ) : (
          <BriefingPersonalMaqueta />
        )}
      </div>

      {reunion && <KickoffReunion bloques={bloques} onClose={() => setReunion(false)} />}
    </div>
  )
}

/* ---------- Piezas visuales reutilizadas por las maquetas ---------- */

function AvatarFicticio({ inicial, color, size = 22 }: { inicial: string; color: string; size?: number }) {
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: color, fontSize: size * 0.45 }}
    >
      {inicial}
    </span>
  )
}

function FilaHecha({ texto }: { texto: string }) {
  return (
    <p className="flex items-center gap-2 py-1 text-sm font-semibold text-slate-600">
      <CheckCircle2 size={15} className="shrink-0 fill-emerald-100 text-emerald-500" /> {texto}
    </p>
  )
}

/* ---------- Los 6 bloques con datos de mentira ---------- */

function bloquesDeMentira(): BloqueKickoff[] {
  return [
    {
      numero: 1,
      titulo: 'Lo que se cerró la semana pasada',
      minutos: 2,
      contenido: (
        <div className="space-y-3">
          <div>
            <p className="mb-1 flex items-center gap-2 text-xs font-extrabold text-slate-500">
              <AvatarFicticio inicial="D" color="#14B8A6" /> Diana · 2
            </p>
            <FilaHecha texto="Visita IFD Paraguarí · grupo 2" />
            <FilaHecha texto="Informe de visita cargado al Drive" />
          </div>
          <div>
            <p className="mb-1 flex items-center gap-2 text-xs font-extrabold text-slate-500">
              <AvatarFicticio inicial="P" color="#F97316" /> Pablo · 1
            </p>
            <FilaHecha texto="Escritura · Unidad 4 · 4to" />
          </div>
          <div>
            <p className="mb-1 flex items-center gap-2 text-xs font-extrabold text-slate-500">
              <AvatarFicticio inicial="M" color="#EC4899" /> Malena · 1
            </p>
            <FilaHecha texto="Actualizar pipeline de ventas" />
          </div>
          <p className="text-[11px] font-semibold text-slate-400">
            Arranca la reunión en positivo. Se calcula con la fecha de completado, agrupado por persona.
          </p>
        </div>
      ),
    },
    {
      numero: 2,
      titulo: 'Lo que se comprometió y no se cumplió',
      minutos: 5,
      contenido: (
        <div className="space-y-1">
          {[
            { texto: 'Enviar nota formal a los IFD', quien: 'Álvaro', inicial: 'Á', color: '#64748B', dias: 8 },
            { texto: 'Confirmar sede de Jóvenes Conectados', quien: 'Luciana', inicial: 'L', color: '#8B5CF6', dias: 5 },
            { texto: 'Cargar facturas de agosto al sistema', quien: 'Malena', inicial: 'M', color: '#EC4899', dias: 3 },
          ].map((f) => (
            <div key={f.texto} className="flex items-center gap-2.5 border-b border-slate-50 py-2 last:border-0">
              <AvatarFicticio inicial={f.inicial} color={f.color} />
              <span className="min-w-0 flex-1 text-sm font-bold text-slate-700">{f.texto}</span>
              <span className="shrink-0 text-xs font-semibold text-slate-400">{f.quien}</span>
              <span className="shrink-0 rounded bg-[#e5484d] px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                {f.dias} días
              </span>
            </div>
          ))}
          <p className="pt-2 text-[11px] font-semibold text-slate-400">
            Este bloque es el que le da peso al ritual: sale de las acciones acordadas en el kickoff anterior. Si nadie
            revisa, nadie cumple.
          </p>
        </div>
      ),
    },
    {
      numero: 3,
      titulo: 'La semana de cada uno',
      minutos: 12,
      contenido: (
        <div className="space-y-2">
          {[
            { inicial: 'P', color: '#F97316', nombre: 'Pablo', linea: 'Cerrar la Unidad 5 y dar la capacitación del jueves en Paraguarí.', briefing: true },
            { inicial: 'L', color: '#8B5CF6', nombre: 'Luciana', linea: 'Semana de Intercolegial: logística, prensa e inscripciones.', briefing: true },
            { inicial: 'D', color: '#14B8A6', nombre: 'Diana', linea: '', briefing: false },
            { inicial: 'M', color: '#EC4899', nombre: 'Malena', linea: '', briefing: false },
            { inicial: 'Á', color: '#64748B', nombre: 'Álvaro', linea: 'Criterios de certificación MEC y reunión con Equilibrium.', briefing: true },
          ].map((p) => (
            <div key={p.nombre} className="flex items-start gap-2.5">
              <AvatarFicticio inicial={p.inicial} color={p.color} size={26} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-xs font-extrabold text-slate-500">
                  {p.nombre}
                  {p.briefing ? (
                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-700">
                      briefing ✓
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-extrabold text-slate-400">
                      pendiente
                    </span>
                  )}
                </p>
                {p.linea ? (
                  <p className="mt-0.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-sm font-semibold text-slate-600">
                    {p.linea}
                  </p>
                ) : (
                  <p className="mt-0.5 rounded-lg border border-dashed border-slate-200 px-2.5 py-1.5 text-sm font-semibold text-slate-300">
                    Se completa en vivo, en la reunión…
                  </p>
                )}
              </div>
            </div>
          ))}
          <p className="pt-1 text-[11px] font-semibold text-slate-400">
            Precargado con lo que cada uno respondió en su briefing del viernes. Lo que falta se escribe en vivo: la
            reunión no depende de que todos cumplan.
          </p>
        </div>
      ),
    },
    {
      numero: 4,
      titulo: 'Fechas que se vienen · próximos 14 días',
      minutos: 3,
      contenido: (
        <div className="space-y-1">
          {[
            { que: 'Intercolegial Cristo Rey', cuando: 'vie 11 sep', color: '#5AB6E8', hito: true },
            { que: 'Capacitación M3 · Paraguarí', cuando: 'mar 15 sep · 13:00', color: '#F0A62B', hito: false },
            { que: 'Cierre contable de agosto', cuando: 'jue 17 sep', color: '#8B5CF6', hito: true },
            { que: 'Cierre de recolección IFD', cuando: 'sáb 19 sep', color: '#F0A62B', hito: true },
          ].map((f) => (
            <div key={f.que} className="flex items-center gap-2.5 border-b border-slate-50 py-2 last:border-0">
              <Flag size={14} style={{ color: f.color }} className="shrink-0" />
              <span className="min-w-0 flex-1 text-sm font-bold text-slate-700">{f.que}</span>
              <span className="shrink-0 text-xs font-extrabold text-slate-500 capitalize">{f.cuando}</span>
              <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-extrabold text-slate-400 uppercase">
                {f.hito ? 'hito' : 'agenda'}
              </span>
            </div>
          ))}
        </div>
      ),
    },
    {
      numero: 5,
      titulo: 'Decisiones que me necesitan',
      minutos: 6,
      contenido: (
        <div className="space-y-1">
          {[
            { texto: 'Aprobar presupuesto de kits VEX 2027', dias: 6 },
            { texto: 'Precio de inscripción del Intercolegial', dias: 2 },
          ].map((d) => (
            <div key={d.texto} className="flex items-center gap-2.5 border-b border-slate-50 py-2 last:border-0">
              <Scale size={14} className="shrink-0 text-blue-600" />
              <span className="min-w-0 flex-1 text-sm font-bold text-slate-700">{d.texto}</span>
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-extrabold ${
                  d.dias >= 4 ? 'bg-red-50 text-[#e5484d]' : 'bg-amber-100 text-amber-700'
                }`}
              >
                hace {d.dias} días
              </span>
            </div>
          ))}
          <p className="pt-2 text-[11px] font-semibold text-slate-400">
            La misma cola del Panel: todo junto y en un solo momento, en vez de suelto por WhatsApp toda la semana.
          </p>
        </div>
      ),
    },
    {
      numero: 6,
      titulo: 'Consejo de la semana',
      minutos: 2,
      contenido: (
        <div className="rounded-xl bg-blue-50/60 p-4">
          <p className="flex items-start gap-2.5 text-sm leading-relaxed font-bold text-slate-700">
            <Lightbulb size={18} className="mt-0.5 shrink-0 fill-amber-200 text-amber-500" />
            «Cuando delegues, escribí en una frase cómo se ve “terminado”. La mitad de los retrabajos de agosto fueron
            por eso.»
          </p>
          <p className="mt-1.5 pl-7 text-xs font-semibold text-slate-400">— te lo dijo Guillermo · hace 3 semanas</p>
          <div className="mt-3 flex gap-2 pl-7">
            <button
              disabled
              title="Se activa en la Fase 6"
              className="cursor-not-allowed rounded-lg bg-white px-3 py-1.5 text-xs font-extrabold text-slate-300 shadow-sm"
            >
              Sigue vigente
            </button>
            <button
              disabled
              title="Se activa en la Fase 6"
              className="cursor-not-allowed rounded-lg bg-white px-3 py-1.5 text-xs font-extrabold text-slate-300 shadow-sm"
            >
              Ya no aplica
            </button>
          </div>
        </div>
      ),
    },
  ]
}

/* ---------- Briefing personal (maqueta, "como lo vería Luciana") ---------- */

function Tarjeta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-extrabold text-slate-700">{titulo}</h3>
      {children}
    </section>
  )
}

function BriefingPersonalMaqueta() {
  const [q1, setQ1] = useState('')
  const [q2, setQ2] = useState('')

  return (
    <div className="space-y-4">
      <p className="text-[11px] font-semibold text-slate-400">
        Así lo vería cada persona desde el viernes (acá, el ejemplo de Luciana). Nadie ve el briefing de otro.
      </p>

      <Tarjeta titulo="Cerraste 2 tareas la semana pasada 👏">
        <FilaHecha texto="Actualizar pipeline de ventas" />
        <FilaHecha texto="Guion de la nota de prensa del Intercolegial" />
      </Tarjeta>

      <Tarjeta titulo="Te comprometiste y quedó pendiente">
        <div className="flex items-center gap-2.5 py-1">
          <span className="min-w-0 flex-1 text-sm font-bold text-slate-700">Confirmar sede de Jóvenes Conectados</span>
          <span className="shrink-0 rounded bg-[#e5484d] px-1.5 py-0.5 text-[10px] font-extrabold text-white">5 días</span>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Tu semana">
        {['Logística del Intercolegial (vie 11)', 'Prensa e invitaciones (mié 9)', 'Seguimiento de pipeline (jue 10)'].map(
          (t) => (
            <p key={t} className="border-b border-slate-50 py-1.5 text-sm font-semibold text-slate-600 last:border-0">
              {t}
            </p>
          ),
        )}
      </Tarjeta>

      <Tarjeta titulo="Fechas que te involucran">
        <p className="py-1 text-sm font-semibold text-slate-600">🚩 Intercolegial Cristo Rey · vie 11 sep</p>
        <p className="py-1 text-sm font-semibold text-slate-600">🚩 Capacitación M3 · mar 15 sep · 13:00</p>
      </Tarjeta>

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
        <button
          disabled
          title="Se activa en la Fase 8"
          className="mt-3 cursor-not-allowed rounded-lg bg-blue-600 px-4 py-2 text-sm font-extrabold text-white opacity-40"
        >
          Guardar mis respuestas
        </button>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-slate-700">
          <MessageCircle size={14} className="text-blue-600" /> Tus anotaciones
        </h3>
        <p className="mb-2 text-[11px] font-semibold text-slate-400">
          Privadas de verdad: ni el Gerente las ve, salvo que vos las compartas.
        </p>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-sm font-semibold text-slate-600">Preguntar por el presupuesto de prensa antes de cerrar.</p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-extrabold text-slate-500">
              🔒 Solo la ves vos
            </span>
            <button
              disabled
              title="Se activa en la Fase 8"
              className="cursor-not-allowed text-[10px] font-extrabold text-slate-300"
            >
              Compartir en la reunión
            </button>
          </div>
        </div>
        <button disabled title="Se activa en la Fase 8" className="mt-2 flex cursor-not-allowed items-center gap-1 text-xs font-bold text-slate-300">
          <ChevronDown size={13} /> Agregar nota al pie
        </button>
      </section>
    </div>
  )
}
