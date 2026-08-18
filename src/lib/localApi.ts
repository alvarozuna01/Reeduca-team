import type { DB, Minute, Note, NoteFolder, Project, Task, User } from '../types'
import { seedDB } from './seed'
import type { Api } from './api'

const DB_KEY = 'reeduca-db-v1'
const SESSION_KEY = 'reeduca-session-v1'

/** Completa datos guardados por versiones anteriores de la app (Fase 1 → Fase 2). */
function normalize(db: DB): DB {
  db.tasks = (db.tasks ?? []).map((t) => ({ ...t, urgent: t.urgent ?? false, importance: t.importance ?? 0 }))
  if (!db.notes || !db.noteFolders || !db.minutes) {
    const s = seedDB()
    db.notes ??= s.notes
    db.noteFolders ??= s.noteFolders
    db.minutes ??= s.minutes
    // Primera vez con la Fase 2: enriquecer las tareas de ejemplo de la Fase 1
    // con urgencia/importancia, y sumar las tareas de la semana próxima.
    for (const st of s.tasks) {
      const match = db.tasks.find((t) => t.title === st.title && t.date === st.date)
      if (match && !match.urgent && !match.importance) {
        match.urgent = st.urgent
        match.importance = st.importance
      }
      if (!match && st.date > todayStr()) db.tasks.push(st)
    }
  }
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
