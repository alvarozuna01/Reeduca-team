# SRS · Hitos

| | |
|---|---|
| Código de módulo | MOD-HIT |
| Archivos de código | `src/views/Hitos.tsx`, `src/types.ts`, `src/state/AppContext.tsx`, `src/lib/supabaseApi.ts`, `src/lib/utils.ts` |
| Tablas que usa | `hitos`, `tasks` (columna `hito_id`), `projects` (solo lectura), `profiles` (solo lectura) |
| Quién lo ve | Todo el equipo |
| Llave (feature flag) | Ninguna |

## 1. Para qué sirve

Un hito es una meta grande de un proyecto: "Cierre de la Cohorte 1", "Entrega del informe
anual". No es una tarea que alguien hace en una tarde, es el punto de llegada al que apuntan
muchas tareas. Antes del sistema estas metas vivían en un Excel y nadie sabía con certeza
cuánto faltaba; hoy el hito muestra una barra de avance que se llena sola a medida que las
tareas vinculadas se marcan como completadas (`src/views/Hitos.tsx:102-112`).

Un día normal: el Gerente entra a la pestaña "Hitos", ve los hitos agrupados por proyecto, y
de un vistazo sabe cuáles están en fecha y cuáles ya vencieron (aparecen en rojo, con la
palabra "vencido"). Abre uno con la flechita y ve la lista de tareas que aportan a esa meta:
puede tildar una como completada, abrirla para editarla, o sacarla del hito. Si aparece una
tarea nueva que debería contar para el hito, usa el botón de la cadenita (🔗) y la vincula
desde la lista de tareas de ese proyecto.

La pantalla es de lectura rápida: no reemplaza al Kanban ni a la Agenda, sirve para la
conversación de "¿cómo venimos con esto?". Todo lo que se ve es un cálculo en vivo sobre las
tareas que ya están cargadas; el hito no guarda ningún porcentaje ni estado propio.

## 2. Usuarios y permisos

| Quién | Qué puede hacer | Qué NO puede hacer |
|---|---|---|
| Cualquiera del equipo (miembro) | Ver todos los hitos de todos los proyectos. Crear, editar y eliminar hitos. Vincular o desvincular **solo** las tareas que puede editar. | Vincular, desvincular o tildar tareas ajenas que ya tengan otros responsables. |
| Gerente (`role = 'admin'`) | Todo lo anterior, más vincular, desvincular y tildar **cualquier** tarea. | — |

La regla de edición de tareas la resuelve `canEditTask` (`src/lib/utils.ts:32-36`): un Gerente
siempre puede; el resto solo si la tarea no tiene responsables o si la persona está entre sus
responsables. La vista la aplica en tres lugares: el tilde de completar
(`src/views/Hitos.tsx:149`), el botón de desvincular (`src/views/Hitos.tsx:179`) y el modal de
vincular (`src/views/Hitos.tsx:302-307`). Cuando no se puede, el control queda apagado y el
globito dice "Solo sus responsables o un Gerente".

Ojo con una asimetría real del código: **crear, editar y eliminar un hito no tiene ningún
control de permiso**, ni en la pantalla (`src/views/Hitos.tsx:49`, `:123`, `:130`) ni en la
base, porque la política de seguridad de la tabla deja hacer todo a cualquier persona
autenticada (`supabase/migracion-hitos-backlog.sql:16-18`).

## 3. Datos que usa

Tabla `hitos` (`supabase/migracion-hitos-backlog.sql:8-14`), que en la app es la interface
`Hito` (`src/types.ts:87-93`). El traductor entre una y otra está en
`src/lib/supabaseApi.ts:105-119`.

| Campo (base) | Campo (app) | Qué significa | De dónde sale |
|---|---|---|---|
| `id` | `id` | Identificador único del hito. | Lo genera la app al crearlo (`src/views/Hitos.tsx:217`). |
| `project_id` | `projectId` | Proyecto al que pertenece. Obligatorio. | Lo elige la persona en el modal (`src/views/Hitos.tsx:238-255`). |
| `name` | `name` | Nombre de la meta. Obligatorio. | Escrito a mano. |
| `date` | `date` | Fecha objetivo. Puede quedar vacía. | Campo de fecha opcional (`src/views/Hitos.tsx:256-258`). |
| `position` | `position` | Orden de desempate cuando dos hitos tienen la misma fecha. | Al crear se usa la cantidad total de hitos que hay (`src/views/Hitos.tsx:221`). |

De la tabla `tasks` el módulo usa solo lo necesario para la barra y la lista desplegable:
`hito_id` (`src/types.ts:41`, columna creada en `supabase/migracion-hitos-backlog.sql:21`),
`title`, `date`, `position`, `status`, `assignee_ids` y `project_id`. De `projects` usa
`name` y `color`.

No hay ninguna columna con JSON en este módulo.

## 4. Requisitos funcionales

| ID | Requisito | Detalle / regla | Dónde vive |
|---|---|---|---|
| RF-HIT-01 | El sistema debe mostrar los hitos agrupados por proyecto. | Solo se muestran los proyectos que tienen al menos un hito. El orden de los proyectos es el que configuró el Gerente. | `src/views/Hitos.tsx:68-70`, orden en `src/state/AppContext.tsx:263-266` |
| RF-HIT-02 | El sistema debe ordenar los hitos de cada proyecto por fecha objetivo y, en empate, por `position`. | Los hitos sin fecha van al final (ver RN-HIT-01). | `src/views/Hitos.tsx:19` |
| RF-HIT-03 | El sistema debe mostrar, para cada hito, su nombre y su fecha objetivo en formato largo en español. | Sin fecha muestra el texto "Sin fecha objetivo". Con fecha muestra "🎯 5 de septiembre 2026". | `src/views/Hitos.tsx:96-101` |
| RF-HIT-04 | El sistema debe marcar en rojo y agregar " · vencido" a los hitos atrasados. | Definición en RN-HIT-02. | `src/views/Hitos.tsx:84`, `:97-99` |
| RF-HIT-05 | El sistema debe mostrar una barra de avance con el color del proyecto y el texto "completadas/total · porcentaje". | Fórmula en RN-HIT-03. | `src/views/Hitos.tsx:102-112` |
| RF-HIT-06 | El sistema debe permitir abrir y cerrar cada hito para ver sus tareas vinculadas. | El estado abierto/cerrado vive solo en la pantalla: al recargar, todos vuelven cerrados. | `src/views/Hitos.tsx:25-31`, `:88-94` |
| RF-HIT-07 | El sistema debe listar las tareas vinculadas ordenadas por fecha y, en empate, por `position`. | Las tareas sin fecha van al final y muestran el ícono 📥 en vez de una fecha. | `src/views/Hitos.tsx:78-80`, `:175-177` |
| RF-HIT-08 | El sistema debe permitir marcar una tarea vinculada como completada o volverla a pendiente desde el hito. | Alterna entre `done` y `todo`. Solo si la persona puede editar esa tarea. Al pasar a `done` el sistema estampa la fecha de cierre. | `src/views/Hitos.tsx:152-167`, estampa en `src/state/AppContext.tsx:91-97` |
| RF-HIT-09 | El sistema debe permitir abrir el editor completo de una tarea desde la lista del hito. | Abre el editor global de tareas de la aplicación. | `src/views/Hitos.tsx:168-174`, `src/App.tsx:82` |
| RF-HIT-10 | El sistema debe permitir desvincular una tarea del hito sin borrarla. | Pone `hitoId = null`. Solo si la persona puede editar esa tarea. En computadora el botón aparece al pasar el mouse; en celular está siempre visible. | `src/views/Hitos.tsx:179-187` |
| RF-HIT-11 | El sistema debe permitir crear un hito nuevo con nombre, proyecto y fecha objetivo opcional. | El botón "Guardar" queda apagado mientras falte el nombre o el proyecto. El nombre se guarda sin espacios sobrantes. | `src/views/Hitos.tsx:49-54`, `:215-224`, `:263-269` |
| RF-HIT-12 | El sistema debe permitir editar el nombre, el proyecto y la fecha de un hito existente. | Mismo modal que el alta, precargado. Conserva el `position` original. | `src/views/Hitos.tsx:209-224` |
| RF-HIT-13 | El sistema debe pedir confirmación antes de eliminar un hito y avisar cuántas tareas quedarán sin hito. | El texto cambia según haya o no tareas vinculadas. Las tareas NO se borran. | `src/views/Hitos.tsx:33-37` |
| RF-HIT-14 | Al eliminar un hito, el sistema debe dejar sus tareas sin hito. | La app lo hace en memoria y la base lo hace sola por la regla `on delete set null` de la columna. | `src/state/AppContext.tsx:469-476`, `supabase/migracion-hitos-backlog.sql:21` |
| RF-HIT-15 | El sistema debe ofrecer un buscador para vincular tareas existentes del mismo proyecto al hito. | Solo aparecen tareas del proyecto del hito. El filtro es por texto contenido en el título, sin distinguir mayúsculas. | `src/views/Hitos.tsx:280-284`, `:289-294` |
| RF-HIT-16 | En el buscador de vinculación, el sistema debe marcar con un tilde las tareas ya vinculadas a ese hito y avisar "en otro hito" las que pertenecen a otro. | Un clic vincula; otro clic desvincula. Vincular una tarea que estaba en otro hito la mueve. | `src/views/Hitos.tsx:299-325` |
| RF-HIT-17 | El sistema debe mostrar un estado vacío cuando no hay ningún hito cargado. | Texto: "Todavía no hay hitos." con la indicación de usar "+ Nuevo hito". | `src/views/Hitos.tsx:57-65` |
| RF-HIT-18 | El sistema debe mostrar un aviso cuando un hito abierto no tiene tareas vinculadas. | Texto: "Sin tareas vinculadas. Usá el botón 🔗 para vincular." | `src/views/Hitos.tsx:141-145` |
| RF-HIT-19 | El sistema debe reflejar al instante los hitos que crean o editan otras personas, sin recargar la página. | La tabla `hitos` está publicada en tiempo real. | `supabase/migracion-hitos-backlog.sql:23`, `src/lib/supabaseApi.ts:350` |
| RF-HIT-20 | El sistema debe seguir funcionando aunque la tabla `hitos` no exista todavía en la base. | Si la consulta falla, la lista queda vacía en lugar de romper la aplicación. | `src/lib/supabaseApi.ts:380` |
| RF-HIT-21 | Al eliminar un proyecto, el sistema debe eliminar también sus hitos. | En la base es una cascada de la clave foránea. | `src/state/AppContext.tsx:390`, `supabase/migracion-hitos-backlog.sql:10` |

## 5. Reglas de negocio y cálculos

- **RN-HIT-01 · Orden de los hitos.** Se ordenan por `date` como texto; los hitos sin fecha se
  tratan como si tuvieran la fecha `'9999'`, así quedan al final. Si dos tienen la misma fecha,
  desempata `position` de menor a mayor (`src/views/Hitos.tsx:19`).

- **RN-HIT-02 · Hito vencido.** Un hito está vencido cuando tiene fecha objetivo, esa fecha es
  anterior a hoy, y la cantidad de tareas completadas es menor que la cantidad de tareas
  vinculadas (`src/views/Hitos.tsx:84`). Consecuencia a tener presente: un hito con fecha
  pasada y **cero** tareas vinculadas NO se marca como vencido, porque `0 < 0` es falso.

- **RN-HIT-03 · Porcentaje de avance.** `porcentaje = redondear(completadas ÷ vinculadas × 100)`,
  donde "completadas" son las tareas vinculadas con `status = 'done'`. Si el hito no tiene
  tareas vinculadas, el porcentaje es 0 (`src/views/Hitos.tsx:81-82`).

- **RN-HIT-04 · Orden de las tareas dentro del hito.** Igual que RN-HIT-01: por fecha (las sin
  fecha al final) y, en empate, por `position` (`src/views/Hitos.tsx:78-80`).

- **RN-HIT-05 · Orden del buscador de vinculación.** Primero las tareas libres o ya vinculadas a
  este hito, después las que pertenecen a otro hito; dentro de cada grupo, por fecha
  (`src/views/Hitos.tsx:283-284`).

- **RN-HIT-06 · `position` al crear.** Un hito nuevo recibe como `position` la cantidad total de
  hitos que existen en ese momento, contando los de todos los proyectos
  (`src/views/Hitos.tsx:221`). No es un contador por proyecto.

- **RN-HIT-07 · Una tarea aporta a un solo hito.** `hitoId` es un único valor
  (`src/types.ts:41`): vincular una tarea a un hito la saca automáticamente del anterior
  (`src/views/Hitos.tsx:308`).

- **RN-HIT-08 · Fecha de cierre.** Al pasar una tarea a completada desde el hito, el sistema le
  estampa la fecha y hora de cierre; al volverla a pendiente, la borra
  (`src/state/AppContext.tsx:91-97`). Esa estampa es la que después alimenta el bloque 1 del
  Kickoff.

## 6. Pantalla y comportamiento

Encabezado fijo arriba: el título "Hitos", la frase "Las metas grandes de cada proyecto, con
las tareas que aportan a cumplirlas." y el botón azul "+ Nuevo hito"
(`src/views/Hitos.tsx:42-55`).

Debajo, una sección por proyecto: un puntito del color del proyecto y su nombre
(`src/views/Hitos.tsx:72-75`), y adentro las tarjetas de sus hitos. Cada tarjeta muestra:

1. Una flechita a la izquierda que gira 90° al abrir (`src/views/Hitos.tsx:88-94`).
2. El nombre del hito en negrita y, debajo, la fecha objetivo (gris) o "vencido" (rojo).
3. La barra de avance del color del proyecto, con el contador "3/8 · 38%".
4. Tres botones a la derecha: 🔗 vincular tareas, ✏️ editar el hito, 🗑️ eliminarlo.

Al abrir la tarjeta se despliega la lista de tareas sobre fondo gris claro: tilde verde de
completar, título (tachado y gris si ya está completada), fecha corta o 📥 si no tiene fecha,
los avatares de los responsables y la ✕ para desvincular
(`src/views/Hitos.tsx:139-193`).

Diferencias entre computadora y celular: la única es el botón de desvincular, que en pantallas
medianas y grandes está invisible hasta que se pasa el mouse por encima de la fila, y en
celular queda siempre a la vista (`src/views/Hitos.tsx:183`). El resto es la misma pantalla,
centrada en un ancho máximo y con scroll vertical (`src/views/Hitos.tsx:40-41`).

Los dos modales (crear/editar hito y vincular tareas) se cierran con la ✕, con el botón
"Cancelar"/"Listo" o tocando el fondo oscuro (`src/components/Modal.tsx:15-28`).

Estados:
- **Vacío general:** bandera gris grande y el texto "Todavía no hay hitos."
  (`src/views/Hitos.tsx:57-65`).
- **Vacío dentro de un hito:** "Sin tareas vinculadas. Usá el botón 🔗 para vincular."
  (`src/views/Hitos.tsx:141-145`).
- **Vacío del buscador:** "No hay tareas en este proyecto." (`src/views/Hitos.tsx:296-298`).
- **Carga:** este módulo no tiene pantalla de carga propia; mientras la aplicación carga los
  datos se ve el cargador general (`src/App.tsx:52-61`).
- **Error al guardar:** no hay aviso en pantalla. El error queda en la consola del navegador
  (`src/state/AppContext.tsx:83`).

## 7. Casos límite y errores

- **Sin datos.** Sin hitos: estado vacío. Con hitos pero sin tareas vinculadas: la barra queda
  en 0% y el hito nunca se marca como vencido (ver RN-HIT-02).
- **Sin proyectos.** El modal de alta arranca con el primer proyecto de la lista
  (`src/views/Hitos.tsx:212`); si no hay ninguno, `projectId` queda vacío y el botón "Guardar"
  permanece apagado.
- **Falla la base al guardar.** El cambio ya se ve en pantalla (se aplica primero en memoria) y
  el error se reporta solo en la consola (`src/state/AppContext.tsx:464-467`, `:83`). Si la
  persona recarga, el cambio no guardado se pierde sin aviso.
- **Falta la tabla `hitos`.** La carga inicial la trata como lista vacía y la aplicación sigue
  andando (`src/lib/supabaseApi.ts:380`); guardar sí va a fallar.
- **Dos personas editan a la vez.** Gana la última en guardar: no hay bloqueo ni control de
  versión. El tiempo real hace que la otra persona vea el cambio enseguida
  (`src/lib/supabaseApi.ts:350`).
- **Alguien borra el hito mientras otro lo tiene abierto.** El hito desaparece de la lista por
  tiempo real; las tareas que tenía siguen existiendo, sin hito.
- **Tarea vinculada de otro proyecto.** No puede pasar desde esta pantalla: el buscador solo
  ofrece tareas del mismo proyecto (`src/views/Hitos.tsx:281`). Si el proyecto de una tarea se
  cambia después desde el editor de tareas, la tarea queda vinculada a un hito de otro
  proyecto y se sigue mostrando en él.
- **Dos hitos con el mismo `position`.** Es esperable (ver RN-HIT-06) y no rompe nada: el orden
  entre ellos queda indefinido pero estable.

## 8. Criterios de aceptación

1. **CA-HIT-01.** Entrar a "Hitos" sin ningún hito cargado → se ve la bandera gris y el texto
   "Todavía no hay hitos.".
2. **CA-HIT-02.** Tocar "+ Nuevo hito", escribir un nombre, elegir un proyecto, dejar la fecha
   vacía y guardar → el hito aparece bajo su proyecto con el texto "Sin fecha objetivo" y la
   barra en "0/0 · 0%".
3. **CA-HIT-03.** Abrir el modal de alta y no escribir nombre → el botón "Guardar" está apagado
   y no se puede tocar.
4. **CA-HIT-04.** Tocar 🔗 en un hito, buscar una tarea del proyecto y tocarla → la fila queda
   con fondo azul y tilde; cerrar con "Listo" y abrir el hito → la tarea aparece en la lista.
5. **CA-HIT-05.** Con 2 tareas vinculadas, marcar 1 como completada → la barra pasa a
   "1/2 · 50%" sin recargar la página.
6. **CA-HIT-06.** Poner a un hito una fecha objetivo anterior a hoy, teniendo al menos una tarea
   vinculada sin completar → la fecha se ve en rojo y termina con " · vencido".
7. **CA-HIT-07.** Al mismo hito, completar todas sus tareas → la fecha deja de estar en rojo y
   desaparece la palabra "vencido".
8. **CA-HIT-08.** Como miembro del equipo (no Gerente), abrir un hito con una tarea asignada a
   otra persona → el tilde y la ✕ están apagados y el globito dice "Solo sus responsables o un
   Gerente".
9. **CA-HIT-09.** Tocar 🗑️ en un hito con 3 tareas vinculadas → el aviso dice que las 3 tareas
   NO se borran; aceptar → el hito desaparece y las 3 tareas siguen existiendo en el Kanban,
   sin hito.
10. **CA-HIT-10.** Vincular a un hito B una tarea que ya estaba en el hito A → en el hito A la
    tarea ya no aparece y en el buscador del hito A figura con el cartelito "en otro hito".
11. **CA-HIT-11.** Con la aplicación abierta en dos computadoras, crear un hito en una → en la
    otra aparece en pocos segundos sin recargar.
12. **CA-HIT-12.** Desde el hito, tocar el título de una tarea → se abre el editor completo de
    esa tarea.

## 9. Limitaciones conocidas y pendientes

- **No hay control de permisos sobre el hito en sí.** Cualquier persona del equipo puede crear,
  renombrar, mover de proyecto o eliminar cualquier hito, tanto desde la pantalla
  (`src/views/Hitos.tsx:49`, `:123`, `:130`) como desde la base
  (`supabase/migracion-hitos-backlog.sql:16-18`). Es una asimetría con las tareas, donde sí
  hay regla.
- **No se puede reordenar a mano.** El campo `position` existe y se guarda, pero no hay ningún
  control en la pantalla para cambiarlo: solo sirve como desempate de fechas iguales.
- **Un hito con fecha vencida y sin tareas no se marca como vencido** (RN-HIT-02).
- **El hito no tiene descripción, responsable ni estado propio.** Solo nombre, proyecto, fecha
  y posición (`src/types.ts:87-93`).
- **El avance cuenta tareas, no esfuerzo.** Una tarea de diez minutos pesa lo mismo que una de
  dos semanas.
- **No hay aviso de error en pantalla.** Si falla el guardado, el usuario no se entera
  (`src/state/AppContext.tsx:83`).
- **El estado abierto/cerrado de cada hito no se recuerda** entre visitas ni entre recargas
  (`src/views/Hitos.tsx:15`).
- **El buscador de vinculación no filtra por estado:** también ofrece tareas ya completadas
  (`src/views/Hitos.tsx:280-284`, `:320`).
- **Los hitos que vinieron del Excel** se cargaron a mano en
  `supabase/migracion-hitos-backlog.sql:27-374`, con identificadores fijos. Esa migración es de
  única vez; no hay un proceso de importación reutilizable.
