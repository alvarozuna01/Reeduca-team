import type { Consejo, DB, FeatureFlag, Hito, Kickoff, KickoffAnotacion, KickoffBriefing, Minute, Note, NoteFolder, Pin, Project, Task, TaskComment, User } from '../types'
import type { Api } from './api'
import { supabase } from './supabaseClient'

/* Mapeo camelCase (app) <-> snake_case (Postgres) */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rowToTask = (r: any): Task => ({
  id: r.id,
  projectId: r.project_id,
  title: r.title,
  description: r.description ?? undefined,
  date: r.date ?? null,
  hitoId: r.hito_id ?? null,
  startTime: r.start_time ?? undefined,
  endTime: r.end_time ?? undefined,
  assigneeIds: r.assignee_ids ?? [],
  status: r.status,
  position: r.position ?? 0,
  checklist: r.checklist ?? [],
  links: r.links ?? [],
  urgent: r.urgent ?? false,
  importance: r.importance ?? 0,
  completedAt: r.completed_at ?? null,
  necesitaDecisionGg: r.necesita_decision_gg ?? false,
  necesitaDecisionDesde: r.necesita_decision_desde ?? null,
})

const taskToRow = (t: Task) => ({
  id: t.id,
  project_id: t.projectId,
  title: t.title,
  description: t.description || null,
  date: t.date || null,
  hito_id: t.hitoId || null,
  start_time: t.startTime || null,
  end_time: t.endTime || null,
  assignee_ids: t.assigneeIds,
  status: t.status,
  position: t.position,
  checklist: t.checklist,
  links: t.links,
  urgent: t.urgent,
  importance: t.importance,
  completed_at: t.completedAt ?? null,
  necesita_decision_gg: t.necesitaDecisionGg ?? false,
  necesita_decision_desde: t.necesitaDecisionDesde ?? null,
})

/**
 * Columnas de tasks agregadas por la migración del Panel PM. Si la base
 * todavía no la corrió, el guardado reintenta sin ellas (la app degrada
 * al comportamiento anterior en vez de romper).
 */
const COLUMNAS_NUEVAS_TASKS = ['completed_at', 'necesita_decision_gg', 'necesita_decision_desde'] as const

function sinColumnasNuevas(row: ReturnType<typeof taskToRow>) {
  const { completed_at: _c, necesita_decision_gg: _g, necesita_decision_desde: _d, ...rest } = row
  return rest
}

/* ---- Notas, carpetas y minutas ---- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rowToNote = (r: any): Note => ({
  id: r.id,
  userId: r.user_id,
  folderId: r.folder_id ?? null,
  title: r.title ?? '',
  content: r.content ?? '',
  pinned: r.pinned ?? false,
  updatedAt: r.updated_at ?? new Date().toISOString(),
  sharedWith: r.shared_with ?? [],
})

const noteToRow = (n: Note) => ({
  id: n.id,
  user_id: n.userId,
  folder_id: n.folderId,
  title: n.title,
  content: n.content,
  pinned: n.pinned,
  updated_at: n.updatedAt,
  shared_with: n.sharedWith,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rowToPin = (r: any): Pin => ({
  id: r.id,
  userId: r.user_id,
  noteId: r.note_id ?? undefined,
  text: r.text ?? undefined,
  position: r.position ?? 0,
})

const pinToRow = (p: Pin) => ({
  id: p.id,
  user_id: p.userId,
  note_id: p.noteId ?? null,
  text: p.text ?? null,
  position: p.position,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rowToHito = (r: any): Hito => ({
  id: r.id,
  projectId: r.project_id,
  name: r.name,
  date: r.date ?? null,
  position: r.position ?? 0,
})

const hitoToRow = (h: Hito) => ({
  id: h.id,
  project_id: h.projectId,
  name: h.name,
  date: h.date || null,
  position: h.position,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rowToFolder = (r: any): NoteFolder => ({
  id: r.id,
  userId: r.user_id,
  name: r.name,
  parentId: r.parent_id ?? null,
  position: r.position ?? 0,
})

const folderToRow = (f: NoteFolder) => ({
  id: f.id,
  user_id: f.userId,
  name: f.name,
  parent_id: f.parentId,
  position: f.position,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rowToMinute = (r: any): Minute => ({
  id: r.id,
  title: r.title,
  date: r.date,
  participantIds: r.participant_ids ?? [],
  summary: r.summary ?? '',
  actions: r.actions ?? [],
  transcripcion: r.transcripcion ?? null,
  transcripcionCargadaAt: r.transcripcion_cargada_at ?? null,
  estadoProcesamiento: r.estado_procesamiento ?? 'sin_transcripcion',
})

const minuteToRow = (m: Minute) => ({
  id: m.id,
  title: m.title,
  date: m.date,
  participant_ids: m.participantIds,
  summary: m.summary,
  actions: m.actions,
  transcripcion: m.transcripcion ?? null,
  transcripcion_cargada_at: m.transcripcionCargadaAt ?? null,
  estado_procesamiento: m.estadoProcesamiento ?? 'sin_transcripcion',
})

/** Columnas de minutes de la migración kickoff-2: si la base no la corrió, se guarda sin ellas. */
const COLUMNAS_NUEVAS_MINUTES = ['transcripcion', 'transcripcion_cargada_at', 'estado_procesamiento'] as const

function minuteSinColumnasNuevas(row: ReturnType<typeof minuteToRow>) {
  const { transcripcion: _t, transcripcion_cargada_at: _c, estado_procesamiento: _e, ...rest } = row
  return rest
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rowToUser = (r: any): User => ({
  id: r.id,
  name: r.name,
  email: r.email,
  role: r.role,
  color: r.color,
  avatarUrl: r.avatar_url ?? undefined,
})

const userToRow = (u: User) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  color: u.color,
  avatar_url: u.avatarUrl || null,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rowToProject = (r: any): Project => ({
  id: r.id,
  name: r.name,
  color: r.color,
  description: r.description ?? undefined,
})

const projectToRow = (p: Project) => ({
  id: p.id,
  name: p.name,
  color: p.color,
  description: p.description || null,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rowToFlag = (r: any): FeatureFlag => ({
  id: r.id,
  flag: r.flag,
  userId: r.user_id ?? null,
  enabled: r.enabled ?? false,
})

const flagToRow = (f: FeatureFlag) => ({
  id: f.id,
  flag: f.flag,
  user_id: f.userId,
  enabled: f.enabled,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rowToComment = (r: any): TaskComment => ({
  id: r.id,
  taskId: r.task_id,
  userId: r.user_id,
  text: r.text ?? '',
  createdAt: r.created_at ?? new Date().toISOString(),
})

const commentToRow = (c: TaskComment) => ({
  id: c.id,
  task_id: c.taskId,
  user_id: c.userId,
  text: c.text,
  created_at: c.createdAt,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rowToConsejo = (r: any): Consejo => ({
  id: r.id,
  texto: r.texto ?? '',
  porQue: r.por_que ?? null,
  quienLoDijo: r.quien_lo_dijo ?? null,
  fechaRecibida: r.fecha_recibida,
  origenTabla: r.origen_tabla ?? null,
  origenId: r.origen_id ?? null,
  citaOrigen: r.cita_origen ?? null,
  estado: r.estado ?? 'activo',
  vecesMostrado: r.veces_mostrado ?? 0,
  ultimaAparicion: r.ultima_aparicion ?? null,
  creadoPor: r.creado_por ?? null,
})

const consejoToRow = (c: Consejo) => ({
  id: c.id,
  texto: c.texto,
  por_que: c.porQue ?? null,
  quien_lo_dijo: c.quienLoDijo ?? null,
  fecha_recibida: c.fechaRecibida,
  origen_tabla: c.origenTabla ?? null,
  origen_id: c.origenId ?? null,
  cita_origen: c.citaOrigen ?? null,
  estado: c.estado,
  veces_mostrado: c.vecesMostrado,
  ultima_aparicion: c.ultimaAparicion ?? null,
  creado_por: c.creadoPor ?? null,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rowToKickoff = (r: any): Kickoff => ({
  id: r.id,
  fecha: r.fecha,
  estado: r.estado ?? 'preparado',
  minutaId: r.minuta_id ?? null,
  consejoId: r.consejo_id ?? null,
  notas: r.notas ?? {},
})

const kickoffToRow = (k: Kickoff) => ({
  id: k.id,
  fecha: k.fecha,
  estado: k.estado,
  minuta_id: k.minutaId ?? null,
  consejo_id: k.consejoId ?? null,
  notas: k.notas,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rowToBriefing = (r: any): KickoffBriefing => ({
  id: r.id,
  kickoffId: r.kickoff_id,
  usuarioId: r.usuario_id,
  enQueTrabajo: r.en_que_trabajo ?? '',
  necesitoAlgo: r.necesito_algo ?? '',
  completadoAt: r.completado_at ?? null,
})

const briefingToRow = (b: KickoffBriefing) => ({
  id: b.id,
  kickoff_id: b.kickoffId,
  usuario_id: b.usuarioId,
  en_que_trabajo: b.enQueTrabajo,
  necesito_algo: b.necesitoAlgo,
  completado_at: b.completadoAt ?? null,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rowToAnotacion = (r: any): KickoffAnotacion => ({
  id: r.id,
  kickoffId: r.kickoff_id,
  usuarioId: r.usuario_id,
  bloque: r.bloque ?? 'general',
  referenciaId: r.referencia_id ?? null,
  textoResaltado: r.texto_resaltado ?? null,
  comentario: r.comentario ?? '',
  visibilidad: r.visibilidad ?? 'privada',
  createdAt: r.created_at ?? new Date().toISOString(),
})

const anotacionToRow = (a: KickoffAnotacion) => ({
  id: a.id,
  kickoff_id: a.kickoffId,
  usuario_id: a.usuarioId,
  bloque: a.bloque,
  referencia_id: a.referenciaId ?? null,
  texto_resaltado: a.textoResaltado ?? null,
  comentario: a.comentario,
  visibilidad: a.visibilidad,
  created_at: a.createdAt,
})

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

/**
 * Mapeadores fila→entidad por tabla, usados también por la suscripción
 * de tiempo real (AppContext) para aplicar cambios entrantes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const REALTIME_TABLES: { table: string; key: keyof DB; map: (r: any) => { id: string } }[] = [
  { table: 'profiles', key: 'users', map: rowToUser },
  { table: 'projects', key: 'projects', map: rowToProject },
  { table: 'tasks', key: 'tasks', map: rowToTask },
  { table: 'notes', key: 'notes', map: rowToNote },
  { table: 'note_folders', key: 'noteFolders', map: rowToFolder },
  { table: 'minutes', key: 'minutes', map: rowToMinute },
  { table: 'pins', key: 'pins', map: rowToPin },
  { table: 'hitos', key: 'hitos', map: rowToHito },
  { table: 'feature_flags', key: 'featureFlags', map: rowToFlag },
  { table: 'task_comments', key: 'taskComments', map: rowToComment },
  { table: 'consejos', key: 'consejos', map: rowToConsejo },
  { table: 'kickoffs', key: 'kickoffs', map: rowToKickoff },
  { table: 'kickoff_briefings', key: 'kickoffBriefings', map: rowToBriefing },
  { table: 'kickoff_anotaciones', key: 'kickoffAnotaciones', map: rowToAnotacion },
]

export const supabaseApi: Api = {
  mode: 'supabase',

  async load() {
    const sb = supabase!
    const [users, projects, tasks, notes, folders, minutes] = await Promise.all([
      sb.from('profiles').select('*').order('name'),
      sb.from('projects').select('*').order('name'),
      sb.from('tasks').select('*'),
      sb.from('notes').select('*'),
      sb.from('note_folders').select('*').order('position'),
      sb.from('minutes').select('*').order('date', { ascending: false }),
    ])
    check(users.error)
    check(projects.error)
    check(tasks.error)
    check(notes.error)
    check(folders.error)
    check(minutes.error)
    // pins, hitos y feature_flags son de fases nuevas: si las tablas no existen, la app sigue andando.
    const pins = await sb.from('pins').select('*').then((r) => (r.error ? [] : (r.data ?? [])))
    const hitos = await sb.from('hitos').select('*').order('position').then((r) => (r.error ? [] : (r.data ?? [])))
    const flags = await sb.from('feature_flags').select('*').then((r) => (r.error ? [] : (r.data ?? [])))
    const comments = await sb.from('task_comments').select('*').order('created_at').then((r) => (r.error ? [] : (r.data ?? [])))
    const consejos = await sb.from('consejos').select('*').then((r) => (r.error ? [] : (r.data ?? [])))
    const kickoffs = await sb.from('kickoffs').select('*').then((r) => (r.error ? [] : (r.data ?? [])))
    const briefings = await sb.from('kickoff_briefings').select('*').then((r) => (r.error ? [] : (r.data ?? [])))
    const anotaciones = await sb.from('kickoff_anotaciones').select('*').then((r) => (r.error ? [] : (r.data ?? [])))
    return {
      users: (users.data ?? []).map(rowToUser),
      projects: (projects.data ?? []).map(rowToProject),
      tasks: (tasks.data ?? []).map(rowToTask),
      notes: (notes.data ?? []).map(rowToNote),
      noteFolders: (folders.data ?? []).map(rowToFolder),
      minutes: (minutes.data ?? []).map(rowToMinute),
      pins: pins.map(rowToPin),
      hitos: hitos.map(rowToHito),
      featureFlags: flags.map(rowToFlag),
      taskComments: comments.map(rowToComment),
      consejos: consejos.map(rowToConsejo),
      kickoffs: kickoffs.map(rowToKickoff),
      kickoffBriefings: briefings.map(rowToBriefing),
      kickoffAnotaciones: anotaciones.map(rowToAnotacion),
    }
  },

  async saveTask(t) {
    const { error } = await supabase!.from('tasks').upsert(taskToRow(t))
    if (error && COLUMNAS_NUEVAS_TASKS.some((c) => error.message.includes(c))) {
      check((await supabase!.from('tasks').upsert(sinColumnasNuevas(taskToRow(t)))).error)
      return
    }
    check(error)
  },

  async saveTasks(ts) {
    if (!ts.length) return
    const { error } = await supabase!.from('tasks').upsert(ts.map(taskToRow))
    if (error && COLUMNAS_NUEVAS_TASKS.some((c) => error.message.includes(c))) {
      check((await supabase!.from('tasks').upsert(ts.map((t) => sinColumnasNuevas(taskToRow(t))))).error)
      return
    }
    check(error)
  },

  async deleteTask(id) {
    check((await supabase!.from('tasks').delete().eq('id', id)).error)
  },

  async saveProject(p) {
    check((await supabase!.from('projects').upsert(projectToRow(p))).error)
  },

  async deleteProject(id) {
    // las tareas del proyecto se borran en cascada (FK ON DELETE CASCADE)
    check((await supabase!.from('projects').delete().eq('id', id)).error)
  },

  async saveUser(u) {
    check((await supabase!.from('profiles').upsert(userToRow(u))).error)
  },

  async deleteUser(id) {
    check((await supabase!.from('profiles').delete().eq('id', id)).error)
  },

  async saveNote(n) {
    const { error } = await supabase!.from('notes').upsert(noteToRow(n))
    if (error && error.message.includes('shared_with')) {
      // Base sin la migración de Fase 3 todavía: guardar sin ese campo.
      const { shared_with: _sw, ...rest } = noteToRow(n)
      check((await supabase!.from('notes').upsert(rest)).error)
      return
    }
    check(error)
  },

  async deleteNote(id) {
    check((await supabase!.from('notes').delete().eq('id', id)).error)
  },

  async saveFolder(f) {
    check((await supabase!.from('note_folders').upsert(folderToRow(f))).error)
  },

  async deleteFolder(id) {
    check((await supabase!.from('note_folders').delete().eq('id', id)).error)
  },

  async saveMinute(m) {
    const { error } = await supabase!.from('minutes').upsert(minuteToRow(m))
    if (error && COLUMNAS_NUEVAS_MINUTES.some((c) => error.message.includes(c))) {
      // Base sin la migración kickoff-2 todavía: guardar sin esos campos.
      check((await supabase!.from('minutes').upsert(minuteSinColumnasNuevas(minuteToRow(m)))).error)
      return
    }
    check(error)
  },

  async deleteMinute(id) {
    check((await supabase!.from('minutes').delete().eq('id', id)).error)
  },

  async savePin(p) {
    check((await supabase!.from('pins').upsert(pinToRow(p))).error)
  },

  async deletePin(id) {
    check((await supabase!.from('pins').delete().eq('id', id)).error)
  },

  async saveHito(h) {
    check((await supabase!.from('hitos').upsert(hitoToRow(h))).error)
  },

  async deleteHito(id) {
    // las tareas vinculadas quedan sin hito (FK ON DELETE SET NULL)
    check((await supabase!.from('hitos').delete().eq('id', id)).error)
  },

  async saveFeatureFlag(f) {
    // onConflict por (flag, user_id): si ya existe la fila de esa llave para esa
    // persona (aunque tenga otro id), se actualiza en vez de duplicarse.
    check((await supabase!.from('feature_flags').upsert(flagToRow(f), { onConflict: 'flag,user_id' })).error)
  },

  async deleteFeatureFlag(id) {
    check((await supabase!.from('feature_flags').delete().eq('id', id)).error)
  },

  async saveTaskComment(c) {
    check((await supabase!.from('task_comments').upsert(commentToRow(c))).error)
  },

  async deleteTaskComment(id) {
    check((await supabase!.from('task_comments').delete().eq('id', id)).error)
  },

  async saveConsejo(c) {
    check((await supabase!.from('consejos').upsert(consejoToRow(c))).error)
  },

  async deleteConsejo(id) {
    check((await supabase!.from('consejos').delete().eq('id', id)).error)
  },

  async saveKickoff(k) {
    check((await supabase!.from('kickoffs').upsert(kickoffToRow(k))).error)
  },

  async deleteKickoff(id) {
    check((await supabase!.from('kickoffs').delete().eq('id', id)).error)
  },

  async saveKickoffBriefing(b) {
    // onConflict por (kickoff_id, usuario_id): si dos dispositivos crean el
    // briefing del mismo lunes a la vez, se actualiza en vez de duplicarse.
    check((await supabase!.from('kickoff_briefings').upsert(briefingToRow(b), { onConflict: 'kickoff_id,usuario_id' })).error)
  },

  async deleteKickoffBriefing(id) {
    check((await supabase!.from('kickoff_briefings').delete().eq('id', id)).error)
  },

  async saveKickoffAnotacion(a) {
    check((await supabase!.from('kickoff_anotaciones').upsert(anotacionToRow(a))).error)
  },

  async deleteKickoffAnotacion(id) {
    check((await supabase!.from('kickoff_anotaciones').delete().eq('id', id)).error)
  },
}
