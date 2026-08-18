import { useMemo, useRef, useState, useEffect } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Bold,
  ChevronRight,
  Folder,
  FolderPlus,
  Italic,
  Layers,
  List,
  ListOrdered,
  NotebookPen,
  Pencil,
  Pin,
  Plus,
  Search,
  SquarePen,
  Trash2,
  Underline,
} from 'lucide-react'
import type { Note, NoteFolder } from '../types'
import { noteDate, stripHtml, uid } from '../lib/utils'
import { useApp } from '../state/AppContext'
import Modal, { Field, inputCls } from '../components/Modal'

export default function Cuaderno() {
  const { notes, noteFolders, currentUser, upsertNote, removeNote, upsertFolder, removeFolder } = useApp()
  const me = currentUser!

  const [selectedFolderId, setSelectedFolderId] = useState<string | 'all'>('all')
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [folderModal, setFolderModal] = useState<
    { mode: 'new'; parentId: string | null } | { mode: 'rename'; folder: NoteFolder } | null
  >(null)

  const myFolders = useMemo(
    () => noteFolders.filter((f) => f.userId === me.id).sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)),
    [noteFolders, me.id],
  )
  const myNotes = useMemo(() => notes.filter((n) => n.userId === me.id), [notes, me.id])

  const childrenOf = (id: string | null) => myFolders.filter((f) => f.parentId === id)
  const notesIn = (folderId: string | 'all') =>
    folderId === 'all' ? myNotes : myNotes.filter((n) => n.folderId === folderId)

  const q = search.trim().toLowerCase()
  const listNotes = notesIn(selectedFolderId)
    .filter((n) => !q || n.title.toLowerCase().includes(q) || stripHtml(n.content).toLowerCase().includes(q))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))

  const selectedNote = myNotes.find((n) => n.id === selectedNoteId) ?? null
  const selectedFolder = selectedFolderId === 'all' ? null : myFolders.find((f) => f.id === selectedFolderId)

  const createNote = () => {
    const n: Note = {
      id: uid(),
      userId: me.id,
      folderId: selectedFolderId === 'all' ? null : selectedFolderId,
      title: '',
      content: '',
      pinned: false,
      updatedAt: new Date().toISOString(),
    }
    upsertNote(n)
    setSelectedNoteId(n.id)
  }

  const deleteNote = (n: Note) => {
    if (confirm(`¿Eliminar la nota "${n.title || 'Nota nueva'}"?`)) {
      removeNote(n.id)
      if (selectedNoteId === n.id) setSelectedNoteId(null)
    }
  }

  const deleteFolder = (f: NoteFolder) => {
    if (confirm(`¿Eliminar la carpeta "${f.name}"? Sus notas y subcarpetas se moverán a la carpeta madre.`)) {
      removeFolder(f.id)
      if (selectedFolderId === f.id) setSelectedFolderId('all')
    }
  }

  const toggleCollapse = (id: string) =>
    setCollapsed((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const renderFolder = (f: NoteFolder, depth: number) => {
    const kids = childrenOf(f.id)
    const open = !collapsed.has(f.id)
    const active = selectedFolderId === f.id
    const count = myNotes.filter((n) => n.folderId === f.id).length
    return (
      <div key={f.id}>
        <div
          onClick={() => setSelectedFolderId(f.id)}
          className={`group/f flex cursor-pointer items-center gap-1 rounded-lg py-1.5 pr-2 transition ${
            active ? 'bg-blue-100/70 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
          }`}
          style={{ paddingLeft: 6 + depth * 14 }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (kids.length) toggleCollapse(f.id)
            }}
            className={`grid size-4 shrink-0 place-items-center text-slate-300 ${kids.length ? 'hover:text-slate-500' : 'opacity-0'}`}
          >
            <ChevronRight size={13} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
          </button>
          <Folder size={14} className={active ? 'text-blue-500' : 'text-slate-400'} />
          <span className="flex-1 truncate text-[13px] font-bold">{f.name}</span>
          <span className="hidden items-center gap-0.5 group-hover/f:flex">
            <button
              title="Nueva subcarpeta"
              onClick={(e) => {
                e.stopPropagation()
                setFolderModal({ mode: 'new', parentId: f.id })
              }}
              className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-blue-600"
            >
              <Plus size={13} />
            </button>
            <button
              title="Renombrar"
              onClick={(e) => {
                e.stopPropagation()
                setFolderModal({ mode: 'rename', folder: f })
              }}
              className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-slate-600"
            >
              <Pencil size={12} />
            </button>
            <button
              title="Eliminar carpeta"
              onClick={(e) => {
                e.stopPropagation()
                deleteFolder(f)
              }}
              className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-red-500"
            >
              <Trash2 size={12} />
            </button>
          </span>
          <span className="text-[10px] font-bold text-slate-300 group-hover/f:hidden">{count || ''}</span>
        </div>
        {open && kids.map((k) => renderFolder(k, depth + 1))}
      </div>
    )
  }

  const pinnedNotes = listNotes.filter((n) => n.pinned)
  const otherNotes = listNotes.filter((n) => !n.pinned)

  const noteItem = (n: Note) => {
    const active = selectedNoteId === n.id
    return (
      <button
        key={n.id}
        onClick={() => setSelectedNoteId(n.id)}
        className={`group/n block w-full rounded-xl px-3 py-2.5 text-left transition ${
          active ? 'bg-blue-600 text-white' : 'hover:bg-slate-100'
        }`}
      >
        <span className="flex items-center gap-1.5">
          <span className={`flex-1 truncate text-sm font-extrabold ${active ? 'text-white' : 'text-slate-700'}`}>
            {n.title || 'Nota nueva'}
          </span>
          <span
            role="button"
            title={n.pinned ? 'Desfijar' : 'Fijar arriba'}
            onClick={(e) => {
              e.stopPropagation()
              upsertNote({ ...n, pinned: !n.pinned })
            }}
            className={`rounded p-0.5 ${
              n.pinned
                ? active
                  ? 'text-amber-300'
                  : 'text-amber-500'
                : `opacity-0 group-hover/n:opacity-100 ${active ? 'text-blue-200 hover:text-white' : 'text-slate-300 hover:text-amber-500'}`
            }`}
          >
            <Pin size={13} className={n.pinned ? 'fill-current' : ''} />
          </span>
        </span>
        <span className={`mt-0.5 block truncate text-[11px] font-semibold ${active ? 'text-blue-100' : 'text-slate-400'}`}>
          {format(new Date(n.updatedAt), 'd MMM', { locale: es })} · {stripHtml(n.content).slice(0, 70) || 'Sin contenido'}
        </span>
      </button>
    )
  }

  return (
    <div className="flex h-full">
      {/* Columna 1: árbol de carpetas */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-slate-50/70">
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <span className="text-[11px] font-extrabold tracking-wider text-slate-400 uppercase">Mi Cuaderno</span>
          <button
            title="Nueva carpeta"
            onClick={() => setFolderModal({ mode: 'new', parentId: null })}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-blue-600"
          >
            <FolderPlus size={16} />
          </button>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          <div
            onClick={() => setSelectedFolderId('all')}
            className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 transition ${
              selectedFolderId === 'all' ? 'bg-blue-100/70 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers size={14} className={selectedFolderId === 'all' ? 'text-blue-500' : 'text-slate-400'} />
            <span className="flex-1 text-[13px] font-bold">Todas las notas</span>
            <span className="text-[10px] font-bold text-slate-300">{myNotes.length}</span>
          </div>
          {childrenOf(null).map((f) => renderFolder(f, 0))}
        </div>
        <p className="border-t border-slate-200 px-3 py-2 text-[10px] font-semibold text-slate-300">
          🔒 Tus notas son privadas: nadie más del equipo puede verlas.
        </p>
      </aside>

      {/* Columna 2: lista de notas */}
      <div className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
          <span className="truncate font-extrabold text-slate-700">
            {selectedFolder ? selectedFolder.name : 'Todas las notas'}
          </span>
          <button
            title="Nueva nota"
            onClick={createNote}
            className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50"
          >
            <SquarePen size={17} />
          </button>
        </div>
        <div className="px-3 pb-2">
          <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5">
            <Search size={13} className="text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar…"
              className="w-full bg-transparent text-[13px] font-semibold text-slate-600 outline-none placeholder:text-slate-400"
            />
          </div>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {pinnedNotes.length > 0 && (
            <p className="px-2 pt-1 pb-0.5 text-[10px] font-extrabold tracking-wider text-slate-300 uppercase">
              📌 Fijadas
            </p>
          )}
          {pinnedNotes.map(noteItem)}
          {pinnedNotes.length > 0 && otherNotes.length > 0 && (
            <p className="px-2 pt-2 pb-0.5 text-[10px] font-extrabold tracking-wider text-slate-300 uppercase">Notas</p>
          )}
          {otherNotes.map(noteItem)}
          {listNotes.length === 0 && (
            <p className="px-3 py-8 text-center text-sm font-semibold text-slate-300">
              {q ? 'No se encontraron notas.' : 'Esta carpeta está vacía.'}
            </p>
          )}
        </div>
      </div>

      {/* Columna 3: editor */}
      <div className="flex min-w-0 flex-1 flex-col bg-white">
        {selectedNote ? (
          <NoteEditor
            key={selectedNote.id}
            note={selectedNote}
            onSave={(patch) => upsertNote({ ...selectedNote, ...patch, updatedAt: new Date().toISOString() })}
            onDelete={() => deleteNote(selectedNote)}
          />
        ) : (
          <div className="grid flex-1 place-items-center">
            <div className="text-center">
              <NotebookPen size={40} className="mx-auto text-slate-200" />
              <p className="mt-3 text-sm font-bold text-slate-300">Elegí una nota o creá una nueva</p>
              <button
                onClick={createNote}
                className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-700"
              >
                + Nueva nota
              </button>
            </div>
          </div>
        )}
      </div>

      {folderModal && (
        <FolderModal
          state={folderModal}
          onClose={() => setFolderModal(null)}
          onSave={(name) => {
            if (folderModal.mode === 'rename') {
              upsertFolder({ ...folderModal.folder, name })
            } else {
              upsertFolder({
                id: uid(),
                userId: me.id,
                name,
                parentId: folderModal.parentId,
                position: childrenOf(folderModal.parentId).length,
              })
              if (folderModal.parentId) setCollapsed((s) => {
                const next = new Set(s)
                next.delete(folderModal.parentId!)
                return next
              })
            }
            setFolderModal(null)
          }}
        />
      )}
    </div>
  )
}

/* ---- Editor de texto enriquecido (minimalista, estilo Notas) ---- */

function NoteEditor({
  note,
  onSave,
  onDelete,
}: {
  note: Note
  onSave: (patch: Partial<Note>) => void
  onDelete: () => void
}) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.innerHTML = note.content
    return () => window.clearTimeout(timer.current)
    // Solo al montar: el contenido vive en el DOM mientras se edita.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveContent = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => onSave({ content: bodyRef.current?.innerHTML ?? '' }), 350)
  }

  const exec = (cmd: string) => {
    document.execCommand(cmd)
    bodyRef.current?.focus()
    saveContent()
  }

  const toolBtn = 'rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700'

  return (
    <>
      <div className="flex items-center gap-0.5 border-b border-slate-100 px-4 py-2">
        <button title="Negrita" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('bold')} className={toolBtn}>
          <Bold size={15} />
        </button>
        <button title="Cursiva" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('italic')} className={toolBtn}>
          <Italic size={15} />
        </button>
        <button title="Subrayado" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('underline')} className={toolBtn}>
          <Underline size={15} />
        </button>
        <span className="mx-1 h-4 w-px bg-slate-200" />
        <button title="Lista con viñetas" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('insertUnorderedList')} className={toolBtn}>
          <List size={15} />
        </button>
        <button title="Lista numerada" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('insertOrderedList')} className={toolBtn}>
          <ListOrdered size={15} />
        </button>
        <span className="ml-auto flex items-center gap-1">
          <button
            title={note.pinned ? 'Desfijar' : 'Fijar arriba'}
            onClick={() => onSave({ pinned: !note.pinned })}
            className={`rounded-md p-1.5 transition hover:bg-slate-100 ${note.pinned ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}`}
          >
            <Pin size={15} className={note.pinned ? 'fill-current' : ''} />
          </button>
          <button title="Eliminar nota" onClick={onDelete} className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500">
            <Trash2 size={15} />
          </button>
        </span>
      </div>
      <div className="px-6 pt-4">
        <input
          value={note.title}
          onChange={(e) => onSave({ title: e.target.value })}
          placeholder="Título de la nota"
          className="w-full text-2xl font-black text-slate-800 outline-none placeholder:text-slate-200"
        />
        <p className="mt-1 text-[11px] font-semibold text-slate-300">Editado el {noteDate(note.updatedAt)}</p>
      </div>
      <div
        ref={bodyRef}
        contentEditable
        onInput={saveContent}
        data-placeholder="Escribí acá…"
        className="mt-2 flex-1 overflow-y-auto px-6 pb-8 text-[15px] leading-relaxed text-slate-700 outline-none [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
      />
    </>
  )
}

function FolderModal({
  state,
  onClose,
  onSave,
}: {
  state: { mode: 'new'; parentId: string | null } | { mode: 'rename'; folder: NoteFolder }
  onClose: () => void
  onSave: (name: string) => void
}) {
  const [name, setName] = useState(state.mode === 'rename' ? state.folder.name : '')
  return (
    <Modal title={state.mode === 'rename' ? 'Renombrar carpeta' : 'Nueva carpeta'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) onSave(name.trim())
        }}
        className="space-y-4"
      >
        <Field label="Nombre de la carpeta">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Reuniones" className={inputCls} autoFocus />
        </Field>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            Guardar
          </button>
        </div>
      </form>
    </Modal>
  )
}
