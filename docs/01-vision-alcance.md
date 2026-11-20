# 01 · Visión y alcance

## 1. Qué es

**ReEduca · Gestión de Equipo** es la plataforma web interna de ReEduca (organización educativa
paraguaya de robótica y tecnología educativa: FIFA Foundation, Liga Nacional de Robótica, Aulas
4.0, VEX) donde el equipo lleva su trabajo del día a día: tareas, agenda, proyectos, hitos,
minutas de reunión, notas personales, el kickoff de los lunes y el CRM de instituciones.

- **Producción:** https://reeduca-team.vercel.app
- **Repositorio:** `alvarozuna01/Reeduca-team`, rama `main` (publicar = hacer push a `main`).
- **Usuarios:** el equipo interno de ReEduca, hoy unas 7 personas con cuenta.
- **Costo de infraestructura:** cero (planes gratuitos de Supabase y Vercel).

Reemplazó a una planilla de Google Sheets con Apps Script ("REEDUCA · Sistema"), cuyos datos
históricos se migraron completos (759 tareas y 8 proyectos, ver `supabase/migracion-datos.sql`),
y en septiembre de 2026 absorbió también el CRM comercial, que vivía en otra planilla.

## 2. Para qué existe

| Problema que había | Lo que hace el sistema |
|---|---|
| El trabajo vivía en planillas y en WhatsApp: nadie veía el conjunto | Una sola pantalla por persona ("Mi Día") y una agenda semanal compartida |
| Las decisiones del Gerente se pedían por mensaje y se perdían | Cualquiera marca una tarea como "necesita decisión del Gerente" y entra en una cola visible en el Panel |
| Las reuniones no dejaban rastro accionable | Minutas con acciones acordadas que se convierten en tareas con un clic |
| El lunes se improvisaba | Kickoff semanal que se arma solo con los datos de la plataforma |
| El seguimiento comercial dependía de una planilla que solo entendía quien la armó | CRM adentro del sistema, con las mismas reglas y colores de la planilla, y las gestiones apareciendo en la agenda |

## 3. Quiénes lo usan

Hay **dos roles** en el sistema:

| Rol | Quién | Qué puede hacer de más |
|---|---|---|
| `admin` ("Gerente") | Gerencia General y Presidencia | Ve el Panel del Gerente, administra personas, llaves y accesos, edita tareas de cualquiera |
| `member` ("Equipo") | El resto del equipo | Todo lo demás: sus tareas, la agenda, el Kanban, minutas, hitos, su cuaderno |

Equipo real cargado en la base (`supabase/migracion-datos.sql`):

| Persona | Cargo | Rol |
|---|---|---|
| Álvaro Ozuna | Gerente General | admin |
| Guillermo Figueredo | Presidente | admin |
| Pablo Guershanik | Director Pedagógico | member |
| Diana Benitez | Asesora Pedagógica de Campo | member |
| Luciana Gomez | Directora de Marketing y Comercial | member |
| Malena Rojas | Auxiliar Administrativa y Comercial | member |
| Auxiliar de Formación, MEC, Proveedor externo, Equilibrium, Alejandro | Actores externos o históricos | member sin cuenta (existen solo para poder asignarles tareas) |

Además hay **dos permisos que no son el rol**:

- **Llaves (feature flags):** prenden un módulo para una persona. Hoy: `FEATURE_KICKOFF`,
  `FEATURE_PANEL`, `FEATURE_COMENTARIOS`. Ver [00-transversal](04-srs/00-transversal.md).
- **Acceso al CRM:** una lista de personas (tabla `crm_accesos`) que la base hace cumplir de
  verdad. Hoy: Álvaro, Luciana y Malena. Ver [12-crm](04-srs/12-crm.md).

## 4. Alcance

### Está adentro

1. Tareas con fecha, horario, horas, urgencia, importancia (1 a 5 estrellas), responsables
   múltiples, proyecto, hito, checklist, enlaces y comentarios.
2. Vistas de trabajo: Mi Día, Agenda semanal, Kanban, Hitos, Proyectos.
3. Minutas de reunión con acciones acordadas y conversión manual a tarea.
4. Kickoff semanal de los lunes, con briefing personal y anotaciones privadas.
5. Cuaderno de notas privado por persona, con carpetas, compartir puntual y exportar a PDF.
6. Panel del Gerente: cola de decisiones, carga por persona, estado por proyecto.
7. CRM de instituciones: embudo de venta, posventa, objetivo 2027, fichas, cadena de acciones y
   bitácora.
8. Trabajo en vivo: lo que cambia una persona aparece al instante en la pantalla de las demás.
9. Uso desde el celular, con la app instalable (PWA).

### Está afuera (decisiones tomadas, no olvidos)

| Fuera del alcance | Por qué |
|---|---|
| Inteligencia artificial sobre transcripciones de reuniones | Se descartó para no gastar tokens de API. En su lugar, Minutas trae un estándar manual. La tabla `consejos` y las columnas de transcripción quedaron inertes en la base |
| "Consejo de la semana" | Eliminado por pedido del Gerente General |
| Notificaciones automáticas (mail, push, WhatsApp) | Decisión explícita: nada de notificaciones al equipo |
| Gamificación, puntajes o KPIs individuales del equipo | Decisión explícita: el sistema no mide personas |
| Que algo se convierta en tarea automáticamente | Regla dura: toda tarea nace de un clic humano ("Convertir en tarea") |
| Facturación, sueldos, inventario | No es un ERP |
| App nativa de celular | Se usa el navegador; la web es instalable |

## 5. Reglas del producto que no se negocian

Estas reglas condicionan todo el resto de la documentación:

1. **Nada se convierte en tarea automáticamente.** El botón "Convertir en tarea" de las minutas es
   el punto de aprobación humano.
2. **El sistema no puede romperse:** lo usa el equipo todos los días. Todo lo nuevo va detrás de
   una llave o en una rama de prueba hasta que el Gerente General lo aprueba.
3. **Las migraciones de base de datos son solo aditivas.** Nunca se borra ni se altera lo que ya
   existe (nada de `drop`, `truncate` ni `alter` destructivos).
4. **Sin notificaciones ni métricas individuales del equipo.**
5. **Privacidad real donde se promete privacidad:** el cuaderno, el briefing y las anotaciones
   privadas están protegidos por la base de datos, no solo por la interfaz.

## 6. Historia corta

| Cuándo | Qué pasó |
|---|---|
| Primera mitad de 2026 | Sistema base: tareas, agenda, Kanban, proyectos, hitos, minutas, cuaderno. Migración de la planilla vieja |
| 2026-09-09 | Comentarios en tareas y Panel del Gerente (llaves `FEATURE_COMENTARIOS` y `FEATURE_PANEL`) |
| 2026-09-14 | Menciones con @, selectores de proyecto y personas, orden configurable de proyectos, pop-ups del Panel. Kickoff funcionando con datos reales; estándar manual de minutas |
| 2026-09-21 | CRM de instituciones adentro del sistema, con acceso por lista. Datos reales migrados desde la planilla comercial |
| 2026-09-21 | El CRM toma el aspecto y las funciones de la vista "Lu · Venta" de la planilla vieja |
| 2026-09-22 | "Necesita decisión del Gerente" pasa a estar disponible para todo el equipo |
| 2026-09-29 | Esta documentación |
