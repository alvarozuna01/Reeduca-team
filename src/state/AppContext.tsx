import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { DB, Hito, Minute, Note, NoteFolder, Pin, Project, Task, User } from '../types'
import { api, isDemo } from '../lib/api'
import { DB_KEY, demoSession } from '../lib/localApi'
import { REALTIME_TABLES } from '../lib/supabaseApi'
import { supabase } from '../lib/supabaseClient'
import { USER_COLORS } from '../lib/utils'

interface AppCtx {
  loading: boolean
  demo: boolean
  dataError: string | null
  users: User[]
  projects: Project[]
  tasks: Task[]
  notes: Note[]
  noteFolders: NoteFolder[]
  minutes: Minute[]
  pins: Pin[]
  hitos: Hito[]
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
  upsertPin: (p: Pin) => void
  removePin: (id: string) => void
  upsertHito: (h: Hito) => void
  removeHito: (id: string) => void
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
  const [db, setDb] = useState<DB>({
    users: [],
    projects: [],
    tasks: [],
    hitos: [],
    notes: [],
    noteFolders: [],
    minutes: [],
    pins: [],
  })
  const [loading, setLoading] = useState(true)
  const [sessionId, setSessionId] = useState<string | null>(() => (isDemo ? demoSession.get() : null))
  const [sessionMeta, setSessionMeta] = useState<{ email: string; name: string } | null>(null)
  const [dataError, setDataError] = useState<string | null>(null)

  // Arranque: en demo cargamos directo; con Supabase primero resolvemos la sesión.
  useEffect(() => {
    if (isDemo) {
      api.load().then((d) => {
        setDb(d)
        setLoading(false)
      })
      // "Tiempo real" del modo demo: si otra pestaña del mismo navegador
      // cambia los datos, esta pestaña se entera y se actualiza sola.
      const onStorage = (e: StorageEvent) => {
        if (e.key === DB_KEY) api.load().then(setDb)
      }
      window.addEventListener('storage', onStorage)
      return () => window.removeEventListener('storage', onStorage)
    }
    const applySession = (session: Session | null) => {
      const u = session?.user
      setSessionId(u?.id ?? null)
      setSessionMeta(
        u
          ? {
              email: u.email ?? '',
              name: (u.user_metadata?.name as string) || u.email?.split('@')[0] || 'Usuario',
            }
          : null,
      )
    }
    supabase!.auth.getSession().then(({ data }) => {
      applySession(data.session)
      if (!data.session) setLoading(false)
    })
    const { data: sub } = supabase!.auth.onAuthStateChange((_event, session) => {
      applySession(session)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Con Supabase, los datos se cargan recién cuando hay sesión (RLS lo exige).
  useEffect(() => {
    if (isDemo || !sessionId) return
    let alive = true
    setLoading(true)
    setDataError(null)
    api
      .load()
      .then(async (loaded) => {
        let d = loaded
        // Autocuración: si la cuenta no tiene perfil (p. ej. se registró antes de
        // correr schema.sql), se lo creamos acá. La primera persona queda como admin.
        if (!d.users.some((u) => u.id === sessionId)) {
          const profile: User = {
            id: sessionId,
            name: sessionMeta?.name ?? 'Usuario',
            email: sessionMeta?.email ?? '',
            role: d.users.length === 0 ? 'admin' : 'member',
            color: USER_COLORS[d.users.length % USER_COLORS.length],
          }
          await api.saveUser(profile)
          d = { ...d, users: [...d.users, profile] }
        }
        if (alive) setDb(d)
      })
      .catch((e) => {
        report(e)
        if (alive) setDataError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [sessionId, sessionMeta])

  // Tiempo real (Supabase Realtime): cualquier cambio que haga otra persona
  // en la base llega acá y se aplica al estado local al instante, sin recargar.
  useEffect(() => {
    if (isDemo || !sessionId || !supabase) return
    const sb = supabase
    const channel = sb.channel('cambios-en-vivo')
    for (const { table, key, map } of REALTIME_TABLES) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => {
          setDb((d) => {
            if (payload.eventType === 'DELETE') {
              const id = (payload.old as { id?: string }).id
              if (!id) return d
              return { ...d, [key]: (d[key] as { id: string }[]).filter((x) => x.id !== id) }
            }
            const item = map(payload.new)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return { ...d, [key]: upsertIn(d[key] as any[], item) }
          })
        },
      )
    }
    channel.subscribe()
    return () => {
      sb.removeChannel(channel)
    }
  }, [sessionId])

  const currentUser = sessionId ? (db.users.find((u) => u.id === sessionId) ?? null) : null

  const value: AppCtx = {
    loading,
    demo: isDemo,
    dataError,
    users: db.users,
    projects: db.projects,
    tasks: db.tasks,
    notes: db.notes,
    noteFolders: db.noteFolders,
    minutes: db.minutes,
    pins: db.pins,
    hitos: db.hitos,
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
        hitos: d.hitos.filter((h) => h.projectId !== id),
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

    upsertPin(p) {
      setDb((d) => ({ ...d, pins: upsertIn(d.pins, p) }))
      api.savePin(p).catch(report)
    },

    removePin(id) {
      setDb((d) => ({ ...d, pins: d.pins.filter((p) => p.id !== id) }))
      api.deletePin(id).catch(report)
    },

    upsertHito(h) {
      setDb((d) => ({ ...d, hitos: upsertIn(d.hitos, h) }))
      api.saveHito(h).catch(report)
    },

    removeHito(id) {
      setDb((d) => ({
        ...d,
        hitos: d.hitos.filter((h) => h.id !== id),
        tasks: d.tasks.map((t) => (t.hitoId === id ? { ...t, hitoId: null } : t)),
      }))
      api.deleteHito(id).catch(report)
    },
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp debe usarse dentro de <AppProvider>')
  return ctx
}
