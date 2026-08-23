import type { DB, Hito, Minute, Note, NoteFolder, Pin, Project, Task, User } from '../types'
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
})

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
})

const minuteToRow = (m: Minute) => ({
  id: m.id,
  title: m.title,
  date: m.date,
  participant_ids: m.participantIds,
  summary: m.summary,
  actions: m.actions,
})

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
    // pins e hitos son de fases nuevas: si las tablas no existen, la app sigue andando.
    const pins = await sb.from('pins').select('*').then((r) => (r.error ? [] : (r.data ?? [])))
    const hitos = await sb.from('hitos').select('*').order('position').then((r) => (r.error ? [] : (r.data ?? [])))
    return {
      users: (users.data ?? []).map(rowToUser),
      projects: (projects.data ?? []).map(rowToProject),
      tasks: (tasks.data ?? []).map(rowToTask),
      notes: (notes.data ?? []).map(rowToNote),
      noteFolders: (folders.data ?? []).map(rowToFolder),
      minutes: (minutes.data ?? []).map(rowToMinute),
      pins: pins.map(rowToPin),
      hitos: hitos.map(rowToHito),
    }
  },

  async saveTask(t) {
    check((await supabase!.from('tasks').upsert(taskToRow(t))).error)
  },

  async saveTasks(ts) {
    if (!ts.length) return
    check((await supabase!.from('tasks').upsert(ts.map(taskToRow))).error)
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
    check((await supabase!.from('minutes').upsert(minuteToRow(m))).error)
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
}
