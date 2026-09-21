import { useState } from 'react'
import { uid } from '../lib/utils'
import { normalizar } from '../lib/menciones'
import { useApp } from '../state/AppContext'
import Modal, { Field, inputCls } from '../components/Modal'
import { useCrm } from './contexto'
import { MODALIDADES, SEGMENTOS } from './tipos'

/** Alta de una institución, con su primera oportunidad de venta. */
export default function NuevaInstitucion({ onClose, onCreada }: { onClose: () => void; onCreada: (id: string) => void }) {
  const { currentUser } = useApp()
  const { instituciones, guardarInstitucion, guardarOportunidad } = useCrm()
  const [nombre, setNombre] = useState('')
  const [segmento, setSegmento] = useState<string>('Colegio')
  const [ciudad, setCiudad] = useState('')
  const [conVenta, setConVenta] = useState(true)
  const [modalidad, setModalidad] = useState('')

  const repetida = instituciones.find((i) => normalizar(i.nombre.trim()) === normalizar(nombre.trim()))

  const crear = () => {
    const ahora = new Date().toISOString()
    const id = uid()
    guardarInstitucion({
      id, codigo: null, nombre: nombre.trim(), segmento, ciudad: ciudad.trim(), direccion: '', enLnr: false,
      eqIntelliq: null, eqV5: null, eqUniverso: null, activo: '', driveUrl: '', especial: false, createdAt: ahora,
    })
    if (conVenta) {
      guardarOportunidad({
        id: uid(), codigo: null, institucionId: id, modalidad, producto: '', etapa: 'CONTACTO INICIAL', valor: null,
        estadoPosventa: '', objetivo2027: false, responsableIds: currentUser ? [currentUser.id] : [], createdAt: ahora,
      })
    }
    onCreada(id)
  }

  return (
    <Modal title="Nueva institución" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Nombre">
          <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Colegio San José" className={`${inputCls} font-bold`} />
        </Field>
        {repetida && (
          <p className="-mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-700">
            Ya existe «{repetida.nombre}». Revisá que no sea la misma antes de crearla.
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Segmento">
            <select value={segmento} onChange={(e) => setSegmento(e.target.value)} className={inputCls}>
              {SEGMENTOS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Ciudad">
            <input value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="Asunción" className={inputCls} />
          </Field>
        </div>
        <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold text-slate-600">
          <input type="checkbox" checked={conVenta} onChange={(e) => setConVenta(e.target.checked)} className="size-4 accent-blue-600" />
          Crear también su oportunidad de venta (Contacto inicial)
        </label>
        {conVenta && (
          <Field label="Modalidad">
            <select value={modalidad} onChange={(e) => setModalidad(e.target.value)} className={inputCls}>
              {MODALIDADES.map((m) => (
                <option key={m} value={m}>
                  {m || 'Sin definir'}
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100">
            Cancelar
          </button>
          <button
            onClick={crear}
            disabled={!nombre.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            Crear
          </button>
        </div>
      </div>
    </Modal>
  )
}
