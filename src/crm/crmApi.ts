import { addDays } from 'date-fns'
import { isDemo } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import { toKey, uid } from '../lib/utils'
import type {
  CrmAcceso,
  CrmAccion,
  CrmBitacora,
  CrmContacto,
  CrmDB,
  CrmInstitucion,
  CrmOportunidad,
  Etapa,
  EstadoAccion,
} from './tipos'

/**
 * Capa de datos del CRM. Igual que el resto del sistema: Supabase en producción
 * y localStorage en el modo demo (con datos inventados; los reales nunca van en
 * el código que se publica).
 */
export interface CrmApi {
  /** Solo la lista de acceso (es chica y la necesita todo el mundo). */
  cargarAccesos(): Promise<CrmAcceso[]>
  /** Todo el CRM. Sin acceso, la base devuelve las tablas vacías. */
  cargar(): Promise<CrmDB>
  guardarInstitucion(i: CrmInstitucion): Promise<void>
  guardarOportunidad(o: CrmOportunidad): Promise<void>
  guardarContacto(c: CrmContacto): Promise<void>
  borrarContacto(id: string): Promise<void>
  guardarAccion(a: CrmAccion): Promise<void>
  borrarAccion(id: string): Promise<void>
  anotarBitacora(b: CrmBitacora): Promise<void>
  darAcceso(a: CrmAcceso): Promise<void>
  quitarAcceso(userId: string): Promise<void>
}

/* ---------- Supabase ---------- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fila = any

export const filaAInstitucion = (r: Fila): CrmInstitucion => ({
  id: r.id,
  codigo: r.codigo ?? null,
  nombre: r.nombre ?? '',
  segmento: r.segmento ?? '',
  ciudad: r.ciudad ?? '',
  direccion: r.direccion ?? '',
  enLnr: !!r.en_lnr,
  eqIntelliq: r.eq_intelliq ?? null,
  eqV5: r.eq_v5 ?? null,
  eqUniverso: r.eq_universo ?? null,
  activo: r.activo ?? '',
  driveUrl: r.drive_url ?? '',
  especial: !!r.especial,
  createdAt: r.created_at ?? new Date().toISOString(),
})
const institucionAFila = (i: CrmInstitucion) => ({
  id: i.id,
  codigo: i.codigo || null,
  nombre: i.nombre,
  segmento: i.segmento,
  ciudad: i.ciudad,
  direccion: i.direccion,
  en_lnr: i.enLnr,
  eq_intelliq: i.eqIntelliq,
  eq_v5: i.eqV5,
  eq_universo: i.eqUniverso,
  activo: i.activo,
  drive_url: i.driveUrl,
  especial: i.especial,
  created_at: i.createdAt,
})

export const filaAOportunidad = (r: Fila): CrmOportunidad => ({
  id: r.id,
  codigo: r.codigo ?? null,
  institucionId: r.institucion_id,
  modalidad: r.modalidad ?? '',
  producto: r.producto ?? '',
  etapa: (r.etapa ?? 'CONTACTO INICIAL') as Etapa,
  valor: r.valor ?? null,
  estadoPosventa: r.estado_posventa ?? '',
  objetivo2027: !!r.objetivo_2027,
  responsableIds: r.responsable_ids ?? [],
  createdAt: r.created_at ?? new Date().toISOString(),
})
const oportunidadAFila = (o: CrmOportunidad) => ({
  id: o.id,
  codigo: o.codigo || null,
  institucion_id: o.institucionId,
  modalidad: o.modalidad,
  producto: o.producto,
  etapa: o.etapa,
  valor: o.valor,
  estado_posventa: o.estadoPosventa,
  objetivo_2027: o.objetivo2027,
  responsable_ids: o.responsableIds,
  created_at: o.createdAt,
})

export const filaAContacto = (r: Fila): CrmContacto => ({
  id: r.id,
  institucionId: r.institucion_id,
  nombre: r.nombre ?? '',
  rol: r.rol ?? '',
  telefono: r.telefono ?? '',
  mail: r.mail ?? '',
  notas: r.notas ?? '',
})
const contactoAFila = (c: CrmContacto) => ({
  id: c.id,
  institucion_id: c.institucionId,
  nombre: c.nombre,
  rol: c.rol,
  telefono: c.telefono,
  mail: c.mail,
  notas: c.notas,
})

export const filaAAccion = (r: Fila): CrmAccion => ({
  id: r.id,
  institucionId: r.institucion_id,
  oportunidadId: r.oportunidad_id ?? null,
  esLnr: !!r.es_lnr,
  orden: r.orden ?? 0,
  accion: r.accion ?? '',
  fecha: r.fecha ?? null,
  responsableIds: r.responsable_ids ?? [],
  estado: (r.estado ?? 'PENDIENTE') as EstadoAccion,
  tipo: r.tipo ?? '',
  horas: r.horas ?? null,
  link: r.link ?? '',
  createdAt: r.created_at ?? new Date().toISOString(),
})
const accionAFila = (a: CrmAccion) => ({
  id: a.id,
  institucion_id: a.institucionId,
  oportunidad_id: a.oportunidadId,
  es_lnr: a.esLnr,
  orden: a.orden,
  accion: a.accion,
  fecha: a.fecha,
  responsable_ids: a.responsableIds,
  estado: a.estado,
  tipo: a.tipo,
  horas: a.horas,
  link: a.link,
  created_at: a.createdAt,
})

export const filaABitacora = (r: Fila): CrmBitacora => ({
  id: r.id,
  fechaHora: r.fecha_hora ?? new Date().toISOString(),
  usuarioId: r.usuario_id ?? null,
  usuario: r.usuario ?? '',
  cambio: r.cambio ?? '',
  institucion: r.institucion ?? '',
  ventaMod: r.venta_mod ?? '',
  accion: r.accion ?? '',
  detalle: r.detalle ?? '',
})
const bitacoraAFila = (b: CrmBitacora) => ({
  id: b.id,
  fecha_hora: b.fechaHora,
  usuario_id: b.usuarioId,
  usuario: b.usuario,
  cambio: b.cambio,
  institucion: b.institucion,
  venta_mod: b.ventaMod,
  accion: b.accion,
  detalle: b.detalle,
})

export const filaAAcceso = (r: Fila): CrmAcceso => ({
  userId: r.user_id,
  otorgadoPor: r.otorgado_por ?? null,
  createdAt: r.created_at ?? new Date().toISOString(),
})

/** Tabla → clave del estado + mapeador (lo usa también el tiempo real). */
export const TABLAS_CRM: { tabla: string; clave: keyof CrmDB; map: (r: Fila) => { id?: string; userId?: string } }[] = [
  { tabla: 'crm_accesos', clave: 'accesos', map: filaAAcceso },
  { tabla: 'crm_instituciones', clave: 'instituciones', map: filaAInstitucion },
  { tabla: 'crm_oportunidades', clave: 'oportunidades', map: filaAOportunidad },
  { tabla: 'crm_contactos', clave: 'contactos', map: filaAContacto },
  { tabla: 'crm_interacciones', clave: 'acciones', map: filaAAccion },
  { tabla: 'crm_bitacora', clave: 'bitacora', map: filaABitacora },
]

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

// Tolerante: si las tablas todavía no existen (no se corrió el SQL), devuelve vacío.
const leer = async (tabla: string, orden?: string) => {
  const q = supabase!.from(tabla).select('*')
  const r = await (orden ? q.order(orden, { ascending: false }) : q)
  return r.error ? [] : (r.data ?? [])
}

const supabaseCrm: CrmApi = {
  async cargarAccesos() {
    return (await leer('crm_accesos')).map(filaAAcceso)
  },
  async cargar() {
    const [accesos, instituciones, oportunidades, contactos, acciones, bitacora] = await Promise.all([
      leer('crm_accesos'),
      leer('crm_instituciones'),
      leer('crm_oportunidades'),
      leer('crm_contactos'),
      leer('crm_interacciones'),
      leer('crm_bitacora', 'fecha_hora'),
    ])
    return {
      accesos: accesos.map(filaAAcceso),
      instituciones: instituciones.map(filaAInstitucion),
      oportunidades: oportunidades.map(filaAOportunidad),
      contactos: contactos.map(filaAContacto),
      acciones: acciones.map(filaAAccion),
      bitacora: bitacora.map(filaABitacora),
    }
  },
  async guardarInstitucion(i) {
    check((await supabase!.from('crm_instituciones').upsert(institucionAFila(i))).error)
  },
  async guardarOportunidad(o) {
    check((await supabase!.from('crm_oportunidades').upsert(oportunidadAFila(o))).error)
  },
  async guardarContacto(c) {
    check((await supabase!.from('crm_contactos').upsert(contactoAFila(c))).error)
  },
  async borrarContacto(id) {
    check((await supabase!.from('crm_contactos').delete().eq('id', id)).error)
  },
  async guardarAccion(a) {
    check((await supabase!.from('crm_interacciones').upsert(accionAFila(a))).error)
  },
  async borrarAccion(id) {
    check((await supabase!.from('crm_interacciones').delete().eq('id', id)).error)
  },
  async anotarBitacora(b) {
    check((await supabase!.from('crm_bitacora').insert(bitacoraAFila(b))).error)
  },
  async darAcceso(a) {
    check((await supabase!.from('crm_accesos').upsert({ user_id: a.userId, otorgado_por: a.otorgadoPor })).error)
  },
  async quitarAcceso(userId) {
    check((await supabase!.from('crm_accesos').delete().eq('user_id', userId)).error)
  },
}

/* ---------- Modo demo (localStorage, datos inventados) ---------- */

export const CRM_KEY = 'reeduca-crm-v1'

function sembrarDemo(): CrmDB {
  const hoy = new Date()
  const d = (n: number) => toKey(addDays(hoy, n))
  const ahora = new Date().toISOString()
  const inst = (nombre: string, segmento: string, ciudad: string, especial = false): CrmInstitucion => ({
    id: uid(), codigo: null, nombre, segmento, ciudad, direccion: '', enLnr: false, eqIntelliq: null, eqV5: null,
    eqUniverso: null, activo: '', driveUrl: '', especial, createdAt: ahora,
  })
  const i1 = inst('Colegio del Parque (demo)', 'Colegio', 'Asunción', true)
  const i2 = inst('Instituto Horizonte (demo)', 'Colegio', 'Luque')
  const i3 = inst('Academia Robótica Norte (demo)', 'Academia', 'San Lorenzo')
  const i4 = inst('Universidad del Sol (demo)', 'Universidad', 'Asunción')
  const opp = (i: CrmInstitucion, modalidad: string, etapa: Etapa, resp: string[], estadoPosventa = ''): CrmOportunidad => ({
    id: uid(), codigo: null, institucionId: i.id, modalidad, producto: '', etapa, valor: null, estadoPosventa,
    objetivo2027: false, responsableIds: resp, createdAt: ahora,
  })
  const o1 = opp(i1, 'Curricular', 'PROPUESTA ENVIADA', ['u-lucia'])
  const o2 = opp(i1, 'Extracurricular', 'CERRADO-GANADO', ['u-malena'], 'ACTIVO')
  const o3 = opp(i2, '', 'CONTACTO INICIAL', ['u-malena'])
  const o4 = opp(i3, 'Extracurricular', 'EN SEGUIMIENTO', ['u-lucia', 'u-alvaro'])
  const o5 = opp(i4, 'Curricular', 'CERRADO-NO GANADO', ['u-alvaro'])
  let orden = 0
  const acc = (i: CrmInstitucion, o: CrmOportunidad | null, accion: string, fecha: string | null, estado: EstadoAccion,
    tipo: string, resp: string[], esLnr = false): CrmAccion => ({
    id: uid(), institucionId: i.id, oportunidadId: o?.id ?? null, esLnr, orden: ++orden, accion, fecha, responsableIds: resp,
    estado, tipo, horas: null, link: '', createdAt: ahora,
  })
  return {
    accesos: ['u-alvaro', 'u-lucia', 'u-malena'].map((userId) => ({ userId, otorgadoPor: 'u-alvaro', createdAt: ahora })),
    instituciones: [i1, i2, i3, i4],
    oportunidades: [o1, o2, o3, o4, o5],
    contactos: [
      { id: uid(), institucionId: i1.id, nombre: 'Directora académica (demo)', rol: 'Dirección', telefono: '0981 000 000', mail: 'direccion@demo.edu.py', notas: '' },
      { id: uid(), institucionId: i2.id, nombre: 'Secretaría (demo)', rol: 'Administración', telefono: '', mail: 'secretaria@demo.edu.py', notas: '' },
    ],
    acciones: [
      acc(i1, o1, 'Primera reunión con dirección', d(-20), 'CONCRETADO', 'reunion', ['u-lucia']),
      acc(i1, o1, 'Enviar propuesta curricular', d(-9), 'CONCRETADO', 'mail', ['u-lucia']),
      acc(i1, o1, 'Llamar para saber si revisaron la propuesta', d(1), 'PENDIENTE', 'llamada', ['u-lucia']),
      acc(i1, o2, 'Visita de seguimiento de los kits', d(3), 'PENDIENTE', 'reunion', ['u-malena']),
      acc(i2, o3, 'Mensaje de presentación', d(-4), 'PENDIENTE', 'mensaje', ['u-malena']),
      acc(i3, o4, 'Mandar flyer de la extracurricular', d(-12), 'CONCRETADO', 'flyer', ['u-lucia']),
      acc(i3, o4, 'Llevar presupuesto impreso', null, 'PENDIENTE', 'presupuesto', ['u-lucia', 'u-alvaro']),
      acc(i2, null, 'Invitar a la Liga Nacional de Robótica', d(2), 'PENDIENTE', 'lnr', ['u-malena'], true),
      acc(i4, o5, 'Respuesta: por ahora no', d(-30), 'CONCRETADO', 'respuesta', ['u-alvaro']),
    ],
    bitacora: [],
  }
}

function leerLocal(): CrmDB {
  try {
    const raw = localStorage.getItem(CRM_KEY)
    if (raw) return JSON.parse(raw) as CrmDB
  } catch {
    // datos corruptos → se vuelven a sembrar
  }
  const db = sembrarDemo()
  localStorage.setItem(CRM_KEY, JSON.stringify(db))
  return db
}
const escribirLocal = (db: CrmDB) => localStorage.setItem(CRM_KEY, JSON.stringify(db))
const upsertLocal = <T extends { id: string }>(list: T[], x: T) =>
  list.some((y) => y.id === x.id) ? list.map((y) => (y.id === x.id ? x : y)) : [...list, x]

const localCrm: CrmApi = {
  async cargarAccesos() {
    return leerLocal().accesos
  },
  async cargar() {
    return leerLocal()
  },
  async guardarInstitucion(i) {
    const db = leerLocal()
    escribirLocal({ ...db, instituciones: upsertLocal(db.instituciones, i) })
  },
  async guardarOportunidad(o) {
    const db = leerLocal()
    escribirLocal({ ...db, oportunidades: upsertLocal(db.oportunidades, o) })
  },
  async guardarContacto(c) {
    const db = leerLocal()
    escribirLocal({ ...db, contactos: upsertLocal(db.contactos, c) })
  },
  async borrarContacto(id) {
    const db = leerLocal()
    escribirLocal({ ...db, contactos: db.contactos.filter((c) => c.id !== id) })
  },
  async guardarAccion(a) {
    const db = leerLocal()
    escribirLocal({ ...db, acciones: upsertLocal(db.acciones, a) })
  },
  async borrarAccion(id) {
    const db = leerLocal()
    escribirLocal({ ...db, acciones: db.acciones.filter((a) => a.id !== id) })
  },
  async anotarBitacora(b) {
    const db = leerLocal()
    escribirLocal({ ...db, bitacora: [b, ...db.bitacora] })
  },
  async darAcceso(a) {
    const db = leerLocal()
    escribirLocal({ ...db, accesos: [...db.accesos.filter((x) => x.userId !== a.userId), a] })
  },
  async quitarAcceso(userId) {
    const db = leerLocal()
    escribirLocal({ ...db, accesos: db.accesos.filter((a) => a.userId !== userId) })
  },
}

export const crmApi: CrmApi = isDemo ? localCrm : supabaseCrm
