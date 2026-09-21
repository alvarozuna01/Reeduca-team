import { useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabaseClient'
import { uid } from '../lib/utils'
import { useApp } from '../state/AppContext'
import { CrmContexto, type CrmCtx, type NuevaAccion } from './contexto'
import { crmApi, CRM_KEY, TABLAS_CRM } from './crmApi'
import { CRM_VACIO, type CrmAccion, type CrmBitacora, type CrmDB, type CrmOportunidad } from './tipos'
import { comoHecha, tipoDe } from './reglas'
import AccionEditor from './AccionEditor'
import Ficha from './Ficha'
import NuevaInstitucion from './NuevaInstitucion'

const reportar = (e: unknown) => console.error('[ReEduca · CRM] Error guardando:', e)

function upsertEn<T extends { id: string }>(lista: T[], x: T): T[] {
  return lista.some((y) => y.id === x.id) ? lista.map((y) => (y.id === x.id ? x : y)) : [...lista, x]
}

export function CrmProvider({ children }: { children: ReactNode }) {
  const { currentUser, users, demo } = useApp()
  const [db, setDb] = useState<CrmDB>(CRM_VACIO)
  const [cargando, setCargando] = useState(true)
  const [accionAbierta, setAccionAbierta] = useState<CrmAccion | NuevaAccion | null>(null)
  const [fichaAbierta, setFichaAbierta] = useState<string | null>(null)
  const [nuevaInst, setNuevaInst] = useState(false)

  const yo = currentUser?.id
  const tieneAcceso = !!yo && db.accesos.some((a) => a.userId === yo)

  // Carga: primero la lista de acceso; el resto solo si hay acceso.
  useEffect(() => {
    if (!yo) return
    let vivo = true
    crmApi
      .cargarAccesos()
      .then(async (accesos) => {
        const conAcceso = accesos.some((a) => a.userId === yo)
        const todo = conAcceso ? await crmApi.cargar() : { ...CRM_VACIO, accesos }
        if (vivo) setDb(todo)
      })
      .catch(reportar)
      .finally(() => vivo && setCargando(false))
    return () => {
      vivo = false
    }
  }, [yo])

  // Si alguien me da acceso mientras estoy adentro, se cargan los datos solos.
  const [cargadoCompleto, setCargadoCompleto] = useState(false)
  useEffect(() => {
    if (!tieneAcceso || cargadoCompleto) return
    crmApi
      .cargar()
      .then((todo) => {
        setDb(todo)
        setCargadoCompleto(true)
      })
      .catch(reportar)
  }, [tieneAcceso, cargadoCompleto])

  // Modo demo: si otra pestaña cambia el CRM, esta se entera.
  useEffect(() => {
    if (!demo) return
    const onStorage = (e: StorageEvent) => {
      if (e.key === CRM_KEY) crmApi.cargar().then(setDb)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [demo])

  // Tiempo real: lo que cambia otra persona aparece al instante.
  useEffect(() => {
    if (demo || !yo || !supabase) return
    const sb = supabase
    const canal = sb.channel('crm-en-vivo')
    for (const { tabla, clave, map } of TABLAS_CRM) {
      canal.on('postgres_changes', { event: '*', schema: 'public', table: tabla }, (payload) => {
        setDb((d) => {
          if (clave === 'accesos') {
            const viejo = (payload.old as { user_id?: string }).user_id
            if (payload.eventType === 'DELETE') return { ...d, accesos: d.accesos.filter((a) => a.userId !== viejo) }
            const nuevo = map(payload.new) as CrmDB['accesos'][number]
            return { ...d, accesos: [...d.accesos.filter((a) => a.userId !== nuevo.userId), nuevo] }
          }
          const lista = d[clave] as { id: string }[]
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id?: string }).id
            return id ? { ...d, [clave]: lista.filter((x) => x.id !== id) } : d
          }
          return { ...d, [clave]: upsertEn(lista, map(payload.new) as { id: string }) }
        })
      })
    }
    canal.subscribe()
    return () => {
      sb.removeChannel(canal)
    }
  }, [demo, yo])

  /* ---------- Bitácora ---------- */
  // Nombres de instituciones recién creadas: si en el mismo clic se crea la
  // institución y su primera oportunidad, la segunda todavía no la ve en el estado.
  // Lo mismo con una oportunidad nueva y su primera acción.
  const recientes = useRef<Record<string, string>>({})
  const oppsRecientes = useRef<Record<string, CrmOportunidad>>({})
  const nombreInst = (id: string) => db.instituciones.find((i) => i.id === id)?.nombre ?? recientes.current[id] ?? ''
  const ventaMod = (a: Pick<CrmAccion, 'esLnr' | 'oportunidadId'>) => {
    if (a.esLnr) return 'LNR'
    const o = db.oportunidades.find((x) => x.id === a.oportunidadId) ?? (a.oportunidadId ? oppsRecientes.current[a.oportunidadId] : undefined)
    return o ? `${tipoDe(o.etapa)}${o.modalidad ? ` · ${o.modalidad}` : ''}` : ''
  }
  const anotar = (b: Omit<CrmBitacora, 'id' | 'fechaHora' | 'usuarioId' | 'usuario'>) => {
    const fila: CrmBitacora = {
      ...b,
      id: uid(),
      fechaHora: new Date().toISOString(),
      usuarioId: yo ?? null,
      usuario: currentUser?.name ?? '',
    }
    setDb((d) => ({ ...d, bitacora: [fila, ...d.bitacora] }))
    crmApi.anotarBitacora(fila).catch(reportar)
  }
  const nombres = (ids: string[]) => ids.map((id) => users.find((u) => u.id === id)?.name ?? '?').join(', ') || '—'

  /** Resume en una línea qué cambió en una acción. */
  const diferencias = (antes: CrmAccion, despues: CrmAccion) => {
    const cambios: string[] = []
    if (antes.accion !== despues.accion) cambios.push(`texto: «${antes.accion}» → «${despues.accion}»`)
    if (antes.fecha !== despues.fecha) cambios.push(`fecha: ${antes.fecha ?? 'sin fecha'} → ${despues.fecha ?? 'sin fecha'}`)
    if (antes.estado !== despues.estado) cambios.push(`estado: ${antes.estado} → ${despues.estado}`)
    if (antes.tipo !== despues.tipo) cambios.push(`tipo: ${antes.tipo || '—'} → ${despues.tipo || '—'}`)
    if (antes.responsableIds.join() !== despues.responsableIds.join())
      cambios.push(`responsables: ${nombres(antes.responsableIds)} → ${nombres(despues.responsableIds)}`)
    if (antes.institucionId !== despues.institucionId || antes.oportunidadId !== despues.oportunidadId || antes.esLnr !== despues.esLnr)
      cambios.push(
        `desde ${nombreInst(antes.institucionId)} (${ventaMod(antes) || 'sin venta'}) → ${nombreInst(despues.institucionId)} (${ventaMod(despues) || 'sin venta'})`,
      )
    return cambios
  }

  function guardarAccion(a: CrmAccion) {
    const antes = db.acciones.find((x) => x.id === a.id)
    setDb((d) => ({ ...d, acciones: upsertEn(d.acciones, a) }))
    crmApi.guardarAccion(a).catch(reportar)
    if (!antes) {
      anotar({ cambio: 'Creó', institucion: nombreInst(a.institucionId), ventaMod: ventaMod(a), accion: a.accion, detalle: `Acción nueva${a.fecha ? ` para el ${a.fecha}` : ''} (${nombres(a.responsableIds)})` })
      return
    }
    const cambios = diferencias(antes, a)
    if (!cambios.length) return
    const hecha = antes.estado !== 'CONCRETADO' && a.estado === 'CONCRETADO'
    const movida = antes.institucionId !== a.institucionId || antes.oportunidadId !== a.oportunidadId || antes.esLnr !== a.esLnr
    anotar({
      cambio: movida ? 'Movió' : hecha ? 'Hecha' : 'Editó',
      institucion: nombreInst(a.institucionId),
      ventaMod: ventaMod(a),
      accion: a.accion,
      detalle: cambios.join(' · '),
    })
  }

  const value: CrmCtx = {
    ...db,
    cargando,
    tieneAcceso,

    guardarInstitucion(i, detalle) {
      const antes = db.instituciones.find((x) => x.id === i.id)
      recientes.current[i.id] = i.nombre
      setDb((d) => ({ ...d, instituciones: upsertEn(d.instituciones, i) }))
      crmApi.guardarInstitucion(i).catch(reportar)
      anotar({
        cambio: antes ? 'Editó institución' : 'Creó institución',
        institucion: i.nombre,
        ventaMod: '',
        accion: '',
        detalle: detalle ?? (antes ? 'Datos de la institución' : [i.segmento, i.ciudad].filter(Boolean).join(' · ')),
      })
    },

    guardarOportunidad(o, detalle) {
      const antes = db.oportunidades.find((x) => x.id === o.id)
      oppsRecientes.current[o.id] = o
      setDb((d) => ({ ...d, oportunidades: upsertEn(d.oportunidades, o) }))
      crmApi.guardarOportunidad(o).catch(reportar)
      const cambios: string[] = []
      if (antes && antes.etapa !== o.etapa) cambios.push(`etapa: ${antes.etapa} → ${o.etapa}`)
      if (antes && antes.modalidad !== o.modalidad) cambios.push(`modalidad: ${antes.modalidad || '—'} → ${o.modalidad || '—'}`)
      if (antes && antes.estadoPosventa !== o.estadoPosventa)
        cambios.push(`posventa: ${antes.estadoPosventa || '—'} → ${o.estadoPosventa || '—'}`)
      if (antes && antes.objetivo2027 !== o.objetivo2027) cambios.push(o.objetivo2027 ? 'marcada objetivo 2027' : 'sin objetivo 2027')
      if (antes && !cambios.length && !detalle) return
      anotar({
        cambio: !antes ? 'Creó oportunidad' : antes.etapa !== o.etapa ? 'Etapa' : 'Editó oportunidad',
        institucion: nombreInst(o.institucionId),
        ventaMod: `${tipoDe(o.etapa)}${o.modalidad ? ` · ${o.modalidad}` : ''}`,
        accion: '',
        detalle: detalle ?? (antes ? cambios.join(' · ') : `Nueva oportunidad (${o.etapa})`),
      })
    },

    guardarContacto(c) {
      setDb((d) => ({ ...d, contactos: upsertEn(d.contactos, c) }))
      crmApi.guardarContacto(c).catch(reportar)
    },

    borrarContacto(c) {
      setDb((d) => ({ ...d, contactos: d.contactos.filter((x) => x.id !== c.id) }))
      crmApi.borrarContacto(c.id).catch(reportar)
      anotar({ cambio: 'Borró contacto', institucion: nombreInst(c.institucionId), ventaMod: '', accion: '', detalle: `${c.nombre} (${c.rol || 'sin rol'})` })
    },

    guardarAccion,

    marcarHecha(a) {
      guardarAccion(comoHecha(a))
    },

    moverAccion(a, destino) {
      if (a.oportunidadId === destino.id && !a.esLnr) return
      // Al cambiar de institución, la acción va al final de la cadena de la nueva.
      const orden =
        a.institucionId === destino.institucionId
          ? a.orden
          : Math.max(0, ...db.acciones.filter((x) => x.institucionId === destino.institucionId).map((x) => x.orden)) + 1
      guardarAccion({ ...a, institucionId: destino.institucionId, oportunidadId: destino.id, esLnr: false, orden })
    },

    borrarAccion(a) {
      setDb((d) => ({ ...d, acciones: d.acciones.filter((x) => x.id !== a.id) }))
      crmApi.borrarAccion(a.id).catch(reportar)
      anotar({
        cambio: 'Borró',
        institucion: nombreInst(a.institucionId),
        ventaMod: ventaMod(a),
        accion: a.accion,
        detalle: `Acción eliminada (responsable: ${nombres(a.responsableIds)} · estado: ${a.estado}${a.fecha ? ` · fecha: ${a.fecha}` : ''})`,
      })
    },

    darAcceso(userId) {
      const fila = { userId, otorgadoPor: yo ?? null, createdAt: new Date().toISOString() }
      setDb((d) => ({ ...d, accesos: [...d.accesos.filter((a) => a.userId !== userId), fila] }))
      crmApi.darAcceso(fila).catch(reportar)
    },

    quitarAcceso(userId) {
      setDb((d) => ({ ...d, accesos: d.accesos.filter((a) => a.userId !== userId) }))
      crmApi.quitarAcceso(userId).catch(reportar)
    },

    abrirAccion: setAccionAbierta,
    abrirFicha: setFichaAbierta,
    abrirNuevaInstitucion: () => setNuevaInst(true),
  }

  return (
    <CrmContexto.Provider value={value}>
      {children}
      {tieneAcceso && fichaAbierta && <Ficha institucionId={fichaAbierta} onClose={() => setFichaAbierta(null)} />}
      {tieneAcceso && accionAbierta && <AccionEditor inicial={accionAbierta} onClose={() => setAccionAbierta(null)} />}
      {tieneAcceso && nuevaInst && (
        <NuevaInstitucion
          onClose={() => setNuevaInst(false)}
          onCreada={(id) => {
            setNuevaInst(false)
            setFichaAbierta(id)
          }}
        />
      )}
    </CrmContexto.Provider>
  )
}
