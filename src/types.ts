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
}

export interface Minute {
  id: string
  title: string
  date: string // YYYY-MM-DD
  participantIds: string[]
  summary: string
  actions: MinuteAction[]
}

export interface DB {
  users: User[]
  projects: Project[]
  tasks: Task[]
  hitos: Hito[]
  notes: Note[]
  noteFolders: NoteFolder[]
  minutes: Minute[]
  pins: Pin[]
}
