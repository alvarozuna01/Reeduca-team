# 08 · Glosario

Las palabras que se usan en el sistema y en esta documentación. Primero las del negocio, después
las técnicas.

## Del sistema y del equipo

| Palabra | Qué significa acá |
|---|---|
| **Gerente** | Usuario con rol `admin`. Hoy: Gerencia General y Presidencia |
| **Equipo / miembro** | Usuario con rol `member`: todos los demás |
| **Tarea** | La unidad de trabajo: qué hay que hacer, cuándo y quién |
| **Hito** | Una fecha importante de un proyecto (una entrega, un evento), con sus tareas colgando |
| **Proyecto** | El programa o frente de trabajo al que pertenece una tarea. Tiene color propio |
| **Urgente** | Marca de sí o no en la tarea, no un cálculo |
| **Importancia** | Calificación de 1 a 5 estrellas. Las de 4 y 5 aparecen sí o sí en Mi Día |
| **Necesita decisión del Gerente** | Marca que pone cualquiera en una tarea para que entre en la cola de decisiones del Panel |
| **Minuta** | El acta de una reunión: participantes, resumen y acciones acordadas |
| **Acción acordada** | Compromiso salido de una reunión. No es una tarea hasta que alguien toca "Convertir en tarea" |
| **Convertir en tarea** | El clic humano que aprueba que algo entre al sistema de tareas. Nada se convierte solo |
| **Kickoff** | La reunión de arranque de los lunes, que el sistema arma con 5 bloques |
| **Briefing personal** | Las dos preguntas que cada persona responde antes del kickoff |
| **Anotación privada** | Comentario personal dentro del kickoff. Solo lo ve quien lo escribió, salvo que lo comparta |
| **Cuaderno** | Las notas privadas de cada persona, con carpetas |
| **Fijados** | Notas o recordatorios anclados en Mi Día |
| **Llave (feature flag)** | Interruptor que prende un módulo para una persona o para todos |
| **Modo demo** | La app corriendo con datos de mentira en el navegador, sin tocar la base real |

## Del CRM

| Palabra | Qué significa acá |
|---|---|
| **Institución** | El colegio, universidad o academia con el que se trabaja |
| **Segmento** | Colegio, Universidad o Academia |
| **Oportunidad** | Una venta (o un cliente ya ganado) de una institución, con su modalidad |
| **Modalidad** | Curricular (dentro del horario de clase) o Extracurricular |
| **Etapa** | En qué punto del embudo está la venta: contacto inicial, en seguimiento, propuesta enviada, cerrado ganado, cerrado no ganado, etc. |
| **Venta / Posventa / Perdida** | No se guardan: se deducen de la etapa. Ganada es posventa, no ganada es perdida, el resto es venta |
| **Estado posventa** | Cómo está un cliente ya ganado: activo, activo-LNR, en stand by, inactivo |
| **Acción / gestión** | Cada contacto con la institución: llamada, mensaje, mail, reunión, flyer, presupuesto… |
| **Cadena de acciones** | Todas las acciones de una oportunidad, en orden |
| **Semáforo** | Verde hecha, naranja pendiente, rojo vencida (pendiente con fecha pasada) |
| **Próxima acción** | La pendiente más cercana en fecha |
| **LNR** | Liga Nacional de Robótica. Las invitaciones a la Liga se registran aparte de la venta |
| **Objetivo 2027** | Institución marcada para insistir y que arranque en 2027 |
| **Bitácora** | El registro automático de quién cambió qué y cuándo, dentro del CRM |
| **Ficha** | La pantalla completa de una institución: ventas, contactos, historial y bitácora |

## Técnicas

| Palabra | Qué significa |
|---|---|
| **SRS** | *Software Requirements Specification*: la lista escrita de todo lo que el sistema debe hacer |
| **RF / RN / CA** | Requisito funcional / regla de negocio / criterio de aceptación |
| **SPA** | Aplicación de una sola página: el navegador arma las pantallas sin recargar |
| **Supabase** | El servicio que da la base de datos PostgreSQL, el login y el tiempo real |
| **PostgreSQL** | La base de datos |
| **RLS** | *Row Level Security*: las reglas de la base que deciden qué filas puede ver o tocar cada usuario |
| **Política** | Una regla RLS concreta sobre una tabla |
| **`security definer`** | Función que corre con permisos del dueño; se usa para preguntar "¿tiene acceso al CRM?" sin que las políticas se llamen entre sí sin fin |
| **Migración** | Un archivo `.sql` que agrega algo a la base |
| **Idempotente** | Que se puede correr dos veces sin romper ni duplicar nada |
| **Realtime / tiempo real** | El aviso que manda Supabase cuando cambia una fila, para que las pantallas se actualicen solas |
| **Escritura optimista** | Mostrar el cambio en pantalla antes de confirmar que la base lo guardó |
| **camelCase / snake_case** | `necesitaDecisionGg` en el código, `necesita_decision_gg` en la base |
| **jsonb** | Columna de la base que guarda un objeto JSON (por ejemplo la checklist de una tarea) |
| **PWA** | Aplicación web instalable en el celular |
| **Vercel** | El servicio que sirve la app y publica sola desde `main` |
| **localStorage** | Memoria del navegador donde viven el modo demo y las preferencias |
| **Rama `beta/*`** | Donde se trabaja lo nuevo antes de publicarlo |
