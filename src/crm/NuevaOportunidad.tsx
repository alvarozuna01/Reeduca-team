import { useState } from 'react'
import { uid } from '../lib/utils'
import { useApp } from '../state/AppContext'
import Modal, { Field, FieldDiv, inputCls } from '../components/Modal'
import { PeopleSelect } from '../components/Selectores'
import { useCrm } from './contexto'
import ElegirInstitucion from './ElegirInstitucion'
import { adivinarTipo, tipoDe } from './reglas'
import { ESTADOS_POSVENTA, ETAPAS_VENTA, type Etapa } from './tipos'

/** Alta de una oportunidad (venta en curso o cliente ganado), como en la planilla. */
export default function NuevaOportunidad({
  tipoInicial,
  objetivo2027Inicial,
  onClose,
}: {
  tipoInicial: 'venta' | 'posventa'
  objetivo2027Inicial: boolean
  onClose: () => void
}) {
  const { currentUser } = useApp()
  const crm = useCrm()
  const [institucionId, setInstitucionId] = useState<string | null>(null)
  const [tipo, setTipo] = useState(tipoInicial)
  const [modalidad, setModalidad] = useState('')
  const [producto, setProducto] = useState('')
  const [etapa, setEtapa] = useState<Etapa>('CONTACTO INICIAL')
  const [proxima, setProxima] = useState('')
  const [fecha, setFecha] = useState('')
  const [posventa, setPosventa] = useState('ACTIVO')
  const [responsables, setResponsables] = useState<string[]>(currentUser ? [currentUser.id] : [])
  const [objetivo2027, setObjetivo2027] = useState(objetivo2027Inicial)

  const inst = crm.instituciones.find((i) => i.id === institucionId)
  const parecida = crm.oportunidades.find(
    (o) => o.institucionId === institucionId && o.modalidad === modalidad && tipoDe(o.etapa) === tipo,
  )

  const crear = () => {
    if (!institucionId) return
    const ahora = new Date().toISOString()
    const opp = {
      id: uid(),
      codigo: null,
      institucionId,
      modalidad,
      producto: producto.trim(),
      etapa: tipo === 'posventa' ? ('CERRADO-GANADO' as const) : etapa,
      valor: null,
      estadoPosventa: tipo === 'posventa' ? posventa : '',
      objetivo2027,
      responsableIds: responsables,
      createdAt: ahora,
    }
    crm.guardarOportunidad(opp)
    if (tipo === 'venta' && proxima.trim()) {
      crm.guardarAccion({
        id: uid(),
        institucionId,
        oportunidadId: opp.id,
        esLnr: false,
        orden: Math.max(0, ...crm.acciones.filter((a) => a.institucionId === institucionId).map((a) => a.orden)) + 1,
        accion: proxima.trim(),
        fecha: fecha || null,
        responsableIds: responsables,
        estado: 'PENDIENTE',
        tipo: adivinarTipo(proxima),
        horas: null,
        link: '',
        createdAt: ahora,
      })
    }
    onClose()
  }

  return (
    <Modal title="➕ Nueva oportunidad" onClose={onClose}>
      <div className="space-y-4">
        <FieldDiv label="Institución *">
          <ElegirInstitucion value={institucionId} onChange={setInstitucionId} autoFocus />
        </FieldDiv>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Tipo">
            <select value={tipo} onChange={(e) => setTipo(e.target.value as 'venta' | 'posventa')} className={inputCls}>
              <option value="venta">Venta (en curso)</option>
              <option value="posventa">Posventa (cliente ganado)</option>
            </select>
          </Field>
          <Field label="Modalidad">
            <select value={modalidad} onChange={(e) => setModalidad(e.target.value)} className={inputCls}>
              <option value="">—</option>
              <option>Curricular</option>
              <option>Extracurricular</option>
            </select>
          </Field>
        </div>
        {inst && parecida && (
          <p className="-mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-700">
            «{inst.nombre}» ya tiene una {tipo}{modalidad ? ` ${modalidad}` : ' sin modalidad'} ({parecida.etapa}). Revisá que no sea la misma.
          </p>
        )}

        <Field label="Producto / Ciclos">
          <input value={producto} onChange={(e) => setProducto(e.target.value)} placeholder="Ej: VEX IQ, 2 ciclos…" className={inputCls} />
        </Field>

        {tipo === 'venta' ? (
          <>
            <Field label="Etapa">
              <select value={etapa} onChange={(e) => setEtapa(e.target.value as Etapa)} className={inputCls}>
                {ETAPAS_VENTA.map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Field label="Próxima acción">
                <input value={proxima} onChange={(e) => setProxima(e.target.value)} placeholder="Llamar a la directora…" className={inputCls} />
              </Field>
              <Field label="Fecha">
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
              </Field>
            </div>
          </>
        ) : (
          <Field label="Estado posventa">
            <select value={posventa} onChange={(e) => setPosventa(e.target.value)} className={inputCls}>
              {ESTADOS_POSVENTA.map((e) => (
                <option key={e}>{e}</option>
              ))}
            </select>
          </Field>
        )}

        <FieldDiv label="Responsable(s)">
          <PeopleSelect value={responsables} onChange={setResponsables} />
        </FieldDiv>

        <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold text-slate-600">
          <input type="checkbox" checked={objetivo2027} onChange={(e) => setObjetivo2027(e.target.checked)} className="size-4 accent-blue-600" />
          🎯 Es objetivo para 2027
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100">
            Cancelar
          </button>
          <button
            onClick={crear}
            disabled={!institucionId}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            Crear oportunidad
          </button>
        </div>
      </div>
    </Modal>
  )
}
