# SRS · Agenda semanal

| | |
|---|---|
| Código de módulo | MOD-AGE |
| Archivos de código | `src/views/Agenda.tsx`, `src/components/TaskCard.tsx`, `src/components/MultiFilter.tsx`, `src/crm/AgendaCRM.tsx`, `src/lib/utils.ts`, `src/lib/usePref.ts`, `src/lib/useIsMobile.ts` |
| Tablas que usa | `tasks` (lectura y escritura), `projects`, `profiles`, `crm_interacciones` y `crm_instituciones` (solo lectura, a través del CRM) |
| Quién lo ve | Todo el equipo. El bloque del CRM, solo quien está en la lista de acceso al CRM |
| Llave (feature flag) | Ninguna. El bloque del CRM depende de la lista de acceso al CRM, no de una llave |

## 1. Para qué sirve

La Agenda es el calendario semanal del equipo, de domingo a sábado, con siete columnas y una bandeja
de tareas sin fecha a la izquierda. Es la pantalla donde se **planifica**: se ve de un saque qué día
está cargado y qué día está libre, y se mueven tareas de un día a otro arrastrándolas con el dedo o
con el mouse.

Muestra las tareas de **todo el equipo**, no solo las propias. Para mirar solo lo de una persona o de
un proyecto están los filtros de arriba a la derecha, que se combinan entre sí. También hay tres
"ojitos" para esconder grupos que molestan: las completadas, las que no tienen fecha y el bloque del
CRM. Cada ojito se recuerda en ese navegador, así que la próxima vez que la persona entre, la Agenda
aparece como la dejó.

Para quien trabaja en el CRM de instituciones, la Agenda además muestra, dentro de cada día, un
bloque azul con las gestiones del CRM agendadas para ese día (llamadas, mails, visitas). Así una sola
pantalla contesta "qué tengo que hacer hoy", tanto del trabajo interno como de la venta.

## 2. Usuarios y permisos

Entra cualquier persona con sesión y ve las tareas de todo el equipo.

| Acción | Quién puede |
|---|---|
| Ver la semana completa y la bandeja | Cualquiera con sesión |
| Abrir la ventana de cualquier tarea | Cualquiera. Si no la puede editar, se abre en solo lectura (ver `01-tareas.md`) |
| Arrastrar una tarjeta a otro día, a la bandeja o reordenarla | Solo quien puede editar esa tarea: sus responsables, o un Gerente, o cualquiera si la tarea no tiene responsables. Si no, la tarjeta **no se levanta** (`src/views/Agenda.tsx:181`, `:183`) |
| Tildar un ítem del checklist en la tarjeta | Igual que arriba: si no puede editar, los casilleros salen deshabilitados (`src/views/Agenda.tsx:189`) |
| Crear una tarea con el botón "Agregar" de un día | Cualquiera. La tarea nace con la fecha de ese día ya puesta (`src/views/Agenda.tsx:297`) |
| Ver el bloque del CRM | Solo quien está en la lista de acceso al CRM (`src/views/Agenda.tsx:88`) |
| Marcar hecha una gestión del CRM desde la Agenda | Quien tiene acceso al CRM (`src/crm/AgendaCRM.tsx:71`) |
| Cargar una gestión del CRM en un día | Quien tiene acceso al CRM (`src/crm/AgendaCRM.tsx:22`). La ventana pide la institución antes de dejar guardar |

La regla de edición es la misma de siempre, `canEditTask` (`src/lib/utils.ts:32-36`). Ver RN-TAR-01 en
`01-tareas.md`.

## 3. Datos que usa

| Dato | De dónde sale | Para qué |
|---|---|---|
| `tasks.date` | `src/types.ts:39` | En qué columna va la tarea. `null` = bandeja "Sin fecha" |
| `tasks.position` | `src/types.ts:45` | Orden dentro de la columna. **La Agenda lo reescribe** al soltar una tarjeta |
| `tasks.projectId`, `tasks.assigneeIds`, `tasks.status` | `src/types.ts:36`, `:43`, `:44` | Filtros de proyecto, de persona y ojito de completadas |
| `tasks.checklist` | `src/types.ts:46` | Se tilda desde la tarjeta |
| El resto de los campos de la tarea | `src/types.ts:34-53` | Los dibuja la tarjeta. Ver RF-TAR-25 en `01-tareas.md` |
| `projects` (nombre y color) | `src/types.ts:12-18` | Color de la tarjeta y opciones del filtro de proyectos |
| `profiles` (`users`) | `src/types.ts:3-10` | Avatares de responsables y opciones del filtro de personas |
| Acciones del CRM (`crm_interacciones`) | `src/crm/tipos.ts:76-90` | Bloque del CRM: usa `fecha`, `estado`, `responsableIds`, `accion` e `institucionId` |
| Instituciones del CRM | `src/crm/tipos.ts:34-49` | El nombre que se muestra en cada gestión |

**Preferencias guardadas en el navegador** (no en la base). Las guarda `usePref`
(`src/lib/usePref.ts:4-15`) con el prefijo `reeduca-pref-`:

| Llave en el navegador | Qué recuerda | Valor inicial |
|---|---|---|
| `reeduca-pref-agenda-ocultar-completadas` | Ojito "Completadas" | Mostrar (`src/views/Agenda.tsx:62`) |
| `reeduca-pref-agenda-ocultar-sinfecha` | Ojito "Sin fecha" (esconde la bandeja entera) | Mostrar (`src/views/Agenda.tsx:63`) |
| `reeduca-pref-agenda-ocultar-crm` | Ojito "CRM" | Mostrar (`src/views/Agenda.tsx:64`) |

Los filtros de proyecto y de persona, en cambio, **no** se recuerdan: arrancan vacíos cada vez que se
entra a la pantalla (`src/views/Agenda.tsx:60-61`).

## 4. Requisitos funcionales

| ID | Requisito | Detalle / regla | Dónde vive |
|---|---|---|---|
| RF-AGE-01 | El sistema debe mostrar una semana de domingo a sábado, en siete columnas | La semana arranca el domingo (`weekStartsOn: 0`) | `src/views/Agenda.tsx:66`, `src/lib/utils.ts:13-16` |
| RF-AGE-02 | El sistema debe permitir ir a la semana anterior, a la siguiente y volver a la de hoy | Los dos botones de flecha y el botón "Hoy". "Hoy" además vuelve al día de hoy y cierra la bandeja en celular | `src/views/Agenda.tsx:206-221` |
| RF-AGE-03 | El sistema debe mostrar el rango de la semana en palabras | Formato "28 sep — 4 oct" | `src/views/Agenda.tsx:222`, `src/lib/utils.ts:19-20` |
| RF-AGE-04 | Cada columna debe mostrar el nombre del día y el número, y destacar el día de hoy en azul | Encabezado azul con texto blanco si es hoy; gris si no | `src/views/Agenda.tsx:424-437` |
| RF-AGE-05 | El sistema debe mostrar a la izquierda una bandeja con las tareas sin fecha, con su contador | Encabezado gris oscuro "SIN FECHA" con el número de tareas | `src/views/Agenda.tsx:324-360` |
| RF-AGE-06 | El sistema debe mostrar cada tarea con la tarjeta común del sistema | Ver RF-TAR-24 y RF-TAR-25 en `01-tareas.md` | `src/views/Agenda.tsx:184-190`, `src/components/TaskCard.tsx:18-121` |
| RF-AGE-07 | El sistema debe permitir crear una tarea desde cualquier columna con el botón "+ Agregar" | La tarea nace con la fecha de esa columna; desde la bandeja, nace sin fecha | `src/views/Agenda.tsx:268`, `:275`, `:297`, `:442-447` |
| RF-AGE-08 | El sistema debe permitir arrastrar una tarjeta de un día a otro y cambiarle la fecha al soltarla | Al soltar sobre una columna, la tarea toma la fecha de esa columna | `src/views/Agenda.tsx:143-167`, `:46` |
| RF-AGE-09 | El sistema debe permitir arrastrar una tarjeta hacia la bandeja para quitarle la fecha, y desde la bandeja a un día para ponerle fecha | Al caer en la bandeja, la fecha queda vacía | `src/views/Agenda.tsx:46`, `:335` |
| RF-AGE-10 | El sistema debe permitir reordenar las tarjetas dentro de la misma columna arrastrándolas | Ver RN-AGE-03 | `src/views/Agenda.tsx:153-155` |
| RF-AGE-11 | El sistema debe mostrar, mientras se arrastra, la tarjeta inclinada siguiendo el puntero, y dejar en su lugar una silueta tenue | La tarjeta original queda al 30 % de opacidad | `src/views/Agenda.tsx:308-317`, `:465`, `src/components/TaskCard.tsx:36` |
| RF-AGE-12 | El sistema debe pintar de celeste la columna sobre la que se va a soltar la tarjeta | La bandeja también se pinta | `src/views/Agenda.tsx:440`, `:348` |
| RF-AGE-13 | El sistema debe mostrar el movimiento en el momento y guardarlo en la base en una sola operación al soltar | Se guardan juntas todas las tareas cuya fecha o posición cambió | `src/views/Agenda.tsx:157-166`, `src/state/AppContext.tsx:348-356` |
| RF-AGE-14 | El sistema debe cancelar el movimiento y dejar todo como estaba si el arrastre se interrumpe | Por ejemplo al apretar Escape | `src/views/Agenda.tsx:169-172` |
| RF-AGE-15 | El sistema no debe permitir arrastrar las tareas que la persona no puede editar | La tarjeta no reacciona al arrastre, pero sí se puede abrir con un toque | `src/views/Agenda.tsx:181`, `:183`, `:454-458` |
| RF-AGE-16 | El sistema debe distinguir un toque de un arrastre | En computadora hay que mover 6 píxeles; en celular hay que mantener apretado 250 milisegundos, con tolerancia de 8 píxeles | `src/views/Agenda.tsx:111-114` |
| RF-AGE-17 | El sistema debe permitir filtrar por varios proyectos a la vez | Sin nada elegido, muestra todos. El botón marca en azul cuántos hay elegidos | `src/views/Agenda.tsx:224`, `src/components/MultiFilter.tsx:40-119` |
| RF-AGE-18 | El sistema debe permitir filtrar por varias personas a la vez | Una tarea pasa el filtro si **alguno** de sus responsables está elegido | `src/views/Agenda.tsx:77`, `:225` |
| RF-AGE-19 | El sistema debe permitir limpiar un filtro de un toque | Aparece "Limpiar filtro" al pie de la lista cuando hay algo elegido | `src/components/MultiFilter.tsx:107-114` |
| RF-AGE-20 | El sistema debe permitir esconder las tareas completadas, y recordar esa decisión en ese navegador | Ojito "Completadas" | `src/views/Agenda.tsx:62`, `:226`, `src/components/MultiFilter.tsx:7-30` |
| RF-AGE-21 | El sistema debe permitir esconder la bandeja de tareas sin fecha, y recordarlo | Ojito "Sin fecha". Al esconderla, la semana se ensancha | `src/views/Agenda.tsx:63`, `:227`, `:287-292` |
| RF-AGE-22 | El sistema debe mostrar, dentro de cada día, las gestiones del CRM agendadas para ese día | Solo para quien tiene acceso al CRM | `src/views/Agenda.tsx:86-96`, `:278`, `:299` |
| RF-AGE-23 | El sistema debe permitir esconder el bloque del CRM, y recordarlo | Ojito "CRM", que **solo aparece** si la persona tiene acceso al CRM | `src/views/Agenda.tsx:64`, `:228` |
| RF-AGE-24 | El bloque del CRM debe poder plegarse y desplegarse, y arrancar plegado cuando hay muchas gestiones | Arranca abierto con 3 gestiones o menos; con 4 o más arranca cerrado | `src/crm/AgendaCRM.tsx:18`, `:38-46` |
| RF-AGE-25 | El bloque del CRM debe mostrar cuántas gestiones hay y cuántas están pendientes | "5 · 3 pend.". El "pend." solo aparece si hay algunas hechas y otras no | `src/crm/AgendaCRM.tsx:21`, `:41-44` |
| RF-AGE-26 | Cada gestión del CRM debe mostrar un punto de color según su estado, el nombre de la institución y el texto de la gestión | Verde = hecha, naranja = pendiente, rojo = vencida. El nombre va tachado si está hecha | `src/crm/AgendaCRM.tsx:62-68`, `src/crm/reglas.ts:18-28` |
| RF-AGE-27 | Tocar una gestión del CRM debe abrir su ventana de edición, sin salir de la Agenda | Es la misma ventana del CRM | `src/crm/AgendaCRM.tsx:63`, `src/crm/contexto.ts:22` |
| RF-AGE-28 | El sistema debe permitir marcar hecha una gestión del CRM con el tilde, desde la Agenda | El botón del tilde solo aparece en las que no están hechas | `src/crm/AgendaCRM.tsx:69-77`, `src/crm/reglas.ts:71` |
| RF-AGE-29 | En celular, el sistema debe mostrar un solo día a la vez, con una fila de pastillas para elegir el día | La pastilla del día elegido queda azul; la de hoy queda con el número en azul | `src/views/Agenda.tsx:240-283`, `:384-404` |
| RF-AGE-30 | En celular, las pastillas de día y la de la bandeja deben aceptar tarjetas soltadas encima | Al arrastrar sobre una pastilla, esta se agranda y se pinta de celeste | `src/views/Agenda.tsx:44`, `:364`, `:387` |
| RF-AGE-31 | En celular, el sistema debe explicar en pantalla cómo mover una tarjeta | "Mantené apretada una tarjeta y soltala sobre un día (o sobre 📥) para moverla." | `src/views/Agenda.tsx:262-264` |
| RF-AGE-32 | En celular, la bandeja debe abrirse como una pantalla completa con su propia pastilla | La pastilla de la bandeja muestra el ícono de bandeja y el contador | `src/views/Agenda.tsx:243-249`, `:267-269` |
| RF-AGE-33 | El sistema debe reflejar los cambios de otras personas sin recargar la página | Llega por tiempo real de la base | `src/state/AppContext.tsx:224-258` |
| RF-AGE-34 | El sistema debe permitir **cargar una gestión del CRM** desde cualquier día de la Agenda | El "+" del bloque celeste cuando el día ya tiene gestiones; una línea punteada "+ Gestión CRM" cuando no tiene ninguna. Solo para quien tiene acceso al CRM | `src/crm/AgendaCRM.tsx:22`, `:25-33`, `:47-53` |

## 5. Reglas de negocio y cálculos

- **RN-AGE-01 · Qué tareas pasan los filtros** (`src/views/Agenda.tsx:72-81`). Las tres condiciones se
  cumplen todas a la vez: 1) sin proyectos elegidos pasa cualquiera, si hay elegidos el proyecto de la
  tarea tiene que estar entre ellos; 2) sin personas elegidas pasa cualquiera, si hay elegidas al
  menos un responsable de la tarea tiene que estar entre ellas; 3) si el ojito "Completadas" está
  escondiendo las completadas, la tarea no puede estar en estado "done".
- **RN-AGE-02 · Armado de las columnas** (`src/views/Agenda.tsx:98-103`): la bandeja se arma con
  `backlogTasks` (todas las de fecha vacía) y cada día con `tasksOfDay` (las de esa fecha exacta).
  Las dos ordenan por posición y, a igual posición, alfabéticamente por título
  (`src/lib/utils.ts:93-97`, `:129-131`). Ver RN-TAR-06 en `01-tareas.md`.
- **RN-AGE-03 · Qué se guarda al soltar una tarjeta** (`src/views/Agenda.tsx:157-166`): se recorren
  todas las columnas y, para cada tarea, se comparan su fecha y su posición con las que le tocarían
  según cómo quedó la pantalla. Solo se guardan las que cambiaron, y la posición pasa a ser el lugar
  que ocupa en la columna (0 para la primera, 1 para la segunda, y así). Las columnas se identifican
  por su fecha, salvo la bandeja, que usa la clave `'backlog'` y equivale a fecha vacía
  (`src/views/Agenda.tsx:35`, `:46`).
- **RN-AGE-04 · Cómo se decide sobre qué columna se está soltando** (`src/views/Agenda.tsx:38-41`):
  primero se busca qué hay exactamente bajo el puntero o el dedo; si no hay nada, se usa la zona más
  cercana por sus esquinas. Las pastillas de día del celular se reconocen porque su identificador
  arranca con `chip-` (`:44`).
- **RN-AGE-05 · Reordenar solo dentro de la misma columna** (`src/views/Agenda.tsx:153-155`): el
  reordenamiento fino se aplica únicamente cuando la tarjeta se soltó sobre **otra tarjeta** de la
  **misma** columna. Si se suelta sobre el espacio vacío de la columna, va al final.
- **RN-AGE-06 · Qué gestiones del CRM se muestran** (`src/views/Agenda.tsx:86-96`). El bloque no se
  arma en absoluto si la persona no tiene acceso al CRM, si el ojito "CRM" está apagado, o **si hay
  algún filtro de proyecto activo** (las gestiones del CRM no pertenecen a ningún proyecto). Después,
  gestión por gestión: tiene que tener fecha y caer dentro de la semana que se está viendo; si el
  ojito "Completadas" está escondiendo las completadas, no puede estar en estado `CONCRETADO`; y si hay personas
  elegidas en el filtro, al menos un responsable de la gestión tiene que estar entre ellas.
- **RN-AGE-07 · Semáforo de una gestión del CRM** (`src/crm/reglas.ts:18-21`): **hecha** si el estado
  es `CONCRETADO`; si no, **vencida** cuando tiene fecha y esa fecha es anterior a hoy; si no,
  **pendiente**. Los colores son los del CRM de la planilla: verde `#48A859`, naranja `#F39221` y rojo
  `#C63A2B` (`src/crm/reglas.ts:24-28`).
- **RN-AGE-08 · Marcar hecha una gestión** (`src/crm/reglas.ts:71`): pasa a estado `CONCRETADO` **y
  se le pone la fecha de hoy**, igual que en la planilla original. Ojo: si estaba agendada para otro
  día, cambia de día.
- **RN-AGE-09 · Qué es celular** (`src/lib/useIsMobile.ts:4-12`): pantalla de menos de 768 píxeles de
  ancho. Se recalcula al rotar o redimensionar la ventana.
- **RN-AGE-10 · Día que se abre al entrar en celular** (`src/views/Agenda.tsx:58`): el día de la
  semana de hoy (0 = domingo). Al cambiar de semana con las flechas, se mantiene el mismo día de la
  semana.

## 6. Pantalla y comportamiento

**Barra de arriba** (`src/views/Agenda.tsx:205-230`), de izquierda a derecha: flecha atrás, flecha
adelante, botón "Hoy", el rango de la semana en negrita; y pegado a la derecha, el filtro
"Proyectos", el filtro "Personas" y los ojitos "Completadas", "Sin fecha" y "CRM". En pantallas
angostas la barra se parte en varias líneas.

**Computadora** (`src/views/Agenda.tsx:284-307`): un recuadro blanco con la bandeja a la izquierda
(ancho fijo, con borde doble a la derecha) y las siete columnas repartiéndose el resto en partes
iguales. El recuadro tiene un ancho mínimo de 1260 píxeles, o de 1080 si la bandeja está escondida
(`:287`), así que en pantallas chicas aparece una barra de desplazamiento horizontal. Los encabezados
de día y el de la bandeja quedan pegados arriba al desplazar. El botón "+ Agregar" de cada columna
aparece recién al pasar el mouse por encima de la columna (`:444`).

**Celular** (`src/views/Agenda.tsx:240-283`): arriba, una fila de ocho pastillas chicas (la bandeja
más los siete días); abajo, el día elegido a pantalla completa. El botón "+ Agregar" está siempre
visible.

**Bloque del CRM**: va al final de la lista de tarjetas de cada día (`src/views/Agenda.tsx:278`,
`:299`), en un recuadro celeste con el rótulo "CRM" y el ícono de las manos que se saludan.

**Estados vacíos.** Un día sin tareas muestra solo su encabezado y el botón "+ Agregar". La bandeja
vacía muestra "0" en el contador. Un día sin gestiones del CRM no muestra el recuadro celeste:
en su lugar, a quien tiene acceso al CRM le muestra una línea punteada "+ Gestión CRM"
(`src/crm/AgendaCRM.tsx:25-33`). A quien no tiene acceso no le muestra nada
(`src/crm/AgendaCRM.tsx:19`).

**Carga.** No hay pantalla de carga propia: mientras la aplicación trae los datos se ve el girador
general "Cargando…" (`src/App.tsx:52-61`).

**Error.** Si la base falla al cargar, la Agenda se dibuja con todas las columnas vacías y no muestra
ningún aviso (`src/state/AppContext.tsx:212-215`). Si falla al **guardar** un movimiento, la tarjeta
queda visualmente en el día nuevo pero en la base sigue en el viejo; el error solo queda en la consola
del navegador (`src/state/AppContext.tsx:83`).

## 7. Casos límite y errores

- **Dos personas mueven la misma tarjeta al mismo tiempo.** Gana la última en soltar. El tiempo real
  le va a mover la tarjeta a la primera sin avisarle.
- **Alguien mueve una tarjeta mientras otra persona está arrastrando otra.** Durante el arrastre la
  Agenda trabaja sobre una copia local de las columnas (`src/views/Agenda.tsx:106`, `:120`), así que
  el cambio de la otra persona se ve recién al soltar.
- **El ojito "Completadas" está escondiendo tareas y se mueve una tarjeta.** Las posiciones se renumeran
  contando **solo las tareas visibles**, así que las completadas escondidas pueden quedar con la misma
  posición que una visible. Al volver a mostrarlas, el orden dentro del día puede salir distinto al
  esperado: el empate se resuelve alfabéticamente (RN-TAR-06). El mismo efecto ocurre con los filtros
  de proyecto y de persona activos.
- **Una tarea de una semana que no se está viendo.** No aparece en ninguna columna y no se puede
  mover: hay que navegar a su semana. La bandeja, en cambio, muestra todas las tareas sin fecha de
  todas las épocas.
- **Se suelta una tarjeta fuera de cualquier columna.** No pasa nada: el arrastre se descarta y la
  tarea se queda donde estaba (`src/views/Agenda.tsx:149`).
- **Filtro de proyecto activo y bloque del CRM.** El bloque del CRM desaparece por completo, aunque el
  ojito "CRM" esté prendido (RN-AGE-06). No hay ningún aviso que lo explique.
- **La persona pierde el acceso al CRM.** El ojito "CRM" desaparece de la barra y el bloque deja de
  armarse; la preferencia guardada en el navegador queda ahí sin efecto.
- **Una gestión del CRM sin fecha.** No aparece en la Agenda: solo se ven las que tienen fecha dentro
  de la semana (`src/views/Agenda.tsx:90`). Se ven desde la pantalla del CRM.
- **Se marca hecha una gestión del CRM agendada para otro día.** La gestión salta al día de hoy,
  porque marcar hecha cambia la fecha (RN-AGE-08).
- **Pantalla angosta en computadora.** La semana no se comprime: aparece barra de desplazamiento
  horizontal. Esconder la bandeja con el ojito "Sin fecha" gana 180 píxeles.
- **El navegador tiene bloqueado el almacenamiento local.** Los tres ojitos siguen funcionando durante
  la sesión pero no se recuerdan al recargar (`src/lib/usePref.ts:6-9`).

## 8. Criterios de aceptación

1. **CA-AGE-01** — Abrir la Agenda. Resultado: se ven siete columnas de domingo a sábado, la de hoy
   con encabezado azul, y el rango de la semana arriba (por ejemplo "28 sep — 4 oct").
2. **CA-AGE-02** — Tocar la flecha derecha dos veces y después "Hoy". Resultado: se vuelve a la semana
   actual.
3. **CA-AGE-03** — Tocar "+ Agregar" en la columna del jueves. Resultado: se abre la ventana de tarea
   nueva con la fecha del jueves ya puesta.
4. **CA-AGE-04** — Tocar "+ Agregar" en la bandeja "Sin fecha". Resultado: se abre la ventana con la
   fecha vacía y el aviso "📥 Sin fecha…".
5. **CA-AGE-05** — Arrastrar una tarjeta propia del lunes al viernes. Resultado: la tarjeta queda en
   el viernes; al abrirla, la fecha es la del viernes. Recargar la página: sigue en el viernes.
6. **CA-AGE-06** — Arrastrar esa tarjeta a la bandeja "Sin fecha". Resultado: queda en la bandeja y
   al abrirla la fecha está vacía.
7. **CA-AGE-07** — Con tres tarjetas en un mismo día, arrastrar la tercera arriba de la primera.
   Resultado: queda primera; al recargar la página, el orden se mantiene.
8. **CA-AGE-08** — Desde una cuenta que no es Gerente, intentar arrastrar una tarjeta de otra persona.
   Resultado: la tarjeta no se levanta. Tocarla: se abre en modo "Ver tarea".
9. **CA-AGE-09** — Empezar a arrastrar una tarjeta y apretar Escape. Resultado: la tarjeta vuelve a su
   lugar y nada se guarda.
10. **CA-AGE-10** — Elegir dos proyectos en el filtro "Proyectos". Resultado: solo se ven tareas de
    esos dos; el botón del filtro queda azul con el número 2.
11. **CA-AGE-11** — Tocar "Limpiar filtro" al pie de la lista. Resultado: vuelven a verse todas las
    tareas y el botón deja de estar azul.
12. **CA-AGE-12** — Elegir una persona en el filtro "Personas". Resultado: se ven las tareas donde esa
    persona es uno de los responsables, incluso si hay otros responsables además.
13. **CA-AGE-13** — Apagar el ojito "Completadas". Resultado: desaparecen las tareas tachadas.
    Recargar la página: siguen escondidas.
14. **CA-AGE-14** — Apagar el ojito "Sin fecha". Resultado: la bandeja desaparece y las siete columnas
    se ensanchan.
15. **CA-AGE-15** — Tildar un ítem del checklist directamente en una tarjeta. Resultado: se tilda, el
    contador de la tarjeta sube y no se abre la ventana de la tarea.
16. **CA-AGE-16** — Con acceso al CRM y una gestión agendada para mañana, mirar la columna de mañana.
    Resultado: al final de la columna aparece el recuadro celeste "CRM" con esa gestión y el nombre de
    la institución.
17. **CA-AGE-17** — Tocar esa gestión. Resultado: se abre la ventana de la gestión del CRM sin salir
    de la Agenda.
18. **CA-AGE-18** — Tocar el tilde de esa gestión. Resultado: queda tachada y en verde, y **se mueve a
    la columna de hoy**.
19. **CA-AGE-19** — Elegir un proyecto cualquiera en el filtro "Proyectos". Resultado: el recuadro
    celeste del CRM desaparece de todos los días.
20. **CA-AGE-20** — Apagar el ojito "CRM". Resultado: desaparecen los recuadros celestes. Recargar:
    siguen escondidos.
21. **CA-AGE-21** — Entrar con una cuenta sin acceso al CRM. Resultado: el ojito "CRM" no está en la
    barra y no se ve ningún recuadro celeste.
22. **CA-AGE-22** — Abrir la Agenda en un celular. Resultado: se ve un solo día, con la fila de
    pastillas arriba y la aclaración de mantener apretada la tarjeta para moverla.
23. **CA-AGE-23** — En celular, mantener apretada una tarjeta y soltarla sobre la pastilla del sábado.
    Resultado: la tarjeta pasa al sábado; la pastilla se agranda y se pinta mientras se pasa por
    encima.
24. **CA-AGE-24** — Con la Agenda abierta en dos computadoras, mover una tarjeta en una. Resultado:
    en la otra la tarjeta se mueve sola, sin recargar.

## 9. Limitaciones conocidas y pendientes

- **Las posiciones se renumeran con lo que está a la vista.** Con el ojito "Completadas" apagado o con
  filtros activos, el guardado del arrastre asigna posiciones contando solo las tareas visibles
  (`src/views/Agenda.tsx:157-166`), así que puede chocar con la posición de tareas escondidas.
- **No hay vista de día ni de mes en computadora.** Solo semana. La vista de un solo día existe
  únicamente en celular.
- **El horario de la tarea no ubica la tarjeta.** La tarjeta muestra "09:00 a 10:30 hs." como texto,
  pero las columnas no tienen franjas horarias: el orden lo define la posición, no la hora.
- **Las gestiones del CRM no se pueden arrastrar.** Se ven, se abren y se marcan hechas, pero para
  cambiarles el día hay que abrir su ventana.
- **El bloque del CRM se esconde con cualquier filtro de proyecto activo** y no hay ningún cartel que
  lo aclare (RN-AGE-06).
- **Los filtros de proyecto y de persona no se recuerdan.** Se vacían cada vez que se sale y se vuelve
  a entrar a la pantalla (`src/views/Agenda.tsx:60-61`), a diferencia de los tres ojitos.
- **No se puede filtrar por urgencia, por importancia ni por estado.** Para eso está el Kanban.
- **No hay contador de carga por día.** La Agenda no dice cuántas tareas tiene cada día ni avisa si un
  día está sobrecargado; ese semáforo existe solo en el Kanban y es por semana (ver `04-kanban.md`).
- **Las preferencias de los ojitos son por navegador, no por cuenta.** Quien entra desde la
  computadora y desde el celular tiene que configurarlas dos veces (`src/lib/usePref.ts:4-15`).
- **No hay aviso cuando falla el guardado de un movimiento** (`src/state/AppContext.tsx:83`).
