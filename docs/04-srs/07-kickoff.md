# SRS · Kickoff semanal

| | |
|---|---|
| Código de módulo | MOD-KIC |
| Archivos de código | `src/views/Kickoff.tsx`, `src/lib/kickoffData.ts`, `src/components/KickoffReunion.tsx`, `src/types.ts`, `src/state/AppContext.tsx`, `src/lib/supabaseApi.ts` |
| Tablas que usa | `kickoffs`, `kickoff_briefings`, `kickoff_anotaciones`, `minutes` (escribe al cerrar), `tasks`, `hitos`, `profiles`, `projects` (lectura), `feature_flags` (lectura) |
| Quién lo ve | Todo el equipo que tenga la llave prendida. Los cinco bloques, solo Gerentes; el resto ve su briefing personal |
| Llave (feature flag) | `FEATURE_KICKOFF` |

## 1. Para qué sirve

El kickoff es la reunión de arranque de la semana, todos los lunes. El problema que resuelve es el
clásico: la reunión empieza y nadie se acuerda qué se había prometido la semana anterior, ni quién
cerró qué, ni qué fechas se vienen; se improvisa media hora y no queda nada escrito.

Esta pantalla arma la reunión sola. Al abrirla, calcula cinco bloques con lo que ya está cargado
en el sistema: qué se cerró la semana pasada, qué se prometió y no se cumplió, en qué trabaja cada
uno esta semana, qué fechas se vienen en los próximos catorce días, y qué está esperando una
decisión del Gerente. No hay proceso nocturno ni tarea programada: se calcula al vuelo cada vez
que se abre (`src/views/Kickoff.tsx:76-88`, `src/lib/kickoffData.ts:6-9`).

El viernes, cada persona entra a su "Mi briefing" y responde dos preguntas: en qué va a trabajar
y si necesita algo de alguien. El lunes el Gerente aprieta "Modo reunión": la pantalla se pone a
pantalla completa, un bloque por vez, con botones grandes para pasar — se proyecta o se muestra
desde el celular. Durante la reunión el Gerente marca a los presentes, confirma la línea de cada
uno y anota las acciones acordadas. Al terminar aprieta "Cerrar kickoff" y el sistema genera la
minuta con todo eso. El lunes siguiente, esas acciones que quedaron sin cumplir aparecen solas
en el bloque 2: el círculo se cierra.

## 2. Usuarios y permisos

| Quién | Qué puede hacer | Qué NO puede hacer |
|---|---|---|
| Sin la llave `FEATURE_KICKOFF` | Nada: la pestaña "Kickoff" no aparece. Si se intentara entrar igual, el sistema muestra "Mi Día". | Ver el módulo. |
| Miembro del equipo con la llave | Ver y responder **su** briefing personal (las dos preguntas). Escribir, compartir y borrar **sus** anotaciones. Crear en la base la fila del lunes que corresponde, si todavía no existe. | Ver la vista de los cinco bloques. Ver el briefing de otra persona. Ver las anotaciones privadas de otros. Marcar presentes, escribir la línea de nadie, anotar acciones acordadas ni cerrar el kickoff. |
| Gerente (`role = 'admin'`) con la llave | Todo lo anterior, más: alternar entre "Mi vista (los 5 bloques)" y "Mi briefing", marcar presentes, escribir la línea de la semana de cada persona, agregar y borrar acciones acordadas, abrir el modo reunión, cerrar el kickoff, y preparar a mano un lunes distinto del que corresponde. | Ver las anotaciones privadas del equipo (solo las compartidas). Editar un kickoff ya cerrado. |

Cómo se hace cumplir:

- La pestaña solo aparece con la llave prendida (`src/components/TopBar.tsx:38`) y la aplicación
  redirige a "Mi Día" si se intenta entrar sin ella (`src/App.tsx:46`).
- El interruptor de vistas solo se dibuja para Gerentes (`src/views/Kickoff.tsx:303`); un miembro
  del equipo arranca y queda en "Mi briefing" (`src/views/Kickoff.tsx:57`, `:324`).
- `puedeEditar = es Gerente y el kickoff no está cerrado` (`src/views/Kickoff.tsx:67`). De eso
  dependen los avatares de presentes (`:338`), los campos de la línea de la semana (`:545`), el
  alta y baja de acciones acordadas (`:380`, `:396`) y la barra del modo reunión (`:221`).
- En la base: crear la fila del lunes lo puede hacer cualquiera, editarla y borrarla solo Gerentes
  (`supabase/migracion-kickoff-3-briefing.sql:16-30`); cada persona escribe solo su briefing y lo
  leen ella y los Gerentes (`supabase/migracion-kickoff-2-tablas.sql:78-91`); las anotaciones las
  lee su dueño más cualquiera si están compartidas, y solo su dueño las escribe o borra
  (`supabase/migracion-kickoff-2-tablas.sql:107-118`).

La llave se prende por persona desde "Miembros del equipo" (`src/views/Equipo.tsx:205-214`) y
viene sembrada por SQL para el correo del Gerente General
(`supabase/migracion-kickoff-1-llave.sql:39-43`). Una fila con usuario vacío es el valor global;
la fila de una persona gana sobre la global (`src/state/AppContext.tsx:290-296`).

## 3. Datos que usa

### Tabla `kickoffs` — uno por lunes

Definida en `supabase/migracion-kickoff-2-tablas.sql:47-54`; interface `Kickoff` en
`src/types.ts:151-158`; traductor en `src/lib/supabaseApi.ts:271-287`.

| Campo (base) | Campo (app) | Qué significa | De dónde sale |
|---|---|---|---|
| `id` | `id` | Identificador único. | Lo genera la app (`src/views/Kickoff.tsx:73`). |
| `fecha` | `fecha` | El lunes que corresponde. **Única**: no puede haber dos filas del mismo lunes. | Se calcula (RN-KIC-01). |
| `estado` | `estado` | `preparado`, `en_curso` o `cerrado`. | `preparado` al crearse; `en_curso` al abrir el modo reunión (`:129`); `cerrado` al cerrarlo (`:150`). |
| `minuta_id` | `minutaId` | La minuta que se generó al cerrar. | `src/views/Kickoff.tsx:150`. |
| `consejo_id` | `consejoId` | Resto del módulo descartado. Queda inerte (sección 9). | Nadie la escribe. |
| `notas` | `notas` | JSON con lo que se anota en la reunión. Forma abajo. | `src/views/Kickoff.tsx:90-93`. |

Forma del JSON de `notas` (interface `KickoffNotas`, `src/types.ts:145-149`):

```json
{
  "presentes": ["uuid de perfil", "uuid de perfil"],
  "bloque3": { "uuid de perfil": "En qué trabaja esta semana, escrito en la reunión" },
  "acciones": [{ "id": "uuid", "texto": "Enviar la propuesta al colegio" }]
}
```

### Tabla `kickoff_briefings` — las dos preguntas

`supabase/migracion-kickoff-2-tablas.sql:68-76`; interface `KickoffBriefing` en
`src/types.ts:161-168`; traductor en `src/lib/supabaseApi.ts:290-306`.

| Campo (base) | Campo (app) | Qué significa | De dónde sale |
|---|---|---|---|
| `kickoff_id` | `kickoffId` | A qué lunes pertenece. Si se borra el lunes, se borra el briefing. | `src/views/Kickoff.tsx:688`. |
| `usuario_id` | `usuarioId` | De quién es. Una sola fila por (lunes, persona). | `src/views/Kickoff.tsx:689`. |
| `en_que_trabajo` | `enQueTrabajo` | Respuesta a "¿En qué vas a trabajar esta semana?". | `src/views/Kickoff.tsx:793-799`. |
| `necesito_algo` | `necesitoAlgo` | Respuesta a "¿Necesitás algo de alguien para poder avanzar?". | `src/views/Kickoff.tsx:803-809`. |
| `completado_at` | `completadoAt` | Cuándo se completó, o vacío si las dos respuestas están vacías. | `src/views/Kickoff.tsx:692`. |

### Tabla `kickoff_anotaciones` — las notas personales

`supabase/migracion-kickoff-2-tablas.sql:95-105`; interface `KickoffAnotacion` en
`src/types.ts:171-181`; traductor en `src/lib/supabaseApi.ts:309` y siguientes.

| Campo (base) | Campo (app) | Qué significa | De dónde sale |
|---|---|---|---|
| `kickoff_id`, `usuario_id` | `kickoffId`, `usuarioId` | A qué lunes pertenece y quién la escribió. | `src/views/Kickoff.tsx:701-702`. |
| `bloque` | `bloque` | Sobre qué parte del briefing es: `cerradas`, `semana` o `general`. | `src/views/Kickoff.tsx:714`, `:732`, `:762`. |
| `referencia_id`, `texto_resaltado` | `referenciaId`, `textoResaltado` | Identificador y título de la tarea comentada, si la hay. | `src/views/Kickoff.tsx:704-705`. |
| `comentario` | `comentario` | La anotación. | Escrito a mano. |
| `visibilidad` | `visibilidad` | `privada` (por defecto) o `compartida`. | Nace privada (`:707`); se cambia con un botón (`:847`). |
| `created_at` | `createdAt` | Cuándo se escribió. | `src/views/Kickoff.tsx:708`. |

De las otras tablas el módulo solo **lee**: de `tasks` usa `completedAt`, `assigneeIds`, `date`,
`startTime`, `status`, `title`, `hitoId`, `projectId`, `necesitaDecisionGg` y
`necesitaDecisionDesde`; de `hitos`, `date`, `name` y `projectId`; de `projects`, el color; de
`minutes`, las acciones de la minuta del kickoff anterior. La única tabla ajena en la que
escribe es `minutes`, al cerrar (`src/views/Kickoff.tsx:149`).

## 4. Requisitos funcionales

| ID | Requisito | Detalle / regla | Dónde vive |
|---|---|---|---|
| RF-KIC-01 | El sistema debe mostrar el módulo solo a quien tenga la llave `FEATURE_KICKOFF` prendida. | Sin la llave, la pestaña no aparece y la vista cae en "Mi Día". | `src/components/TopBar.tsx:38`, `src/App.tsx:46` |
| RF-KIC-02 | El sistema debe calcular solo cuál es el lunes que corresponde. | Fórmula en RN-KIC-01. | `src/lib/kickoffData.ts:11-16` |
| RF-KIC-03 | El sistema debe crear en la base la fila de ese lunes la primera vez que alguien abre la pantalla, sin cron ni proceso programado. | Nace en estado `preparado` y con las notas vacías. Un candado interno evita crearla dos veces. | `src/views/Kickoff.tsx:62`, `:69-74` |
| RF-KIC-04 | El sistema debe permitir moverse al lunes anterior y al siguiente, y volver al que corresponde. | Suma o resta 7 días y limpia las líneas que se estaban escribiendo. | `src/views/Kickoff.tsx:161-164`, `:253-267` |
| RF-KIC-05 | Si un lunes no está preparado, el sistema debe explicarlo en pantalla y ofrecer las acciones posibles. | A un Gerente le ofrece "Preparar este lunes"; a un miembro le dice que espere a que el Gerente lo abra. | `src/views/Kickoff.tsx:166-203` |
| RF-KIC-06 | El sistema debe mostrar el estado del kickoff con un cartelito de color. | "Preparado" azul, "En curso" ámbar, "Cerrado" verde. | `src/views/Kickoff.tsx:214-219`, `:260-262` |
| RF-KIC-07 | El sistema debe calcular los cinco bloques al abrir la pantalla, con los datos que ya están en la base. | Los cinco cálculos están en RN-KIC-02 a RN-KIC-06. Son **cinco** bloques, no seis. | `src/views/Kickoff.tsx:76-88`, `src/lib/kickoffData.ts:77-165`, `src/views/Kickoff.tsx:434-630` |
| RF-KIC-08 | El sistema debe mostrar el bloque 1, "Lo que se cerró la semana pasada", agrupado por persona y con tiempo sugerido de 2 minutos. | Cada tarea se puede tocar para abrir su editor. Vacío: "No hay tareas completadas registradas en la semana." | `src/views/Kickoff.tsx:450-482` |
| RF-KIC-09 | El sistema debe mostrar el bloque 2, "Lo que se comprometió y no se cumplió", con 5 minutos sugeridos, ordenado del más atrasado al menos. | Cada línea muestra los responsables, el texto y los días de atraso en rojo. Si nunca se convirtió en tarea, lo dice: "nunca se convirtió en tarea". | `src/views/Kickoff.tsx:483-519` |
| RF-KIC-10 | El sistema debe mostrar el bloque 3, "La semana de cada uno", con 12 minutos sugeridos. | Por persona: avatar, nombre, si entregó el briefing ("briefing ✓" o "sin briefing"), cuántas tareas tiene esta semana, un campo para su línea de la semana, lo que pidió de ayuda y las anotaciones que compartió. | `src/views/Kickoff.tsx:520-573` |
| RF-KIC-11 | En el bloque 3, el sistema debe precargar la línea de cada persona con su respuesta del briefing y permitir al Gerente sobrescribirla en vivo. | Se guarda sola después de 700 ms sin escribir. Prioridad de valores en RN-KIC-07. | `src/views/Kickoff.tsx:95-113`, `:545-556` |
| RF-KIC-12 | El sistema debe mostrar el bloque 4, "Fechas que se vienen · próximos 14 días", con 3 minutos sugeridos. | Mezcla hitos y tareas con horario; cada línea muestra la bandera del color del proyecto, el título, el día y la etiqueta "hito" o "agenda". | `src/views/Kickoff.tsx:574-599` |
| RF-KIC-13 | El sistema debe mostrar el bloque 5, "Decisiones que me necesitan", con 6 minutos sugeridos. | Lista las tareas marcadas como "necesita decisión del Gerente" con el cartelito "espera desde el …". Vacío: explica que se marcan desde la tarea. | `src/views/Kickoff.tsx:600-628` |
| RF-KIC-14 | El sistema debe permitir al Gerente marcar y desmarcar a los presentes tocando su avatar. | El contador aparece al lado del título "Presentes". Se guarda al instante en las notas. | `src/views/Kickoff.tsx:154-159`, `:327-350` |
| RF-KIC-15 | El sistema debe permitir al Gerente anotar acciones acordadas durante la reunión, y borrarlas. | Con Enter o con el botón. El texto vacío no se agrega. Se avisa que al cerrar pasan a la minuta y que el lunes siguiente aparecen en el bloque 2 si no se cumplieron. | `src/views/Kickoff.tsx:115-120`, `:369-414` |
| RF-KIC-16 | El sistema debe ofrecer un "Modo reunión" a pantalla completa, un bloque por vez. | Muestra "bloque N de 5", el tiempo sugerido, puntitos para saltar a cualquier bloque y los botones grandes "Anterior" y "Siguiente". No hay cronómetro ni alarmas. | `src/views/Kickoff.tsx:278-283`, `:427`, `src/components/KickoffReunion.tsx:11-15`, `:29-84` |
| RF-KIC-17 | Al abrir el modo reunión, el sistema debe pasar el kickoff de "Preparado" a "En curso". | Solo si estaba en `preparado`. | `src/views/Kickoff.tsx:128-131` |
| RF-KIC-18 | En el modo reunión, el sistema debe dejar agregar una acción acordada desde cualquier bloque, con una barra fija al pie. | Solo si la persona puede editar. Muestra el contador de acciones ya anotadas. | `src/views/Kickoff.tsx:221-241`, `src/components/KickoffReunion.tsx:57` |
| RF-KIC-19 | El sistema debe ofrecer un botón "Actualizar" que recargue todos los datos de la base. | El ícono gira unos 800 ms. Sirve para traer los briefings que alguien acaba de guardar. | `src/views/Kickoff.tsx:122-126`, `:272-277` |
| RF-KIC-20 | El sistema debe permitir cerrar el kickoff, pidiendo confirmación y avisando cuántas acciones se van a registrar. | Si no hay ninguna acción, el aviso advierte que el lunes siguiente el bloque 2 va a estar vacío. | `src/views/Kickoff.tsx:133-139` |
| RF-KIC-21 | Al cerrar, el sistema debe generar una minuta con el título "Kickoff semanal · <fecha en palabras>", los presentes como participantes, el resumen de los cinco bloques y una acción por cada acción acordada. | Contenido del resumen en RN-KIC-08. Las acciones se guardan con `origen: 'manual'`, sin responsable ni fecha. | `src/views/Kickoff.tsx:140-149`, `src/lib/kickoffData.ts:167-216` |
| RF-KIC-22 | Al cerrar, el sistema debe pasar el kickoff a "Cerrado", guardar el vínculo con la minuta y salir del modo reunión. | Después de cerrado ya no se puede editar nada de ese lunes. | `src/views/Kickoff.tsx:150-151`, `:67` |
| RF-KIC-23 | Con el kickoff cerrado, el sistema debe reemplazar el botón "Cerrar kickoff" por "Ver la minuta" y mostrar un aviso de solo lectura. | "Ver la minuta" lleva a la pestaña Minutas. El aviso dice que queda como registro. | `src/views/Kickoff.tsx:284-290`, `:416-420`, `src/App.tsx:85` |
| RF-KIC-24 | El sistema debe ofrecer a cada persona un briefing personal con lo que le toca a ella de los cinco bloques. | Tarjetas: lo que cerró, lo que quedó pendiente, su semana con el rango de fechas, y las fechas que la involucran. | `src/views/Kickoff.tsx:678-683`, `:724-783` |
| RF-KIC-25 | El briefing debe hacer dos preguntas: "¿En qué vas a trabajar esta semana?" y "¿Necesitás algo de alguien para poder avanzar?". | Se guardan con el botón "Guardar mis respuestas" y aparece "Guardado ✓" por 2,5 segundos. | `src/views/Kickoff.tsx:685-696`, `:785-824` |
| RF-KIC-26 | El sistema debe avisar a la persona que el Gerente ve solamente esas dos respuestas. | Texto: "Ya lo completaste. El Gerente ve estas dos respuestas (nada más)." | `src/views/Kickoff.tsx:818-822` |
| RF-KIC-27 | El sistema debe permitir anotar un comentario sobre cualquier línea del briefing, y también notas sueltas. | El ícono 💬 abre un campito al lado de la línea. La nota suelta va al recuadro "Tus anotaciones". Toda anotación nace **privada**. | `src/views/Kickoff.tsx:698-716`, `:905-962` |
| RF-KIC-28 | El sistema debe mostrar cada anotación con su estado: "🔒 Solo la ves vos" o "Compartida con el equipo". | La privada ofrece el botón "Compartir en la reunión"; no hay camino de vuelta desde la pantalla. | `src/views/Kickoff.tsx:841-857` |
| RF-KIC-29 | El sistema debe permitir borrar una anotación propia. | Sin confirmación. | `src/views/Kickoff.tsx:858-864` |
| RF-KIC-30 | El sistema debe mostrar en el bloque 3 las anotaciones que su dueño decidió compartir. | Las privadas no llegan nunca a esa vista. | `src/views/Kickoff.tsx:562`, `:633-650` |
| RF-KIC-31 | El sistema debe reflejar al instante los cambios de las tres tablas del kickoff. | Respetando la seguridad por filas de cada tabla. | `supabase/migracion-kickoff-2-tablas.sql:121-124`, `src/lib/supabaseApi.ts:354-356` |
| RF-KIC-32 | El sistema debe seguir funcionando si las tablas del kickoff no existen todavía. | Si la consulta falla, las listas quedan vacías en lugar de romper la aplicación. | `src/lib/supabaseApi.ts:384-386` |
| RF-KIC-33 | El sistema debe garantizar una sola fila de briefing por persona y por lunes. | Si ya existe con otro identificador, se actualiza esa. En la base hay una restricción de unicidad. | `src/state/AppContext.tsx:526-532`, `supabase/migracion-kickoff-2-tablas.sql:75` |

## 5. Reglas de negocio y cálculos

- **RN-KIC-01 · El lunes objetivo** (`src/lib/kickoffData.ts:11-16`). De **lunes a jueves** es el
  lunes de esta semana; de **viernes a domingo**, el de la semana que viene — así el equipo
  prepara el kickoff desde el viernes. La semana que ese lunes abarca va del lunes al domingo, es
  decir el lunes más 6 días (`src/lib/kickoffData.ts:18-22`).

- **RN-KIC-02 · Bloque 1, lo que se cerró** (`src/lib/kickoffData.ts:83-91`). Se toman todas las
  tareas cuya fecha de cierre (`completedAt`, la estampa automática de
  `src/state/AppContext.tsx:91-97`) caiga entre **el lunes menos 7 días y el lunes, inclusive**.
  Se agrupan por responsable: una tarea con dos responsables aparece en los dos. Solo se muestran
  las personas con al menos una tarea, ordenadas de más tareas a menos. El total que se muestra
  es la cantidad de tareas distintas, no la suma por persona.

- **RN-KIC-03 · Bloque 2, lo incumplido** (`src/lib/kickoffData.ts:93-117`). Se busca el kickoff
  **anterior** (fecha menor a este lunes) que tenga minuta, el más reciente de todos. De esa
  minuta se toman las acciones con texto y no descartadas, salteando aquellas cuya tarea ya está
  completada. Los **responsables** son los de la tarea si se convirtió y, si no, el responsable
  cargado en la acción. Los **días de atraso** son la diferencia en días entre **hoy** y la fecha
  de la tarea (o la fecha del kickoff anterior si nunca se convirtió), nunca menor que cero: se
  cuenta contra *hoy*, no contra el lunes que se está mirando. Se ordena de más días a menos.

- **RN-KIC-04 · Bloque 3, la semana de cada uno** (`src/lib/kickoffData.ts:119-131`). Aparece una
  persona si cumple **cualquiera** de estas tres: tiene al menos una tarea con fecha dentro de la
  semana del lunes, entregó su briefing de este lunes, o está marcada como presente. Se ordena
  alfabéticamente por nombre.

- **RN-KIC-05 · Bloque 4, fechas que se vienen** (`src/lib/kickoffData.ts:133-157`). Dos fuentes,
  ambas en la ventana **del lunes al lunes más 14 días**: los **hitos** con fecha objetivo en esa
  ventana (a quién involucran son los responsables de todas sus tareas vinculadas) y las **tareas
  con hora de inicio** en esa ventana que no estén completadas. Se ordena por fecha y, en empate,
  por hora. El color es el del proyecto; si no se encuentra, gris (`src/views/Kickoff.tsx:86`).

- **RN-KIC-06 · Bloque 5, decisiones** (`src/lib/kickoffData.ts:159-162`). Las tareas marcadas
  como "necesita decisión del Gerente" que no estén completadas, ordenadas de la que espera desde
  más tiempo a la más nueva (las sin fecha de espera van al final). La fecha desde la que espera
  la estampa el sistema al marcar la tarea (`src/state/AppContext.tsx:98-102`).

- **RN-KIC-07 · Qué línea se muestra en el bloque 3** (`src/views/Kickoff.tsx:112-113`). Por
  orden de prioridad: (1) lo que se está escribiendo en este momento en pantalla, (2) lo que ya
  quedó guardado en `notas.bloque3` para esa persona, (3) la respuesta del briefing de esa
  persona, (4) vacío. Lo que se escribe se guarda **700 ms** después de la última tecla
  (`src/views/Kickoff.tsx:98-111`).

- **RN-KIC-08 · El resumen de la minuta** (`src/lib/kickoffData.ts:167-216`). Texto plano con
  títulos en mayúsculas separados por una línea vacía, en este orden fijo:
  `SE CERRÓ LA SEMANA PASADA (total)` (una línea por persona; si no hay nada, "Sin tareas
  completadas registradas."), `QUEDÓ PENDIENTE DEL KICKOFF ANTERIOR` (texto, responsables y días;
  si no hay nada, "Nada pendiente."), y después, **solo si tienen contenido**:
  `LA SEMANA DE CADA UNO` (la línea guardada, y si no la del briefing), `PIDIERON AYUDA`,
  `FECHAS QUE SE VIENEN`, `DECISIONES QUE NECESITAN AL GERENTE` y `PRESENTES`.

- **RN-KIC-09 · Participantes de la minuta** (`src/views/Kickoff.tsx:144`). Los presentes que se
  marcaron. Si no se marcó a nadie, todas las personas que aparecen en el bloque 3.

- **RN-KIC-10 · Tiempos sugeridos.** Bloque 1: 2 min. Bloque 2: 5 min. Bloque 3: 12 min.
  Bloque 4: 3 min. Bloque 5: 6 min. Total 28 minutos
  (`src/views/Kickoff.tsx:453`, `:486`, `:523`, `:577`, `:603`). Es una sugerencia que se muestra
  en pantalla; el sistema no cronometra ni avisa nada
  (`src/components/KickoffReunion.tsx:11-15`).

- **RN-KIC-11 · Cuándo se considera completado un briefing** (`src/views/Kickoff.tsx:692`). Si al
  menos una de las dos respuestas tiene texto, se guarda la fecha y hora; si las dos están
  vacías, queda sin fecha y el bloque 3 muestra "sin briefing".

- **RN-KIC-12 · Las anotaciones nacen privadas** (`src/views/Kickoff.tsx:707`). Ni el Gerente las
  ve. Compartir es un acto explícito de su dueño (`:847`), y desde la pantalla no hay forma de
  volverlas a privadas: solo borrarlas.

- **RN-KIC-13 · Un kickoff cerrado es de solo lectura** (`src/views/Kickoff.tsx:67`). No se
  pueden cambiar presentes, líneas ni acciones, ni volver a cerrarlo.

## 6. Pantalla y comportamiento

**Encabezado** (`src/views/Kickoff.tsx:247-301`): el título "🚀 Kickoff semanal", debajo las
flechitas para cambiar de lunes con la fecha en palabras en el medio, el cartelito de estado, y
— si el lunes que se ve no es el que corresponde — el enlace "ir al lunes que corresponde". A la
derecha, solo para Gerentes en la vista de los cinco bloques: "Actualizar", "Modo reunión" y
"Cerrar kickoff" (o "Ver la minuta" si ya está cerrado).

**Interruptor de vistas** (`src/views/Kickoff.tsx:303-322`): solo lo ven los Gerentes, con dos
botones, "Mi vista (los 5 bloques)" y "Mi briefing".

**Vista de los cinco bloques** (`src/views/Kickoff.tsx:324-421`), de arriba hacia abajo:
(1) **Presentes**, los avatares de todo el equipo, los ausentes atenuados y los presentes con
anillo azul; (2) **los cinco bloques**, cada uno en su tarjeta con el número en un cuadradito
azul, el título y el tiempo sugerido a la derecha (`src/views/Kickoff.tsx:352-367`);
(3) **Acciones acordadas hoy**, recuadro con borde azul, la lista de lo anotado con su tacho y el
campo para agregar, que avisa que al cerrar pasan a la minuta y que el lunes siguiente aparecen en
el bloque 2 si no se cumplieron; (4) el **aviso de cerrado**, si corresponde: candado y el texto
"Este kickoff está cerrado y su minuta ya está generada. Queda como registro."

**Vista "Mi briefing"** (`src/views/Kickoff.tsx:718-891`): arriba el recordatorio "Nadie ve el
briefing de otro."; después las tarjetas "Cerraste N tareas la semana pasada", "Te comprometiste
y quedó pendiente", "Tu semana · <rango de fechas>" y, si hay, "Fechas que te involucran". En las
dos primeras y en la de la semana, cada línea se puede abrir (lleva al editor de la tarea) y
comentar con el 💬. Después el recuadro azul "Dos preguntas antes del lunes" con las dos áreas de
texto y el botón "Guardar mis respuestas". Al final, "Tus anotaciones", con el aviso "Privadas de
verdad: ni el Gerente las ve, salvo que toques «Compartir en la reunión»."

**Modo reunión** (`src/components/KickoffReunion.tsx`): ocupa toda la pantalla, con fondo blanco.
Arriba a la izquierda "Kickoff semanal · bloque N de 5" y a la derecha el tiempo sugerido y la ✕
para salir. En el medio, el bloque: "Bloque N", el título en letra grande y el contenido. Si la
persona puede editar, al pie va la barra para anotar una acción acordada. Abajo, "Anterior"
(apagado en el primero), los puntitos de los cinco bloques y "Siguiente" (apagado en el último).

**Diferencias entre computadora y celular.** No hay dos diseños distintos: la misma pantalla se
acomoda. En celular el encabezado y los botones bajan a varias líneas
(`src/views/Kickoff.tsx:247`, `:271`) y el modo reunión usa márgenes más chicos
(`src/components/KickoffReunion.tsx:31`, `:49`); los botones grandes de "Anterior" y "Siguiente"
están pensados para manejar la reunión desde el celular.

**Estados:** *lunes no preparado* → cohete gris, "Kickoff del <fecha>", un mensaje según el rol y
los botones de navegación, más "Preparar este lunes" para el Gerente
(`src/views/Kickoff.tsx:166-203`); *primera vez del lunes que corresponde* → el mismo cartel con
"Preparándolo…" por un instante (`src/views/Kickoff.tsx:173`); *bloques vacíos* → cada uno con su
propio texto explicando por qué (`src/views/Kickoff.tsx:474-481`, `:512-518`, `:566-570`,
`:594-598`, `:622-627`); *carga* → la de la aplicación entera (`src/App.tsx:52-61`); *error al
guardar* → sin aviso en pantalla, queda en la consola (`src/state/AppContext.tsx:83`).

## 7. Casos límite y errores

- **Primer kickoff de la historia.** El bloque 2 dice: "Todavía no hay un kickoff anterior cerrado:
  este bloque se llena solo a partir del próximo lunes." (`src/views/Kickoff.tsx:514-516`).
- **Nadie cerró tareas.** El bloque 1 aclara que se cuentan desde que se marcan como completadas
  en la plataforma (`src/views/Kickoff.tsx:475-479`): las tareas cerradas antes de que existiera
  la estampa no aparecen. Si nadie tiene tareas con fecha esta semana, el bloque 3 sugiere marcar
  a los presentes para escribir su línea igual (`src/views/Kickoff.tsx:566-569`).
- **Se cierra el kickoff sin acciones acordadas.** El aviso de confirmación advierte que el lunes
  siguiente el bloque 2 va a estar vacío (`src/views/Kickoff.tsx:138`), pero deja cerrar.
- **Dos personas abren la pantalla el mismo lunes a la vez.** La fecha es única en la base
  (`supabase/migracion-kickoff-2-tablas.sql:49`): la segunda inserción falla y el error queda en
  la consola; la fila que ya existe llega por tiempo real.
- **Dos Gerentes escriben a la vez.** Cada guardado reemplaza el JSON de notas completo
  (`src/views/Kickoff.tsx:90-93`): el último gana. Escribir la línea de dos personas distintas al
  mismo tiempo desde dos equipos puede perder una de las dos.
- **Las respuestas del briefing se leen una sola vez al abrir la vista**
  (`src/views/Kickoff.tsx:673-674`): si después llega un cambio por tiempo real o se aprieta
  "Actualizar", las dos áreas de texto no se refrescan hasta salir y volver a entrar.
- **Falta una tabla del kickoff en la base.** La carga la trata como lista vacía
  (`src/lib/supabaseApi.ts:384-386`); guardar sí va a fallar.
- **Un miembro del equipo intenta editar.** La pantalla no le ofrece los controles y la base los
  rechaza (`supabase/migracion-kickoff-3-briefing.sql:21-25`).
- **Se borra la minuta de un kickoff cerrado.** El botón "Ver la minuta" sigue apareciendo pero el
  bloque 2 del lunes siguiente no encuentra nada (`src/lib/kickoffData.ts:97`).
- **Se borra el lunes desde la base.** Los briefings y las anotaciones de ese lunes se borran en
  cascada (`supabase/migracion-kickoff-2-tablas.sql:70`, `:97`).
- **Una tarea con dos responsables en el bloque 1** se cuenta una vez en el total y aparece en la
  fila de cada responsable (RN-KIC-02).
- **Mirar un lunes viejo.** Los días de atraso del bloque 2 se calculan contra hoy (RN-KIC-03),
  así que un kickoff de hace un mes muestra números más grandes que los que se mostraron ese día.

## 8. Criterios de aceptación

1. **CA-KIC-01.** Con la llave apagada → la pestaña "Kickoff" no aparece en ningún lado.
2. **CA-KIC-02.** Prender la llave para una persona desde "Miembros del equipo" → esa persona ve
   la pestaña sin recargar la página.
3. **CA-KIC-03.** Un miércoles, entrar → la fecha del encabezado es el **lunes de esta semana**.
4. **CA-KIC-04.** Un sábado, entrar → la fecha del encabezado es el **lunes que viene**.
5. **CA-KIC-05.** La primera vez que se abre un lunes → aparece "Preparándolo…" y después la
   pantalla con el cartelito "Preparado".
6. **CA-KIC-06.** Contar los bloques numerados de la vista del Gerente → son **cinco** (cerrado,
   incumplido, la semana de cada uno, fechas, decisiones). No hay "Consejo de la semana".
7. **CA-KIC-07.** Completar una tarea la semana anterior al lunes → aparece en el bloque 1 bajo el
   nombre de su responsable.
8. **CA-KIC-08.** Como miembro del equipo (no Gerente), entrar → se ve directamente el briefing
   personal, sin el interruptor de vistas ni los cinco bloques.
9. **CA-KIC-09.** Responder las dos preguntas y tocar "Guardar mis respuestas" → "Guardado ✓" y el
   aviso de que el Gerente ve solo esas dos respuestas.
10. **CA-KIC-10.** Como Gerente, tocar "Actualizar" → en el bloque 3 esa persona muestra
    "briefing ✓" y su línea viene precargada con su respuesta.
11. **CA-KIC-11.** Sobrescribir esa línea, esperar un segundo y recargar → la línea escrita se
    mantiene.
12. **CA-KIC-12.** Marcar a dos personas como presentes → dice "Presentes · 2" y los dos avatares
    quedan con anillo azul.
13. **CA-KIC-13.** Tocar "Modo reunión" → pantalla completa, "bloque 1 de 5", "≈ 2 min",
    "Anterior" apagado y "Siguiente" disponible.
14. **CA-KIC-14.** Salir del modo reunión con la ✕ → el cartelito de estado dice "En curso".
15. **CA-KIC-15.** En el modo reunión, escribir una acción abajo y tocar "Acordado" → el contador
    sube en uno.
16. **CA-KIC-16.** Con dos acciones anotadas, tocar "Cerrar kickoff" → el aviso menciona
    "2 acciones acordadas"; aceptar.
17. **CA-KIC-17.** Después de cerrar → dice "Cerrado", aparece el candado, los presentes ya no se
    pueden tocar y el botón cambió a "Ver la minuta".
18. **CA-KIC-18.** Tocar "Ver la minuta" → se abre Minutas con "Kickoff semanal · <fecha>", los
    presentes marcados, el resumen con títulos en mayúsculas y las dos acciones cargadas.
19. **CA-KIC-19.** Sin anotar ninguna acción, intentar cerrar → el aviso advierte que el lunes que
    viene el bloque 2 va a estar vacío.
20. **CA-KIC-20.** Al lunes siguiente, sin cumplir una de esas acciones → aparece en el bloque 2
    con sus días de atraso en rojo y el texto "nunca se convirtió en tarea".
21. **CA-KIC-21.** Tocar el 💬 de una línea del briefing y guardar → la anotación aparece con el
    cartelito "🔒 Solo la ves vos".
22. **CA-KIC-22.** Con la sesión del Gerente, mirar el bloque 3 de esa persona → la anotación
    privada **no** se ve.
23. **CA-KIC-23.** La persona toca "Compartir en la reunión" → pasa a "Compartida con el equipo" y
    el Gerente la ve debajo de su línea del bloque 3.
24. **CA-KIC-24.** Poner a un hito una fecha dentro de los próximos 14 días → aparece en el
    bloque 4 con la etiqueta "hito" y la bandera del color de su proyecto.
25. **CA-KIC-25.** Marcar una tarea como "necesita decisión del Gerente" → aparece en el bloque 5
    con el cartelito "espera desde el …".
26. **CA-KIC-26.** Tocar la flechita "‹" → se va al lunes anterior; si ese lunes no existe, se ve
    el cartel del cohete con el botón "Preparar este lunes".

## 9. Limitaciones conocidas y pendientes

- **El módulo de IA sobre transcripciones fue descartado.** Restos que **quedan inertes** en este
  módulo:
  - La columna `consejo_id` de `kickoffs` (`supabase/migracion-kickoff-2-tablas.sql:52`) y el
    campo `consejoId` de la interface (`src/types.ts:156`): se leen y se escriben en el mapeo
    (`src/lib/supabaseApi.ts:276`, `:285`) pero **ninguna pantalla los usa**. Siempre quedan
    vacíos.
  - La tabla `consejos` entera, con su política de seguridad y su publicación en tiempo real
    (`supabase/migracion-kickoff-2-tablas.sql:25-44`, `:121`), más todo su cableado en la
    aplicación (`src/types.ts:128-141`, `src/state/AppContext.tsx:501-509`,
    `src/lib/supabaseApi.ts:240-268`, `:353`). No se usa.
  - **El "Consejo de la semana" fue eliminado del kickoff.** Hoy son cinco bloques, no seis
    (`src/views/Kickoff.tsx:449-629`, `src/components/KickoffReunion.tsx:33`).
  - Las acciones que el cierre guarda en la minuta llevan `origen: 'manual'`
    (`src/views/Kickoff.tsx:146`) y `estadoProcesamiento: 'sin_transcripcion'`
    (`src/views/Kickoff.tsx:147`): son los valores fijos que quedaron de ese diseño.
  - El filtro de acciones descartadas del bloque 2 (`src/lib/kickoffData.ts:99`) sigue ahí, pero
    ninguna pantalla marca una acción como descartada.
- **No hay nada programado ni ningún aviso.** El lunes se prepara cuando alguien abre la pantalla
  (`src/views/Kickoff.tsx:69-74`); si nadie entra, no existe. Nadie le recuerda al equipo que
  responda las dos preguntas.
- **Los cinco bloques son solo para Gerentes.** Un miembro del equipo no puede ver el panorama
  completo ni siquiera en modo lectura (`src/views/Kickoff.tsx:303`, `:324`).
- **No se puede reabrir un kickoff cerrado** desde la pantalla (`src/views/Kickoff.tsx:67`): hay
  que cambiar el estado a mano en la base.
- **Las acciones acordadas no tienen responsable ni fecha** mientras viven en el kickoff: el JSON
  guarda solo `id` y `texto` (`src/types.ts:148`). Tampoco se convierten en tarea desde acá: hay
  que cerrar, ir a la minuta y convertirlas una por una (`src/views/Kickoff.tsx:146`).
- **Los días de atraso del bloque 2 se cuentan contra hoy**, no contra el lunes que se está
  mirando (`src/lib/kickoffData.ts:113`): mirar kickoffs viejos da números inflados.
- **El autor no ve su propia anotación compartida** en el bloque 3: el filtro excluye
  explícitamente las del usuario actual (`src/views/Kickoff.tsx:636`).
- **Compartir una anotación no se puede deshacer** desde la pantalla (RN-KIC-12): solo borrarla. Y
  compartirla no manda ninguna notificación.
- **No hay control de tiempo.** Los "≈ N min" son informativos; no hay cronómetro ni alarma
  (`src/components/KickoffReunion.tsx:11-15`).
- **Un Gerente puede apagarse la llave a sí mismo** desde "Miembros del equipo"; para recuperarla
  hay que volver a correr el SQL (`src/views/Equipo.tsx:256-259`,
  `supabase/migracion-kickoff-1-llave.sql:37-43`).
- **El campo `bloque` de las anotaciones no cubre los cinco bloques:** solo se usan los valores
  `cerradas`, `semana` y `general` (`src/views/Kickoff.tsx:714`, `:732`, `:762`). Las líneas de
  "Te comprometiste y quedó pendiente" y de "Fechas que te involucran" no se pueden comentar
  (`src/views/Kickoff.tsx:740-783`).
