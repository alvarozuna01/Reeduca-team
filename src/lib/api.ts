import type { DB, Minute, Note, NoteFolder, Pin, Project, Task, User } from '../types'
import { localApi } from './localApi'
import { supabaseApi } from './supabaseApi'
import { supabase } from './supabaseClient'

/**
 * Contrato de la capa de datos. Hay dos implementaciones:
 *  - localApi   → "modo demo": todo se guarda en el navegador (localStorage).
 *  - supabaseApi → producción: Postgres + Auth de Supabase (gratis).
 * La app elige sola según exista o no la configuración en .env.
 */
export interface Api {
  mode: 'demo' | 'supabase'
  load(): Promise<DB>
  saveTask(t: Task): Promise<void>
  saveTasks(ts: Task[]): Promise<void>
  deleteTask(id: string): Promise<void>
  saveProject(p: Project): Promise<void>
  deleteProject(id: string): Promise<void>
  saveUser(u: User): Promise<void>
  deleteUser(id: string): Promise<void>
  saveNote(n: Note): Promise<void>
  deleteNote(id: string): Promise<void>
  saveFolder(f: NoteFolder): Promise<void>
  deleteFolder(id: string): Promise<void>
  saveMinute(m: Minute): Promise<void>
  deleteMinute(id: string): Promise<void>
  savePin(p: Pin): Promise<void>
  deletePin(id: string): Promise<void>
}

export const api: Api = supabase ? supabaseApi : localApi
export const isDemo = api.mode === 'demo'
