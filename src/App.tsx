import { useState } from 'react'
import { FEATURE_KICKOFF, FEATURE_PANEL, type Task } from './types'
import { todayKey } from './lib/utils'
import { AppProvider, useApp } from './state/AppContext'
import TopBar, { BottomNav, type View } from './components/TopBar'
import TaskEditor from './components/TaskEditor'
import Login from './views/Login'
import MiDia from './views/MiDia'
import Agenda from './views/Agenda'
import Kanban from './views/Kanban'
import Hitos from './views/Hitos'
import Minutas from './views/Minutas'
import Kickoff from './views/Kickoff'
import Cuaderno from './views/Cuaderno'
import Proyectos from './views/Proyectos'
import Panel from './views/Panel'
import Equipo from './views/Equipo'
import CRM from './crm/CRM'
import { CrmProvider } from './crm/CrmProvider'
import { useCrm } from './crm/contexto'

export default function App() {
  return (
    <AppProvider>
      <CrmProvider>
        <Shell />
      </CrmProvider>
    </AppProvider>
  )
}

interface EditorState {
  task?: Task
  defaults?: Partial<Task>
}

function Shell() {
  const { loading, currentUser, isAdmin, hasFlag } = useApp()
  const { tieneAcceso: accesoCrm } = useCrm()
  const [rawView, setView] = useState<View>('midia')
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [noteToOpen, setNoteToOpen] = useState<string | null>(null)

  // Pestañas detrás de llave: si la llave está apagada, se muestra Mi Día.
  const view: View =
    (rawView === 'kickoff' && !hasFlag(FEATURE_KICKOFF)) ||
    (rawView === 'panel' && !(hasFlag(FEATURE_PANEL) && isAdmin)) ||
    (rawView === 'crm' && !accesoCrm)
      ? 'midia'
      : rawView

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
        {view === 'hitos' && <Hitos onEditTask={(t) => setEditor({ task: t })} />}
        {view === 'minutas' && <Minutas onEditTask={(t) => setEditor({ task: t })} />}
        {view === 'kickoff' && (
          <Kickoff onEditTask={(t) => setEditor({ task: t })} onIrAMinutas={() => setView('minutas')} />
        )}
        {view === 'cuaderno' && <Cuaderno openNoteId={noteToOpen} onNoteOpened={() => setNoteToOpen(null)} />}
        {view === 'proyectos' && (
          <Proyectos
            onEditTask={(t) => setEditor({ task: t })}
            onNewTask={(defaults) => setEditor({ defaults: { date: todayKey(), ...defaults } })}
          />
        )}
        {view === 'panel' && (
          <Panel
            onEditTask={(t) => setEditor({ task: t })}
            onNewTask={(defaults) => setEditor({ defaults: { date: todayKey(), ...defaults } })}
          />
        )}
        {view === 'crm' && <CRM />}
        {view === 'equipo' && <Equipo onEditTask={(t) => setEditor({ task: t })} />}
      </main>
      <BottomNav view={view} setView={setView} />
      {editor && <TaskEditor task={editor.task} defaults={editor.defaults} onClose={() => setEditor(null)} />}
    </div>
  )
}
