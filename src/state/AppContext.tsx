import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Consejo, DB, FeatureFlag, Hito, Kickoff, KickoffAnotacion, KickoffBriefing, Minute, Note, NoteFolder, Pin, Project, Task, TaskComment, User } from '../types'
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
  featureFlags: FeatureFlag[]
  taskComments: TaskComment[]
  consejos: Consejo[]
  kickoffs: Kickoff[]
  kickoffBriefings: KickoffBriefing[]
  kickoffAnotaciones: KickoffAnotacion[]
  currentUser: User | null
  isAdmin: boolean
  /** ¿Está prendida esta llave para el usuario dado (o el actual)? La fila por-usuario gana sobre la global. */
  hasFlag: (flag: string, userId?: string) => boolean
  /** Vuelve a traer todo de la base (botón "Actualizar" del Panel). */
  reload: () => void
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
  upsertFeatureFlag: (f: FeatureFlag) => void
  removeFeatureFlag: (id: string) => void
  upsertTaskComment: (c: TaskComment) => void
  removeTaskComment: (id: string) => void
  upsertConsejo: (c: Consejo) => void
  removeConsejo: (id: string) => void
  upsertKickoff: (k: Kickoff) => void
  removeKickoff: (id: string) => void
  upsertKickoffBriefing: (b: KickoffBriefing) => void
  removeKickoffBriefing: (id: string) => void
  upsertKickoffAnotacion: (a: KickoffAnotacion) => void
  removeKickoffAnotacion: (id: string) => void
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

/**
 * Estampa automática de fechas al guardar una tarea, comparando contra su
 * versión anterior: cuándo se completó y desde cuándo espera una decisión
 * del Gerente. Centralizado acá para cubrir todos los caminos (editor,
 * checkboxes, drag del Kanban) sin tocar cada vista.
 */
function conEstampas(prev: Task | undefined, t: Task): Task {
  let out = t
  if (t.status === 'done' && prev?.status !== 'done' && !t.completedAt) {
    out = { ...out, completedAt: new Date().toISOString() }
  } else if (t.status !== 'done' && t.completedAt) {
    out = { ...out, completedAt: null }
  }
  if (t.necesitaDecisionGg && !prev?.necesitaDecisionGg && !t.necesitaDecisionDesde) {
    out = { ...out, necesitaDecisionDesde: new Date().toISOString() }
  } else if (!t.necesitaDecisionGg && t.necesitaDecisionDesde) {
    out = { ...out, necesitaDecisionDesde: null }
  }
  return out
}

// Campos "pesados" que Postgres puede omitir en los avisos de tiempo real
// cuando no cambiaron (columnas grandes): si faltan en el aviso, conservamos
// el valor local en vez de pisarlo con un vacío.
const CAMPOS_PESADOS: Record<string, [string, string][]> = {
  tasks: [
    ['links', 'links'],
    ['checklist', 'checklist'],
    ['description', 'description'],
    ['assignee_ids', 'assigneeIds'],
  ],
  notes: [
    ['content', 'content'],
    ['shared_with', 'sharedWith'],
  ],
  minutes: [
    ['actions', 'actions'],
    ['summary', 'summary'],
    ['participant_ids', 'participantIds'],
    ['transcripcion', 'transcripcion'],
  ],
}

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
    featureFlags: [],
    taskComments: [],
    consejos: [],
    kickoffs: [],
    kickoffBriefings: [],
    kickoffAnotaciones: [],
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
            const raw = payload.new as Record<string, unknown>
            const item = map(raw) as { id: string } & Record<string, unknown>
            const lista = d[key] as unknown as ({ id: string } & Record<string, unknown>)[]
            const prev = lista.find((x) => x.id === item.id)
            if (prev) {
              for (const [rawKey, entKey] of CAMPOS_PESADOS[table] ?? []) {
                if (raw[rawKey] === undefined) item[entKey] = prev[entKey]
              }
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return { ...d, [key]: upsertIn(lista as any[], item) }
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
    featureFlags: db.featureFlags,
    taskComments: db.taskComments,
    consejos: db.consejos,
    kickoffs: db.kickoffs,
    kickoffBriefings: db.kickoffBriefings,
    kickoffAnotaciones: db.kickoffAnotaciones,
    currentUser,
    isAdmin: currentUser?.role === 'admin',

    hasFlag(flag, userId) {
      const target = userId ?? currentUser?.id
      if (!target) return false
      const own = db.featureFlags.find((f) => f.flag === flag && f.userId === target)
      if (own) return own.enabled
      return db.featureFlags.find((f) => f.flag === flag && f.userId === null)?.enabled ?? false
    },

    reload() {
      api.load().then(setDb).catch(report)
    },

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
      const final = conEstampas(db.tasks.find((x) => x.id === t.id), t)
      setDb((d) => ({ ...d, tasks: upsertIn(d.tasks, final) }))
      api.saveTask(final).catch(report)
    },

    upsertTasks(ts) {
      const finales = ts.map((t) => conEstampas(db.tasks.find((x) => x.id === t.id), t))
      setDb((d) => {
        let tasks = d.tasks
        for (const t of finales) tasks = upsertIn(tasks, t)
        return { ...d, tasks }
      })
      api.saveTasks(finales).catch(report)
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

    upsertFeatureFlag(f) {
      // Una sola fila por (flag, userId): si ya existe con otro id, se actualiza esa.
      const existing = db.featureFlags.find((x) => x.flag === f.flag && x.userId === f.userId)
      const item = existing ? { ...f, id: existing.id } : f
      setDb((d) => ({ ...d, featureFlags: upsertIn(d.featureFlags, item) }))
      api.saveFeatureFlag(item).catch(report)
    },

    removeFeatureFlag(id) {
      setDb((d) => ({ ...d, featureFlags: d.featureFlags.filter((f) => f.id !== id) }))
      api.deleteFeatureFlag(id).catch(report)
    },

    upsertTaskComment(c) {
      setDb((d) => ({ ...d, taskComments: upsertIn(d.taskComments, c) }))
      api.saveTaskComment(c).catch(report)
    },

    removeTaskComment(id) {
      setDb((d) => ({ ...d, taskComments: d.taskComments.filter((c) => c.id !== id) }))
      api.deleteTaskComment(id).catch(report)
    },

    upsertConsejo(c) {
      setDb((d) => ({ ...d, consejos: upsertIn(d.consejos, c) }))
      api.saveConsejo(c).catch(report)
    },

    removeConsejo(id) {
      setDb((d) => ({ ...d, consejos: d.consejos.filter((c) => c.id !== id) }))
      api.deleteConsejo(id).catch(report)
    },

    upsertKickoff(k) {
      setDb((d) => ({ ...d, kickoffs: upsertIn(d.kickoffs, k) }))
      api.saveKickoff(k).catch(report)
    },

    removeKickoff(id) {
      setDb((d) => ({
        ...d,
        kickoffs: d.kickoffs.filter((k) => k.id !== id),
        kickoffBriefings: d.kickoffBriefings.filter((b) => b.kickoffId !== id),
        kickoffAnotaciones: d.kickoffAnotaciones.filter((a) => a.kickoffId !== id),
      }))
      api.deleteKickoff(id).catch(report)
    },

    upsertKickoffBriefing(b) {
      // Una sola fila por (kickoff, usuario): si ya existe con otro id, se actualiza esa.
      const existing = db.kickoffBriefings.find((x) => x.kickoffId === b.kickoffId && x.usuarioId === b.usuarioId)
      const item = existing ? { ...b, id: existing.id } : b
      setDb((d) => ({ ...d, kickoffBriefings: upsertIn(d.kickoffBriefings, item) }))
      api.saveKickoffBriefing(item).catch(report)
    },

    removeKickoffBriefing(id) {
      setDb((d) => ({ ...d, kickoffBriefings: d.kickoffBriefings.filter((b) => b.id !== id) }))
      api.deleteKickoffBriefing(id).catch(report)
    },

    upsertKickoffAnotacion(a) {
      setDb((d) => ({ ...d, kickoffAnotaciones: upsertIn(d.kickoffAnotaciones, a) }))
      api.saveKickoffAnotacion(a).catch(report)
    },

    removeKickoffAnotacion(id) {
      setDb((d) => ({ ...d, kickoffAnotaciones: d.kickoffAnotaciones.filter((a) => a.id !== id) }))
      api.deleteKickoffAnotacion(id).catch(report)
    },
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp debe usarse dentro de <AppProvider>')
  return ctx
}
