# SRS · Mi Día

| | |
|---|---|
| Código de módulo | MOD-MID |
| Archivos de código | `src/views/MiDia.tsx`, `src/components/Comments.tsx`, `src/components/Menciones.tsx`, `src/components/Stars.tsx`, `src/components/Avatar.tsx`, `src/lib/menciones.ts` |
| Tablas que usa | `tasks`, `pins`, `task_comments`, `notes`, `note_folders`, `profiles`, `projects` |
| Quién lo ve | Todo el equipo. Cada persona ve **su** Mi Día: nunca el de otro |
| Llave (feature flag) | Ninguna para la pantalla. El bloque de menciones en comentarios depende de `FEATURE_COMENTARIOS` |

## 1. Para qué sirve

Mi Día es la pantalla con la que arranca el sistema: es lo primero que aparece al entrar
(`src/App.tsx:40`). Contesta una sola pregunta, "¿qué tengo que hacer yo hoy?", y la contesta sin
filtros, sin menús y sin tener que buscar nada. Todo lo que se ve acá es de la persona que está
mirando.

Tiene cuatro bloques. **Recordatorios críticos** junta las tareas de 4 y 5 estrellas que todavía no
están terminadas, sin importar si tienen fecha o cuándo es: son las que no hay que perder de vista.
**Agenda de hoy** lista las tareas propias fechadas para hoy, con un círculo a la izquierda para
tildarlas de un toque mientras se van terminando. **Te mencionaron** aparece solo si alguien te
arrobó con "@" en un comentario o en la descripción de una tarea; es el reemplazo de las
notificaciones, que el sistema no tiene. **Fijados** son las notas del Cuaderno que anclaste más los
recordatorios sueltos que escribís acá mismo.

Un día normal: entrás, mirás las dos pastillas de arriba ("3 pendientes para hoy", "2 recordatorios
críticos"), tildás lo que ya hiciste, revisás si alguien te arrobó, y si algo hay que mirar mejor
tocás el título y se abre la ventana de la tarea.

## 2. Usuarios y permisos

Entra cualquier persona con sesión. No hay nada exclusivo de Gerentes y no hay forma de ver el Mi Día
de otra persona: todos los bloques filtran por la persona conectada
(`src/views/MiDia.tsx:32`, `:37`, `:48`).

| Acción | Quién puede |
|---|---|
| Ver la pantalla | Cualquiera con sesión, solo con sus propios datos |
| Tildar o destildar una tarea de "Agenda de hoy" | La propia persona. Todas las tareas de ese bloque la tienen como responsable, así que siempre cumple la regla de edición (ver RF-TAR-16 en `01-tareas.md`) |
| Abrir la ventana de una tarea desde acá | Cualquiera. Si la tarea no es editable para esa persona, la ventana se abre en solo lectura (ver `01-tareas.md`) |
| Fijar y quitar recordatorios | Solo los propios. La política de la base `pins_own` solo deja ver y escribir las filas de la propia cuenta (`supabase/schema.sql:145-146`) |
| Abrir una nota fijada | Solo el dueño o alguien con quien la nota fue compartida (lo controla el Cuaderno) |

## 3. Datos que usa

Mi Día no crea tareas ni notas: las lee. Lo único que escribe son los recordatorios fijados (`pins`)
y el estado de las tareas propias.

| Dato | De dónde sale | Para qué lo usa |
|---|---|---|
| `tasks` (todas) | `src/state/AppContext.tsx:275` | De ahí filtra las propias, y para "Te mencionaron" recorre **todas** las tareas del equipo, no solo las propias |
| `tasks.assigneeIds` | `src/types.ts:43` | Define qué es "mío" (`src/views/MiDia.tsx:48`) |
| `tasks.importance` | `src/types.ts:49` | Recordatorios críticos: 4 o 5 estrellas |
| `tasks.urgent`, `tasks.date`, `tasks.status`, `tasks.startTime`, `tasks.position` | `src/types.ts:39-48` | Orden y pastillas de los dos bloques de tareas |
| `tasks.description` | `src/types.ts:38` | Se busca la @mención de la persona conectada |
| `task_comments` | `src/types.ts:186-192` | Se buscan las @menciones de los últimos 14 días |
| `pins` | `src/types.ts:77-83` | Bloque "Fijados" |
| `notes`, `noteFolders` | `src/types.ts:57-74` | Título y carpeta de la nota fijada |
| `projects` | `src/types.ts:12-18` | Color y nombre del proyecto al lado de cada tarea |
| `profiles` (`users`) | `src/types.ts:3-10` | Avatares de responsables, autor del comentario, y la lista de nombres con la que se reconocen las @menciones |

Forma de la fila de `pins` (`supabase/schema.sql:74-80`): `id`, `user_id`, `note_id` (puede ser
nulo), `text` (puede ser nulo), `position`. Un fijado es **o** una nota anclada (`note_id` con
valor) **o** un recordatorio escrito a mano (`text` con valor); nunca los dos.

## 4. Requisitos funcionales

| ID | Requisito | Detalle / regla | Dónde vive |
|---|---|---|---|
| RF-MID-01 | El sistema debe saludar a la persona por su nombre y mostrar la fecha de hoy en palabras | "Hola, Malena 👋" y abajo "lunes 29 de septiembre" | `src/views/MiDia.tsx:98-99`, `src/lib/utils.ts:21` |
| RF-MID-02 | El sistema debe mostrar dos pastillas de resumen: pendientes de hoy y recordatorios críticos | Los números concuerdan exactamente con los dos bloques de abajo. El texto se ajusta al singular ("1 pendiente") y al plural | `src/views/MiDia.tsx:100-107`, `:67` |
| RF-MID-03 | El sistema debe listar en "Recordatorios críticos" las tareas propias de 4 o 5 estrellas que no estén completadas | Sin importar la fecha: incluye las de mañana, las atrasadas y las que no tienen fecha | `src/views/MiDia.tsx:50-61` |
| RF-MID-04 | El sistema debe ordenar los recordatorios críticos por importancia, después urgencia, después fecha | Ver RN-MID-01 | `src/views/MiDia.tsx:55-59` |
| RF-MID-05 | Cada recordatorio crítico debe mostrar un punto con el color del proyecto, el título, las estrellas, la pastilla de urgente, el nombre del proyecto, la fecha (o "📥 sin fecha"), la pastilla de comentarios y los avatares de los responsables | Toda la fila es un botón: al tocarla se abre la ventana de la tarea | `src/views/MiDia.tsx:130-151` |
| RF-MID-06 | El sistema debe listar en "Agenda de hoy" las tareas propias con fecha de hoy | Incluye las ya completadas, tachadas y en gris | `src/views/MiDia.tsx:63-66`, `:188-192` |
| RF-MID-07 | El sistema debe permitir marcar una tarea como completada, y volver atrás, con un solo toque en el círculo de la izquierda | Completar la pasa a "done"; destildar la devuelve a "Por hacer" (`todo`), **no** al estado anterior | `src/views/MiDia.tsx:69`, `:179-185` |
| RF-MID-08 | El sistema debe estampar la fecha de completado cuando se tilda desde acá | No es lógica de esta pantalla: lo hace el guardado central. Ver RN-TAR-02 en `01-tareas.md` | `src/state/AppContext.tsx:91-97` |
| RF-MID-09 | Cada fila de la agenda de hoy debe mostrar el horario de inicio si lo tiene, el punto y el nombre del proyecto, las pastillas de urgente e importancia y la de comentarios | La pastilla de urgente no se muestra si la tarea ya está completada | `src/views/MiDia.tsx:194-201` |
| RF-MID-10 | El sistema debe mostrar el bloque "Te mencionaron" **solo** si hay al menos una mención a la persona conectada | Si no hay ninguna, el bloque entero no se dibuja | `src/views/MiDia.tsx:211` |
| RF-MID-11 | El sistema debe juntar en "Te mencionaron" las menciones de comentarios de otras personas de los últimos 14 días y las de descripciones de tareas abiertas | Ver RN-MID-02 y RN-MID-03 | `src/views/MiDia.tsx:74-92` |
| RF-MID-12 | El sistema debe mostrar en cada mención quién fue, en qué tarea y hace cuánto | Para un comentario: "Malena te mencionó en <tarea> · hace 3 horas", con ícono de globo de diálogo. Para una descripción: "En la descripción de <tarea>", con ícono de documento y sin fecha | `src/views/MiDia.tsx:231-247` |
| RF-MID-13 | El sistema debe mostrar el texto donde apareció la mención, recortado a dos líneas, con los @nombres resaltados | El nombre propio se resalta en ámbar y el de los demás en azul | `src/views/MiDia.tsx:248-250`, `src/components/Menciones.tsx:28-31` |
| RF-MID-14 | Tocar una mención debe abrir la ventana de la tarea donde ocurrió | No abre el comentario: abre la tarea (el hilo está adentro de la ventana) | `src/views/MiDia.tsx:228` |
| RF-MID-15 | El sistema debe listar en "Fijados" las notas ancladas y los recordatorios sueltos de la persona, en el orden en que se fijaron | Orden por el campo `position` | `src/views/MiDia.tsx:36-39`, `:272` |
| RF-MID-16 | Una nota fijada debe mostrar su título, la carpeta donde vive y la aclaración "tocá para abrirla" | Si la nota no tiene título muestra "Nota nueva". Al tocarla, el sistema cambia a la pestaña Cuaderno y abre esa nota | `src/views/MiDia.tsx:273-287`, `src/App.tsx:72-75` |
| RF-MID-17 | El sistema debe permitir escribir un recordatorio suelto y fijarlo apretando Enter | El campo está al final del bloque. Si está vacío o solo tiene espacios, no hace nada | `src/views/MiDia.tsx:41-46`, `:312-323` |
| RF-MID-18 | El sistema debe permitir quitar cualquier fijado con el botón "×" | Pide confirmación: no. El fijado se borra directo | `src/views/MiDia.tsx:288-294`, `:302-308` |
| RF-MID-19 | Las tareas y los fijados deben aparecer y actualizarse solos cuando cambian en otro lado | Lo resuelve el tiempo real de la base; Mi Día solo lee el estado central | `src/state/AppContext.tsx:224-258` |

## 5. Reglas de negocio y cálculos

- **RN-MID-01 · Orden de los recordatorios críticos** (`src/views/MiDia.tsx:55-59`): 1) importancia
  de mayor a menor (las de 5 antes que las de 4); 2) a igual importancia, primero las urgentes;
  3) a igual urgencia, por fecha de la más próxima a la más lejana, y las **sin fecha van al final**
  (internamente se comparan con el valor `'9999-99'`).
- **RN-MID-02 · Qué cuenta como mención en un comentario** (`src/views/MiDia.tsx:77-87`): el
  comentario **no** puede ser propio, tiene que ser de los últimos 14 días contados desde hoy
  (`corte = hoy − 14 días`, `:76`) y el texto tiene que mencionar a la persona conectada según
  `mencionaA` (`src/lib/menciones.ts:55-56`). Se ordenan del más nuevo al más viejo. Si la llave
  `FEATURE_COMENTARIOS` está apagada para esa persona, esta parte se saltea entera
  (`src/views/MiDia.tsx:73` y `src/views/MiDia.tsx:77`).
- **RN-MID-03 · Qué cuenta como mención en una descripción** (`src/views/MiDia.tsx:88-90`): cualquier
  tarea del equipo (propia o ajena) que **no** esté completada y cuya descripción mencione a la
  persona. Acá no hay límite de 14 días: mientras la tarea siga abierta, la mención sigue apareciendo.
- **RN-MID-04 · Tope de menciones** (`src/views/MiDia.tsx:91`): se muestran como máximo 8. Primero
  van todas las de comentarios y después las de descripciones; el corte se aplica sobre la lista ya
  unida.
- **RN-MID-05 · Orden de la agenda de hoy** (`src/views/MiDia.tsx:64`): por el campo `position`, que
  es el mismo orden que se ve (y se arrastra) en la columna de hoy de la Agenda. A diferencia de la
  Agenda, acá no hay desempate alfabético.
- **RN-MID-06 · Qué es "mío"** (`src/views/MiDia.tsx:48`): la persona conectada está en la lista de
  responsables de la tarea. Una tarea **sin ningún responsable** no aparece en Mi Día de nadie,
  aunque cualquiera pueda editarla.
- **RN-MID-07 · Posición de un fijado nuevo** (`src/views/MiDia.tsx:44`): la cantidad de fijados que
  la persona ya tiene. O sea, entra al final.

## 6. Pantalla y comportamiento

Una sola columna centrada, de ancho máximo grande, con desplazamiento vertical
(`src/views/MiDia.tsx:95-96`). De arriba hacia abajo: saludo y pastillas; después los dos bloques de
tareas; después "Te mencionaron" si corresponde; y al final "Fijados".

Los dos primeros bloques van **lado a lado en computadora y uno arriba del otro en celular**
(`src/views/MiDia.tsx:110`). "Te mencionaron" y "Fijados" ocupan siempre el ancho completo.

Cada bloque es una tarjeta blanca con borde, un encabezado con ícono de color y una bajada que
explica en criollo qué junta ese bloque ("Tus tareas de 4–5 estrellas, sin importar la fecha",
"Marcá con un clic lo que vayas terminando").

**Estados vacíos.** Sin recordatorios críticos: "Nada crítico pendiente. ¡Bien ahí! 🎉"
(`src/views/MiDia.tsx:125-129`). Sin tareas de hoy: "No tenés tareas agendadas para hoy."
(`:169-173`). Sin menciones: el bloque no aparece. Sin fijados: el bloque aparece igual, con solo el
campo para escribir el primer recordatorio.

**Carga.** Mi Día no tiene pantalla de carga propia: mientras la aplicación trae los datos se muestra
el girador general con "Cargando…" (`src/App.tsx:52-61`), y recién después aparece la pantalla.

**Error.** Si la base falla al cargar, la aplicación guarda el mensaje de error pero Mi Día no lo
muestra: la pantalla aparece con todos los bloques vacíos, como si no hubiera nada que hacer
(`src/state/AppContext.tsx:212-215`).

**Celular.** Los botones de quitar un fijado ("×") están siempre visibles en celular; en computadora
recién aparecen al pasar el mouse por encima de la fila (`src/views/MiDia.tsx:291`, `:305`).

## 7. Casos límite y errores

- **La persona no tiene ninguna tarea asignada.** Los dos bloques de tareas quedan vacíos con sus
  mensajes, las pastillas dicen "0 pendientes para hoy" y "0 recordatorios críticos".
- **Una tarea crítica sin fecha.** Aparece en los recordatorios críticos, al final del orden, con el
  texto "📥 sin fecha" donde iría la fecha (`src/views/MiDia.tsx:144`).
- **Se borró la nota que estaba fijada.** La fila no se dibuja: el código devuelve nada si no
  encuentra la nota (`src/views/MiDia.tsx:274-275`). En la base, borrar la nota borra el fijado por
  `on delete cascade` (`supabase/schema.sql:77`), así que en la práctica desaparece solo.
- **Se borró la carpeta de la nota fijada.** El fijado sigue apareciendo, sin el nombre de la
  carpeta al lado (`src/views/MiDia.tsx:276`, `:285`).
- **La tabla `pins` no existe todavía.** La carga devuelve lista vacía en lugar de romper
  (`src/lib/supabaseApi.ts:379`): el bloque "Fijados" aparece vacío y fijar algo fallará en silencio.
- **Te mencionaron en un comentario de una tarea que después se borró.** La mención no se muestra: se
  descarta porque no encuentra la tarea (`src/views/MiDia.tsx:82-86`). En la base, borrar la tarea
  borra sus comentarios (`supabase/migracion-comentarios.sql:36`).
- **Alguien se menciona a sí mismo en un comentario.** No aparece: los comentarios propios se
  excluyen (`src/views/MiDia.tsx:79`). Pero si se menciona a sí mismo en la **descripción** de una
  tarea, sí aparece: esa parte no filtra por autor.
- **Hay más de 8 menciones.** Se ven las 8 primeras y las demás no se ven en ningún lado. Como los
  comentarios van primero, con 8 o más comentarios recientes las menciones en descripciones no
  aparecen nunca (ver sección 9).
- **Dos personas con el mismo primer nombre.** La @mención por primer nombre deja de funcionar para
  las dos; hay que escribir el nombre completo (`src/lib/menciones.ts:34-37`).
- **El mismo fijado abierto en dos pestañas.** Quitarlo en una lo saca de la otra sola, por tiempo
  real.

## 8. Criterios de aceptación

1. **CA-MID-01** — Entrar al sistema. Resultado: la primera pantalla es Mi Día, con tu nombre en el
   saludo y la fecha de hoy escrita en palabras y en minúsculas.
2. **CA-MID-02** — Contar las filas de "Agenda de hoy" que no estén tachadas. Resultado: coincide con
   el número de la pastilla azul "N pendientes para hoy".
3. **CA-MID-03** — Contar las filas de "Recordatorios críticos". Resultado: coincide con el número de
   la pastilla ámbar.
4. **CA-MID-04** — Crear una tarea propia con 5 estrellas y sin fecha. Resultado: aparece en
   "Recordatorios críticos" con el texto "📥 sin fecha", y **no** aparece en "Agenda de hoy".
5. **CA-MID-05** — Crear dos tareas propias de 4 estrellas, una urgente y otra no. Resultado: la
   urgente aparece arriba de la otra.
6. **CA-MID-06** — Bajar una tarea de 5 estrellas a 3. Resultado: sale de "Recordatorios críticos".
7. **CA-MID-07** — Tildar el círculo de una tarea de hoy. Resultado: el título queda tachado y gris,
   el círculo verde, y la pastilla de pendientes baja en uno.
8. **CA-MID-08** — Destildar esa misma tarea. Resultado: vuelve a "Por hacer" (verificable abriendo
   la ventana de la tarea), no al estado que tenía antes.
9. **CA-MID-09** — Tocar el título de una tarea de hoy. Resultado: se abre la ventana de la tarea con
   todos sus datos.
10. **CA-MID-10** — Desde otra cuenta, comentar una tarea escribiendo "@TuNombre". Resultado: en tu
    Mi Día aparece el bloque "Te mencionaron" con el nombre de quien comentó, la tarea y "hace unos
    segundos".
11. **CA-MID-11** — Apagar la llave `FEATURE_COMENTARIOS` para tu usuario. Resultado: esa mención de
    comentario desaparece de "Te mencionaron" (las de descripciones siguen).
12. **CA-MID-12** — Poner "@TuNombre" en la descripción de una tarea ajena que esté abierta.
    Resultado: aparece en "Te mencionaron" con el ícono de documento y el texto "En la descripción
    de…", sin fecha.
13. **CA-MID-13** — Pasar esa tarea a "Completado". Resultado: la mención de la descripción
    desaparece del bloque.
14. **CA-MID-14** — Escribir "Llamar al contador" en el campo del final de "Fijados" y apretar Enter.
    Resultado: queda fijado arriba del campo y el campo se vacía.
15. **CA-MID-15** — Apretar Enter con el campo vacío. Resultado: no pasa nada, no se crea un fijado
    en blanco.
16. **CA-MID-16** — Tocar el "×" de ese recordatorio. Resultado: desaparece al instante, sin pedir
    confirmación.
17. **CA-MID-17** — En el Cuaderno, anclar una nota a Mi Día. Resultado: aparece en "Fijados" con su
    título y el nombre de su carpeta; al tocarla, el sistema salta al Cuaderno con esa nota abierta.
18. **CA-MID-18** — Entrar con otra cuenta. Resultado: no se ve ninguno de tus fijados ni de tus
    tareas: cada Mi Día es propio.

## 9. Limitaciones conocidas y pendientes

- **Las menciones en descripciones pueden quedar escondidas.** El tope de 8 se aplica después de unir
  las dos listas, y los comentarios van primero (`src/views/MiDia.tsx:91`): con 8 o más menciones
  recientes en comentarios, las de descripciones no se ven nunca.
- **No hay forma de marcar una mención como leída.** Una mención en un comentario desaparece sola
  recién a los 14 días; una mención en una descripción, recién cuando la tarea se completa. No se
  pueden descartar a mano.
- **No hay notificaciones de verdad.** Ni correo, ni aviso del navegador, ni un punto rojo en la
  pestaña: hay que entrar a Mi Día para enterarse de que te mencionaron.
- **Los fijados no se pueden reordenar.** Existe el campo `position` y se usa para ordenar
  (`src/views/MiDia.tsx:37`), pero no hay forma de arrastrarlos ni de cambiarles el orden desde la
  pantalla: entran siempre al final.
- **Un recordatorio suelto no se puede editar.** Solo se puede borrar y escribir otro.
- **Un recordatorio suelto no tiene fecha ni se puede completar.** Queda fijado hasta que alguien lo
  quite a mano; no es una tarea.
- **Los recordatorios críticos no se pueden filtrar ni esconder.** Si alguien carga veinte tareas de
  5 estrellas, el bloque crece sin tope y hay que desplazarse.
- **Las tareas sin responsable no aparecen en el Mi Día de nadie** (RN-MID-06), aunque cualquiera las
  pueda editar. Se ven solo desde la Agenda, el Kanban o Proyectos.
- **No hay bloque de "atrasadas".** Una tarea atrasada de 3 estrellas o menos no aparece en Mi Día:
  hay que buscarla en la Agenda o con el filtro "🔥 Atrasadas" del Kanban.
- **Si la base falla, la pantalla miente.** Muestra los bloques vacíos con sus mensajes de "nada
  pendiente" en lugar de avisar que no pudo cargar los datos
  (`src/state/AppContext.tsx:212-215`).
