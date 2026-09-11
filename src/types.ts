export type Role = 'admin' | 'member'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  color: string
  avatarUrl?: string
}

export interface Project {
  id: string
  name: string
  color: string
  description?: string
  position?: number // orden configurado por el Gerente (empate → alfabético)
}

export type Status = 'todo' | 'doing' | 'done'

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

export interface TaskLink {
  id: string
  label: string
  url: string
}

export interface Task {
  id: string
  projectId: string
  title: string
  description?: string
  date: string | null // YYYY-MM-DD, o null = "sin fecha" (bandeja)
  hitoId?: string | null // hito al que aporta esta tarea
  startTime?: string // HH:mm
  endTime?: string // HH:mm
  assigneeIds: string[]
  status: Status
  position: number
  checklist: ChecklistItem[]
  links: TaskLink[]
  urgent: boolean
  importance: number // 0 (sin calificar) a 5 estrellas
  completedAt?: string | null // ISO; la estampa la app al pasar a "done"
  necesitaDecisionGg?: boolean // marcada como "necesita decisión del Gerente"
  necesitaDecisionDesde?: string | null // ISO; desde cuándo espera esa decisión
}

/* ---- Mi Cuaderno (notas privadas por usuario) ---- */

export interface NoteFolder {
  id: string
  userId: string
  name: string
  parentId: string | null
  position: number
}

export interface Note {
  id: string
  userId: string
  folderId: string | null
  title: string
  content: string // HTML del editor de texto enriquecido
  pinned: boolean
  updatedAt: string // ISO
  sharedWith: string[] // ids de usuarios con acceso (ven y editan)
}

/** Elemento fijado en "Mi Día": una nota anclada o un recordatorio suelto. */
export interface Pin {
  id: string
  userId: string
  noteId?: string
  text?: string
  position: number
}

/* ---- Hitos (metas grandes de cada proyecto) ---- */

export interface Hito {
  id: string
  projectId: string
  name: string
  date: string | null // fecha objetivo (opcional)
  position: number
}

/* ---- Minutas de reuniones ---- */

export interface MinuteAction {
  id: string
  text: string
  taskId?: string // se completa cuando la acción se convierte en tarea
  /* Campos del Módulo A (transcripción → minuta). Opcionales a propósito:
     las acciones viejas no se migran — sin `origen` se asume 'manual'. */
  origen?: 'ia' | 'manual'
  citaOrigen?: string // la frase textual de la transcripción de donde salió
  responsableSugeridoId?: string // si el nombre sugerido por la IA mapeó a un perfil
  responsableSugeridoNombre?: string // el nombre crudo, por si no mapeó
  fechaSugerida?: string // YYYY-MM-DD
  descartada?: boolean // las propuestas descartadas no se borran: quedan acá
  editada?: boolean // al editarla a mano pierde el look de "propuesta"
}

export type EstadoProcesamiento = 'sin_transcripcion' | 'sin_procesar' | 'procesada'

export interface Minute {
  id: string
  title: string
  date: string // YYYY-MM-DD
  participantIds: string[]
  summary: string
  actions: MinuteAction[]
  transcripcion?: string | null // el texto crudo, tal cual; nunca se reescribe
  transcripcionCargadaAt?: string | null // ISO
  estadoProcesamiento?: EstadoProcesamiento
}

/* ---- Consejos (Módulo B: recomendaciones al Gerente, sin fecha ni "completar") ---- */

export interface Consejo {
  id: string
  texto: string
  porQue?: string | null
  quienLoDijo?: string | null
  fechaRecibida: string // YYYY-MM-DD
  origenTabla?: string | null // 'minutes' si salió de una minuta procesada
  origenId?: string | null
  citaOrigen?: string | null
  estado: 'activo' | 'archivado'
  vecesMostrado: number
  ultimaAparicion?: string | null // YYYY-MM-DD; alimenta la rotación semanal
  creadoPor?: string | null
}

/* ---- Kickoff semanal (Módulo C) ---- */

export interface KickoffNotas {
  presentes?: string[] // ids de perfiles presentes en la reunión
  bloque3?: Record<string, string> // línea de la semana por usuario, escrita en vivo
  acciones?: { id: string; texto: string }[] // acciones acordadas durante la reunión
}

export interface Kickoff {
  id: string
  fecha: string // YYYY-MM-DD, el lunes que corresponde (único)
  estado: 'preparado' | 'en_curso' | 'cerrado'
  minutaId?: string | null // la minuta que se genera al cerrar
  consejoId?: string | null // el consejo que se mostró (congelado para ese lunes)
  notas: KickoffNotas
}

/** Respuestas de cada persona a las dos preguntas del viernes. */
export interface KickoffBriefing {
  id: string
  kickoffId: string
  usuarioId: string
  enQueTrabajo: string
  necesitoAlgo: string
  completadoAt?: string | null
}

/** Anotación personal sobre el briefing. Privada por defecto: ni el Gerente la ve. */
export interface KickoffAnotacion {
  id: string
  kickoffId: string
  usuarioId: string
  bloque: string
  referenciaId?: string | null
  textoResaltado?: string | null
  comentario: string
  visibilidad: 'privada' | 'compartida'
  createdAt: string
}

/* ---- Comentarios en tareas ---- */

/** Comentario de cualquier miembro sobre una tarea (propia o ajena). */
export interface TaskComment {
  id: string
  taskId: string
  userId: string
  text: string
  createdAt: string // ISO
}

/* ---- Llaves de funciones (feature flags) ---- */

/**
 * Permite prender funciones nuevas por usuario antes de mostrarlas a todo
 * el equipo. Una fila con userId = null es el valor global; una fila con
 * userId gana sobre la global para esa persona.
 */
export interface FeatureFlag {
  id: string
  flag: string
  userId: string | null
  enabled: boolean
}

export const FEATURE_KICKOFF = 'FEATURE_KICKOFF'
export const FEATURE_COMENTARIOS = 'FEATURE_COMENTARIOS'
export const FEATURE_PANEL = 'FEATURE_PANEL'

export interface DB {
  users: User[]
  projects: Project[]
  tasks: Task[]
  hitos: Hito[]
  notes: Note[]
  noteFolders: NoteFolder[]
  minutes: Minute[]
  pins: Pin[]
  featureFlags: FeatureFlag[]
  taskComments: TaskComment[]
  consejos: Consejo[]
  kickoffs: Kickoff[]
  kickoffBriefings: KickoffBriefing[]
  kickoffAnotaciones: KickoffAnotacion[]
}
