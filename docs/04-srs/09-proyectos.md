# SRS · Proyectos

| | |
|---|---|
| Código de módulo | MOD-PRO |
| Archivos de código | `src/views/Proyectos.tsx`, `src/components/TareasModal.tsx`, `src/components/ConfiguracionGerente.tsx`, `src/state/AppContext.tsx`, `src/lib/supabaseApi.ts`, `src/lib/utils.ts` |
| Tablas que usa | `projects` (lee y escribe), `tasks` e `hitos` (solo lee; se borran en cascada), `profiles` (solo lee) |
| Quién lo ve | Todo el equipo ve la pestaña y puede abrir el detalle. Crear, editar, eliminar y reordenar proyectos: solo Gerentes (`admin`) |
| Llave (feature flag) | Ninguna |

## 1. Para qué sirve

Los proyectos son las cajas grandes donde entra todo el trabajo de ReEduca: Académico,
Comercial, Administración, Equipo & Cultura. Cada tarea del sistema pertenece
obligatoriamente a un proyecto y toma su color, así que el proyecto es lo que da el color
a la agenda, al Kanban y al calendario. Sin proyectos no se puede cargar ni una tarea.

La pestaña Proyectos cumple dos funciones. La primera es de tablero: una grilla de
tarjetas, una por proyecto, con su color, su descripción y una barra que muestra cuánto
está completado. De un vistazo se ve si un proyecto va o no va. La segunda función es de
zoom: al tocar una tarjeta se abre un pop-up con todo lo de ese proyecto, en tres formas
distintas de mirarlo — Resumen (números, avance por hito, carga por persona, próximas
entregas), Agenda (las tareas agrupadas por día) y Kanban (por hacer / en progreso /
completado).

Además hay un detalle que parece chico y no lo es: **el orden de los proyectos es
configurable por el Gerente**. Ese orden es el que todo el equipo ve cuando carga una
tarea y tiene que elegir el proyecto, y el primero de la lista es el que sale elegido por
defecto. Poniendo adelante el proyecto donde más se trabaja, se ahorra un clic en cada
tarea que carga cada persona todos los días.

## 2. Usuarios y permisos

| Quién | Qué puede hacer | Qué NO puede hacer |
|---|---|---|
| Miembro (`member`) | Ver todas las tarjetas, abrir el pop-up de detalle en sus tres vistas, abrir cualquier tarea del proyecto, crear una tarea nueva dentro del proyecto | Crear, editar ni eliminar proyectos: los botones de lápiz, tacho y "+ Nuevo proyecto" no se le dibujan (`src/views/Proyectos.tsx:53`, `:93`) |
| Gerente (`admin`) | Todo lo anterior, más crear, editar y eliminar proyectos, y configurar el orden en que se muestran | — |

Reglas de edición:

- Los botones de administración se muestran solo si `isAdmin` es verdadero
  (`src/views/Proyectos.tsx:53` para lápiz y tacho, `:93` para "Nuevo proyecto").
- El reordenamiento no vive en esta pestaña: vive en el bloque "Configuración · Orden de
  los proyectos" (`src/components/ConfiguracionGerente.tsx:22`), que se dibuja al pie del
  Panel del Gerente y de la pestaña Equipo. Las dos pantallas son exclusivas de Gerentes.
- Dentro del pop-up de detalle, tildar una tarea como completada respeta la regla general
  del sistema: la puede tildar un Gerente, o quien esté entre sus responsables, o
  cualquiera si la tarea todavía no tiene responsables (`src/lib/utils.ts:32`, aplicada en
  `src/components/TareasModal.tsx:29`).
- En la base de datos, `projects` no distingue roles: cualquier persona con sesión puede
  escribir (`supabase/schema.sql:129`). El permiso de Gerente es una regla de la
  interfaz, no un candado de base de datos.

## 3. Datos que usa

### Tabla `projects` (interface `Project`, `src/types.ts:12`)

| Campo | Qué significa | De dónde sale |
|---|---|---|
| `id` | Identificador del proyecto | `uid()` al crearlo (`src/views/Proyectos.tsx:368`) |
| `name` | Nombre visible, por ejemplo "Académico" | Campo "Nombre" del pop-up; se guarda sin espacios sobrantes |
| `color` | Color identificativo del proyecto y de todas sus tareas | Se elige de una paleta cerrada de 25 colores (`src/lib/utils.ts:49`) |
| `description` | Una línea o dos explicando de qué se trata. Opcional | Campo "Descripción (opcional)"; si queda vacío se guarda como nulo |
| `position` | Orden configurado por el Gerente. Cero en todos = orden alfabético | Flechas subir/bajar de Configuración (`src/components/ConfiguracionGerente.tsx:12`) |

La columna `position` no está en el esquema original: la agrega
`supabase/migracion-orden-proyectos.sql:13`, con
`alter table public.projects add column if not exists position integer not null default 0`.
Es aditiva e idempotente: se puede correr más de una vez y no modifica nada de lo que ya
existe.

### Campos de otras tablas que este módulo lee

| Campo | Qué significa | De dónde sale |
|---|---|---|
| `tasks.project_id` | A qué proyecto pertenece cada tarea | Editor de tareas |
| `tasks.status` | `todo` / `doing` / `done`; alimenta todos los contadores y barras | Editor de tareas y el tilde rápido |
| `tasks.date` | Fecha de la tarea; `null` = "sin fecha" | Editor de tareas |
| `tasks.hito_id` | Hito al que aporta la tarea; alimenta "Avance por hito" | Editor de tareas |
| `tasks.assignee_ids` | Responsables; alimenta "Carga por persona" | Editor de tareas |
| `hitos.name`, `hitos.date` | Nombre y fecha objetivo de cada hito del proyecto | Pestaña Hitos |
| `profiles.name`, `color`, `avatar_url` | Para dibujar las personas en "Carga por persona" | Pestaña Equipo |

## 4. Requisitos funcionales

| ID | Requisito | Detalle / regla | Dónde vive |
|---|---|---|---|
| RF-PRO-01 | El sistema debe mostrar una tarjeta por proyecto, en el orden configurado | Grilla de una columna en celular, dos en tablet y tres en pantalla grande | `src/views/Proyectos.tsx:39` |
| RF-PRO-02 | Cada tarjeta debe mostrar una banda del color del proyecto, su nombre, su descripción si tiene, cuántas tareas tiene, cuántas están completadas y una barra de avance | La barra se pinta con el color del proyecto | `src/views/Proyectos.tsx:49`, `:79`, `:82` |
| RF-PRO-03 | El sistema debe permitir a un Gerente crear un proyecto nuevo | Nombre obligatorio, color de la paleta, descripción opcional. El botón Guardar queda apagado si falta el nombre | `src/views/Proyectos.tsx:94`, `:377`, `:411` |
| RF-PRO-04 | El sistema debe permitir a un Gerente editar el nombre, el color y la descripción de un proyecto existente | El pop-up abre con los valores actuales | `src/views/Proyectos.tsx:57`, `:359` |
| RF-PRO-05 | El sistema debe permitir a un Gerente eliminar un proyecto, avisando antes cuántas tareas se van a eliminar con él | Texto: «¿Eliminar el proyecto "X"? Se eliminarán también sus N tareas.» Si el proyecto no tiene tareas, la segunda frase no aparece | `src/views/Proyectos.tsx:23` |
| RF-PRO-06 | El sistema debe ofrecer el color del proyecto como una paleta visual de botones, no como un código escrito a mano | 25 colores: 20 pastel más los 5 oficiales de la marca ReEduca | `src/views/Proyectos.tsx:383`, `src/lib/utils.ts:49` |
| RF-PRO-07 | El sistema debe abrir el pop-up de detalle del proyecto al tocar la tarjeta, para cualquier integrante del equipo | Los botones de lápiz y tacho no abren el detalle: detienen la propagación del clic | `src/views/Proyectos.tsx:46`, `:56` |
| RF-PRO-08 | El pop-up de detalle debe ofrecer tres vistas conmutables: Resumen, Agenda y Kanban | Arranca siempre en Resumen | `src/views/Proyectos.tsx:133`, `:190` |
| RF-PRO-09 | La vista Resumen debe mostrar cinco números: Tareas, Completadas, En progreso, Atrasadas y Sin fecha | Cada uno con su color: gris, verde, celeste, rojo y gris azulado | `src/views/Proyectos.tsx:233` |
| RF-PRO-10 | La vista Resumen debe mostrar una barra de avance general con el porcentaje escrito | Porcentaje redondeado, sin decimales | `src/views/Proyectos.tsx:250` |
| RF-PRO-11 | La vista Resumen debe mostrar el avance de cada hito del proyecto, con completadas sobre total y porcentaje | El bloque entero no se dibuja si el proyecto no tiene hitos | `src/views/Proyectos.tsx:260` |
| RF-PRO-12 | La vista Resumen debe mostrar la carga por persona: una barra por integrante con sus tareas completadas, en progreso y por hacer | Solo aparecen las personas que tienen al menos una tarea en el proyecto | `src/views/Proyectos.tsx:148`, `:286` |
| RF-PRO-13 | La vista Resumen debe listar las próximas cinco entregas del proyecto | Tareas no completadas, con fecha de hoy en adelante | `src/views/Proyectos.tsx:166`, `:314` |
| RF-PRO-14 | La vista Agenda debe agrupar las tareas por día, con las que no tienen fecha primero bajo el rótulo "Sin fecha" | Cada grupo muestra el día escrito completo en español y su cantidad | `src/views/Proyectos.tsx:170`, `:330` |
| RF-PRO-15 | La vista Kanban debe mostrar tres columnas — Por hacer, En progreso, Completado — con el contador de cada una | Una columna sin tareas dice "Vacío" | `src/views/Proyectos.tsx:352`, `src/components/TareasModal.tsx:62`, `:93` |
| RF-PRO-16 | El sistema debe permitir crear una tarea nueva desde el pop-up, ya con ese proyecto precargado | La tarea nace además con la fecha de hoy | `src/views/Proyectos.tsx:217`, `src/App.tsx:91` |
| RF-PRO-17 | El sistema debe abrir el editor de la tarea al tocar cualquier fila de tarea del pop-up | Vale en las tres vistas | `src/views/Proyectos.tsx:321`, `:344`, `src/components/TareasModal.tsx:40` |
| RF-PRO-18 | El sistema debe permitir tildar una tarea como completada, o destildarla, desde la fila, sin abrir el editor | El tilde queda deshabilitado para quien no tenga permiso, con el aviso "Solo sus responsables o un Gerente" | `src/components/TareasModal.tsx:32` |
| RF-PRO-19 | El sistema debe permitir a un Gerente subir y bajar proyectos para fijar el orden en que los ve todo el equipo | Flechas de a un lugar; la de subir se apaga en el primero y la de bajar en el último | `src/components/ConfiguracionGerente.tsx:12`, `:42`, `:50` |
| RF-PRO-20 | El orden configurado debe regir en toda la aplicación, no solo en esta pestaña | El contexto entrega los proyectos ya ordenados a todas las pantallas | `src/state/AppContext.tsx:263`, `:274` |
| RF-PRO-21 | El primer proyecto del orden debe salir elegido por defecto al cargar una tarea nueva | `projects[0]` es el valor inicial del editor de tareas | `src/components/TaskEditor.tsx:28` |
| RF-PRO-22 | Un proyecto nuevo debe quedar al final del orden configurado | Si todavía nadie ordenó nada, nace en cero y la lista sigue saliendo alfabética | `src/views/Proyectos.tsx:366` |
| RF-PRO-23 | Si la base de datos todavía no tiene la columna `position`, el sistema debe guardar el proyecto sin ese campo en lugar de fallar | Reintento automático; se pierde solo el orden, no el proyecto | `src/lib/supabaseApi.ts:428` |
| RF-PRO-24 | El pop-up debe avisar cuando el proyecto no tiene ninguna tarea | Texto: "Este proyecto todavía no tiene tareas." y no se dibuja ninguna de las tres vistas | `src/views/Proyectos.tsx:225` |

## 5. Reglas de negocio y cálculos

- **RN-PRO-01 · Orden de los proyectos.** Primero por `position` de menor a mayor; si dos
  empatan, alfabético por nombre con las reglas del español:
  `(a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name, 'es')`
  (`src/state/AppContext.tsx:263`). Como la columna nace en cero para todos, mientras
  nadie ordene nada la lista sale alfabética.
- **RN-PRO-02 · Avance de un proyecto.** `completadas / total × 100`, redondeado sin
  decimales. Si el proyecto no tiene tareas, el avance es 0 y la barra queda vacía
  (`src/views/Proyectos.tsx:146`, `:85`).
- **RN-PRO-03 · Tarea atrasada.** No está completada, tiene fecha, y esa fecha es anterior
  a hoy: `status !== 'done' && !!date && date < hoy` (`src/lib/utils.ts:25`). Una tarea sin
  fecha nunca está atrasada.
- **RN-PRO-04 · Tarea "sin fecha".** `date` en nulo. Estas tareas viven en la bandeja y,
  en la vista Agenda del pop-up, se muestran primero.
- **RN-PRO-05 · Orden de las tareas dentro del pop-up.** Por fecha ascendente, tomando las
  sin fecha como `'0000'` para que vayan al principio, y a igual fecha por `position`:
  `(a.date ?? '0000').localeCompare(b.date ?? '0000') || a.position - b.position`
  (`src/views/Proyectos.tsx:139`).
- **RN-PRO-06 · Agrupación de la vista Agenda.** Se agrupa por la fecha de la tarea, con la
  clave `'backlog'` para las sin fecha; los grupos se ordenan poniendo `backlog` primero y
  el resto cronológicamente (`src/views/Proyectos.tsx:170`).
- **RN-PRO-07 · Carga por persona.** Para cada integrante se cuentan las tareas del
  proyecto donde figura como responsable, separadas en completadas, en progreso y por
  hacer. Se descartan las personas con cero tareas y se ordena de mayor a menor cantidad.
  El largo de la barra es relativo a la persona más cargada:
  `total / maxCarga × 100` (`src/views/Proyectos.tsx:148`, `:165`, `:299`).
- **RN-PRO-08 · Próximas entregas.** Tareas del proyecto que no estén completadas, con
  fecha de hoy o posterior, las primeras cinco del orden de RN-PRO-05
  (`src/views/Proyectos.tsx:166`).
- **RN-PRO-09 · Avance por hito.** Por cada hito del proyecto se toman las tareas cuyo
  `hitoId` es ese hito y se calcula `completadas / vinculadas × 100`, redondeado. Un hito
  sin tareas vinculadas queda en 0 % (`src/views/Proyectos.tsx:264`).
- **RN-PRO-10 · Guardado del reordenamiento.** Se recorre la lista nueva y se guardan
  **solo** los proyectos cuya posición cambió, asignando el índice de la lista (0, 1, 2…).
  Si nada cambió, no se escribe nada en la base (`src/state/AppContext.tsx:368`).
- **RN-PRO-11 · Posición de un proyecto nuevo.** Si ya hay algún proyecto con posición
  mayor a cero — es decir, si el Gerente ya ordenó — el nuevo va a `máximo + 1`. Si todos
  están en cero, el nuevo también queda en cero y la lista sigue siendo alfabética
  (`src/views/Proyectos.tsx:366`).
- **RN-PRO-12 · Eliminar un proyecto arrastra sus tareas y sus hitos.** En la pantalla se
  saca el proyecto y se filtran sus tareas e hitos (`src/state/AppContext.tsx:385`). En la
  base de datos lo hace la propia base, por las reglas en cascada de
  `tasks.project_id` e `hitos.project_id` (`supabase/schema.sql:36` y `:27`).
- **RN-PRO-13 · Quién puede tildar una tarea.** Un Gerente siempre; el resto solo si está
  entre los responsables, o si la tarea todavía no tiene ninguno (`src/lib/utils.ts:32`).

## 6. Pantalla y comportamiento

**Pestaña Proyectos.** Ancho máximo de 1024 px, centrada. Arriba el título "Proyectos" y
la bajada "Cada tarea pertenece a un proyecto y toma su color en el calendario."
(`src/views/Proyectos.tsx:33`). Abajo la grilla de tarjetas: una columna en celular, dos
desde 640 px y tres desde 1024 px. Cada tarjeta se levanta un poco al pasar el mouse. Para
un Gerente, al final de la grilla aparece un recuadro punteado "+ Nuevo proyecto".

**Pop-up de detalle.** Ocupa hasta 1024 px de ancho. Arriba, una banda del color del
proyecto que cruza todo el pop-up (`src/views/Proyectos.tsx:184`). Debajo, a la izquierda,
el conteo "N tareas · M completadas"; a la derecha, el conmutador de tres pestañas y el
botón azul "+ Nueva tarea". El contenido cambia según la pestaña:

- **Resumen**: los cinco números en una fila (dos columnas en celular, cinco en pantalla
  grande), la barra de avance general, el avance por hito, la carga por persona y las
  próximas entregas. Los bloques que no tienen datos simplemente no se dibujan.
- **Agenda**: bloques por día, con el nombre del día escrito completo en español, y las
  tareas listadas una debajo de la otra.
- **Kanban**: tres columnas grises con las tarjetas dentro. En celular las tres columnas
  se apilan una sobre otra (`src/components/TareasModal.tsx:80`).

**Bloque "Configuración · Orden de los proyectos"** (solo Gerentes, al pie del Panel y de
Equipo). Lista numerada de los proyectos, cada uno con su cuadradito de color, su nombre y
dos flechas. Arriba explica: "Es el orden en que todo el equipo ve los proyectos en la
lista al cargar una tarea. El primero sale elegido por defecto."
(`src/components/ConfiguracionGerente.tsx:29`).

Estados vacíos y de error:

- Sin ningún proyecto: la grilla queda con solo el botón "+ Nuevo proyecto" para un
  Gerente, y completamente vacía para el resto del equipo. En el bloque de Configuración
  dice "Todavía no hay proyectos." (`src/components/ConfiguracionGerente.tsx:60`).
- Proyecto sin tareas: "Este proyecto todavía no tiene tareas."
  (`src/views/Proyectos.tsx:225`).
- Columna del Kanban sin tareas: "Vacío" (`src/components/TareasModal.tsx:93`).
- Este módulo no tiene estado de carga propio ni cartel de error propio: si un guardado
  falla, el error queda en la consola del navegador y la pantalla muestra el cambio como
  si se hubiera guardado (`src/state/AppContext.tsx:83`, `:363`).

## 7. Casos límite y errores

- **No hay ningún proyecto.** La app sigue funcionando, pero no se puede cargar ninguna
  tarea con proyecto: el editor arranca con el proyecto vacío
  (`src/components/TaskEditor.tsx:28`) y el selector muestra su propio aviso
  (`src/components/Selectores.tsx:93`).
- **Proyecto con un solo proyecto en el sistema.** Las dos flechas de Configuración quedan
  apagadas, porque es a la vez el primero y el último.
- **Se elimina un proyecto con tareas.** Se van todas sus tareas y todos sus hitos, en la
  pantalla y en la base. No hay papelera ni forma de deshacerlo. La confirmación dice
  cuántas tareas se van, justamente por eso.
- **Dos Gerentes reordenan al mismo tiempo.** Gana el último que guarda. Como se guardan
  solo los proyectos que cambiaron (RN-PRO-10), puede quedar un orden mezclado de las dos
  intenciones: por ejemplo, dos proyectos con la misma posición, que entonces se ordenan
  alfabéticamente entre ellos.
- **Falta la columna `position` en la base.** El guardado se reintenta sin ella y el
  proyecto se guarda igual (`src/lib/supabaseApi.ts:428`). Mientras la columna no exista,
  el orden configurado no se puede persistir y todo sale alfabético. Solución: correr
  `supabase/migracion-orden-proyectos.sql`.
- **Falla la base al guardar un proyecto.** El error queda en la consola y la tarjeta
  aparece igual en la pantalla; al recargar se ve la verdad.
- **Dos proyectos con el mismo nombre.** El sistema lo permite: no hay validación de
  nombres repetidos. Se van a ver dos tarjetas iguales, distinguibles solo por el color.
- **Un proyecto con muchísimas tareas.** No hay paginación: el pop-up dibuja todas. En la
  vista Agenda eso puede ser una lista muy larga de bloques por día.
- **Tarea con varios responsables.** Cuenta una vez para cada persona en "Carga por
  persona", así que la suma de las barras puede ser mayor al total de tareas del proyecto.

## 8. Criterios de aceptación

1. **CA-PRO-01** · Entrar a Proyectos con una cuenta de Equipo (no Gerente). Se espera:
   se ven las tarjetas de todos los proyectos, y **no** aparecen ni el lápiz, ni el tacho,
   ni el botón "+ Nuevo proyecto".
2. **CA-PRO-02** · Entrar con una cuenta de Gerente. Se espera: aparecen el lápiz y el
   tacho en cada tarjeta, y el recuadro punteado "+ Nuevo proyecto" al final.
3. **CA-PRO-03** · Como Gerente, crear un proyecto "Prueba" con un color de la paleta y
   una descripción. Se espera: aparece una tarjeta nueva con ese color y esa descripción,
   con "0 tareas · 0 completadas".
4. **CA-PRO-04** · Cargar tres tareas en "Prueba" y completar una. Volver a Proyectos. Se
   espera: la tarjeta dice "3 tareas · 1 completada" y la barra está llena hasta un tercio.
5. **CA-PRO-05** · Tocar la tarjeta de "Prueba". Se espera: se abre el pop-up con la banda
   del color arriba, en la vista Resumen, y los cinco números dicen 3 / 1 / 0 / 0 / 0
   (según las fechas que se hayan puesto).
6. **CA-PRO-06** · En el pop-up, tocar "Agenda". Se espera: las tareas aparecen agrupadas
   por día, con el nombre del día escrito completo. Si alguna tarea no tiene fecha, su
   grupo "Sin fecha" está arriba de todo.
7. **CA-PRO-07** · Tocar "Kanban". Se espera: tres columnas — Por hacer, En progreso,
   Completado — con los contadores correctos, y la columna vacía diciendo "Vacío".
8. **CA-PRO-08** · Desde el pop-up, tocar "+ Nueva tarea". Se espera: se abre el editor de
   tareas con el proyecto "Prueba" ya elegido y la fecha de hoy puesta.
9. **CA-PRO-09** · Tocar el tilde verde de una tarea en la lista del pop-up. Se espera: la
   tarea queda tachada y pasa a la columna Completado; los contadores y la barra de avance
   se actualizan sin cerrar el pop-up.
10. **CA-PRO-10** · Con una cuenta de Equipo, abrir el pop-up de un proyecto y buscar una
    tarea de otra persona en la que no figura como responsable. Se espera: el tilde está
    apagado, y al pasar el mouse dice "Solo sus responsables o un Gerente".
11. **CA-PRO-11** · Crear un hito en el proyecto (pestaña Hitos), vincularle dos tareas y
    completar una. Abrir el Resumen del proyecto. Se espera: el bloque "Avance por hito"
    muestra ese hito con "1/2 · 50%".
12. **CA-PRO-12** · Asignar tareas del proyecto a dos personas distintas y abrir el
    Resumen. Se espera: "Carga por persona" muestra las dos, la más cargada primero, con
    la barra más larga.
13. **CA-PRO-13** · Como Gerente, ir al Panel (o a Equipo), bajar hasta "Configuración ·
    Orden de los proyectos" y subir "Prueba" hasta el primer lugar. Se espera: la lista
    numerada lo muestra como 1.
14. **CA-PRO-14** · Recargar la página, volver a Proyectos y después abrir el editor de
    una tarea nueva. Se espera: "Prueba" aparece primero en la grilla de tarjetas, primero
    en la lista de proyectos del editor, y sale **elegido por defecto**.
15. **CA-PRO-15** · Entrar con una cuenta de Equipo y abrir el editor de una tarea nueva.
    Se espera: ve exactamente el mismo orden que configuró el Gerente.
16. **CA-PRO-16** · Como Gerente, eliminar "Prueba". Se espera: la confirmación dice
    cuántas tareas se van a eliminar; al aceptar, desaparecen el proyecto y sus tareas de
    todas las pantallas.

## 9. Limitaciones conocidas y pendientes

1. **El orden se configura con flechas, de a un lugar por clic**: no hay arrastrar y
   soltar, ni forma de mover un proyecto varios lugares de una vez.
2. **El reordenamiento no está en la pestaña Proyectos.** Vive al pie del Panel del
   Gerente y de la pestaña Equipo (`src/components/ConfiguracionGerente.tsx:65` lo dibuja
   junto al bloque de acceso al CRM). Para el Gerente General es el lugar menos obvio para
   buscarlo.
3. **El Kanban del pop-up no se puede arrastrar.** Las tres columnas son de lectura: el
   único cambio de estado posible desde ahí es el tilde, que alterna entre "por hacer" y
   "completado" (`src/components/TareasModal.tsx:34`). Para pasar una tarea a "En progreso"
   hay que abrirla.
4. **No hay archivado de proyectos.** La única forma de sacar un proyecto de la vista es
   eliminarlo, y eso se lleva todas sus tareas e hitos. Un proyecto terminado queda para
   siempre en la grilla.
5. **No hay buscador ni filtros en la grilla de proyectos.** Con muchos proyectos la
   pantalla se hace larga.
6. **Nombres repetidos permitidos**: no hay validación de unicidad.
7. **El permiso de Gerente sobre proyectos es solo de interfaz**: la política RLS de
   `projects` deja escribir a cualquier usuario con sesión (`supabase/schema.sql:129`).
   No es un problema de uso diario, pero conviene saberlo.
8. **En modo demo los proyectos de ejemplo no traen `position`** (`src/lib/seed.ts:54`),
   así que arrancan todos empatados y salen alfabéticos hasta que alguien los ordene.
9. **El color se elige de una paleta cerrada de 25**: no hay color libre ni selector de
   tonos.
10. **No hay fechas de inicio ni de fin de proyecto, ni responsable de proyecto, ni
    presupuesto**: el proyecto es apenas un nombre, un color, una descripción y un lugar en
    el orden.
