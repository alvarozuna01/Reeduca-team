import { useMemo, useRef, useState, useEffect } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Bold,
  ChevronLeft,
  ChevronRight,
  FileDown,
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
  Share2,
  SquarePen,
  Sunrise,
  Trash2,
  Underline,
  Users as UsersIcon,
} from 'lucide-react'
import type { Note, NoteFolder, User } from '../types'
import { noteDate, stripHtml, uid } from '../lib/utils'
import { useIsMobile } from '../lib/useIsMobile'
import { isDemo } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import { useApp } from '../state/AppContext'
import { Avatar, AvatarStack } from '../components/Avatar'
import Modal, { Field, inputCls } from '../components/Modal'

export default function Cuaderno({
  openNoteId,
  onNoteOpened,
}: {
  openNoteId?: string | null
  onNoteOpened?: () => void
}) {
  const {
    notes,
    noteFolders,
    users,
    pins,
    currentUser,
    upsertNote,
    removeNote,
    upsertFolder,
    removeFolder,
    upsertPin,
    removePin,
  } = useApp()
  const me = currentUser!
  const isMobile = useIsMobile()

  const [selectedFolderId, setSelectedFolderId] = useState<string>('all') // 'all' | 'shared' | id de carpeta
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  // En celular se ve una pantalla por vez: carpetas → lista → editor
  const [pane, setPane] = useState<'folders' | 'list' | 'editor'>('list')

  const pickFolder = (id: string) => {
    setSelectedFolderId(id)
    if (isMobile) setPane('list')
  }
  const pickNote = (id: string) => {
    setSelectedNoteId(id)
    if (isMobile) setPane('editor')
  }
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [folderModal, setFolderModal] = useState<
    { mode: 'new'; parentId: string | null } | { mode: 'rename'; folder: NoteFolder } | null
  >(null)

  const myFolders = useMemo(
    () =>
      noteFolders
        .filter((f) => f.userId === me.id)
        .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)),
    [noteFolders, me.id],
  )
  const ownNotes = useMemo(() => notes.filter((n) => n.userId === me.id), [notes, me.id])
  const sharedNotes = useMemo(
    () => notes.filter((n) => n.userId !== me.id && n.sharedWith.includes(me.id)),
    [notes, me.id],
  )

  const childrenOf = (id: string | null) => myFolders.filter((f) => f.parentId === id)
  const notesIn = (sel: string) =>
    sel === 'all' ? ownNotes : sel === 'shared' ? sharedNotes : ownNotes.filter((n) => n.folderId === sel)

  const q = search.trim().toLowerCase()
  const listNotes = notesIn(selectedFolderId)
    .filter((n) => !q || n.title.toLowerCase().includes(q) || stripHtml(n.content).toLowerCase().includes(q))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))

  const selectedNote =
    [...ownNotes, ...sharedNotes].find((n) => n.id === selectedNoteId) ?? null
  const selectedFolder =
    selectedFolderId !== 'all' && selectedFolderId !== 'shared'
      ? myFolders.find((f) => f.id === selectedFolderId)
      : null

  // Apertura directa desde "Mi Día" (Fijados)
  useEffect(() => {
    if (!openNoteId) return
    const n = notes.find((x) => x.id === openNoteId)
    if (n) {
      setSelectedNoteId(n.id)
      setSelectedFolderId(n.userId === me.id ? (n.folderId ?? 'all') : 'shared')
      if (isMobile) setPane('editor')
    }
    onNoteOpened?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openNoteId])

  // Presencia: quiénes más están mirando esta nota (solo con Supabase)
  const [viewerIds, setViewerIds] = useState<string[]>([])
  useEffect(() => {
    setViewerIds([])
    if (isDemo || !supabase || !selectedNoteId) return
    const sb = supabase
    const ch = sb.channel(`nota-${selectedNoteId}`, { config: { presence: { key: me.id } } })
    ch.on('presence', { event: 'sync' }, () => {
      setViewerIds(Object.keys(ch.presenceState()).filter((id) => id !== me.id))
    })
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') ch.track({ online: true })
    })
    return () => {
      sb.removeChannel(ch)
    }
  }, [selectedNoteId, me.id])

  const createNote = () => {
    const folderId =
      selectedFolderId === 'all' || selectedFolderId === 'shared' ? null : selectedFolderId
    const n: Note = {
      id: uid(),
      userId: me.id,
      folderId,
      title: '',
      content: '',
      pinned: false,
      updatedAt: new Date().toISOString(),
      sharedWith: [],
    }
    upsertNote(n)
    if (selectedFolderId === 'shared') setSelectedFolderId('all')
    setSelectedNoteId(n.id)
    if (isMobile) setPane('editor')
  }

  const deleteNote = (n: Note) => {
    if (confirm(`¿Eliminar la nota "${n.title || 'Nota nueva'}"?`)) {
      removeNote(n.id)
      if (selectedNoteId === n.id) {
        setSelectedNoteId(null)
        if (isMobile) setPane('list')
      }
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

  const dayPin = selectedNote ? pins.find((p) => p.userId === me.id && p.noteId === selectedNote.id) : undefined
  const toggleDayPin = () => {
    if (!selectedNote) return
    if (dayPin) removePin(dayPin.id)
    else
      upsertPin({
        id: uid(),
        userId: me.id,
        noteId: selectedNote.id,
        position: pins.filter((p) => p.userId === me.id).length,
      })
  }

  const renderFolder = (f: NoteFolder, depth: number) => {
    const kids = childrenOf(f.id)
    const open = !collapsed.has(f.id)
    const active = selectedFolderId === f.id
    const count = ownNotes.filter((n) => n.folderId === f.id).length
    return (
      <div key={f.id}>
        <div
          onClick={() => pickFolder(f.id)}
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
          <span className="flex items-center gap-0.5 md:hidden md:group-hover/f:flex">
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
          <span className="hidden text-[10px] font-bold text-slate-300 md:block md:group-hover/f:hidden">
            {count || ''}
          </span>
        </div>
        {open && kids.map((k) => renderFolder(k, depth + 1))}
      </div>
    )
  }

  const pinnedNotes = listNotes.filter((n) => n.pinned)
  const otherNotes = listNotes.filter((n) => !n.pinned)

  const noteItem = (n: Note) => {
    const active = selectedNoteId === n.id
    const owner = n.userId !== me.id ? users.find((u) => u.id === n.userId) : undefined
    return (
      <button
        key={n.id}
        onClick={() => pickNote(n.id)}
        className={`group/n block w-full rounded-xl px-3 py-2.5 text-left transition ${
          active ? 'bg-blue-600 text-white' : 'hover:bg-slate-100'
        }`}
      >
        <span className="flex items-center gap-1.5">
          {owner && <Avatar user={owner} size={16} />}
          <span className={`flex-1 truncate text-sm font-extrabold ${active ? 'text-white' : 'text-slate-700'}`}>
            {n.title || 'Nota nueva'}
          </span>
          {n.userId === me.id && (
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
                  : `opacity-100 md:opacity-0 md:group-hover/n:opacity-100 ${active ? 'text-blue-200 hover:text-white' : 'text-slate-300 hover:text-amber-500'}`
              }`}
            >
              <Pin size={13} className={n.pinned ? 'fill-current' : ''} />
            </span>
          )}
        </span>
        <span className={`mt-0.5 block truncate text-[11px] font-semibold ${active ? 'text-blue-100' : 'text-slate-400'}`}>
          {owner ? `De ${owner.name} · ` : ''}
          {format(new Date(n.updatedAt), 'd MMM', { locale: es })} ·{' '}
          {stripHtml(n.content).slice(0, 70) || 'Sin contenido'}
        </span>
      </button>
    )
  }

  return (
    <div className="flex h-full">
      {/* Columna 1: árbol de carpetas */}
      <aside
        className={`${
          isMobile ? (pane === 'folders' ? 'flex w-full' : 'hidden') : 'flex w-56'
        } shrink-0 flex-col border-r border-slate-200 bg-slate-50/70`}
      >
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
            onClick={() => pickFolder('all')}
            className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 transition ${
              selectedFolderId === 'all' ? 'bg-blue-100/70 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers size={14} className={selectedFolderId === 'all' ? 'text-blue-500' : 'text-slate-400'} />
            <span className="flex-1 text-[13px] font-bold">Todas las notas</span>
            <span className="text-[10px] font-bold text-slate-300">{ownNotes.length}</span>
          </div>
          <div
            onClick={() => pickFolder('shared')}
            className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 transition ${
              selectedFolderId === 'shared' ? 'bg-blue-100/70 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <UsersIcon size={14} className={selectedFolderId === 'shared' ? 'text-blue-500' : 'text-slate-400'} />
            <span className="flex-1 text-[13px] font-bold">Compartidas conmigo</span>
            <span className="text-[10px] font-bold text-slate-300">{sharedNotes.length}</span>
          </div>
          <div className="mx-2 my-1.5 border-t border-slate-200/70" />
          {childrenOf(null).map((f) => renderFolder(f, 0))}
        </div>
        <p className="border-t border-slate-200 px-3 py-2 text-[10px] font-semibold text-slate-300">
          🔒 Tus notas son privadas, salvo las que decidas compartir.
        </p>
      </aside>

      {/* Columna 2: lista de notas */}
      <div
        className={`${
          isMobile ? (pane === 'list' ? 'flex w-full' : 'hidden') : 'flex w-72'
        } shrink-0 flex-col border-r border-slate-200 bg-white`}
      >
        <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
          {isMobile && (
            <button
              onClick={() => setPane('folders')}
              title="Ver carpetas"
              className="mr-1 rounded-lg p-1 text-slate-400 hover:bg-slate-100"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          <span className="flex-1 truncate font-extrabold text-slate-700">
            {selectedFolderId === 'shared' ? 'Compartidas conmigo' : (selectedFolder?.name ?? 'Todas las notas')}
          </span>
          <button title="Nueva nota" onClick={createNote} className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50">
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
              {q
                ? 'No se encontraron notas.'
                : selectedFolderId === 'shared'
                  ? 'Todavía nadie compartió notas con vos.'
                  : 'Esta carpeta está vacía.'}
            </p>
          )}
        </div>
      </div>

      {/* Columna 3: editor */}
      <div className={`${isMobile && pane !== 'editor' ? 'hidden' : 'flex'} min-w-0 flex-1 flex-col bg-white`}>
        {selectedNote ? (
          <NoteEditor
            key={selectedNote.id}
            note={selectedNote}
            onBack={isMobile ? () => setPane('list') : undefined}
            isOwner={selectedNote.userId === me.id}
            owner={users.find((u) => u.id === selectedNote.userId)}
            teammates={users.filter((u) => u.id !== selectedNote.userId)}
            viewers={users.filter((u) => viewerIds.includes(u.id))}
            dayPinned={!!dayPin}
            onToggleDayPin={toggleDayPin}
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
              if (folderModal.parentId)
                setCollapsed((s) => {
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

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function NoteEditor({
  note,
  isOwner,
  owner,
  teammates,
  viewers,
  dayPinned,
  onToggleDayPin,
  onSave,
  onDelete,
  onBack,
}: {
  note: Note
  isOwner: boolean
  owner?: User
  teammates: User[]
  viewers: User[]
  dayPinned: boolean
  onToggleDayPin: () => void
  onSave: (patch: Partial<Note>) => void
  onDelete: () => void
  onBack?: () => void
}) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const [shareOpen, setShareOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.innerHTML = note.content
    return () => window.clearTimeout(timer.current)
    // Solo al montar: el contenido vive en el DOM mientras se edita.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Edición en vivo: si otra persona guardó cambios y yo NO estoy escribiendo
  // en este momento, el contenido se actualiza solo.
  useEffect(() => {
    const el = bodyRef.current
    if (!el || document.activeElement === el) return
    if (el.innerHTML !== note.content) el.innerHTML = note.content
  }, [note.content])

  const saveContent = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => onSave({ content: bodyRef.current?.innerHTML ?? '' }), 350)
  }

  const exec = (cmd: string) => {
    document.execCommand(cmd)
    bodyRef.current?.focus()
    saveContent()
  }

  const exportPdf = async () => {
    setExporting(true)
    try {
      const { default: html2pdf } = await import('html2pdf.js')
      const fecha = noteDate(note.updatedAt)
      const holder = document.createElement('div')
      holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#ffffff'
      holder.innerHTML = `
        <div id="pdf-nota" style="font-family:'Poppins',-apple-system,'Segoe UI',sans-serif;color:#1e293b;padding:48px;background:#ffffff">
          <style>
            #pdf-nota ul { list-style: disc; padding-left: 22px; margin: 8px 0; }
            #pdf-nota ol { list-style: decimal; padding-left: 22px; margin: 8px 0; }
            #pdf-nota li { margin: 3px 0; }
            #pdf-nota p { margin: 6px 0; }
          </style>
          <div style="display:flex;align-items:center;justify-content:space-between">
            <img src="/logo-color.svg" style="height:32px" />
            <span style="font-size:10px;font-weight:800;color:#5DADEA;letter-spacing:.14em;text-transform:uppercase">Cuaderno digital</span>
          </div>
          <h1 style="font-size:26px;font-weight:900;margin:18px 0 2px">${escapeHtml(note.title || 'Nota')}</h1>
          <div style="font-size:11px;color:#94a3b8;margin-bottom:14px">${owner ? `Por ${escapeHtml(owner.name)} · ` : ''}${escapeHtml(fecha)}</div>
          <hr style="border:none;border-top:3px solid #5DADEA;width:64px;margin:0 0 20px" />
          <div style="font-size:14px;line-height:1.75">${note.content}</div>
        </div>`
      document.body.appendChild(holder)
      try {
        await html2pdf()
          .set({
            margin: [10, 10],
            filename: `${(note.title || 'nota')
              .normalize('NFD')
              .replace(/[̀-ͯ]/g, '')
              .replace(/[^\w -]/g, '')
              .trim()
              .replace(/\s+/g, '-')
              .toLowerCase()}.pdf`,
            image: { type: 'jpeg', quality: 0.96 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'legacy'] },
          })
          .from(holder.firstElementChild as HTMLElement)
          .save()
      } finally {
        holder.remove()
      }
    } finally {
      setExporting(false)
    }
  }

  const toolBtn = 'rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700'

  return (
    <>
      <div className="flex items-center gap-0.5 border-b border-slate-100 px-2 py-2 md:px-4">
        {onBack && (
          <button title="Volver a la lista" onClick={onBack} className="mr-0.5 rounded-md p-1.5 text-slate-500 hover:bg-slate-100">
            <ChevronLeft size={18} />
          </button>
        )}
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
        <button
          title="Lista con viñetas"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('insertUnorderedList')}
          className={toolBtn}
        >
          <List size={15} />
        </button>
        <button
          title="Lista numerada"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('insertOrderedList')}
          className={toolBtn}
        >
          <ListOrdered size={15} />
        </button>

        <span className="ml-auto flex items-center gap-1">
          {viewers.length > 0 && (
            <span className="mr-1 flex items-center gap-1.5 rounded-full bg-emerald-50 py-1 pr-2.5 pl-1.5" title="Viendo esta nota ahora">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
              <AvatarStack users={viewers} size={18} />
              <span className="text-[10px] font-extrabold text-emerald-600">en vivo</span>
            </span>
          )}
          {isOwner && (
            <button
              title="Compartir con el equipo"
              onClick={() => setShareOpen(true)}
              className={`flex items-center gap-1 rounded-md p-1.5 text-xs font-extrabold transition hover:bg-slate-100 ${
                note.sharedWith.length ? 'text-blue-600' : 'text-slate-400 hover:text-blue-600'
              }`}
            >
              <Share2 size={15} />
              {note.sharedWith.length > 0 && note.sharedWith.length}
            </button>
          )}
          <button
            title={dayPinned ? 'Quitar de Mi Día' : 'Fijar en Mi Día'}
            onClick={onToggleDayPin}
            className={`rounded-md p-1.5 transition hover:bg-slate-100 ${dayPinned ? 'text-blue-600' : 'text-slate-400 hover:text-blue-600'}`}
          >
            <Sunrise size={15} className={dayPinned ? 'fill-blue-100' : ''} />
          </button>
          {isOwner && (
            <button
              title={note.pinned ? 'Desfijar de la lista' : 'Fijar arriba en la lista'}
              onClick={() => onSave({ pinned: !note.pinned })}
              className={`rounded-md p-1.5 transition hover:bg-slate-100 ${note.pinned ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}`}
            >
              <Pin size={15} className={note.pinned ? 'fill-current' : ''} />
            </button>
          )}
          <button
            title="Exportar a PDF"
            onClick={exportPdf}
            disabled={exporting}
            className={`rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-blue-600 ${exporting ? 'animate-pulse' : ''}`}
          >
            <FileDown size={15} />
          </button>
          {isOwner && (
            <button
              title="Eliminar nota"
              onClick={onDelete}
              className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
            >
              <Trash2 size={15} />
            </button>
          )}
        </span>
      </div>
      <div className="px-6 pt-4">
        <input
          value={note.title}
          onChange={(e) => onSave({ title: e.target.value })}
          placeholder="Título de la nota"
          className="w-full text-2xl font-black text-slate-800 outline-none placeholder:text-slate-200"
        />
        <p className="mt-1 text-[11px] font-semibold text-slate-300">
          {!isOwner && owner ? `Nota de ${owner.name} · ` : ''}
          {note.sharedWith.length > 0 && isOwner
            ? `Compartida con ${note.sharedWith.length} persona${note.sharedWith.length > 1 ? 's' : ''} · `
            : ''}
          Editado el {noteDate(note.updatedAt)}
        </p>
      </div>
      <div
        ref={bodyRef}
        contentEditable
        onInput={saveContent}
        className="mt-2 flex-1 overflow-y-auto px-6 pb-8 text-[15px] leading-relaxed text-slate-700 outline-none [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
      />

      {shareOpen && (
        <Modal title="Compartir nota" onClose={() => setShareOpen(false)}>
          <div className="space-y-4">
            <p className="text-sm font-semibold text-slate-500">
              Elegí con quiénes compartir <span className="font-extrabold text-slate-700">“{note.title || 'esta nota'}”</span>.
              Van a poder verla y editarla en vivo; borrarla o compartirla seguís pudiendo solo vos.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {teammates.map((u) => {
                const active = note.sharedWith.includes(u.id)
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() =>
                      onSave({
                        sharedWith: active
                          ? note.sharedWith.filter((id) => id !== u.id)
                          : [...note.sharedWith, u.id],
                      })
                    }
                    className={`flex items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-1 text-xs font-bold transition ${
                      active ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <Avatar user={u} size={20} />
                    {u.name}
                  </button>
                )
              })}
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShareOpen(false)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-700"
              >
                Listo
              </button>
            </div>
          </div>
        </Modal>
      )}
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
