# SRS · Minutas de reuniones

| | |
|---|---|
| Código de módulo | MOD-MIN |
| Archivos de código | `src/views/Minutas.tsx`, `src/types.ts`, `src/state/AppContext.tsx`, `src/lib/supabaseApi.ts`, `src/components/Selectores.tsx` |
| Tablas que usa | `minutes`, `tasks` (escribe al convertir), `profiles` (solo lectura), `projects` (solo lectura) |
| Quién lo ve | Todo el equipo |
| Llave (feature flag) | Ninguna |

## 1. Para qué sirve

Las minutas son el registro escrito de cada reunión: qué reunión fue, quiénes estuvieron, qué
se habló y qué se acordó hacer. El problema que resuelven no es archivar por archivar: es que
lo que se acuerda en una reunión termine efectivamente en el Kanban de alguien, con nombre y
fecha. Antes eso se perdía entre el cuaderno de uno y el WhatsApp del otro.

Un día normal: termina la reunión, alguien entra a "Minutas", toca "+ Nueva", le pone un título
de verdad, marca a los que estuvieron, escribe el resumen y carga las acciones acordadas — una
por línea, cada una con su responsable y su fecha. Mientras escribe, el bloque "Estándar de
minutas" le va marcando en verde lo que ya cumplió y en gris lo que falta, así la minuta no
queda a medio hacer. Al final, para cada acción que tiene que entrar al Kanban, toca
"Convertir en tarea": se abre un modal chico, confirma título, proyecto, fecha y responsables,
y la tarea nace. Las acciones que no se convierten quedan igual como registro de la reunión.

**Ese clic es el punto de aprobación de todo el sistema: nada entra al Kanban sin que una
persona lo confirme.** No hay ningún proceso automático que cree tareas a partir de una minuta.
La única excepción es el Kickoff semanal, que al cerrarse genera una minuta con sus acciones
acordadas — pero esas acciones también quedan esperando el clic de "Convertir en tarea"
(`src/views/Kickoff.tsx:140-150`).

## 2. Usuarios y permisos

| Quién | Qué puede hacer | Qué NO puede hacer |
|---|---|---|
| Cualquiera del equipo (miembro o Gerente) | Ver todas las minutas. Crear una minuta. Editar el título, la fecha, los participantes, el resumen y las acciones de **cualquier** minuta. Eliminar cualquier minuta. Convertir cualquier acción en tarea. | — |

No hay roles diferenciados en este módulo: ni la pantalla ni la base distinguen entre Gerente y
miembro. La política de seguridad de la tabla permite todo a cualquier persona autenticada
(`supabase/migracion-fase3.sql:61-63`). El único límite práctico es el borrado: pide
confirmación y avisa que las tareas ya creadas no se borran
(`src/views/Minutas.tsx:38-44`).

La tarea que se crea al convertir una acción sí queda sujeta a las reglas del módulo de tareas:
una vez creada, solo sus responsables o un Gerente la pueden editar.

## 3. Datos que usa

Tabla `minutes` (`supabase/migracion-fase2.sql:34-41`, ampliada en
`supabase/migracion-kickoff-2-tablas.sql:14-17`), que en la app es la interface `Minute`
(`src/types.ts:114-124`). El traductor está en `src/lib/supabaseApi.ts:139-161`.

| Campo (base) | Campo (app) | Qué significa | De dónde sale |
|---|---|---|---|
| `id` | `id` | Identificador único. | Lo genera la app (`src/views/Minutas.tsx:26`). |
| `title` | `title` | Nombre de la reunión. Arranca como "Nueva minuta". | Escrito a mano (`src/views/Minutas.tsx:125-130`). |
| `date` | `date` | Fecha de la reunión (AAAA-MM-DD). Arranca en hoy. | Campo de fecha (`src/views/Minutas.tsx:141-143`). |
| `participant_ids` | `participantIds` | Lista de personas que estuvieron. Al crear la minuta incluye solo a quien la crea. | Avatares que se prenden y apagan (`src/views/Minutas.tsx:144-167`). |
| `summary` | `summary` | El resumen en texto libre. | Escrito a mano, o desde la plantilla (`src/views/Minutas.tsx:172-182`). |
| `actions` | `actions` | JSON con la lista de acciones acordadas. Forma abajo. | `src/views/Minutas.tsx:184-263`. |
| `transcripcion` | `transcripcion` | Resto del módulo de IA descartado. Queda inerte. | Nadie la escribe (ver sección 9). |
| `transcripcion_cargada_at` | `transcripcionCargadaAt` | Ídem. Queda inerte. | Nadie la escribe. |
| `estado_procesamiento` | `estadoProcesamiento` | Ídem. Solo se escribe el valor fijo `'sin_transcripcion'`. | `src/views/Kickoff.tsx:147`, `src/lib/supabaseApi.ts:160`. |

Forma del JSON de cada elemento de `actions` (interface `MinuteAction`,
`src/types.ts:97-110`):

```json
{
  "id": "uuid de la acción",
  "text": "Enviar la propuesta al colegio",
  "taskId": "uuid de la tarea — solo si ya se convirtió",
  "responsableSugeridoId": "uuid del perfil responsable",
  "fechaSugerida": "2026-10-06",
  "origen": "manual",
  "citaOrigen": "…",
  "responsableSugeridoNombre": "…",
  "descartada": false,
  "editada": false
}
```

Los cuatro últimos campos son del módulo de IA descartado y hoy están inertes (sección 9). Los
nombres `responsableSugeridoId` y `fechaSugerida` quedaron del diseño original, pero en la
pantalla actual **no son sugerencias: son el responsable y la fecha que la persona carga a
mano** (`src/views/Minutas.tsx:233-247`).

De `tasks` el módulo solo escribe al convertir una acción (`src/views/Minutas.tsx:409-427`) y
lee el título y el estado de la tarea ya creada (`src/views/Minutas.tsx:192`).

## 4. Requisitos funcionales

| ID | Requisito | Detalle / regla | Dónde vive |
|---|---|---|---|
| RF-MIN-01 | El sistema debe listar todas las minutas de la más nueva a la más vieja. | Orden por fecha descendente. | `src/views/Minutas.tsx:21` |
| RF-MIN-02 | El sistema debe mostrar en cada renglón de la lista el título, la fecha en palabras, los avatares de los participantes y el conteo de acciones. | Si hay acciones convertidas, agrega en verde "· N → tareas". | `src/views/Minutas.tsx:88-98` |
| RF-MIN-03 | El sistema debe abrir automáticamente la minuta más reciente al entrar. | Si no hay ninguna seleccionada, toma la primera de la lista ordenada. | `src/views/Minutas.tsx:22` |
| RF-MIN-04 | El sistema debe permitir crear una minuta nueva en un clic. | Nace con título "Nueva minuta", fecha de hoy, la persona que la crea como único participante, resumen vacío y sin acciones. Queda seleccionada. | `src/views/Minutas.tsx:24-36` |
| RF-MIN-05 | El sistema debe permitir editar el título de la minuta. | Es un campo de texto grande en el encabezado del detalle; se guarda al escribir. | `src/views/Minutas.tsx:125-130` |
| RF-MIN-06 | El sistema debe permitir cambiar la fecha de la reunión. | Selector de fecha del navegador. | `src/views/Minutas.tsx:141-143` |
| RF-MIN-07 | El sistema debe permitir marcar y desmarcar participantes tocando su avatar. | Los que no están quedan atenuados; los que están, con un anillo azul. Se ve el nombre al pasar el mouse. | `src/views/Minutas.tsx:144-167` |
| RF-MIN-08 | El sistema debe permitir escribir un resumen libre de la reunión. | Área de texto de 5 líneas, con la ayuda "¿Qué se habló? ¿Qué se decidió?". | `src/views/Minutas.tsx:172-182` |
| RF-MIN-09 | El sistema debe mostrar el estándar del equipo para completar una minuta, con siete reglas escritas. | Se despliega con el enlace "cómo se completa". | `src/views/Minutas.tsx:297-305`, `:367-375` |
| RF-MIN-10 | El sistema debe ofrecer una plantilla de resumen con los títulos "Temas tratados", "Decisiones tomadas" y "Trabas o riesgos". | Si el resumen ya tiene texto, pide confirmación antes de reemplazarlo. | `src/views/Minutas.tsx:288-295`, `:328-331` |
| RF-MIN-11 | El sistema debe mostrar en vivo un checklist de cinco puntos con lo que falta para que la minuta esté completa. | Los cinco puntos y su condición exacta están en RN-MIN-01. | `src/views/Minutas.tsx:314-324`, `:353-365` |
| RF-MIN-12 | El sistema debe mostrar un contador "N de 5" y cambiar a "Completa ✓" en verde cuando se cumplen los cinco puntos. | El recuadro entero pasa de gris a verde. | `src/views/Minutas.tsx:325-326`, `:334-344` |
| RF-MIN-13 | El sistema debe permitir agregar acciones acordadas, una por línea. | El botón "+ Agregar acción" crea una fila vacía. | `src/views/Minutas.tsx:258-263` |
| RF-MIN-14 | El sistema debe permitir escribir el texto de cada acción con la ayuda "Empezá con un verbo: Enviar, Definir, Confirmar…". | Se guarda al escribir. | `src/views/Minutas.tsx:203-208` |
| RF-MIN-15 | El sistema debe permitir elegir un responsable y una fecha ("Para cuándo") para cada acción. | El responsable se elige de una lista desplegable de personas; la fecha, con el selector del navegador. | `src/views/Minutas.tsx:233-247`, `src/components/Selectores.tsx:233` |
| RF-MIN-16 | El sistema debe señalar visualmente las acciones incompletas. | Fondo ámbar y el texto "falta el responsable o la fecha" (ver RN-MIN-02). | `src/views/Minutas.tsx:196-199`, `:248-252` |
| RF-MIN-17 | El sistema debe permitir eliminar una acción. | Sin confirmación. Si la acción ya generó una tarea, la tarea NO se borra. | `src/views/Minutas.tsx:226-231` |
| RF-MIN-18 | El sistema debe ofrecer el botón "Convertir en tarea" en cada acción que todavía no generó una. | Abre el modal de conversión. Es el único camino por el que una acción entra al Kanban. | `src/views/Minutas.tsx:217-225` |
| RF-MIN-19 | El modal de conversión debe precargar el título con el texto de la acción, el primer proyecto de la lista, la fecha de la acción (o hoy si no tiene) y como responsables el responsable de la acción (o todos los participantes de la minuta si no hay). | Todo es editable antes de crear. | `src/views/Minutas.tsx:402-407` |
| RF-MIN-20 | El modal de conversión debe crear una tarea nueva en estado "Por hacer", con la descripción `Acción acordada en la minuta: "<título de la minuta>".`. | La tarea nace sin checklist, sin enlaces, no urgente y con importancia 0. Se ubica al final de las tareas de ese día (RN-MIN-03). | `src/views/Minutas.tsx:409-427` |
| RF-MIN-21 | El modal de conversión debe impedir crear la tarea si falta el título o el proyecto. | El botón "Crear tarea" queda apagado. | `src/views/Minutas.tsx:448-453` |
| RF-MIN-22 | Después de convertir, el sistema debe guardar en la acción el identificador de la tarea creada y mostrar el botón verde "Tarea creada". | Ese botón abre el editor de la tarea. Ya no se puede volver a convertir la misma acción. | `src/views/Minutas.tsx:274-279`, `:209-216` |
| RF-MIN-23 | El sistema debe permitir eliminar una minuta, con confirmación, avisando que las tareas ya creadas no se borran. | Al borrar, se deselecciona; en celular vuelve a la lista. | `src/views/Minutas.tsx:38-44`, `:131-137` |
| RF-MIN-24 | En celular, el sistema debe mostrar una pantalla por vez: primero la lista, después el detalle, con un botón "‹ Minutas" para volver. | El corte es a menos de 768 px de ancho. | `src/views/Minutas.tsx:18-19`, `:54-57`, `:116-123`, `src/lib/useIsMobile.ts:3-12` |
| RF-MIN-25 | El sistema debe mostrar estados vacíos cuando no hay minutas y cuando no hay ninguna seleccionada. | "Todavía no hay minutas. Creá la primera con «+ Nueva»." y "Elegí una minuta o creá una nueva". | `src/views/Minutas.tsx:69-73`, `:106-113` |
| RF-MIN-26 | El sistema debe reflejar al instante los cambios que hacen otras personas sobre una minuta. | La tabla está publicada en tiempo real; los campos grandes que Postgres omite en el aviso se conservan del valor local. | `supabase/migracion-fase3.sql:105`, `src/lib/supabaseApi.ts:348`, `src/state/AppContext.tsx:120-125` |
| RF-MIN-27 | El sistema debe poder guardar una minuta incluso en una base que no corrió la migración de las columnas de transcripción. | Si el guardado falla por esas columnas, reintenta sin ellas. | `src/lib/supabaseApi.ts:163-169`, `:475-483` |

## 5. Reglas de negocio y cálculos

- **RN-MIN-01 · Los cinco puntos del estándar** (`src/views/Minutas.tsx:314-324`). Cada uno se
  cumple exactamente cuando:

  | Punto | Condición exacta |
  |---|---|
  | Título claro | El título, sin espacios sobrantes, no está vacío **y** no es "Nueva minuta". |
  | Participantes | Hay **2 o más** participantes marcados. |
  | Resumen completo | El resumen, sin espacios sobrantes, tiene **100 caracteres o más**. |
  | Acciones acordadas | Hay al menos **una** acción con texto. |
  | Responsable y fecha en cada acción | Hay al menos una acción con texto **y todas** las que tienen texto tienen responsable **y** fecha. |

  Las acciones sin texto no se cuentan para ningún punto (`src/views/Minutas.tsx:314`).

- **RN-MIN-02 · Acción completa.** Una acción está completa cuando tiene texto, responsable y
  fecha (`src/views/Minutas.tsx:193`). Una acción incompleta y sin tarea se dibuja con borde y
  fondo ámbar; una acción completa, o ya convertida en tarea, se dibuja en blanco
  (`src/views/Minutas.tsx:196-199`).

- **RN-MIN-03 · Posición de la tarea creada.** La tarea nueva se ubica al final de las tareas de
  su fecha: `position = (máxima posición de las tareas de ese día) + 1`, o 0 si ese día no tiene
  ninguna (`src/views/Minutas.tsx:410`, `:419`).

- **RN-MIN-04 · Una acción, una tarea.** Una acción con `taskId` ya no muestra el botón de
  convertir (`src/views/Minutas.tsx:209`): no se puede generar dos tareas de la misma acción
  desde la pantalla.

- **RN-MIN-05 · Borrar no propaga.** Borrar una acción o una minuta entera no borra las tareas
  que ya se crearon a partir de ellas (`src/views/Minutas.tsx:39`). Al revés también: borrar la
  tarea deja la acción con un `taskId` que ya no existe, y el botón "Tarea creada" desaparece
  porque la búsqueda no la encuentra (`src/views/Minutas.tsx:192`) — la acción vuelve a
  ofrecer "Convertir en tarea".

- **RN-MIN-06 · Guardado continuo.** Cada tecla que se escribe en el título, el resumen o una
  acción dispara un guardado completo de la minuta (`src/views/Minutas.tsx:46-49`). No hay
  botón "Guardar" ni espera: gana el último que escribe.

- **RN-MIN-07 · Alta desde el Kickoff.** Al cerrar un kickoff, el sistema crea una minuta
  titulada "Kickoff semanal · <fecha en palabras>", con los presentes como participantes, un
  resumen armado de los cinco bloques y una acción por cada acción acordada
  (`src/views/Kickoff.tsx:140-150`). Esas acciones llegan **sin responsable ni fecha**, así que
  en esta pantalla aparecen en ámbar hasta que alguien las complete.

## 6. Pantalla y comportamiento

Dos paneles. A la izquierda, la lista de minutas: el título "Minutas de reuniones", el botón
azul "+ Nueva" y los renglones, el activo con borde y fondo azul claro
(`src/views/Minutas.tsx:54-102`). A la derecha, el detalle, de arriba hacia abajo:

1. **Encabezado:** el título editable en letra grande y el tacho de basura para eliminar
   (`src/views/Minutas.tsx:124-138`).
2. **Fecha y Participantes**, uno al lado del otro en pantallas de tablet para arriba
   (`src/views/Minutas.tsx:140-168`).
3. **Estándar de minutas:** el recuadro con el ícono de libro, el contador "N de 5" o
   "Completa ✓", los cinco chips del checklist y el enlace "cómo se completa" que despliega las
   siete reglas numeradas más el botón "+ Usar la plantilla del resumen"
   (`src/views/Minutas.tsx:170`, `:333-384`).
4. **Resumen de la reunión:** área de texto de cinco líneas (`src/views/Minutas.tsx:172-182`).
5. **Acciones acordadas:** recuadro gris con el aviso "Una acción por línea, con responsable y
   fecha. Lo que tiene que entrar al Kanban se convierte en tarea con un clic; el resto queda
   como registro de la reunión." Cada acción es una tarjetita con el texto arriba, el botón azul
   "Convertir en tarea" (o el verde "Tarea creada") y el tacho; abajo, "RESPONSABLE" con su
   desplegable y "PARA CUÁNDO" con su fecha. Al pie, el enlace "+ Agregar acción"
   (`src/views/Minutas.tsx:184-264`).

**Diferencias entre computadora y celular.** En computadora los dos paneles se ven juntos: la
lista fija de 320 px a la izquierda y el detalle a la derecha. En celular se ve uno por vez: al
tocar una minuta se pasa al detalle y arriba aparece el botón "‹ Minutas" para volver
(`src/views/Minutas.tsx:18-19`, `:54-57`, `:106`, `:116-123`). Al crear una minuta nueva en
celular, el sistema salta directo al detalle (`src/views/Minutas.tsx:35`).

El modal "Convertir acción en tarea" tiene cuatro campos — Título, Proyecto, Fecha y
Responsables — y los botones "Cancelar" y "Crear tarea"
(`src/views/Minutas.tsx:429-457`). Se cierra también tocando el fondo oscuro
(`src/components/Modal.tsx:17`).

Estados: vacíos ya descritos en RF-MIN-25; carga, la de la aplicación entera
(`src/App.tsx:52-61`); error de guardado, sin aviso visible — queda en la consola
(`src/state/AppContext.tsx:83`).

## 7. Casos límite y errores

- **Ninguna minuta.** Panel izquierdo con el texto de invitación y panel derecho con el ícono de
  portapapeles (`src/views/Minutas.tsx:69-73`, `:106-113`).
- **Minuta recién creada.** El checklist marca 0 de 5: el título todavía es "Nueva minuta" y
  hay un solo participante, y el punto de participantes pide 2 o más.
- **Acción sin texto.** No cuenta para el checklist, pero sí se puede convertir en tarea si se
  le escribe algo; con el texto vacío el botón "Crear tarea" del modal queda apagado
  (`src/views/Minutas.tsx:448-450`).
- **Sin proyectos cargados.** El modal de conversión arranca con el proyecto vacío
  (`src/views/Minutas.tsx:403`) y el botón "Crear tarea" queda apagado.
- **Dos personas editan la misma minuta a la vez.** Cada tecla guarda la minuta entera
  (RN-MIN-06): el último en escribir sobrescribe al otro, incluso en campos distintos. No hay
  bloqueo, aviso ni mezcla de cambios. Es el riesgo más concreto de este módulo.
- **Falla la base al guardar.** El cambio se ve en pantalla igual (se aplica primero en memoria)
  y el error queda solo en la consola (`src/state/AppContext.tsx:444-447`, `:83`).
- **Base sin la migración de transcripción.** El guardado se reintenta automáticamente sin esas
  tres columnas (`src/lib/supabaseApi.ts:475-483`).
- **Aviso de tiempo real incompleto.** Si Postgres no incluye `actions`, `summary`,
  `participant_ids` o `transcripcion` en el aviso, la app conserva el valor que ya tenía en vez
  de vaciarlo (`src/state/AppContext.tsx:120-125`).
- **Borrar la minuta de un kickoff cerrado.** El kickoff queda apuntando a una minuta que ya no
  existe; el bloque 2 del kickoff siguiente no encuentra nada y aparece vacío
  (`src/lib/kickoffData.ts:94-97`).
- **Acción cuyo `taskId` apunta a una tarea borrada.** Vuelve a mostrar "Convertir en tarea"
  (RN-MIN-05): se puede crear una segunda tarea.

## 8. Criterios de aceptación

1. **CA-MIN-01.** Entrar a "Minutas" sin ninguna cargada → a la izquierda "Todavía no hay
   minutas…" y a la derecha "Elegí una minuta o creá una nueva".
2. **CA-MIN-02.** Tocar "+ Nueva" → aparece una minuta llamada "Nueva minuta" con la fecha de
   hoy, con uno mismo ya marcado como participante, y el estándar muestra "0 de 5".
3. **CA-MIN-03.** Cambiar el título a algo distinto de "Nueva minuta" → el chip "Título claro"
   se pone verde.
4. **CA-MIN-04.** Marcar un segundo participante → el chip "Participantes" se pone verde.
5. **CA-MIN-05.** Escribir un resumen de menos de 100 caracteres → "Resumen completo" sigue
   gris; pasar los 100 → se pone verde.
6. **CA-MIN-06.** Tocar "cómo se completa" → se despliegan siete reglas numeradas y el botón
   "+ Usar la plantilla del resumen".
7. **CA-MIN-07.** Con el resumen ya escrito, tocar "Usar la plantilla del resumen" → aparece un
   aviso preguntando si se reemplaza; cancelar → el resumen queda igual.
8. **CA-MIN-08.** Agregar una acción con texto pero sin responsable ni fecha → la tarjetita
   queda con fondo ámbar y el texto "falta el responsable o la fecha".
9. **CA-MIN-09.** Completar responsable y fecha de esa acción → la tarjetita pasa a blanco y el
   chip "Responsable y fecha en cada acción" se pone verde.
10. **CA-MIN-10.** Con los cinco chips verdes → el recuadro entero se pone verde y el contador
    dice "Completa ✓".
11. **CA-MIN-11.** Tocar "Convertir en tarea" en una acción con responsable y fecha → el modal
    aparece con el título de la acción, esa fecha y ese responsable ya cargados.
12. **CA-MIN-12.** Confirmar con "Crear tarea" → el botón de la acción pasa a verde "Tarea
    creada", el renglón de la minuta en la lista suma "· 1 → tareas", y la tarea aparece en el
    Kanban con la descripción `Acción acordada en la minuta: "<título>".`.
13. **CA-MIN-13.** Tocar "Tarea creada" → se abre el editor de esa tarea.
14. **CA-MIN-14.** Borrar la acción ya convertida → la tarea sigue existiendo en el Kanban.
15. **CA-MIN-15.** Tocar el tacho de la minuta → el aviso dice que las tareas ya creadas no se
    borran; aceptar → la minuta desaparece y las tareas siguen.
16. **CA-MIN-16.** En un celular (o con la ventana angosta, menos de 768 px), tocar una minuta →
    se ve solo el detalle y arriba el botón "‹ Minutas"; tocarlo → vuelve a la lista.
17. **CA-MIN-17.** Con la aplicación abierta en dos computadoras, agregar una acción en una → en
    la otra aparece en pocos segundos sin recargar.
18. **CA-MIN-18.** Cerrar un kickoff con dos acciones acordadas → en "Minutas" aparece una minuta
    "Kickoff semanal · …" con esas dos acciones, en ámbar (sin responsable ni fecha).

## 9. Limitaciones conocidas y pendientes

- **El módulo de IA sobre transcripciones fue descartado.** Quedan restos que **no se usan**:
  - Las columnas `transcripcion`, `transcripcion_cargada_at` y `estado_procesamiento` de la
    tabla `minutes` (`supabase/migracion-kickoff-2-tablas.sql:14-17`). Se leen y se escriben en
    el mapeo (`src/lib/supabaseApi.ts:146-160`) pero ninguna pantalla las carga; el valor que se
    guarda es siempre `'sin_transcripcion'`.
  - Los campos `origen`, `citaOrigen`, `responsableSugeridoNombre`, `descartada` y `editada` de
    cada acción (`src/types.ts:101-109`). Solo `origen` se escribe, y siempre con el valor
    `'manual'` (`src/views/Kickoff.tsx:146`); `descartada` se lee en un filtro del Kickoff
    (`src/lib/kickoffData.ts:99`) pero nadie la pone en verdadero.
  - El tipo `EstadoProcesamiento` (`src/types.ts:112`) queda inerte.
  - La tabla `consejos` y sus políticas (`supabase/migracion-kickoff-2-tablas.sql:25-44`), con
    todo su cableado en la aplicación (`src/types.ts:128-141`,
    `src/state/AppContext.tsx:501-509`, `src/lib/supabaseApi.ts:240-268`): **ninguna pantalla la
    usa**. Queda inerte.
  - Los campos `responsableSugeridoId` y `fechaSugerida` sí se usan, pero con otro sentido del
    que dice su nombre: hoy son el responsable y la fecha cargados a mano
    (`src/views/Minutas.tsx:235-247`).
- **No hay permisos.** Cualquier persona del equipo puede editar o borrar la minuta de cualquier
  otra reunión, incluida la que generó un kickoff cerrado
  (`supabase/migracion-fase3.sql:61-63`).
- **Guardado por cada tecla, sin mezcla de cambios.** Dos personas escribiendo a la vez se
  sobrescriben (RN-MIN-06). No hay debounce, ni aviso de conflicto, ni historial de versiones.
- **El estándar no obliga a nada.** El checklist es informativo: se puede guardar y dejar una
  minuta en "0 de 5" sin que el sistema lo impida.
- **Borrar una acción no pide confirmación** (`src/views/Minutas.tsx:226-231`).
- **No se puede reordenar ni marcar como cumplida una acción** dentro de la minuta: el
  seguimiento se hace en la tarea, si se convirtió.
- **No hay buscador ni filtros** en la lista de minutas, ni paginado: se cargan todas
  (`src/lib/supabaseApi.ts:370`).
- **No hay adjuntos ni enlaces** en la minuta.
- **No se puede exportar ni imprimir** la minuta desde la pantalla.
- **La minuta que genera el Kickoff llega con acciones sin responsable ni fecha** (RN-MIN-07):
  siempre requiere una pasada manual.
