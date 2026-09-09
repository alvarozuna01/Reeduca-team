import type { Consejo, DB, FeatureFlag, Hito, Kickoff, KickoffAnotacion, KickoffBriefing, Minute, Note, NoteFolder, Pin, Project, Task, TaskComment, User } from '../types'
import { seedConsejos, seedDB, seedFeatureFlags } from './seed'
import type { Api } from './api'

export const DB_KEY = 'reeduca-db-v1'
const SESSION_KEY = 'reeduca-session-v1'

/** Completa datos guardados por versiones anteriores de la app (Fase 1 → 2 → 3). */
function normalize(db: DB): DB {
  db.tasks = (db.tasks ?? []).map((t) => ({ ...t, urgent: t.urgent ?? false, importance: t.importance ?? 0 }))
  const hadNotes = !!db.notes
  if (!db.notes || !db.noteFolders || !db.minutes) {
    const s = seedDB()
    db.notes ??= s.notes
    db.noteFolders ??= s.noteFolders
    db.minutes ??= s.minutes
    if (!hadNotes) db.pins ??= s.pins
    // Primera vez con la Fase 2: enriquecer las tareas de ejemplo de la Fase 1
    // con urgencia/importancia, y sumar las tareas de la semana próxima.
    for (const st of s.tasks) {
      const match = db.tasks.find((t) => t.title === st.title && t.date === st.date)
      if (match && !match.urgent && !match.importance) {
        match.urgent = st.urgent
        match.importance = st.importance
      }
      if (!match && st.date && st.date > todayStr()) db.tasks.push(st)
    }
  }
  db.notes = db.notes.map((n) => ({ ...n, sharedWith: n.sharedWith ?? [] }))
  db.pins ??= []
  db.hitos ??= []
  db.featureFlags ??= seedFeatureFlags()
  db.taskComments ??= []
  db.consejos ??= seedConsejos()
  db.kickoffs ??= []
  db.kickoffBriefings ??= []
  db.kickoffAnotaciones ??= []
  return db
}

const todayStr = () => new Date().toISOString().slice(0, 10)

function read(): DB {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) {
      const db = normalize(JSON.parse(raw) as DB)
      write(db)
      return db
    }
  } catch {
    // datos corruptos → re-sembrar
  }
  const db = seedDB()
  write(db)
  return db
}

function write(db: DB) {
  localStorage.setItem(DB_KEY, JSON.stringify(db))
}

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id)
  if (i === -1) return [...list, item]
  const copy = [...list]
  copy[i] = item
  return copy
}

export const localApi: Api = {
  mode: 'demo',

  async load() {
    return read()
  },

  async saveTask(t: Task) {
    const db = read()
    db.tasks = upsert(db.tasks, t)
    write(db)
  },

  async saveTasks(ts: Task[]) {
    const db = read()
    for (const t of ts) db.tasks = upsert(db.tasks, t)
    write(db)
  },

  async deleteTask(id: string) {
    const db = read()
    db.tasks = db.tasks.filter((t) => t.id !== id)
    write(db)
  },

  async saveProject(p: Project) {
    const db = read()
    db.projects = upsert(db.projects, p)
    write(db)
  },

  async deleteProject(id: string) {
    const db = read()
    db.projects = db.projects.filter((p) => p.id !== id)
    db.tasks = db.tasks.filter((t) => t.projectId !== id)
    write(db)
  },

  async saveUser(u: User) {
    const db = read()
    db.users = upsert(db.users, u)
    write(db)
  },

  async deleteUser(id: string) {
    const db = read()
    db.users = db.users.filter((u) => u.id !== id)
    db.tasks = db.tasks.map((t) => ({ ...t, assigneeIds: t.assigneeIds.filter((a) => a !== id) }))
    write(db)
  },

  async saveNote(n: Note) {
    const db = read()
    db.notes = upsert(db.notes, n)
    write(db)
  },

  async deleteNote(id: string) {
    const db = read()
    db.notes = db.notes.filter((n) => n.id !== id)
    write(db)
  },

  async saveFolder(f: NoteFolder) {
    const db = read()
    db.noteFolders = upsert(db.noteFolders, f)
    write(db)
  },

  async deleteFolder(id: string) {
    const db = read()
    db.noteFolders = db.noteFolders.filter((f) => f.id !== id)
    write(db)
  },

  async saveMinute(m: Minute) {
    const db = read()
    db.minutes = upsert(db.minutes, m)
    write(db)
  },

  async deleteMinute(id: string) {
    const db = read()
    db.minutes = db.minutes.filter((m) => m.id !== id)
    write(db)
  },

  async savePin(p: Pin) {
    const db = read()
    db.pins = upsert(db.pins, p)
    write(db)
  },

  async deletePin(id: string) {
    const db = read()
    db.pins = db.pins.filter((p) => p.id !== id)
    write(db)
  },

  async saveHito(h: Hito) {
    const db = read()
    db.hitos = upsert(db.hitos, h)
    write(db)
  },

  async deleteHito(id: string) {
    const db = read()
    db.hitos = db.hitos.filter((h) => h.id !== id)
    db.tasks = db.tasks.map((t) => (t.hitoId === id ? { ...t, hitoId: null } : t))
    write(db)
  },

  async saveFeatureFlag(f: FeatureFlag) {
    const db = read()
    // Igual que en Supabase: una sola fila por (flag, userId).
    const existing = db.featureFlags.find((x) => x.flag === f.flag && x.userId === f.userId)
    db.featureFlags = upsert(db.featureFlags, existing ? { ...f, id: existing.id } : f)
    write(db)
  },

  async deleteFeatureFlag(id: string) {
    const db = read()
    db.featureFlags = db.featureFlags.filter((f) => f.id !== id)
    write(db)
  },

  async saveTaskComment(c: TaskComment) {
    const db = read()
    db.taskComments = upsert(db.taskComments, c)
    write(db)
  },

  async deleteTaskComment(id: string) {
    const db = read()
    db.taskComments = db.taskComments.filter((c) => c.id !== id)
    write(db)
  },

  async saveConsejo(c: Consejo) {
    const db = read()
    db.consejos = upsert(db.consejos, c)
    write(db)
  },

  async deleteConsejo(id: string) {
    const db = read()
    db.consejos = db.consejos.filter((c) => c.id !== id)
    write(db)
  },

  async saveKickoff(k: Kickoff) {
    const db = read()
    db.kickoffs = upsert(db.kickoffs, k)
    write(db)
  },

  async deleteKickoff(id: string) {
    const db = read()
    db.kickoffs = db.kickoffs.filter((k) => k.id !== id)
    db.kickoffBriefings = db.kickoffBriefings.filter((b) => b.kickoffId !== id)
    db.kickoffAnotaciones = db.kickoffAnotaciones.filter((a) => a.kickoffId !== id)
    write(db)
  },

  async saveKickoffBriefing(b: KickoffBriefing) {
    const db = read()
    // Igual que en Supabase: una sola fila por (kickoffId, usuarioId).
    const existing = db.kickoffBriefings.find((x) => x.kickoffId === b.kickoffId && x.usuarioId === b.usuarioId)
    db.kickoffBriefings = upsert(db.kickoffBriefings, existing ? { ...b, id: existing.id } : b)
    write(db)
  },

  async deleteKickoffBriefing(id: string) {
    const db = read()
    db.kickoffBriefings = db.kickoffBriefings.filter((b) => b.id !== id)
    write(db)
  },

  async saveKickoffAnotacion(a: KickoffAnotacion) {
    const db = read()
    db.kickoffAnotaciones = upsert(db.kickoffAnotaciones, a)
    write(db)
  },

  async deleteKickoffAnotacion(id: string) {
    const db = read()
    db.kickoffAnotaciones = db.kickoffAnotaciones.filter((a) => a.id !== id)
    write(db)
  },
}

export const demoSession = {
  get(): string | null {
    return localStorage.getItem(SESSION_KEY)
  },
  set(userId: string | null) {
    if (userId) localStorage.setItem(SESSION_KEY, userId)
    else localStorage.removeItem(SESSION_KEY)
  },
}
