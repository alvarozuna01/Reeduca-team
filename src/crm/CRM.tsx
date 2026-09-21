import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { normalizar } from '../lib/menciones'
import { usePref } from '../lib/usePref'
import { useCrm } from './contexto'
import BloqueAccion from './BloqueAccion'
import NuevaOportunidad from './NuevaOportunidad'
import { cadenaDe, tipoDe, urgenciasDe } from './reglas'
import { ARRASTRE_ACCION, LU, etapaColor, modalidadColor } from './estilo'
import { ESTADOS_POSVENTA, ETAPAS, type CrmAccion, type CrmInstitucion, type CrmOportunidad, type Etapa } from './tipos'

type Modo = 'venta' | 'posventa' | '2027'
type Pestana = Modo | 'instituciones'

const PESTANAS: { id: Pestana; label: string }[] = [
  { id: 'venta', label: 'Venta' },
  { id: 'posventa', label: 'Posventa' },
  { id: '2027', label: '🎯 2027' },
  { id: 'instituciones', label: 'Instituciones' },
]

const TITULOS: Record<Modo, [string, string]> = {
  venta: ['🗂️ Pipeline — Venta', 'ventas en curso, con toda la cadena de acciones'],
  posventa: ['🗂️ Pipeline — Posventa', 'clientes ganados y su seguimiento'],
  '2027': ['🎯 Objetivo 2027', 'clientes a insistir para que arranquen en 2027'],
}

const SEGMENTOS_FILTRO = [
  ['', 'Todas'],
  ['Colegio', 'Colegios'],
  ['Universidad', 'Universidades'],
  ['Academia', 'Academias'],
] as const

/** Una oportunidad con su institución y su cadena de acciones completa. */
interface Fila {
  opp: CrmOportunidad
  inst: CrmInstitucion
  cadena: CrmAccion[]
}

/**
 * CRM de instituciones, con el aspecto y las funciones del "Lu · Venta" de la
 * planilla: cada venta con toda su cadena de acciones, desplegables por
 * urgencia y los colores de siempre. Solo lo ve la lista de acceso al CRM.
 */
export default function CRM() {
  const crm = useCrm()
  const [pestana, setPestana] = useState<Pestana>('venta')
  const [segmento, setSegmento] = useState('')
  const [etapa, setEtapa] = useState('')
  const [busca, setBusca] = useState('')
  const [nuevaOpp, setNuevaOpp] = useState(false)

  const instById = useMemo(() => new Map(crm.instituciones.map((i) => [i.id, i])), [crm.instituciones])
  const filas = useMemo(
    () =>
      crm.oportunidades.flatMap((opp) => {
        const inst = instById.get(opp.institucionId)
        return inst ? [{ opp, inst, cadena: cadenaDe(opp, crm.acciones) }] : []
      }),
    [crm.oportunidades, crm.acciones, instById],
  )

  if (crm.cargando) return <p className="p-8 text-center text-sm font-bold text-slate-300">Cargando el CRM…</p>

  const modo: Modo = pestana === 'instituciones' ? 'venta' : pestana
  const q = normalizar(busca.trim())
  const visibles = filas
    .filter(({ opp, inst }) => {
      if (modo === '2027' ? !opp.objetivo2027 : modo === 'posventa' ? opp.etapa !== 'CERRADO-GANADO' : opp.etapa === 'CERRADO-GANADO') return false
      if (segmento && inst.segmento !== segmento) return false
      if (modo !== 'posventa' && etapa && opp.etapa !== etapa) return false
      return !q || normalizar(inst.nombre).includes(q)
    })
    .sort(
      (a, b) =>
        Number(b.inst.especial) - Number(a.inst.especial) ||
        a.inst.nombre.localeCompare(b.inst.nombre, 'es') ||
        a.opp.modalidad.localeCompare(b.opp.modalidad),
    )

  return (
    <>
      <div className="h-full overflow-y-auto" style={{ background: LU.fondo, fontFamily: LU.fuente, color: LU.txt }}>
        <div className="mx-auto max-w-[1100px] px-4 py-4">
          {/* Pestañas */}
          <div className="flex flex-wrap gap-1.5">
            {PESTANAS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPestana(p.id)}
                className={`rounded-[20px] border px-3.5 py-[7px] text-[12.5px] font-bold whitespace-nowrap transition ${
                  pestana === p.id ? 'border-transparent text-white shadow-[0_3px_10px_rgba(93,173,234,.32)]' : 'bg-white hover:border-[#6E93D2] hover:text-[#6E93D2]'
                }`}
                style={pestana === p.id ? { background: LU.grad } : { borderColor: LU.linea, color: LU.muted }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {pestana === 'instituciones' ? (
            <Directorio />
          ) : (
            <>
              <h2 className="mt-[18px] mb-2 rounded-[2px] border-l-4 pl-[9px] text-sm font-bold" style={{ borderColor: LU.brand2, color: LU.titulo }}>
                {TITULOS[modo][0]} <span className="text-xs font-semibold" style={{ color: LU.muted }}>{TITULOS[modo][1]}</span>
              </h2>

              {/* Barra: segmento, búsqueda y altas */}
              <div className="mt-1.5 mb-3 flex flex-wrap items-center gap-3.5">
                <div className="flex flex-wrap gap-1.5">
                  {SEGMENTOS_FILTRO.map(([id, label]) => (
                    <Chip key={id} on={segmento === id} onClick={() => setSegmento(id)}>
                      {label}
                    </Chip>
                  ))}
                </div>
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar institución…"
                  className="min-w-[170px] flex-1 rounded-[7px] border border-[#ccc] bg-white px-2.5 py-2 text-[13px] outline-none focus:border-[#5DADEA] focus:shadow-[0_0_0_3px_rgba(93,173,234,.18)] sm:flex-none"
                  style={{ color: LU.txt }}
                />
                <div className="flex flex-wrap gap-2">
                  <Boton fondo={LU.ok} onClick={() => setNuevaOpp(true)}>
                    ➕ Nueva oportunidad
                  </Boton>
                  <Boton fondo={LU.grad} onClick={crm.abrirNuevaInstitucion}>
                    ➕ Nueva institución
                  </Boton>
                </div>
              </div>

              {/* Etapas (no en posventa) */}
              {modo !== 'posventa' && (
                // En el celular, una sola fila que se desliza de costado.
                <div className="-mx-4 mb-2 flex gap-1.5 overflow-x-auto px-4 pt-0.5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
                  <ChipEtapa on={!etapa} fondo="#EEF1F5" onClick={() => setEtapa('')}>
                    Todas las etapas
                  </ChipEtapa>
                  {ETAPAS.map((e) => (
                    <ChipEtapa key={e} on={etapa === e} fondo={etapaColor(e)} onClick={() => setEtapa(e)}>
                      {e}
                    </ChipEtapa>
                  ))}
                </div>
              )}

              <p className="mt-0.5 mb-2.5 text-[11.5px]" style={{ color: LU.muted }}>
                Desplegá por urgencia, o abrí <b>Todas</b> con la cadena completa. Tocá una acción para editarla · la etapa para cambiarla ·{' '}
                <b>+</b> agrega.<span className="hidden md:inline"> Arrastrá una acción sobre otra institución para moverla.</span> &nbsp;
                <b style={{ color: LU.ok }}>■</b> hecha <b style={{ color: LU.sem }}>■</b> pendiente <b style={{ color: LU.venc }}>■</b> vencida
              </p>

              <Pipeline filas={visibles} modo={modo} />
            </>
          )}
        </div>
      </div>

      {/* Afuera del contenedor, así la ventana usa la letra del resto del sistema. */}
      {nuevaOpp && (
        <NuevaOportunidad
          tipoInicial={modo === 'posventa' ? 'posventa' : 'venta'}
          objetivo2027Inicial={modo === '2027'}
          onClose={() => setNuevaOpp(false)}
        />
      )}
    </>
  )
}

/* ---------------- Piezas chicas con el estilo de la planilla ---------------- */

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-[14px] border px-3 py-[5px] text-[12.5px] transition select-none ${
        on ? 'border-[#5DADEA] bg-[#5DADEA] font-bold text-white' : 'border-[#cbd5e1] bg-white text-[#556] hover:border-[#6E93D2]'
      }`}
    >
      {children}
    </button>
  )
}

function ChipEtapa({ on, fondo, onClick, children }: { on: boolean; fondo: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-xl border border-[#ccc] px-2.5 py-1 text-[11.5px] font-bold whitespace-nowrap select-none ${on ? 'outline-2 outline-offset-1 outline-[#3F5A86]' : ''}`}
      style={{ background: fondo, color: LU.txt }}
    >
      {children}
    </button>
  )
}

function Boton({ fondo, onClick, children }: { fondo: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="rounded-[10px] px-3 py-[7px] text-xs font-bold text-white shadow-[0_2px_7px_rgba(63,90,134,.12)] transition hover:shadow-[0_4px_13px_rgba(63,90,134,.20)] hover:brightness-105 active:scale-[.97]"
      style={{ background: fondo }}
    >
      {children}
    </button>
  )
}

/** Desplegable blanco con su contador de color (se acuerda si lo dejaste abierto). */
function Desplegable({ id, titulo, n, color, abiertoInicial, children }: { id: string; titulo: string; n: number; color: string; abiertoInicial: boolean; children: ReactNode }) {
  const [abierto, setAbierto] = usePref(`crm-panel-${id}`, abiertoInicial)
  return (
    <section className="mb-3 overflow-hidden rounded-[14px] border bg-white shadow-[0_2px_8px_rgba(63,90,134,.05)]" style={{ borderColor: LU.linea }}>
      <button
        onClick={() => setAbierto(!abierto)}
        className="flex w-full items-center gap-2.5 px-4 py-[13px] text-left font-bold select-none hover:bg-[#F7FAFE]"
        style={{ color: LU.titulo }}
      >
        <span className={`text-[13px] transition-transform ${abierto ? 'rotate-90' : ''}`} style={{ color: LU.muted }}>
          ▸
        </span>
        <span>{titulo}</span>
        <span className="ml-auto rounded-xl px-[11px] py-px text-[12.5px] font-bold text-white" style={{ background: color }}>
          {n}
        </span>
      </button>
      {abierto && <div className="px-2.5 pt-2 pb-3">{children}</div>}
    </section>
  )
}

/* ---------------- El pipeline ---------------- */

const ORDEN_SEGMENTOS = ['Colegio', 'Universidad', 'Academia', 'Otro']

function Pipeline({ filas, modo }: { filas: Fila[]; modo: Modo }) {
  // Una venta aparece en cada desplegable donde tenga alguna acción pendiente.
  const venc: Fila[] = []
  const sem: Fila[] = []
  const fut: Fila[] = []
  for (const f of filas) {
    const u = urgenciasDe(f.cadena)
    if (u.vencidas) venc.push(f)
    if (u.semana) sem.push(f)
    if (u.futuras) fut.push(f)
  }

  const porSegmento = ORDEN_SEGMENTOS.map((s) => ({
    s,
    filas: filas.filter((f) => (ORDEN_SEGMENTOS.includes(f.inst.segmento) ? f.inst.segmento : 'Otro') === s),
  })).filter((g) => g.filas.length)

  const lista = (fs: Fila[]) =>
    fs.length ? fs.map((f) => <FilaOportunidad key={f.opp.id} fila={f} modo={modo} />) : <p className="px-3.5 py-2.5 italic" style={{ color: LU.muted }}>Nada por acá 👌</p>

  return (
    <>
      <Desplegable id={`${modo}-todas`} titulo="🗂️ Todas las instituciones" n={filas.length} color={LU.none} abiertoInicial>
        {porSegmento.map((g, i) => (
          <div key={g.s}>
            <div className={`${i ? 'mt-3.5' : ''} mb-2 rounded-lg px-2.5 py-1.5 text-[12.5px] font-bold text-white`} style={{ background: LU.titulo }}>
              {g.s === 'Otro' ? 'SIN SEGMENTO' : `${g.s.toUpperCase()}S`} · {g.filas.length}
            </div>
            {g.filas.map((f) => (
              <FilaOportunidad key={f.opp.id} fila={f} modo={modo} />
            ))}
          </div>
        ))}
        {!filas.length && <p className="px-1 py-2.5 italic" style={{ color: LU.muted }}>Sin instituciones con estos filtros.</p>}
      </Desplegable>
      <Desplegable id={`${modo}-semana`} titulo="📆 Esta semana" n={sem.length} color={LU.brand2} abiertoInicial>
        {lista(sem)}
      </Desplegable>
      <Desplegable id={`${modo}-futuras`} titulo="⏭️ Futuras" n={fut.length} color={LU.none} abiertoInicial={false}>
        {lista(fut)}
      </Desplegable>
      <Desplegable id={`${modo}-vencidas`} titulo="🔴 Vencidas" n={venc.length} color={LU.venc} abiertoInicial={false}>
        {lista(venc)}
      </Desplegable>
    </>
  )
}

const selCls = 'max-w-full cursor-pointer rounded-lg border border-[#ccc] px-1.5 py-[3px] text-[11px] font-bold outline-none'

/**
 * Una venta: a la izquierda la institución (modalidad, objetivo 2027, etapa);
 * a la derecha toda su cadena de acciones y el «+ acción». Se le puede soltar
 * encima una acción de otra institución para moverla acá.
 */
function FilaOportunidad({ fila, modo }: { fila: Fila; modo: Modo }) {
  const crm = useCrm()
  const { opp, inst, cadena } = fila
  const [sobre, setSobre] = useState(false)
  const mod = modalidadColor(opp.modalidad)

  // La cadena arranca mostrando lo último (lo pendiente); lo viejo queda a la izquierda.
  const tira = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (tira.current) tira.current.scrollLeft = tira.current.scrollWidth
  }, [cadena.length])

  const acepta = (e: DragEvent) => e.dataTransfer.types.includes(ARRASTRE_ACCION)
  const cabecera: CSSProperties = sobre
    ? { borderColor: LU.brand, background: '#EAF2FC', outline: `2px dashed ${LU.accent}`, outlineOffset: 2, color: LU.titulo }
    : { borderColor: LU.linea, color: LU.titulo }

  return (
    <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-stretch">
      <div
        onDragOver={(e) => {
          if (!acepta(e)) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setSobre(true)
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSobre(false)
        }}
        onDrop={(e) => {
          setSobre(false)
          const a = crm.acciones.find((x) => x.id === e.dataTransfer.getData(ARRASTRE_ACCION))
          if (!a) return
          e.preventDefault()
          crm.moverAccion(a, opp)
        }}
        className="rounded-lg border bg-white px-2.5 py-2 text-[12.5px] sm:w-[175px] sm:shrink-0"
        style={cabecera}
      >
        <div className="flex items-start gap-1">
          <button onClick={() => crm.abrirFicha(inst.id)} className="min-w-0 flex-1 text-left leading-snug font-bold hover:underline" title="Abrir la ficha">
            {inst.especial && '⭐ '}
            {inst.nombre}
          </button>
          <button
            onClick={() => crm.guardarOportunidad({ ...opp, objetivo2027: !opp.objetivo2027 })}
            title={opp.objetivo2027 ? 'Objetivo 2027 (tocá para quitarlo)' : 'Marcar como objetivo 2027'}
            className="shrink-0 text-[13px] leading-snug select-none"
          >
            {opp.objetivo2027 ? '🎯' : '◎'}
          </button>
        </div>
        <select
          value={opp.modalidad}
          onChange={(e) => crm.guardarOportunidad({ ...opp, modalidad: e.target.value })}
          title="Modalidad de esta venta"
          className={`${selCls} mt-1`}
          style={{ color: mod.texto, background: mod.fondo }}
        >
          <option value="">— sin modalidad</option>
          <option>Curricular</option>
          <option>Extracurricular</option>
        </select>
        <div className="mt-1">
          {modo === 'posventa' ? (
            <select
              value={opp.estadoPosventa}
              onChange={(e) => crm.guardarOportunidad({ ...opp, estadoPosventa: e.target.value })}
              className={selCls}
              style={{ background: '#EAF0FA', color: LU.txt }}
            >
              <option value="">🩺 sin clasificar</option>
              {!ESTADOS_POSVENTA.some((x) => x === opp.estadoPosventa) && opp.estadoPosventa && <option>{opp.estadoPosventa}</option>}
              {ESTADOS_POSVENTA.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          ) : (
            <select
              value={opp.etapa}
              onChange={(e) => crm.guardarOportunidad({ ...opp, etapa: e.target.value as Etapa })}
              title={tipoDe(opp.etapa) === 'perdida' ? 'Venta perdida' : 'Etapa'}
              className={selCls}
              style={{ background: etapaColor(opp.etapa), color: LU.txt }}
            >
              {ETAPAS.map((e) => (
                <option key={e}>{e}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div ref={tira} className="flex min-w-0 flex-1 items-stretch gap-2 overflow-x-auto pb-1">
        {cadena.map((a) => (
          <BloqueAccion key={a.id} accion={a} />
        ))}
        <button
          onClick={() => crm.abrirAccion({ nueva: true, institucionId: opp.institucionId, oportunidadId: opp.id })}
          className="shrink-0 self-center rounded-lg border border-dashed border-[#cbd5e1] bg-white px-2.5 py-1.5 font-bold whitespace-nowrap hover:border-[#5DADEA]"
          style={{ color: LU.accent }}
        >
          + acción
        </button>
      </div>
    </div>
  )
}

/* ---------------- Directorio de instituciones (las fichas) ---------------- */

function Directorio() {
  const crm = useCrm()
  const [segmento, setSegmento] = useState('')
  const [busca, setBusca] = useState('')
  const q = normalizar(busca.trim())
  const lista = useMemo(
    () =>
      crm.instituciones
        .filter((i) => (!q || normalizar(i.nombre).includes(q)) && (!segmento || i.segmento === segmento))
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
    [crm.instituciones, crm.oportunidades, crm.acciones, q, segmento],
  )

  return (
    <>
      <h2 className="mt-[18px] mb-2 rounded-[2px] border-l-4 pl-[9px] text-sm font-bold" style={{ borderColor: LU.brand2, color: LU.titulo }}>
        🏫 Instituciones <span className="text-xs font-semibold" style={{ color: LU.muted }}>todas las fichas · {lista.length}</span>
      </h2>
      <div className="mt-1.5 mb-3 flex flex-wrap items-center gap-3.5">
        <div className="flex flex-wrap gap-1.5">
          {SEGMENTOS_FILTRO.map(([id, label]) => (
            <Chip key={id} on={segmento === id} onClick={() => setSegmento(id)}>
              {label}
            </Chip>
          ))}
        </div>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar institución…"
          className="min-w-[170px] flex-1 rounded-[7px] border border-[#ccc] bg-white px-2.5 py-2 text-[13px] outline-none focus:border-[#5DADEA] sm:flex-none"
          style={{ color: LU.txt }}
        />
        <Boton fondo={LU.grad} onClick={crm.abrirNuevaInstitucion}>
          ➕ Nueva institución
        </Boton>
      </div>
      <div className="overflow-hidden rounded-[14px] border bg-white" style={{ borderColor: LU.linea }}>
        {lista.map(({ i, venta, posventa, ultima }) => (
          <button
            key={i.id}
            onClick={() => crm.abrirFicha(i.id)}
            className="flex w-full items-center gap-3 border-b border-[#f0f2f5] px-4 py-2.5 text-left transition last:border-0 hover:bg-[#F7FAFE]"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold" style={{ color: LU.titulo }}>
                {i.especial && '⭐ '}
                {i.nombre}
              </span>
              <span className="text-[11px]" style={{ color: LU.muted }}>
                {[i.segmento, i.ciudad].filter(Boolean).join(' · ')}
              </span>
            </span>
            {venta > 0 && <Etiqueta fondo="#EAF2FB" texto="#2E6FB0">venta {venta}</Etiqueta>}
            {posventa > 0 && <Etiqueta fondo="#EAF6EC" texto="#2E7D32">cliente</Etiqueta>}
            {i.enLnr && <Etiqueta fondo="#F3EAFB" texto="#7B3FB0">LNR</Etiqueta>}
            <span className="hidden w-24 shrink-0 text-right text-[11px] sm:block" style={{ color: LU.muted }}>
              {ultima ? `últ. ${format(parseISO(ultima), 'd MMM', { locale: es })}` : 'sin gestiones'}
            </span>
          </button>
        ))}
        {!lista.length && <p className="py-8 text-center italic" style={{ color: LU.muted }}>Ninguna institución coincide.</p>}
      </div>
    </>
  )
}

function Etiqueta({ fondo, texto, children }: { fondo: string; texto: string; children: ReactNode }) {
  return (
    <span className="shrink-0 rounded-[10px] px-2 py-px text-[10.5px] font-bold" style={{ background: fondo, color: texto }}>
      {children}
    </span>
  )
}
