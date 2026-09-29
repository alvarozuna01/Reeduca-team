# 09 · Hallazgos de la documentación

Al escribir esta documentación se leyó el sistema entero, línea por línea. En el camino aparecieron
cosas que no cierran. **Acá están todas, verificadas contra el código**, ordenadas por impacto.

Nada de esto se arregló al documentar (salvo las dos cosas de la última sección): la lista está
para decidir con calma qué vale la pena tocar. Cada fila dice qué pasa, dónde vive y qué efecto
tiene en el uso real.

Tres aclaraciones de lectura:

- **Falla** = el sistema no hace lo que promete.
- **Decisión** = está hecho a propósito, pero conviene saberlo.
- **Latente** = hoy no molesta, pero va a morder si algo cambia.

## 1. Alto impacto

| # | Qué pasa | Tipo | Dónde | Efecto real |
|---|---|---|---|---|
| A1 | Borrar a una persona **no la saca de las tareas en la base**: la pantalla las muestra sin responsable, pero al recargar vuelven con el responsable borrado | Falla | `src/state/AppContext.tsx:400-407` limpia solo en memoria; `src/lib/supabaseApi.ts:448-450` borra únicamente el perfil (en modo demo sí se limpia bien) | La confirmación promete "sus tareas quedarán sin asignar" y no se cumple. Quedan tareas con un responsable que ya no existe |
| A2 | "Agregar miembro" desde Equipo crea un perfil que **no corresponde a ninguna cuenta real**; cuando la persona se registra, el sistema le crea un segundo perfil | Falla | `src/views/Equipo.tsx:319` inventa el id; la autocuración de `src/state/AppContext.tsx:199` crea el otro | Personas duplicadas en las listas y tareas repartidas entre los dos perfiles. La pantalla avisa, pero el botón deja hacerlo igual |
| A3 | La minuta se **guarda entera en cada tecla**, sin espera ni control de versión | Falla | `src/views/Minutas.tsx:46-49` | Si dos personas editan la misma minuta a la vez, se pisan incluso escribiendo en campos distintos. El Kickoff sí espera 700 ms antes de guardar: son dos criterios distintos en el mismo sistema |
| A4 | Prender la llave `FEATURE_PANEL` para todo el equipo **esconde la pestaña Equipo a los Gerentes** | Falla | `src/components/TopBar.tsx:43` (`hideWithFeature`) | Se pierde la administración de personas hasta apagar la llave global otra vez |
| A5 | Un Gerente puede **bajarse el rol a sí mismo** y dejar el sistema sin ningún Gerente | Falla | Ventana de miembro en `src/views/Equipo.tsx:313-346` (borrarse sí está bloqueado; cambiarse el rol no) | Se pierde el acceso a Panel, Equipo y llaves. Solo se recupera tocando la base a mano |
| A6 | Cualquiera puede **crear, renombrar y borrar un hito**, sin ningún control | Falla | `src/views/Hitos.tsx:49`, `:123`, `:130`; política `for all using (true)` en `supabase/migracion-hitos-backlog.sql:16-18` | Asimetría rara: alguien no puede desvincular una tarea ajena de un hito, pero sí borrar el hito entero |
| A7 | Los errores al guardar **no se le muestran a nadie**: van a la consola del navegador | Falla | `src/state/AppContext.tsx:83` | Si la base rechaza algo, la persona ve su cambio en pantalla y cree que se guardó |

## 2. Impacto medio

| # | Qué pasa | Tipo | Dónde | Efecto real |
|---|---|---|---|---|
| B1 | En el Kanban, el **semáforo de carga ignora los filtros** | Falla | `src/views/Kanban.tsx:62` cuenta sobre todas las tareas, no sobre las filtradas | Con un filtro puesto, las pastillas de la semana dicen un número y las columnas otro, sin aclaración |
| B2 | Al esconder las completadas en el Kanban **desaparece la columna "Completado"** | Decisión con efecto molesto | `src/views/Kanban.tsx:197` | Mientras está escondida no hay dónde soltar una tarjeta para completarla: hay que mostrarlas de nuevo o tildar la tarea en otra pantalla |
| B3 | Al reordenar la Agenda con filtros puestos, las posiciones se renumeran **contando solo lo que se ve** | Falla | `src/views/Agenda.tsx:157-166` | Las tareas escondidas quedan con posiciones que chocan; el orden del día puede cambiar solo al volver a mostrarlas |
| B4 | En el Kickoff, los **días de atraso se cuentan contra hoy**, no contra el lunes que se está mirando | Falla | `src/lib/kickoffData.ts:113` | Abrir un kickoff viejo muestra atrasos inflados respecto de los que se vieron ese día |
| B5 | Quien comparte una anotación en el Kickoff **no la ve en su propia pantalla** | Falla | `src/views/Kickoff.tsx:636` filtra por autor, no por visibilidad | Se comparte "a ciegas": no hay forma de confirmar que quedó compartida |
| B6 | Un hito vencido **sin tareas vinculadas no se pinta de rojo** | Falla | `src/views/Hitos.tsx:84` (`done < linked.length` da falso con cero tareas) | El hito más abandonado, el que no tiene ninguna tarea, es justo el que no avisa |
| B7 | En el CRM, la bitácora de la ficha se filtra **por el nombre** de la institución | Falla | `src/crm/Ficha.tsx:38` | Si se renombra una institución, su historial desaparece de la ficha (sigue guardado en la tabla) |
| B8 | En el Cuaderno, una carpeta madre **no muestra las notas de sus subcarpetas**, y no hay forma de mover una nota de carpeta | Falla | `src/views/Cuaderno.tsx:92` | Notas que se dan por perdidas; para reorganizar hay que crear la nota de nuevo |
| B9 | El interruptor "Necesita decisión del Gerente" aparece para todos, pero **queda apagado en tareas ajenas** | Decisión heredada | Está dentro del bloque de solo lectura: `src/components/TaskEditor.tsx:116`, `:216-242` | Si alguien ve trabada una tarea de otro, no puede marcarla: tiene que pedirle al responsable |
| B10 | En el CRM, marcar "hecha" **reemplaza la fecha por la de hoy** | Decisión (así era en la planilla) | `src/crm/reglas.ts:71` | Si el viernes se hizo la gestión y se tilda el lunes, queda con fecha del lunes. Se corrige editando la acción |
| B11 | La pestaña Venta del CRM **también muestra las ventas perdidas** | Decisión (copiada de la planilla) | `src/crm/CRM.tsx:72` | Se mezclan con las ventas en curso. Efecto lateral: elegir la etapa "CERRADO-GANADO" dentro de Venta nunca devuelve nada |

## 3. Latentes y detalles

| # | Qué pasa | Tipo | Dónde |
|---|---|---|---|
| C1 | `task_comments` no tiene política de actualización, pero el guardado usa `upsert` | Latente | `src/lib/supabaseApi.ts:517`. Hoy no molesta porque los comentarios no se editan |
| C2 | Volver a correr `migracion-comentarios.sql` **vuelve a prender los comentarios para todo el equipo** | Latente | `supabase/migracion-comentarios.sql:80` usa `do update set enabled = true`, contra lo que dice su propio comentario |
| C3 | Volver a correr `schema.sql` **desharía la adopción de perfiles** que instaló la migración de datos | Latente | `supabase/schema.sql:94-110` vs `supabase/migracion-datos.sql:18-49` |
| C4 | `tasks.importance` puede no tener su restricción de rango, según cómo se armó la base | Latente | Está en `supabase/schema.sql:49` pero no en las migraciones de fase 2 y 3 |
| C5 | En el CRM se guardan campos que **no se muestran en ninguna parte**: el enlace de una acción, el valor y las horas, las notas del contacto, el equipamiento de la institución | Latente | `src/crm/AccionEditor.tsx:193-200`, `src/crm/tipos.ts` |
| C6 | Crear o editar un contacto del CRM **no queda en la bitácora**; borrarlo sí | Detalle | `src/crm/CrmProvider.tsx:202-211` |
| C7 | En Mi Día, el tope de menciones se aplica después de juntar comentarios y descripciones | Detalle | `src/views/MiDia.tsx:91`: con muchas menciones en comentarios, las de descripciones no se ven |
| C8 | La pantalla Equipo sigue titulada "Panel del Gerente", igual que el módulo Panel | Detalle | `src/views/Equipo.tsx:80` |
| C9 | En el Cuaderno, el chinche de la lista y el de la barra del editor **no dejan la nota en el mismo lugar del orden** | Detalle | `src/views/Cuaderno.tsx:286` no re-estampa la fecha, `:426` sí |
| C10 | Una acción de minuta cuya tarea fue borrada vuelve a ofrecer "Convertir en tarea" | Detalle | Se puede duplicar sin darse cuenta |
| C11 | El Kanban de los pop-ups del Panel es de solo lectura: el tilde alterna pendiente y completada, no hay "En progreso" | Decisión | `src/components/TareasModal.tsx:34` |
| C12 | Código que quedó sin usar: `proximaDe()` y `etiquetaTipo()` en el CRM; los campos con nombre de "sugerencia de IA" en las minutas | Detalle | `src/crm/reglas.ts:43-47`, `:86-87` |
| C13 | `CrmContacto` es el único tipo del CRM sin fecha de creación, aunque la columna existe en la base | Detalle | `src/crm/tipos.ts:65-73` |
| C14 | Quedan inertes en la base la tabla `consejos` y las columnas de transcripción de minutas, del módulo de IA que se descartó | Decisión | No molestan; ocupan lugar y confunden al leer el esquema |
| C15 | Si a alguien le quitan el acceso al CRM mientras lo está usando, lo que ya tenía cargado queda en pantalla hasta que recargue | Detalle | `src/crm/CrmProvider.tsx`. La base ya no le deja traer nada nuevo |

## 4. Lo que sí se corrigió al documentar

| Qué | Dónde |
|---|---|
| El grupo de universidades del CRM decía "UNIVERSIDADS" | `src/crm/CRM.tsx` — arreglado, a la espera de publicarse |
| Un comentario de la migración del Panel decía que el interruptor "Necesita decisión del Gerente" dependía de la llave, cosa que dejó de ser cierta el 2026-09-22 | `supabase/migracion-panel-pm.sql` — comentario corregido |

## 5. Cómo seguir

No hay que arreglar todo. Una lectura posible:

1. **A1, A2, A4 y A5** tocan el manejo de personas y permisos: son las que pueden dejar el sistema
   en un estado del que cuesta salir.
2. **A3** (minutas que se pisan) se nota recién cuando dos personas escriben la misma minuta en
   vivo, que es justo lo que pasa en una reunión.
3. **A7** vale por sí sola: hoy, si algo no se guarda, nadie se entera.
4. El resto puede esperar a que moleste de verdad.
