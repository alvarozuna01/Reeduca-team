import { useState } from 'react'
import type { Task } from './types'
import { todayKey } from './lib/utils'
import { AppProvider, useApp } from './state/AppContext'
import TopBar, { BottomNav, type View } from './components/TopBar'
import TaskEditor from './components/TaskEditor'
import Login from './views/Login'
import MiDia from './views/MiDia'
import Agenda from './views/Agenda'
import Kanban from './views/Kanban'
import Minutas from './views/Minutas'
import Cuaderno from './views/Cuaderno'
import Proyectos from './views/Proyectos'
import Equipo from './views/Equipo'

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}

interface EditorState {
  task?: Task
  defaults?: Partial<Task>
}

function Shell() {
  const { loading, currentUser } = useApp()
  const [view, setView] = useState<View>('midia')
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [noteToOpen, setNoteToOpen] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="grid h-full place-items-center">
        <div className="flex flex-col items-center gap-3">
          <span className="size-8 animate-spin rounded-full border-[3px] border-blue-600 border-t-transparent" />
          <p className="text-sm font-bold text-slate-400">Cargando…</p>
        </div>
      </div>
    )
  }

  if (!currentUser) return <Login />

  return (
    <div className="flex h-full flex-col">
      <TopBar view={view} setView={setView} onNew={() => setEditor({ defaults: { date: todayKey() } })} />
      <main className="min-h-0 flex-1 pb-[calc(3.6rem+env(safe-area-inset-bottom))] md:pb-0">
        {view === 'midia' && (
          <MiDia
            onEdit={(t) => setEditor({ task: t })}
            onOpenNote={(id) => {
              setNoteToOpen(id)
              setView('cuaderno')
            }}
          />
        )}
        {view === 'agenda' && (
          <Agenda onEdit={(t) => setEditor({ task: t })} onNew={(defaults) => setEditor({ defaults })} />
        )}
        {view === 'kanban' && <Kanban onEdit={(t) => setEditor({ task: t })} />}
        {view === 'minutas' && <Minutas onEditTask={(t) => setEditor({ task: t })} />}
        {view === 'cuaderno' && <Cuaderno openNoteId={noteToOpen} onNoteOpened={() => setNoteToOpen(null)} />}
        {view === 'proyectos' && <Proyectos />}
        {view === 'equipo' && <Equipo onEditTask={(t) => setEditor({ task: t })} />}
      </main>
      <BottomNav view={view} setView={setView} />
      {editor && <TaskEditor task={editor.task} defaults={editor.defaults} onClose={() => setEditor(null)} />}
    </div>
  )
}
