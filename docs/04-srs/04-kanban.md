# SRS · Kanban (tablero por estado)

| | |
|---|---|
| Código de módulo | MOD-KAN |
| Archivos de código | `src/views/Kanban.tsx`, `src/components/MultiFilter.tsx`, `src/components/Stars.tsx`, `src/components/Comments.tsx`, `src/components/Avatar.tsx`, `src/lib/utils.ts`, `src/lib/usePref.ts` |
| Tablas que usa | `tasks` (lectura y escritura), `projects`, `profiles`, `task_comments` (solo la pastilla del contador) |
| Quién lo ve | Todo el equipo |
| Llave (feature flag) | Ninguna. La pastilla de comentarios en la tarjeta depende de `FEATURE_COMENTARIOS` |

## 1. Para qué sirve

El Kanban es el tablero de estados: tres columnas, **Por hacer**, **En progreso** y **Completado**, y
las tareas se mueven de columna arrastrándolas. Mientras la Agenda contesta "¿cuándo?", el Kanban
contesta "¿en qué está cada cosa?". Es la pantalla de las reuniones de seguimiento: se pone un filtro
por persona o por proyecto y se ve, sin buscar, qué arrancó, qué está trabado y qué se terminó.

Arriba de las columnas hay un **semáforo de carga por semana**: seis pastillas, la semana actual y las
cinco siguientes, cada una con un punto verde, naranja o rojo según cuántas tareas pendientes tenga
esa semana. Sirve para ver de un vistazo si la semana que viene está sobrecargada antes de seguir
cargando tareas ahí. Además, cada pastilla funciona como filtro: al tocarla, el tablero muestra solo
las tareas de esa semana.

Los filtros son cuatro y se combinan: proyectos (varios a la vez), personas (varias a la vez), semana
y una lista de fechas ("Atrasadas", "Pasadas", "Futuras", "Sin fecha"). Más los dos ojitos para
esconder las completadas y las tareas sin fecha, que se recuerdan en ese navegador.

## 2. Usuarios y permisos

Entra cualquier persona con sesión y ve las tareas de todo el equipo.

| Acción | Quién puede |
|---|---|
| Ver el tablero, el semáforo y usar todos los filtros | Cualquiera con sesión |
| Abrir la ventana de cualquier tarea | Cualquiera. Si no la puede editar, se abre en solo lectura (ver `01-tareas.md`) |
| Arrastrar una tarjeta a otra columna (cambiar el estado) | Solo quien puede editar esa tarea: sus responsables, o un Gerente, o cualquiera si la tarea no tiene responsables. Si no, la tarjeta **no se levanta** (`src/views/Kanban.tsx:202`) |

La regla de edición es `canEditTask` (`src/lib/utils.ts:32-36`). Ver RN-TAR-01 en `01-tareas.md`.

En el Kanban **no se pueden crear tareas**: no hay botón "+" en las columnas. Para crear se usa el
botón "Nueva" de la barra de arriba del sistema (`src/components/TopBar.tsx:102-107`), la Agenda o
Proyectos.

## 3. Datos que usa

| Dato | De dónde sale | Para qué |
|---|---|---|
| `tasks.status` | `src/types.ts:44` | En qué columna va la tarea. **Es lo único que el Kanban escribe** |
| `tasks.date` | `src/types.ts:39` | Filtro de semana, filtro de fechas, ojito "Sin fecha", orden de las tarjetas y el texto de fecha de la tarjeta |
| `tasks.projectId` | `src/types.ts:36` | Filtro de proyectos, color del borde izquierdo y nombre en la tarjeta |
| `tasks.assigneeIds` | `src/types.ts:43` | Filtro de personas y avatares de la tarjeta |
| `tasks.position` | `src/types.ts:45` | Desempate del orden dentro de la columna. El Kanban **no lo modifica** |
| `tasks.urgent`, `tasks.importance`, `tasks.startTime`, `tasks.title` | `src/types.ts:34-49` | Contenido de la tarjeta |
| `task_comments` | `src/types.ts:186-192` | Solo la pastilla "💬 N", y solo con `FEATURE_COMENTARIOS` prendida (`src/components/Comments.tsx:16-29`) |
| `projects` (nombre y color) | `src/types.ts:12-18` | Opciones del filtro y aspecto de la tarjeta |
| `profiles` (`users`) | `src/types.ts:3-10` | Opciones del filtro de personas y avatares |

**Preferencias guardadas en el navegador**, no en la base (`src/lib/usePref.ts:4-15`):

| Llave en el navegador | Qué recuerda | Valor inicial |
|---|---|---|
| `reeduca-pref-kanban-ocultar-completadas` | Ojito "Completadas" | Mostrar (`src/views/Kanban.tsx:49`) |
| `reeduca-pref-kanban-ocultar-sinfecha` | Ojito "Sin fecha" | Mostrar (`src/views/Kanban.tsx:50`) |

Los filtros de proyectos, personas, semana y fechas **no** se recuerdan: arrancan vacíos cada vez que
se entra a la pantalla (`src/views/Kanban.tsx:45-48`).

## 4. Requisitos funcionales

| ID | Requisito | Detalle / regla | Dónde vive |
|---|---|---|---|
| RF-KAN-01 | El sistema debe mostrar tres columnas fijas: "Por hacer", "En progreso" y "Completado" | Cada una con su punto de color: gris, celeste y verde | `src/views/Kanban.tsx:29-33` |
| RF-KAN-02 | Cada columna debe mostrar cuántas tarjetas tiene | El contador cuenta las tarjetas **después** de aplicar todos los filtros | `src/views/Kanban.tsx:198`, `:251` |
| RF-KAN-03 | El sistema debe permitir arrastrar una tarjeta a otra columna para cambiarle el estado | Solo cambia el estado: la fecha, la posición y todo lo demás quedan igual | `src/views/Kanban.tsx:105-114` |
| RF-KAN-04 | El sistema debe estampar la fecha de completado al mover una tarjeta a "Completado", y borrarla al sacarla de ahí | No es lógica de esta pantalla: la aplica el guardado central. Ver RN-TAR-02 en `01-tareas.md` | `src/state/AppContext.tsx:91-97` |
| RF-KAN-05 | El sistema no debe permitir arrastrar las tareas que la persona no puede editar | La tarjeta no reacciona al arrastre, pero se puede abrir con un toque | `src/views/Kanban.tsx:202`, `:260-281` |
| RF-KAN-06 | El sistema debe distinguir un toque de un arrastre | En computadora hay que mover 6 píxeles; en celular hay que mantener apretado 250 milisegundos con tolerancia de 8 píxeles | `src/views/Kanban.tsx:99-102` |
| RF-KAN-07 | El sistema debe marcar con un anillo celeste la columna sobre la que se va a soltar la tarjeta | El anillo rodea la columna entera | `src/views/Kanban.tsx:245-247` |
| RF-KAN-08 | El sistema debe mostrar la tarjeta inclinada siguiendo el puntero mientras se arrastra, y dejar la original tenue | La original queda al 30 % de opacidad | `src/views/Kanban.tsx:215-225`, `:276` |
| RF-KAN-09 | El sistema debe descartar el movimiento si la tarjeta se suelta fuera de una columna, o si el arrastre se cancela | Nada se guarda y la tarjeta vuelve a su lugar | `src/views/Kanban.tsx:108`, `:190` |
| RF-KAN-10 | El sistema debe explicar en pantalla cómo se usa el tablero | "· Arrastrá una tarjeta a otra columna para cambiar su estado". En celular este texto no se muestra | `src/views/Kanban.tsx:120-122` |
| RF-KAN-11 | El sistema debe permitir filtrar por varios proyectos a la vez | Sin nada elegido, muestra todos | `src/views/Kanban.tsx:124-129`, `src/components/MultiFilter.tsx:40-119` |
| RF-KAN-12 | El sistema debe permitir filtrar por varias personas a la vez | Una tarea pasa si **alguno** de sus responsables está elegido | `src/views/Kanban.tsx:89`, `:145-150` |
| RF-KAN-13 | El sistema debe permitir filtrar por una semana, de una lista que va de la semana pasada hasta seis semanas adelante | Ocho opciones más "Todas las semanas". Cada una dice "Semana 40 · 28 sep – 4 oct" | `src/views/Kanban.tsx:57`, `:130-137`, `src/lib/utils.ts:109-124` |
| RF-KAN-14 | El sistema debe permitir filtrar por situación de la fecha | Cuatro opciones: "🔥 Atrasadas", "⏪ Pasadas", "⏩ Futuras (desde hoy)" y "📥 Sin fecha", más "Todas las fechas". Ver RN-KAN-02 | `src/views/Kanban.tsx:71-84`, `:138-144` |
| RF-KAN-15 | El sistema debe combinar todos los filtros entre sí | Las condiciones se cumplen todas a la vez. Ver RN-KAN-01 | `src/views/Kanban.tsx:85-94` |
| RF-KAN-16 | El sistema debe permitir esconder las tareas completadas, y recordarlo en ese navegador | Ojito "Completadas" | `src/views/Kanban.tsx:49`, `:151`, `src/components/MultiFilter.tsx:7-30` |
| RF-KAN-17 | Al esconder las completadas, el sistema debe además **quitar la columna "Completado"** y repartir el ancho entre las dos que quedan | Con la columna fuera, no hay dónde soltar para completar una tarea desde el tablero | `src/views/Kanban.tsx:193-197` |
| RF-KAN-18 | El sistema debe permitir esconder las tareas sin fecha, y recordarlo | Ojito "Sin fecha" | `src/views/Kanban.tsx:50`, `:92`, `:152` |
| RF-KAN-19 | El sistema debe mostrar un semáforo con la carga de la semana actual y las cinco siguientes | Seis pastillas con el rótulo "Carga próximas semanas" | `src/views/Kanban.tsx:59-65`, `:157-182` |
| RF-KAN-20 | Cada pastilla del semáforo debe mostrar un punto de color, el número de semana y la cantidad de tareas pendientes | Ver RN-KAN-04 para los colores y RN-KAN-03 para el conteo | `src/views/Kanban.tsx:161-181` |
| RF-KAN-21 | La pastilla de la semana en curso debe estar marcada con la palabra "HOY" | En azul, al lado del número de semana | `src/views/Kanban.tsx:66`, `:176` |
| RF-KAN-22 | Cada pastilla del semáforo debe explicar en su globo de ayuda la semana, la cantidad y el nivel de carga | Por ejemplo: "Semana 40 · 28 sep – 4 oct — 7 tareas pendientes (Carga media)" | `src/views/Kanban.tsx:167` |
| RF-KAN-23 | Tocar una pastilla del semáforo debe filtrar el tablero por esa semana; tocarla de nuevo debe quitar el filtro | La pastilla activa queda azul, igual que el selector de semana de arriba | `src/views/Kanban.tsx:162`, `:166`, `:168-172` |
| RF-KAN-24 | Cada tarjeta debe mostrar el título, la fecha en palabras (o "📥 Sin fecha"), la hora de inicio si la tiene y el nombre del proyecto | Formato de fecha: "lun 29 sep". El título va tachado si la tarea está completada | `src/views/Kanban.tsx:303-310` |
| RF-KAN-25 | Cada tarjeta debe mostrar las pastillas de urgente, atrasada, importancia y comentarios, y los avatares de los responsables | La de urgente no se muestra si la tarea ya está completada | `src/views/Kanban.tsx:311-322` |
| RF-KAN-26 | La tarjeta debe llevar el color del proyecto en una franja a la izquierda, y un anillo rojo si es urgente y no está completada | Sin proyecto, la franja es gris | `src/views/Kanban.tsx:296-301` |
| RF-KAN-27 | Tocar una tarjeta debe abrir la ventana de la tarea | La misma ventana de todo el sistema | `src/views/Kanban.tsx:207`, `src/App.tsx:81` |
| RF-KAN-28 | El sistema debe ordenar las tarjetas de cada columna por fecha y después por posición | Ver RN-KAN-05 | `src/views/Kanban.tsx:95` |
| RF-KAN-29 | El sistema debe reflejar los cambios de otras personas sin recargar la página | Llega por tiempo real de la base | `src/state/AppContext.tsx:224-258` |

## 5. Reglas de negocio y cálculos

- **RN-KAN-01 · Qué tareas pasan los filtros** (`src/views/Kanban.tsx:85-94`). Todas estas
  condiciones se cumplen a la vez: 1) sin proyectos elegidos pasa cualquiera, si hay elegidos el
  proyecto de la tarea tiene que estar entre ellos; 2) sin personas elegidas pasa cualquiera, si hay
  elegidas al menos un responsable tiene que estar entre ellas; 3) si hay una semana elegida, la fecha
  de la tarea tiene que caer entre el domingo y el sábado de esa semana (`taskInWeek`,
  `src/lib/utils.ts:126`) — **una tarea sin fecha nunca pasa un filtro de semana**; 4) si el ojito
  "Completadas" está escondiéndolas, la tarea no puede estar en estado "done"; 5) si el ojito "Sin
  fecha" está escondiéndolas, la tarea tiene que tener fecha; 6) tiene que cumplir el filtro de fechas
  (RN-KAN-02).
- **RN-KAN-02 · Filtro de situación de la fecha** (`src/views/Kanban.tsx:71-84`):
  - **Atrasadas**: usa `isOverdue` (`src/lib/utils.ts:25`): no completada, con fecha, y la fecha es
    anterior a hoy.
  - **Pasadas**: tiene fecha y la fecha es anterior a hoy, **sin importar el estado** (incluye las
    completadas).
  - **Futuras (desde hoy)**: tiene fecha y la fecha es hoy o posterior.
  - **Sin fecha**: no tiene fecha.
  - Sin nada elegido pasan todas.
- **RN-KAN-03 · Cómo se cuenta la carga de una semana** (`src/views/Kanban.tsx:62`): se cuentan todas
  las tareas del equipo que **no** están completadas y cuya fecha cae dentro de esa semana (domingo a
  sábado). Importante: este conteo usa **todas** las tareas, **no** las filtradas: poner un filtro de
  proyecto o de persona no cambia los números del semáforo.
- **RN-KAN-04 · Colores del semáforo** (`weekLoadColor`, `src/lib/utils.ts:134-138`):
  | Tareas pendientes en la semana | Color | Etiqueta |
  |---|---|---|
  | 11 o más | Rojo `#e5484d` | Carga alta |
  | Entre 3 y 10 | Naranja `#F0A62B` | Carga media |
  | 0, 1 o 2 | Verde `#34C48E` | Carga liviana |
- **RN-KAN-05 · Orden dentro de una columna** (`src/views/Kanban.tsx:95`): primero por fecha, de la
  más vieja a la más nueva, y las **sin fecha al final** (internamente se comparan con `'9999-99'`);
  a igual fecha, por el campo `position`, que es el orden que se arrastró en la Agenda.
- **RN-KAN-06 · Qué semanas se ofrecen en el selector** (`src/views/Kanban.tsx:57`): ocho semanas
  arrancando una semana antes de hoy, o sea la anterior, la actual y las seis siguientes. Se calcula
  una sola vez al abrir la pantalla: si alguien deja el tablero abierto varios días, la lista queda
  vieja.
- **RN-KAN-07 · Cómo se numeran las semanas** (`weekInfo`, `src/lib/utils.ts:109-120`): la semana va
  de domingo a sábado y el número lo calcula la librería de fechas contando desde el domingo. La
  etiqueta corta es "S40" y la larga "Semana 40 · 28 sep – 4 oct".
- **RN-KAN-08 · Cómo se decide sobre qué columna se suelta** (`src/views/Kanban.tsx:35-38`): primero
  se busca la columna que está exactamente debajo del puntero o el dedo; si no hay ninguna, la que más
  se superpone con la tarjeta.
- **RN-KAN-09 · Cuándo se guarda al soltar** (`src/views/Kanban.tsx:111-113`): solo si la zona donde
  se soltó es una de las tres columnas válidas **y** el estado es distinto al que ya tenía. Soltar una
  tarjeta en su propia columna no genera ningún guardado.

## 6. Pantalla y comportamiento

**Barra de arriba** (`src/views/Kanban.tsx:118-154`): a la izquierda el título "Tablero" y la
aclaración de arrastrar (que se esconde en celular); pegado a la derecha, en este orden, el filtro
"Proyectos", el selector de semana, el selector de fechas, el filtro "Personas" y los ojitos
"Completadas" y "Sin fecha". En pantallas angostas la barra se parte en varias líneas.

**Semáforo** (`src/views/Kanban.tsx:157-182`): una fila de pastillas redondeadas debajo de la barra,
con el rótulo "Carga próximas semanas" a la izquierda.

**Columnas** (`src/views/Kanban.tsx:192-214`): recuadros gris claro con el encabezado arriba (punto de
color, nombre y contador) y las tarjetas debajo. En computadora las columnas van una al lado de la
otra y ocupan todo el alto disponible; **en celular van una debajo de la otra** y cada una tiene un
alto mínimo chico, así que hay que desplazarse para llegar a "Completado". El ancho mínimo del tablero
en computadora es de 760 píxeles, o 520 si la columna "Completado" está escondida (`:193-195`).

**Estados vacíos.** Una columna sin tarjetas muestra solo su encabezado con el contador en 0; no hay
mensaje explicativo. Si los filtros no dejan pasar ninguna tarea, las tres columnas quedan vacías sin
ningún aviso de que hay filtros puestos, más allá del color azul de los botones de filtro.

**Carga.** No hay pantalla de carga propia: mientras la aplicación trae los datos se ve el girador
general "Cargando…" (`src/App.tsx:52-61`).

**Error.** Si la base falla al cargar, el tablero se dibuja con las tres columnas vacías y el semáforo
todo en verde, sin ningún aviso (`src/state/AppContext.tsx:212-215`). Si falla al guardar un cambio de
estado, la tarjeta queda en la columna nueva en pantalla pero en la base sigue en la vieja; el error
solo va a la consola del navegador (`src/state/AppContext.tsx:83`).

## 7. Casos límite y errores

- **Dos personas mueven la misma tarjeta al mismo tiempo.** Gana la última en soltar; a la primera el
  tiempo real le mueve la tarjeta sin avisarle.
- **El ojito "Completadas" está escondiendo tareas.** La columna "Completado" desaparece del tablero
  (RF-KAN-17), así que desde el Kanban no hay forma de completar una tarea arrastrándola: hay que
  volver a mostrar las completadas, o abrir la ventana de la tarea, o tildarla desde Mi Día.
- **Filtro de semana con tareas sin fecha.** Ninguna tarea sin fecha pasa un filtro de semana
  (RN-KAN-01), así que al elegir una semana la bandeja de tareas sin fecha desaparece del tablero
  aunque el ojito "Sin fecha" esté prendido.
- **Semáforo y filtros no coinciden.** Una pastilla puede decir "7" mientras la columna muestra 2
  tarjetas, porque el semáforo cuenta todas las tareas del equipo y las columnas respetan los filtros
  (RN-KAN-03). No hay nada en pantalla que lo aclare.
- **El tablero quedó abierto de un día para el otro.** La lista de semanas del selector no se
  recalcula (RN-KAN-06) y "HOY" puede quedar señalando la semana equivocada. Se arregla recargando la
  página.
- **Semana con 0 tareas.** La pastilla sale verde con "Carga liviana", igual que una con 2 tareas: el
  semáforo no distingue "vacía" de "liviana" (RN-KAN-04).
- **Se suelta la tarjeta fuera de las columnas.** No pasa nada (`src/views/Kanban.tsx:108`).
- **Tarea sin proyecto asignado.** La franja izquierda de la tarjeta sale gris y no se muestra nombre
  de proyecto (`src/views/Kanban.tsx:301`, `:309`). En la práctica no debería pasar: el proyecto es
  obligatorio para guardar una tarea (RF-TAR-03).
- **Una tarea completada pero con fecha vieja.** Con el filtro "Pasadas" aparece; con "Atrasadas" no,
  porque las completadas no cuentan como atrasadas (RN-KAN-02).
- **El navegador tiene bloqueado el almacenamiento local.** Los dos ojitos funcionan durante la sesión
  pero no se recuerdan al recargar (`src/lib/usePref.ts:6-9`).

## 8. Criterios de aceptación

1. **CA-KAN-01** — Abrir el Kanban. Resultado: se ven tres columnas, "Por hacer", "En progreso" y
   "Completado", cada una con su punto de color y su contador.
2. **CA-KAN-02** — Arrastrar una tarjeta propia de "Por hacer" a "En progreso". Resultado: la tarjeta
   queda en la columna nueva, los dos contadores se ajustan y, al abrir la tarea, el estado es "En
   progreso".
3. **CA-KAN-03** — Arrastrar esa tarjeta a "Completado" y abrir la tarea. Resultado: el título sale
   tachado en la tarjeta y la tarea figura entre las completadas de esta semana en el Panel del
   Gerente.
4. **CA-KAN-04** — Arrastrarla de vuelta a "Por hacer". Resultado: deja de estar tachada y sale de las
   completadas del Panel.
5. **CA-KAN-05** — Desde una cuenta que no es Gerente, intentar arrastrar una tarjeta de otra persona.
   Resultado: la tarjeta no se levanta. Tocarla: se abre en modo "Ver tarea".
6. **CA-KAN-06** — Empezar a arrastrar y soltar en el espacio vacío fuera de las columnas. Resultado:
   la tarjeta vuelve a su lugar y nada cambia.
7. **CA-KAN-07** — Elegir dos proyectos en el filtro "Proyectos". Resultado: solo quedan tareas de
   esos dos proyectos; el botón del filtro queda azul con el número 2.
8. **CA-KAN-08** — Elegir una persona en "Personas". Resultado: quedan las tareas donde esa persona es
   uno de los responsables, aunque haya otros responsables además.
9. **CA-KAN-09** — Elegir "🔥 Atrasadas" en el selector de fechas. Resultado: solo quedan tareas sin
   completar con fecha anterior a hoy; la columna "Completado" queda vacía.
10. **CA-KAN-10** — Elegir "⏪ Pasadas". Resultado: aparecen también tareas completadas con fecha
    vieja, o sea la columna "Completado" ya no está necesariamente vacía.
11. **CA-KAN-11** — Elegir "📥 Sin fecha". Resultado: solo quedan tareas sin fecha; cada tarjeta
    muestra el texto "📥 Sin fecha".
12. **CA-KAN-12** — Con "📥 Sin fecha" puesto, elegir además una semana en el selector de semanas.
    Resultado: el tablero queda completamente vacío (ninguna tarea sin fecha entra en una semana).
13. **CA-KAN-13** — Apagar el ojito "Completadas". Resultado: la columna "Completado" desaparece y las
    dos que quedan se ensanchan. Recargar la página: sigue escondida.
14. **CA-KAN-14** — Con las completadas escondidas, intentar completar una tarea arrastrándola.
    Resultado: no hay dónde soltarla; hay que volver a mostrar las completadas.
15. **CA-KAN-15** — Apagar el ojito "Sin fecha". Resultado: desaparecen las tarjetas que dicen "📥 Sin
    fecha". Recargar: siguen escondidas.
16. **CA-KAN-16** — Mirar el semáforo. Resultado: hay seis pastillas; la primera (la semana en curso)
    tiene la palabra "HOY" en azul.
17. **CA-KAN-17** — Cargar once tareas sin completar con fecha de la semana que viene. Resultado: la
    pastilla de esa semana pasa a punto rojo y su globo de ayuda dice "Carga alta".
18. **CA-KAN-18** — Dejar esa semana con dos tareas pendientes. Resultado: el punto de la pastilla es
    verde y el globo dice "Carga liviana".
19. **CA-KAN-19** — Tocar una pastilla del semáforo. Resultado: la pastilla queda azul, el selector de
    semana de arriba muestra esa misma semana y el tablero solo muestra tareas de esa semana. Tocarla
    otra vez: vuelve a verse todo.
20. **CA-KAN-20** — Poner un filtro de proyecto y comparar los números del semáforo con los contadores
    de las columnas. Resultado: **no coinciden**; el semáforo sigue contando todas las tareas del
    equipo (comportamiento actual, ver sección 9).
21. **CA-KAN-21** — Tocar una tarjeta. Resultado: se abre la ventana de la tarea con todos sus datos.
22. **CA-KAN-22** — Abrir el Kanban en un celular. Resultado: las tres columnas quedan una debajo de
    la otra y el texto de "Arrastrá una tarjeta…" no aparece.
23. **CA-KAN-23** — Con el Kanban abierto en dos computadoras, mover una tarjeta en una. Resultado: en
    la otra la tarjeta cambia de columna sola, sin recargar.

## 9. Limitaciones conocidas y pendientes

- **El semáforo ignora los filtros.** Cuenta siempre todas las tareas del equipo
  (`src/views/Kanban.tsx:62`), aunque el tablero esté filtrado por proyecto o por persona, y no hay
  nada en pantalla que lo advierta. Con un filtro puesto, los números del semáforo y los de las
  columnas no coinciden.
- **Esconder las completadas saca la columna.** No se puede completar una tarea desde el tablero
  mientras el ojito "Completadas" esté apagado (RF-KAN-17).
- **No se pueden crear tareas desde el Kanban.** No hay botón "+" en las columnas: hay que usar
  "Nueva" de la barra de arriba, la Agenda o Proyectos.
- **No se puede reordenar dentro de una columna.** Arrastrar solo cambia de columna; el orden lo define
  la fecha y la posición que se arrastró en la Agenda (RN-KAN-05).
- **Las columnas son fijas y son tres.** No se pueden agregar, renombrar ni reordenar: están escritas
  en el código (`src/views/Kanban.tsx:29-33`) y el estado de la tarea solo admite esos tres valores
  (`src/types.ts:20`).
- **No hay tope de tarjetas por columna** (lo que en un Kanban clásico se llama límite de trabajo en
  curso). Nada impide tener veinte tareas "En progreso".
- **La lista de semanas no se actualiza sola.** Se calcula al abrir la pantalla (RN-KAN-06); si el
  tablero queda abierto días, hay que recargar.
- **El semáforo llega hasta cinco semanas adelante**, pero el selector de semanas llega hasta seis: son
  dos horizontes distintos (`src/views/Kanban.tsx:57`, `:60`).
- **La tarjeta del Kanban no muestra el checklist.** A diferencia de la tarjeta de la Agenda (RF-TAR-25),
  acá no se ven los entregables ni el contador "2/5", ni se pueden tildar: hay que abrir la tarea.
- **Los filtros no se recuerdan** entre visitas a la pantalla, a diferencia de los dos ojitos
  (`src/views/Kanban.tsx:45-48`).
- **No hay aviso cuando falla el guardado** de un cambio de estado (`src/state/AppContext.tsx:83`).
