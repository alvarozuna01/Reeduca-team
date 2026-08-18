import { addDays } from 'date-fns'
import type { DB, Minute, Note, NoteFolder, Task } from '../types'
import { toKey, uid, weekDays } from './utils'

/**
 * Datos de ejemplo del modo demo, inspirados en la agenda real de ReEduca.
 * Se generan sobre la semana actual para que el calendario siempre se vea vivo.
 */
export function seedDB(): DB {
  const wk = weekDays(new Date())
  const [_dom, lun, mar, mie, jue, vie] = wk.map(toKey)
  const [, lun2, mar2, , jue2] = wk.map((d) => toKey(addDays(d, 7)))

  const users = [
    { id: 'u-alvaro', name: 'Álvaro', email: 'alvaro.ozuna01@gmail.com', role: 'admin' as const, color: '#64748B' },
    { id: 'u-lucia', name: 'Lucía', email: 'lucia@reeduca.com', role: 'member' as const, color: '#8B5CF6' },
    { id: 'u-malena', name: 'Malena', email: 'malena@reeduca.com', role: 'member' as const, color: '#EC4899' },
    { id: 'u-coty', name: 'Coty', email: 'coty@reeduca.com', role: 'member' as const, color: '#14B8A6' },
    { id: 'u-pato', name: 'Pato', email: 'pato@reeduca.com', role: 'member' as const, color: '#F97316' },
  ]

  const projects = [
    { id: 'p-academico', name: 'Académico', color: '#F0A62B', description: 'Capacitaciones, escritura de unidades y certificación MEC.' },
    { id: 'p-comercial', name: 'Comercial', color: '#5AB6E8', description: 'Ventas, pipeline, eventos y relación con clientes.' },
    { id: 'p-admin', name: 'Administración', color: '#34C48E', description: 'Finanzas, sistemas y gestión interna.' },
    { id: 'p-cultura', name: 'Equipo & Cultura', color: '#F26CA7', description: 'Cumpleaños, clima y vida del equipo.' },
  ]

  const pos: Record<string, number> = {}
  const mk = (
    t: Omit<Task, 'id' | 'position' | 'checklist' | 'links' | 'urgent' | 'importance'> &
      Partial<Pick<Task, 'checklist' | 'links' | 'urgent' | 'importance'>>,
  ): Task => {
    pos[t.date] = (pos[t.date] ?? 0) + 1
    return { id: uid(), position: pos[t.date], checklist: [], links: [], urgent: false, importance: 0, ...t }
  }

  const tasks: Task[] = [
    // LUNES
    mk({ projectId: 'p-academico', title: 'Escritura · Unidad 4 · 4to', description: '(antes: Desarrollo: contenido técnico y pedagógico Módulo 4)', date: lun, assigneeIds: ['u-pato'], status: 'doing' }),
    mk({
      projectId: 'p-academico', title: 'Tutorial de creación de VEX ID', description: 'Trabajar la edición: Lu.', date: lun,
      assigneeIds: ['u-malena', 'u-lucia', 'u-alvaro'], status: 'done',
      links: [{ id: uid(), label: 'Abrir en Drive', url: 'https://drive.google.com' }],
    }),
    mk({ projectId: 'p-admin', title: 'Actualizar sistema de finanzas ReEduca', description: 'A las 8:00, y que después Malena cargue.', date: lun, startTime: '08:00', assigneeIds: ['u-alvaro'], status: 'done' }),
    mk({ projectId: 'p-academico', title: 'Cerrar instrumento de recolección de datos FIFA', date: lun, assigneeIds: ['u-pato', 'u-lucia', 'u-alvaro'], status: 'done' }),
    mk({ projectId: 'p-academico', title: 'Imprimir y plastificar instrumento', date: lun, assigneeIds: ['u-alvaro'], status: 'done' }),
    mk({ projectId: 'p-comercial', title: 'Ver acciones comerciales con Luciana', description: 'Status de agendamiento de reuniones con clientes.', date: lun, assigneeIds: ['u-lucia', 'u-alvaro'], status: 'todo' }),
    mk({ projectId: 'p-academico', title: 'Calendarizar visitas a IFDs para cierre FIFA', date: lun, assigneeIds: ['u-alvaro'], status: 'todo', importance: 4 }),

    // MARTES
    mk({
      projectId: 'p-academico', title: 'Diseño de planilla de puntajes', date: mar,
      assigneeIds: ['u-lucia', 'u-coty', 'u-alvaro'], status: 'doing', importance: 4,
      checklist: [{ id: uid(), text: 'Sistema de registro', done: false }],
    }),
    mk({
      projectId: 'p-academico', title: 'Escritura · Unidad 4 · 4to', description: '(antes: Desarrollo: contenido técnico y pedagógico Módulo 4)', date: mar,
      assigneeIds: ['u-pato'], status: 'doing',
      checklist: [{ id: uid(), text: 'Unidad presentada en formato Word', done: false }],
    }),
    mk({ projectId: 'p-admin', title: 'Cargar facturas y movimientos de agosto en sistema', description: 'Cargar después de que Álvaro actualice.', date: mar, assigneeIds: ['u-malena'], status: 'todo', urgent: true, importance: 3 }),
    mk({ projectId: 'p-comercial', title: 'Actualizar pipeline ventas', description: 'Actualizar con Lu los pendientes, enviar mensajes de seguimiento.', date: mar, assigneeIds: ['u-malena'], status: 'done' }),
    mk({ projectId: 'p-cultura', title: 'Copia de llave para Male', date: mar, assigneeIds: ['u-malena', 'u-alvaro'], status: 'todo' }),
    mk({ projectId: 'p-academico', title: 'Formulario registro de equipos', date: mar, assigneeIds: ['u-alvaro'], status: 'todo' }),

    // MIÉRCOLES
    mk({ projectId: 'p-academico', title: 'Capacitación pres. M1+M2.S1', description: 'Grupo 2 Paraguarí.', date: mie, startTime: '13:00', endTime: '17:00', assigneeIds: ['u-pato', 'u-lucia'], status: 'todo', importance: 4 }),
    mk({
      projectId: 'p-comercial', title: 'Evento Jóvenes Conectados. MEC', description: 'Online.', date: mie, startTime: '10:30',
      assigneeIds: ['u-lucia'], status: 'todo',
      links: [{ id: uid(), label: 'Abrir en Drive', url: 'https://drive.google.com' }],
    }),
    mk({ projectId: 'p-comercial', title: 'Reu con Coty / CEI', description: 'Virtual.', date: mie, startTime: '10:00', assigneeIds: ['u-lucia', 'u-coty'], status: 'todo' }),

    // JUEVES
    mk({ projectId: 'p-academico', title: 'Capacitación pres. M1+M2.S1', description: 'Grupo 3 Paraguarí.', date: jue, startTime: '13:00', endTime: '17:00', assigneeIds: ['u-pato', 'u-lucia'], status: 'todo' }),

    // VIERNES
    mk({
      projectId: 'p-academico', title: 'Definición de criterios de certificación MEC', description: 'Recibir la info de los IFD (Edgar). Recepción de información sujeta al MEC.', date: vie,
      assigneeIds: ['u-alvaro'], status: 'todo', urgent: true, importance: 5,
      checklist: [{ id: uid(), text: 'Insumo para Matriz de Certificación', done: false }],
    }),
    mk({ projectId: 'p-academico', title: 'Capacitación pres. M1+M2.S1', description: 'Grupo 1 Central.', date: vie, startTime: '13:00', endTime: '17:00', assigneeIds: ['u-pato', 'u-lucia'], status: 'todo' }),
    mk({ projectId: 'p-comercial', title: 'Preparar insumos para el Intercolegial Cristo Rey', date: vie, assigneeIds: ['u-malena', 'u-lucia'], status: 'todo' }),
    mk({ projectId: 'p-cultura', title: 'Cumpleaños de Lu!!!', date: vie, assigneeIds: ['u-alvaro', 'u-malena', 'u-coty', 'u-pato'], status: 'todo' }),
    mk({ projectId: 'p-comercial', title: 'Montar cancha en Cristo Rey', date: vie, assigneeIds: ['u-malena', 'u-alvaro'], status: 'todo' }),

    // PRÓXIMA SEMANA (para que el semáforo del Kanban muestre carga variada)
    mk({ projectId: 'p-academico', title: 'Escritura · Unidad 5 · 4to', date: lun2, assigneeIds: ['u-pato'], status: 'todo', importance: 3 }),
    mk({ projectId: 'p-academico', title: 'Capacitación pres. M3.S1', description: 'Grupo 2 Paraguarí.', date: mar2, startTime: '13:00', endTime: '17:00', assigneeIds: ['u-pato', 'u-lucia'], status: 'todo' }),
    mk({ projectId: 'p-comercial', title: 'Seguimiento de pipeline con Lu', date: mar2, assigneeIds: ['u-lucia', 'u-malena'], status: 'todo' }),
    mk({ projectId: 'p-admin', title: 'Cierre contable de agosto', date: jue2, assigneeIds: ['u-malena', 'u-alvaro'], status: 'todo', urgent: true, importance: 4 }),
  ]

  const noteFolders: NoteFolder[] = [
    { id: 'f-reuniones', userId: 'u-alvaro', name: 'Reuniones', parentId: null, position: 0 },
    { id: 'f-mec', userId: 'u-alvaro', name: 'MEC', parentId: 'f-reuniones', position: 0 },
    { id: 'f-ideas', userId: 'u-alvaro', name: 'Ideas', parentId: null, position: 1 },
  ]

  const now = new Date().toISOString()
  const notes: Note[] = [
    {
      id: uid(), userId: 'u-alvaro', folderId: 'f-mec', title: 'Pendientes con el MEC', pinned: true, updatedAt: now,
      content:
        '<p>Cosas que no se pueden caer esta semana:</p><ul><li>Insumo para la Matriz de Certificación (Edgar)</li><li>Confirmar sede del evento Jóvenes Conectados</li><li>Nota formal para los IFD</li></ul>',
    },
    {
      id: uid(), userId: 'u-alvaro', folderId: 'f-ideas', title: 'Ideas para el intercolegial', pinned: false, updatedAt: now,
      content:
        '<p>Lluvia de ideas para Cristo Rey:</p><ul><li>Puntaje extra por barras</li><li>Stand de ReEduca con inscripciones</li><li>Pedir cancha desde el jueves</li></ul>',
    },
    {
      id: uid(), userId: 'u-alvaro', folderId: null, title: 'Borrador: bienvenida 4to módulo', pinned: false, updatedAt: now,
      content: '<p>Hola a todos, ¡bienvenidos al Módulo 4! En esta etapa vamos a trabajar…</p>',
    },
  ]

  const minutes: Minute[] = [
    {
      id: uid(),
      title: 'Reunión semanal de equipo',
      date: lun,
      participantIds: ['u-alvaro', 'u-lucia', 'u-malena', 'u-coty', 'u-pato'],
      summary:
        'Repaso de la semana: cierre del instrumento FIFA, avance de la escritura de la Unidad 4 y organización de las capacitaciones presenciales M1+M2. Se acordó priorizar los insumos para el MEC.',
      actions: [
        { id: uid(), text: 'Enviar formulario de registro de equipos a los colegios' },
        { id: uid(), text: 'Definir fecha de visita a IFDs para el cierre FIFA' },
        { id: uid(), text: 'Confirmar catering para la capacitación del viernes' },
      ],
    },
  ]

  return { users, projects, tasks, notes, noteFolders, minutes }
}
