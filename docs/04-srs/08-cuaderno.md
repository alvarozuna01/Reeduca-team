# SRS · Mi Cuaderno

| | |
|---|---|
| Código de módulo | MOD-CUA |
| Archivos de código | `src/views/Cuaderno.tsx`, `src/components/Modal.tsx`, `src/components/Avatar.tsx`, `src/state/AppContext.tsx`, `src/lib/utils.ts`, `src/lib/supabaseApi.ts`, `src/lib/useIsMobile.ts` |
| Tablas que usa | `notes`, `note_folders`, `pins`, y `profiles` solo de lectura (nombres, colores y fotos) |
| Quién lo ve | Todo el equipo. Cada persona ve únicamente sus propias notas más las que le compartieron |
| Llave (feature flag) | Ninguna |

## 1. Para qué sirve

Mi Cuaderno es el bloc de notas personal de cada integrante del equipo, adentro del
mismo sistema donde ya están las tareas y las minutas. Sirve para lo que no es una
tarea: apuntes de una llamada, ideas a medio cocinar, borradores de propuestas,
checklists sueltas. La promesa es fuerte y hay que respetarla: lo que escribís ahí es
privado de verdad, no "privado por buena voluntad de la interfaz". La base de datos no
le entrega tus notas a nadie más, ni siquiera a un Gerente (ver sección 2 y las
políticas RLS en `supabase/schema.sql:141`).

Un día normal se usa así: se entra a la pestaña Cuaderno, se elige una carpeta a la
izquierda (por ejemplo "Reuniones"), se ve la lista de notas de esa carpeta en el medio
y se escribe en el panel de la derecha. No hay botón "Guardar": el sistema guarda solo
mientras escribís. Si una nota es importante para hoy, se la fija en Mi Día y aparece en
el bloque "Fijados" de la pantalla de inicio. Si hace falta que otra persona la vea, se
la comparte con nombre y apellido: esa persona la ve y la puede editar, pero no la puede
borrar ni re-compartir.

Cuando hay que sacar la nota del sistema — mandarla por correo, imprimirla, llevarla a
una reunión con gente de afuera — hay un botón que la exporta a PDF con el logo de
ReEduca, el autor y la fecha.

## 2. Usuarios y permisos

| Quién | Qué puede hacer | Qué NO puede hacer |
|---|---|---|
| Cualquier miembro (rol `member` o `admin`) | Crear, ver, editar, fijar, compartir, exportar y borrar **sus propias** notas y carpetas | Ver las notas de otra persona que no le fueron compartidas |
| Persona con quien se compartió una nota | Verla, editar su título y su contenido, exportarla a PDF, fijarla en su propio Mi Día | Borrarla, cambiar con quién está compartida, fijarla arriba en la lista del dueño |
| Gerente (`admin`) | Nada especial acá: en este módulo un Gerente tiene exactamente los mismos permisos que cualquier otra persona | Ver las notas ajenas |

Reglas de edición, con su referencia:

- El dueño se decide por `note.userId`. La interfaz calcula `isOwner` al armar el editor
  (`src/views/Cuaderno.tsx:420`) y esconde los botones de compartir, fijar-en-la-lista y
  eliminar cuando no sos el dueño (`src/views/Cuaderno.tsx:630`, `:649`, `:666`).
- El candado real no es la interfaz, es la base de datos. `note_folders` y `pins` solo
  devuelven filas propias (`supabase/schema.sql:142` y `:145`). `notes` deja **ver** y
  **actualizar** al dueño o a quien esté en `shared_with`, deja **insertar** solo al dueño
  y deja **borrar** solo al dueño (`supabase/schema.sql:149` a `:164`).
- El rol `admin` no aparece en ninguna de esas políticas: no existe un camino por el cual
  un Gerente lea notas ajenas.

## 3. Datos que usa

### Tabla `notes` (interface `Note`, `src/types.ts:65`)

| Campo | Qué significa | De dónde sale |
|---|---|---|
| `id` | Identificador de la nota | Lo genera la app con `uid()` al crearla (`src/views/Cuaderno.tsx:142`) |
| `user_id` / `userId` | Dueño de la nota | El usuario con sesión activa al momento de crearla |
| `folder_id` / `folderId` | Carpeta donde vive; `null` = sin carpeta | La carpeta seleccionada al crear la nota (`src/views/Cuaderno.tsx:139`) |
| `title` | Título | Lo escribe la persona en el campo de arriba del editor |
| `content` | Cuerpo de la nota, guardado como **HTML** | Lo que queda en el editor enriquecido (`src/views/Cuaderno.tsx:525`) |
| `pinned` | Si la nota va arriba en la lista de su dueño | Botón de chinche, en la lista o en la barra del editor |
| `updated_at` / `updatedAt` | Fecha y hora del último guardado hecho desde el editor | La estampa la app: `new Date().toISOString()` (`src/views/Cuaderno.tsx:426`) |
| `shared_with` / `sharedWith` | Lista de ids de personas con acceso de ver y editar | Pop-up "Compartir nota" (`src/views/Cuaderno.tsx:713`) |

### Tabla `note_folders` (interface `NoteFolder`, `src/types.ts:57`)

| Campo | Qué significa | De dónde sale |
|---|---|---|
| `id` | Identificador de la carpeta | `uid()` al crearla (`src/views/Cuaderno.tsx:454`) |
| `user_id` / `userId` | Dueño de la carpeta | El usuario con sesión activa |
| `name` | Nombre visible | Pop-up "Nueva carpeta" / "Renombrar carpeta" |
| `parent_id` / `parentId` | Carpeta madre; `null` = está en la raíz | Depende de desde dónde se creó (botón `+` de una carpeta o de la cabecera) |
| `position` | Orden manual | Se escribe una sola vez al crear: la cantidad de hermanas que ya existían (`src/views/Cuaderno.tsx:458`) |

### Tabla `pins` (interface `Pin`, `src/types.ts:77`)

| Campo | Qué significa | De dónde sale |
|---|---|---|
| `id` | Identificador del fijado | `uid()` |
| `user_id` / `userId` | De quién es el fijado | El usuario con sesión activa |
| `note_id` / `noteId` | La nota anclada en Mi Día | Botón "Fijar en Mi Día" (`src/views/Cuaderno.tsx:187`) |
| `text` | Texto de un recordatorio suelto, sin nota | Lo carga Mi Día, no este módulo |
| `position` | Orden dentro de "Fijados" | Cantidad de fijados que la persona ya tenía (`src/views/Cuaderno.tsx:191`) |

`content` guarda HTML plano en una columna de texto, no JSON. Las etiquetas que produce
la barra de herramientas son las que genera el navegador: `<b>`, `<i>`, `<u>`, `<ul>`,
`<ol>`, `<li>`, `<div>` y `<br>`.

## 4. Requisitos funcionales

| ID | Requisito | Detalle / regla | Dónde vive |
|---|---|---|---|
| RF-CUA-01 | El sistema debe mostrar, en una columna izquierda, el árbol de carpetas propias de la persona | Solo las carpetas cuyo `userId` es el usuario actual; se dibujan anidadas, con sangría de 14 px por nivel | `src/views/Cuaderno.tsx:78`, `:195`, `:207` |
| RF-CUA-02 | El sistema debe permitir crear una carpeta en la raíz o una subcarpeta dentro de otra | Pide el nombre en un pop-up; el botón Guardar queda apagado si el nombre está vacío | `src/views/Cuaderno.tsx:321`, `:222`, `:773` |
| RF-CUA-03 | El sistema debe permitir renombrar una carpeta | Mismo pop-up, precargado con el nombre actual | `src/views/Cuaderno.tsx:235`, `:754` |
| RF-CUA-04 | El sistema debe permitir eliminar una carpeta, previa confirmación, moviendo sus notas y subcarpetas a la carpeta madre | Texto exacto: «¿Eliminar la carpeta "X"? Sus notas y subcarpetas se moverán a la carpeta madre.» Nada se borra junto con ella | `src/views/Cuaderno.tsx:168`, `src/state/AppContext.tsx:424` |
| RF-CUA-05 | El sistema debe permitir plegar y desplegar una carpeta que tenga subcarpetas | La flecha solo reacciona si hay hijas; arranca desplegada | `src/views/Cuaderno.tsx:174`, `:212` |
| RF-CUA-06 | El sistema debe ofrecer una vista "Todas las notas" con el total de notas propias | Es la selección por defecto al entrar | `src/views/Cuaderno.tsx:59`, `:328` |
| RF-CUA-07 | El sistema debe ofrecer una vista "Compartidas conmigo" con las notas de otras personas que me incluyeron | Filtro: `userId` distinto al mío y `sharedWith` me incluye | `src/views/Cuaderno.tsx:86`, `:338` |
| RF-CUA-08 | El sistema debe mostrar, al costado de cada carpeta, cuántas notas propias tiene | Cuenta solo las notas cuyo `folderId` es esa carpeta exacta, sin sumar las de sus subcarpetas; si es cero no muestra nada | `src/views/Cuaderno.tsx:199`, `:252` |
| RF-CUA-09 | El sistema debe listar las notas de la selección actual con título, autor (si es ajena), fecha del último cambio y un adelanto del texto | El adelanto son los primeros 70 caracteres del texto sin etiquetas; si está vacío dice "Sin contenido" | `src/views/Cuaderno.tsx:300` |
| RF-CUA-10 | El sistema debe permitir buscar notas por título o por contenido | Sin distinguir mayúsculas ni acentos de más; busca dentro de la selección actual, no en todo el cuaderno | `src/views/Cuaderno.tsx:95`, `:382` |
| RF-CUA-11 | El sistema debe permitir crear una nota nueva, vacía, y abrirla en el editor | Nace con título y contenido vacíos, sin compartir y en la carpeta seleccionada | `src/views/Cuaderno.tsx:138` |
| RF-CUA-12 | El sistema debe permitir al dueño fijar y desfijar una nota para que quede arriba en su lista | El botón de chinche no aparece en las notas ajenas | `src/views/Cuaderno.tsx:280`, `:649` |
| RF-CUA-13 | El sistema debe guardar el título mientras se escribe, sin botón Guardar | Cada tecla dispara un guardado | `src/views/Cuaderno.tsx:678` |
| RF-CUA-14 | El sistema debe autoguardar el cuerpo de la nota 350 milisegundos después de la última tecla | Si se sigue escribiendo, el reloj se reinicia; así no se guarda letra por letra | `src/views/Cuaderno.tsx:523` |
| RF-CUA-15 | El sistema debe ofrecer formato enriquecido: negrita, cursiva, subrayado, lista con viñetas y lista numerada | Cinco botones en la barra superior; cada uno guarda al aplicarse | `src/views/Cuaderno.tsx:528`, `:595` a `:620` |
| RF-CUA-16 | El sistema debe reflejar en vivo los cambios que otra persona guardó en una nota compartida | Solo se reemplaza el contenido si el cursor NO está dentro del editor, para no borrar lo que estás tecleando | `src/views/Cuaderno.tsx:517` |
| RF-CUA-17 | El sistema debe permitir al dueño compartir la nota con personas puntuales del equipo | Pop-up con la lista de compañeros; se prende y apaga por persona; el propio dueño no aparece en la lista | `src/views/Cuaderno.tsx:422`, `:699` |
| RF-CUA-18 | El sistema debe mostrar en el editor de una nota ajena quién es su autor | Línea "Nota de <nombre>" debajo del título | `src/views/Cuaderno.tsx:685` |
| RF-CUA-19 | El sistema debe mostrar quiénes más están mirando la misma nota en este momento | Chip verde con las fotos y la palabra "en vivo"; funciona solo con Supabase conectado, no en modo demo | `src/views/Cuaderno.tsx:120`, `:622` |
| RF-CUA-20 | El sistema debe permitir fijar la nota abierta en la pantalla Mi Día, y quitarla de ahí | Crea o borra una fila en `pins`; cada persona tiene su propia lista de fijados, incluso para una nota ajena | `src/views/Cuaderno.tsx:182`, `:642` |
| RF-CUA-21 | El sistema debe exportar la nota abierta a un archivo PDF | Hoja A4 vertical, con el logo de ReEduca, la etiqueta "Cuaderno digital", el título, el autor y la fecha del último cambio | `src/views/Cuaderno.tsx:534` |
| RF-CUA-22 | El sistema debe permitir al dueño eliminar una nota, previa confirmación | Texto: «¿Eliminar la nota "X"?»; si era la nota abierta, el editor vuelve al estado vacío | `src/views/Cuaderno.tsx:157` |
| RF-CUA-23 | El sistema debe poder abrir una nota puntual cuando se la toca desde "Fijados" en Mi Día | Selecciona la nota y además acomoda la columna izquierda: la carpeta de la nota si es propia, "Compartidas conmigo" si es ajena | `src/views/Cuaderno.tsx:108`, `src/App.tsx:71` |
| RF-CUA-24 | En celular el sistema debe mostrar una sola columna por vez, con flechas para volver | Recorrido: carpetas → lista → editor. En pantalla grande las tres columnas se ven juntas | `src/views/Cuaderno.tsx:62`, `:363`, `:590` |
| RF-CUA-25 | Si la base de datos todavía no tiene la columna `shared_with`, el sistema debe guardar la nota sin ese campo en lugar de fallar | Reintento automático; la nota se guarda, lo que se pierde es solo el compartir | `src/lib/supabaseApi.ts:452` |

## 5. Reglas de negocio y cálculos

- **RN-CUA-01 · Orden de la lista de notas.** Primero las fijadas (`pinned`), y dentro de
  cada grupo, de la más recientemente editada a la más vieja, comparando `updatedAt` como
  texto ISO. Fórmula: `Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)`
  (`src/views/Cuaderno.tsx:98`). Visualmente se separan en dos bloques: "📌 Fijadas" y
  "Notas" (`src/views/Cuaderno.tsx:391`).
- **RN-CUA-02 · Orden de las carpetas.** Por `position` de menor a mayor y, en caso de
  empate, alfabético por nombre: `a.position - b.position || a.name.localeCompare(b.name)`
  (`src/views/Cuaderno.tsx:82`).
- **RN-CUA-03 · Qué es "mío" y qué es "compartido".** Propias: `userId === yo`
  (`src/views/Cuaderno.tsx:85`). Compartidas conmigo: `userId !== yo` **y**
  `sharedWith` contiene mi id (`src/views/Cuaderno.tsx:86`).
- **RN-CUA-04 · Búsqueda.** Se convierte el texto buscado a minúsculas y se compara
  contra el título en minúsculas y contra el contenido sin etiquetas HTML, también en
  minúsculas (`src/views/Cuaderno.tsx:95`). El limpiado de HTML lo hace `stripHtml`, que
  además colapsa los espacios repetidos (`src/lib/utils.ts:142`).
- **RN-CUA-05 · Carpeta de una nota nueva.** Si la selección es una carpeta, la nota nace
  ahí. Si la selección es "Todas las notas" o "Compartidas conmigo", nace sin carpeta
  (`folderId = null`) y, en el segundo caso, la vista salta a "Todas las notas" para que
  la nota recién creada sea visible (`src/views/Cuaderno.tsx:139`, `:152`).
- **RN-CUA-06 · Cuándo se re-estampa `updatedAt`.** Solo cuando el guardado pasa por el
  editor (`onSave`, `src/views/Cuaderno.tsx:426`): título, contenido, compartir y el
  chinche de la barra del editor. El chinche de la **lista** guarda la nota sin tocar
  `updatedAt` (`src/views/Cuaderno.tsx:286`).
- **RN-CUA-07 · Borrado de carpeta sin pérdida.** Las subcarpetas pasan a tener como
  madre a la madre de la carpeta borrada, y las notas pasan a esa misma carpeta madre
  (o a "sin carpeta" si la borrada estaba en la raíz). Primero se guardan los movimientos
  y solo después se borra la carpeta (`src/state/AppContext.tsx:424` a `:441`).
- **RN-CUA-08 · Posición de una carpeta nueva.** `position` = cantidad de carpetas
  hermanas que ya existían dentro de la misma madre (`src/views/Cuaderno.tsx:458`).
- **RN-CUA-09 · Nombre del archivo PDF.** Se toma el título, se le quitan los acentos,
  se borra todo lo que no sea letra, número, espacio o guion, se reemplazan los espacios
  por guiones y se pasa a minúsculas. Sin título, el archivo se llama `nota.pdf`
  (`src/views/Cuaderno.tsx:563`).
- **RN-CUA-10 · Presencia en vivo.** Se abre un canal por nota llamado
  `nota-<id de la nota>` y se listan las personas conectadas a ese canal, sacándose a uno
  mismo de la lista (`src/views/Cuaderno.tsx:126`). Requiere Supabase: en modo demo la
  lista queda vacía y el chip no aparece (`src/views/Cuaderno.tsx:124`).
- **RN-CUA-11 · Fecha visible.** En la lista se muestra día y mes abreviado
  (`src/views/Cuaderno.tsx:302`); en el editor y en el PDF, día, mes, año y hora, con
  formato `d MMM yyyy · HH:mm` en español (`src/lib/utils.ts:148`).

## 6. Pantalla y comportamiento

**En computadora** se ven tres columnas fijas, de izquierda a derecha:

1. **Carpetas** (224 px de ancho, fondo gris claro). Arriba el rótulo "Mi Cuaderno" y el
   botón de carpeta nueva. Después "Todas las notas" y "Compartidas conmigo" con sus
   contadores, una línea divisoria y el árbol de carpetas. Al pie, siempre visible, la
   leyenda «🔒 Tus notas son privadas, salvo las que decidas compartir.»
   (`src/views/Cuaderno.tsx:351`). Los botones de nueva subcarpeta, renombrar y eliminar
   aparecen al pasar el mouse por encima de la carpeta (`src/views/Cuaderno.tsx:220`).
2. **Lista de notas** (288 px). Título de la selección, botón de nota nueva, buscador y
   la lista. La nota abierta queda con fondo azul y texto blanco.
3. **Editor** (ocupa el resto). Barra de herramientas arriba, título grande, línea de
   contexto en gris y el cuerpo editable.

**En celular** (menos de 768 px, `src/lib/useIsMobile.ts:5`) se ve una sola columna por
vez. Tocar una carpeta lleva a la lista; tocar una nota lleva al editor. Hay una flecha
"volver" en la lista (hacia carpetas, `src/views/Cuaderno.tsx:363`) y otra en el editor
(hacia la lista, `src/views/Cuaderno.tsx:590`). Los botones de administrar carpetas están
siempre visibles, porque en celular no hay "pasar el mouse por encima"
(`src/views/Cuaderno.tsx:220`).

Estados vacíos:

- Sin ninguna nota abierta: ícono de cuaderno, el texto "Elegí una nota o creá una nueva"
  y un botón "+ Nueva nota" (`src/views/Cuaderno.tsx:430`).
- Carpeta sin notas: "Esta carpeta está vacía." (`src/views/Cuaderno.tsx:407`).
- "Compartidas conmigo" sin nada: "Todavía nadie compartió notas con vos."
  (`src/views/Cuaderno.tsx:406`).
- Búsqueda sin resultados: "No se encontraron notas." (`src/views/Cuaderno.tsx:404`).
- Nota sin título: en todos lados se la nombra "Nota nueva" (`src/views/Cuaderno.tsx:278`).

Estado de carga: el único visible de este módulo es el botón de exportar a PDF, que
mientras trabaja queda deshabilitado y titilando (`src/views/Cuaderno.tsx:661`). La carga
inicial de datos la maneja la pantalla general del sistema (`src/App.tsx:52`).

Estado de error: este módulo **no** muestra errores propios. Si un guardado falla, el
error se escribe en la consola del navegador y la pantalla sigue mostrando el cambio como
si se hubiera guardado (`src/state/AppContext.tsx:83`, `:411`). Ver sección 7.

## 7. Casos límite y errores

- **No hay carpetas ni notas todavía.** Funciona sin problema: se ve "Todas las notas"
  con el contador en cero y los estados vacíos de la sección 6.
- **Dos personas editan la misma nota compartida al mismo tiempo.** Gana el último
  guardado. Mientras tenés el cursor adentro del editor, lo que escribe la otra persona
  no te pisa la pantalla (`src/views/Cuaderno.tsx:519`), pero tu próximo autoguardado sí
  sobrescribe en la base lo que ella escribió. No hay fusión de cambios ni aviso de
  conflicto. El chip "en vivo" (RF-CUA-19) existe justamente para que la gente se dé
  cuenta y se coordine hablando.
- **Falla la base de datos o se corta internet.** El cambio se aplica en la pantalla
  igual, y el error queda solo en la consola del navegador
  (`src/state/AppContext.tsx:83`). O sea: puede pasar que veas la nota guardada y en la
  base no esté. Al recargar la página se ve la verdad.
- **Falta una columna en la base.** Si `notes` no tiene `shared_with` (base sin la
  migración de la Fase 3), el guardado se reintenta sin ese campo y la nota se guarda
  igual (`src/lib/supabaseApi.ts:452`). Si faltan las tablas `notes`, `note_folders` o
  `pins` enteras, la carga inicial de notas y carpetas corta con error
  (`src/lib/supabaseApi.ts:375` y `:376`) y el sistema muestra un cartel; `pins` en
  cambio se carga tolerando el error y queda vacío (`src/lib/supabaseApi.ts:379`).
- **Aviso de tiempo real sin el contenido.** Postgres a veces no manda las columnas
  grandes cuando no cambiaron. Para `notes`, si el aviso llega sin `content` o sin
  `shared_with`, el sistema conserva el valor que ya tenía en memoria en lugar de
  vaciarlo (`src/state/AppContext.tsx:116`).
- **Se borra una nota que alguien tenía fijada en Mi Día.** En la base el fijado se borra
  solo, por la regla en cascada de `pins.note_id` (`supabase/schema.sql:77`). En la
  pantalla de la otra persona el fijado queda en memoria hasta que recargue, pero Mi Día
  no lo dibuja si la nota no existe (`src/views/MiDia.tsx:275`).
- **Se comparte una nota con alguien y después se lo saca.** La persona deja de verla en
  el acto, tanto por la interfaz como por la base (`supabase/schema.sql:149`).
- **Se elimina del sistema a una persona que tenía notas compartidas.** Su id queda
  escrito en el `sharedWith` de esas notas: nadie lo limpia
  (`src/state/AppContext.tsx:400`). No rompe nada, pero el contador "Compartida con N
  personas" puede quedar inflado.
- **Nota muy larga al exportar.** El PDF se corta en páginas por sí mismo. No hay límite
  de tamaño y en notas grandes la exportación puede tardar varios segundos, con el botón
  titilando todo ese rato.

## 8. Criterios de aceptación

1. **CA-CUA-01** · Entrar a Cuaderno con una cuenta nueva. Se espera: columna izquierda
   con "Todas las notas" (0) y "Compartidas conmigo" (0), sin carpetas, y el mensaje
   "Elegí una nota o creá una nueva".
2. **CA-CUA-02** · Crear una carpeta "Reuniones" y dentro de ella una subcarpeta
   "Semanales". Se espera: "Semanales" aparece anidada bajo "Reuniones", con sangría, y
   "Reuniones" queda desplegada.
3. **CA-CUA-03** · Con "Semanales" seleccionada, crear una nota, escribirle un título y
   dos renglones. Esperar tres segundos, recargar la página y volver a entrar. Se espera:
   la nota está ahí, con el mismo título y el mismo texto, dentro de "Semanales".
4. **CA-CUA-04** · Aplicar negrita a una palabra y armar una lista con viñetas. Recargar.
   Se espera: la negrita y las viñetas se conservan.
5. **CA-CUA-05** · Fijar la nota con el botón de chinche. Se espera: la nota salta arriba,
   bajo el rótulo "📌 Fijadas", y el chinche queda amarillo.
6. **CA-CUA-06** · Escribir en el buscador una palabra que está solo en el cuerpo de una
   nota (no en su título). Se espera: esa nota aparece en la lista. Borrar el buscador:
   vuelven todas.
7. **CA-CUA-07** · Buscar una palabra inexistente. Se espera: "No se encontraron notas."
8. **CA-CUA-08** · Abrir una nota propia y tocar "Compartir con el equipo". Elegir a una
   compañera. Se espera: el ícono de compartir queda azul con el número 1, y debajo del
   título dice "Compartida con 1 persona".
9. **CA-CUA-09** · Entrar con la cuenta de esa compañera y abrir "Compartidas conmigo".
   Se espera: la nota aparece, con la foto del autor al costado y la leyenda "De
   <nombre>". Puede editar el texto, y **no** ve los botones de compartir ni de eliminar.
10. **CA-CUA-10** · Con una tercera persona (a la que NO se compartió), abrir Cuaderno.
    Se espera: "Compartidas conmigo" vacío. Esta persona no tiene ninguna forma de llegar
    a esa nota, ni siquiera un Gerente.
11. **CA-CUA-11** · Con la nota abierta en dos computadoras a la vez (dueño y persona
    compartida, sistema conectado a Supabase). Se espera: en las dos pantallas aparece el
    chip verde "en vivo" con la foto de la otra persona. Lo que una escribe aparece en la
    pantalla de la otra en un par de segundos, siempre que esa otra no esté escribiendo en
    ese momento.
12. **CA-CUA-12** · Tocar "Fijar en Mi Día" y después ir a la pestaña Mi Día. Se espera:
    la nota aparece en el bloque "Fijados", con el nombre de su carpeta. Al tocarla, el
    sistema salta al Cuaderno con esa nota abierta.
13. **CA-CUA-13** · Tocar "Exportar a PDF". Se espera: se descarga un archivo con el
    nombre de la nota en minúsculas y con guiones, y adentro se ve el logo de ReEduca, el
    título, el autor, la fecha y el texto con su formato.
14. **CA-CUA-14** · Eliminar la carpeta "Semanales" y aceptar la confirmación. Se espera:
    la carpeta desaparece y la nota que tenía adentro pasa a estar dentro de "Reuniones"
    (no se borra).
15. **CA-CUA-15** · Eliminar la nota y aceptar. Se espera: desaparece de la lista y el
    editor vuelve a "Elegí una nota o creá una nueva".
16. **CA-CUA-16** · Repetir CA-CUA-02 a CA-CUA-05 en un celular. Se espera: se ve una
    columna por vez y las flechas de "volver" llevan de editor a lista y de lista a
    carpetas.

## 9. Limitaciones conocidas y pendientes

1. **No se puede mover una nota de carpeta.** La carpeta se define al crear la nota y solo
   cambia si se borra la carpeta que la contiene (RN-CUA-07). No hay arrastrar y soltar ni
   un selector de carpeta en el editor.
2. **No se puede reordenar las carpetas.** La columna `position` existe y se escribe al
   crear (RN-CUA-08), pero no hay ninguna pantalla que la modifique después: en la
   práctica el orden termina siendo el de creación.
3. **La carpeta no "contiene" a sus subcarpetas para efectos de listado.** Al seleccionar
   una carpeta se ven únicamente las notas cuyo `folderId` es exactamente esa carpeta; las
   de sus subcarpetas no aparecen, y el buscador tampoco las alcanza
   (`src/views/Cuaderno.tsx:92`).
4. **Sin historial de versiones ni papelera.** Borrar una nota es definitivo, y de un
   cambio de texto no queda rastro anterior.
5. **La edición simultánea no tiene resolución de conflictos.** Gana el último que guarda
   (ver sección 7). El chip "en vivo" avisa, pero no protege.
6. **`updatedAt` no se actualiza al fijar desde la lista** (RN-CUA-06), así que la misma
   acción hecha desde la lista o desde la barra del editor deja la nota con distinta fecha.
   Es una inconsistencia menor que afecta el orden de la lista.
7. **Los errores de guardado no se le muestran a la persona.** Van a la consola del
   navegador. Para el Gerente General esto significa que, si la base no responde, la
   pantalla puede mentirle hasta que recargue.
8. **El formato enriquecido usa `document.execCommand`**
   (`src/views/Cuaderno.tsx:529`), una función que los navegadores marcan como obsoleta.
   Hoy funciona en todos, pero es deuda técnica conocida.
9. **No hay títulos, enlaces, imágenes, tablas ni adjuntos** en el editor: solo negrita,
   cursiva, subrayado y los dos tipos de lista.
10. **El PDF no tiene numeración de páginas ni pie de página**, y trae el ancho fijo de
    una hoja A4 vertical.
11. **La presencia en vivo no existe en modo demo** (RN-CUA-10), y tampoco muestra dónde
    está escribiendo la otra persona: solo dice que está mirando la nota.
