# SRS · Panel del Gerente (Centro de mando)

| | |
|---|---|
| Código de módulo | MOD-PAN |
| Archivos de código | `src/views/Panel.tsx`, `src/components/TareasModal.tsx`, `src/components/ConfiguracionGerente.tsx`, `src/views/Equipo.tsx` (bloque `MiembrosEquipo`), `src/components/TaskEditor.tsx`, `src/state/AppContext.tsx`, `src/components/TopBar.tsx`, `src/App.tsx` |
| Tablas que usa | `tasks` (lee y escribe), `projects`, `profiles`, `hitos`, `minutes`, `task_comments` (solo lee), `feature_flags` (lee la llave) |
| Quién lo ve | **La pestaña Panel: solo Gerentes** (`admin`) con la llave prendida. El interruptor «¿Necesita una decisión del Gerente?» dentro de la ventana de una tarea lo ve **todo el equipo**, sin llave |
| Llave (feature flag) | `FEATURE_PANEL` — controla únicamente la pestaña Panel |

## 1. Para qué sirve

El Panel es el centro de mando del Gerente General: una sola pantalla que contesta, sin
preguntarle a nadie, las cinco cosas que un gerente necesita saber cada mañana. Cuánto
trabajo hay abierto, qué se terminó esta semana, qué está atrasado, **qué está frenado
esperando una decisión suya**, y cómo viene cada proyecto y cada persona.

Lo que lo hace distinto del resto del sistema es la cola de decisiones. Cualquier
integrante del equipo, al cargar o editar una tarea, puede prender un interruptor que dice
«¿Necesita una decisión del Gerente?». Esa tarea se va a la cola del Panel con la fecha
del día en que se marcó, y ahí queda, contando los días que lleva esperando, hasta que el
Gerente la resuelva y alguien destilde el interruptor. Es la forma de que las cosas
frenadas dejen de frenarse por olvido: en vez de perseguir al Gerente por WhatsApp, se
marca la tarea y aparece en su pantalla con el cartel de cuántos días lleva esperando.

Todo el Panel es clicable. Cada número, cada proyecto, cada persona y cada hito abre un
pop-up con las tareas de ese grupo, que se pueden mirar en Kanban o en un calendario
mensual. Al pie del Panel viven también la configuración del Gerente (orden de los
proyectos, acceso al CRM) y la gestión de miembros del equipo.

El Panel es privado: el equipo no ve nada de esto, y el propio Panel lo aclara en la
pantalla — "Solo para tus ojos: el equipo no ve métricas individuales."
(`src/views/Panel.tsx:419`).

## 2. Usuarios y permisos

| Quién | Qué puede hacer | Qué NO puede hacer |
|---|---|---|
| Cualquier integrante (`member` o `admin`) | Marcar y desmarcar cualquier tarea que pueda editar como «necesita una decisión del Gerente» | Ver el Panel, si no es Gerente |
| Gerente (`admin`) **sin** la llave `FEATURE_PANEL` | Ve la pestaña Equipo con el panel viejo | Ver la pestaña Panel |
| Gerente (`admin`) **con** la llave `FEATURE_PANEL` | Ve la pestaña Panel completa: KPIs, salud por proyecto, cola de decisiones, radar de atrasos, carga del equipo, hitos, actividad reciente, configuración y miembros | — |

Reglas de acceso, con su referencia:

- La pestaña solo aparece en el menú si la persona es `admin` **y** tiene la llave
  prendida (`src/components/TopBar.tsx:42`, aplicado en `:72` para la barra de arriba y en
  `:154` para la barra de abajo del celular).
- Aunque alguien llegara a la vista por otro camino, el sistema la bloquea: si no se cumple
  `hasFlag(FEATURE_PANEL) && isAdmin`, la pantalla mostrada es Mi Día
  (`src/App.tsx:47`).
- Cuando la llave está prendida, la pestaña **Equipo desaparece del menú** y sus dos
  bloques (configuración y miembros) pasan a vivir al pie del Panel
  (`src/components/TopBar.tsx:43`, `src/views/Panel.tsx:507` y `:510`).
- El interruptor de «necesita decisión» **no depende de ninguna llave**: está siempre en la
  ventana de la tarea, para todo el equipo (`src/components/TaskEditor.tsx:216`). Lo que sí
  se aplica es el permiso general de edición de tareas: un Gerente siempre puede, y el
  resto solo en tareas donde es responsable o que todavía no tienen responsables
  (`src/lib/utils.ts:32`).
- La llave se lee de la tabla `feature_flags`, donde una fila con el id de la persona gana
  sobre la fila global (`src/state/AppContext.tsx:290`). Cualquiera puede **leer** las
  llaves; solo un `admin` puede **escribirlas** (`supabase/migracion-panel-pm.sql:28` y
  `:31`).

## 3. Datos que usa

### Columnas que agrega la migración del Panel a `tasks`

`supabase/migracion-panel-pm.sql:14` a `:16`. Las tres son aditivas: nada de lo que ya
existía se toca, y la migración se puede correr más de una vez.

| Campo | Qué significa | De dónde sale |
|---|---|---|
| `completed_at` / `completedAt` | Fecha y hora en que la tarea pasó a completada | La estampa la app sola, al detectar que el estado pasó a `done` (`src/state/AppContext.tsx:93`) |
| `necesita_decision_gg` / `necesitaDecisionGg` | La tarea está frenada esperando una decisión del Gerente | Interruptor de la ventana de la tarea (`src/components/TaskEditor.tsx:220`) |
| `necesita_decision_desde` / `necesitaDecisionDesde` | Desde cuándo espera esa decisión | La estampa la app sola al prender el interruptor, y la borra al apagarlo (`src/state/AppContext.tsx:98`) |

### Tabla `feature_flags`

`supabase/migracion-panel-pm.sql:19`. Interface `FeatureFlag` en `src/types.ts:201`.

| Campo | Qué significa | De dónde sale |
|---|---|---|
| `flag` | Nombre de la llave, acá siempre `'FEATURE_PANEL'` | La migración, o el bloque de miembros para otras llaves |
| `user_id` | A quién aplica. **Nulo = valor global**, para todo el equipo | La migración la siembra por email |
| `enabled` | Prendida o apagada | Table Editor de Supabase, o los botones del bloque de miembros |

Hay una restricción de unicidad por `(flag, user_id)` tratando el nulo como un valor más
(`supabase/migracion-panel-pm.sql:24`), así que no puede haber dos filas para la misma
persona y la misma llave.

### Campos de otras tablas que el Panel lee

| Campo | Qué significa | Para qué lo usa el Panel |
|---|---|---|
| `tasks.status`, `date`, `assignee_ids`, `project_id`, `hito_id`, `title` | Los datos de siempre de la tarea | KPIs, salud por proyecto, radar, carga, pop-ups |
| `projects.name`, `color` | Nombre y color del proyecto | Salud por proyecto, puntos de color, hitos |
| `profiles.name`, `color`, `avatar_url` | Cómo se dibuja cada persona | Carga del equipo, fotos en la cola de decisiones |
| `hitos.name`, `date`, `project_id` | Metas grandes con fecha | Próximo hito de cada proyecto, "Hitos en el horizonte" |
| `minutes.title`, `date`, `participant_ids` | Minutas de reuniones | Actividad reciente |
| `task_comments.text`, `created_at`, `user_id`, `task_id` | Comentarios en tareas | KPI de comentarios de 7 días y actividad reciente |

## 4. Requisitos funcionales

| ID | Requisito | Detalle / regla | Dónde vive |
|---|---|---|---|
| RF-PAN-01 | El sistema debe mostrar la pestaña Panel solo a Gerentes con la llave `FEATURE_PANEL` prendida | Si la llave se apaga, la pestaña desaparece del menú y la vista cae a Mi Día | `src/components/TopBar.tsx:42`, `src/App.tsx:47` |
| RF-PAN-02 | Cuando la llave está prendida, el sistema debe ocultar la pestaña Equipo y mostrar sus bloques al pie del Panel | El Panel reemplaza a Equipo; nada se pierde | `src/components/TopBar.tsx:43`, `src/views/Panel.tsx:507`, `:510` |
| RF-PAN-03 | El Panel debe encabezarse con el título "Centro de mando", la fecha de hoy escrita completa y la aclaración de que abarca a todo el equipo y todos los proyectos | Además explica que todo es clicable | `src/views/Panel.tsx:157` |
| RF-PAN-04 | El Panel debe tener un botón "Actualizar" que vuelva a traer todos los datos de la base | El ícono gira durante 800 milisegundos | `src/views/Panel.tsx:140`, `:167` |
| RF-PAN-05 | El Panel debe mostrar cinco indicadores grandes, todos clicables, que al tocarlos abren el pop-up con esas mismas tareas | Dos columnas en celular, tres en tablet, cinco en pantalla grande | `src/views/Panel.tsx:176`, `:529` |
| RF-PAN-06 | Indicador "Tareas activas": cuántas tareas de todo el equipo no están completadas | Sin importar fecha ni proyecto | `src/views/Panel.tsx:45`, `:177` |
| RF-PAN-07 | Indicador "Completadas esta semana": cuántas se terminaron entre el domingo y el sábado de esta semana | Se calcula con `completed_at`; las tareas completadas antes de correr la migración no tienen esa fecha y no cuentan | `src/views/Panel.tsx:47`, `:182` |
| RF-PAN-08 | Indicador "Atrasadas": cuántas tareas tienen fecha vencida y no están completadas | — | `src/views/Panel.tsx:46`, `:194` |
| RF-PAN-09 | Indicador "Decisiones que me necesitan", destacado con borde azul: cuántas tareas están frenadas esperando la decisión del Gerente | Es el indicador más importante del Panel y por eso se dibuja distinto | `src/views/Panel.tsx:200`, `:547` |
| RF-PAN-10 | Indicador "Comentarios · 7 días": cuántos comentarios se escribieron en tareas en la última semana | Al tocarlo, el pop-up muestra las **tareas** comentadas, no los comentarios | `src/views/Panel.tsx:58`, `:213` |
| RF-PAN-11 | El Panel debe mostrar la salud de cada proyecto: barra de avance, porcentaje, cuántas atrasadas tiene, cuál es su próximo hito con fecha y un semáforo de color | Cada fila abre el pop-up con las tareas de ese proyecto y un botón para cargar una tarea nueva ahí | `src/views/Panel.tsx:63`, `:226` |
| RF-PAN-12 | El Panel debe mostrar la cola de decisiones: las tareas marcadas, de la que más espera a la que menos, con las fotos de sus responsables, el proyecto y una etiqueta con los días de espera | Tocar una abre la ventana de la tarea para resolverla | `src/views/Panel.tsx:283`, `:302` |
| RF-PAN-13 | El sistema debe permitir a cualquier integrante marcar y desmarcar una tarea como «necesita una decisión del Gerente» desde la ventana de la tarea | No requiere ninguna llave ni ser Gerente. Al prenderlo, un texto explica que entra a la cola del Panel y que al destildarlo sale | `src/components/TaskEditor.tsx:217`, `:237` |
| RF-PAN-14 | Al marcar una tarea, el sistema debe estampar solo la fecha y hora de ese momento; al desmarcarla, debe borrarla | Centralizado para que valga por cualquier camino: editor, tilde rápido, arrastre del Kanban | `src/state/AppContext.tsx:98` |
| RF-PAN-15 | Una tarea completada debe salir de la cola de decisiones aunque siga marcada | El filtro exige `status !== 'done'` | `src/views/Panel.tsx:54` |
| RF-PAN-16 | El Panel debe mostrar un "Radar de atrasos" con las seis tareas atrasadas de fecha más vieja, con los días de retraso | Etiqueta roja plena a partir de 5 días, ámbar antes | `src/views/Panel.tsx:79`, `:334` |
| RF-PAN-17 | El Panel debe mostrar la carga del equipo de esta semana: una barra por persona partida en completado, en progreso y por hacer, con el total y sus atrasadas | Cada persona abre el pop-up con las tareas donde es responsable | `src/views/Panel.tsx:84`, `:373` |
| RF-PAN-18 | El Panel debe mostrar una línea de tiempo con los hitos de los próximos 45 días | Hasta ocho hitos, con el color de su proyecto; cada uno abre las tareas de ese hito. **No se muestra en celular** | `src/views/Panel.tsx:106`, `:425` |
| RF-PAN-19 | El Panel debe mostrar las últimas ocho novedades del equipo: comentarios, tareas completadas y minutas | Con el "hace tanto" escrito en español | `src/views/Panel.tsx:121`, `:467` |
| RF-PAN-20 | El pop-up de tareas debe ofrecer vista Kanban y vista Calendario, y un interruptor para ocultar las completadas | El pop-up se actualiza solo si alguien cambia una tarea mientras está abierto | `src/components/TareasModal.tsx:290`, `:337` |
| RF-PAN-21 | El calendario del pop-up debe abrirse en el mes que conviene: el actual, o el del grupo de tareas más cercano a hoy si este mes no tiene ninguna | Se puede navegar mes a mes y volver a "Hoy"; tocar un día lista sus tareas debajo | `src/components/TareasModal.tsx:106`, `:150`, `:254` |
| RF-PAN-22 | El Panel debe incluir al pie la configuración del Gerente: orden de los proyectos y acceso al CRM | Ver `docs/04-srs/09-proyectos.md` (orden) y el SRS del CRM (acceso) | `src/views/Panel.tsx:507`, `src/components/ConfiguracionGerente.tsx:65` |
| RF-PAN-23 | El Panel debe incluir al pie la gestión de miembros del equipo | Ver `docs/04-srs/11-equipo.md` | `src/views/Panel.tsx:510`, `src/views/Equipo.tsx:201` |
| RF-PAN-24 | El sistema debe abrir la ventana de la tarea al tocar cualquier fila de la cola de decisiones o del radar de atrasos | — | `src/views/Panel.tsx:308`, `:354` |
| RF-PAN-25 | Si la base todavía no corrió la migración del Panel, el sistema debe guardar las tareas sin las tres columnas nuevas en lugar de fallar | Degrada al comportamiento anterior: el Panel queda sin fechas de completado ni cola de decisiones | `src/lib/supabaseApi.ts:405`, `:414` |
| RF-PAN-26 | El Panel debe aclarar en pantalla que los datos históricos anteriores a la migración no tienen fecha | Texto al pie de "Actividad reciente" | `src/views/Panel.tsx:501` |

## 5. Reglas de negocio y cálculos

- **RN-PAN-01 · Qué es "esta semana".** De domingo a sábado. Se calcula con
  `weekDays(new Date())`, que arranca la semana en domingo (`src/lib/utils.ts:13`,
  `src/views/Panel.tsx:41`). `semana[0]` es el domingo y `semana[6]` el sábado.
- **RN-PAN-02 · Completadas esta semana.** La tarea tiene `completedAt` y sus primeros 10
  caracteres (la parte de la fecha) caen entre `semana[0]` y `semana[6]`, comparando como
  texto (`src/views/Panel.tsx:48`).
- **RN-PAN-03 · Tarea atrasada.** No completada, con fecha, y esa fecha anterior a hoy
  (`src/lib/utils.ts:25`).
- **RN-PAN-04 · Cola de decisiones.** Entran las tareas con `necesitaDecisionGg` prendido y
  estado distinto de `done`. Se ordenan por `necesitaDecisionDesde` de la más vieja a la
  más nueva; las que no tienen esa fecha se toman como `'9999'` y van al final
  (`src/views/Panel.tsx:51`).
- **RN-PAN-05 · Días de espera de una decisión.** Diferencia en días de calendario entre
  hoy y `necesitaDecisionDesde`, con piso en cero:
  `Math.max(0, differenceInCalendarDays(hoy, necesitaDecisionDesde))`
  (`src/views/Panel.tsx:146`). Si no hay fecha, no se muestra etiqueta.
- **RN-PAN-06 · Colores de la espera.** 4 días o más: fondo rojo claro con texto rojo. 2 o
  3 días: fondo ámbar. 0 o 1 día: fondo gris. Con cero días la etiqueta dice "hoy"; con uno
  o más, "hace N días" (`src/views/Panel.tsx:316`).
- **RN-PAN-07 · Semáforo de un proyecto.** Rojo con 3 o más tareas atrasadas, ámbar con 1 o
  2, verde sin ninguna (`src/views/Panel.tsx:73`). La leyenda está escrita en la propia
  pantalla: "🔴 3+ atrasadas · 🟡 1–2 · 🟢 al día" (`src/views/Panel.tsx:279`).
- **RN-PAN-08 · Avance de un proyecto.** `completadas / totales × 100`, redondeado
  (`src/views/Panel.tsx:257`). Con cero tareas, cero por ciento.
- **RN-PAN-09 · Próximo hito de un proyecto.** De los hitos del proyecto que tienen fecha de
  hoy en adelante, el de fecha más cercana (`src/views/Panel.tsx:69`).
- **RN-PAN-10 · Comentarios de los últimos 7 días.** Se calcula un corte en hoy menos 7
  días y entran los comentarios cuya fecha es **estrictamente posterior** a ese corte
  (`src/views/Panel.tsx:58`).
- **RN-PAN-11 · Radar de atrasos.** Las tareas atrasadas ordenadas por fecha de la más
  vieja a la más nueva, y se muestran las primeras seis (`src/views/Panel.tsx:79`). Los días
  de retraso son la diferencia de días de calendario entre hoy y la fecha de la tarea; la
  etiqueta pasa a rojo pleno a partir de 5 días (`src/views/Panel.tsx:349`, `:359`).
- **RN-PAN-12 · Carga del equipo.** Por persona: de sus tareas asignadas se toman las que
  tienen fecha dentro de esta semana y se parten en completadas, en progreso y por hacer.
  Las atrasadas se cuentan aparte y **sin límite de fecha**. Se muestran solo las personas
  con al menos una tarea en la semana o al menos una atrasada, ordenadas de más a menos
  tareas en la semana. El largo de la barra es relativo a la persona más cargada
  (`src/views/Panel.tsx:84` a `:103`).
- **RN-PAN-13 · Hitos en el horizonte.** Horizonte fijo de 45 días
  (`src/views/Panel.tsx:105`). Entran los hitos con fecha entre hoy y hoy más 45 días,
  ordenados por fecha, los primeros ocho. La posición horizontal es
  `días hasta el hito / 45 × 100`, recortada entre 6 % y 94 % para que la etiqueta no se
  corte en los bordes (`src/views/Panel.tsx:115`). Se alternan arriba y abajo de la línea
  según el índice sea par o impar (`src/views/Panel.tsx:451`).
- **RN-PAN-14 · Actividad reciente.** Se juntan tres tipos de evento y se ordenan por fecha
  de la más nueva a la más vieja, mostrando los ocho primeros
  (`src/views/Panel.tsx:121`, `:137`):
  - comentario: usa `createdAt` y recorta el texto a 60 caracteres con puntos suspensivos;
  - completada: usa `completedAt` y nombra al **primer responsable** de la tarea;
  - minuta: usa la fecha de la minuta a las 12:00 en punto y nombra al primer participante.
- **RN-PAN-15 · Estampas automáticas de la tarea.** Al guardar cualquier tarea, el sistema
  compara con su versión anterior (`src/state/AppContext.tsx:91`):
  - si pasó a `done` y no tenía `completedAt`, le pone la fecha y hora de ahora;
  - si salió de `done`, le borra `completedAt`;
  - si se prendió `necesitaDecisionGg` y no tenía fecha, le pone `necesitaDecisionDesde`;
  - si se apagó, le borra `necesitaDecisionDesde`.
- **RN-PAN-16 · Cómo se resuelve una llave.** Se busca una fila de esa llave con el id de la
  persona; si existe, manda su valor. Si no existe, manda la fila global (`user_id` nulo).
  Si no hay ninguna de las dos, la llave está apagada (`src/state/AppContext.tsx:290`).
- **RN-PAN-17 · Mes inicial del calendario del pop-up.** Si el grupo no tiene tareas con
  fecha, o si tiene alguna en el mes actual, se abre en el mes actual. Si no, se abre en el
  mes de la tarea cuya fecha está más cerca de hoy (`src/components/TareasModal.tsx:106`).
- **RN-PAN-18 · Cuántas tareas muestra cada día del calendario.** En pantalla grande, hasta
  tres tareas con su título sobre el color del proyecto, y si hay más, un "+N más". En
  celular, hasta seis puntitos de color, con las completadas más apagadas
  (`src/components/TareasModal.tsx:212`, `:224`, `:244`).

## 6. Pantalla y comportamiento

El Panel es una sola página con desplazamiento vertical, de hasta 1152 px de ancho. De
arriba hacia abajo:

1. **Encabezado.** Título "Centro de mando" con su ícono, la fecha de hoy escrita completa
   en español, la aclaración "todo el equipo, todos los proyectos" y, a la derecha, el
   botón "Actualizar".
2. **Fila de cinco indicadores.** El de decisiones se distingue con borde azul de dos
   píxeles; los demás tienen borde gris fino. Todos se levantan al pasar el mouse y su
   ayuda dice "Ver estas tareas en Kanban o calendario"
   (`src/views/Panel.tsx:546`).
3. **Salud por proyecto** (a la izquierda, más ancha) **y cola de decisiones** (a la
   derecha, con borde azul). En celular se apilan.
4. **Radar de atrasos y carga del equipo**, dos bloques del mismo ancho.
5. **Hitos en el horizonte**, una línea de tiempo horizontal con "HOY" en el extremo
   izquierdo. Este bloque está oculto en celular a propósito: el comentario del código
   remite a la pestaña Hitos (`src/views/Panel.tsx:424`).
6. **Actividad reciente**, en dos columnas en pantalla grande.
7. **Configuración · Orden de los proyectos** y **Configuración · Acceso al CRM**.
8. **Miembros del equipo.**

Cada bloque tiene su microtexto explicativo, pensado para que el Gerente no tenga que
preguntar qué significa cada número: "avance · atrasadas · próximo hito"
(`src/views/Panel.tsx:229`), "Lo que el equipo marcó esperando tu palabra"
(`src/views/Panel.tsx:290`), "Las que más días llevan vencidas, de todo el equipo"
(`src/views/Panel.tsx:341`).

Estados vacíos, uno por bloque:

- Sin proyectos: "Todavía no hay proyectos." (`src/views/Panel.tsx:275`).
- Cola vacía: "Nada esperando tu decisión. 🎉" más la aclaración de que se marcan desde la
  tarea (`src/views/Panel.tsx:296`).
- Sin atrasos: "Sin tareas atrasadas. 🎉" (`src/views/Panel.tsx:346`).
- Sin tareas esta semana: "Sin tareas agendadas esta semana." (`src/views/Panel.tsx:384`).
- Sin hitos próximos: "No hay hitos con fecha en los próximos 45 días."
  (`src/views/Panel.tsx:428`).
- Sin novedades: "Todavía no hay actividad para mostrar." (`src/views/Panel.tsx:474`).
- Pop-up sin tareas: "No hay tareas acá." (`src/components/TareasModal.tsx:358`).

Estado de carga: el único es el ícono giratorio del botón "Actualizar", que gira 800
milisegundos fijos y **no espera** a que la recarga termine de verdad
(`src/views/Panel.tsx:140`). La carga inicial la maneja la pantalla general
(`src/App.tsx:52`).

Estado de error: el Panel no tiene cartel de error propio. Si la recarga falla, el error
queda en la consola del navegador (`src/state/AppContext.tsx:299`).

## 7. Casos límite y errores

- **No se corrió `supabase/migracion-panel-pm.sql`.** Las tres columnas nuevas no existen;
  al guardar una tarea el sistema reintenta sin ellas (`src/lib/supabaseApi.ts:405`). El
  Panel se ve, pero "Completadas esta semana" queda en cero para siempre y la cola de
  decisiones nunca se llena. Tampoco existe la fila de la llave, así que nadie ve la
  pestaña.
- **Tareas completadas antes de la migración.** No tienen `completedAt`, así que no cuentan
  en el indicador de la semana ni aparecen en la actividad reciente. El Panel lo aclara en
  pantalla (`src/views/Panel.tsx:501`).
- **Una tarea marcada y completada.** Sale de la cola (RN-PAN-15) pero el campo
  `necesitaDecisionGg` queda prendido. Si alguien la vuelve a abrir, reaparece en la cola
  con la fecha de espera original.
- **Una tarea marcada y luego borrada.** Desaparece de la cola sin dejar registro. No hay
  historial de decisiones tomadas.
- **Marcada y desmarcada varias veces.** Cada vez que se prende, la fecha se vuelve a
  estampar desde cero: el contador de días arranca de nuevo. No se acumula la espera
  anterior.
- **Dos personas editan la misma tarea a la vez.** Gana el último que guarda. Si una prende
  el interruptor y la otra guarda una versión vieja de la tarea, la marca se pierde sin
  aviso.
- **Nadie tiene la tarea asignada.** En la cola de decisiones no se dibuja ninguna foto, y
  en la actividad reciente una tarea completada sin responsables se atribuye a "Alguien"
  (`src/views/Panel.tsx:131`).
- **Una persona que ya no está en el equipo.** Si su id quedó en `assignee_ids`, su nombre
  no se encuentra y la actividad reciente dice "Alguien"; en la carga del equipo
  simplemente no aparece, porque la lista se arma recorriendo las personas existentes.
- **Todos los hitos están más allá de 45 días.** La línea de tiempo muestra su estado
  vacío. No hay forma de cambiar el horizonte: los 45 días están fijos en el código.
- **Más de ocho hitos dentro del horizonte.** Se muestran los ocho más cercanos; los
  demás no aparecen y nada lo avisa.
- **Muchos hitos en fechas parecidas.** Las etiquetas de 120 px se superponen entre sí: el
  recorte de la posición (RN-PAN-13) evita que se corten en los bordes, pero no evita que
  choquen entre ellas.
- **Falla la base al recargar.** El botón deja de girar igual a los 800 ms y los datos
  siguen siendo los viejos; el error solo queda en la consola.
- **La llave se apaga mientras el Gerente está mirando el Panel.** Como la llave llega por
  tiempo real, la pantalla cambia sola a Mi Día (`src/App.tsx:47`).

## 8. Criterios de aceptación

1. **CA-PAN-01** · Entrar con una cuenta de Equipo. Se espera: la pestaña Panel no existe
   en el menú, ni arriba ni en la barra de abajo del celular.
2. **CA-PAN-02** · Entrar con una cuenta de Gerente que tenga la llave apagada. Se espera:
   no ve Panel, pero sí ve la pestaña Equipo.
3. **CA-PAN-03** · Prender la llave `FEATURE_PANEL` para ese Gerente (fila con su id,
   `enabled = true`). Se espera: aparece la pestaña Panel y **desaparece** la pestaña
   Equipo; los bloques de configuración y de miembros aparecen al pie del Panel.
4. **CA-PAN-04** · Con una cuenta de Equipo, abrir una tarea propia y prender
   «¿Necesita una decisión del Gerente?». Se espera: el interruptor se pone azul, dice
   "Esperando decisión del Gerente" y debajo aparece el aviso de que entra a la cola del
   Panel. **No hace falta ninguna llave ni ser Gerente.**
5. **CA-PAN-05** · Entrar como Gerente y mirar el Panel. Se espera: el indicador
   "Decisiones que me necesitan" subió en uno, y la tarea aparece en la cola con la
   etiqueta "hoy".
6. **CA-PAN-06** · Cambiar a mano en la base la fecha `necesita_decision_desde` de esa
   tarea a hace 5 días y recargar. Se espera: la etiqueta dice "hace 5 días" y está en rojo.
7. **CA-PAN-07** · Volver a la tarea y apagar el interruptor. Se espera: sale de la cola al
   instante y el indicador baja en uno.
8. **CA-PAN-08** · Marcar una tarea como "necesita decisión" y después completarla. Se
   espera: sale de la cola aunque siga marcada.
9. **CA-PAN-09** · Tocar el número de "Tareas activas". Se espera: se abre un pop-up con
   todas las tareas no completadas, con pestañas Kanban y Calendario y un interruptor para
   ocultar las completadas.
10. **CA-PAN-10** · En ese pop-up, tocar "Calendario". Se espera: un calendario mensual; los
    días con tareas muestran los títulos con el color de su proyecto; tocar un día lista sus
    tareas debajo; las tareas sin fecha aparecen en un bloque aparte al final.
11. **CA-PAN-11** · Completar una tarea desde el pop-up sin cerrarlo. Se espera: la tarea se
    mueve a la columna Completado y los contadores del pop-up se actualizan solos.
12. **CA-PAN-12** · Dejar tres tareas de un mismo proyecto con fecha vencida. Se espera: en
    "Salud por proyecto" ese proyecto muestra "3 atrasadas" y su semáforo está en rojo. Con
    una o dos, ámbar. Con ninguna, dice "al día" y el semáforo es verde.
13. **CA-PAN-13** · Tocar la fila de un proyecto en "Salud por proyecto". Se espera: se abre
    el pop-up con las tareas de ese proyecto y un botón "+ Nueva tarea" que ya trae ese
    proyecto elegido.
14. **CA-PAN-14** · Tocar el nombre de una persona en "Carga del equipo". Se espera: se abre
    el pop-up titulado con su nombre y el subtítulo "Tareas donde es responsable".
15. **CA-PAN-15** · Completar dos tareas hoy. Se espera: "Completadas esta semana" sube en
    dos, y las dos aparecen arriba en "Actividad reciente" con el "hace un rato".
16. **CA-PAN-16** · Escribir un comentario en una tarea. Se espera: "Comentarios · 7 días"
    sube en uno y el comentario aparece en "Actividad reciente", recortado si es largo.
17. **CA-PAN-17** · Crear un hito con fecha dentro de los próximos 45 días. Se espera:
    aparece en la línea de tiempo con el color de su proyecto, y al tocarlo se abre el
    pop-up con las tareas de ese hito.
18. **CA-PAN-18** · Abrir el Panel en un celular. Se espera: todo se ve apilado en una
    columna y el bloque "Hitos en el horizonte" **no aparece**.
19. **CA-PAN-19** · Tocar "Actualizar". Se espera: el ícono gira alrededor de un segundo y
    los números quedan al día con lo que haya en la base.

## 9. Limitaciones conocidas y pendientes

1. **Media explicación del SQL quedó vieja.** El bloque 3 de la migración ya aclara que el
   interruptor de la tarea no depende de la llave
   (`supabase/migracion-panel-pm.sql:39`), pero el bloque 4 sigue diciendo que hay que
   prender la fila global "para que el equipo pueda marcar tareas como necesita decisión"
   (`supabase/migracion-panel-pm.sql:49`). Eso ya no hace falta: el interruptor está
   siempre disponible para todo el equipo (`src/components/TaskEditor.tsx:216`). El SQL no
   está roto, pero esa frase confunde.
2. **Prender la fila global de la llave tiene un efecto lateral.** Hoy la fila global viene
   apagada (`supabase/migracion-panel-pm.sql:52`). Si se prende, todos los Gerentes ganan
   la pestaña Panel y **pierden** la pestaña Equipo del menú, porque Equipo se oculta con
   esa misma llave (`src/components/TopBar.tsx:43`).
3. **La llave se siembra con un correo escrito a mano** en la migración
   (`supabase/migracion-panel-pm.sql:44`). Para otra persona hay que editar el SQL o tocar
   la tabla a mano.
4. **La cola de decisiones no se resuelve desde el Panel.** Hay que abrir la tarea y apagar
   el interruptor. No hay un botón "resuelto" ni un lugar donde anotar qué se decidió.
5. **No queda historial de decisiones.** Al destildar, la fecha de espera se borra
   (RN-PAN-15): no se puede saber después cuánto tardó una decisión ni cuántas hubo.
6. **El Panel no tiene filtros.** Ni por proyecto, ni por persona, ni por rango de fechas:
   siempre muestra todo el equipo y la semana actual.
7. **Quién completó una tarea no se guarda.** En "Actividad reciente" se nombra al primer
   responsable de la tarea (`src/views/Panel.tsx:131`), que puede no ser quien la completó.
8. **Las minutas se ordenan como si fueran a las 12:00** (`src/views/Panel.tsx:135`), así
   que dentro de un mismo día su lugar frente a los comentarios y las completadas es
   arbitrario.
9. **Los umbrales están fijos en el código**: el semáforo (3 y 1 atrasadas), los colores de
   la espera (4 y 2 días), el radar (5 días y 6 tareas), el horizonte (45 días y 8 hitos),
   la actividad (8 eventos). Nada de eso se configura desde la interfaz.
10. **La carga del equipo mira solo las tareas con fecha de esta semana** (RN-PAN-12): una
    persona con veinte tareas sin fecha aparece como si no tuviera carga.
11. **El giro del botón "Actualizar" es decorativo**: dura 800 ms fijos y no refleja si la
    recarga terminó ni si falló (`src/views/Panel.tsx:140`).
12. **Los errores de guardado y de recarga no se le muestran al Gerente**: quedan en la
    consola del navegador.
13. **La línea de tiempo de hitos puede superponer etiquetas** cuando hay varios hitos en
    fechas cercanas.
