/* ---- CRM: tipos (espejo de las tablas crm_* de Supabase) ---- */

export const ETAPAS_VENTA = [
  'CONTACTO INICIAL',
  'EN SEGUIMIENTO',
  'LLEVAR PROPUESTA FÍSICA',
  'P.FÍSICA ENTREGADA',
  'PROPUESTA ENVIADA',
  'EN REVISIÓN/AJUSTE',
] as const
export const ETAPAS = [...ETAPAS_VENTA, 'CERRADO-GANADO', 'CERRADO-NO GANADO'] as const
export type Etapa = (typeof ETAPAS)[number]

export const ESTADOS_POSVENTA = ['ACTIVO', 'ACTIVO-LNR', 'EN STAND BY', 'INACTIVO'] as const
export const ESTADOS_ACCION = ['PENDIENTE', 'EN PROCESO', 'CONCRETADO'] as const
export type EstadoAccion = (typeof ESTADOS_ACCION)[number]
export const MODALIDADES = ['', 'Curricular', 'Extracurricular'] as const
export const SEGMENTOS = ['Colegio', 'Universidad', 'Academia'] as const

export const TIPOS_ACCION: { id: string; label: string }[] = [
  { id: 'llamada', label: 'Llamada' },
  { id: 'mensaje', label: 'Mensaje' },
  { id: 'mail', label: 'Mail' },
  { id: 'reunion', label: 'Reunión' },
  { id: 'presupuesto', label: 'Presupuesto' },
  { id: 'flyer', label: 'Flyer' },
  { id: 'respuesta', label: 'Respuesta del colegio' },
  { id: 'teavisamos', label: '"Te avisamos"' },
  { id: 'lnr', label: 'Invitación LNR' },
  { id: 'otro', label: 'Otro' },
]

export interface CrmInstitucion {
  id: string
  codigo?: string | null // I001… (ID de la planilla)
  nombre: string
  segmento: string
  ciudad: string
  direccion: string
  enLnr: boolean
  eqIntelliq: number | null
  eqV5: number | null
  eqUniverso: number | null
  activo: string
  driveUrl: string
  especial: boolean // seguimiento especial
  createdAt: string
}

export interface CrmOportunidad {
  id: string
  codigo?: string | null
  institucionId: string
  modalidad: string
  producto: string
  etapa: Etapa
  valor: number | null
  estadoPosventa: string
  objetivo2027: boolean
  responsableIds: string[]
  createdAt: string
}

export interface CrmContacto {
  id: string
  institucionId: string
  nombre: string
  rol: string
  telefono: string
  mail: string
  notas: string
}

/** Una acción/gestión del CRM (tabla crm_interacciones). */
export interface CrmAccion {
  id: string
  institucionId: string
  oportunidadId: string | null
  esLnr: boolean // invitación a la Liga: va aparte de venta/posventa
  orden: number
  accion: string
  fecha: string | null // YYYY-MM-DD
  responsableIds: string[]
  estado: EstadoAccion
  tipo: string
  horas: number | null
  link: string
  createdAt: string
}

export interface CrmBitacora {
  id: string
  fechaHora: string
  usuarioId: string | null
  usuario: string
  cambio: string
  institucion: string
  ventaMod: string
  accion: string
  detalle: string
}

export interface CrmAcceso {
  userId: string
  otorgadoPor: string | null
  createdAt: string
}

export interface CrmDB {
  instituciones: CrmInstitucion[]
  oportunidades: CrmOportunidad[]
  contactos: CrmContacto[]
  acciones: CrmAccion[]
  bitacora: CrmBitacora[]
  accesos: CrmAcceso[]
}

export const CRM_VACIO: CrmDB = {
  instituciones: [],
  oportunidades: [],
  contactos: [],
  acciones: [],
  bitacora: [],
  accesos: [],
}
