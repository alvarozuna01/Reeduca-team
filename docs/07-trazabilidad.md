# 07 · Trazabilidad

Tres tablas para cruzar rápido: de módulo a código, de archivo de código a módulo, y de tabla de
la base a módulo. Se arma a partir de los encabezados de los documentos de `docs/04-srs/`.

## 1. Módulos

| Módulo | Documento | Prefijo | Requisitos | Reglas | Pruebas | Quién lo ve | Llave |
|---|---|---|---|---|---|---|---|
| Transversal (cuenta, roles, llaves, tiempo real, comentarios, menciones) | [00-transversal.md](04-srs/00-transversal.md) | TRV | 43 (RF-TRV-01…43) | 9 (RN-TRV-01…09) | 32 (CA-TRV-01…32) | Todo el equipo. Las partes de Gerente están marcadas en cada requisito | Este módulo **define** el mecanismo de llaves. Los comentarios están detrás de `FEATURE_COMENTARIOS` |
| Tareas (la entidad y su ventana de edición) | [01-tareas.md](04-srs/01-tareas.md) | TAR | 31 (RF-TAR-01…31) | 11 (RN-TAR-01…11) | 21 (CA-TAR-01…21) | Todo el equipo | Ninguna para la tarea en sí. El hilo de comentarios adentro de la ventana está detrás de `FEATURE_COMENTARIOS` |
| Mi Día | [02-mi-dia.md](04-srs/02-mi-dia.md) | MID | 19 (RF-MID-01…19) | 7 (RN-MID-01…07) | 18 (CA-MID-01…18) | Todo el equipo. Cada persona ve **su** Mi Día: nunca el de otro | Ninguna para la pantalla. El bloque de menciones en comentarios depende de `FEATURE_COMENTARIOS` |
| Agenda semanal | [03-agenda.md](04-srs/03-agenda.md) | AGE | 33 (RF-AGE-01…33) | 10 (RN-AGE-01…10) | 24 (CA-AGE-01…24) | Todo el equipo. El bloque del CRM, solo quien está en la lista de acceso al CRM | Ninguna. El bloque del CRM depende de la lista de acceso al CRM, no de una llave |
| Kanban (tablero por estado) | [04-kanban.md](04-srs/04-kanban.md) | KAN | 29 (RF-KAN-01…29) | 9 (RN-KAN-01…09) | 23 (CA-KAN-01…23) | Todo el equipo | Ninguna. La pastilla de comentarios en la tarjeta depende de `FEATURE_COMENTARIOS` |
| Hitos | [05-hitos.md](04-srs/05-hitos.md) | HIT | 21 (RF-HIT-01…21) | 8 (RN-HIT-01…08) | 12 (CA-HIT-01…12) | Todo el equipo | Ninguna |
| Minutas de reuniones | [06-minutas.md](04-srs/06-minutas.md) | MIN | 27 (RF-MIN-01…27) | 7 (RN-MIN-01…07) | 18 (CA-MIN-01…18) | Todo el equipo | Ninguna |
| Kickoff semanal | [07-kickoff.md](04-srs/07-kickoff.md) | KIC | 33 (RF-KIC-01…33) | 13 (RN-KIC-01…13) | 26 (CA-KIC-01…26) | Todo el equipo que tenga la llave prendida. Los cinco bloques, solo Gerentes; el resto ve su briefing personal | `FEATURE_KICKOFF` |
| Mi Cuaderno | [08-cuaderno.md](04-srs/08-cuaderno.md) | CUA | 25 (RF-CUA-01…25) | 11 (RN-CUA-01…11) | 16 (CA-CUA-01…16) | Todo el equipo. Cada persona ve únicamente sus propias notas más las que le compartieron | Ninguna |
| Proyectos | [09-proyectos.md](04-srs/09-proyectos.md) | PRO | 24 (RF-PRO-01…24) | 13 (RN-PRO-01…13) | 16 (CA-PRO-01…16) | Todo el equipo ve la pestaña y puede abrir el detalle. Crear, editar, eliminar y reordenar proyectos: solo Gerentes (`admin`) | Ninguna |
| Panel del Gerente (Centro de mando) | [10-panel-gerente.md](04-srs/10-panel-gerente.md) | PAN | 26 (RF-PAN-01…26) | 18 (RN-PAN-01…18) | 19 (CA-PAN-01…19) | **La pestaña Panel: solo Gerentes** (`admin`) con la llave prendida. El interruptor «¿Necesita una decisión del Gerente?» dentro de la ventana de una tarea lo ve **todo el equipo**, sin llave | `FEATURE_PANEL` — controla únicamente la pestaña Panel |
| Equipo (miembros, roles y llaves) | [11-equipo.md](04-srs/11-equipo.md) | EQU | 23 (RF-EQU-01…23) | 12 (RN-EQU-01…12) | 18 (CA-EQU-01…18) | Solo Gerentes (`admin`). El resto del equipo ve un cartel de "Vista exclusiva del Gerente" | Ninguna para entrar. La pestaña se **oculta** cuando `FEATURE_PANEL` está prendida, porque el Panel se queda con sus dos bloques de administración |
| CRM de instituciones | [12-crm.md](04-srs/12-crm.md) | CRM | 70 (RF-CRM-01…70) | 18 (RN-CRM-01…18) | 28 (CA-CRM-01…28) | Lista de acceso al CRM (tabla `crm_accesos`). Los Gerentes administran la lista, pero un Gerente que no esté en la lista tampoco ve el CRM | Ninguna. El "candado" del CRM no es una llave del sistema: es la lista de acceso `crm_accesos`, con reglas de seguridad en la base de datos |

**Totales:** 404 requisitos funcionales, 146 reglas de negocio y 271 criterios de aceptación en 13 módulos.

## 2. De archivo de código a módulo

| Archivo | Se documenta en |
|---|---|
| `src/App.tsx` | Panel del Gerente (Centro de mando), Transversal (cuenta, roles, llaves, tiempo real, comentarios, menciones) |
| `src/components/Avatar.tsx` | Equipo (miembros, roles y llaves), Kanban (tablero por estado), Mi Cuaderno, Mi Día |
| `src/components/Comments.tsx` | Kanban (tablero por estado), Mi Día, Transversal (cuenta, roles, llaves, tiempo real, comentarios, menciones) |
| `src/components/ConfiguracionGerente.tsx` | Equipo (miembros, roles y llaves), Panel del Gerente (Centro de mando), Proyectos |
| `src/components/KickoffReunion.tsx` | Kickoff semanal |
| `src/components/Menciones.tsx` | Mi Día, Transversal (cuenta, roles, llaves, tiempo real, comentarios, menciones) |
| `src/components/Modal.tsx` | Equipo (miembros, roles y llaves), Mi Cuaderno |
| `src/components/MultiFilter.tsx` | Agenda semanal, Kanban (tablero por estado) |
| `src/components/Selectores.tsx` | Minutas de reuniones, Tareas (la entidad y su ventana de edición), Transversal (cuenta, roles, llaves, tiempo real, comentarios, menciones) |
| `src/components/Stars.tsx` | Kanban (tablero por estado), Mi Día, Tareas (la entidad y su ventana de edición) |
| `src/components/TareasModal.tsx` | Panel del Gerente (Centro de mando), Proyectos |
| `src/components/TaskCard.tsx` | Agenda semanal, Tareas (la entidad y su ventana de edición) |
| `src/components/TaskEditor.tsx` | Panel del Gerente (Centro de mando), Tareas (la entidad y su ventana de edición) |
| `src/components/TopBar.tsx` | Equipo (miembros, roles y llaves), Panel del Gerente (Centro de mando), Transversal (cuenta, roles, llaves, tiempo real, comentarios, menciones) |
| `src/crm/AccesoCRM.tsx` | CRM de instituciones |
| `src/crm/AccionEditor.tsx` | CRM de instituciones |
| `src/crm/AgendaCRM.tsx` | Agenda semanal, CRM de instituciones |
| `src/crm/BloqueAccion.tsx` | CRM de instituciones |
| `src/crm/CRM.tsx` | CRM de instituciones |
| `src/crm/ChipAccion.tsx` | CRM de instituciones |
| `src/crm/CrmProvider.tsx` | CRM de instituciones |
| `src/crm/ElegirInstitucion.tsx` | CRM de instituciones |
| `src/crm/Ficha.tsx` | CRM de instituciones |
| `src/crm/NuevaInstitucion.tsx` | CRM de instituciones |
| `src/crm/NuevaOportunidad.tsx` | CRM de instituciones |
| `src/crm/OpcionesTipo.tsx` | CRM de instituciones |
| `src/crm/contexto.ts` | CRM de instituciones |
| `src/crm/crmApi.ts` | CRM de instituciones |
| `src/crm/estilo.ts` | CRM de instituciones |
| `src/crm/reglas.ts` | CRM de instituciones |
| `src/crm/tipos.ts` | CRM de instituciones |
| `src/lib/api.ts` | Transversal (cuenta, roles, llaves, tiempo real, comentarios, menciones) |
| `src/lib/kickoffData.ts` | Kickoff semanal |
| `src/lib/localApi.ts` | Transversal (cuenta, roles, llaves, tiempo real, comentarios, menciones) |
| `src/lib/menciones.ts` | Mi Día, Transversal (cuenta, roles, llaves, tiempo real, comentarios, menciones) |
| `src/lib/supabaseApi.ts` | Equipo (miembros, roles y llaves), Hitos, Kickoff semanal, Mi Cuaderno, Minutas de reuniones, Proyectos, Tareas (la entidad y su ventana de edición), Transversal (cuenta, roles, llaves, tiempo real, comentarios, menciones) |
| `src/lib/supabaseClient.ts` | Transversal (cuenta, roles, llaves, tiempo real, comentarios, menciones) |
| `src/lib/useIsMobile.ts` | Agenda semanal, Mi Cuaderno |
| `src/lib/usePref.ts` | Agenda semanal, Kanban (tablero por estado) |
| `src/lib/utils.ts` | Agenda semanal, Equipo (miembros, roles y llaves), Hitos, Kanban (tablero por estado), Mi Cuaderno, Proyectos, Tareas (la entidad y su ventana de edición) |
| `src/state/AppContext.tsx` | Equipo (miembros, roles y llaves), Hitos, Kickoff semanal, Mi Cuaderno, Minutas de reuniones, Panel del Gerente (Centro de mando), Proyectos, Tareas (la entidad y su ventana de edición), Transversal (cuenta, roles, llaves, tiempo real, comentarios, menciones) |
| `src/types.ts` | Hitos, Kickoff semanal, Minutas de reuniones, Tareas (la entidad y su ventana de edición) |
| `src/views/Agenda.tsx` | Agenda semanal |
| `src/views/Cuaderno.tsx` | Mi Cuaderno |
| `src/views/Equipo.tsx` | Equipo (miembros, roles y llaves), Panel del Gerente (Centro de mando) |
| `src/views/Hitos.tsx` | Hitos |
| `src/views/Kanban.tsx` | Kanban (tablero por estado) |
| `src/views/Kickoff.tsx` | Kickoff semanal |
| `src/views/Login.tsx` | Transversal (cuenta, roles, llaves, tiempo real, comentarios, menciones) |
| `src/views/MiDia.tsx` | Mi Día |
| `src/views/Minutas.tsx` | Minutas de reuniones |
| `src/views/Panel.tsx` | Panel del Gerente (Centro de mando) |
| `src/views/Proyectos.tsx` | Proyectos |
| `supabase/migracion-crm-1-esquema.sql` | CRM de instituciones |

## 3. De tabla de la base a módulo

| Tabla | La usan |
|---|---|
| `crm_accesos` | CRM de instituciones, Transversal (cuenta, roles, llaves, tiempo real, comentarios, menciones) |
| `crm_bitacora` | CRM de instituciones |
| `crm_contactos` | CRM de instituciones |
| `crm_instituciones` | Agenda semanal, CRM de instituciones |
| `crm_interacciones` | Agenda semanal, CRM de instituciones |
| `crm_oportunidades` | CRM de instituciones |
| `feature_flags` | Equipo (miembros, roles y llaves), Kickoff semanal, Panel del Gerente (Centro de mando), Tareas (la entidad y su ventana de edición), Transversal (cuenta, roles, llaves, tiempo real, comentarios, menciones) |
| `hito_id` | Hitos |
| `hitos` | Hitos, Kickoff semanal, Panel del Gerente (Centro de mando), Proyectos, Tareas (la entidad y su ventana de edición) |
| `kickoff_anotaciones` | Kickoff semanal |
| `kickoff_briefings` | Kickoff semanal |
| `kickoffs` | Kickoff semanal |
| `minutes` | Kickoff semanal, Minutas de reuniones, Panel del Gerente (Centro de mando) |
| `note_folders` | Mi Cuaderno, Mi Día |
| `notes` | Mi Cuaderno, Mi Día |
| `pins` | Mi Cuaderno, Mi Día |
| `profiles` | Agenda semanal, CRM de instituciones, Equipo (miembros, roles y llaves), Hitos, Kanban (tablero por estado), Kickoff semanal, Mi Cuaderno, Mi Día, Minutas de reuniones, Panel del Gerente (Centro de mando), Proyectos, Tareas (la entidad y su ventana de edición), Transversal (cuenta, roles, llaves, tiempo real, comentarios, menciones) |
| `projects` | Agenda semanal, Equipo (miembros, roles y llaves), Hitos, Kanban (tablero por estado), Kickoff semanal, Mi Día, Minutas de reuniones, Panel del Gerente (Centro de mando), Proyectos, Tareas (la entidad y su ventana de edición) |
| `task_comments` | Kanban (tablero por estado), Mi Día, Panel del Gerente (Centro de mando), Tareas (la entidad y su ventana de edición), Transversal (cuenta, roles, llaves, tiempo real, comentarios, menciones) |
| `tasks` | Agenda semanal, Equipo (miembros, roles y llaves), Hitos, Kanban (tablero por estado), Kickoff semanal, Mi Día, Minutas de reuniones, Panel del Gerente (Centro de mando), Proyectos, Tareas (la entidad y su ventana de edición) |

El detalle columna por columna de cada tabla está en [03 · Modelo de datos](03-modelo-de-datos.md).
