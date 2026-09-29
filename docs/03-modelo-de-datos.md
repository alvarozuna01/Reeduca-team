# Modelo de datos · ReEduca · Gestión de Equipo

Diccionario de datos completo: qué guarda el sistema, en qué tabla, con qué nombre exacto y quién
puede leerlo o escribirlo.

Se escribió leyendo el SQL que está en el repo (`supabase/`) y el código que traduce esas filas a
objetos de la app (`src/types.ts`, `src/crm/tipos.ts`, `src/lib/supabaseApi.ts`,
`src/crm/crmApi.ts`). Si alguna vez el documento y el SQL no coinciden, manda el SQL.

La base es **Postgres administrado por Supabase**. No hay servidor propio en el medio: el navegador
habla directo con la base, y lo único que impide que alguien vea lo que no le corresponde son las
políticas de seguridad a nivel de fila (RLS) que se describen en la sección 8. Esto es importante:
esconder un botón en la pantalla no protege un dato; lo que protege es la política.

## 1. Panorama: 20 tablas en 6 áreas

| Área | Tablas | Para qué |
|---|---|---|
| Equipo y tareas | `profiles`, `projects`, `hitos`, `tasks` | El corazón del sistema: quiénes son, en qué proyectos trabajan, qué metas grandes hay y qué hay que hacer |
| Notas | `note_folders`, `notes`, `pins` | El cuaderno personal de cada uno y lo que fija en "Mi Día" |
| Minutas | `minutes` | Las reuniones: quiénes fueron, qué se resumió y qué acciones quedaron |
| Kickoff semanal | `kickoffs`, `kickoff_briefings`, `kickoff_anotaciones`, `consejos` | La reunión de los lunes, el briefing que cada uno deja el viernes y sus notas privadas |
| Llaves y comentarios | `feature_flags`, `task_comments` | Prender funciones nuevas de a poco, y conversar arriba de una tarea |
| CRM de instituciones | `crm_accesos`, `crm_instituciones`, `crm_oportunidades`, `crm_contactos`, `crm_interacciones`, `crm_bitacora` | Las ventas a colegios, universidades y academias, con un candado de acceso propio |

Dos aclaraciones sobre el conteo:

- Son **20 tablas**, no 22. Salieron de contar los `create table` de todos los archivos de
  `supabase/` y de cruzarlos con las tablas que el código consulta (`.from('…')` en `src/`): ambas
  listas dan exactamente las mismas 20.
- `auth.users` (la tabla de cuentas y contraseñas que administra Supabase) no está en esa cuenta:
  no es del sistema, no se escribe nunca desde el código y no se toca en ninguna migración. Se
  relaciona con `profiles` por el `id`, como se explica más abajo.

## 2. Diagrama de relaciones (en texto)

Cada flecha es una clave foránea real, declarada en el SQL. Entre paréntesis, qué pasa con la fila
hija cuando se borra la madre.

**Equipo y tareas**

```
auth.users (Supabase)
  └─→ profiles            · mismo id, copiado por el trigger on_auth_user_created.
                            NO es una clave foránea declarada (ver sección 5).

projects
  ├─→ hitos.project_id    (on delete cascade: se borran los hitos del proyecto)
  └─→ tasks.project_id    (on delete cascade: se borran las tareas del proyecto)

hitos
  └─→ tasks.hito_id       (on delete set null: la tarea queda sin hito, no se borra)
```

**Notas**

```
note_folders
  ├─→ note_folders.parent_id  (on delete set null: la subcarpeta sube a la raíz)
  └─→ notes.folder_id         (on delete set null: la nota queda sin carpeta)

notes
  └─→ pins.note_id            (on delete cascade: el fijado desaparece con la nota)
```

**Kickoff**

```
kickoffs
  ├─→ kickoff_briefings.kickoff_id    (on delete cascade)
  └─→ kickoff_anotaciones.kickoff_id  (on delete cascade)

minutes  ←── kickoffs.minuta_id       (on delete set null)
consejos ←── kickoffs.consejo_id      (on delete set null)
```

**Comentarios**

```
tasks
  └─→ task_comments.task_id  (on delete cascade: al borrar la tarea se van sus comentarios)
```

**CRM**

```
crm_instituciones
  ├─→ crm_oportunidades.institucion_id  (on delete cascade)
  ├─→ crm_contactos.institucion_id      (on delete cascade)
  └─→ crm_interacciones.institucion_id  (on delete cascade)

crm_oportunidades
  └─→ crm_interacciones.oportunidad_id  (on delete set null: la acción queda huérfana de venta)
```

**Sin flecha (a propósito o por omisión)**

Estas columnas guardan el id de una persona, pero **no** tienen clave foránea a `profiles`:
`note_folders.user_id`, `notes.user_id`, `notes.shared_with[]`, `pins.user_id`, `tasks.assignee_ids[]`,
`minutes.participant_ids[]`, `task_comments.user_id`, `feature_flags.user_id`, `consejos.creado_por`,
`kickoff_briefings.usuario_id`, `kickoff_anotaciones.usuario_id`, `crm_accesos.user_id`,
`crm_accesos.otorgado_por`, `crm_oportunidades.responsable_ids[]`,
`crm_interacciones.responsable_ids[]`, `crm_bitacora.usuario_id`.

Consecuencia práctica: **borrar a una persona no limpia nada**. Su id queda dentro de las tareas
donde figuraba como responsable, dentro de las minutas donde participó y dentro de sus comentarios.
En la pantalla eso se ve como un responsable que no aparece o un comentario firmado "Alguien"
(`src/components/Comments.tsx:72`). Las columnas de tipo `uuid[]` no podrían tener clave foránea ni
queriendo: Postgres no soporta claves foráneas sobre arreglos.

## 3. La convención camelCase ↔ snake_case

Dos idiomas para el mismo dato:

- **Postgres** usa `snake_case`: `project_id`, `assignee_ids`, `necesita_decision_gg`.
- **TypeScript** usa `camelCase`: `projectId`, `assigneeIds`, `necesitaDecisionGg`.

La traducción vive en **un solo lugar por área**, y en ningún otro:

| Área | Archivo | Cómo se llaman las funciones |
|---|---|---|
| Todo el sistema menos el CRM | `src/lib/supabaseApi.ts:5-331` | `rowToTask` / `taskToRow`, `rowToNote` / `noteToRow`, `rowToMinute` / `minuteToRow`, etc. |
| CRM | `src/crm/crmApi.ts:43-180` | `filaAInstitucion` / `institucionAFila`, `filaAAccion` / `accionAFila`, etc. |

Regla de oro: **ningún componente de pantalla ve nombres en `snake_case`**. Si aparece un
`project_id` fuera de esos dos archivos, es un error.

Tres detalles que conviene saber:

1. **Adentro de un `jsonb` no se traduce nada.** El contenido de `tasks.checklist`,
   `tasks.links`, `minutes.actions` y `kickoffs.notas` se guarda tal cual sale de TypeScript, así
   que adentro del JSON las claves están en `camelCase` (`taskId`, `citaOrigen`, `bloque3`). Eso es
   a propósito: el JSON no pasa por los mapeadores.
2. **El CRM usa nombres en español, y la app renombra algunos.** La tabla se llama
   `crm_interacciones` pero en la app la entidad se llama `CrmAccion` y la lista se llama `acciones`
   (`src/crm/tipos.ts:76` y `src/crm/crmApi.ts:188`). Es el mismo dato con dos nombres.
3. **Los `null` se normalizan al leer.** Los mapeadores convierten `null` en `''`, `[]`, `false`, `0`
   o `undefined` según el campo (por ejemplo `src/lib/supabaseApi.ts:17-23`), así que la app nunca
   tiene que preguntarse si un arreglo vino vacío o nulo.

## 4. Diccionario de datos

En las tablas de abajo, "obligatorio" significa `not null` en Postgres. Si una columna tiene valor
por defecto y es obligatoria, se puede omitir al insertar: la base la completa sola.

### 4.1 Equipo y tareas

#### `profiles` — las personas del equipo

Una fila por persona. La crea automáticamente el trigger `on_auth_user_created`
(`supabase/schema.sql:112-114`) cuando alguien se registra: copia el `id` de `auth.users`, toma el
nombre de los metadatos de la cuenta (o la parte del email antes de la arroba) y le pone el rol.
**La primera persona que se registra queda como Gerente**; el resto, como miembro
(`supabase/schema.sql:106`).

Definición: `supabase/schema.sql:7-14`. Tipo en la app: `User` (`src/types.ts:3-10`).

| Columna | Tipo | Obligatorio | Valor por defecto | Qué significa |
|---|---|---|---|---|
| `id` | `uuid` | Sí (clave primaria) | `gen_random_uuid()` | Identifica a la persona. En la práctica es siempre el mismo id que tiene su cuenta en `auth.users` |
| `name` | `text` | Sí | — | Cómo se la llama en todo el sistema. Es también el nombre que se escribe después de la @ para mencionarla |
| `email` | `text` | Sí | `''` | Su correo. Es con lo que entra al sistema |
| `role` | `text` | Sí | `'member'` | `admin` (Gerente) o `member` (Equipo). Solo esos dos valores: hay un `check` |
| `color` | `text` | Sí | `'#64748B'` | El color de su avatar cuando no tiene foto |
| `avatar_url` | `text` | No | `null` | Enlace a su foto. Si está vacío, se dibuja el círculo de color con sus iniciales |

#### `projects` — los proyectos

Una fila por proyecto. El proyecto es lo que le da color a cada tarea en toda la aplicación.

Definición: `supabase/schema.sql:17-22`, más la columna `position` que agregó
`supabase/migracion-orden-proyectos.sql:13`. Tipo en la app: `Project` (`src/types.ts:12-18`).

| Columna | Tipo | Obligatorio | Valor por defecto | Qué significa |
|---|---|---|---|---|
| `id` | `uuid` | Sí (clave primaria) | `gen_random_uuid()` | Identifica al proyecto |
| `name` | `text` | Sí | — | Cómo se llama |
| `color` | `text` | Sí | `'#5AB6E8'` | Su color identificativo, el que se ve en las pastillas y los bordes de las tarjetas |
| `description` | `text` | No | `null` | Una línea que explica de qué se trata |
| `position` | `integer` | Sí | `0` | El orden que configura el Gerente (Configuración → Orden de los proyectos). Mientras nadie ordene nada todos valen 0 y la lista sale alfabética. **Columna agregada después**: el guardado la omite si la base todavía no la tiene (`src/lib/supabaseApi.ts:430-434`) |

#### `hitos` — las metas grandes de cada proyecto

Una fila por hito. Un hito agrupa tareas que empujan hacia la misma meta y tiene una fecha objetivo
opcional.

Definición: `supabase/schema.sql:25-31` y `supabase/migracion-hitos-backlog.sql:8-14`. Tipo en la
app: `Hito` (`src/types.ts:87-93`).

| Columna | Tipo | Obligatorio | Valor por defecto | Qué significa |
|---|---|---|---|---|
| `id` | `uuid` | Sí (clave primaria) | `gen_random_uuid()` | Identifica al hito |
| `project_id` | `uuid` | Sí | — | De qué proyecto es. Apunta a `projects.id`, **cascada al borrar** |
| `name` | `text` | Sí | — | La meta, escrita como resultado ("Cierre del Módulo 4") |
| `date` | `date` | No | `null` | La fecha objetivo. Puede no tenerla |
| `position` | `integer` | Sí | `0` | Orden manual dentro del proyecto |

#### `tasks` — las tareas

La tabla más usada del sistema: todas las pantallas (Mi Día, Agenda, Kanban, Hitos, Proyectos,
Panel) son maneras distintas de mirar estas mismas filas.

Definición: `supabase/schema.sql:34-50`, más `hito_id` (`supabase/migracion-hitos-backlog.sql:21`) y
las tres columnas del Panel (`supabase/migracion-panel-pm.sql:14-16`, repetidas en
`supabase/migracion-kickoff-2-tablas.sql:20-22`). Tipo en la app: `Task` (`src/types.ts:34-53`).

| Columna | Tipo | Obligatorio | Valor por defecto | Qué significa |
|---|---|---|---|---|
| `id` | `uuid` | Sí (clave primaria) | `gen_random_uuid()` | Identifica a la tarea |
| `project_id` | `uuid` | Sí | — | A qué proyecto pertenece. Apunta a `projects.id`, **cascada al borrar** |
| `hito_id` | `uuid` | No | `null` | A qué hito aporta. Apunta a `hitos.id`, **se pone en null al borrar el hito**. **Columna agregada después** |
| `title` | `text` | Sí | — | Qué hay que hacer |
| `description` | `text` | No | `null` | El detalle. Acá también se reconocen las @menciones |
| `date` | `date` | No | `null` | Para qué día es. **`null` significa "sin fecha"** y la tarea va a la bandeja de la Agenda. Originalmente era obligatoria; `supabase/migracion-hitos-backlog.sql:20` le quitó el `not null` |
| `start_time` | `text` | No | `null` | Hora de inicio, como texto `HH:mm`. Es texto y no `time` a propósito: la app la maneja como cadena |
| `end_time` | `text` | No | `null` | Hora de fin, también `HH:mm` |
| `assignee_ids` | `uuid[]` | Sí | `'{}'` | Los responsables. Pueden ser varios, o ninguno |
| `status` | `text` | Sí | `'todo'` | `todo` (Por hacer), `doing` (En progreso) o `done` (Completado). Hay un `check` con esos tres |
| `position` | `integer` | Sí | `0` | Orden manual dentro del día |
| `checklist` | `jsonb` | Sí | `'[]'` | La lista de sub-pasos. Forma exacta en la sección 6 |
| `links` | `jsonb` | Sí | `'[]'` | Los enlaces (Drive, Notion…). Forma exacta en la sección 6 |
| `urgent` | `boolean` | Sí | `false` | Marca de urgencia (el rayo). Agregada en la Fase 2 |
| `importance` | `integer` | Sí | `0` | Importancia de 0 (sin calificar) a 5 estrellas. **Ojo**: el `check (importance between 0 and 5)` existe solo si la base se creó con `supabase/schema.sql:49`; las migraciones de Fase 2 y 3 agregan la columna sin ese `check` |
| `completed_at` | `timestamptz` | No | `null` | Cuándo pasó a "Completado". **La estampa la app, no la base**: `conEstampas` en `src/state/AppContext.tsx:91-104` la pone al pasar a `done` y la borra al volver atrás. Alimenta "completadas esta semana" del Panel |
| `necesita_decision_gg` | `boolean` | Sí | `false` | La tarea está frenada esperando que el Gerente decida algo. La marca cualquiera del equipo desde la ventana de la tarea (`src/components/TaskEditor.tsx:217-242`) |
| `necesita_decision_desde` | `timestamptz` | No | `null` | Desde cuándo espera esa decisión. También la estampa `conEstampas`, para poder mostrar "hace 4 días" en la cola de decisiones |

### 4.2 Notas

#### `note_folders` — las carpetas del cuaderno

Definición: `supabase/schema.sql:53-59`. Tipo: `NoteFolder` (`src/types.ts:57-63`).

| Columna | Tipo | Obligatorio | Valor por defecto | Qué significa |
|---|---|---|---|---|
| `id` | `uuid` | Sí (clave primaria) | `gen_random_uuid()` | Identifica a la carpeta |
| `user_id` | `uuid` | Sí | — | De quién es. Las carpetas son **privadas**: nadie ve las de otro |
| `name` | `text` | Sí | — | Cómo se llama |
| `parent_id` | `uuid` | No | `null` | La carpeta madre, si es una subcarpeta. Apunta a `note_folders.id`, **se pone en null al borrar la madre** |
| `position` | `integer` | Sí | `0` | Orden manual entre hermanas |

#### `notes` — las notas

Definición: `supabase/schema.sql:62-71`, más `shared_with` (`supabase/migracion-fase3.sql:43`).
Tipo: `Note` (`src/types.ts:65-74`).

| Columna | Tipo | Obligatorio | Valor por defecto | Qué significa |
|---|---|---|---|---|
| `id` | `uuid` | Sí (clave primaria) | `gen_random_uuid()` | Identifica a la nota |
| `user_id` | `uuid` | Sí | — | Quién es el dueño |
| `folder_id` | `uuid` | No | `null` | En qué carpeta está. Apunta a `note_folders.id`, **se pone en null al borrar la carpeta**: la nota nunca se pierde |
| `title` | `text` | Sí | `''` | El título |
| `content` | `text` | Sí | `''` | **El cuerpo de la nota en HTML**, tal como lo genera el editor de texto enriquecido |
| `pinned` | `boolean` | Sí | `false` | Si va arriba de la lista del cuaderno |
| `updated_at` | `timestamptz` | Sí | `now()` | Cuándo se modificó por última vez. La manda la app en cada guardado |
| `shared_with` | `uuid[]` | Sí | `'{}'` | Con quiénes se compartió. **Quien está en esta lista puede ver y también editar**. **Columna agregada después**: el guardado la omite si la base todavía no la tiene (`src/lib/supabaseApi.ts:454-458`) |

#### `pins` — los fijados de "Mi Día"

Un fijado es **o** una nota anclada (`note_id` con valor) **o** un recordatorio suelto escrito a mano
(`text` con valor). Nunca las dos cosas.

Definición: `supabase/schema.sql:74-80` y `supabase/migracion-fase3.sql:46-52`. Tipo: `Pin`
(`src/types.ts:77-83`).

| Columna | Tipo | Obligatorio | Valor por defecto | Qué significa |
|---|---|---|---|---|
| `id` | `uuid` | Sí (clave primaria) | `gen_random_uuid()` | Identifica al fijado |
| `user_id` | `uuid` | Sí | — | De quién es. Los fijados son **privados** |
| `note_id` | `uuid` | No | `null` | La nota anclada. Apunta a `notes.id`, **cascada al borrar**: si se borra la nota, desaparece el fijado |
| `text` | `text` | No | `null` | El recordatorio escrito a mano, cuando no es una nota |
| `position` | `integer` | Sí | `0` | Orden manual en la lista de Mi Día |

### 4.3 Minutas

#### `minutes` — las minutas de reunión

Compartidas por todo el equipo: cualquiera las lee y las escribe.

Definición: `supabase/schema.sql:83-90`, más las tres columnas de transcripción
(`supabase/migracion-kickoff-2-tablas.sql:14-17`). Tipo: `Minute` (`src/types.ts:114-124`).

| Columna | Tipo | Obligatorio | Valor por defecto | Qué significa |
|---|---|---|---|---|
| `id` | `uuid` | Sí (clave primaria) | `gen_random_uuid()` | Identifica a la minuta |
| `title` | `text` | Sí | — | El título de la reunión |
| `date` | `date` | Sí | — | Cuándo fue |
| `participant_ids` | `uuid[]` | Sí | `'{}'` | Quiénes participaron |
| `summary` | `text` | Sí | `''` | El resumen de lo hablado |
| `actions` | `jsonb` | Sí | `'[]'` | Las acciones acordadas. Forma exacta en la sección 6 |
| `transcripcion` | `text` | No | `null` | El texto crudo de la reunión, tal cual se pegó. Nunca se reescribe. **Columna agregada después** |
| `transcripcion_cargada_at` | `timestamptz` | No | `null` | Cuándo se pegó esa transcripción |
| `estado_procesamiento` | `text` | Sí | `'sin_transcripcion'` | `sin_transcripcion`, `sin_procesar` o `procesada`. Hay un `check`. Quedó del módulo de IA que se descartó: hoy el estándar de minutas es manual |

Las tres últimas columnas se omiten en el guardado si la base todavía no las tiene
(`src/lib/supabaseApi.ts:163-169` y `:477-481`).

### 4.4 Kickoff semanal

#### `kickoffs` — un lunes de kickoff

Una fila por lunes. La `fecha` es **única**: no puede haber dos kickoffs del mismo día.

Definición: `supabase/migracion-kickoff-2-tablas.sql:47-54`. Tipo: `Kickoff` (`src/types.ts:151-158`).

| Columna | Tipo | Obligatorio | Valor por defecto | Qué significa |
|---|---|---|---|---|
| `id` | `uuid` | Sí (clave primaria) | `gen_random_uuid()` | Identifica al kickoff |
| `fecha` | `date` | Sí (**única**) | — | El lunes que corresponde |
| `estado` | `text` | Sí | `'preparado'` | `preparado`, `en_curso` o `cerrado`. Hay un `check` |
| `minuta_id` | `uuid` | No | `null` | La minuta que se genera al cerrar el kickoff. Apunta a `minutes.id`, **se pone en null si se borra la minuta** |
| `consejo_id` | `uuid` | No | `null` | El consejo que se mostró ese lunes, congelado. Apunta a `consejos.id`, **se pone en null al borrar el consejo**. Hoy no se usa: el "Consejo de la semana" se eliminó de la pantalla |
| `notas` | `jsonb` | Sí | `'{}'` | Presentes, la línea de la semana de cada uno y las acciones acordadas. Forma exacta en la sección 6 |

#### `kickoff_briefings` — las dos preguntas del viernes

Una fila por persona y por lunes: el par `(kickoff_id, usuario_id)` es **único**. Es tabla aparte
(y no un campo del kickoff) justamente porque la RLS protege filas: así cada uno guarda su respuesta
sin poder tocar la del resto.

Definición: `supabase/migracion-kickoff-2-tablas.sql:68-76`. Tipo: `KickoffBriefing`
(`src/types.ts:161-168`).

| Columna | Tipo | Obligatorio | Valor por defecto | Qué significa |
|---|---|---|---|---|
| `id` | `uuid` | Sí (clave primaria) | `gen_random_uuid()` | Identifica al briefing |
| `kickoff_id` | `uuid` | Sí | — | De qué lunes es. Apunta a `kickoffs.id`, **cascada al borrar** |
| `usuario_id` | `uuid` | Sí | — | De quién es |
| `en_que_trabajo` | `text` | Sí | `''` | Respuesta a "¿En qué vas a trabajar?" |
| `necesito_algo` | `text` | Sí | `''` | Respuesta a "¿Necesitás algo de alguien?" |
| `completado_at` | `timestamptz` | No | `null` | Cuándo lo completó. La app la pone solo si al menos una de las dos respuestas tiene texto (`src/views/Kickoff.tsx:692`) |

#### `kickoff_anotaciones` — las notas personales del kickoff

Privadas **de verdad**: ni el Gerente las ve, salvo que su dueño las pase a `compartida`.

Definición: `supabase/migracion-kickoff-2-tablas.sql:95-105`. Tipo: `KickoffAnotacion`
(`src/types.ts:171-181`).

| Columna | Tipo | Obligatorio | Valor por defecto | Qué significa |
|---|---|---|---|---|
| `id` | `uuid` | Sí (clave primaria) | `gen_random_uuid()` | Identifica a la anotación |
| `kickoff_id` | `uuid` | Sí | — | De qué lunes es. Apunta a `kickoffs.id`, **cascada al borrar** |
| `usuario_id` | `uuid` | Sí | — | De quién es |
| `bloque` | `text` | Sí | — | Sobre qué parte del briefing es. Hoy la app usa tres valores: `general`, `cerradas` y `semana` (`src/views/Kickoff.tsx:714`, `:732`, `:762`). No hay `check`: es texto libre |
| `referencia_id` | `uuid` | No | `null` | La tarea concreta a la que se refiere, cuando la anotación cuelga de una fila |
| `texto_resaltado` | `text` | No | `null` | El título de esa tarea, copiado para poder mostrarlo sin buscarla |
| `comentario` | `text` | Sí | `''` | Lo que la persona escribió |
| `visibilidad` | `text` | Sí | `'privada'` | `privada` o `compartida`. Hay un `check`. Al pasarla a `compartida` la ve todo el equipo, no solo el Gerente |
| `created_at` | `timestamptz` | Sí | `now()` | Cuándo la escribió. La manda la app |

#### `consejos` — recomendaciones al Gerente

Tabla del módulo de consejos, que se **descartó**: el "Consejo de la semana" se eliminó de Mi Día y
del kickoff. La tabla queda creada y con su política, pero hoy **está inerte**: nada del código
escribe en ella, y solo el Gerente puede leerla.

Definición: `supabase/migracion-kickoff-2-tablas.sql:25-38`. Tipo: `Consejo` (`src/types.ts:128-141`).

| Columna | Tipo | Obligatorio | Valor por defecto | Qué significa |
|---|---|---|---|---|
| `id` | `uuid` | Sí (clave primaria) | `gen_random_uuid()` | Identifica al consejo |
| `texto` | `text` | Sí | — | El consejo en una frase |
| `por_que` | `text` | No | `null` | Por qué vale la pena |
| `quien_lo_dijo` | `text` | No | `null` | De quién salió |
| `fecha_recibida` | `date` | Sí | `current_date` | Cuándo se recibió |
| `origen_tabla` | `text` | No | `null` | De qué tabla salió (por ejemplo `minutes`) |
| `origen_id` | `uuid` | No | `null` | El id de esa fila de origen |
| `cita_origen` | `text` | No | `null` | La frase textual de donde salió |
| `estado` | `text` | Sí | `'activo'` | `activo` o `archivado`. Hay un `check` |
| `veces_mostrado` | `integer` | Sí | `0` | Cuántas veces se mostró, para rotar |
| `ultima_aparicion` | `date` | No | `null` | Cuándo se mostró por última vez |
| `creado_por` | `uuid` | No | `null` | Quién lo cargó |

### 4.5 Llaves y comentarios

#### `feature_flags` — las llaves de las funciones

El mecanismo con el que se prende una función nueva para una persona antes de abrirla a todo el
equipo. **La regla es una sola: la fila de esa persona gana sobre la fila global.** Está
implementada en `hasFlag` (`src/state/AppContext.tsx:290-296`).

Definición: `supabase/migracion-kickoff-1-llave.sql:12-18` (la crean igual, con `if not exists`,
`supabase/migracion-comentarios.sql:15-21` y `supabase/migracion-panel-pm.sql:19-25`, por si esa
migración se corre primero). Tipo: `FeatureFlag` (`src/types.ts:201-206`).

| Columna | Tipo | Obligatorio | Valor por defecto | Qué significa |
|---|---|---|---|---|
| `id` | `uuid` | Sí (clave primaria) | `gen_random_uuid()` | Identifica a la fila |
| `flag` | `text` | Sí | — | El nombre de la llave: `FEATURE_KICKOFF`, `FEATURE_COMENTARIOS` o `FEATURE_PANEL` (`src/types.ts:208-210`) |
| `user_id` | `uuid` | No | `null` | Para quién vale. **`null` = valor global, para todo el equipo** |
| `enabled` | `boolean` | Sí | `false` | Prendida o apagada |

Restricción clave: `unique nulls not distinct (flag, user_id)`. El `nulls not distinct` es lo que
hace que no pueda haber **dos** filas globales de la misma llave (por defecto Postgres considera que
dos `null` son distintos y las dejaría pasar). Por eso el guardado usa
`onConflict: 'flag,user_id'` (`src/lib/supabaseApi.ts:509`): actualiza la fila que ya existe en vez
de duplicarla.

#### `task_comments` — los comentarios de una tarea

Comentar **no** requiere poder editar la tarea: es justamente para opinar sobre las tareas de otros.
Los comentarios no se editan, se borran.

Definición: `supabase/migracion-comentarios.sql:34-41`. Índice
`task_comments_task_id_idx` sobre `task_id`. Tipo: `TaskComment` (`src/types.ts:186-192`).

| Columna | Tipo | Obligatorio | Valor por defecto | Qué significa |
|---|---|---|---|---|
| `id` | `uuid` | Sí (clave primaria) | `gen_random_uuid()` | Identifica al comentario |
| `task_id` | `uuid` | Sí | — | Sobre qué tarea es. Apunta a `tasks.id`, **cascada al borrar** |
| `user_id` | `uuid` | Sí | — | Quién lo escribió. La política de seguridad obliga a que sea uno mismo |
| `text` | `text` | Sí | — | El comentario. Las @menciones viven acá, como texto plano |
| `created_at` | `timestamptz` | Sí | `now()` | Cuándo se escribió. La manda la app |

### 4.6 CRM de instituciones

Las seis tablas llevan el prefijo `crm_` para no chocar con las del sistema, y todas están detrás
del mismo candado: la lista de acceso.

#### `crm_accesos` — quién puede entrar al CRM

**Es la única tabla del sistema sin columna `id`**: su clave primaria es `user_id`. Por eso el
código la trata distinto tanto al mapear (`src/crm/crmApi.ts:176-180`, que no devuelve `id`) como al
recibir cambios en tiempo real (`src/crm/CrmProvider.tsx:79-84`, que compara por `user_id`).

Definición: `supabase/migracion-crm-1-esquema.sql:17-21`. Tipo: `CrmAcceso`
(`src/crm/tipos.ts:104-108`).

| Columna | Tipo | Obligatorio | Valor por defecto | Qué significa |
|---|---|---|---|---|
| `user_id` | `uuid` | Sí (clave primaria) | — | La persona con acceso |
| `otorgado_por` | `uuid` | No | `null` | Qué Gerente se lo dio |
| `created_at` | `timestamptz` | Sí | `now()` | Cuándo |

#### `crm_instituciones` — los colegios, universidades y academias

Definición: `supabase/migracion-crm-1-esquema.sql:49-64`. Tipo: `CrmInstitucion`
(`src/crm/tipos.ts:34-49`).

| Columna | Tipo | Obligatorio | Valor por defecto | Qué significa |
|---|---|---|---|---|
| `id` | `uuid` | Sí (clave primaria) | `gen_random_uuid()` | Identifica a la institución |
| `codigo` | `text` | No (**único**) | `null` | El código que tenía en la planilla vieja (`I001`, `I002`…). Sirve para no duplicar al recargar datos |
| `nombre` | `text` | Sí | — | Cómo se llama |
| `segmento` | `text` | Sí | `''` | `Colegio`, `Universidad` o `Academia` (`src/crm/tipos.ts:18`). Sin `check`: es texto libre |
| `ciudad` | `text` | Sí | `''` | Dónde queda |
| `direccion` | `text` | Sí | `''` | La dirección |
| `en_lnr` | `boolean` | Sí | `false` | Si participa de la Liga Nacional de Robótica |
| `eq_intelliq` | `int` | No | `null` | Cantidad de equipamiento IntelliQ |
| `eq_v5` | `int` | No | `null` | Cantidad de equipamiento V5 |
| `eq_universo` | `int` | No | `null` | Cantidad de equipamiento Universo |
| `activo` | `text` | Sí | `''` | Campo heredado de la planilla |
| `drive_url` | `text` | Sí | `''` | La carpeta de Drive de esa institución |
| `especial` | `boolean` | Sí | `false` | Marca de seguimiento especial |
| `created_at` | `timestamptz` | Sí | `now()` | Cuándo se cargó. La manda la app |

#### `crm_oportunidades` — una venta concreta

**Dato de diseño importante**: si es venta o posventa **no se guarda**, se deduce de la etapa
(`CERRADO-GANADO` = posventa, `CERRADO-NO GANADO` = perdida, el resto = venta). La función que lo
calcula es `tipoDe` (`src/crm/reglas.ts:10`).

Definición: `supabase/migracion-crm-1-esquema.sql:69-83`. Índice `crm_oportunidades_inst_idx` sobre
`institucion_id`. Tipo: `CrmOportunidad` (`src/crm/tipos.ts:51-63`).

| Columna | Tipo | Obligatorio | Valor por defecto | Qué significa |
|---|---|---|---|---|
| `id` | `uuid` | Sí (clave primaria) | `gen_random_uuid()` | Identifica a la oportunidad |
| `codigo` | `text` | No (**único**) | `null` | El código de la planilla vieja (`O001`…) |
| `institucion_id` | `uuid` | Sí | — | De qué institución es. Apunta a `crm_instituciones.id`, **cascada al borrar** |
| `modalidad` | `text` | Sí | `''` | `Curricular`, `Extracurricular` o vacío (`src/crm/tipos.ts:17`) |
| `producto` | `text` | Sí | `''` | Qué se está vendiendo |
| `etapa` | `text` | Sí | `'CONTACTO INICIAL'` | Una de las 8 del embudo, con `check`: `CONTACTO INICIAL`, `EN SEGUIMIENTO`, `LLEVAR PROPUESTA FÍSICA`, `P.FÍSICA ENTREGADA`, `PROPUESTA ENVIADA`, `EN REVISIÓN/AJUSTE`, `CERRADO-GANADO`, `CERRADO-NO GANADO` |
| `valor` | `numeric` | No | `null` | El monto, si se cargó |
| `estado_posventa` | `text` | Sí | `''` | `ACTIVO`, `ACTIVO-LNR`, `EN STAND BY` o `INACTIVO` (`src/crm/tipos.ts:14`). Sin `check` |
| `objetivo_2027` | `boolean` | Sí | `false` | Marcada como objetivo 2027 (la pestaña "🎯 2027") |
| `responsable_ids` | `uuid[]` | Sí | `'{}'` | Quiénes la llevan |
| `created_at` | `timestamptz` | Sí | `now()` | Cuándo se creó |

#### `crm_contactos` — las personas de cada institución

**Acá viven datos personales de terceros** (teléfonos y correos de gente de los colegios). Por eso
los datos reales nunca están en el repo: se cargan con un archivo generado aparte (ver sección 9).

Definición: `supabase/migracion-crm-1-esquema.sql:87-96`. Índice `crm_contactos_inst_idx` sobre
`institucion_id`. Tipo: `CrmContacto` (`src/crm/tipos.ts:65-73`).

| Columna | Tipo | Obligatorio | Valor por defecto | Qué significa |
|---|---|---|---|---|
| `id` | `uuid` | Sí (clave primaria) | `gen_random_uuid()` | Identifica al contacto |
| `institucion_id` | `uuid` | Sí | — | De qué institución es. Apunta a `crm_instituciones.id`, **cascada al borrar** |
| `nombre` | `text` | Sí | `''` | Cómo se llama |
| `rol` | `text` | Sí | `''` | Su cargo (Dirección, Administración…) |
| `telefono` | `text` | Sí | `''` | Su teléfono |
| `mail` | `text` | Sí | `''` | Su correo |
| `notas` | `text` | Sí | `''` | Notas sobre el contacto |
| `created_at` | `timestamptz` | Sí | `now()` | Cuándo se cargó. **La app no escribe esta columna** (`src/crm/crmApi.ts:112-120`): la completa el valor por defecto |

#### `crm_interacciones` — las acciones o gestiones

Cada acción es un paso concreto del seguimiento (una llamada, un mail, una visita). En la app se
llama **acción** (`CrmAccion`) y en la base, `crm_interacciones`.

Definición: `supabase/migracion-crm-1-esquema.sql:102-116`. Índices `crm_interacciones_inst_idx`
sobre `institucion_id` y `crm_interacciones_fecha_idx` sobre `fecha`. Tipo: `CrmAccion`
(`src/crm/tipos.ts:76-90`).

| Columna | Tipo | Obligatorio | Valor por defecto | Qué significa |
|---|---|---|---|---|
| `id` | `uuid` | Sí (clave primaria) | `gen_random_uuid()` | Identifica a la acción |
| `institucion_id` | `uuid` | Sí | — | De qué institución es. Apunta a `crm_instituciones.id`, **cascada al borrar** |
| `oportunidad_id` | `uuid` | No | `null` | De qué venta es. Apunta a `crm_oportunidades.id`, **se pone en null al borrar la oportunidad**: la acción queda en la institución, sin venta |
| `es_lnr` | `boolean` | Sí | `false` | Es una invitación a la Liga: va aparte de venta y posventa, y entonces no cuelga de ninguna oportunidad |
| `orden` | `int` | Sí | `0` | El número correlativo dentro de la cadena de la institución |
| `accion` | `text` | Sí | `''` | Qué se hizo o hay que hacer |
| `fecha` | `date` | No | `null` | Para cuándo es. Con fecha, aparece en la Agenda semanal |
| `responsable_ids` | `uuid[]` | Sí | `'{}'` | Quién la tiene |
| `estado` | `text` | Sí | `'PENDIENTE'` | `PENDIENTE`, `EN PROCESO` o `CONCRETADO`, con `check` |
| `tipo` | `text` | Sí | `''` | El ícono y el grupo: `llamada`, `mensaje`, `mail`, `reunion`, `flyer`, `presupuesto`, `lnr`, `respuesta`, `teavisamos`, `otro` (`src/crm/tipos.ts:21-32`). Sin `check` |
| `horas` | `numeric` | No | `null` | Horas dedicadas, si se cargaron |
| `link` | `text` | Sí | `''` | Un enlace asociado |
| `created_at` | `timestamptz` | Sí | `now()` | Cuándo se creó |

#### `crm_bitacora` — quién cambió qué y cuándo

Registro de auditoría del CRM. **No se edita ni se borra nunca**: no tiene políticas de `update`
ni de `delete`, así que la base rechaza cualquier intento. Guarda el nombre de las cosas en texto
(no ids) a propósito, para que el registro siga siendo legible aunque después se borre la
institución o la acción.

Definición: `supabase/migracion-crm-1-esquema.sql:121-131`. Índice `crm_bitacora_fecha_idx` sobre
`fecha_hora desc`. Tipo: `CrmBitacora` (`src/crm/tipos.ts:92-102`).

| Columna | Tipo | Obligatorio | Valor por defecto | Qué significa |
|---|---|---|---|---|
| `id` | `uuid` | Sí (clave primaria) | `gen_random_uuid()` | Identifica al registro |
| `fecha_hora` | `timestamptz` | Sí | `now()` | Cuándo pasó. La manda la app |
| `usuario_id` | `uuid` | No | `null` | Quién lo hizo |
| `usuario` | `text` | Sí | `''` | Su nombre, copiado |
| `cambio` | `text` | Sí | `''` | Qué tipo de cambio: `Creó`, `Editó`, `Borró`, `Movió`, `Hecha`, `Etapa`, `Creó institución`, `Editó oportunidad`… (los arma `src/crm/CrmProvider.tsx:145-160` y `:167-239`) |
| `institucion` | `text` | Sí | `''` | El nombre de la institución, copiado |
| `venta_mod` | `text` | Sí | `''` | Venta o posventa más la modalidad, o `LNR` |
| `accion` | `text` | Sí | `''` | El texto de la acción afectada |
| `detalle` | `text` | Sí | `''` | El resumen de qué cambió, campo por campo (`src/crm/CrmProvider.tsx:126-139`) |

## 5. Qué pasa al borrar: resumen de las claves foráneas

| Si se borra… | Se borra en cascada | Queda en `null` |
|---|---|---|
| Un proyecto (`projects`) | Sus hitos y **todas sus tareas** | — |
| Un hito (`hitos`) | — | `tasks.hito_id` de sus tareas |
| Una tarea (`tasks`) | Sus comentarios (`task_comments`) | — |
| Una carpeta (`note_folders`) | — | `note_folders.parent_id` de sus subcarpetas y `notes.folder_id` de sus notas |
| Una nota (`notes`) | Sus fijados (`pins`) | — |
| Un kickoff (`kickoffs`) | Sus briefings y sus anotaciones | — |
| Una minuta (`minutes`) | — | `kickoffs.minuta_id` |
| Un consejo (`consejos`) | — | `kickoffs.consejo_id` |
| Una institución (`crm_instituciones`) | Sus oportunidades, contactos y acciones | — |
| Una oportunidad (`crm_oportunidades`) | — | `crm_interacciones.oportunidad_id` |
| Una persona (`profiles`) | **Nada** | **Nada** |

Dos aclaraciones sobre borrar una persona:

1. Al borrar el perfil, su id sigue dentro de `tasks.assignee_ids`, `minutes.participant_ids`,
   `notes.shared_with`, sus propias notas, sus fijados y sus comentarios. La aplicación limpia
   `assignee_ids` en la pantalla (`src/state/AppContext.tsx:400-407`) y el modo demo lo limpia de
   verdad (`src/lib/localApi.ts:115-120`), pero con Supabase `deleteUser`
   (`src/lib/supabaseApi.ts:448-450`) borra **solo la fila de `profiles`**: la limpieza de los
   arreglos no llega a la base.
2. La cuenta en `auth.users` no se toca. Si esa persona vuelve a entrar, la "autocuración" de
   `src/state/AppContext.tsx:196-209` le crea el perfil de nuevo.

Además, el borrado en cascada de las carpetas del cuaderno **no se usa nunca** tal como está
declarado: `removeFolder` (`src/state/AppContext.tsx:424-442`) primero mueve las subcarpetas y las
notas a la carpeta madre, y recién después borra la carpeta. La cascada de la base es la red de
seguridad, no el camino normal.

## 6. Los datos guardados como JSON adentro de una columna

Cuatro columnas guardan JSON (`jsonb`) en vez de tener su propia tabla. Se hizo así porque son
listas cortas que siempre se leen y se guardan junto con su fila madre, y nunca se buscan por
separado. El precio: la base no valida nada de lo que hay adentro, y no se puede consultar con SQL
cómodamente.

**Recordatorio**: adentro del JSON las claves están en `camelCase`, no en `snake_case`.

### 6.1 `tasks.checklist` — los sub-pasos de una tarea

Arreglo de objetos. Tipo `ChecklistItem` (`src/types.ts:22-26`).

```json
[
  { "id": "a1b2c3d4-0000-4000-8000-000000000001", "text": "Armar la plantilla", "done": true },
  { "id": "a1b2c3d4-0000-4000-8000-000000000002", "text": "Revisarla con el equipo", "done": false }
]
```

| Clave | Tipo | Obligatoria | Qué significa |
|---|---|---|---|
| `id` | texto | Sí | Identifica al ítem dentro de la lista |
| `text` | texto | Sí | El paso |
| `done` | booleano | Sí | Si está tildado |

### 6.2 `tasks.links` — los enlaces de una tarea

Arreglo de objetos. Tipo `TaskLink` (`src/types.ts:28-32`).

```json
[
  { "id": "b2c3d4e5-0000-4000-8000-000000000001", "label": "Abrir en Drive", "url": "https://drive.google.com/…" }
]
```

| Clave | Tipo | Obligatoria | Qué significa |
|---|---|---|---|
| `id` | texto | Sí | Identifica al enlace |
| `label` | texto | Sí | El nombre que se ve en el botón. La app propone "Abrir en Drive" |
| `url` | texto | Sí | El enlace |

### 6.3 `minutes.actions` — las acciones acordadas en una reunión

Arreglo de objetos. Tipo `MinuteAction` (`src/types.ts:97-110`). Solo `id` y `text` son
obligatorios: todo el resto es opcional, y las acciones viejas no los tienen.

```json
[
  {
    "id": "c3d4e5f6-0000-4000-8000-000000000001",
    "text": "Confirmar la sede de la capacitación",
    "taskId": "d4e5f6a7-0000-4000-8000-000000000002",
    "origen": "manual",
    "responsableSugeridoId": "e5f6a7b8-0000-4000-8000-000000000003",
    "fechaSugerida": "2026-10-09",
    "editada": true
  },
  {
    "id": "c3d4e5f6-0000-4000-8000-000000000004",
    "text": "Revisar el presupuesto del evento",
    "responsableSugeridoNombre": "Pablo",
    "descartada": true
  }
]
```

| Clave | Tipo | Obligatoria | Qué significa |
|---|---|---|---|
| `id` | texto | Sí | Identifica a la acción dentro de la minuta |
| `text` | texto | Sí | Qué se acordó hacer |
| `taskId` | texto | No | Se completa cuando la acción se convierte en tarea del sistema |
| `origen` | `"ia"` o `"manual"` | No | De dónde salió. Sin este campo se asume `manual` |
| `citaOrigen` | texto | No | La frase textual de la transcripción de donde salió |
| `responsableSugeridoId` | texto | No | El perfil sugerido como responsable |
| `responsableSugeridoNombre` | texto | No | El nombre crudo, por si no se pudo mapear a un perfil |
| `fechaSugerida` | texto `AAAA-MM-DD` | No | La fecha sugerida |
| `descartada` | booleano | No | Las propuestas descartadas no se borran: quedan marcadas así |
| `editada` | booleano | No | Al editarla a mano pierde el aspecto de "propuesta" |

Los cuatro campos de IA quedaron del módulo que se descartó. Hoy se usan `id`, `text`, `taskId` y,
desde el estándar manual de minutas, el responsable y la fecha que precargan "Convertir en tarea".

### 6.4 `kickoffs.notas` — lo que se escribe durante el kickoff

Un **objeto** (no un arreglo). Tipo `KickoffNotas` (`src/types.ts:145-149`). Las tres claves son
opcionales: un kickoff recién creado tiene `{}`.

```json
{
  "presentes": [
    "e5f6a7b8-0000-4000-8000-000000000003",
    "f6a7b8c9-0000-4000-8000-000000000004"
  ],
  "bloque3": {
    "e5f6a7b8-0000-4000-8000-000000000003": "Cierro la Unidad 4 y arranco la 5",
    "f6a7b8c9-0000-4000-8000-000000000004": "Tres visitas a colegios y el presupuesto de octubre"
  },
  "acciones": [
    { "id": "a7b8c9d0-0000-4000-8000-000000000005", "texto": "Pedir la cancha para el jueves" }
  ]
}
```

| Clave | Tipo | Obligatoria | Qué significa |
|---|---|---|---|
| `presentes` | arreglo de textos | No | Los ids de quienes estuvieron en la reunión. Si está vacío, al cerrar se usan todos los del bloque de la semana (`src/views/Kickoff.tsx:144`) |
| `bloque3` | objeto `id de persona → texto` | No | La "línea de la semana" de cada uno, escrita en vivo durante la reunión. Pisa lo que la persona había dejado en su briefing |
| `acciones` | arreglo de `{ id, texto }` | No | Las acciones acordadas durante la reunión. Al cerrar pasan a la minuta y, si no se cumplen, reaparecen en el bloque 2 del lunes siguiente |

## 7. Tiempo real: qué tablas están publicadas

**Las 20 tablas están publicadas** en `supabase_realtime`. Cada `alter publication` va envuelto en un
bloque que ignora el error de "ya estaba publicada", que es lo que hace que las migraciones se
puedan correr más de una vez:

```sql
do $$ begin alter publication supabase_realtime add table public.tasks;
exception when duplicate_object then null; end $$;
```

Dónde se publica cada una:

| Tablas | Publicadas en |
|---|---|
| `profiles`, `projects`, `tasks`, `notes`, `note_folders`, `minutes`, `pins`, `hitos` | `supabase/schema.sql:167-174` (y de nuevo en `supabase/migracion-fase3.sql:100-106`, menos `hitos`) |
| `hitos` | `supabase/migracion-hitos-backlog.sql:23` |
| `feature_flags` | `supabase/migracion-kickoff-1-llave.sql:35`, `supabase/migracion-comentarios.sql:31`, `supabase/migracion-panel-pm.sql:35` |
| `task_comments` | `supabase/migracion-comentarios.sql:65` |
| `consejos`, `kickoffs`, `kickoff_briefings`, `kickoff_anotaciones` | `supabase/migracion-kickoff-2-tablas.sql:121-124` |
| Las 6 tablas `crm_*` | `supabase/migracion-crm-1-esquema.sql:163-168` |

Del lado de la app, la escucha está partida en dos canales, porque el CRM tiene su propio contexto:

| Canal | Tablas | Dónde |
|---|---|---|
| `cambios-en-vivo` | las 14 tablas que no son del CRM, listadas en `REALTIME_TABLES` (`src/lib/supabaseApi.ts:342-357`) | `src/state/AppContext.tsx:224-258` |
| `crm-en-vivo` | las 6 tablas `crm_*`, listadas en `TABLAS_CRM` (`src/crm/crmApi.ts:183-190`) | `src/crm/CrmProvider.tsx:72-98` |

Publicar una tabla **no** saltea la seguridad: el aviso de tiempo real respeta la RLS de esa tabla,
así que a un miembro no le llegan los cambios de `consejos` ni los de las tablas del CRM si no tiene
acceso.

Un detalle fino: Postgres puede omitir las columnas grandes que no cambiaron en el aviso de tiempo
real. Para no pisar el valor local con un vacío, `CAMPOS_PESADOS`
(`src/state/AppContext.tsx:109-126`) conserva lo que ya había para `tasks.links`,
`tasks.checklist`, `tasks.description`, `tasks.assignee_ids`, `notes.content`, `notes.shared_with`,
`minutes.actions`, `minutes.summary`, `minutes.participant_ids` y `minutes.transcripcion`.

## 8. Seguridad: quién puede leer y quién puede escribir

Todas las tablas tienen RLS prendida. Nadie sin sesión iniciada lee nada. De ahí para arriba, cada
tabla tiene su propia regla.

### 8.1 Tabla por tabla, en criollo

| Tabla | Quién puede leer | Quién puede escribir | Dónde está la política |
|---|---|---|---|
| `profiles` | Cualquiera con sesión | Cualquiera con sesión (también el perfil de otro) | `supabase/schema.sql:126-127` |
| `projects` | Cualquiera con sesión | Cualquiera con sesión | `supabase/schema.sql:129-130` |
| `tasks` | Cualquiera con sesión | Cualquiera con sesión. **La regla de "solo el responsable o un Gerente" es de la pantalla, no de la base** (`canEditTask`, `src/lib/utils.ts:32-36`) | `supabase/schema.sql:132-133` |
| `hitos` | Cualquiera con sesión | Cualquiera con sesión | `supabase/schema.sql:135-136`, `supabase/migracion-hitos-backlog.sql:16-18` |
| `minutes` | Cualquiera con sesión | Cualquiera con sesión | `supabase/schema.sql:138-139` |
| `note_folders` | **Solo el dueño** (`user_id = auth.uid()`) | Solo el dueño | `supabase/schema.sql:142-143` |
| `pins` | **Solo el dueño** | Solo el dueño | `supabase/schema.sql:145-146` |
| `notes` | El dueño **o** quien esté en `shared_with` | Crear: solo como dueño. Editar: el dueño o quien esté en `shared_with`. **Borrar: solo el dueño** | `supabase/schema.sql:149-164` |
| `feature_flags` | Cualquiera con sesión (la app necesita saber qué mostrar) | **Solo Gerentes** | `supabase/migracion-kickoff-1-llave.sql:24-32` |
| `task_comments` | Cualquiera con sesión (para eso existen) | Crear: solo firmando como uno mismo. Borrar: el autor **o** un Gerente (moderación). **No hay política de `update`: los comentarios no se editan** | `supabase/migracion-comentarios.sql:46-60` |
| `consejos` | **Solo Gerentes** | Solo Gerentes | `supabase/migracion-kickoff-2-tablas.sql:41-44` |
| `kickoffs` | Cualquiera con sesión | Crear el lunes: cualquiera (así puede guardar su briefing). Editar y borrar: **solo Gerentes** | `supabase/migracion-kickoff-2-tablas.sql:56-62`, reemplazado por `supabase/migracion-kickoff-3-briefing.sql:13-30` |
| `kickoff_briefings` | El propio **o** un Gerente | Solo el propio (crear, editar y borrar) | `supabase/migracion-kickoff-2-tablas.sql:78-91` |
| `kickoff_anotaciones` | Las propias, **o cualquiera marcada `compartida`** | Solo las propias | `supabase/migracion-kickoff-2-tablas.sql:107-118` |
| `crm_accesos` | Cualquiera con sesión (la app necesita saber si mostrar la pestaña) | Dar y quitar acceso: **solo Gerentes**. No hay política de `update` | `supabase/migracion-crm-1-esquema.sql:37-46` |
| `crm_instituciones` | **Solo quien esté en la lista de acceso** | Solo quien esté en la lista | `supabase/migracion-crm-1-esquema.sql:141-143` |
| `crm_oportunidades` | Solo quien esté en la lista | Solo quien esté en la lista | `supabase/migracion-crm-1-esquema.sql:144-146` |
| `crm_contactos` | Solo quien esté en la lista | Solo quien esté en la lista | `supabase/migracion-crm-1-esquema.sql:147-149` |
| `crm_interacciones` | Solo quien esté en la lista | Solo quien esté en la lista | `supabase/migracion-crm-1-esquema.sql:150-152` |
| `crm_bitacora` | Solo quien esté en la lista | Solo **agregar**, y solo quien esté en la lista. **No se edita ni se borra nunca** | `supabase/migracion-crm-1-esquema.sql:155-160` |

### 8.2 Las dos funciones `security definer` del CRM

Una política de seguridad que necesita consultar otra tabla tiene un problema: esa consulta interna
también queda atrapada por la RLS de la otra tabla, y no ve nada. La salida es declarar la consulta
como `security definer`: la función corre con los permisos de su dueño y puede leer la tabla
completa, pero **solo devuelve un sí o un no**, nunca los datos.

| Función | Qué contesta | Dónde |
|---|---|---|
| `public.crm_tiene_acceso()` | ¿El usuario de esta sesión está en `crm_accesos`? | `supabase/migracion-crm-1-esquema.sql:25-28` |
| `public.crm_es_gerente()` | ¿El usuario de esta sesión tiene `role = 'admin'` en `profiles`? | `supabase/migracion-crm-1-esquema.sql:30-33` |

Las dos están declaradas `stable security definer set search_path = public`. El `set search_path` es
parte del candado: impide que alguien redefina qué significa `profiles` o `crm_accesos` adentro de
la función.

Las políticas de las tablas que no son del CRM hacen la misma consulta pero **en línea**, con un
`exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')`. Funciona
porque la política de `profiles` deja leer todo a cualquiera con sesión.

Hay una tercera función `security definer`, que no es de seguridad sino de altas:
`public.handle_new_user()` (`supabase/schema.sql:94-110`), el trigger que crea el perfil cuando
alguien se registra. Necesita ese permiso porque inserta en `profiles` desde el contexto de
`auth.users`. `supabase/migracion-datos.sql:16-49` la reemplaza por una versión con **adopción**: si
alguien se registra con un email (o un nombre de pila) que coincide con un perfil migrado del
sistema anterior que todavía no tiene cuenta, hereda ese perfil y todas sus tareas, notas,
carpetas y menciones en minutas.

## 9. Las migraciones: idempotencia y orden

### 9.1 Cómo se corren

No hay línea de comandos ni herramienta de migraciones. Cada archivo `.sql` de `supabase/` se
**pega a mano** en Supabase → SQL Editor → New query → Run. Por eso todos están escritos para poder
correrse **más de una vez sin romper nada** (son idempotentes), con cuatro recursos:

1. `create table if not exists` — si la tabla ya está, no hace nada.
2. `alter table … add column if not exists` — si la columna ya está, no hace nada.
3. `drop policy if exists` antes de cada `create policy` — reemplaza la política en vez de chocar.
4. `do $$ … exception when duplicate_object then null; end $$;` para publicar en tiempo real.

Y una regla de trabajo que acompaña a la idempotencia: las migraciones son **solo aditivas**. Nada
de `drop table` ni de `alter` destructivo sobre lo que ya existe. Las dos únicas excepciones son
controladas: `supabase/migracion-hitos-backlog.sql:20` le quita el `not null` a `tasks.date` (lo
hace más permisivo, no menos) y `supabase/migracion-kickoff-3-briefing.sql:13` borra la política
`kickoffs_write_admin` para partirla en tres más finas.

Del otro lado, la aplicación está escrita para no romperse contra una base sin migrar:

- **Tablas que faltan**: `load()` (`src/lib/supabaseApi.ts:362-403`) trae `profiles`, `projects`,
  `tasks`, `notes`, `note_folders` y `minutes` con control de error, y las ocho nuevas
  (`pins`, `hitos`, `feature_flags`, `task_comments`, `consejos`, `kickoffs`, `kickoff_briefings`,
  `kickoff_anotaciones`) con el patrón `.then((r) => (r.error ? [] : (r.data ?? [])))`: si la tabla
  no existe, esa lista queda vacía y la app sigue andando. El CRM hace lo mismo con la función
  `leer` (`src/crm/crmApi.ts:196-201`).
- **Columnas que faltan**: el guardado reintenta sin ellas. Si el mensaje de error menciona
  `completed_at`, `necesita_decision_gg` o `necesita_decision_desde`, `saveTask` vuelve a intentar
  con `sinColumnasNuevas` (`src/lib/supabaseApi.ts:55-60`, usado en `:405-422`). Lo mismo con
  `projects.position` (`:430-434`), `notes.shared_with` (`:454-458`) y las tres columnas de
  transcripción de `minutes` (`:475-483`).

### 9.2 Orden y estado

Orden en que se corren (de arriba hacia abajo). Los pasos 2 y 3 se pueden saltear en una instalación
nueva: `schema.sql` ya incluye todo lo que ellos agregan.

| # | Archivo SQL | Qué agrega | Ya corrido en producción |
|---|---|---|---|
| 1 | `supabase/schema.sql` | Las 8 tablas base (`profiles`, `projects`, `hitos`, `tasks`, `note_folders`, `notes`, `pins`, `minutes`), el trigger de alta de perfiles, sus políticas y su publicación en tiempo real | Sí |
| 2 | `supabase/migracion-fase2.sql` | Para bases que venían de la Fase 1: `tasks.urgent`, `tasks.importance`, y las tablas `note_folders`, `notes`, `minutes` | Sí (ya absorbido por `schema.sql`) |
| 3 | `supabase/migracion-fase3.sql` | Todo lo de la Fase 2 más `notes.shared_with`, la tabla `pins` y las políticas finas de `notes` | Sí (ya absorbido por `schema.sql`) |
| 4 | `supabase/migracion-datos.sql` | **Solo datos**, ninguna estructura nueva. Ver detalle abajo | Sí |
| 5 | `supabase/migracion-hitos-backlog.sql` | La tabla `hitos`, `tasks.hito_id`, saca el `not null` de `tasks.date`, y convierte en hitos las 10 "tareas-hito" que venían del Excel | Sí |
| 6 | `supabase/migracion-kickoff-1-llave.sql` | La tabla `feature_flags` y la llave `FEATURE_KICKOFF` prendida solo para el Gerente General | Sí |
| 7 | `supabase/migracion-comentarios.sql` | La tabla `task_comments` (más `feature_flags` por si acaso) y la llave `FEATURE_COMENTARIOS`, con la fila global **prendida** | Sí |
| 8 | `supabase/migracion-panel-pm.sql` | `tasks.completed_at`, `tasks.necesita_decision_gg`, `tasks.necesita_decision_desde` y la llave `FEATURE_PANEL` prendida solo para el Gerente General (fila global apagada) | Sí |
| 9 | `supabase/migracion-kickoff-2-tablas.sql` | Las 3 columnas de transcripción de `minutes`, las 3 del Panel en `tasks` (repetidas), y las tablas `consejos`, `kickoffs`, `kickoff_briefings`, `kickoff_anotaciones` | Sin confirmar |
| 10 | `supabase/migracion-kickoff-3-briefing.sql` | Parte la política de escritura de `kickoffs` en tres: crear el lunes lo puede cualquiera, editarlo y borrarlo solo los Gerentes | Sin confirmar |
| 11 | `supabase/migracion-orden-proyectos.sql` | `projects.position` | Sin confirmar |
| 12 | `supabase/migracion-crm-1-esquema.sql` | Las 6 tablas `crm_*`, las funciones `crm_tiene_acceso()` y `crm_es_gerente()`, las políticas del candado, la publicación en tiempo real y el acceso inicial para tres personas | Sí |
| 13 | `migracion-crm-2-datos.sql` (**fuera del repo**) | **Solo datos** del CRM. Ver detalle abajo | Sí |

Sobre la columna "ya corrido en producción". No hay una tabla de control de migraciones en la base,
así que esto no se puede leer del código. Los "Sí" salen de dos fuentes verificables: que la función
correspondiente esté funcionando en producción (las tablas base, los hitos, la bandeja sin fecha, el
CRM), y que el propio archivo SQL documente un pedido con fecha, como
`supabase/migracion-comentarios.sql:75-77`, que explica que la fila global de `FEATURE_COMENTARIOS`
quedó prendida por pedido del Gerente General el 09/09/2026. Todo lo que no tiene ese respaldo va
como **sin confirmar**, aunque la función se vea andando: los pasos 9, 10 y 11 tienen respaldo en la
aplicación (el Kickoff y el orden de proyectos están publicados), pero no hay constancia escrita de
que el SQL se haya pegado.

Para verificar de verdad cuáles corrieron hay que mirar la base: Supabase → Table Editor, o consultar
`information_schema.columns` por las columnas nuevas.

### 9.3 Los dos archivos que traen datos, no estructura

**`supabase/migracion-datos.sql`** (1.372 líneas) es la migración del sistema anterior en Excel.
No crea ni modifica ninguna tabla. Carga:

- **11 perfiles** en `profiles` (las personas del equipo de entonces, más cuatro "personas" que en
  realidad son entidades: Auxiliar de Formación, MEC, Proveedor externo, Equilibrium), reutilizando
  el perfil que ya existía si coincidía el email o el nombre de pila.
- **8 proyectos** en `projects`, también reutilizando el que ya existía con el mismo nombre.
- **759 tareas** en `tasks`, con su checklist, sus responsables traducidos a los ids nuevos, su
  estado y su importancia. Pasa por una tabla temporal (`stage_tareas`) para poder mapear los
  códigos viejos (`PR05`, `P002`) a los uuid nuevos.
- Además **reemplaza** la función `handle_new_user()` por la versión con adopción de perfiles
  descrita en la sección 8.2.

Todo con `on conflict (id) do nothing`, así que correrlo dos veces no duplica nada. Al final
imprime un resumen con la cantidad de proyectos, personas y tareas.

**`migracion-crm-2-datos.sql`** (1.093 líneas) es la carga del CRM que venía de Google Sheets.
**No está en el repo a propósito**: trae teléfonos y correos de contactos de colegios, o sea datos
personales de terceros. Vive en la carpeta `reeduca-crm-migracion/`, que está en `.gitignore`. Según
su propio encabezado carga 141 instituciones, 148 oportunidades, 124 contactos, 492 acciones y 95
registros de bitácora, corrige 39 fechas que venían con el día y el mes invertidos (y deja
constancia de cada corrección en `crm_bitacora`), y usa ids deterministas con
`on conflict do nothing` para poder correrse más de una vez. Desde que se corrió, la planilla de
Sheets quedó solo de consulta.

## 10. El modo demo: la misma app sin base de datos

Si no existe el archivo `.env` con las dos claves de Supabase, `src/lib/supabaseClient.ts:7-8` no
crea el cliente y `src/lib/api.ts:46-47` elige la implementación local en vez de la de Supabase. La
app entera funciona igual, con datos inventados guardados en el navegador. En la barra superior
aparece la pastilla ámbar "Modo demo" (`src/components/TopBar.tsx:94-101`).

Sirve para dos cosas: que alguien pueda probar el sistema sin cuenta, y que se pueda desarrollar sin
riesgo de tocar la base real.

### 10.1 Las tres claves de `localStorage`

| Clave | Qué guarda | Dónde se define |
|---|---|---|
| `reeduca-db-v1` | Todo el sistema menos el CRM, como un único JSON con la forma de `DB` (`src/types.ts:212-227`): las 14 listas | `src/lib/localApi.ts:5` |
| `reeduca-crm-v1` | Todo el CRM, como un único JSON con la forma de `CrmDB` (`src/crm/tipos.ts:110-117`): las 6 listas | `src/crm/crmApi.ts:256` |
| `reeduca-session-v1` | Solo el id de la persona "conectada". En demo no hay contraseñas: se elige un perfil de una lista de botones (`src/views/Login.tsx:57-87`) | `src/lib/localApi.ts:6` |

Si el JSON está corrupto o no existe, se vuelve a sembrar desde cero sin avisar
(`src/lib/localApi.ts:43-57` y `src/crm/crmApi.ts:308-318`).

### 10.2 Qué datos de mentira se siembran

`seedDB()` (`src/lib/seed.ts:41-231`) arma los datos sobre la **semana actual**, para que el
calendario siempre se vea vivo: 5 personas (Álvaro como Gerente, Lucía, Malena, Coty y Pato),
4 proyectos (Académico, Comercial, Administración, Equipo & Cultura), 28 tareas repartidas de lunes
a viernes más la semana siguiente y dos sin fecha, 2 hitos, 3 carpetas, 4 notas (dos compartidas),
2 fijados, 1 minuta con 3 acciones y 2 comentarios con @menciones. Para que el Panel tenga algo que
mostrar, les pone `completedAt` a las tareas completadas y marca dos como "necesita decisión"
(`src/lib/seed.ts:198-211`).

`seedFeatureFlags()` (`src/lib/seed.ts:31-35`) deja `FEATURE_KICKOFF` y `FEATURE_PANEL` prendidas
para el admin de ejemplo, y `FEATURE_COMENTARIOS` prendida para todos.

`seedConsejos()` (`src/lib/seed.ts:6-25`) deja 3 consejos de ejemplo, aunque la pantalla que los
mostraba ya no existe.

`sembrarDemo()` del CRM (`src/crm/crmApi.ts:258-306`) arma 4 instituciones con "(demo)" en el
nombre, 5 oportunidades en etapas distintas, 2 contactos con teléfonos y correos claramente falsos
(`demo.edu.py`), 9 acciones y acceso para tres de los cinco perfiles. La bitácora arranca vacía.

Ningún dato real de contactos de instituciones está en el código que se publica.

### 10.3 Dos diferencias de comportamiento que conviene tener presentes

1. **No hay tiempo real, hay "tiempo real entre pestañas"**. En vez de Supabase Realtime, el modo
   demo escucha el evento `storage` del navegador: si otra pestaña del mismo navegador cambia los
   datos, esta se actualiza sola (`src/state/AppContext.tsx:157-163` y `src/crm/CrmProvider.tsx:62-69`).
2. **Las cascadas y limpiezas están escritas a mano**, porque no hay base que las haga. Por eso
   `src/lib/localApi.ts` borra las tareas del proyecto al borrar un proyecto (`:102-107`), saca a la
   persona de `assigneeIds` al borrarla (`:115-120`), pone `hitoId` en `null` al borrar un hito
   (`:176-181`) y borra los briefings y anotaciones al borrar un kickoff (`:227-233`). En algunos
   casos el demo es **más completo** que Supabase: la limpieza de `assigneeIds` al borrar una
   persona solo existe acá.

`normalize()` (`src/lib/localApi.ts:9-39`) es el equivalente de las migraciones en el modo demo:
cada vez que se lee `reeduca-db-v1`, completa las listas y los campos que las versiones anteriores
de la app no guardaban (`urgent`, `importance`, `sharedWith`, `pins`, `hitos`, `featureFlags`,
`taskComments`, `consejos`, `kickoffs`, `kickoffBriefings`, `kickoffAnotaciones`).

## 11. Avisos: dónde el código y el SQL no dicen exactamente lo mismo

Cosas verificadas al escribir este documento. No son errores que rompan la app hoy, pero conviene
tenerlas anotadas antes de tocar algo cerca.

1. **Borrar una persona deja su id adentro de las tareas.** `deleteUser`
   (`src/lib/supabaseApi.ts:448-450`) borra solo la fila de `profiles`. La limpieza de
   `tasks.assignee_ids` que hace `removeUser` (`src/state/AppContext.tsx:400-407`) se ve en la
   pantalla pero no se guarda; en el modo demo sí se guarda (`src/lib/localApi.ts:115-120`).
2. **`tasks.importance` puede no tener su `check`.** Está en `supabase/schema.sql:49` pero no en
   `supabase/migracion-fase2.sql:11` ni en `supabase/migracion-fase3.sql:11`, que agregan la columna
   sin la restricción. Según cómo se creó la base, el rango 0-5 está garantizado o no lo está.
3. **`task_comments` no tiene política de `update`, pero se guarda con `upsert`**
   (`src/lib/supabaseApi.ts:517`). Crear un comentario funciona; si alguna vez la app intentara
   guardar uno que ya existe, la base lo rechazaría en silencio. Hoy no pasa porque los comentarios
   no se editan.
4. **Volver a correr `supabase/migracion-comentarios.sql` vuelve a prender los comentarios.** La
   línea `:80` usa `on conflict … do update set enabled = true` sobre la fila global, así que
   contradice el comentario de `:76-77`, que dice que para apagarlos hay que poner `enabled = false`
   en el Table Editor. `supabase/migracion-panel-pm.sql:53` hace lo correcto para este caso: usa
   `do nothing`.
5. **Volver a correr `supabase/schema.sql` desharía la adopción de perfiles.** `schema.sql:94-110`
   define `handle_new_user()` con `create or replace`, y `supabase/migracion-datos.sql:16-49` la
   reemplaza por la versión con adopción. Correr el esquema después de los datos volvería, sin
   avisar, a la versión simple.
6. **`CrmContacto` no tiene `createdAt`**, aunque la columna `crm_contactos.created_at` existe
   (`supabase/migracion-crm-1-esquema.sql:95`). El tipo (`src/crm/tipos.ts:65-73`) y el mapeador
   (`src/crm/crmApi.ts:103-120`) la ignoran, así que la completa el valor por defecto y la app nunca
   la ve. Es el único tipo del CRM al que le falta.
