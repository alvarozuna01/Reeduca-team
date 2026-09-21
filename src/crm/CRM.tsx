import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Building2, ChevronDown, ChevronRight, Handshake, Plus, Search, Star } from 'lucide-react'
import { normalizar } from '../lib/menciones'
import { usePref } from '../lib/usePref'
import { useApp } from '../state/AppContext'
import { AvatarStack } from '../components/Avatar'
import MultiFilter from '../components/MultiFilter'
import { useCrm } from './contexto'
import ChipAccion from './ChipAccion'
import { GRUPOS, cadenaDe, grupoDe, proximaDe, tipoDe, type Grupo } from './reglas'
import { ESTADOS_POSVENTA, ETAPAS, type CrmAccion, type CrmOportunidad } from './tipos'

type Pestana = 'venta' | 'posventa' | 'instituciones'

/**
 * CRM de instituciones dentro del sistema: el pipeline de venta y de posventa
 * (cada oportunidad con su cadena de acciones) y el directorio con las fichas.
 * Solo lo ven quienes están en la lista de acceso al CRM.
 */
export default function CRM() {
  const { users } = useApp()
  const crm = useCrm()
  const [pestana, setPestana] = useState<Pestana>('venta')
  const [busca, setBusca] = useState('')
  const [personas, setPersonas] = useState<string[]>([])

  const instById = useMemo(() => new Map(crm.instituciones.map((i) => [i.id, i])), [crm.instituciones])

  // Cada oportunidad con su cadena, su próxima acción y su grupo.
  const filas = useMemo(
    () =>
      crm.oportunidades.map((o) => {
        const cadena = cadenaDe(o, crm.acciones)
        const proxima = proximaDe(cadena)
        return { opp: o, inst: instById.get(o.institucionId), cadena, proxima, grupo: grupoDe(proxima), tipo: tipoDe(o.etapa) }
      }),
    [crm.oportunidades, crm.acciones, instById],
  )

  const q = normalizar(busca.trim())
  const visibles = (tipo: 'venta' | 'posventa') =>
    filas.filter(
      (f) =>
        f.tipo === tipo &&
        f.inst &&
        (!q || normalizar(f.inst.nombre).includes(q)) &&
        (!personas.length ||
          f.opp.responsableIds.some((id) => personas.includes(id)) ||
          f.cadena.some((a) => a.estado !== 'CONCRETADO' && a.responsableIds.some((id) => personas.includes(id)))),
    )

  const nVenta = filas.filter((f) => f.tipo === 'venta').length
  const nPosventa = filas.filter((f) => f.tipo === 'posventa').length

  if (crm.cargando) return <p className="p-8 text-center text-sm font-bold text-slate-300">Cargando el CRM…</p>

  const pest = (p: Pestana, label: string, n: number) => (
    <button
      onClick={() => setPestana(p)}
      className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-extrabold transition ${
        pestana === p ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
      }`}
    >
      {label}
      <span className="rounded-full bg-slate-200/70 px-1.5 text-[10px] text-slate-500">{n}</span>
    </button>
  )

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-black text-slate-800">
              <Handshake size={22} className="text-blue-600" /> CRM
            </h2>
            <p className="mt-0.5 text-sm font-semibold text-slate-400">
              Instituciones, ventas y posventa. Las acciones con fecha también aparecen en la Agenda.
            </p>
          </div>
          <button
            onClick={crm.abrirNuevaInstitucion}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-blue-700"
          >
            <Plus size={14} /> Nueva institución
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1">
            {pest('venta', 'Venta', nVenta)}
            {pest('posventa', 'Posventa', nPosventa)}
            {pest('instituciones', 'Instituciones', crm.instituciones.length)}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
              <Search size={13} className="text-slate-300" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar institución…"
                className="w-40 bg-transparent text-xs font-semibold text-slate-600 outline-none placeholder:text-slate-300"
              />
            </label>
            {pestana !== 'instituciones' && (
              <MultiFilter
                label="Personas"
                options={users.filter((u) => crm.accesos.some((a) => a.userId === u.id)).map((u) => ({ id: u.id, label: u.name, user: u }))}
                selected={personas}
                onChange={setPersonas}
              />
            )}
          </div>
        </div>

        {pestana === 'instituciones' ? (
          <Directorio busca={q} />
        ) : (
          <Pipeline filas={visibles(pestana)} tipo={pestana} />
        )}
      </div>
    </div>
  )
}

interface Fila {
  opp: CrmOportunidad
  inst?: { id: string; nombre: string; especial: boolean }
  cadena: CrmAccion[]
  proxima?: CrmAccion
  grupo: Grupo
}

function Pipeline({ filas, tipo }: { filas: Fila[]; tipo: 'venta' | 'posventa' }) {
  const ordenar = (a: Fila, b: Fila) =>
    Number(b.inst?.especial) - Number(a.inst?.especial) ||
    (a.proxima?.fecha ?? '9999').localeCompare(b.proxima?.fecha ?? '9999') ||
    (a.inst?.nombre ?? '').localeCompare(b.inst?.nombre ?? '', 'es')
  return (
    <div className="space-y-3">
      {GRUPOS.map((g) => {
        const del = filas.filter((f) => f.grupo === g.id).sort(ordenar)
        return <Seccion key={g.id} grupo={g.id} label={g.label} ayuda={g.ayuda} filas={del} tipo={tipo} />
      })}
      {!filas.length && <p className="py-10 text-center text-sm font-semibold text-slate-300">Nada que mostrar con estos filtros.</p>}
    </div>
  )
}

const COLOR_GRUPO: Record<Grupo, string> = {
  vencidas: 'bg-[#e5484d]',
  semana: 'bg-blue-600',
  sinFecha: 'bg-amber-400',
  futuras: 'bg-slate-400',
  sinAccion: 'bg-slate-300',
}

function Seccion({ grupo, label, ayuda, filas, tipo }: { grupo: Grupo; label: string; ayuda: string; filas: Fila[]; tipo: 'venta' | 'posventa' }) {
  const [abierta, setAbierta] = usePref(`crm-${tipo}-${grupo}`, grupo !== 'futuras' && grupo !== 'sinAccion')
  if (!filas.length) return null
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <button onClick={() => setAbierta(!abierta)} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        {abierta ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
        <i className={`size-2.5 rounded-full ${COLOR_GRUPO[grupo]}`} />
        <h3 className="font-extrabold text-slate-700">{label}</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-extrabold text-slate-500">{filas.length}</span>
        <span className="hidden text-[11px] font-semibold text-slate-400 sm:inline">{ayuda}</span>
      </button>
      {abierta && (
        <div className="divide-y divide-slate-100 border-t border-slate-100">
          {filas.map((f) => (
            <FilaOportunidad key={f.opp.id} fila={f} tipo={tipo} />
          ))}
        </div>
      )}
    </section>
  )
}

function FilaOportunidad({ fila, tipo }: { fila: Fila; tipo: 'venta' | 'posventa' }) {
  const { users } = useApp()
  const crm = useCrm()
  const { opp, inst, cadena } = fila
  const [todas, setTodas] = useState(false)
  const MAX = 5
  const ocultas = todas ? 0 : Math.max(0, cadena.length - MAX)
  const vista = cadena.slice(ocultas)

  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        {inst?.especial && <Star size={14} className="shrink-0 fill-amber-400 text-amber-500" />}
        <button onClick={() => inst && crm.abrirFicha(inst.id)} className="min-w-0 text-left text-sm font-extrabold text-slate-700 hover:text-blue-700">
          {inst?.nombre}
        </button>
        {opp.modalidad && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-500">{opp.modalidad}</span>}
        <select
          value={opp.etapa}
          onChange={(e) => crm.guardarOportunidad({ ...opp, etapa: e.target.value as CrmOportunidad['etapa'] })}
          className="rounded-lg border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-extrabold text-slate-600"
        >
          {ETAPAS.map((e) => (
            <option key={e}>{e}</option>
          ))}
        </select>
        {tipo === 'posventa' && (
          <select
            value={opp.estadoPosventa}
            onChange={(e) => crm.guardarOportunidad({ ...opp, estadoPosventa: e.target.value })}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700"
          >
            <option value="">Estado posventa…</option>
            {ESTADOS_POSVENTA.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        )}
        <span className="ml-auto">
          <AvatarStack users={users.filter((u) => opp.responsableIds.includes(u.id))} size={20} />
        </span>
      </div>
      <div className="mt-2 flex items-stretch gap-2 overflow-x-auto pt-2 pb-1">
        {ocultas > 0 && (
          <button
            onClick={() => setTodas(true)}
            className="shrink-0 rounded-lg border border-dashed border-slate-200 px-2.5 text-[11px] font-extrabold text-slate-400 hover:text-slate-600"
          >
            +{ocultas} anteriores
          </button>
        )}
        {vista.map((a) => (
          <ChipAccion key={a.id} accion={a} onAbrir={() => crm.abrirAccion(a)} onHecha={() => crm.guardarAccion({ ...a, estado: 'CONCRETADO' })} />
        ))}
        <button
          onClick={() => crm.abrirAccion({ nueva: true, institucionId: opp.institucionId, oportunidadId: opp.id })}
          title="Agregar la próxima acción"
          className="grid w-10 shrink-0 place-items-center rounded-lg border border-dashed border-blue-200 text-blue-500 hover:bg-blue-50"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  )
}

function Directorio({ busca }: { busca: string }) {
  const crm = useCrm()
  const [segmento, setSegmento] = useState('')
  const lista = useMemo(
    () =>
      crm.instituciones
        .filter((i) => (!busca || normalizar(i.nombre).includes(busca)) && (!segmento || i.segmento === segmento))
        .map((i) => {
          const opps = crm.oportunidades.filter((o) => o.institucionId === i.id)
          const hechas = crm.acciones
            .filter((a) => a.institucionId === i.id && a.estado === 'CONCRETADO' && a.fecha)
            .sort((a, b) => b.fecha!.localeCompare(a.fecha!))
          return {
            i,
            venta: opps.filter((o) => tipoDe(o.etapa) === 'venta').length,
            posventa: opps.filter((o) => tipoDe(o.etapa) === 'posventa').length,
            ultima: hechas[0]?.fecha,
          }
        })
        .sort((a, b) => Number(b.i.especial) - Number(a.i.especial) || a.i.nombre.localeCompare(b.i.nombre, 'es')),
    [crm.instituciones, crm.oportunidades, crm.acciones, busca, segmento],
  )
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {['', 'Colegio', 'Universidad', 'Academia'].map((s) => (
          <button
            key={s}
            onClick={() => setSegmento(s)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold transition ${
              segmento === s ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:ring-slate-300'
            }`}
          >
            {s || 'Todas'}
          </button>
        ))}
        <span className="ml-auto self-center text-[11px] font-bold text-slate-400">{lista.length} instituciones</span>
      </div>
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
        {lista.map(({ i, venta, posventa, ultima }) => (
          <button key={i.id} onClick={() => crm.abrirFicha(i.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50">
            <Building2 size={16} className="shrink-0 text-slate-300" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-sm font-extrabold text-slate-700">
                {i.especial && <Star size={12} className="shrink-0 fill-amber-400 text-amber-500" />}
                <span className="truncate">{i.nombre}</span>
              </span>
              <span className="text-[11px] font-semibold text-slate-400">{[i.segmento, i.ciudad].filter(Boolean).join(' · ')}</span>
            </span>
            {venta > 0 && <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-extrabold text-blue-700">venta {venta}</span>}
            {posventa > 0 && <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">cliente</span>}
            {i.enLnr && <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-extrabold text-violet-700">LNR</span>}
            <span className="hidden w-24 shrink-0 text-right text-[11px] font-bold text-slate-400 sm:block">
              {ultima ? `últ. ${format(parseISO(ultima), 'd MMM', { locale: es })}` : 'sin gestiones'}
            </span>
          </button>
        ))}
        {!lista.length && <p className="py-8 text-center text-sm font-semibold text-slate-300">Ninguna institución coincide.</p>}
      </div>
    </div>
  )
}
