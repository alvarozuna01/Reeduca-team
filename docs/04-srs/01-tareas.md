# SRS · Tareas (la entidad y su ventana de edición)

| | |
|---|---|
| Código de módulo | MOD-TAR |
| Archivos de código | `src/types.ts`, `src/components/TaskEditor.tsx`, `src/components/TaskCard.tsx`, `src/components/Stars.tsx`, `src/components/Selectores.tsx`, `src/lib/utils.ts`, `src/state/AppContext.tsx`, `src/lib/supabaseApi.ts` |
| Tablas que usa | `tasks`, `task_comments` (lectura: `projects`, `profiles`, `hitos`, `feature_flags`) |
| Quién lo ve | Todo el equipo |
| Llave (feature flag) | Ninguna para la tarea en sí. El hilo de comentarios adentro de la ventana está detrás de `FEATURE_COMENTARIOS` |

## 1. Para qué sirve

La tarea es la pieza central del sistema: todo lo demás (Mi Día, Agenda, Kanban, Hitos, Proyectos,
Panel del Gerente) son formas distintas de mirar la misma lista de tareas. Una tarea contesta seis
preguntas: **qué** hay que hacer, **de qué proyecto** es, **quién** lo hace, **cuándo**, **cuán
importante** es y **en qué estado** está. Nada más: no es un sistema de tickets ni de horas
trabajadas.

Este documento describe la entidad Tarea y la ventana que se abre para crearla o editarla (el panel
que entra desde la derecha), más la tarjeta de tarea que se reusa en la Agenda. Los otros módulos no
repiten esta información: la referencian.

Un día normal se ve así: alguien toca "+ Nueva" arriba a la derecha, escribe el título, elige el
proyecto, se pone como responsable (ya viene puesto) y le pone fecha de hoy (ya viene puesta).
Después, desde cualquier pantalla, toca la tarjeta, la ventana se abre con los datos cargados, y
ahí cambia el estado, tilda un ítem del checklist o pega el enlace del Drive donde está el trabajo.
Si necesita que el Gerente decida algo para poder avanzar, prende el interruptor "¿Necesita una
decisión del Gerente?" y la tarea entra en la cola de decisiones del Panel.

## 2. Usuarios y permisos

| Rol | Puede |
|---|---|
| Cualquier miembro (`member`) | Ver todas las tareas del equipo. Crear tareas nuevas. Editar y borrar las tareas donde figura como responsable, y las que todavía no tienen ningún responsable. Comentar cualquier tarea |
| Gerente (`admin`) | Todo lo anterior, sin restricción: edita y borra cualquier tarea de cualquier persona |

Lo que **nadie** puede: editar una tarea ajena si no es Gerente. En ese caso la ventana se abre en
modo **solo lectura**, con el título "Ver tarea" y un aviso ámbar que lo explica
(`src/components/TaskEditor.tsx:107-115`). Todos los campos quedan deshabilitados porque están dentro
de un `<fieldset disabled>` (`src/components/TaskEditor.tsx:116` y su cierre en `:344`), y abajo solo
queda el botón "Cerrar" (`src/components/TaskEditor.tsx:352-361`).

La regla vive en una sola función, `canEditTask` (`src/lib/utils.ts:32-36`), y la usan la ventana
(`src/components/TaskEditor.tsx:21`), la Agenda (`src/views/Agenda.tsx:181`) y el Kanban
(`src/views/Kanban.tsx:202`) para decidir si se puede arrastrar la tarjeta.

Aviso importante: esto es una barrera de la interfaz, no de la base. La política de seguridad de
`tasks` deja a cualquier persona con sesión leer y escribir cualquier tarea
(`supabase/schema.sql:132-133`). Ver el documento de requisitos no funcionales.

## 3. Datos que usa

Tabla `tasks` (una fila por tarea). El detalle de los tipos está en `src/types.ts:34-53` y la
traducción a columnas de Postgres en `src/lib/supabaseApi.ts:8-48`.

| Campo (app) | Columna | Qué significa | De dónde sale |
|---|---|---|---|
| `id` | `id` | Identificador único | Lo genera la app con `uid()` (`src/lib/utils.ts:5-8`) |
| `projectId` | `project_id` | A qué proyecto pertenece. Obligatorio | Selector de proyectos de la ventana |
| `title` | `title` | Qué hay que hacer. Obligatorio | Campo "Título" |
| `description` | `description` | Detalle libre; admite @menciones | Campo "Descripción" |
| `date` | `date` | Día en que se hace, `YYYY-MM-DD`. **`null` = sin fecha**, va a la bandeja de la Agenda | Campo "Fecha", o al arrastrar la tarjeta en la Agenda |
| `startTime` / `endTime` | `start_time` / `end_time` | Horario, texto `HH:mm`. Opcionales | Campos "Inicio" y "Fin" |
| `hitoId` | `hito_id` | Hito del proyecto al que aporta. `null` = sin hito | Selector "Hito al que aporta" |
| `assigneeIds` | `assignee_ids` | Responsables. Es una lista: puede haber varios, o ninguno | Selector "Responsables" |
| `status` | `status` | `todo` \| `doing` \| `done` (`src/types.ts:20`) | Botonera "Estado", o al arrastrar en el Kanban |
| `position` | `position` | Orden dentro de su día (o de la bandeja). Número entero | Lo calcula la app; se reescribe al arrastrar en la Agenda |
| `checklist` | `checklist` (jsonb) | Lista de entregables tildables | Campo "Checklist / Entregables" |
| `links` | `links` (jsonb) | Enlaces a Drive, Notion, etc. | Campo "Enlaces" |
| `urgent` | `urgent` | ¿Es urgente? Sí/no | Interruptor "¿Es urgente?" |
| `importance` | `importance` | Importancia de 0 a 5 estrellas. 0 = sin calificar | Selector de estrellas |
| `completedAt` | `completed_at` | Cuándo se completó (ISO). **La estampa la app, no se edita a mano** | `conEstampas` (`src/state/AppContext.tsx:91-104`) |
| `necesitaDecisionGg` | `necesita_decision_gg` | ¿Está esperando una decisión del Gerente? | Interruptor "¿Necesita una decisión del Gerente?" |
| `necesitaDecisionDesde` | `necesita_decision_desde` | Desde cuándo espera esa decisión (ISO). **La estampa la app** | `conEstampas` (`src/state/AppContext.tsx:98-102`) |

Forma del JSON guardado dentro de las columnas (`src/types.ts:22-32`):

```json
"checklist": [ { "id": "uuid", "text": "Armar el presupuesto", "done": false } ]
"links":     [ { "id": "uuid", "label": "Abrir en Drive", "url": "https://…" } ]
```

Tabla `task_comments` (`supabase/migracion-comentarios.sql:34`, tipos en `src/types.ts:186-192`):
`id`, `task_id`, `user_id`, `text`, `created_at`. Un comentario por fila.

Las tres columnas `completed_at`, `necesita_decision_gg` y `necesita_decision_desde` son de una
migración posterior (`supabase/migracion-panel-pm.sql:14-16`). La app está preparada para que la
base todavía no las tenga: ver RF-TAR-26.

## 4. Requisitos funcionales

| ID | Requisito | Detalle / regla | Dónde vive |
|---|---|---|---|
| RF-TAR-01 | El sistema debe permitir crear una tarea nueva desde una ventana que entra por el costado derecho | Título de la ventana: "Nueva tarea". El cursor arranca en el título | `src/components/TaskEditor.tsx:92-104`, `:119` |
| RF-TAR-02 | El sistema debe precargar la tarea nueva con valores razonables | Proyecto: el primero de la lista o el que pasó la pantalla que abrió la ventana. Fecha: hoy. Responsable: la persona que está creando. Estado: "Por hacer". Importancia: 0 | `src/components/TaskEditor.tsx:23-43` |
| RF-TAR-03 | El sistema debe exigir título y proyecto para poder guardar | El botón "Guardar" queda apagado y no se puede tocar mientras falte cualquiera de los dos. El título se guarda sin espacios sobrantes | `src/components/TaskEditor.tsx:378-384`, `:68` |
| RF-TAR-04 | El sistema debe permitir elegir el proyecto de una lista desplegable con los colores de cada proyecto | Los proyectos salen en el orden que configuró el Gerente; sin orden configurado, alfabético | `src/components/TaskEditor.tsx:127-129`, `src/components/Selectores.tsx:39-100`, `src/state/AppContext.tsx:263-267` |
| RF-TAR-05 | El sistema debe permitir poner fecha, hora de inicio y hora de fin | Los tres campos son opcionales. Borrar la fecha deja la tarea "sin fecha" | `src/components/TaskEditor.tsx:131-146` |
| RF-TAR-06 | El sistema debe avisar por escrito qué pasa si la tarea queda sin fecha | Aparece el texto "📥 Sin fecha: esta tarea va a la bandeja lateral de la Agenda" | `src/components/TaskEditor.tsx:147-151` |
| RF-TAR-07 | El sistema debe permitir vincular la tarea a un hito del proyecto | El selector aparece **solo si el proyecto elegido tiene hitos**. Incluye la opción "Sin hito" | `src/components/TaskEditor.tsx:153-170` |
| RF-TAR-08 | El sistema debe permitir cambiar el estado entre "Por hacer", "En progreso" y "Completado" | Botonera de tres posiciones; la activa queda en blanco. Los nombres visibles salen de `STATUS_LABEL` | `src/components/TaskEditor.tsx:172-187`, `src/lib/utils.ts:38-42` |
| RF-TAR-09 | El sistema debe permitir marcar la tarea como urgente | Interruptor sí/no. Prendido: "Urgente" en rojo con el ícono de llama | `src/components/TaskEditor.tsx:189-210` |
| RF-TAR-10 | El sistema debe permitir calificar la importancia de 1 a 5 estrellas, y quitar la calificación | Tocar la misma estrella que ya está elegida vuelve a 0 (sin calificar). A la derecha muestra "3/5" o "—" | `src/components/TaskEditor.tsx:211-213`, `src/components/Stars.tsx:20-40` |
| RF-TAR-11 | El sistema debe permitir a **cualquier persona del equipo** marcar que la tarea necesita una decisión del Gerente | Interruptor sí/no, sin llave y sin ser Gerente. Prendido dice "Esperando decisión del Gerente" y agrega la aclaración de que entra a la cola del Panel y que al destildarlo sale | `src/components/TaskEditor.tsx:216-242` |
| RF-TAR-12 | El sistema debe permitir asignar varios responsables a la misma tarea | Selector múltiple con la foto (o el color) de cada persona; se pueden sacar todos y dejarla sin responsables | `src/components/TaskEditor.tsx:244-246`, `src/components/Selectores.tsx:106-136` |
| RF-TAR-13 | El sistema debe permitir escribir una descripción con @menciones | Al tipear "@" se abre la lista del equipo; flechas y Enter (o un toque) eligen, Escape cierra. Inserta "@Nombre " como texto plano | `src/components/TaskEditor.tsx:248-257`, `src/components/Menciones.tsx:61-187` |
| RF-TAR-14 | El sistema debe permitir armar un checklist de entregables | Agregar, escribir, tildar y borrar ítems. Los ítems que quedan vacíos no se guardan | `src/components/TaskEditor.tsx:259-300`, `:75` |
| RF-TAR-15 | El sistema debe permitir adjuntar enlaces con un nombre | Dos campos por fila: el enlace y el nombre. Botón "Agregar enlace" precarga el nombre "Abrir en Drive" | `src/components/TaskEditor.tsx:302-343` |
| RF-TAR-16 | El sistema debe rescatar los enlaces mal pegados en vez de perderlos | Ver RN-TAR-07 | `src/components/TaskEditor.tsx:50-63` |
| RF-TAR-17 | El sistema debe permitir eliminar una tarea, pidiendo confirmación | Ventana del navegador: «¿Eliminar la tarea "…"?». Si se cancela, no pasa nada | `src/components/TaskEditor.tsx:85-90` |
| RF-TAR-18 | El sistema debe abrir en modo solo lectura las tareas que la persona no puede editar | Ver sección 2. No hay botón Eliminar ni Guardar | `src/components/TaskEditor.tsx:21`, `:99`, `:107-115`, `:352-361` |
| RF-TAR-19 | El sistema debe permitir comentar **cualquier** tarea, incluso las que para esa persona son de solo lectura | El hilo de comentarios está a propósito fuera del bloque deshabilitado. Solo aparece si la tarea ya existe y la llave `FEATURE_COMENTARIOS` está prendida para esa persona | `src/components/TaskEditor.tsx:346-348`, `src/components/Comments.tsx:36-116` |
| RF-TAR-20 | El sistema debe mostrar en el hilo quién comentó, hace cuánto y con las menciones resaltadas | El tiempo se muestra en criollo ("hace 2 horas"). Borra el comentario su autor o un Gerente, con confirmación | `src/components/Comments.tsx:64-92`, `:50-52` |
| RF-TAR-21 | El sistema debe estampar solo la fecha en que la tarea se completó | Ver RN-TAR-02 | `src/state/AppContext.tsx:91-97` |
| RF-TAR-22 | El sistema debe estampar solo desde cuándo la tarea espera la decisión del Gerente | Ver RN-TAR-03 | `src/state/AppContext.tsx:98-102` |
| RF-TAR-23 | El sistema debe ubicar la tarea al final de la lista de su día cuando es nueva o cuando cambió de fecha | Ver RN-TAR-05 | `src/components/TaskEditor.tsx:77-80` |
| RF-TAR-24 | El sistema debe mostrar la tarea en una tarjeta con el color de su proyecto, reusada en la Agenda | Ver RF-TAR-25 para el contenido de la tarjeta | `src/components/TaskCard.tsx:18-121` |
| RF-TAR-25 | La tarjeta de tarea debe mostrar: título, descripción, horario, checklist tildable, enlaces, pastillas de urgente/atrasada/importancia/comentarios y los avatares de los responsables | El título va tachado si está completada. La tarjeta lleva un anillo rojo si es urgente y no está completada. El horario se arma como "09:00 a 10:30 hs." si hay inicio y fin, o "09:00 hs." si solo hay inicio | `src/components/TaskCard.tsx:20-30`, `:35-48`, `:100-117` |
| RF-TAR-26 | El sistema debe permitir tildar los ítems del checklist desde la propia tarjeta, sin abrir la ventana | Solo si la persona puede editar la tarea; si no, los casilleros salen deshabilitados. El clic en el casillero no abre la ventana | `src/components/TaskCard.tsx:68-75`, `src/views/Agenda.tsx:174-175`, `:189` |
| RF-TAR-27 | El sistema debe guardar cada cambio en la pantalla al instante y mandarlo a la base en segundo plano | Primero se actualiza lo que la persona ve, después se manda a guardar. Si el guardado falla, el error queda en la consola del navegador | `src/state/AppContext.tsx:342-346`, `:83` |
| RF-TAR-28 | El sistema debe poder guardar varias tareas de una sola vez | Lo usa el arrastrar y soltar de la Agenda, que reordena muchas tareas juntas | `src/state/AppContext.tsx:348-356`, `src/views/Agenda.tsx:165` |
| RF-TAR-29 | El sistema debe seguir guardando tareas aunque la base todavía no tenga las tres columnas nuevas | Si el error de Postgres menciona `completed_at`, `necesita_decision_gg` o `necesita_decision_desde`, reintenta el guardado sin esas columnas en lugar de fallar | `src/lib/supabaseApi.ts:55-60`, `:405-422` |
| RF-TAR-30 | El sistema debe limpiar las referencias a una tarea cuando desaparece lo que la sostiene | Al borrar un proyecto se borran sus tareas; al borrar un hito, sus tareas quedan sin hito; al borrar una persona, sale de los responsables de todas las tareas | `src/state/AppContext.tsx:385-393`, `:469-476`, `:400-407` |
| RF-TAR-31 | El sistema debe reflejar en todas las pantallas abiertas el cambio que hizo otra persona, sin recargar | Llega por Supabase Realtime. Si el aviso de la base no trae las columnas grandes (descripción, checklist, enlaces, responsables), se conserva el valor que ya había en vez de vaciarlo | `src/state/AppContext.tsx:109-126`, `:224-258` |

## 5. Reglas de negocio y cálculos

- **RN-TAR-01 · Quién puede editar una tarea.** `canEditTask` (`src/lib/utils.ts:32-36`):
  si la persona es Gerente → sí. Si no hay sesión → no. Si no, sí cuando la tarea **no tiene ningún
  responsable** o cuando la persona está en la lista de responsables.
- **RN-TAR-02 · Fecha de completado.** Al guardar, si la tarea pasa a "Completado" y no tenía fecha
  de completado, se le pone la fecha y hora de ese momento. Si sale de "Completado", la fecha se
  borra (`null`). Nunca se pisa una fecha de completado que ya existía
  (`src/state/AppContext.tsx:93-97`).
- **RN-TAR-03 · Desde cuándo espera la decisión.** Al guardar, si el interruptor de decisión pasa de
  apagado a prendido y no había fecha, se estampa el momento. Al apagarlo, la fecha se borra. Así el
  Panel puede ordenar la cola por antigüedad y mostrar "espera desde hace N días"
  (`src/state/AppContext.tsx:98-102`). Lo consumen `src/views/Panel.tsx:54` y
  `src/lib/kickoffData.ts:161-162`.
- **RN-TAR-04 · Tarea atrasada.** `isOverdue` (`src/lib/utils.ts:25`): está atrasada la tarea que
  **no** está completada, **tiene** fecha, y esa fecha es anterior a hoy. Una tarea sin fecha nunca
  está atrasada.
- **RN-TAR-05 · Posición al guardar.** Solo se recalcula si la tarea es nueva o si cambió de fecha:
  se busca la posición más alta entre las tareas de ese mismo día (o de la bandeja) y se le suma 1;
  si no hay ninguna, queda en 0. O sea: entra al final (`src/components/TaskEditor.tsx:77-80`).
- **RN-TAR-06 · Orden dentro de un día.** Primero por posición; a igual posición, alfabético por
  título (`tasksOfDay`, `src/lib/utils.ts:93-97`). La bandeja de las tareas sin fecha usa la misma
  regla (`backlogTasks`, `src/lib/utils.ts:129-131`).
- **RN-TAR-07 · Rescate de enlaces.** Al guardar, para cada enlace
  (`src/components/TaskEditor.tsx:50-63`): 1) si el campo del enlace está vacío pero el del nombre
  parece una dirección web, se usa el nombre como enlace y el nombre pasa a ser "Abrir enlace";
  2) si el nombre quedó vacío, se pone "Abrir enlace"; 3) si al enlace le falta `https://`, se le
  agrega; 4) las filas que igual quedaron sin enlace se descartan.
- **RN-TAR-08 · El hito tiene que ser del mismo proyecto.** Al guardar, si el hito elegido no existe
  o no pertenece al proyecto de la tarea, el hito se borra (`null`). Esto pasa, por ejemplo, si
  alguien eligió un hito y después cambió de proyecto (`src/components/TaskEditor.tsx:71`).
- **RN-TAR-09 · Importancia destacada.** La pastilla de importancia se dibuja en ámbar sólido cuando
  la calificación es 4 o 5, y en ámbar claro de 1 a 3. Con 0 no se dibuja nada
  (`src/components/Stars.tsx:43-55`).
- **RN-TAR-10 · Color de texto sobre el color del proyecto.** El texto del encabezado de la tarjeta
  se calcula por luminosidad: si el fondo es claro, texto gris oscuro; si es oscuro, texto blanco
  (`textOn`, `src/lib/utils.ts:82-90`).
- **RN-TAR-11 · Cómo se reconoce una @mención.** Las menciones se guardan como texto plano. Se
  reconocen por nombre: primero el nombre completo (gana el más largo) y si no, el primer nombre
  cuando es único en el equipo. Una "@" pegada a una letra (un correo electrónico) no cuenta
  (`src/lib/menciones.ts:21-52`).

## 6. Pantalla y comportamiento

La ventana de tarea es un panel que ocupa todo el alto de la pantalla y entra deslizándose desde la
derecha, con un ancho máximo de pantalla mediana; en celular ocupa todo el ancho
(`src/components/TaskEditor.tsx:95`). Arriba tiene una franja fina con el color del proyecto elegido,
que cambia de color en vivo al cambiar de proyecto (`:96`). El fondo de atrás queda gris translúcido
y se puede tocar para cerrar sin guardar (`:94`).

Orden de los campos, de arriba hacia abajo (`src/components/TaskEditor.tsx:117-343`): aviso de solo
lectura si corresponde, Título, Proyecto, Fecha / Inicio / Fin en tres columnas, aviso de "sin
fecha", Hito (solo si el proyecto tiene), Estado, Urgente e Importancia en dos columnas, "¿Necesita
una decisión del Gerente?", Responsables, Descripción, Checklist, Enlaces y, al final, el hilo de
comentarios.

Al pie, fijo: "Eliminar" a la izquierda (solo en tareas que ya existen), y "Cancelar" y "Guardar" a
la derecha (`:351-388`). "Guardar" cierra la ventana.

**Estados vacíos.** Si todavía no hay proyectos cargados, el selector muestra "Todavía no hay
proyectos" (`src/components/Selectores.tsx:93-95`) y la tarea no se puede guardar porque falta el
proyecto. Sin responsables, el selector dice "Sin responsables"
(`src/components/Selectores.tsx:133`). Sin comentarios, el bloque igual aparece con el campo para
escribir el primero.

**Carga y error.** La ventana no tiene pantalla de carga propia: trabaja sobre los datos que ya
tiene la aplicación. Guardar es instantáneo en pantalla; si la base rechaza el guardado, el error
sale por la consola del navegador y **no hay aviso visible** (`src/state/AppContext.tsx:83`).

**Celular.** El panel pasa a ocupar el ancho completo. Los tres campos de fecha y hora siguen en tres
columnas, así que quedan angostos. Los botones de borrar de checklist y enlaces están siempre
visibles (no dependen de pasar el mouse por encima), a diferencia de los botones de borrar de
comentarios y de fijados, que en computadora aparecen recién al pasar el mouse
(`src/components/Comments.tsx:85`).

## 7. Casos límite y errores

- **Dos personas editan la misma tarea al mismo tiempo.** Gana la última en guardar: la ventana
  manda la tarea completa, no solo el campo que cambió. Si la otra persona ya había guardado, su
  cambio se pierde sin aviso. En cambio, si la otra persona guarda **mientras** esta ventana está
  abierta, el cambio no se ve reflejado en la ventana: el borrador se copió al abrirla
  (`src/components/TaskEditor.tsx:23-25`).
- **La base todavía no corrió la migración del Panel.** El guardado reintenta sin las tres columnas
  nuevas, así que la tarea se guarda igual pero pierde la fecha de completado y la marca de decisión
  (`src/lib/supabaseApi.ts:405-412`).
- **La tabla `task_comments` no existe.** La carga inicial devuelve lista vacía en lugar de romper
  (`src/lib/supabaseApi.ts:382`), así que el hilo aparece vacío.
- **Se borró el proyecto de la tarea.** Las tareas del proyecto se borran con él
  (`src/state/AppContext.tsx:385-393`, y en la base por `on delete cascade`,
  `supabase/schema.sql:36`).
- **Se borró una persona que era responsable.** Sale de la lista de responsables de todas las tareas.
  Si era la única, la tarea queda sin responsables y entonces **cualquiera** puede editarla
  (RN-TAR-01).
- **Un enlace escrito a mano y mal formado.** Se guarda igual con `https://` adelante; el navegador
  dirá que no existe cuando alguien lo toque. La app no valida que el enlace funcione.
- **Sesión sin perfil.** Si la cuenta entró pero no tiene perfil en `profiles`, la app lo crea sola
  al cargar; la primera persona del sistema queda como Gerente
  (`src/state/AppContext.tsx:199-209`).

## 8. Criterios de aceptación

1. **CA-TAR-01** — Tocar "+ Nueva" arriba a la derecha. Resultado: se abre el panel "Nueva tarea",
   con la fecha de hoy puesta y con tu nombre ya en Responsables.
2. **CA-TAR-02** — Dejar el título vacío. Resultado: el botón "Guardar" está apagado y no responde.
3. **CA-TAR-03** — Escribir un título, elegir un proyecto y guardar. Resultado: la ventana se cierra
   y la tarea aparece al final de la columna de hoy en la Agenda.
4. **CA-TAR-04** — Crear una tarea y borrarle la fecha. Resultado: aparece el aviso "📥 Sin fecha…"
   y, al guardar, la tarea aparece en la bandeja "Sin fecha" de la Agenda.
5. **CA-TAR-05** — Elegir un proyecto que tiene hitos. Resultado: aparece el selector "Hito al que
   aporta". Elegir un hito, cambiar de proyecto a uno sin hitos y guardar: la tarea queda sin hito.
6. **CA-TAR-06** — Poner 4 estrellas y guardar. Resultado: en la tarjeta se ve la pastilla ámbar
   sólida con el número 4, y la tarea aparece en "Recordatorios críticos" de Mi Día.
7. **CA-TAR-07** — Tocar por segunda vez la cuarta estrella. Resultado: la calificación vuelve a
   "—" (0) y la pastilla desaparece de la tarjeta.
8. **CA-TAR-08** — Prender "¿Es urgente?" y guardar. Resultado: la tarjeta queda con borde rojo y la
   pastilla "URGENTE".
9. **CA-TAR-09** — Poner fecha de ayer y estado "Por hacer". Resultado: la tarjeta muestra la
   pastilla "ATRASADA". Pasarla a "Completado": la pastilla desaparece.
10. **CA-TAR-10** — Como persona que **no** es Gerente, abrir una tarea de otra persona. Resultado:
    el título dice "Ver tarea", aparece el aviso ámbar de solo lectura, ningún campo se puede tocar
    y abajo solo está "Cerrar".
11. **CA-TAR-11** — En esa misma tarea ajena, con `FEATURE_COMENTARIOS` prendida, escribir un
    comentario y enviarlo. Resultado: el comentario se agrega con tu nombre y "hace unos segundos".
12. **CA-TAR-12** — Escribir "@" en la descripción. Resultado: se abre la lista "Mencionar a…";
    elegir una persona inserta "@Nombre " y, al guardar, el nombre queda resaltado en la tarjeta.
13. **CA-TAR-13** — Agregar tres ítems al checklist y dejar uno vacío. Resultado: al guardar quedan
    solo los dos con texto, y la tarjeta muestra el contador "0/2".
14. **CA-TAR-14** — Pegar una dirección web en el campo "Nombre" y dejar vacío el campo del enlace.
    Resultado: al guardar, el enlace funciona y se llama "Abrir enlace".
15. **CA-TAR-15** — Escribir un enlace sin `https://` (por ejemplo `drive.google.com/algo`).
    Resultado: al tocarlo desde la tarjeta, abre bien en una pestaña nueva.
16. **CA-TAR-16** — Tildar un ítem del checklist directamente en la tarjeta de la Agenda. Resultado:
    se tilda, el contador sube y **no** se abre la ventana de la tarea.
17. **CA-TAR-17** — Prender "¿Necesita una decisión del Gerente?" desde una cuenta que no es
    Gerente, en una tarea propia. Resultado: el botón queda azul con "Esperando decisión del
    Gerente" y la tarea aparece en la cola de decisiones del Panel del Gerente.
18. **CA-TAR-18** — Apagar ese mismo interruptor. Resultado: la tarea sale de la cola del Panel.
19. **CA-TAR-19** — Pasar una tarea a "Completado" y volver a abrirla. Resultado: sigue completada;
    en el Panel figura entre las completadas de esta semana.
20. **CA-TAR-20** — Tocar "Eliminar" y cancelar en el aviso del navegador. Resultado: la tarea sigue
    existiendo. Repetir y aceptar: desaparece de todas las pantallas.
21. **CA-TAR-21** — Con la misma tarea abierta en dos computadoras, guardar un cambio en una.
    Resultado: la otra pantalla muestra el cambio en las listas sin recargar la página.

## 9. Limitaciones conocidas y pendientes

- **No hay campo de horas.** La tarea solo guarda un horario de inicio y de fin como texto
  (`src/types.ts:41-42`). No existe estimación ni registro de horas trabajadas. (El CRM sí tiene un
  campo de horas por acción, `src/crm/tipos.ts:87`, pero es otra entidad.)
- **No hay tareas que se repitan.** No existe ningún campo de repetición ni recurrencia en `Task`.
  Una reunión semanal hay que cargarla siete veces, una por semana.
- **No hay estado "backlog".** Los estados son solo `todo`, `doing` y `done`
  (`src/types.ts:20`). Lo que en la Agenda y en Proyectos se llama "backlog" o "bandeja" no es un
  estado: es simplemente una tarea con la fecha vacía (`src/views/Agenda.tsx:35`, `:46`).
- **No hay adjuntos de archivos.** Solo enlaces a archivos que viven en otro lado (Drive, Notion).
- **No hay historial de cambios de la tarea.** No se guarda quién cambió qué ni cuándo. Las únicas
  huellas automáticas son la fecha de completado y la fecha en que empezó a esperar la decisión.
- **No hay aviso cuando falla el guardado.** El error solo queda en la consola del navegador
  (`src/state/AppContext.tsx:83`); la persona ve su cambio en pantalla y cree que se guardó.
- **No se puede editar un comentario**, solo borrarlo. Es una decisión explícita: la base no tiene
  política de actualización para `task_comments` (`supabase/migracion-comentarios.sql:62`).
- **Los responsables no reciben ninguna notificación.** Ni al ser asignados, ni al ser mencionados.
  La única forma de enterarse es entrar y mirar Mi Día.
- **La barrera de edición es solo de la interfaz.** La política de la base permite a cualquier
  persona con sesión escribir cualquier tarea (`supabase/schema.sql:132-133`).
