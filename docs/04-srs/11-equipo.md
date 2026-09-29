# SRS · Equipo (miembros, roles y llaves)

| | |
|---|---|
| Código de módulo | MOD-EQU |
| Archivos de código | `src/views/Equipo.tsx`, `src/components/ConfiguracionGerente.tsx`, `src/components/Avatar.tsx`, `src/components/Modal.tsx`, `src/components/TopBar.tsx`, `src/state/AppContext.tsx`, `src/lib/supabaseApi.ts`, `src/lib/utils.ts` |
| Tablas que usa | `profiles` (lee y escribe), `feature_flags` (lee y escribe), `tasks`, `projects` (solo lee) |
| Quién lo ve | Solo Gerentes (`admin`). El resto del equipo ve un cartel de "Vista exclusiva del Gerente" |
| Llave (feature flag) | Ninguna para entrar. La pestaña se **oculta** cuando `FEATURE_PANEL` está prendida, porque el Panel se queda con sus dos bloques de administración |

## 1. Para qué sirve

Equipo es la pantalla de recursos humanos del sistema: quién es quién, qué rol tiene, de
qué color es en la agenda y qué funciones nuevas tiene habilitadas. Todo lo que define a
una persona dentro del sistema se administra desde acá.

Tiene dos mitades. La de arriba es de control: cuántas tareas hay en total, cuántas
completadas, en progreso y atrasadas; la lista de tareas críticas de todo el equipo (las de
cuatro y cinco estrellas que todavía están pendientes, sin importar de quién sean); la
carga de trabajo de cada persona; y el estado de cada proyecto. La de abajo es de
administración: el orden de los proyectos, la lista de quién tiene acceso al CRM y la
gestión de los miembros — agregar, editar el nombre, el correo, el rol, el color y la foto,
y eliminar.

El otro trabajo que se hace acá es abrir funciones de a poco. El sistema tiene "llaves"
(feature flags) que permiten prender algo nuevo para una sola persona antes de mostrárselo
a todo el equipo. Hoy la única llave con interruptor en la pantalla es la del Kickoff
semanal, que se prende por persona con un botón que dice "Beta ON / Beta OFF".

Una aclaración importante para el uso diario: cuando el sistema está conectado a Supabase,
las cuentas **no** se crean desde acá. Cada persona se registra sola desde la pantalla de
inicio, y esta pantalla sirve para editar su perfil y su rol una vez que ya se registró. La
propia pantalla lo dice (`src/views/Equipo.tsx:233`).

## 2. Usuarios y permisos

| Quién | Qué puede hacer | Qué NO puede hacer |
|---|---|---|
| Miembro (`member`) | Nada acá. Si llega a la vista, ve el cartel "Vista exclusiva del Gerente" con la explicación de que pida el cambio de rol a un Gerente | Ver los números del equipo, la carga de las personas ni la lista de miembros |
| Gerente (`admin`) | Ver todos los bloques; agregar, editar y eliminar miembros; cambiar roles, colores y fotos; prender y apagar la llave del Kickoff por persona; ordenar los proyectos; dar y quitar acceso al CRM | Eliminarse a sí mismo |
| Cualquier persona, desde el menú de su avatar | Editar su **propio** nombre, color y foto, y cambiar su contraseña | Cambiar su propio rol |

Reglas, con su referencia:

- El bloqueo de la vista para quien no es Gerente está en `src/views/Equipo.tsx:63`, y la
  pestaña ya no se ofrece en el menú a quien no es `admin`
  (`src/components/TopBar.tsx:43`).
- Nadie puede eliminarse a sí mismo: el botón queda apagado y avisa "No podés eliminarte a
  vos mismo" (`src/views/Equipo.tsx:216`, `:281`).
- El acceso al CRM se administra en el bloque "Configuración · Acceso al CRM"
  (`src/components/ConfiguracionGerente.tsx:65`, que dibuja `src/crm/AccesoCRM.tsx`). Ese
  candado sí es real en la base de datos y está documentado en el **SRS del CRM de
  instituciones**: acá solo se menciona que el bloque vive al pie de esta pantalla y que los
  botones quedan apagados para quien no es Gerente (`src/crm/AccesoCRM.tsx:44`).
- El perfil propio se edita desde el menú del avatar, arriba a la derecha
  (`src/components/TopBar.tsx:176`). Ahí no hay campo de rol, a propósito.
- En la base de datos, `profiles` deja leer y escribir a cualquier usuario con sesión
  (`supabase/schema.sql:126`). La restricción de Gerente es de la interfaz. En cambio
  `feature_flags` sí tiene candado real: todos pueden leer, solo un `admin` puede escribir
  (`supabase/migracion-panel-pm.sql:28` y `:31`).

## 3. Datos que usa

### Tabla `profiles` (interface `User`, `src/types.ts:3`)

| Campo | Qué significa | De dónde sale |
|---|---|---|
| `id` | Identificador de la persona. Con Supabase es **el mismo id de su cuenta de acceso** | Lo pone el registro de la cuenta (`supabase/schema.sql:101`) o `uid()` si se crea el perfil a mano (`src/views/Equipo.tsx:319`) |
| `name` | Nombre visible en toda la app | Campo "Nombre"; con Supabase se precarga del registro |
| `email` | Correo de la persona | Campo "Email"; con Supabase se precarga del registro |
| `role` | `admin` (se muestra como "Gerente") o `member` (se muestra como "Equipo") | Campo "Rol". La base solo acepta esos dos valores (`supabase/schema.sql:11`) |
| `color` | Color de su avatar y de sus marcas en la app | Paleta cerrada de 25 colores (`src/lib/utils.ts:49`) |
| `avatar_url` / `avatarUrl` | Dirección web de su foto. Opcional | Campo "Foto (URL de imagen, opcional)" |

### Tabla `feature_flags` (interface `FeatureFlag`, `src/types.ts:201`)

| Campo | Qué significa | De dónde sale |
|---|---|---|
| `flag` | Nombre de la llave: `FEATURE_KICKOFF`, `FEATURE_COMENTARIOS` o `FEATURE_PANEL` (`src/types.ts:208`) | Migraciones SQL o el botón "Beta" de esta pantalla |
| `user_id` | A quién aplica. **Nulo = valor global** para todo el equipo | El botón "Beta" siempre escribe filas con id de persona (`src/views/Equipo.tsx:211`) |
| `enabled` | Prendida o apagada | El botón "Beta", o el Table Editor de Supabase |

### Campos de otras tablas que esta pantalla lee

| Campo | Qué significa | Para qué se usa |
|---|---|---|
| `tasks.status`, `date`, `importance`, `urgent`, `assignee_ids`, `project_id`, `title` | Los datos de la tarea | Los cuatro números globales, las tareas críticas, la carga por persona |
| `projects.name`, `color` | Nombre y color | Estado global por proyecto, punto de color en las críticas |

## 4. Requisitos funcionales

| ID | Requisito | Detalle / regla | Dónde vive |
|---|---|---|---|
| RF-EQU-01 | El sistema debe mostrar esta pantalla solo a Gerentes | Quien no lo sea ve: "Vista exclusiva del Gerente · Tu rol actual es de Equipo. Pedile a un Gerente que te cambie el rol si necesitás acceso." | `src/views/Equipo.tsx:63` |
| RF-EQU-02 | El sistema debe ocultar la pestaña Equipo del menú cuando la llave `FEATURE_PANEL` está prendida | Sus dos bloques de administración pasan al pie del Panel | `src/components/TopBar.tsx:43`, `src/views/Panel.tsx:507`, `:510` |
| RF-EQU-03 | La pantalla debe mostrar cuatro números de todo el sistema: tareas totales, completadas, en progreso y atrasadas | Con sus colores: gris, verde, celeste y rojo | `src/views/Equipo.tsx:14`, `:84` |
| RF-EQU-04 | La pantalla debe listar las tareas críticas del equipo: todas las de 4 o 5 estrellas que no estén completadas, de cualquier persona | Cada fila muestra estrellas, marca de urgente si la tiene, proyecto, fecha (o "📥 sin fecha"), estado y las fotos de sus responsables | `src/views/Equipo.tsx:41`, `:92` |
| RF-EQU-05 | El sistema debe abrir la ventana de la tarea al tocar una fila de tareas críticas | — | `src/views/Equipo.tsx:115` |
| RF-EQU-06 | La pantalla debe mostrar la carga de trabajo de cada persona: una barra partida en completado, en progreso y por hacer, con su total y sus atrasadas | Aparecen **todas** las personas, incluso las que no tienen ninguna tarea | `src/views/Equipo.tsx:24`, `:135` |
| RF-EQU-07 | La pantalla debe mostrar el estado global de cada proyecto: barra de avance y "completadas sobre total" | En el orden configurado por el Gerente | `src/views/Equipo.tsx:54`, `:165` |
| RF-EQU-08 | La pantalla debe incluir el bloque de configuración del orden de los proyectos | Documentado en `docs/04-srs/09-proyectos.md` | `src/views/Equipo.tsx:189`, `src/components/ConfiguracionGerente.tsx:22` |
| RF-EQU-09 | La pantalla debe incluir el bloque de acceso al CRM | Solo se menciona acá; el detalle está en el SRS del CRM de instituciones | `src/components/ConfiguracionGerente.tsx:65` |
| RF-EQU-10 | La pantalla debe listar a todos los miembros con su foto, nombre, correo y una etiqueta de rol | La etiqueta dice "GERENTE" en azul o "EQUIPO" en gris | `src/views/Equipo.tsx:239`, `:246` |
| RF-EQU-11 | El sistema debe permitir agregar un miembro nuevo | Nombre obligatorio; el botón Guardar queda apagado sin nombre | `src/views/Equipo.tsx:227`, `:376` |
| RF-EQU-12 | El sistema debe permitir editar el nombre, el correo, el rol, el color y la foto de un miembro | El pop-up se titula "Editar a <nombre>" | `src/views/Equipo.tsx:273`, `:330` |
| RF-EQU-13 | El sistema debe permitir elegir el rol entre "Equipo" y "Gerente / Admin" | Dos botones; por defecto "Equipo" en un miembro nuevo | `src/views/Equipo.tsx:338` |
| RF-EQU-14 | El sistema debe permitir elegir el color de la persona de una paleta visual de 25 colores | Un miembro nuevo arranca con un color al azar de la paleta | `src/views/Equipo.tsx:314`, `:354` |
| RF-EQU-15 | El sistema debe permitir cargar la foto de la persona escribiendo la dirección web de una imagen | Campo opcional; si queda vacío no se guarda nada | `src/views/Equipo.tsx:367`, `:324` |
| RF-EQU-16 | Cuando la persona no tiene foto, el sistema debe dibujar un círculo de su color con la primera letra de su nombre | El color de la letra se elige claro u oscuro según el fondo, para que siempre se lea | `src/components/Avatar.tsx:16`, `src/lib/utils.ts:82` |
| RF-EQU-17 | El sistema debe permitir eliminar a un miembro, previa confirmación, y nunca a uno mismo | Texto: «¿Eliminar a <nombre>? Sus tareas quedarán sin asignar.» El botón está apagado en la propia fila | `src/views/Equipo.tsx:216`, `:281` |
| RF-EQU-18 | Cuando el sistema está conectado a Supabase, debe avisar que las cuentas se crean desde la pantalla de inicio | El aviso no aparece en modo demo | `src/views/Equipo.tsx:233` |
| RF-EQU-19 | El sistema debe permitir prender y apagar, por persona, el acceso anticipado al Kickoff semanal | Botón con cohete que dice "Beta ON" en verde o "Beta OFF" en gris | `src/views/Equipo.tsx:206`, `:253` |
| RF-EQU-20 | El botón "Beta" debe advertir, en la propia fila del Gerente que está mirando, que si se la apaga a sí mismo la recupera corriendo de nuevo el SQL de la llave | Es el texto de ayuda del botón | `src/views/Equipo.tsx:256` |
| RF-EQU-21 | El sistema debe mantener una sola fila por combinación de llave y persona | Si ya existe una fila para esa llave y esa persona, se actualiza en lugar de crear otra | `src/state/AppContext.tsx:478`, `supabase/migracion-panel-pm.sql:24` |
| RF-EQU-22 | El sistema debe permitir a cada persona editar su propio nombre, color y foto, y cambiar su contraseña, desde el menú de su avatar | El rol no se puede cambiar desde ahí. El campo de contraseña no aparece en modo demo | `src/components/TopBar.tsx:176`, `:218` |
| RF-EQU-23 | Cuando una persona inicia sesión y no tiene perfil, el sistema debe creárselo solo | Pasa si se registró antes de correr el esquema. Si es la primera persona del sistema, queda como Gerente; si no, como Equipo | `src/state/AppContext.tsx:199`, `supabase/schema.sql:106` |

## 5. Reglas de negocio y cálculos

- **RN-EQU-01 · Los dos roles y sus nombres.** En la base y en el código son `admin` y
  `member` (`src/types.ts:1`). En la pantalla se llaman **Gerente** y **Equipo**
  (`src/views/Equipo.tsx:251`, `src/components/TopBar.tsx:121`); en el pop-up de edición, el
  primero se rotula "Gerente / Admin" (`src/views/Equipo.tsx:349`). La base rechaza
  cualquier otro valor (`supabase/schema.sql:11`).
- **RN-EQU-02 · Tarea crítica.** Importancia de 4 o 5 estrellas y estado distinto de
  completado. Se ordenan por importancia de mayor a menor; a igual importancia, primero las
  urgentes; y a igual urgencia, por fecha de la más próxima a la más lejana, tomando las sin
  fecha como `'9999-99'` para que vayan al final (`src/views/Equipo.tsx:41`).
- **RN-EQU-03 · Carga de trabajo por persona.** Para cada integrante se cuentan **todas**
  sus tareas asignadas, sin filtrar por fecha, separadas en completadas, en progreso y por
  hacer, más sus atrasadas. Se listan todas las personas, en el orden en que llegan de la
  base. El largo de la barra es relativo a la persona más cargada:
  `total / maxLoad × 100` (`src/views/Equipo.tsx:24`, `:39`, `:145`).
- **RN-EQU-04 · Tarea atrasada.** No completada, con fecha, y esa fecha anterior a hoy
  (`src/lib/utils.ts:25`).
- **RN-EQU-05 · Estado de un proyecto.** `completadas / total × 100` para el largo de la
  barra, y el texto "N/M completadas" (`src/views/Equipo.tsx:173`, `:180`).
- **RN-EQU-06 · Color de la letra del avatar.** Se calcula la luminosidad del color de fondo
  con la fórmula `(0,299·R + 0,587·G + 0,114·B) / 255`; si da más de 0,6 la letra va oscura,
  si no va blanca (`src/lib/utils.ts:82`). Es lo que mantiene el contraste legible con los
  colores pastel de la paleta.
- **RN-EQU-07 · Cómo se resuelve una llave.** Primero se busca una fila de esa llave con el
  id de la persona: si existe, manda su valor. Si no, manda la fila global (`user_id` nulo).
  Si no hay ninguna, la llave está apagada (`src/state/AppContext.tsx:290`).
- **RN-EQU-08 · Cuándo se ve el botón "Beta".** Solo si el Gerente que está mirando tiene la
  llave `FEATURE_KICKOFF` prendida para sí mismo (`src/views/Equipo.tsx:253`). Un Gerente
  sin esa llave no ve el botón de nadie.
- **RN-EQU-09 · Qué escribe el botón "Beta".** Una fila de `FEATURE_KICKOFF` con el id de esa
  persona y el valor contrario al que tenía resuelto. Si ya había una fila, se reutiliza su
  identificador (`src/views/Equipo.tsx:206`, `src/state/AppContext.tsx:478`).
- **RN-EQU-10 · Eliminar un miembro no borra sus tareas.** Las tareas siguen existiendo; lo
  que se hace es sacarlo de la lista de responsables en la pantalla
  (`src/state/AppContext.tsx:400`). Con Supabase esa limpieza **no llega a la base**: ver
  sección 7.
- **RN-EQU-11 · La primera persona que se registra queda Gerente.** Lo decide la base al
  crear el perfil: si todavía no hay ningún perfil, el rol es `admin`; si ya hay, `member`
  (`supabase/schema.sql:106`). La misma regla se repite en la autocuración del lado de la
  app (`src/state/AppContext.tsx:204`).
- **RN-EQU-12 · Paleta de colores.** 25 colores compartidos entre personas y proyectos: 20
  pastel más los 5 oficiales de la marca ReEduca (`src/lib/utils.ts:49`, `:79`).

## 6. Pantalla y comportamiento

Página con desplazamiento vertical, de hasta 1024 px de ancho, centrada. De arriba hacia
abajo: título "Panel del Gerente" con la bajada "Rendimiento del equipo, carga de trabajo y
gestión de RRHH." (`src/views/Equipo.tsx:80`); los cuatro números en una fila (dos columnas
en celular, cuatro en pantalla grande); el bloque de tareas críticas con ícono de estrella
ámbar; después, en dos columnas que se apilan en celular, "Carga de trabajo por persona" y
"Estado global por proyecto"; y al final los bloques de configuración y de miembros.

El bloque **Miembros del equipo** es una grilla de tarjetas: una columna en celular, dos
desde 640 px y tres desde 1024 px. Cada tarjeta tiene el avatar de 40 px, el nombre, el
correo, la etiqueta de rol, el botón "Beta" cuando corresponde, y a la derecha, en columna,
el lápiz y el tacho. Arriba a la derecha del bloque, el botón azul "+ Agregar miembro".

El pop-up de miembro tiene, en este orden: Nombre, Email, Rol (dos botones), Color (paleta
de 25 círculos) y Foto (URL de imagen, opcional), más los botones Cancelar y Guardar.

Estados vacíos:

- Sin tareas críticas: "No hay tareas críticas pendientes. 🎉"
  (`src/views/Equipo.tsx:105`).
- Sin proyectos: en el bloque de configuración, "Todavía no hay proyectos."
  (`src/components/ConfiguracionGerente.tsx:60`).
- Los bloques de números, carga y estado por proyecto no tienen estado vacío propio: si no
  hay datos, los números quedan en cero y las listas vacías.

Estados de carga y de error: esta pantalla no tiene ninguno propio. La carga inicial la
maneja la pantalla general (`src/App.tsx:52`) y, si un guardado falla, el error queda en la
consola del navegador mientras la pantalla muestra el cambio como hecho
(`src/state/AppContext.tsx:83`, `:395`). La única excepción es el cambio de contraseña del
propio perfil, que sí muestra el mensaje de error en rojo dentro del pop-up
(`src/components/TopBar.tsx:229`).

## 7. Casos límite y errores

- **"Agregar miembro" con Supabase conectado.** Crea una fila de perfil con un
  identificador inventado por la app (`src/views/Equipo.tsx:319`), que **no** corresponde a
  ninguna cuenta de acceso. Esa persona no puede iniciar sesión con ese perfil, y cuando se
  registre de verdad, el sistema le va a crear un **segundo** perfil con el id correcto. El
  aviso de la pantalla (RF-EQU-18) existe justamente para desalentar este camino, pero el
  botón sigue estando ahí y no está bloqueado.
- **Se elimina a un miembro en Supabase.** Se borra su fila de `profiles`
  (`src/lib/supabaseApi.ts:448`), pero su identificador **queda escrito** en el
  `assignee_ids` de sus tareas: la limpieza que hace el sistema es solo en la pantalla
  (`src/state/AppContext.tsx:404`). Al recargar, esas tareas siguen teniendo un
  responsable que ya no existe; no se rompe nada (simplemente no se dibuja ninguna foto),
  pero la tarea tampoco figura como "sin asignar" en la base. En modo demo sí se limpia
  (`src/lib/localApi.ts:118`).
- **Se elimina el perfil pero la cuenta de acceso sigue viva.** Esta pantalla no borra la
  cuenta de Supabase Auth. Si la persona vuelve a iniciar sesión, el sistema le recrea el
  perfil solo, con rol "Equipo" y un color de la paleta (`src/state/AppContext.tsx:199`).
  Para sacar a alguien de verdad hay que borrar también su usuario desde el panel de
  Supabase.
- **Un Gerente se baja el rol a sí mismo.** El pop-up lo permite: no hay ninguna
  validación. Si era el único Gerente, se queda el sistema sin nadie que pueda administrar,
  y hay que arreglarlo a mano en la base.
- **Un Gerente se apaga a sí mismo la llave del Kickoff.** El botón lo permite y avisa en su
  ayuda que se recupera corriendo de nuevo el SQL de la llave
  (`src/views/Equipo.tsx:256`). Una vez apagada, el botón "Beta" desaparece de toda la
  pantalla (RN-EQU-08), así que ya no se puede volver a prender desde la interfaz.
- **Foto con una dirección que no existe o que no es una imagen.** El navegador muestra la
  imagen rota: no hay validación ni imagen de reemplazo
  (`src/components/Avatar.tsx:5`).
- **Nombre con espacios al principio o al final.** Se recortan al guardar. Un nombre con solo
  espacios no se puede guardar, porque el botón queda apagado
  (`src/views/Equipo.tsx:376`).
- **Dos personas con el mismo nombre.** El sistema lo permite, y sus avatares sin foto van a
  mostrar la misma letra: se distinguen solo por el color.
- **Correos repetidos.** No hay validación de unicidad en `profiles`
  (`supabase/schema.sql:10`); la unicidad real la impone el registro de cuentas de Supabase.
- **La tabla `feature_flags` no existe.** La carga de datos la tolera y devuelve una lista
  vacía (`src/lib/supabaseApi.ts:381`): todas las llaves quedan apagadas y el botón "Beta"
  no se ve.
- **Un miembro sin ninguna tarea.** Aparece igual en "Carga de trabajo por persona", con la
  barra vacía y "0 tareas" (a diferencia del Panel, que a esas personas las esconde).
- **Dos Gerentes editan al mismo miembro a la vez.** Gana el último que guarda, sin aviso de
  conflicto.

## 8. Criterios de aceptación

1. **CA-EQU-01** · Entrar con una cuenta de Equipo y llegar a la vista Equipo. Se espera:
   el cartel "Vista exclusiva del Gerente" y nada más. Además, la pestaña no aparece en el
   menú.
2. **CA-EQU-02** · Entrar con una cuenta de Gerente que tenga la llave `FEATURE_PANEL`
   apagada. Se espera: se ve la pestaña Equipo con todos sus bloques.
3. **CA-EQU-03** · Prender `FEATURE_PANEL` para ese Gerente. Se espera: la pestaña Equipo
   desaparece del menú y los bloques "Configuración · Orden de los proyectos",
   "Configuración · Acceso al CRM" y "Miembros del equipo" aparecen al pie del Panel.
4. **CA-EQU-04** · Poner una tarea en 5 estrellas y otra en 4, ambas pendientes, de personas
   distintas. Se espera: las dos aparecen en "Tareas críticas del equipo", la de 5 arriba,
   cada una con su proyecto, su fecha y su estado.
5. **CA-EQU-05** · Completar la tarea de 5 estrellas. Se espera: sale de la lista de
   críticas, y el número "Completadas" de arriba sube en uno.
6. **CA-EQU-06** · Bajar una tarea a 3 estrellas. Se espera: sale de la lista de críticas.
7. **CA-EQU-07** · Tocar una fila de tareas críticas. Se espera: se abre la ventana de esa
   tarea.
8. **CA-EQU-08** · Mirar "Carga de trabajo por persona". Se espera: aparecen **todos** los
   miembros, incluso los que no tienen tareas, y la barra más larga corresponde a la persona
   con más tareas.
9. **CA-EQU-09** · Tocar "+ Agregar miembro", escribir solo el nombre y guardar. Se espera:
   aparece una tarjeta nueva con la inicial del nombre sobre un color al azar y la etiqueta
   "EQUIPO". Con el nombre vacío, el botón Guardar está apagado.
10. **CA-EQU-10** · Editar a esa persona: cambiarle el color y ponerle una dirección de
    imagen válida. Se espera: el avatar pasa de la inicial a la foto, en esta pantalla y en
    todas las demás (agenda, tareas, minutas).
11. **CA-EQU-11** · Cambiarle el rol a "Gerente / Admin" y guardar. Se espera: la etiqueta
    pasa a "GERENTE" en azul. Al entrar con esa cuenta, ya ve las pantallas de Gerente.
12. **CA-EQU-12** · Buscar el botón del tacho en la propia tarjeta del Gerente que está
    usando el sistema. Se espera: está apagado y al pasar el mouse dice "No podés eliminarte
    a vos mismo".
13. **CA-EQU-13** · Eliminar a la persona creada en CA-EQU-09 y aceptar la confirmación. Se
    espera: la confirmación avisa que sus tareas quedarán sin asignar, y la tarjeta
    desaparece.
14. **CA-EQU-14** · Con la llave `FEATURE_KICKOFF` prendida para el Gerente que mira: se
    espera que en cada tarjeta aparezca el botón "Beta OFF" o "Beta ON".
15. **CA-EQU-15** · Tocar "Beta OFF" en la tarjeta de una compañera. Se espera: pasa a
    "Beta ON" en verde, y al entrar esa persona ya ve la pestaña Kickoff.
16. **CA-EQU-16** · Volver a tocarlo. Se espera: vuelve a "Beta OFF" y la pestaña Kickoff
    desaparece para esa persona.
17. **CA-EQU-17** · Con el sistema conectado a Supabase, mirar el bloque de miembros. Se
    espera: arriba de la grilla, el aviso de que cada persona crea su cuenta desde la
    pantalla de inicio y que acá se edita su perfil y su rol. En modo demo ese aviso **no**
    aparece.
18. **CA-EQU-18** · Desde el menú del avatar, entrar a "Editar mi perfil", cambiar el nombre
    y el color y guardar. Se espera: el cambio se ve en toda la app, y en ese pop-up no hay
    ningún campo de rol.

## 9. Limitaciones conocidas y pendientes

1. **El título de la pantalla quedó viejo.** Dice "Panel del Gerente"
   (`src/views/Equipo.tsx:80`), el mismo nombre que ahora usa el módulo Panel
   (`docs/04-srs/10-panel-gerente.md`). Para el Gerente General son dos pantallas con el
   mismo nombre, aunque en la práctica nunca se ven las dos a la vez.
2. **"Agregar miembro" no sirve con Supabase conectado** y puede generar perfiles
   duplicados (ver sección 7). El botón sigue habilitado igual.
3. **Al eliminar un miembro, su id queda en las tareas de la base** (RN-EQU-10 y sección 7).
   La limpieza que hace el sistema es solo en la pantalla, y el modo demo se comporta
   distinto al modo Supabase.
4. **Eliminar el perfil no elimina la cuenta de acceso**: la persona puede volver a entrar y
   el sistema le recrea el perfil como "Equipo".
5. **No se puede cambiar el correo de la cuenta de acceso desde acá**: el campo Email escribe
   solo el perfil, no la credencial de Supabase Auth.
6. **La foto es una dirección web escrita a mano.** No hay subida de archivos ni recorte, y
   tampoco validación de que la dirección sea una imagen.
7. **Solo la llave del Kickoff tiene interruptor en la pantalla.** `FEATURE_PANEL` y
   `FEATURE_COMENTARIOS` existen y se resuelven igual, pero se prenden y apagan a mano en la
   base (Table Editor o SQL).
8. **El botón "Beta" tiene un problema de huevo y gallina**: solo lo ve un Gerente que ya
   tenga la llave del Kickoff. Si se la apaga a sí mismo, pierde la única forma de volver a
   prenderla desde la interfaz.
9. **Nada impide que un Gerente se quite su propio rol de Gerente**, ni que el sistema quede
   sin ningún Gerente.
10. **No hay auditoría**: no queda registro de quién cambió un rol, un color o una llave, ni
    cuándo.
11. **No hay estados de la persona** (activo, de licencia, ex-integrante) ni campos de RRHH
    reales: solo nombre, correo, rol, color y foto.
12. **La lista de miembros no se puede buscar ni filtrar**, y viene en el orden en que la
    entrega la base (con Supabase, alfabético por nombre, `src/lib/supabaseApi.ts:365`).
13. **La carga de trabajo de esta pantalla cuenta todas las tareas de todos los tiempos**,
    sin recorte de fechas (RN-EQU-03), a diferencia del Panel, que mira solo la semana. Los
    dos números son correctos pero miden cosas distintas, y eso puede confundir.
