import { useState } from 'react'
import { Building2, CheckCircle2 } from 'lucide-react'
import { todayKey, uid } from '../lib/utils'
import { useApp } from '../state/AppContext'
import Modal, { Field, FieldDiv, inputCls } from '../components/Modal'
import { PeopleSelect } from '../components/Selectores'
import { useCrm, type NuevaAccion } from './contexto'
import { tipoDe } from './reglas'
import { ESTADOS_ACCION, TIPOS_ACCION, type CrmAccion, type EstadoAccion } from './tipos'

const ESTADO_LABEL: Record<EstadoAccion, string> = {
  PENDIENTE: 'Pendiente',
  'EN PROCESO': 'En proceso',
  CONCRETADO: 'Hecha',
}

/** Crear o editar una acción del CRM. Se abre desde el pipeline, la ficha o la Agenda. */
export default function AccionEditor({ inicial, onClose }: { inicial: CrmAccion | NuevaAccion; onClose: () => void }) {
  const { currentUser } = useApp()
  const { instituciones, oportunidades, acciones, guardarAccion, borrarAccion, abrirFicha } = useCrm()
  const esNueva = 'nueva' in inicial
  const institucion = instituciones.find((i) => i.id === inicial.institucionId)
  const oppsInst = oportunidades.filter((o) => o.institucionId === inicial.institucionId)

  const [draft, setDraft] = useState<CrmAccion>(() =>
    esNueva
      ? {
          id: uid(),
          institucionId: inicial.institucionId,
          oportunidadId: inicial.esLnr ? null : (inicial.oportunidadId ?? oppsInst.find((o) => tipoDe(o.etapa) !== 'perdida')?.id ?? null),
          esLnr: !!inicial.esLnr,
          orden: Math.max(0, ...acciones.filter((a) => a.institucionId === inicial.institucionId).map((a) => a.orden)) + 1,
          accion: '',
          fecha: inicial.fecha !== undefined ? inicial.fecha : todayKey(),
          responsableIds: currentUser ? [currentUser.id] : [],
          estado: 'PENDIENTE',
          tipo: inicial.esLnr ? 'lnr' : 'llamada',
          horas: null,
          link: '',
          createdAt: new Date().toISOString(),
        }
      : { ...inicial },
  )
  const set = <K extends keyof CrmAccion>(k: K, v: CrmAccion[K]) => setDraft((d) => ({ ...d, [k]: v }))

  const vinculo = draft.esLnr ? 'lnr' : (draft.oportunidadId ?? '')
  const cambiarVinculo = (v: string) =>
    setDraft((d) => (v === 'lnr' ? { ...d, esLnr: true, oportunidadId: null } : { ...d, esLnr: false, oportunidadId: v || null }))

  const guardar = () => {
    guardarAccion({ ...draft, accion: draft.accion.trim(), link: draft.link.trim() })
    onClose()
  }

  const borrar = () => {
    if (!esNueva && confirm(`¿Borrar la acción «${draft.accion}»? Queda registrado en la bitácora.`)) {
      borrarAccion(inicial as CrmAccion)
      onClose()
    }
  }

  return (
    <Modal title={esNueva ? 'Nueva acción' : 'Acción del CRM'} onClose={onClose}>
      <div className="space-y-4">
        {institucion && (
          <button
            type="button"
            onClick={() => {
              abrirFicha(institucion.id)
              onClose()
            }}
            className="flex w-full items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-left text-sm font-extrabold text-slate-700 hover:bg-blue-50 hover:text-blue-700"
          >
            <Building2 size={15} className="shrink-0 text-slate-400" />
            <span className="min-w-0 flex-1 truncate">{institucion.nombre}</span>
            <span className="shrink-0 text-[10px] font-extrabold text-blue-600">ver ficha</span>
          </button>
        )}

        <Field label="Acción">
          <textarea
            autoFocus={esNueva}
            rows={2}
            value={draft.accion}
            onChange={(e) => set('accion', e.target.value)}
            placeholder="¿Qué hay que hacer? Empezá con un verbo: Llamar, Enviar, Visitar…"
            className={`${inputCls} resize-none font-semibold`}
          />
        </Field>

        <Field label="Es parte de">
          <select value={vinculo} onChange={(e) => cambiarVinculo(e.target.value)} className={inputCls}>
            {oppsInst.map((o) => (
              <option key={o.id} value={o.id}>
                {tipoDe(o.etapa) === 'posventa' ? 'Posventa' : tipoDe(o.etapa) === 'perdida' ? 'Venta perdida' : 'Venta'}
                {o.modalidad ? ` · ${o.modalidad}` : ''} ({o.etapa})
              </option>
            ))}
            <option value="lnr">Invitación a la Liga (LNR)</option>
            <option value="">Sin venta asociada</option>
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Fecha">
            <input
              type="date"
              value={draft.fecha ?? ''}
              onChange={(e) => set('fecha', e.target.value || null)}
              className={inputCls}
            />
          </Field>
          <Field label="Tipo">
            <select value={draft.tipo} onChange={(e) => set('tipo', e.target.value)} className={inputCls}>
              {!TIPOS_ACCION.some((t) => t.id === draft.tipo) && <option value={draft.tipo}>{draft.tipo || '—'}</option>}
              {TIPOS_ACCION.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <FieldDiv label="Estado">
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
            {ESTADOS_ACCION.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => set('estado', e)}
                className={`flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-extrabold transition ${
                  draft.estado === e
                    ? e === 'CONCRETADO'
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {e === 'CONCRETADO' && <CheckCircle2 size={13} />}
                {ESTADO_LABEL[e]}
              </button>
            ))}
          </div>
        </FieldDiv>

        <FieldDiv label="Responsables">
          <PeopleSelect value={draft.responsableIds} onChange={(ids) => set('responsableIds', ids)} />
        </FieldDiv>

        <Field label="Enlace (opcional)">
          <input
            value={draft.link}
            onChange={(e) => set('link', e.target.value)}
            placeholder="https://… (propuesta, presupuesto, mail…)"
            className={inputCls}
          />
        </Field>

        <div className="flex items-center justify-between pt-1">
          {!esNueva ? (
            <button onClick={borrar} className="rounded-lg px-3 py-2 text-sm font-bold text-red-500 hover:bg-red-50">
              Borrar
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100">
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={!draft.accion.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-700 disabled:opacity-40"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
