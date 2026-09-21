import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ExternalLink, Mail, Pencil, Phone, Plus, Star, Trash2 } from 'lucide-react'
import { uid } from '../lib/utils'
import { useApp } from '../state/AppContext'
import Modal, { Field, inputCls } from '../components/Modal'
import { AvatarStack } from '../components/Avatar'
import { useCrm } from './contexto'
import ChipAccion from './ChipAccion'
import { COLOR_SEMAFORO, cadenaDe, etiquetaTipoAccion, semaforoDe, tipoDe } from './reglas'
import { ESTADOS_POSVENTA, ETAPAS, MODALIDADES, SEGMENTOS, type CrmAccion, type CrmContacto, type CrmInstitucion, type CrmOportunidad } from './tipos'

type Pestana = 'ventas' | 'contactos' | 'historial' | 'bitacora'

const TIPO_BADGE = {
  venta: 'bg-blue-100 text-blue-700',
  posventa: 'bg-emerald-100 text-emerald-700',
  perdida: 'bg-slate-200 text-slate-500',
} as const

/** Ficha de una institución: ventas, contactos, historial de acciones y bitácora. */
export default function Ficha({ institucionId, onClose }: { institucionId: string; onClose: () => void }) {
  const { users } = useApp()
  const crm = useCrm()
  const inst = crm.instituciones.find((i) => i.id === institucionId)
  const [pestana, setPestana] = useState<Pestana>('ventas')
  const [editando, setEditando] = useState(false)

  if (!inst) return null
  const opps = crm.oportunidades
    .filter((o) => o.institucionId === inst.id)
    .sort((a, b) => ['venta', 'posventa', 'perdida'].indexOf(tipoDe(a.etapa)) - ['venta', 'posventa', 'perdida'].indexOf(tipoDe(b.etapa)))
  const acciones = crm.acciones.filter((a) => a.institucionId === inst.id)
  const lnr = acciones.filter((a) => a.esLnr).sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? ''))
  const sueltas = acciones.filter((a) => !a.esLnr && !opps.some((o) => o.id === a.oportunidadId))
  const contactos = crm.contactos.filter((c) => c.institucionId === inst.id)
  const bitacora = crm.bitacora.filter((b) => b.institucion === inst.nombre)

  const pestanas: { id: Pestana; label: string; n?: number }[] = [
    { id: 'ventas', label: 'Ventas', n: opps.length },
    { id: 'contactos', label: 'Contactos', n: contactos.length },
    { id: 'historial', label: 'Historial', n: acciones.length },
    { id: 'bitacora', label: 'Bitácora', n: bitacora.length },
  ]

  const hecha = (a: CrmAccion) => crm.marcarHecha(a)

  return (
    <Modal title={inst.nombre} onClose={onClose} width="max-w-4xl">
      {/* Encabezado */}
      <div className="-mt-1 mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-400">
          {[inst.segmento, inst.ciudad, inst.codigo].filter(Boolean).join(' · ')}
        </span>
        {inst.enLnr && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-extrabold text-violet-700">En la LNR</span>}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => crm.guardarInstitucion({ ...inst, especial: !inst.especial }, inst.especial ? 'Quitó el seguimiento especial' : 'Marcó seguimiento especial')}
            title="Seguimiento especial"
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-extrabold transition ${
              inst.especial ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-400 hover:text-slate-600'
            }`}
          >
            <Star size={13} className={inst.especial ? 'fill-amber-400' : ''} /> Especial
          </button>
          {inst.driveUrl && (
            <a
              href={inst.driveUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-extrabold text-slate-500 hover:bg-slate-50"
            >
              <ExternalLink size={13} /> Drive
            </a>
          )}
          <button
            onClick={() => setEditando((e) => !e)}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-extrabold text-slate-500 hover:bg-slate-50"
          >
            <Pencil size={13} /> Datos
          </button>
        </div>
      </div>

      {editando && <EditarInstitucion inst={inst} onListo={() => setEditando(false)} />}

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1">
        {pestanas.map((p) => (
          <button
            key={p.id}
            onClick={() => setPestana(p.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-extrabold transition ${
              pestana === p.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {p.label}
            {p.n !== undefined && <span className="rounded-full bg-slate-200/70 px-1.5 text-[10px] text-slate-500">{p.n}</span>}
          </button>
        ))}
      </div>

      {pestana === 'ventas' && (
        <div className="space-y-3">
          {opps.map((o) => (
            <TarjetaOportunidad key={o.id} opp={o} acciones={acciones} onHecha={hecha} />
          ))}
          <NuevaOportunidad institucionId={inst.id} />

          <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-extrabold tracking-wide text-violet-700 uppercase">Invitaciones a la Liga (LNR) · {lnr.length}</p>
              <button
                onClick={() => crm.abrirAccion({ nueva: true, institucionId: inst.id, esLnr: true })}
                className="flex items-center gap-1 text-xs font-extrabold text-violet-700 hover:text-violet-800"
              >
                <Plus size={13} /> Invitación
              </button>
            </div>
            <Cadena acciones={lnr} onHecha={hecha} vacio="Sin invitaciones registradas." />
          </div>

          {sueltas.length > 0 && (
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="mb-2 text-[11px] font-extrabold tracking-wide text-slate-400 uppercase">Acciones sin venta asociada</p>
              <Cadena acciones={sueltas} onHecha={hecha} vacio="" />
            </div>
          )}
        </div>
      )}

      {pestana === 'contactos' && <Contactos institucionId={inst.id} contactos={contactos} />}

      {pestana === 'historial' && (
        <div>
          <div className="mb-2 flex justify-end">
            <button
              onClick={() => crm.abrirAccion({ nueva: true, institucionId: inst.id })}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-blue-700"
            >
              <Plus size={14} /> Acción
            </button>
          </div>
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
            {[...acciones]
              .sort((a, b) => (b.fecha ?? '9999').localeCompare(a.fecha ?? '9999') || b.orden - a.orden)
              .map((a) => {
                const opp = crm.oportunidades.find((o) => o.id === a.oportunidadId)
                const etiqueta = a.esLnr ? 'LNR' : opp ? tipoDe(opp.etapa) : 'sin venta'
                return (
                  <button
                    key={a.id}
                    onClick={() => crm.abrirAccion(a)}
                    className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition hover:bg-slate-50"
                  >
                    <i className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: COLOR_SEMAFORO[semaforoDe(a)].punto }} />
                    <span className="w-16 shrink-0 text-[11px] font-extrabold text-slate-400">
                      {a.fecha ? format(parseISO(a.fecha), 'd MMM yy', { locale: es }) : 'sin fecha'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-700">{a.accion}</span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {etiquetaTipoAccion(a.tipo)} · <span className="uppercase">{etiqueta}</span>
                      </span>
                    </span>
                    <AvatarStack users={users.filter((u) => a.responsableIds.includes(u.id))} size={18} />
                  </button>
                )
              })}
            {!acciones.length && <p className="py-6 text-center text-sm font-semibold text-slate-300">Todavía no hay acciones.</p>}
          </div>
        </div>
      )}

      {pestana === 'bitacora' && (
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
          {bitacora.slice(0, 60).map((b) => (
            <div key={b.id} className="px-3 py-2">
              <p className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-400">
                <span>{format(parseISO(b.fechaHora), "d MMM yy · HH:mm", { locale: es })}</span>
                <span className="text-slate-500">{b.usuario}</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-extrabold text-slate-600">{b.cambio}</span>
                {b.ventaMod && <span className="uppercase">{b.ventaMod}</span>}
              </p>
              {b.accion && <p className="mt-0.5 text-sm font-semibold text-slate-700">{b.accion}</p>}
              {b.detalle && <p className="text-xs text-slate-500">{b.detalle}</p>}
            </div>
          ))}
          {!bitacora.length && <p className="py-6 text-center text-sm font-semibold text-slate-300">Sin cambios registrados.</p>}
        </div>
      )}
    </Modal>
  )
}

/** Una cadena de acciones, una al lado de la otra. */
export function Cadena({ acciones, onHecha, vacio }: { acciones: CrmAccion[]; onHecha: (a: CrmAccion) => void; vacio: string }) {
  const { abrirAccion } = useCrm()
  if (!acciones.length) return vacio ? <p className="text-xs font-semibold text-slate-300">{vacio}</p> : null
  return (
    <div className="flex gap-2 overflow-x-auto pt-2 pb-1">
      {acciones.map((a) => (
        <ChipAccion key={a.id} accion={a} onAbrir={() => abrirAccion(a)} onHecha={() => onHecha(a)} />
      ))}
    </div>
  )
}

function TarjetaOportunidad({ opp, acciones, onHecha }: { opp: CrmOportunidad; acciones: CrmAccion[]; onHecha: (a: CrmAccion) => void }) {
  const crm = useCrm()
  const tipo = tipoDe(opp.etapa)
  const cadena = cadenaDe(opp, acciones)
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${TIPO_BADGE[tipo]}`}>{tipo}</span>
        <select
          value={opp.modalidad}
          onChange={(e) => crm.guardarOportunidad({ ...opp, modalidad: e.target.value })}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-600"
        >
          {MODALIDADES.map((m) => (
            <option key={m} value={m}>
              {m || 'Modalidad sin definir'}
            </option>
          ))}
        </select>
        <select
          value={opp.etapa}
          onChange={(e) => crm.guardarOportunidad({ ...opp, etapa: e.target.value as CrmOportunidad['etapa'] })}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-extrabold text-slate-700"
        >
          {ETAPAS.map((e) => (
            <option key={e}>{e}</option>
          ))}
        </select>
        {tipo === 'posventa' && (
          <select
            value={opp.estadoPosventa}
            onChange={(e) => crm.guardarOportunidad({ ...opp, estadoPosventa: e.target.value })}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700"
          >
            <option value="">Estado posventa…</option>
            {ESTADOS_POSVENTA.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        )}
        <label className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
          <input
            type="checkbox"
            checked={opp.objetivo2027}
            onChange={(e) => crm.guardarOportunidad({ ...opp, objetivo2027: e.target.checked })}
            className="size-3.5 accent-blue-600"
          />
          Objetivo 2027
        </label>
        <button
          onClick={() => crm.abrirAccion({ nueva: true, institucionId: opp.institucionId, oportunidadId: opp.id })}
          className="ml-auto flex items-center gap-1 text-xs font-extrabold text-blue-600 hover:text-blue-700"
        >
          <Plus size={13} /> Acción
        </button>
      </div>
      <Cadena acciones={cadena} onHecha={onHecha} vacio="Sin acciones todavía: ¿cuál es el primer paso?" />
    </div>
  )
}

function NuevaOportunidad({ institucionId }: { institucionId: string }) {
  const { currentUser } = useApp()
  const { guardarOportunidad } = useCrm()
  const [abierta, setAbierta] = useState(false)
  const [modalidad, setModalidad] = useState('')
  if (!abierta)
    return (
      <button onClick={() => setAbierta(true)} className="flex items-center gap-1 text-xs font-extrabold text-blue-600 hover:text-blue-700">
        <Plus size={13} /> Nueva oportunidad
      </button>
    )
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-blue-200 p-3">
      <span className="text-xs font-extrabold text-slate-500">Nueva oportunidad</span>
      <select value={modalidad} onChange={(e) => setModalidad(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold">
        {MODALIDADES.map((m) => (
          <option key={m} value={m}>
            {m || 'Modalidad sin definir'}
          </option>
        ))}
      </select>
      <button
        onClick={() => {
          guardarOportunidad({
            id: uid(), codigo: null, institucionId, modalidad, producto: '', etapa: 'CONTACTO INICIAL', valor: null,
            estadoPosventa: '', objetivo2027: false, responsableIds: currentUser ? [currentUser.id] : [],
            createdAt: new Date().toISOString(),
          })
          setAbierta(false)
        }}
        className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-extrabold text-white hover:bg-blue-700"
      >
        Crear
      </button>
      <button onClick={() => setAbierta(false)} className="text-xs font-bold text-slate-400">
        Cancelar
      </button>
    </div>
  )
}

function Contactos({ institucionId, contactos }: { institucionId: string; contactos: CrmContacto[] }) {
  const { guardarContacto, borrarContacto } = useCrm()
  const vacio = (): CrmContacto => ({ id: uid(), institucionId, nombre: '', rol: '', telefono: '', mail: '', notas: '' })
  const [nuevo, setNuevo] = useState<CrmContacto>(vacio)
  const set = (k: keyof CrmContacto, v: string) => setNuevo((c) => ({ ...c, [k]: v }))
  const tel = (t: string) => 'tel:' + t.replace(/[^\d+]/g, '')

  return (
    <div className="space-y-3">
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
        {contactos.map((c) => (
          <div key={c.id} className="group flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold text-slate-700">{c.nombre || '—'}</span>
              <span className="text-[11px] font-semibold text-slate-400">{c.rol}</span>
            </span>
            {c.telefono && (
              <a href={tel(c.telefono)} className="flex items-center gap-1 text-xs font-bold text-blue-600">
                <Phone size={12} /> {c.telefono}
              </a>
            )}
            {c.mail && (
              <a href={`mailto:${c.mail}`} className="flex items-center gap-1 text-xs font-bold text-blue-600">
                <Mail size={12} /> {c.mail}
              </a>
            )}
            <button
              onClick={() => confirm(`¿Borrar el contacto ${c.nombre}?`) && borrarContacto(c)}
              className="rounded-lg p-1 text-slate-300 hover:bg-red-50 hover:text-red-500 md:opacity-0 md:group-hover:opacity-100"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        {!contactos.length && <p className="py-5 text-center text-sm font-semibold text-slate-300">Sin contactos cargados.</p>}
      </div>
      <div className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
        <input value={nuevo.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="Nombre" className={inputCls} />
        <input value={nuevo.rol} onChange={(e) => set('rol', e.target.value)} placeholder="Rol (Dirección, Administración…)" className={inputCls} />
        <input value={nuevo.telefono} onChange={(e) => set('telefono', e.target.value)} placeholder="Teléfono" className={inputCls} />
        <input value={nuevo.mail} onChange={(e) => set('mail', e.target.value)} placeholder="Mail" className={inputCls} />
        <button
          disabled={!nuevo.nombre.trim()}
          onClick={() => {
            guardarContacto({ ...nuevo, nombre: nuevo.nombre.trim() })
            setNuevo(vacio())
          }}
          className="flex items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-blue-700 disabled:opacity-40 sm:col-span-2"
        >
          <Plus size={14} /> Agregar contacto
        </button>
      </div>
    </div>
  )
}

function EditarInstitucion({ inst, onListo }: { inst: CrmInstitucion; onListo: () => void }) {
  const { guardarInstitucion } = useCrm()
  const [d, setD] = useState(inst)
  const set = <K extends keyof CrmInstitucion>(k: K, v: CrmInstitucion[K]) => setD((x) => ({ ...x, [k]: v }))
  return (
    <div className="mb-4 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
      <Field label="Nombre">
        <input value={d.nombre} onChange={(e) => set('nombre', e.target.value)} className={inputCls} />
      </Field>
      <Field label="Segmento">
        <select value={d.segmento} onChange={(e) => set('segmento', e.target.value)} className={inputCls}>
          {SEGMENTOS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </Field>
      <Field label="Ciudad">
        <input value={d.ciudad} onChange={(e) => set('ciudad', e.target.value)} className={inputCls} />
      </Field>
      <Field label="Dirección">
        <input value={d.direccion} onChange={(e) => set('direccion', e.target.value)} className={inputCls} />
      </Field>
      <Field label="Carpeta de Drive">
        <input value={d.driveUrl} onChange={(e) => set('driveUrl', e.target.value)} placeholder="https://drive.google.com/…" className={inputCls} />
      </Field>
      <label className="flex items-center gap-2 self-end pb-2 text-sm font-bold text-slate-600">
        <input type="checkbox" checked={d.enLnr} onChange={(e) => set('enLnr', e.target.checked)} className="size-4 accent-violet-600" />
        Participa en la LNR
      </label>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button onClick={onListo} className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100">
          Cancelar
        </button>
        <button
          onClick={() => {
            guardarInstitucion({ ...d, nombre: d.nombre.trim() || inst.nombre })
            onListo()
          }}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-blue-700"
        >
          Guardar datos
        </button>
      </div>
    </div>
  )
}
