# SRS · CRM de instituciones

| | |
|---|---|
| Código de módulo | MOD-CRM |
| Archivos de código | `src/crm/CRM.tsx`, `src/crm/CrmProvider.tsx`, `src/crm/contexto.ts`, `src/crm/crmApi.ts`, `src/crm/tipos.ts`, `src/crm/reglas.ts`, `src/crm/estilo.ts`, `src/crm/BloqueAccion.tsx`, `src/crm/ChipAccion.tsx`, `src/crm/AccionEditor.tsx`, `src/crm/Ficha.tsx`, `src/crm/NuevaInstitucion.tsx`, `src/crm/NuevaOportunidad.tsx`, `src/crm/ElegirInstitucion.tsx`, `src/crm/OpcionesTipo.tsx`, `src/crm/AgendaCRM.tsx`, `src/crm/AccesoCRM.tsx`, `supabase/migracion-crm-1-esquema.sql` |
| Tablas que usa | `crm_accesos`, `crm_instituciones`, `crm_oportunidades`, `crm_contactos`, `crm_interacciones`, `crm_bitacora` (lee `profiles` solo desde la base, para saber quién es Gerente) |
| Quién lo ve | Lista de acceso al CRM (tabla `crm_accesos`). Los Gerentes administran la lista, pero un Gerente que no esté en la lista tampoco ve el CRM |
| Llave (feature flag) | Ninguna. El "candado" del CRM no es una llave del sistema: es la lista de acceso `crm_accesos`, con reglas de seguridad en la base de datos |

## 1. Para qué sirve

El CRM es el seguimiento comercial de ReEduca con las instituciones educativas: colegios,
universidades y academias. Reemplaza dentro del sistema a la planilla "Lu · Venta" que se usaba
antes, y mantiene a propósito su aspecto y su lógica: cada venta con toda su **cadena de acciones**
al costado, los colores del semáforo (verde hecha, naranja pendiente, rojo vencida) y los
desplegables por urgencia. La paleta y la tipografía están aparte, en `src/crm/estilo.ts:3`, para
que la pantalla se parezca a la planilla aunque el resto del sistema use otro estilo.

Un día normal se usa así: se entra a la pestaña **CRM**, se mira el desplegable "Esta semana" o
"Vencidas", y se va tocando cada bloque de acción para marcarlo como hecho, cambiarle la fecha o
cargar la siguiente gestión. Cuando una institución avanza, se le cambia la **etapa** desde la misma
fila (de "CONTACTO INICIAL" a "PROPUESTA ENVIADA", por ejemplo) y cuando se cierra, pasa a
"CERRADO-GANADO": desde ese momento deja de aparecer en Venta y aparece en Posventa como cliente.
Todo lo que se toca queda anotado en la **bitácora**, con quién lo hizo, cuándo y qué cambió.

Además de las ventas, el CRM guarda la **ficha** de cada institución (datos, contactos, historial de
gestiones y bitácora), las **invitaciones a la LNR** (Liga Nacional de Robótica, que se llevan aparte
de la venta) y la marca de **objetivo 2027**, que es la lista de instituciones a insistir para que
arranquen en 2027. Las acciones con fecha también aparecen en la **Agenda semanal**, en un bloque
propio, para que quien vende vea en un solo lugar sus tareas del sistema y sus gestiones del CRM.

## 2. Usuarios y permisos

El CRM es el único módulo del sistema con acceso por lista nominal. No alcanza con ser Gerente ni con
tener una llave prendida: hay que estar en la tabla `crm_accesos`.

| Quién | Qué puede hacer |
|---|---|
| Persona **en la lista de acceso** | Ve la pestaña CRM y todo su contenido. Crea y edita instituciones, oportunidades, contactos y acciones; mueve y borra acciones; ve la bitácora. Ve las acciones del CRM en su Agenda |
| Persona **fuera de la lista** | No ve la pestaña CRM ni las acciones del CRM en la Agenda. La base de datos tampoco le entrega ninguna fila del CRM, aunque intente consultarla por fuera de la pantalla |
| **Gerente** (rol `admin`) | Es el único que puede dar y quitar acceso, desde "Configuración · Acceso al CRM" (`src/crm/AccesoCRM.tsx:45`, dentro de `src/components/ConfiguracionGerente.tsx:65`, que se muestra en `src/views/Panel.tsx:507` y en `src/views/Equipo.tsx:189`). Si el Gerente no está en la lista, administra el acceso pero no ve el CRM |

Reglas de edición:

- **No hay dueño de la fila.** Cualquiera con acceso edita cualquier institución, oportunidad o
  acción, incluso las de otra persona. Los responsables de una acción son informativos (sirven para
  filtrar la Agenda y para la bitácora), no limitan quién edita.
- **Quitarse el acceso a uno mismo se puede**, pero pide confirmación con un aviso distinto
  (`src/crm/AccesoCRM.tsx:17`); quitarle el acceso a otra persona también pide confirmación
  (`src/crm/AccesoCRM.tsx:18`).
- **La pantalla y la base dicen lo mismo.** La pestaña se esconde en
  `src/components/TopBar.tsx:72-77` (computadora) y `src/components/TopBar.tsx:154-159` (celular), y
  si alguien fuerza la vista `crm` sin acceso, `src/App.tsx:45-50` lo devuelve a Mi Día. Eso es la
  cortesía; el candado real está en la base (ver sección 5, RN-CRM-16).

## 3. Datos que usa

Las seis tablas se crean en `supabase/migracion-crm-1-esquema.sql`, con prefijo `crm_` para no
chocar con las del resto del sistema. Los tipos de TypeScript son el espejo de esas tablas
(`src/crm/tipos.ts`) y la traducción entre nombres de columna y nombres del código vive en
`src/crm/crmApi.ts:43-180`.

### `crm_accesos` — la lista de acceso (`supabase/migracion-crm-1-esquema.sql:17-21`)

| Campo | Qué significa | De dónde sale |
|---|---|---|
| `user_id` | La persona que tiene acceso al CRM. Es la clave de la tabla: una fila por persona | El Gerente la agrega desde Configuración · Acceso al CRM (`src/crm/CrmProvider.tsx:241-245`) |
| `otorgado_por` | Quién le dio el acceso | El id de quien tocó el interruptor |
| `created_at` | Cuándo se le dio | La base (`now()`) |

### `crm_instituciones` (`supabase/migracion-crm-1-esquema.sql:49-64`, tipo en `src/crm/tipos.ts:34-49`)

| Campo | Qué significa | De dónde sale |
|---|---|---|
| `codigo` | El ID que la institución tenía en la planilla (I001…). Único | Viene de la migración; el alta desde el sistema lo deja vacío (`src/crm/NuevaInstitucion.tsx:25`) |
| `nombre` | Nombre de la institución. Es lo que se busca y lo que se muestra en todas las listas | Alta o edición de datos (`src/crm/Ficha.tsx:373-375`) |
| `segmento` | `Colegio`, `Universidad` o `Academia` (`src/crm/tipos.ts:18`) | Alta o edición |
| `ciudad`, `direccion` | Dónde está | Alta (ciudad) y edición de datos (dirección) |
| `en_lnr` | Si participa en la Liga Nacional de Robótica | Casilla en la edición de datos (`src/crm/Ficha.tsx:393`) |
| `eq_intelliq`, `eq_v5`, `eq_universo` | Cantidad de equipos por línea de producto | Solo desde la migración: hoy no hay pantalla que los cargue |
| `activo` | Marca de actividad que traía la planilla | Solo desde la migración |
| `drive_url` | Carpeta de Drive de la institución | Edición de datos (`src/crm/Ficha.tsx:390`) |
| `especial` | Seguimiento especial. Se marca con la estrella y hace que la institución suba al principio de las listas | Botón "Especial" en la ficha (`src/crm/Ficha.tsx:59`) |
| `created_at` | Cuándo se creó | La app manda la fecha del alta |

### `crm_oportunidades` — una venta concreta (`supabase/migracion-crm-1-esquema.sql:69-84`, tipo en `src/crm/tipos.ts:51-63`)

| Campo | Qué significa | De dónde sale |
|---|---|---|
| `institucion_id` | De qué institución es la venta. Si se borra la institución, se borran sus oportunidades (`on delete cascade`) | Alta |
| `modalidad` | `Curricular`, `Extracurricular` o vacío (`src/crm/tipos.ts:17`) | Desplegable de la fila (`src/crm/CRM.tsx:356-360`) o de la ficha |
| `producto` | Producto o ciclos vendidos (texto libre) | Solo el alta de oportunidad (`src/crm/NuevaOportunidad.tsx:104-106`) |
| `etapa` | La etapa del embudo. La base solo acepta las ocho etapas de la lista (`supabase/migracion-crm-1-esquema.sql:75-77`) | Desplegable de la fila o de la ficha |
| `valor` | Monto de la venta | Ninguna pantalla lo carga hoy: queda siempre vacío |
| `estado_posventa` | Para los clientes ganados: `ACTIVO`, `ACTIVO-LNR`, `EN STAND BY`, `INACTIVO` (`src/crm/tipos.ts:14`) | Desplegable de la pestaña Posventa o de la ficha |
| `objetivo_2027` | Si es una institución a insistir para 2027 | Botón 🎯 de la fila (`src/crm/CRM.tsx:348-348`) o casilla de la ficha |
| `responsable_ids` | Quiénes llevan la venta | Alta de oportunidad |
| `created_at` | Cuándo se creó | La app |

**No existe una columna "venta / posventa / perdida"**: se deduce de la etapa (RN-CRM-01).

### `crm_contactos` (`supabase/migracion-crm-1-esquema.sql:87-97`, tipo en `src/crm/tipos.ts:65-73`)

| Campo | Qué significa | De dónde sale |
|---|---|---|
| `institucion_id` | De qué institución es el contacto | La ficha donde se carga |
| `nombre` | Nombre de la persona. Obligatorio para poder guardar (`src/crm/Ficha.tsx:353`) | Pestaña Contactos de la ficha |
| `rol` | Dirección, Administración, etc. | Pestaña Contactos |
| `telefono`, `mail` | Datos de contacto. Se muestran como enlaces para llamar o escribir | Pestaña Contactos |
| `notas` | Notas del contacto | Se guarda vacío: no hay campo en la pantalla |

### `crm_interacciones` — las acciones (`supabase/migracion-crm-1-esquema.sql:102-118`, tipo en `src/crm/tipos.ts:76-90`)

Es la tabla más usada del módulo: cada gestión que se hizo o que hay que hacer.

| Campo | Qué significa | De dónde sale |
|---|---|---|
| `institucion_id` | A qué institución pertenece la gestión | Editor de acción |
| `oportunidad_id` | De qué venta es parte. Puede quedar vacío ("sin venta asociada"); si se borra la oportunidad, queda vacío (`on delete set null`) | Editor de acción (`src/crm/AccionEditor.tsx:115-126`) |
| `es_lnr` | Invitación a la Liga: va aparte de la venta y de la posventa | Editor de acción, opción "Invitación a la Liga (LNR)" |
| `orden` | El número correlativo que tenía la planilla. Ordena la cadena | Se calcula al crear o al mover (RN-CRM-08) |
| `accion` | Qué hay que hacer o qué se hizo. Obligatorio para guardar (`src/crm/AccionEditor.tsx:216`) | Editor de acción |
| `fecha` | Día de la gestión (`YYYY-MM-DD`). Puede quedar vacía | Editor de acción o el campo de fecha del bloque |
| `responsable_ids` | Quién la hace | Editor de acción; por defecto, quien la crea |
| `estado` | `PENDIENTE`, `EN PROCESO` o `CONCRETADO`. La base solo acepta esos tres (`supabase/migracion-crm-1-esquema.sql:111`) | Editor de acción o el botón "✓ hecha" |
| `tipo` | Tipo de acción (`llamada`, `mensaje`, `mail`, `reunion`, `flyer`, `presupuesto`, `lnr`, `respuesta`, `teavisamos`, `otro`) | Desplegable del bloque o del editor; en el alta de oportunidad se adivina por el texto (RN-CRM-10) |
| `horas` | Horas dedicadas | Ninguna pantalla lo carga hoy |
| `link` | Enlace a la propuesta, presupuesto o mail | Editor de acción (`src/crm/AccionEditor.tsx:193-200`). Se guarda pero hoy no se muestra en ninguna parte |
| `created_at` | Cuándo se creó | La app |

### `crm_bitacora` — quién cambió qué (`supabase/migracion-crm-1-esquema.sql:121-132`, tipo en `src/crm/tipos.ts:92-102`)

| Campo | Qué significa | De dónde sale |
|---|---|---|
| `fecha_hora` | Momento exacto del cambio | La app, al anotar (`src/crm/CrmProvider.tsx:117`) |
| `usuario_id`, `usuario` | Quién lo hizo (id y nombre guardado como texto, para que se lea siempre) | La sesión actual (`src/crm/CrmProvider.tsx:118-119`) |
| `cambio` | El verbo: `Creó`, `Editó`, `Hecha`, `Movió`, `Borró`, `Etapa`, `Creó institución`, `Editó institución`, `Creó oportunidad`, `Editó oportunidad`, `Borró contacto` | RN-CRM-13 |
| `institucion` | Nombre de la institución, **guardado como texto** (no el id) | `src/crm/CrmProvider.tsx:106` |
| `venta_mod` | De qué venta era: `venta`, `posventa`, `perdida` o `LNR`, con la modalidad (ej. `venta · Curricular`) | RN-CRM-14 |
| `accion` | El texto de la acción tocada (vacío si el cambio fue de la institución o de la oportunidad) | La app |
| `detalle` | El resumen campo por campo de lo que cambió | RN-CRM-12 y RF-CRM-46 |

## 4. Requisitos funcionales

| ID | Requisito | Detalle / regla | Dónde vive |
|---|---|---|---|
| RF-CRM-01 | El sistema debe mostrar la pestaña **CRM** solo a quien esté en la lista de acceso | En la barra de arriba y en la de abajo del celular. Quien no está en la lista no ve la pestaña | `src/components/TopBar.tsx:41`, `src/components/TopBar.tsx:72-77`, `src/components/TopBar.tsx:154-159` |
| RF-CRM-02 | El sistema debe devolver a Mi Día a quien intente abrir el CRM sin acceso | Aunque el estado interno quede en `crm`, la vista que se dibuja es Mi Día | `src/App.tsx:45-50` |
| RF-CRM-03 | El sistema debe cargar primero **solo la lista de acceso** y recién después, si hay acceso, el resto del CRM | La lista es chica y la necesita todo el mundo (para decidir si se muestra la pestaña). Sin acceso, el estado queda vacío | `src/crm/CrmProvider.tsx:31-46`, `src/crm/crmApi.ts:204-206` |
| RF-CRM-04 | El sistema debe cargar los datos del CRM sin recargar la página si alguien le da acceso a la persona mientras está adentro | Al pasar `tieneAcceso` a verdadero, se dispara la carga completa una sola vez | `src/crm/CrmProvider.tsx:50-59` |
| RF-CRM-05 | La base de datos debe hacer cumplir el acceso, no solo la pantalla | Reglas de seguridad por fila (RLS) en las cinco tablas de datos, con la función `crm_tiene_acceso()` | `supabase/migracion-crm-1-esquema.sql:135-160`, `supabase/migracion-crm-1-esquema.sql:25-28` |
| RF-CRM-06 | Solo un Gerente debe poder dar o quitar acceso | La base lo exige con `crm_es_gerente()` (rol `admin` en `profiles`); la pantalla además deshabilita los interruptores | `supabase/migracion-crm-1-esquema.sql:30-33`, `supabase/migracion-crm-1-esquema.sql:41-46`, `src/crm/AccesoCRM.tsx:45` |
| RF-CRM-07 | El sistema debe permitir que todo el equipo **vea la lista de acceso** (quién tiene acceso), sin ver nada del contenido | Es lo que necesita la app para decidir si muestra la pestaña | `supabase/migracion-crm-1-esquema.sql:37-39` |
| RF-CRM-08 | El sistema debe pedir confirmación antes de quitar un acceso | Un aviso distinto si es el propio acceso ("dejás de ver el CRM") y otro si es de otra persona | `src/crm/AccesoCRM.tsx:15-20` |
| RF-CRM-09 | El sistema debe mostrar los cambios de otra persona al instante, sin recargar | Canal de tiempo real sobre las seis tablas del CRM; incluye los cambios de la propia lista de acceso | `src/crm/CrmProvider.tsx:72-98`, `src/crm/crmApi.ts:183-190`, `supabase/migracion-crm-1-esquema.sql:162-168` |
| RF-CRM-10 | El CRM debe tener cuatro pestañas: **Venta**, **Posventa**, **🎯 2027** e **Instituciones** | Arranca siempre en Venta | `src/crm/CRM.tsx:16-21`, `src/crm/CRM.tsx:50` |
| RF-CRM-11 | El sistema debe repartir las oportunidades entre las pestañas según la etapa | Posventa: solo `CERRADO-GANADO`. Venta: todo lo que no sea `CERRADO-GANADO`. 2027: las marcadas como objetivo 2027 | `src/crm/CRM.tsx:70-76` |
| RF-CRM-12 | El sistema debe permitir filtrar por **segmento** (Todas, Colegios, Universidades, Academias) | Un chip por segmento, en el pipeline y en el directorio | `src/crm/CRM.tsx:29-34`, `src/crm/CRM.tsx:114-120` |
| RF-CRM-13 | El sistema debe permitir filtrar por **etapa** con los chips de colores | Incluye "Todas las etapas". No se muestra en Posventa (ahí la etapa es siempre la misma) | `src/crm/CRM.tsx:139-151` |
| RF-CRM-14 | El sistema debe permitir **buscar por nombre de institución** | Sin distinguir tildes ni mayúsculas, por coincidencia parcial | `src/crm/CRM.tsx:69`, `src/crm/CRM.tsx:75`, `src/lib/menciones.ts:4` |
| RF-CRM-15 | El sistema debe agrupar las oportunidades en cuatro desplegables por urgencia: **Todas las instituciones**, **Esta semana**, **Futuras** y **Vencidas** | Cada uno con su contador y su color. Arrancan abiertos "Todas" y "Esta semana" | `src/crm/CRM.tsx:271-286` |
| RF-CRM-16 | Los desplegables **no deben ser excluyentes**: una oportunidad aparece en todos los que le correspondan | Una venta con una acción atrasada y otra para el jueves aparece en "Vencidas" y en "Esta semana" | `src/crm/CRM.tsx:250-253`, `src/crm/reglas.ts:58-68` |
| RF-CRM-17 | El desplegable "Todas las instituciones" debe mostrar las filas **agrupadas por segmento**, con un título por grupo y su cantidad | Orden de los grupos: COLEGIOS, UNIVERSIDADS, ACADEMIAS, SIN SEGMENTO. Solo se muestran los grupos con filas | `src/crm/CRM.tsx:241`, `src/crm/CRM.tsx:261-277` |
| RF-CRM-18 | El sistema debe recordar en el navegador qué desplegables quedaron abiertos | Uno por pestaña y por desplegable (`crm-panel-venta-vencidas`, etc.) | `src/crm/CRM.tsx:218`, `src/lib/usePref.ts:4-14` |
| RF-CRM-19 | Cada fila debe mostrar la institución con su **modalidad**, su **objetivo 2027** y su **etapa** (o su estado de posventa) a la izquierda, y toda la **cadena de acciones** a la derecha | La estrella ⭐ marca el seguimiento especial | `src/crm/CRM.tsx:304-405` |
| RF-CRM-20 | El sistema debe permitir cambiar la modalidad, la etapa, el estado de posventa y el objetivo 2027 desde la misma fila, sin abrir ninguna ventana | Cada cambio se guarda solo y queda en la bitácora | `src/crm/CRM.tsx:348-388` |
| RF-CRM-21 | En la pestaña Posventa, en lugar de la etapa se debe mostrar el **estado de posventa** | Con la opción "🩺 sin clasificar" cuando está vacío, y conservando un valor viejo que no esté en la lista | `src/crm/CRM.tsx:367-374` |
| RF-CRM-22 | La cadena de acciones debe arrancar mostrando el final (lo pendiente) y poder deslizarse de costado | Lo viejo queda a la izquierda | `src/crm/CRM.tsx:311-308`, `src/crm/CRM.tsx:397-394` |
| RF-CRM-23 | Cada fila debe tener un botón **"+ acción"** al final de la cadena | Abre el editor con la institución y la oportunidad ya puestas | `src/crm/CRM.tsx:401-401` |
| RF-CRM-24 | Tocar el nombre de la institución debe abrir su **ficha** | Desde el pipeline, desde el directorio y desde el editor de acción | `src/crm/CRM.tsx:344-341`, `src/crm/CRM.tsx:466-462`, `src/crm/AccionEditor.tsx:89-102` |
| RF-CRM-25 | Cada acción debe mostrarse como un bloque con el color del semáforo: **verde** hecha, **naranja** pendiente, **rojo** vencida | Borde izquierdo y fondo del color; la leyenda de colores está arriba del pipeline | `src/crm/BloqueAccion.tsx:19-20`, `src/crm/BloqueAccion.tsx:45`, `src/crm/reglas.ts:24-28`, `src/crm/CRM.tsx:156` |
| RF-CRM-26 | Cada bloque debe mostrar el texto de la acción, el **ícono del tipo**, la fecha (o "sin fecha"), los primeros nombres de los responsables y el estado | La fecha se escribe en criollo: `2 nov 2026` | `src/crm/BloqueAccion.tsx:47-53`, `src/crm/estilo.ts:42-46`, `src/crm/estilo.ts:49-53` |
| RF-CRM-27 | Tocar un bloque debe abrir su **edición rápida**: "✓ hecha", "✏️ editar", cambiar la fecha y cambiar el tipo | Se abre y se cierra tocando el bloque; también con Enter o espacio desde el teclado. Los controles de adentro no lo cierran | `src/crm/BloqueAccion.tsx:34-40`, `src/crm/BloqueAccion.tsx:55-101` |
| RF-CRM-28 | El botón **"✓ hecha"** debe marcar la acción como `CONCRETADO` y ponerle la **fecha de hoy** | No aparece si la acción ya está hecha | `src/crm/BloqueAccion.tsx:59-68`, `src/crm/reglas.ts:71`, `src/crm/CrmProvider.tsx:215-217` |
| RF-CRM-29 | El campo de fecha de la edición rápida debe guardar solo cuando la fecha está completa | Mientras se tipea el año pasa por valores inválidos (0002, 0020…); solo se acepta `20xx-xx-xx` | `src/crm/BloqueAccion.tsx:82-85` |
| RF-CRM-30 | En computadora, el sistema debe permitir **arrastrar una acción y soltarla sobre otra institución** para moverla | El destino se resalta con un borde punteado mientras se arrastra. El bloque no se puede arrastrar si tiene la edición rápida abierta | `src/crm/BloqueAccion.tsx:26-33`, `src/crm/CRM.tsx:316-333`, `src/crm/estilo.ts:56` |
| RF-CRM-31 | En celular, donde no se puede arrastrar, el sistema debe permitir mover la acción desde el **editor**, con el botón "Mover a otra institución" | El aviso de arrastrar solo se muestra en pantallas grandes | `src/crm/AccionEditor.tsx:128-144`, `src/crm/CRM.tsx:155` |
| RF-CRM-32 | Antes de guardar un movimiento desde el editor, el sistema debe avisar de dónde a dónde va la acción | Cartel amarillo con el nombre de las dos instituciones | `src/crm/AccionEditor.tsx:145-149` |
| RF-CRM-33 | El editor de acción debe permitir crear o editar una acción con: texto, a qué venta pertenece, fecha, tipo, estado, responsables y enlace | Se abre desde el pipeline, la ficha o la Agenda | `src/crm/AccionEditor.tsx:20`, `src/crm/AccionEditor.tsx:104-200` |
| RF-CRM-34 | En una acción nueva, el sistema debe proponer: la oportunidad de la fila (o la primera venta no perdida), la fecha de **hoy**, estado `PENDIENTE`, tipo `llamada` y como responsable a quien la está creando | Si se abre como invitación LNR, arranca sin oportunidad y con tipo `lnr` | `src/crm/AccionEditor.tsx:28-46` |
| RF-CRM-35 | El campo "Es parte de" debe permitir elegir entre las ventas de esa institución, **"Invitación a la Liga (LNR)"** o **"Sin venta asociada"** | Cada venta se lista como Venta / Posventa / Venta perdida, con su modalidad y su etapa | `src/crm/AccionEditor.tsx:115-126`, `src/crm/AccionEditor.tsx:70-72` |
| RF-CRM-36 | El sistema no debe permitir guardar una acción sin texto | El botón "Guardar" queda apagado; al guardar, se le quitan los espacios sobrantes al texto y al enlace | `src/crm/AccionEditor.tsx:74-77`, `src/crm/AccionEditor.tsx:216` |
| RF-CRM-37 | El sistema debe permitir borrar una acción, con confirmación y avisando que queda en la bitácora | Solo en acciones ya existentes | `src/crm/AccionEditor.tsx:79-84`, `src/crm/CrmProvider.tsx:229-239` |
| RF-CRM-38 | El tipo de acción debe elegirse de una lista **agrupada**: "Contacto nuestro", "LNR (aparte de ventas)" y "Respuesta del colegio" | Si el dato guardado no está en la lista (por ejemplo, viene de la planilla), se conserva como opción extra | `src/crm/OpcionesTipo.tsx:3-7`, `src/crm/OpcionesTipo.tsx:13` |
| RF-CRM-39 | El sistema debe permitir dar de alta una institución con nombre, segmento y ciudad, y **opcionalmente su primera oportunidad** en "CONTACTO INICIAL" | La casilla viene marcada; si se deja marcada, se pide la modalidad | `src/crm/NuevaInstitucion.tsx:21-35`, `src/crm/NuevaInstitucion.tsx:60-74` |
| RF-CRM-40 | Al dar de alta una institución, el sistema debe avisar si ya existe una con el mismo nombre | Compara sin tildes ni mayúsculas. Es un aviso: no bloquea el alta | `src/crm/NuevaInstitucion.tsx:19`, `src/crm/NuevaInstitucion.tsx:43-47` |
| RF-CRM-41 | Al crear una institución, el sistema debe abrir su ficha enseguida | Para seguir cargando contactos y acciones sin buscarla | `src/crm/CrmProvider.tsx:262-270` |
| RF-CRM-42 | El sistema debe permitir dar de alta una oportunidad eligiendo institución, tipo (venta o posventa), modalidad, producto, etapa, responsables y objetivo 2027 | La institución es obligatoria: sin ella el botón "Crear oportunidad" queda apagado | `src/crm/NuevaOportunidad.tsx:39-74`, `src/crm/NuevaOportunidad.tsx:149-155` |
| RF-CRM-43 | En un alta de tipo "venta", el sistema debe permitir cargar la **próxima acción** con su fecha, y crearla junto con la oportunidad | Si el texto queda vacío, no se crea ninguna acción | `src/crm/NuevaOportunidad.tsx:56-72`, `src/crm/NuevaOportunidad.tsx:117-124` |
| RF-CRM-44 | En un alta de tipo "posventa", el sistema debe guardar la oportunidad como `CERRADO-GANADO` con su estado de posventa | Por defecto `ACTIVO` | `src/crm/NuevaOportunidad.tsx:48-50`, `src/crm/NuevaOportunidad.tsx:126-134` |
| RF-CRM-45 | El alta de oportunidad debe avisar si esa institución ya tiene una venta parecida | Misma modalidad y mismo tipo (venta/posventa). Es un aviso: no bloquea | `src/crm/NuevaOportunidad.tsx:35-37`, `src/crm/NuevaOportunidad.tsx:98-102` |
| RF-CRM-46 | El buscador de institución debe mostrar hasta 8 coincidencias por nombre, ordenadas alfabéticamente | Enter elige la primera, Escape cierra la lista, y si no hay ninguna avisa que se cree con "Nueva institución" | `src/crm/ElegirInstitucion.tsx:24-30`, `src/crm/ElegirInstitucion.tsx:57-63`, `src/crm/ElegirInstitucion.tsx:85` |
| RF-CRM-47 | La pestaña **Instituciones** debe mostrar el directorio completo de fichas, con segmento, ciudad, etiquetas y la fecha de la última gestión hecha | Etiquetas: "venta N" (ventas abiertas), "cliente" (tiene posventa) y "LNR" | `src/crm/CRM.tsx:415-486` |
| RF-CRM-48 | La **ficha** de una institución debe tener cuatro pestañas con su contador: Ventas, Contactos, Historial y Bitácora | Arranca en Ventas | `src/crm/Ficha.tsx:40-45`, `src/crm/Ficha.tsx:88-101` |
| RF-CRM-49 | La ficha debe mostrar en el encabezado segmento, ciudad y código, la marca "En la LNR", el botón de **seguimiento especial**, el enlace a la carpeta de Drive (si hay) y el botón "Datos" | El botón de Drive abre en otra pestaña | `src/crm/Ficha.tsx:52-84` |
| RF-CRM-50 | La ficha debe permitir editar los datos de la institución: nombre, segmento, ciudad, dirección, carpeta de Drive y participación en la LNR | Si el nombre se deja vacío, se conserva el anterior | `src/crm/Ficha.tsx:367-411`, `src/crm/Ficha.tsx:402` |
| RF-CRM-51 | La pestaña Ventas de la ficha debe mostrar una tarjeta por oportunidad, con su tipo, modalidad, etapa, estado de posventa, objetivo 2027 y su cadena de acciones | Orden: primero las ventas, después las posventas, al final las perdidas | `src/crm/Ficha.tsx:33`, `src/crm/Ficha.tsx:209-268` |
| RF-CRM-52 | La pestaña Ventas debe permitir crear una oportunidad rápida (solo modalidad) en "CONTACTO INICIAL" | Sin salir de la ficha | `src/crm/Ficha.tsx:270-309` |
| RF-CRM-53 | La ficha debe mostrar las **invitaciones a la LNR** en un bloque aparte, con su botón para agregar una | Ordenadas por fecha. Si no hay, dice "Sin invitaciones registradas." | `src/crm/Ficha.tsx:110-121`, `src/crm/Ficha.tsx:35` |
| RF-CRM-54 | La ficha debe mostrar un bloque "Acciones sin venta asociada" cuando haya acciones sueltas | Son las que no son LNR y no cuelgan de ninguna oportunidad de esa institución | `src/crm/Ficha.tsx:36`, `src/crm/Ficha.tsx:123-128` |
| RF-CRM-55 | La pestaña Contactos debe permitir cargar contactos (nombre, rol, teléfono, mail) y borrarlos con confirmación | El teléfono queda como enlace para llamar y el mail para escribir. El nombre es obligatorio | `src/crm/Ficha.tsx:311-365` |
| RF-CRM-56 | La pestaña Historial debe listar **todas** las acciones de la institución, de la más nueva a la más vieja, con su punto de color, su fecha, su tipo y de qué venta era | Tocar una la abre en el editor | `src/crm/Ficha.tsx:134-173` |
| RF-CRM-57 | La pestaña Bitácora debe mostrar los últimos 60 movimientos de esa institución, con fecha, hora, quién, el verbo del cambio y el detalle | Si no hay, dice "Sin cambios registrados." | `src/crm/Ficha.tsx:175-191` |
| RF-CRM-58 | La **Agenda semanal** debe mostrar las acciones del CRM de cada día en un bloque propio, marcado "CRM" | Con la cantidad y cuántas están pendientes. Se despliega solo si el día tiene 3 o menos | `src/crm/AgendaCRM.tsx:12-28`, `src/views/Agenda.tsx:278`, `src/views/Agenda.tsx:299` |
| RF-CRM-59 | En la Agenda, cada acción del CRM debe mostrar el nombre de la institución y el texto de la acción, con su punto de color, y permitir abrirla o marcarla como hecha | Las hechas se muestran tachadas | `src/crm/AgendaCRM.tsx:31-54` |
| RF-CRM-60 | La Agenda debe mostrar las acciones del CRM solo a quien tiene acceso, y respetar sus filtros | Se esconden si hay un filtro de proyecto activo (las acciones no pertenecen a un proyecto); el filtro de personas se aplica sobre los responsables; "ocultar completadas" también las oculta | `src/views/Agenda.tsx:84-96` |
| RF-CRM-61 | La Agenda debe tener un interruptor "CRM" para ocultar ese bloque, que se recuerda en el navegador | Solo se muestra a quien tiene acceso | `src/views/Agenda.tsx:64`, `src/views/Agenda.tsx:228` |
| RF-CRM-62 | El sistema debe anotar en la **bitácora** cada creación, edición, movimiento o borrado del CRM | Con quién, cuándo, la institución, de qué venta era, la acción y el detalle | `src/crm/CrmProvider.tsx:112-122` |
| RF-CRM-63 | Al editar una acción, el detalle de la bitácora debe decir **campo por campo** qué cambió, con el valor de antes y el de después | Texto, fecha, estado, tipo, responsables y cambio de institución o de venta | `src/crm/CrmProvider.tsx:126-139` |
| RF-CRM-64 | Si al editar una acción no cambió nada, el sistema no debe anotar nada | Evita llenar la bitácora de líneas vacías | `src/crm/CrmProvider.tsx:149-150` |
| RF-CRM-65 | La bitácora no debe poder editarse ni borrarse | La base solo permite leerla e insertar filas nuevas | `supabase/migracion-crm-1-esquema.sql:154-160` |
| RF-CRM-66 | Todo cambio debe verse en la pantalla al instante y guardarse en la base en segundo plano | Si el guardado falla, el error queda en la consola del navegador; la pantalla no avisa | `src/crm/CrmProvider.tsx:13`, `src/crm/CrmProvider.tsx:141-144` |
| RF-CRM-67 | En **modo demo** el CRM debe funcionar con datos inventados guardados en el navegador | Cuatro instituciones, cinco oportunidades, nueve acciones y tres accesos, todos marcados "(demo)" | `src/crm/crmApi.ts:258-306`, `src/crm/crmApi.ts:368` |
| RF-CRM-68 | En modo demo, si se cambia el CRM en otra pestaña del navegador, esta se debe enterar | Escucha el evento de almacenamiento del navegador | `src/crm/CrmProvider.tsx:62-69` |
| RF-CRM-69 | Si las tablas del CRM todavía no existen (no se corrió el SQL), el sistema debe mostrarse vacío en lugar de romperse | Cada lectura que falla devuelve una lista vacía | `src/crm/crmApi.ts:196-201` |
| RF-CRM-70 | Mientras carga, el CRM debe mostrar "Cargando el CRM…" | Después muestra el pipeline | `src/crm/CRM.tsx:66` |

## 5. Reglas de negocio y cálculos

**RN-CRM-01 · Venta, posventa o perdida se deducen de la etapa.** No hay columna que lo guarde
(`src/crm/reglas.ts:10-14`):

- etapa `CERRADO-GANADO` → **posventa** (es un cliente).
- etapa `CERRADO-NO GANADO` → **perdida**.
- cualquier otra de las seis etapas → **venta** en curso.

**RN-CRM-02 · Las ocho etapas del embudo**, en orden (`src/crm/tipos.ts:3-11`): CONTACTO INICIAL ·
EN SEGUIMIENTO · LLEVAR PROPUESTA FÍSICA · P.FÍSICA ENTREGADA · PROPUESTA ENVIADA · EN
REVISIÓN/AJUSTE · CERRADO-GANADO · CERRADO-NO GANADO. La base rechaza cualquier otra
(`supabase/migracion-crm-1-esquema.sql:75-77`). Cada una tiene su color fijo
(`src/crm/estilo.ts:21-31`).

**RN-CRM-03 · El semáforo de una acción** (`src/crm/reglas.ts:18-21`):

| Estado de la acción | Semáforo | Color |
|---|---|---|
| `CONCRETADO` | hecha | verde `#48A859` |
| `PENDIENTE` o `EN PROCESO`, con fecha anterior a hoy | vencida | rojo `#C63A2B` |
| `PENDIENTE` o `EN PROCESO`, con fecha de hoy, futura o sin fecha | pendiente | naranja `#F39221` |

Una acción sin fecha nunca es "vencida".

**RN-CRM-04 · Orden de la cadena de acciones** (`src/crm/reglas.ts:31-40`): primero por `orden` (el
correlativo de la planilla), después por fecha (las sin fecha al final) y, si empatan, por el momento
en que se creó.

**RN-CRM-05 · La semana es de lunes a domingo** (`src/crm/reglas.ts:49-52`): se toma el lunes de la
semana de hoy y se le suman 6 días.

**RN-CRM-06 · En qué desplegables cae una oportunidad** (`src/crm/reglas.ts:58-68`). Se mira cada
acción pendiente de su cadena (las `CONCRETADO` se ignoran):

- fecha anterior a hoy → la oportunidad entra en **Vencidas**.
- fecha de hoy o hasta el domingo → entra en **Esta semana**.
- fecha posterior al domingo **o sin fecha** → entra en **Futuras**.

Como se recorre toda la cadena, **una misma oportunidad puede aparecer en dos o tres desplegables a
la vez**: los desplegables no son excluyentes (`src/crm/CRM.tsx:250-253`). El desplegable "Todas las
instituciones" no mira la urgencia: muestra todas las filas que pasaron los filtros.

**RN-CRM-07 · Marcar hecha deja la fecha de hoy** (`src/crm/reglas.ts:71`): pasa el estado a
`CONCRETADO` y **reemplaza** la fecha por la de hoy, igual que en la planilla. Si la gestión se hizo
otro día, hay que corregir la fecha a mano en el editor.

**RN-CRM-08 · Orden al mover una acción** (`src/crm/CrmProvider.tsx:219-227`):

- Si la acción se mueve a otra oportunidad de la **misma institución**, conserva su `orden` (queda en
  el mismo lugar de la cadena).
- Si se mueve a **otra institución**, va al **final**: `orden` = el mayor `orden` de las acciones de
  la institución de destino + 1.
- Al mover, la acción deja de ser LNR (`esLnr` pasa a falso).
- Soltar una acción sobre la oportunidad en la que ya está no hace nada.

**RN-CRM-09 · A qué venta va una acción movida desde el editor** (`src/crm/AccionEditor.tsx:52-68`):
se busca en la institución de destino una venta **no perdida con la misma modalidad**; si no hay, la
primera venta no perdida; si tampoco, la primera oportunidad que tenga. Si la institución no tiene
ninguna, la acción queda sin venta asociada.

**RN-CRM-10 · Adivinar el tipo de acción por el texto** (`src/crm/reglas.ts:74-84`), en este orden y
sin distinguir tildes ni mayúsculas:

| Si el texto dice… | Tipo |
|---|---|
| "invitación lnr", "liga nacional", "lnr", "invitar a la liga" | `lnr` |
| "presupuesto", "cotiz…" | `presupuesto` |
| "flyer", "folleto", "volante", "pedir contacto", "dejar material" | `flyer` |
| "whatsapp", "wpp", "mensaje", "msj" | `mensaje` |
| "mail", "correo", "email", "escrib…", "invita…" | `mail` |
| "reuni…", "presencial", "en persona", "taller", "visita" | `reunion` |
| "llamar", "llamada", "llam…" | `llamada` |
| cualquier otra cosa | `otro` |

Solo se usa para la primera acción cargada junto con una oportunidad nueva
(`src/crm/NuevaOportunidad.tsx:67`).

**RN-CRM-11 · Los diez tipos de acción con su ícono y su grupo** (`src/crm/tipos.ts:21-32`):

| Tipo | Se muestra como | Ícono | Grupo |
|---|---|---|---|
| `llamada` | Llamada | 📞 | Contacto nuestro |
| `mensaje` | Mensaje | 💬 | Contacto nuestro |
| `mail` | Mail | ✉️ | Contacto nuestro |
| `reunion` | Reunión / Visita | 🤝 | Contacto nuestro |
| `flyer` | Flyer / pedir contacto | 📌 | Contacto nuestro |
| `presupuesto` | Presupuesto | 📄 | Contacto nuestro |
| `otro` | Otro | • | Contacto nuestro |
| `lnr` | Invitación LNR | 🏆 | LNR (aparte de ventas) |
| `respuesta` | Respondió | ↩️ | Respuesta del colegio |
| `teavisamos` | Te avisamos | ⏳ | Respuesta del colegio |

Un tipo que no esté en la lista se muestra tal cual, con el ícono • (`src/crm/reglas.ts:89-90`).

**RN-CRM-12 · Orden de las filas del pipeline** (`src/crm/CRM.tsx:77-82`): primero las instituciones
con **seguimiento especial**, después por nombre alfabético en español y, si una institución tiene
varias ventas, por modalidad.

**RN-CRM-13 · Orden y datos del directorio de instituciones** (`src/crm/CRM.tsx:420-432`): mismo
orden (especiales primero, después alfabético). Por cada institución se calcula:

- "venta N" = cuántas oportunidades suyas son de tipo venta.
- "cliente" = si tiene al menos una posventa.
- "últ. …" = la fecha más reciente entre sus acciones `CONCRETADO` con fecha; si no hay ninguna,
  "sin gestiones".

**RN-CRM-14 · Qué verbo queda en la bitácora al guardar una acción**
(`src/crm/CrmProvider.tsx:145-159`), en este orden de prioridad:

1. La acción no existía antes → **Creó**.
2. Cambió de institución, de oportunidad o de LNR → **Movió**.
3. Pasó de no hecha a `CONCRETADO` → **Hecha**.
4. Cualquier otro cambio → **Editó**.

Para las oportunidades: **Creó oportunidad**, **Etapa** (si cambió la etapa) o **Editó oportunidad**
(`src/crm/CrmProvider.tsx:194`). Para las instituciones: **Creó institución** o **Editó institución**
(`src/crm/CrmProvider.tsx:174`). Al borrar: **Borró** (acción) o **Borró contacto**.

**RN-CRM-15 · El campo "venta / modalidad" de la bitácora** (`src/crm/CrmProvider.tsx:107-111`): si
la acción es una invitación LNR, dice `LNR`. Si cuelga de una oportunidad, dice el tipo deducido de
la etapa más la modalidad, separados por `·` (ejemplo inventado: `venta · Curricular`,
`posventa · Extracurricular`). Si no cuelga de ninguna, queda vacío y en el detalle se lee
"sin venta".

**RN-CRM-16 · El candado del CRM en la base de datos.** Dos funciones `security definer` (se ejecutan
con los permisos de quien las creó, así la consulta interna no queda atrapada por las propias reglas
de la tabla):

- `crm_tiene_acceso()` (`supabase/migracion-crm-1-esquema.sql:25-28`): responde si la persona
  conectada está en `crm_accesos`.
- `crm_es_gerente()` (`supabase/migracion-crm-1-esquema.sql:30-33`): responde si su fila en
  `profiles` tiene rol `admin`.

Con eso se arman las reglas por fila:

| Tabla | Leer | Escribir |
|---|---|---|
| `crm_accesos` | Cualquiera con sesión | Insertar y borrar: solo Gerentes |
| `crm_instituciones`, `crm_oportunidades`, `crm_contactos`, `crm_interacciones` | Solo con acceso | Solo con acceso |
| `crm_bitacora` | Solo con acceso | Solo insertar, con acceso. No se puede editar ni borrar |

Por eso una persona sin acceso que consulte la base directamente recibe las tablas **vacías**, no un
error (`src/crm/crmApi.ts:26`).

**RN-CRM-17 · Acceso inicial** (`supabase/migracion-crm-1-esquema.sql:170-176`): la migración da
acceso a Álvaro, Luciana y Malena, buscándolas por su mail o por el primer nombre (sin tildes) en
`profiles`. De ahí en adelante, la lista se maneja desde la pantalla.

**RN-CRM-18 · Colores de la modalidad** (`src/crm/estilo.ts:34-38`): Curricular azul, Extracurricular
verde, sin definir gris.

## 6. Pantalla y comportamiento

### El pipeline (pestañas Venta, Posventa y 2027)

De arriba hacia abajo (`src/crm/CRM.tsx:84-174`):

1. **Las cuatro pestañas** en pastillas; la activa con el degradado celeste de la planilla.
2. **Título** de la pestaña con su explicación: "Pipeline — Venta · ventas en curso, con toda la
   cadena de acciones", "Pipeline — Posventa · clientes ganados y su seguimiento" u "Objetivo 2027 ·
   clientes a insistir para que arranquen en 2027" (`src/crm/CRM.tsx:23-27`).
3. **Barra de filtros**: chips de segmento, buscador por nombre y los botones "➕ Nueva oportunidad"
   (verde) y "➕ Nueva institución" (degradado).
4. **Chips de etapa** con el color de cada etapa (no en Posventa). En el celular son una sola fila
   que se desliza de costado; en pantalla grande se acomodan en varias líneas
   (`src/crm/CRM.tsx:141`).
5. **Ayuda y leyenda de colores** en una línea. La frase "Arrastrá una acción sobre otra institución
   para moverla" solo se muestra en pantallas medianas o grandes (`src/crm/CRM.tsx:155`).
6. **Los cuatro desplegables**, cada uno con su contador de color: "Todas las instituciones" (gris),
   "Esta semana" (celeste), "Futuras" (gris) y "Vencidas" (rojo).

Cada **fila** es: en pantalla grande, una caja fija de 175 px a la izquierda con la institución y la
cadena de acciones a la derecha, que se desliza de costado; en el celular, la caja arriba y la cadena
abajo (`src/crm/CRM.tsx:322`, `src/crm/CRM.tsx:340`).

### El bloque de acción

Mide 178 px de ancho, tiene el borde izquierdo y el fondo del color del semáforo, y muestra dos
líneas: el texto de la acción y, abajo, ícono del tipo · fecha · primeros nombres de los responsables
· estado (`src/crm/BloqueAccion.tsx:42-53`). Al tocarlo se despliega hacia abajo la edición rápida:
"✓ hecha" (verde, solo si falta hacerla), "✏️ editar" (celeste, abre el editor completo), un campo de
fecha y el desplegable "Tipo de acción". Mientras está desplegado no se puede arrastrar y los clics
de adentro no lo cierran.

### Estados vacíos, de carga y de error

| Situación | Qué se ve |
|---|---|
| Cargando | "Cargando el CRM…" (`src/crm/CRM.tsx:66`) |
| Un desplegable de urgencia sin filas | "Nada por acá 👌" (`src/crm/CRM.tsx:267`) |
| "Todas las instituciones" sin filas | "Sin instituciones con estos filtros." (`src/crm/CRM.tsx:282`) |
| Directorio sin coincidencias | "Ninguna institución coincide." (`src/crm/CRM.tsx:488`) |
| Ficha sin acciones | "Todavía no hay acciones." (`src/crm/Ficha.tsx:170`) |
| Oportunidad sin acciones | "Sin acciones todavía: ¿cuál es el primer paso?" (`src/crm/Ficha.tsx:265`) |
| Ficha sin contactos | "Sin contactos cargados." (`src/crm/Ficha.tsx:345`) |
| Ficha sin bitácora | "Sin cambios registrados." (`src/crm/Ficha.tsx:189`) |
| Buscador sin coincidencias | "Ninguna coincide. Creala con «Nueva institución»." (`src/crm/ElegirInstitucion.tsx:85`) |
| Error al guardar | Nada en la pantalla; el error queda en la consola como `[ReEduca · CRM] Error guardando:` (`src/crm/CrmProvider.tsx:13`) |

### Diferencias entre computadora y celular

| | Computadora | Celular |
|---|---|---|
| Mover una acción | Arrastrar el bloque y soltarlo sobre otra institución | Editor → "Mover a otra institución" |
| Chips de etapa | Se acomodan en varias líneas | Una fila que se desliza de costado |
| Fila de oportunidad | Institución y cadena, lado a lado | Institución arriba, cadena abajo |
| Marcar hecha desde la ficha | El ✓ aparece al pasar el mouse por el chip | El ✓ está siempre visible (`src/crm/ChipAccion.tsx:43`) |
| Borrar un contacto | El tachito aparece al pasar el mouse | Siempre visible (`src/crm/Ficha.tsx:339`) |
| Agenda | Los siete días con su bloque CRM | Un día a la vez, con su bloque CRM |

### Ventanas

Las tres ventanas del CRM (ficha, editor de acción y nueva institución) se dibujan desde el
proveedor, fuera de la pantalla del CRM, y **solo si la persona tiene acceso**
(`src/crm/CrmProvider.tsx:260-270`). Por eso se pueden abrir desde cualquier parte del sistema (por
ejemplo desde la Agenda) y usan la tipografía del resto del sistema (`src/crm/CRM.tsx:165`).

## 7. Casos límite y errores

1. **Sin acceso.** El estado del CRM queda vacío salvo la lista de acceso
   (`src/crm/CrmProvider.tsx:38`), la pestaña no se muestra y la base devuelve las tablas vacías. Un
   pedido escrito (guardar algo) sería rechazado por la base.
2. **Le quitan el acceso mientras está adentro.** El tiempo real actualiza la lista, la pestaña
   desaparece y la vista salta a Mi Día. Los datos que ya se habían cargado siguen en la memoria de
   esa pestaña del navegador hasta que se recargue la página; la base ya no le entrega nada nuevo.
3. **Las tablas no existen todavía.** Cada lectura que falla devuelve una lista vacía
   (`src/crm/crmApi.ts:196-201`), así que el CRM se ve vacío en lugar de romperse. Los guardados sí
   fallan, y el error solo aparece en la consola.
4. **Dos personas editan la misma acción a la vez.** Gana la última en guardar: se escribe la fila
   completa (`src/crm/crmApi.ts:237-239`), no campo por campo. Las dos ediciones quedan en la bitácora.
5. **Falla el guardado pero la pantalla ya cambió.** Todos los cambios son optimistas: se ven primero
   y se guardan después. Si el guardado falla, la pantalla queda mostrando algo que la base no tiene,
   hasta que se recargue.
6. **Acción sin fecha.** Nunca es "vencida"; cae en "Futuras" y no aparece en la Agenda
   (`src/views/Agenda.tsx:90`).
7. **Acción sin venta asociada.** No aparece en ninguna fila del pipeline: se ve solo en la ficha, en
   el bloque "Acciones sin venta asociada", y en el Historial (`src/crm/Ficha.tsx:36`).
8. **Oportunidad de una institución que no está cargada.** La fila se descarta en silencio
   (`src/crm/CRM.tsx:59-62`); la ficha de una institución que no existe no dibuja nada
   (`src/crm/Ficha.tsx:30`).
9. **Se borra una institución desde la base.** Caen también sus oportunidades, contactos y acciones
   (`supabase/migracion-crm-1-esquema.sql:72`, `:89`, `:104`). La bitácora queda: guarda el nombre.
10. **Se borra una oportunidad desde la base.** Sus acciones no se borran: quedan "sin venta
    asociada" (`supabase/migracion-crm-1-esquema.sql:105`).
11. **Se renombra una institución.** La pestaña Bitácora de su ficha filtra por el nombre
    (`src/crm/Ficha.tsx:38`), así que los movimientos anotados con el nombre viejo dejan de verse ahí
    (siguen en la tabla).
12. **Etapa o estado guardado que no está en la lista** (por ejemplo de la planilla): el desplegable
    de posventa lo conserva como opción extra (`src/crm/CRM.tsx:376`) y el de tipo de acción también
    (`src/crm/OpcionesTipo.tsx:13`). Con la etapa no hace falta: la base solo acepta las ocho.
13. **Fecha a medio escribir en la edición rápida.** No se guarda hasta que esté completa y sea del
    siglo 21 (`src/crm/BloqueAccion.tsx:84`).
14. **Nombre de institución repetido.** Se avisa pero se permite crearla: puede haber dos sedes con
    nombres parecidos (`src/crm/NuevaInstitucion.tsx:43-47`).
15. **Datos del modo demo corruptos** en el navegador: se vuelven a sembrar los datos inventados
    (`src/crm/crmApi.ts:309-317`).

## 8. Criterios de aceptación

1. **CA-CRM-01 · La pestaña aparece solo con acceso.** Entrar con una persona que no esté en la lista:
   no se ve la pestaña CRM ni en la barra de arriba ni en la de abajo, y en su Agenda no hay bloques
   "CRM".
2. **CA-CRM-02 · Dar acceso en vivo.** Con dos navegadores abiertos: el Gerente prende el interruptor
   de una persona en Configuración · Acceso al CRM. En el navegador de esa persona aparece la pestaña
   CRM con los datos cargados, sin recargar la página.
3. **CA-CRM-03 · Quitar acceso pide confirmación.** El Gerente apaga su propio interruptor: sale el
   aviso "Si te quitás el acceso, dejás de ver el CRM. ¿Seguro?". Al apagar el de otra persona, el
   aviso dice el nombre de esa persona.
4. **CA-CRM-04 · Solo Gerentes administran.** Entrar con una persona con acceso al CRM que no sea
   Gerente y abrir la pantalla de Configuración: los interruptores no se pueden tocar.
5. **CA-CRM-05 · El candado de la base.** Con una persona sin acceso, pedirle a la base la tabla
   `crm_instituciones`: devuelve cero filas, sin error.
6. **CA-CRM-06 · Los desplegables no son excluyentes.** Crear en una misma venta dos acciones
   pendientes: una con fecha de la semana pasada y otra para dentro de dos días. La institución
   aparece en "Vencidas" **y** en "Esta semana", y una sola vez en cada uno.
7. **CA-CRM-07 · Sin fecha cae en Futuras.** Crear una acción pendiente sin fecha: la venta aparece en
   "Futuras" y no en "Vencidas".
8. **CA-CRM-08 · Hecha deja la fecha de hoy.** Tocar un bloque naranja y apretar "✓ hecha": el bloque
   se pone verde, el estado dice CONCRETADO y la fecha pasa a ser la de hoy.
9. **CA-CRM-09 · Agrupado por segmento.** Abrir "Todas las instituciones": se ven los títulos
   COLEGIOS, UNIVERSIDADS, ACADEMIAS (los que tengan filas), cada uno con su cantidad, y las
   instituciones con estrella arriba de las demás.
10. **CA-CRM-10 · Filtros combinados.** Elegir el chip "Colegios", la etapa "PROPUESTA ENVIADA" y
    escribir parte de un nombre sin tildes: quedan solo las filas que cumplen las tres cosas.
11. **CA-CRM-11 · Cerrar una venta la muda de pestaña.** Cambiar la etapa de una fila a
    "CERRADO-GANADO": desaparece de Venta y aparece en Posventa, donde en lugar de la etapa se ve el
    estado de posventa.
12. **CA-CRM-12 · Mover arrastrando (computadora).** Arrastrar un bloque de acción y soltarlo sobre la
    caja de otra institución: mientras se arrastra, la caja de destino se resalta con borde punteado;
    al soltar, la acción aparece al final de la cadena de esa institución y desaparece de la anterior.
13. **CA-CRM-13 · Mover desde el celular.** Abrir una acción con "✏️ editar", tocar "Mover a otra
    institución", elegir otra y guardar: antes de guardar sale el cartel amarillo "Al guardar, la
    acción pasa de … a …", y después la acción está en la otra institución.
14. **CA-CRM-14 · La bitácora anota el movimiento.** Abrir la ficha de la institución de destino,
    pestaña Bitácora: la última línea dice "Movió", con la hora, el nombre de quien lo hizo y el
    detalle "desde <institución vieja> (…) → <institución nueva> (…)".
15. **CA-CRM-15 · La bitácora anota campo por campo.** Editar una acción cambiándole el texto y la
    fecha: en la Bitácora de la ficha aparece una línea "Editó" con el detalle
    "texto: «…» → «…» · fecha: … → …".
16. **CA-CRM-16 · Sin cambios no hay línea nueva.** Abrir una acción con "editar" y guardar sin tocar
    nada: no aparece ninguna línea nueva en la Bitácora.
17. **CA-CRM-17 · Alta de institución con su venta.** Crear una institución (ejemplo inventado:
    "Colegio Las Palmas") con la casilla de la oportunidad marcada: se abre su ficha, la pestaña
    Ventas muestra una venta en "CONTACTO INICIAL" y en la pestaña Venta del pipeline aparece la fila.
18. **CA-CRM-18 · Aviso de repetida.** Escribir en "Nueva institución" el nombre de una que ya existe
    (con o sin tildes): sale el cartel "Ya existe «…»", y el botón "Crear" sigue funcionando.
19. **CA-CRM-19 · Primera acción con tipo adivinado.** Crear una oportunidad con la próxima acción
    "Llamar a la directora": la acción creada tiene el ícono 📞 (tipo Llamada).
20. **CA-CRM-20 · Alta de posventa.** Crear una oportunidad de tipo "Posventa (cliente ganado)" con
    estado ACTIVO: aparece en la pestaña Posventa y en su ficha la tarjeta dice "posventa" con etapa
    CERRADO-GANADO.
21. **CA-CRM-21 · Objetivo 2027.** Tocar el ◎ de una fila: pasa a 🎯 y la fila aparece en la pestaña
    2027. Tocarlo de nuevo la saca.
22. **CA-CRM-22 · Invitación LNR aparte.** En la ficha, bloque "Invitaciones a la Liga (LNR)", agregar
    una invitación: queda en ese bloque y **no** aparece en la cadena de ninguna venta del pipeline.
23. **CA-CRM-23 · Contactos.** Cargar un contacto con teléfono y mail (datos inventados): el teléfono
    queda como enlace para llamar y el mail para escribir. Borrarlo pide confirmación y deja la línea
    "Borró contacto" en la Bitácora.
24. **CA-CRM-24 · La Agenda muestra las acciones del CRM.** Poner una acción con fecha de esta semana
    y abrir la Agenda: en ese día hay un bloque "CRM" con el nombre de la institución y el texto de la
    acción; el ✓ la marca hecha y el bloque se tacha.
25. **CA-CRM-25 · Los filtros de la Agenda mandan.** En la Agenda, elegir un filtro de proyecto: el
    bloque "CRM" desaparece. Apagar el filtro y usar el interruptor "CRM": también desaparece, y sigue
    apagado después de recargar la página.
26. **CA-CRM-26 · Borrar una acción.** Borrarla desde el editor: pide confirmación avisando que queda
    registrado, desaparece de la cadena y en la Bitácora queda la línea "Borró" con el responsable, el
    estado y la fecha que tenía.
27. **CA-CRM-27 · No se guarda una acción sin texto.** Abrir "+ acción" y dejar el texto vacío: el
    botón "Guardar" está apagado.
28. **CA-CRM-28 · Los desplegables se recuerdan.** Cerrar "Esta semana" y abrir "Vencidas", recargar
    la página: quedan como se dejaron.

## 9. Limitaciones conocidas y pendientes

**Lo que hoy no hace:**

1. **No hay inicio gerencial con métricas ni embudo.** No existe ninguna pantalla que muestre cuántas
   ventas hay por etapa, cuánto se movió en el mes o cuántas gestiones hizo cada persona. El CRM es
   hoy una lista de trabajo, no un tablero.
2. **No se usa el monto de la venta.** La columna `valor` existe en la base y en el tipo
   (`src/crm/tipos.ts:58`) pero ninguna pantalla la carga ni la muestra, así que no se puede saber
   cuánto vale el embudo.
3. **Tampoco se usan** las horas de una acción (`src/crm/tipos.ts:87`), las notas de un contacto
   (`src/crm/tipos.ts:72`), los equipos por línea (`eq_intelliq`, `eq_v5`, `eq_universo`) ni la marca
   `activo`: se guardan y viajan, pero no hay campo para editarlas.
4. **El enlace de una acción se guarda pero no se ve.** El editor permite cargarlo
   (`src/crm/AccionEditor.tsx:193-200`), pero ningún bloque, chip ni historial lo muestra ni lo hace
   clicable.
5. **El producto de una oportunidad solo se puede cargar al crearla** y después no se ve ni se edita
   en ninguna parte (`src/crm/NuevaOportunidad.tsx:104-106`).
6. **La pestaña Venta también muestra las ventas perdidas.** El filtro deja pasar todo lo que no sea
   `CERRADO-GANADO` (`src/crm/CRM.tsx:72`), así que las `CERRADO-NO GANADO` aparecen mezcladas con las
   ventas en curso, aunque el título diga "ventas en curso". Para verlas aparte hay que usar el chip
   de etapa. Por la misma razón, elegir el chip "CERRADO-GANADO" dentro de Venta nunca devuelve nada.
7. **La pestaña 2027 no distingue el estado.** Muestra todas las oportunidades marcadas como objetivo
   2027, incluidas las ya ganadas y las perdidas.
8. **No se pueden borrar instituciones ni oportunidades desde la pantalla.** Solo se borran acciones y
   contactos; lo demás hay que hacerlo con SQL en la base.
9. **No se puede cambiar el orden de la cadena a mano.** El `orden` se calcula solo (al crear va al
   final); no hay forma de reacomodar los eslabones arrastrándolos dentro de la misma cadena.
10. **La bitácora de la ficha filtra por el nombre de la institución** (`src/crm/Ficha.tsx:38`), no
    por su id: si se renombra la institución, los movimientos viejos dejan de aparecer en su ficha.
    Solo se muestran los últimos 60, no se puede buscar, y no hay pantalla con la bitácora completa.
11. **Los cambios de contactos no quedan en la bitácora.** Crear o editar un contacto no anota nada
    (`src/crm/CrmProvider.tsx:202-205`); solo el borrado queda registrado.
12. **Los errores de guardado no se ven.** Van a la consola del navegador
    (`src/crm/CrmProvider.tsx:13`); la persona cree que guardó. No hay reintento ni cola de pendientes.
13. **Si le quitan el acceso a alguien mientras está usando el CRM**, los datos ya cargados quedan en
    la memoria de esa pestaña hasta que recargue la página.
14. **No hay exportación.** No se puede bajar el pipeline ni la bitácora a una planilla.
15. **Los datos reales se cargan por fuera del repositorio.** La migración de esquema crea las tablas
    vacías y menciona un "archivo 2" con los datos, que no está en el repositorio: el generador vive
    en una carpeta aparte, ignorada por git porque trae datos personales de contactos de
    instituciones. El SQL de datos se pega a mano en Supabase.

**Código que quedó sin usar** (no cambia el comportamiento, pero conviene saberlo si se retoma el
módulo): `proximaDe()` (`src/crm/reglas.ts:43-47`), que calcula la próxima acción pendiente de una
cadena, y `etiquetaTipo()` (`src/crm/reglas.ts:86-87`), cuya lógica está repetida a mano en el
Historial de la ficha (`src/crm/Ficha.tsx:149`). Ninguna se llama desde ninguna pantalla. Y un
detalle de redacción: el título del grupo de universidades del pipeline sale como "UNIVERSIDADS",
porque el nombre del segmento se pone en mayúsculas y se le agrega una "S" (`src/crm/CRM.tsx:275`).
