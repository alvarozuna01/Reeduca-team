# Documentación · ReEduca · Gestión de Equipo

Documentación completa del sistema: qué hace, cómo está construido, cómo están guardados los
datos y qué debe cumplir cada módulo (SRS, *Software Requirements Specification*: la
especificación de requisitos, o sea la lista de todo lo que el sistema tiene que hacer).

Escrita en dos niveles a la vez: se entiende sin saber programar, y a la vez dice exactamente en
qué archivo y en qué línea vive cada cosa, para que un programador (o una IA) pueda mantenerla.

**Última revisión: 2026-09-29.** La documentación se escribió leyendo el código publicado en
`main` a esa fecha. Si cambia el código, hay que actualizar el documento del módulo que cambió.

## Por dónde empezar

| Si querés… | Leé |
|---|---|
| Entender qué es el sistema y para quién | [01 · Visión y alcance](01-vision-alcance.md) |
| Saber cómo está armado por dentro | [02 · Arquitectura](02-arquitectura.md) |
| Saber dónde está guardado cada dato | [03 · Modelo de datos](03-modelo-de-datos.md) |
| Ver qué tiene que hacer cada módulo | [04 · SRS por módulo](#04--srs-por-módulo) |
| Saber qué se le exige al sistema en seguridad, velocidad y celular | [05 · Requisitos no funcionales](05-requisitos-no-funcionales.md) |
| Publicar, migrar la base o resolver un problema | [06 · Operación](06-operacion.md) |
| Ver de un vistazo qué requisito vive en qué archivo | [07 · Trazabilidad](07-trazabilidad.md) |
| Entender una palabra del sistema | [08 · Glosario](08-glosario.md) |
| Ver qué cosas del sistema no cierran y conviene revisar | [09 · Hallazgos](09-hallazgos.md) |

## 04 · SRS por módulo

| Módulo | Prefijo | Quién lo ve | Documento |
|---|---|---|---|
| Transversal (cuenta, roles, llaves, tiempo real, comentarios, menciones) | TRV | Todos | [00-transversal.md](04-srs/00-transversal.md) |
| Tareas (la entidad y su ventana de edición) | TAR | Todos | [01-tareas.md](04-srs/01-tareas.md) |
| Mi Día | MID | Todos | [02-mi-dia.md](04-srs/02-mi-dia.md) |
| Agenda semanal | AGE | Todos | [03-agenda.md](04-srs/03-agenda.md) |
| Kanban | KAN | Todos | [04-kanban.md](04-srs/04-kanban.md) |
| Hitos | HIT | Todos | [05-hitos.md](04-srs/05-hitos.md) |
| Minutas de reunión | MIN | Todos | [06-minutas.md](04-srs/06-minutas.md) |
| Kickoff semanal | KIC | Con llave FEATURE_KICKOFF | [07-kickoff.md](04-srs/07-kickoff.md) |
| Cuaderno (notas) | CUA | Todos, privado por persona | [08-cuaderno.md](04-srs/08-cuaderno.md) |
| Proyectos | PRO | Todos | [09-proyectos.md](04-srs/09-proyectos.md) |
| Panel del Gerente | PAN | Gerentes con FEATURE_PANEL | [10-panel-gerente.md](04-srs/10-panel-gerente.md) |
| Equipo (personas y permisos) | EQU | Gerentes | [11-equipo.md](04-srs/11-equipo.md) |
| CRM de instituciones | CRM | Lista de acceso al CRM | [12-crm.md](04-srs/12-crm.md) |

## Cómo se leen los códigos

- **RF-XXX-01** — Requisito funcional: algo que el sistema tiene que hacer.
- **RN-XXX-01** — Regla de negocio: un cálculo o una regla de ReEduca que el sistema aplica.
- **CA-XXX-01** — Criterio de aceptación: la prueba manual que demuestra que se cumple.
- `src/views/Agenda.tsx:120` — dónde vive en el código: archivo y línea.

## Qué NO es esta documentación

- No es un manual de uso paso a paso para el equipo. Describe el comportamiento del sistema, no
  enseña a usarlo.
- No es un plan de trabajo. Lo que hoy no existe aparece como "limitación conocida", sin promesas
  de cuándo se haría.
- No reemplaza al código: si algún día el documento y el código no coinciden, manda el código y
  hay que corregir el documento.

## Documentos anteriores

- `README.md` (raíz del repo) — instrucciones para correr el proyecto en una computadora.
- `SISTEMA-REEDUCA-TEAM.md` (raíz del repo) — manual del sistema de agosto de 2026, anterior al
  Kickoff, al Panel del Gerente, a los comentarios y al CRM. Queda como referencia histórica; lo
  vigente es esta carpeta.
