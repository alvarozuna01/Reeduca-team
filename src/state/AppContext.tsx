import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { DB, Minute, Note, NoteFolder, Project, Task, User } from '../types'
import { api, isDemo } from '../lib/api'
import { demoSession } from '../lib/localApi'
import { supabase } from '../lib/supabaseClient'

interface AppCtx {
  loading: boolean
  demo: boolean
  users: User[]
  projects: Project[]
  tasks: Task[]
  notes: Note[]
  noteFolders: NoteFolder[]
  minutes: Minute[]
  currentUser: User | null
  isAdmin: boolean
  loginDemo: (userId: string) => void
  loginEmail: (email: string, password: string) => Promise<string | null>
  signUpEmail: (name: string, email: string, password: string) => Promise<string | null>
  resetPassword: (email: string) => Promise<string | null>
  changePassword: (password: string) => Promise<string | null>
  logout: () => void
  upsertTask: (t: Task) => void
  upsertTasks: (ts: Task[]) => void
  removeTask: (id: string) => void
  upsertProject: (p: Project) => void
  removeProject: (id: string) => void
  upsertUser: (u: User) => void
  removeUser: (id: string) => void
  upsertNote: (n: Note) => void
  removeNote: (id: string) => void
  upsertFolder: (f: NoteFolder) => void
  removeFolder: (id: string) => void
  upsertMinute: (m: Minute) => void
  removeMinute: (id: string) => void
}

const Ctx = createContext<AppCtx | null>(null)

function upsertIn<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id)
  if (i === -1) return [...list, item]
  const copy = [...list]
  copy[i] = item
  return copy
}

const report = (e: unknown) => console.error('[ReEduca] Error guardando datos:', e)

export function AppProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>({ users: [], projects: [], tasks: [], notes: [], noteFolders: [], minutes: [] })
  const [loading, setLoading] = useState(true)
  const [sessionId, setSessionId] = useState<string | null>(() => (isDemo ? demoSession.get() : null))

  // Arranque: en demo cargamos directo; con Supabase primero resolvemos la sesión.
  useEffect(() => {
    if (isDemo) {
      api.load().then((d) => {
        setDb(d)
        setLoading(false)
      })
      return
    }
    supabase!.auth.getSession().then(({ data }) => {
      setSessionId(data.session?.user.id ?? null)
      if (!data.session) setLoading(false)
    })
    const { data: sub } = supabase!.auth.onAuthStateChange((_event, session) => {
      setSessionId(session?.user.id ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Con Supabase, los datos se cargan recién cuando hay sesión (RLS lo exige).
  useEffect(() => {
    if (isDemo || !sessionId) return
    let alive = true
    setLoading(true)
    api
      .load()
      .then((d) => {
        if (!alive) return
        setDb(d)
      })
      .catch(report)
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [sessionId])

  const currentUser = sessionId ? (db.users.find((u) => u.id === sessionId) ?? null) : null

  const value: AppCtx = {
    loading,
    demo: isDemo,
    users: db.users,
    projects: db.projects,
    tasks: db.tasks,
    notes: db.notes,
    noteFolders: db.noteFolders,
    minutes: db.minutes,
    currentUser,
    isAdmin: currentUser?.role === 'admin',

    loginDemo(userId) {
      demoSession.set(userId)
      setSessionId(userId)
    },

    async loginEmail(email, password) {
      const { error } = await supabase!.auth.signInWithPassword({ email, password })
      return error ? error.message : null
    },

    async signUpEmail(name, email, password) {
      const { error } = await supabase!.auth.signUp({
        email,
        password,
        options: { data: { name } },
      })
      return error ? error.message : null
    },

    async resetPassword(email) {
      const { error } = await supabase!.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      return error ? error.message : null
    },

    async changePassword(password) {
      const { error } = await supabase!.auth.updateUser({ password })
      return error ? error.message : null
    },

    logout() {
      if (isDemo) {
        demoSession.set(null)
        setSessionId(null)
      } else {
        supabase!.auth.signOut()
      }
    },

    upsertTask(t) {
      setDb((d) => ({ ...d, tasks: upsertIn(d.tasks, t) }))
      api.saveTask(t).catch(report)
    },

    upsertTasks(ts) {
      setDb((d) => {
        let tasks = d.tasks
        for (const t of ts) tasks = upsertIn(tasks, t)
        return { ...d, tasks }
      })
      api.saveTasks(ts).catch(report)
    },

    removeTask(id) {
      setDb((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }))
      api.deleteTask(id).catch(report)
    },

    upsertProject(p) {
      setDb((d) => ({ ...d, projects: upsertIn(d.projects, p) }))
      api.saveProject(p).catch(report)
    },

    removeProject(id) {
      setDb((d) => ({
        ...d,
        projects: d.projects.filter((p) => p.id !== id),
        tasks: d.tasks.filter((t) => t.projectId !== id),
      }))
      api.deleteProject(id).catch(report)
    },

    upsertUser(u) {
      setDb((d) => ({ ...d, users: upsertIn(d.users, u) }))
      api.saveUser(u).catch(report)
    },

    removeUser(id) {
      setDb((d) => ({
        ...d,
        users: d.users.filter((u) => u.id !== id),
        tasks: d.tasks.map((t) => ({ ...t, assigneeIds: t.assigneeIds.filter((a) => a !== id) })),
      }))
      api.deleteUser(id).catch(report)
    },

    upsertNote(n) {
      setDb((d) => ({ ...d, notes: upsertIn(d.notes, n) }))
      api.saveNote(n).catch(report)
    },

    removeNote(id) {
      setDb((d) => ({ ...d, notes: d.notes.filter((n) => n.id !== id) }))
      api.deleteNote(id).catch(report)
    },

    upsertFolder(f) {
      setDb((d) => ({ ...d, noteFolders: upsertIn(d.noteFolders, f) }))
      api.saveFolder(f).catch(report)
    },

    removeFolder(id) {
      // Al borrar una carpeta, sus subcarpetas y notas pasan a la carpeta madre (no se pierden).
      const target = db.noteFolders.find((f) => f.id === id)
      if (!target) return
      const parent = target.parentId
      const movedFolders = db.noteFolders.filter((f) => f.parentId === id).map((f) => ({ ...f, parentId: parent }))
      const movedNotes = db.notes.filter((n) => n.folderId === id).map((n) => ({ ...n, folderId: parent }))
      setDb((d) => ({
        ...d,
        noteFolders: d.noteFolders.filter((f) => f.id !== id).map((f) => (f.parentId === id ? { ...f, parentId: parent } : f)),
        notes: d.notes.map((n) => (n.folderId === id ? { ...n, folderId: parent } : n)),
      }))
      Promise.all([
        ...movedFolders.map((f) => api.saveFolder(f)),
        ...movedNotes.map((n) => api.saveNote(n)),
      ])
        .then(() => api.deleteFolder(id))
        .catch(report)
    },

    upsertMinute(m) {
      setDb((d) => ({ ...d, minutes: upsertIn(d.minutes, m) }))
      api.saveMinute(m).catch(report)
    },

    removeMinute(id) {
      setDb((d) => ({ ...d, minutes: d.minutes.filter((m) => m.id !== id) }))
      api.deleteMinute(id).catch(report)
    },
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp debe usarse dentro de <AppProvider>')
  return ctx
}
