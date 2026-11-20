# SRS · Transversal (cuenta, roles, llaves, tiempo real, comentarios, menciones)

| | |
|---|---|
| Código de módulo | MOD-TRV |
| Archivos de código | `src/App.tsx`, `src/views/Login.tsx`, `src/components/TopBar.tsx`, `src/state/AppContext.tsx`, `src/lib/api.ts`, `src/lib/supabaseClient.ts`, `src/lib/supabaseApi.ts`, `src/lib/localApi.ts`, `src/lib/menciones.ts`, `src/components/Menciones.tsx`, `src/components/Comments.tsx`, `src/components/Selectores.tsx` |
| Tablas que usa | `profiles`, `feature_flags`, `task_comments` (lectura: `auth.users` vía sesión, `crm_accesos`, y todas las demás a través de `load()`) |
| Quién lo ve | Todo el equipo. Las partes de Gerente están marcadas en cada requisito |
| Llave (feature flag) | Este módulo **define** el mecanismo de llaves. Los comentarios están detrás de `FEATURE_COMENTARIOS` |

## 1. Para qué sirve

Este documento describe lo que atraviesa a todos los módulos: cómo se entra al sistema, qué puede
hacer cada rol, cómo se prende una función nueva para una sola persona antes de abrirla al equipo,
cómo viaja un cambio de una computadora a otra sin recargar la página, cómo se navega entre pestañas
en la computadora y en el celular, y las tres piezas compartidas que aparecen adentro de casi
cualquier pantalla: los comentarios, las @menciones y los selectores de proyecto y de personas.

No es un módulo con pantalla propia. Es el piso sobre el que están paradas las otras doce. Si algo
de acá cambia, cambia en todos lados: por eso está escrito una vez y los demás documentos lo
referencian en vez de repetirlo.

Un día normal se ve así. La persona abre el sistema en el celular o en la computadora, ya está
conectada (la sesión queda guardada), y cae en Mi Día. Arriba tiene las pestañas que le
corresponden: si no es Gerente no ve el Panel, y si nadie le dio acceso al CRM la pestaña CRM ni
existe para ella. Comenta una tarea de otra persona escribiendo "@Male" y eligiendo de la lista que
aparece; Malena, del otro lado, ve el comentario aparecer sin refrescar nada y a la mañana siguiente
lo encuentra en el bloque "Te mencionaron" de su Mi Día. Cuando el Gerente General quiere probar
algo nuevo, prende la llave para él solo: el resto del equipo sigue viendo el sistema exactamente
igual que ayer.

## 2. Usuarios y permisos

Hay exactamente **dos roles**, guardados en `profiles.role` con un `check` que no admite otros
valores (`supabase/schema.sql:11`):

| Rol | En la pantalla se llama | Puede |
|---|---|---|
| `admin` | **Gerente** | Todo lo que puede un miembro, más: editar y borrar **cualquier** tarea (`src/lib/utils.ts:33`), borrar el comentario de cualquiera (`src/components/Comments.tsx:81`), ver la pestaña Panel (con la llave `FEATURE_PANEL`) o la pestaña Equipo (sin ella), administrar personas y roles, configurar el orden de los proyectos, dar y quitar acceso al CRM (`src/crm/AccesoCRM.tsx:45`), prender y apagar llaves (en la base y, para `FEATURE_KICKOFF`, desde la pantalla) |
| `member` | **Equipo** | Ver todas las tareas, proyectos, hitos y minutas del equipo. Crear tareas. Editar y borrar las tareas donde figura como responsable y las que no tienen responsable. Comentar cualquier tarea y borrar los comentarios propios. Tener su cuaderno privado y compartir notas. Dejar su briefing del kickoff y sus anotaciones privadas. Editar su propio perfil y su contraseña |

Lo que **nadie** puede:

- Cambiarse el rol a sí mismo desde la aplicación. El rol se edita desde Equipo o Panel, y esas
  pantallas son solo de Gerentes.
- Prender una llave global desde la aplicación. `FEATURE_COMENTARIOS` y `FEATURE_PANEL` se manejan
  en Supabase → Table Editor → `feature_flags`. La única llave con interruptor en pantalla es
  `FEATURE_KICKOFF`, y solo por persona (`src/views/Equipo.tsx:206-214`).
- Ver el briefing del kickoff de otra persona, ni sus anotaciones privadas, ni sus notas del
  cuaderno. Eso lo garantiza la base, no la pantalla (ver el documento del modelo de datos,
  sección 8).
- Ver nada del CRM sin estar en la lista `crm_accesos`. También lo garantiza la base.

Aviso importante, que vale para todo el sistema: **las políticas de `profiles`, `projects`, `tasks`,
`hitos` y `minutes` dejan leer y escribir a cualquier persona con sesión iniciada**
(`supabase/schema.sql:126-139`). Todas las reglas de "solo el responsable" o "solo el Gerente" que
se describen para esas tablas son barreras de la interfaz. Las tablas que sí están protegidas por la
base son las del cuaderno, las del kickoff, `feature_flags`, `consejos` y las seis del CRM. Está
detallado en el documento de requisitos no funcionales.

## 3. Datos que usa

### `profiles` — el perfil propio

| Campo (app) | Columna | Qué significa | De dónde sale |
|---|---|---|---|
| `id` | `id` | Identifica a la persona. Es el mismo id que su cuenta en `auth.users` | Lo copia el trigger `handle_new_user` al registrarse (`supabase/schema.sql:101-107`) |
| `name` | `name` | Su nombre. Es también el texto que se escribe después de la @ | Lo escribe en "Crear cuenta", y después lo puede cambiar en "Mi perfil" |
| `email` | `email` | Con qué correo entra | De la cuenta de Supabase. **No se puede cambiar desde el sistema** |
| `role` | `role` | `admin` (Gerente) o `member` (Equipo) | Lo pone el trigger al registrarse, y un Gerente lo puede cambiar desde Equipo o Panel |
| `color` | `color` | El color de su avatar cuando no tiene foto | Lo elige en "Mi perfil", de la paleta `USER_COLORS` (`src/lib/utils.ts:79`) |
| `avatarUrl` | `avatar_url` | El enlace a su foto | Lo pega en "Mi perfil". Si está vacío, se dibuja el círculo de color con sus iniciales |

### `feature_flags` — las llaves

| Campo (app) | Columna | Qué significa | De dónde sale |
|---|---|---|---|
| `id` | `id` | Identifica a la fila | La base, o `uid()` cuando la crea la app |
| `flag` | `flag` | El nombre de la llave | Las tres constantes de `src/types.ts:208-210` |
| `userId` | `user_id` | Para quién vale. **`null` = para todo el equipo** | La migración que siembra la llave, o el interruptor de Equipo |
| `enabled` | `enabled` | Prendida o apagada | Ídem |

### `task_comments` — los comentarios

| Campo (app) | Columna | Qué significa | De dónde sale |
|---|---|---|---|
| `id` | `id` | Identifica al comentario | `uid()` en `src/components/Comments.tsx:46` |
| `taskId` | `task_id` | Sobre qué tarea es | La tarea que está abierta |
| `userId` | `user_id` | Quién lo escribió | El usuario de la sesión. La base obliga a que sea uno mismo |
| `text` | `text` | El comentario. Las @menciones viven acá, como **texto plano** | El campo de texto del hilo |
| `createdAt` | `created_at` | Cuándo se escribió | La manda la app: `new Date().toISOString()` |

### Lo que no está en ninguna tabla

- **La sesión.** La maneja Supabase Auth (contraseñas, confirmación por correo, recuperación). El
  sistema nunca ve ni guarda una contraseña. En modo demo, "la sesión" es el id del perfil elegido,
  guardado en `localStorage` bajo `reeduca-session-v1` (`src/lib/localApi.ts:6` y `:262-270`).
- **Las menciones.** No hay tabla de menciones. Se reconocen leyendo el texto cada vez, comparando
  contra los nombres de `profiles` (`src/lib/menciones.ts:21-52`). La ventaja: lo que se ve es lo
  que se guarda. La desventaja está en la sección 9.

## 4. Requisitos funcionales

| ID | Requisito | Detalle / regla | Dónde vive |
|---|---|---|---|
| RF-TRV-01 | El sistema debe elegir solo dónde guardar los datos | Si existen las dos variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, usa Supabase; si falta alguna, arranca en modo demo con `localStorage`. No hay interruptor: es la presencia del archivo `.env` | `src/lib/supabaseClient.ts:3-8`, `src/lib/api.ts:46-47` |
| RF-TRV-02 | El sistema debe permitir iniciar sesión con email y contraseña | Formulario con los dos campos, botón "Iniciar sesión". Mientras espera, el botón dice "Un momento…" y queda deshabilitado | `src/views/Login.tsx:126-166`, `src/state/AppContext.tsx:307-310` |
| RF-TRV-03 | El sistema debe permitir crear una cuenta nueva | Pide nombre, email y contraseña de **6 caracteres como mínimo**. Al crearla avisa: "¡Cuenta creada! Revisá tu correo para confirmarla y después iniciá sesión." El nombre viaja en los metadatos de la cuenta para que el trigger lo use | `src/views/Login.tsx:111`, `:152`, `src/state/AppContext.tsx:312-319` |
| RF-TRV-04 | El sistema debe permitir recuperar la contraseña | Con solo el email. Avisa: "Te enviamos un enlace para recuperar tu contraseña. Revisá tu correo." El enlace vuelve a la dirección del sistema | `src/views/Login.tsx:114`, `src/state/AppContext.tsx:321-326` |
| RF-TRV-05 | El sistema debe crear el perfil automáticamente al registrarse | Un trigger de la base inserta la fila en `profiles` con el nombre de los metadatos (o la parte del email antes de la @) y el rol. **La primera persona que se registra queda Gerente**; el resto, Equipo | `supabase/schema.sql:94-114` |
| RF-TRV-06 | El sistema debe crear el perfil faltante al entrar, si no existe | Si la cuenta tiene sesión pero no tiene fila en `profiles` (por ejemplo, se registró antes de correr el SQL), la app la crea ahí mismo con un color de la paleta. Si no había ningún perfil, queda Gerente | `src/state/AppContext.tsx:196-209` |
| RF-TRV-07 | El sistema debe permitir entrar en modo demo eligiendo un perfil | En vez del formulario muestra una grilla de botones con los 5 perfiles de ejemplo, su avatar y su rol. No pide contraseña. Aclara que los datos se guardan en ese navegador | `src/views/Login.tsx:57-87`, `src/state/AppContext.tsx:302-305` |
| RF-TRV-08 | El sistema debe avisar en la pantalla de inicio cuando no pudo cargar los datos | Recuadro rojo "No se pudieron cargar los datos" con el mensaje técnico y la pista: verificar haber corrido `supabase/schema.sql` en el SQL Editor | `src/views/Login.tsx:35-43`, `src/state/AppContext.tsx:212-215` |
| RF-TRV-09 | El sistema debe permitir a cada persona editar su propio perfil | Ventana "Mi perfil" desde el avatar de arriba a la derecha: nombre, color (paleta de círculos) y foto por URL. El email y el rol **no** se pueden editar acá | `src/components/TopBar.tsx:176-240` |
| RF-TRV-10 | El sistema debe permitir a cada persona cambiar su contraseña | Campo "Nueva contraseña (opcional)" en la misma ventana: vacío = no se cambia. Solo aparece con Supabase conectado; en demo no existe | `src/components/TopBar.tsx:218-228`, `src/state/AppContext.tsx:328-331` |
| RF-TRV-11 | El sistema debe permitir cerrar sesión | Opción roja "Cerrar sesión" en el menú del avatar. Con Supabase cierra la sesión de Auth; en demo borra la clave `reeduca-session-v1` | `src/components/TopBar.tsx:133-138`, `src/state/AppContext.tsx:333-340` |
| RF-TRV-12 | El sistema debe mostrar quién está conectado y con qué rol | El menú del avatar muestra nombre, email y una pastilla con "GERENTE" o "EQUIPO" | `src/components/TopBar.tsx:117-123` |
| RF-TRV-13 | El sistema debe resolver si una llave está prendida para una persona | Función `hasFlag(llave, persona?)`. Sin el segundo dato, usa al usuario conectado. Aplica RN-TRV-01 | `src/state/AppContext.tsx:290-296` |
| RF-TRV-14 | El sistema debe tener tres llaves | `FEATURE_KICKOFF` (pestaña Kickoff), `FEATURE_COMENTARIOS` (comentarios en tareas) y `FEATURE_PANEL` (pestaña Panel para Gerentes). Son constantes en el código: agregar una llave nueva es agregar una constante | `src/types.ts:208-210` |
| RF-TRV-15 | El sistema debe permitir a un Gerente prender el Kickoff para una persona | Pastilla "Beta ON / Beta OFF" al lado de cada miembro en Equipo y al pie del Panel. Solo aparece si el propio Gerente tiene la llave prendida | `src/views/Equipo.tsx:206-214`, `:253-269` |
| RF-TRV-16 | El sistema debe guardar una sola fila por llave y persona | Antes de guardar busca si ya existe una fila con ese `flag` y ese `userId` y reusa su `id`. En la base, además, el guardado usa `onConflict: 'flag,user_id'` y hay una restricción `unique nulls not distinct` | `src/state/AppContext.tsx:478-484`, `src/lib/supabaseApi.ts:509`, `supabase/migracion-kickoff-1-llave.sql:17` |
| RF-TRV-17 | El sistema debe volver a Mi Día si la pestaña que se está viendo deja de estar disponible | Si se apaga la llave (o se pierde el acceso al CRM) mientras alguien está en Kickoff, Panel o CRM, la vista cae a Mi Día en vez de quedar en blanco | `src/App.tsx:44-50` |
| RF-TRV-18 | El sistema debe aplicar al instante los cambios que hace otra persona | Un solo canal escucha las 14 tablas que no son del CRM; el CRM tiene el suyo con las 6 tablas `crm_*`. Un alta o una edición se agrega o reemplaza en la lista; un borrado la saca | `src/state/AppContext.tsx:224-258`, `src/lib/supabaseApi.ts:342-357`, `src/crm/CrmProvider.tsx:72-98` |
| RF-TRV-19 | El sistema debe conservar los campos grandes que el aviso de tiempo real no trae | Si el aviso no incluye `links`, `checklist`, `description`, `assignee_ids`, `content`, `shared_with`, `actions`, `summary`, `participant_ids` o `transcripcion`, se mantiene el valor que ya estaba en pantalla en vez de vaciarlo | `src/state/AppContext.tsx:109-126`, `:243-247` |
| RF-TRV-20 | El sistema debe mostrar el cambio en la pantalla antes de guardarlo | Cada `upsert…` o `remove…` actualiza primero el estado local y después llama a la base. La pantalla nunca "espera" a la red | `src/state/AppContext.tsx:342-346` y análogos hasta `:547` |
| RF-TRV-21 | El sistema debe registrar en la consola los errores de guardado sin cortar el uso | Si la base rechaza un guardado, se escribe `[ReEduca] Error guardando datos:` en la consola del navegador. La pantalla sigue mostrando el cambio | `src/state/AppContext.tsx:83`, `src/crm/CrmProvider.tsx:13` |
| RF-TRV-22 | El sistema debe estampar solo las fechas de completado y de espera de decisión | Al pasar una tarea a "Completado" le pone `completedAt`; al sacarla de ese estado se lo borra. Igual con `necesitaDecisionDesde` cuando se marca o se desmarca "necesita decisión". Está centralizado para cubrir el editor, los checkboxes y el arrastre del Kanban | `src/state/AppContext.tsx:91-104` |
| RF-TRV-23 | El sistema debe permitir volver a traer todo de la base a pedido | Función `reload()`, que usa el botón "Actualizar" del Panel | `src/state/AppContext.tsx:298-300` |
| RF-TRV-24 | El sistema debe mostrar en la computadora una barra superior con las pestañas | Logo a la izquierda, pestañas al centro, "+ Nueva" y avatar a la derecha. Las pestañas muestran solo el ícono en pantallas medianas y el ícono con el texto en pantallas grandes. Oculta en celular | `src/components/TopBar.tsx:63-111` |
| RF-TRV-25 | El sistema debe mostrar en el celular una barra inferior con las mismas pestañas | Barra fija abajo, con ícono y nombre chico, desplazable en horizontal si no entran, y respetando el borde inferior de los teléfonos con muesca. Oculta en computadora | `src/components/TopBar.tsx:149-174` |
| RF-TRV-26 | El sistema debe mostrar cada pestaña solo a quien corresponde | Se aplica RN-TRV-02. El mismo filtro se usa en las dos barras, así que nunca se contradicen | `src/components/TopBar.tsx:72-78` y `:154-160`, `src/components/TopBar.tsx:32-44` |
| RF-TRV-27 | El sistema debe tener un botón "+ Nueva" siempre a la vista | En la barra superior, en las dos plataformas. Abre la ventana de tarea nueva con la fecha de hoy puesta | `src/components/TopBar.tsx:102-107`, `src/App.tsx:67` |
| RF-TRV-28 | El sistema debe avisar cuando corre en modo demo | Pastilla ámbar "Modo demo" en la barra superior (solo en pantallas grandes), con una explicación al pasar el mouse | `src/components/TopBar.tsx:94-101` |
| RF-TRV-29 | El sistema debe permitir comentar cualquier tarea | Hilo al pie de la ventana de la tarea, con el aviso "Los ve todo el equipo. Podés comentar aunque la tarea no sea tuya." Comentar **no** requiere poder editar la tarea. Solo aparece con la llave `FEATURE_COMENTARIOS` y en tareas ya guardadas | `src/components/Comments.tsx:36-117`, `src/components/TaskEditor.tsx:348` |
| RF-TRV-30 | El sistema debe ordenar los comentarios del más viejo al más nuevo y mostrar cuánto tiempo pasó | Ordena por fecha de creación. Muestra el tiempo en palabras y en español ("hace 3 horas") | `src/components/Comments.tsx:39-41`, `:73-75` |
| RF-TRV-31 | El sistema debe permitir borrar un comentario al autor o a un Gerente | El botón del tachito aparece solo en esos dos casos, con la confirmación "¿Borrar este comentario?". El título del botón aclara si se borra como autor o como Gerente | `src/components/Comments.tsx:50-52`, `:81-89` |
| RF-TRV-32 | El sistema **no** debe permitir editar un comentario | Es una decisión, no un olvido: no hay botón de editar y la base no tiene política de `update` para `task_comments`. Los comentarios se borran, no se corrigen | `supabase/migracion-comentarios.sql:62` |
| RF-TRV-33 | El sistema debe mostrar en la tarjeta de la tarea cuántos comentarios tiene | Pastilla "💬 N". No se dibuja nada si la tarea no tiene comentarios o si la llave está apagada | `src/components/Comments.tsx:16-29` |
| RF-TRV-34 | El sistema debe ofrecer la lista del equipo al escribir "@" | Al tipear la @, aparece la lista "Mencionar a…" con hasta 7 personas, filtrando por lo que se sigue escribiendo. Se elige con las flechas y Enter (o Tab), con un toque en el celular, y se cierra con Escape. Inserta `@Nombre ` con el espacio incluido | `src/components/Menciones.tsx:61-187` |
| RF-TRV-35 | El sistema debe ofrecer las menciones en los comentarios y en la descripción de las tareas | El mismo campo se usa en los dos lugares. En el comentario, de una línea, Enter envía; en la descripción, de varias líneas, Enter hace salto de línea | `src/components/Comments.tsx:97-105`, `src/components/TaskEditor.tsx:249` |
| RF-TRV-36 | El sistema debe resaltar las menciones en el texto ya guardado | Las menciones se pintan con fondo celeste, y **la propia en ámbar**, para que salte a la vista. Al pasar el mouse muestra el nombre completo | `src/components/Menciones.tsx:8-41` |
| RF-TRV-37 | El sistema debe mostrarle a cada uno dónde lo mencionaron | Bloque "Te mencionaron" en Mi Día, con dos fuentes: comentarios de otras personas y descripciones de tareas abiertas. Cada fila dice quién y hace cuánto, y al tocarla abre la tarea. Si no hay menciones, el bloque no existe | `src/views/MiDia.tsx:74-92`, `:211-256` |
| RF-TRV-38 | El sistema debe ofrecer un selector de proyecto con los colores | Desplegable con el color de cada proyecto, en el orden que configuró el Gerente, con tilde en el elegido. Si no hay proyectos avisa "Todavía no hay proyectos." | `src/components/Selectores.tsx:39-100` |
| RF-TRV-39 | El sistema debe ofrecer un selector de varias personas | Desplegable con casilla por persona, avatar, "(vos)" al lado del propio nombre y un contador "N elegidos" con botón "Listo". Muestra un buscador solo si el equipo tiene más de 6 personas | `src/components/Selectores.tsx:106-227` |
| RF-TRV-40 | El sistema debe ofrecer un selector de una sola persona | Versión compacta para usar adentro de una fila, con la opción de dejarlo vacío ("Sin responsable") | `src/components/Selectores.tsx:233-305` |
| RF-TRV-41 | El sistema debe cerrar los desplegables con un clic afuera o con Escape | Vale para los tres selectores. También escucha el toque en el celular | `src/components/Selectores.tsx:9-30` |
| RF-TRV-42 | El sistema debe seguir funcionando contra una base que no corrió las migraciones nuevas | Al cargar, las 8 tablas nuevas se traen con control de error: si no existen, la lista queda vacía y la app anda igual. Las 6 tablas del CRM hacen lo mismo | `src/lib/supabaseApi.ts:378-386`, `src/crm/crmApi.ts:196-201` |
| RF-TRV-43 | El sistema debe reintentar el guardado sin las columnas que la base todavía no tiene | Si el error menciona `completed_at`, `necesita_decision_gg` o `necesita_decision_desde`, reintenta con `sinColumnasNuevas`. Hay el mismo reintento para `projects.position`, `notes.shared_with` y las tres columnas de transcripción de `minutes` | `src/lib/supabaseApi.ts:55-60`, `:405-422`, `:430-434`, `:454-458`, `:475-483` |

## 5. Reglas de negocio y cálculos

**RN-TRV-01 · La llave: la fila de la persona gana sobre la global.**
Para saber si una llave está prendida para alguien:

1. Buscar una fila con ese `flag` **y** el `userId` de esa persona. Si existe, **manda esa**, prendida
   o apagada.
2. Si no existe, buscar la fila global (`userId = null`) y usar su valor.
3. Si tampoco existe, la llave está **apagada**.

`src/state/AppContext.tsx:290-296`. Consecuencia útil: si la fila global está prendida y se quiere
apagar para una sola persona, alcanza con crearle su fila apagada.

**RN-TRV-02 · Qué pestañas ve cada persona.**
Una pestaña se muestra si se cumplen las cuatro condiciones (`src/components/TopBar.tsx:72-78`):

1. No es exclusiva de Gerentes, **o** la persona es Gerente.
2. No exige llave, **o** esa llave está prendida para ella.
3. No se oculta con una llave, **o** esa llave está apagada.
4. No es del CRM, **o** la persona está en la lista de acceso al CRM.

Aplicado a las 11 pestañas de `src/components/TopBar.tsx:32-44`:

| Pestaña | Se ve si… |
|---|---|
| Mi Día, Agenda, Kanban, Hitos, Minutas, Cuaderno, Proyectos | Siempre (7 pestañas para todos) |
| Kickoff | `FEATURE_KICKOFF` prendida para esa persona |
| CRM | Está en `crm_accesos` |
| Panel | Es Gerente **y** `FEATURE_PANEL` prendida |
| Equipo | Es Gerente **y** `FEATURE_PANEL` apagada |

Las dos últimas son excluyentes a propósito: cuando el Panel está prendido, Equipo desaparece del
menú porque la gestión de personas vive adentro del Panel (`src/views/Panel.tsx:510`, que reusa el
mismo bloque `MiembrosEquipo` de la pestaña Equipo).

**RN-TRV-03 · El primero que se registra es el Gerente.**
El trigger pregunta si la tabla `profiles` está vacía: si lo está, el rol es `admin`; si no, `member`
(`supabase/schema.sql:106`). La "autocuración" de la app aplica la misma regla
(`src/state/AppContext.tsx:204`).

**RN-TRV-04 · Quién puede editar una tarea.**
Un Gerente, siempre. Cualquier otra persona, solo si está entre los responsables, o si la tarea
todavía no tiene ninguno (`canEditTask`, `src/lib/utils.ts:32-36`). El detalle está en el documento
del módulo Tareas; se repite acá porque es la regla de permisos más usada del sistema.

**RN-TRV-05 · Cómo se reconoce una mención.**
Las menciones se guardan como **texto plano**, así que se reconocen leyendo el texto
(`src/lib/menciones.ts:21-52`), con estas reglas:

1. Se comparan los nombres **sin tildes y en minúsculas**, para que "@alvaro" encuentre a "Álvaro".
2. Gana el **nombre completo más largo**: "@Luciana Gomez" antes que "@Luciana".
3. El **primer nombre** solo cuenta si es único en el equipo. Si hubiera dos Malenas, "@Malena" no
   menciona a nadie.
4. Una @ **pegada a una letra o a un número no cuenta**: así un email escrito en el texto no se
   convierte en mención.
5. Después del nombre no puede venir una letra ni un número: "@Ana" no menciona a Ana dentro de
   "@Anabel".

**RN-TRV-06 · Qué entra en "Te mencionaron".**
Se juntan dos listas y se muestran las **primeras 8** (`src/views/MiDia.tsx:74-92`):

1. **Comentarios**: los que mencionan a la persona, escritos por **otra** persona, de los **últimos
   14 días**, ordenados del más nuevo al más viejo. Solo si `FEATURE_COMENTARIOS` está prendida.
2. **Descripciones de tareas**: las de las tareas que **no** están completadas y cuya descripción la
   menciona. Sin ventana de tiempo y sin depender de ninguna llave.

Los comentarios van siempre primero que las descripciones.

**RN-TRV-07 · Si dos personas editan a la vez, gana el último que guardó.**
No hay bloqueo ni aviso de conflicto. Cada guardado es un `upsert` de la **fila completa**, así que
sobrescribe todo lo que la otra persona hubiera cambiado en esa misma fila. Un segundo después, el
aviso de tiempo real le muestra a la primera persona el valor de la segunda, y su pantalla "salta".
Las dos excepciones en las que esto está resuelto de verdad:

- Los campos grandes que no vienen en el aviso no se pisan con un vacío (RF-TRV-19).
- Las filas con clave única de dos columnas se actualizan en vez de duplicarse: `feature_flags` por
  `(flag, user_id)` y `kickoff_briefings` por `(kickoff_id, usuario_id)`
  (`src/lib/supabaseApi.ts:509` y `:543`). Sin eso, dos dispositivos creando el briefing del mismo
  lunes generarían dos filas.

**RN-TRV-08 · El orden de los proyectos es uno solo para todo el equipo.**
Se ordena por `position` de menor a mayor y, cuando empatan, alfabéticamente con las reglas del
español (`localeCompare(…, 'es')`, `src/state/AppContext.tsx:263-267`). Mientras nadie configure el
orden, todos valen 0 y la lista sale alfabética. Ese orden se usa en todas las listas de proyectos
del sistema, incluido el selector.

**RN-TRV-09 · En los selectores de personas, uno mismo va primero.**
Se ordena poniendo al usuario conectado arriba y dejando el resto como venía
(`src/components/Selectores.tsx:161-165`), y se le agrega la marca "(vos)".

## 6. Pantalla y comportamiento

### Antes de entrar

Mientras la app resuelve la sesión y trae los datos, ocupa toda la pantalla un círculo girando con
el texto "Cargando…" (`src/App.tsx:52-61`). Si no hay nadie conectado, aparece la pantalla de inicio
(`src/App.tsx:63`): fondo azul en degradé con dos tramas geométricas, el logo blanco, el título
"Gestión de Equipo" y, abajo, **o** la grilla de perfiles del modo demo **o** el formulario de email
y contraseña. El formulario tiene tres estados que se cambian con los enlaces de abajo: iniciar
sesión, crear cuenta y recuperar contraseña. Los errores salen en rojo y los avisos de éxito en
verde, arriba del botón.

### Barra superior (computadora)

De izquierda a derecha: logo de ReEduca con la pastilla "EQUIPO", las pestañas al centro, y a la
derecha la pastilla "Modo demo" (si corresponde), el botón azul "+ Nueva" y el avatar. Las pestañas
muestran solo el ícono entre 768 y 1024 píxeles de ancho, y el ícono con el texto más arriba de eso.
La pestaña activa se pinta de azul con texto blanco.

Al tocar el avatar se abre un menú de 240 píxeles con el nombre, el email, la pastilla del rol, y
dos opciones: "Editar mi perfil" y "Cerrar sesión" (esta última en rojo). Se cierra tocando afuera.

### Barra inferior (celular)

Debajo de 768 píxeles de ancho, las pestañas del centro desaparecen de arriba y aparecen abajo, en
una barra fija con fondo blanco semitransparente y desenfoque. Cada pestaña es un ícono de 19
píxeles con el nombre en letra muy chica. Si no entran todas, la barra se desplaza en horizontal (sin
barra de desplazamiento visible). El contenido de la página reserva el espacio de esa barra más el
borde seguro del teléfono, para que nada quede tapado (`src/App.tsx:68`).

### Ventana "Mi perfil"

Cuatro campos: nombre, color (una fila de círculos, el elegido con un anillo alrededor), foto por
URL y, solo con Supabase, "Nueva contraseña (opcional)" con el aviso "Dejar vacío para no cambiarla".
Abajo, "Cancelar" y "Guardar". Si el cambio de contraseña falla, el mensaje de error aparece en rojo
sobre los botones y la ventana **no** se cierra.

### Hilo de comentarios

Va al pie de la ventana de la tarea, en un recuadro gris. Título "💬 Comentarios (N)" y el aviso de
quién los ve. Cada comentario es una burbuja blanca con el avatar del autor a la izquierda, el nombre
en negrita, el tiempo relativo en gris claro y el texto con las menciones resaltadas. El tachito
aparece a la derecha: en la computadora, solo al pasar el mouse por encima; en el celular, siempre
visible. Abajo, el avatar propio, el campo "Escribí un comentario… (con @ mencionás a alguien)" y el
botón azul de enviar, que está apagado mientras el campo esté vacío.

La lista de personas para mencionar se abre **hacia arriba** en el hilo de comentarios (porque está
al fondo de la ventana) y **hacia abajo** en la descripción de la tarea
(`src/components/Comments.tsx:101`).

### Estados vacíos, de carga y de error

| Situación | Qué se ve |
|---|---|
| Cargando la sesión o los datos | Círculo girando con "Cargando…" en toda la pantalla |
| Sin sesión | La pantalla de inicio |
| Falló la carga de datos | Recuadro rojo en la pantalla de inicio con el mensaje técnico y la pista del `schema.sql` |
| Falló un guardado | **Nada en la pantalla.** El error va a la consola del navegador. El cambio se queda visible aunque no se haya guardado |
| Tarea sin comentarios | El bloque de comentarios se muestra igual, con el título "Comentarios" sin número, listo para escribir. La pastilla de la tarjeta no se dibuja |
| Nadie te mencionó | El bloque "Te mencionaron" no existe |
| No hay proyectos | "Todavía no hay proyectos." en el selector |
| Nadie coincide con la búsqueda de personas | "Nadie con ese nombre." |

## 7. Casos límite y errores

| Situación | Qué pasa hoy |
|---|---|
| Se pierde internet mientras alguien trabaja | La pantalla sigue respondiendo (los cambios son optimistas) pero nada se guarda. Solo queda el error en la consola. **Al recargar se pierde lo que no llegó a la base** |
| Dos personas editan la misma tarea al mismo tiempo | Gana el último que guardó, sin aviso (RN-TRV-07). La pantalla del primero se actualiza sola con el valor del segundo |
| Dos dispositivos crean el briefing del mismo lunes | No se duplica: la clave única `(kickoff_id, usuario_id)` y el `onConflict` del guardado lo convierten en una actualización (`src/lib/supabaseApi.ts:543`) |
| La base no corrió una migración nueva | La tabla que falta queda como lista vacía y la columna que falta se omite al guardar (RF-TRV-42 y RF-TRV-43). La función asociada se comporta como antes de existir, en vez de romperse |
| La base no corrió **nada** | La carga falla de entrada y se ve el recuadro rojo con la pista del `schema.sql` (`src/views/Login.tsx:39-41`) |
| Alguien se registró antes de correr el SQL | Al entrar, la app le crea el perfil (RF-TRV-06) |
| Se borra a una persona que tenía tareas asignadas | En la pantalla desaparece de los responsables, pero con Supabase su id **queda** dentro de `tasks.assignee_ids` en la base: `deleteUser` borra solo la fila de `profiles` (`src/lib/supabaseApi.ts:448-450`). En modo demo sí se limpia de verdad |
| Se borra a una persona que había comentado | El comentario queda y se firma "Alguien" (`src/components/Comments.tsx:72`) |
| El cambio de contraseña falla (por ejemplo, muy corta) | El nombre, el color y la foto **ya se guardaron** antes del intento (`src/components/TopBar.tsx:185-192`); la ventana queda abierta con el error en rojo |
| Se apaga una llave mientras alguien está en esa pestaña | La vista cae a Mi Día en el próximo dibujado, porque la llave llega por tiempo real (RF-TRV-17) |
| Un Gerente se apaga a sí mismo la llave del Kickoff | Pierde la pestaña. La recupera volviendo a correr `supabase/migracion-kickoff-1-llave.sql`, que es idempotente y siembra la llave prendida para el Gerente General. El propio botón lo avisa al pasar el mouse (`src/views/Equipo.tsx:257-258`) |
| Un Gerente se quita a sí mismo el acceso al CRM | Se le pide confirmación explícita: "Si te quitás el acceso, dejás de ver el CRM. ¿Seguro?" (`src/crm/AccesoCRM.tsx:18`) |
| Alguien escribe "@" en un email adentro de un comentario | No se convierte en mención: la @ está pegada a una letra (RN-TRV-05, punto 4) |
| Alguien renombra su perfil después de que lo mencionaron | **Las menciones viejas dejan de reconocerse.** El texto sigue diciendo el nombre anterior, y la comparación se hace contra el nombre actual |
| Los datos del modo demo quedan corruptos | Se vuelve a sembrar todo desde cero, sin aviso (`src/lib/localApi.ts:51-56`) |
| Se abre el sistema en dos pestañas del mismo navegador, en modo demo | La segunda pestaña se actualiza cuando la primera guarda algo, escuchando el evento `storage` (`src/state/AppContext.tsx:157-163`) |

## 8. Criterios de aceptación

Pruebas manuales. Cada una se puede hacer sin saber programar. Las que dicen "con Supabase" no se
pueden hacer en modo demo.

| ID | Prueba | Resultado esperado |
|---|---|---|
| CA-TRV-01 | Con Supabase: entrar con email y contraseña correctos | Entra y cae en Mi Día, con su nombre en el saludo |
| CA-TRV-02 | Con Supabase: entrar con la contraseña equivocada | No entra. Aparece un mensaje de error en rojo abajo del campo de contraseña |
| CA-TRV-03 | Con Supabase: tocar "Crear cuenta" y poner una contraseña de 4 caracteres | El navegador no deja enviar el formulario: exige 6 como mínimo |
| CA-TRV-04 | Con Supabase: tocar "Olvidé mi contraseña", poner el email propio y enviar | Aparece en verde "Te enviamos un enlace para recuperar tu contraseña. Revisá tu correo." y llega el correo |
| CA-TRV-05 | En modo demo: abrir el sistema sin haber entrado nunca | Aparecen los 5 perfiles de ejemplo como botones; tocando uno se entra sin contraseña |
| CA-TRV-06 | Tocar el avatar de arriba a la derecha | Se abre el menú con el nombre, el email y la pastilla "GERENTE" o "EQUIPO" según corresponda |
| CA-TRV-07 | En "Editar mi perfil", cambiar el color y guardar | El avatar cambia de color al instante en toda la pantalla, y sigue cambiado después de recargar |
| CA-TRV-08 | Con Supabase: en "Editar mi perfil", escribir una contraseña nueva de 6 caracteres y guardar | La ventana se cierra. Al cerrar sesión y volver a entrar, funciona la contraseña nueva |
| CA-TRV-09 | Tocar "Cerrar sesión" | Vuelve a la pantalla de inicio. Al recargar la página sigue afuera |
| CA-TRV-10 | Entrar con una cuenta que **no** sea Gerente | En el menú de pestañas **no** aparecen ni Panel ni Equipo |
| CA-TRV-11 | Entrar con una cuenta sin acceso al CRM | **No** aparece la pestaña CRM. Tampoco aparecen acciones del CRM en la Agenda |
| CA-TRV-12 | Entrar con una cuenta sin `FEATURE_KICKOFF` | **No** aparece la pestaña Kickoff |
| CA-TRV-13 | Como Gerente con el Kickoff prendido, ir a Equipo (o al pie del Panel) y tocar "Beta OFF" en un miembro | La pastilla pasa a "Beta ON". Esa persona, en su propia sesión, ve aparecer la pestaña Kickoff **sin recargar** |
| CA-TRV-14 | Apagarle la llave del Kickoff a alguien que en ese momento está mirando la pestaña Kickoff | Su pantalla pasa sola a Mi Día. No queda en blanco ni tira error |
| CA-TRV-15 | Abrir el sistema en dos computadoras con dos personas distintas. Una crea una tarea | La tarea aparece en la otra computadora en unos segundos, sin recargar |
| CA-TRV-16 | Con las dos abiertas, una cambia el título de una tarea y la otra, al mismo tiempo, le agrega un enlace | Queda lo que guardó la última. **El enlace no debe quedar vacío por el cambio de título de la otra** |
| CA-TRV-17 | Achicar la ventana del navegador a ancho de celular (o abrir en el teléfono) | Las pestañas del centro desaparecen de arriba y aparecen en una barra abajo, con las mismas pestañas |
| CA-TRV-18 | En el celular, con muchas pestañas visibles | La barra de abajo se puede desplazar con el dedo hacia los costados, y ninguna pestaña queda cortada por el borde inferior del teléfono |
| CA-TRV-19 | Abrir una tarea que no es propia y escribir un comentario | Se guarda y aparece en el hilo, aunque los campos de la tarea estén en solo lectura |
| CA-TRV-20 | Escribir "@" en el comentario y después las primeras letras de un nombre | Aparece la lista "Mencionar a…" filtrada. Con la flecha abajo y Enter se elige, y el texto queda con `@Nombre ` |
| CA-TRV-21 | Enviar un comentario que menciona a otra persona y mirar el comentario ya guardado | El `@Nombre` queda resaltado en celeste |
| CA-TRV-22 | Que otra persona te mencione en un comentario, y después abrir Mi Día | Aparece el bloque "Te mencionaron" con esa fila, diciendo quién y hace cuánto. Al tocarla se abre la tarea |
| CA-TRV-23 | Mencionarse a uno mismo en un comentario propio | **No** aparece en "Te mencionaron" (solo cuentan los comentarios de otros), pero el resaltado propio se ve en ámbar |
| CA-TRV-24 | Borrar un comentario propio | Pide confirmación y desaparece. Desaparece también en la pantalla de las otras personas |
| CA-TRV-25 | Como Gerente, borrar el comentario de otra persona | El tachito está disponible y dice "Borrar comentario (Gerente)". Se borra |
| CA-TRV-26 | Como miembro, mirar el comentario de otra persona | **No** hay tachito |
| CA-TRV-27 | Apagar la llave `FEATURE_COMENTARIOS` en Supabase → `feature_flags` (fila global en `false`, y sin fila propia prendida) | Desaparecen el hilo de comentarios de la ventana de la tarea y las pastillas "💬 N" de las tarjetas. Los comentarios **no** se borran: vuelven al prenderla |
| CA-TRV-28 | Abrir el selector de proyecto en una tarea nueva | Los proyectos salen con su color, en el orden configurado por el Gerente, y el elegido tiene un tilde |
| CA-TRV-29 | Abrir el selector de responsables | Uno mismo aparece primero, con "(vos)". Se pueden marcar varios y el contador de abajo dice cuántos |
| CA-TRV-30 | Con un equipo de más de 6 personas, abrir el selector de responsables | Arriba aparece el buscador "Buscar persona…". Con menos de 7, no aparece |
| CA-TRV-31 | Con cualquier desplegable abierto, tocar afuera o apretar Escape | Se cierra sin cambiar nada |
| CA-TRV-32 | Poner mal la clave de Supabase en el `.env` y abrir el sistema | Aparece el recuadro rojo "No se pudieron cargar los datos" con la pista de correr `supabase/schema.sql` |

## 9. Limitaciones conocidas y pendientes

Lo que hoy **no** hace, verificado en el código:

1. **No hay avisos.** Nadie recibe un correo, un mensaje ni una notificación del navegador cuando lo
   mencionan o le comentan una tarea. La única manera de enterarse es abrir el sistema y mirar "Te
   mencionaron". Es una decisión explícita, escrita en el código: "Así el mencionado se entera sin
   avisos" (`src/views/MiDia.tsx:71-72`).
2. **Las menciones se rompen si alguien se cambia el nombre.** Al guardarse como texto plano y
   compararse contra el nombre actual, una mención vieja deja de reconocerse (y de resaltarse, y de
   aparecer en "Te mencionaron") si esa persona se renombró. No hay migración ni aviso.
3. **Una mención a alguien con un primer nombre repetido no funciona.** Si dos personas del equipo
   comparten el primer nombre, hay que escribir el nombre completo (RN-TRV-05, punto 3).
4. **Un guardado que falla no se le avisa a la persona.** Queda en la consola del navegador
   (`src/state/AppContext.tsx:83`). En la pantalla el cambio se ve aplicado aunque no se haya
   guardado, y se pierde al recargar. No hay reintento automático ni cola de pendientes.
5. **No hay resolución de conflictos.** Si dos personas editan la misma fila, gana la última y la
   otra no se entera de que perdió su cambio (RN-TRV-07).
6. **No se puede editar un comentario.** Solo borrarlo y escribir otro (RF-TRV-32).
7. **No hay hilos ni respuestas en los comentarios.** Es una lista plana por tarea.
8. **No hay comentarios en nada que no sea una tarea.** Ni en minutas, ni en notas, ni en hitos, ni
   en el CRM.
9. **Las llaves globales solo se prenden desde Supabase.** `FEATURE_COMENTARIOS` y `FEATURE_PANEL`
   no tienen interruptor en la aplicación: hay que entrar a Supabase → Table Editor →
   `feature_flags`. Solo `FEATURE_KICKOFF` se maneja desde la pantalla, y solo por persona
   (`src/views/Equipo.tsx:206-214`).
10. **Volver a correr `supabase/migracion-comentarios.sql` vuelve a prender los comentarios para
    todos.** La línea `:80` usa `on conflict … do update set enabled = true` sobre la fila global,
    así que deshace un apagado hecho a mano. Está anotado en el documento del modelo de datos,
    sección 11.
11. **El email no se puede cambiar desde el sistema.** Ni el propio ni el de otra persona: hay que
    hacerlo en Supabase → Authentication.
12. **Borrar una persona no la saca de las tareas en la base.** Solo se limpia en la pantalla
    (`src/lib/supabaseApi.ts:448-450`). El modo demo sí lo hace bien
    (`src/lib/localApi.ts:115-120`).
13. **Los mensajes de error de la cuenta vienen de Supabase, en inglés.** `loginEmail`,
    `signUpEmail`, `resetPassword` y `changePassword` devuelven el texto tal cual
    (`src/state/AppContext.tsx:307-331`), así que el equipo puede leer cosas como
    "Invalid login credentials".
14. **No hay registro de auditoría fuera del CRM.** Quién cambió qué y cuándo se guarda solo para el
    CRM, en `crm_bitacora`. Para las tareas, las notas o las minutas no existe.
15. **La sesión no se cierra sola.** No hay tiempo de inactividad ni cierre automático: mientras la
    sesión de Supabase siga válida, quien abra ese navegador entra.
16. **La protección real de la base cubre solo parte de las tablas.** `profiles`, `projects`,
    `tasks`, `hitos` y `minutes` están abiertas a cualquier persona con sesión iniciada
    (`supabase/schema.sql:126-139`): las reglas de edición de esas tablas son de la interfaz. Está
    desarrollado en el documento de requisitos no funcionales.
