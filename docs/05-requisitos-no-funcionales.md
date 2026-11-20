# 05 · Requisitos no funcionales

Lo que el sistema tiene que cumplir más allá de "qué hace cada botón": seguridad, privacidad,
velocidad, celular, disponibilidad y mantenimiento. Los códigos son `RNF-01`, `RNF-02`…

## 1. Seguridad y privacidad

| ID | Requisito | Cómo se cumple hoy |
|---|---|---|
| RNF-01 | Nadie entra sin sesión iniciada | Supabase Auth con email y contraseña; sin sesión, la app solo muestra el login (`src/views/Login.tsx`) |
| RNF-02 | Los permisos se hacen cumplir en la base, no en la pantalla | Reglas RLS por tabla; la pantalla solo acompaña. Ver [03 · Modelo de datos](03-modelo-de-datos.md) |
| RNF-03 | Lo privado es privado de verdad | Cuaderno, fijados, briefing personal y anotaciones privadas tienen políticas por dueño: los datos de otro ni siquiera llegan al navegador |
| RNF-04 | El CRM lo ve solo quien está en la lista | Tabla `crm_accesos` + funciones `security definer`; además sus datos solo se descargan si hay acceso (`src/crm/CrmProvider.tsx`) |
| RNF-05 | Ningún secreto en el repositorio | `.env` ignorado por git; la clave `anon` es pública por diseño y está protegida por RLS |
| RNF-06 | Datos personales de terceros fuera del repositorio | La carpeta de migración del CRM (teléfonos y mails de contactos) está en `.gitignore`; el modo demo usa datos inventados |
| RNF-07 | Cambiar de contraseña desde la app | Modal de perfil en `src/components/TopBar.tsx` |
| RNF-08 | Quitar un permiso tiene efecto en el momento | Llaves y accesos viajan por tiempo real: apagar una llave saca la pestaña sin recargar |

## 2. Velocidad y volumen

| ID | Requisito | Cómo se cumple hoy |
|---|---|---|
| RNF-09 | Cambiar de pestaña o filtrar tiene que ser instantáneo | Todo está en memoria; las vistas filtran y ordenan en el navegador |
| RNF-10 | Guardar se siente inmediato | Escritura optimista: primero la pantalla, después la base |
| RNF-11 | El sistema aguanta el volumen actual con holgura | Hoy: ~760 tareas, ~150 instituciones, ~500 acciones de CRM. La carga inicial trae todo en una sola tanda |
| RNF-12 | Límite conocido | El diseño "todo en memoria" deja de convenir en el orden de decenas de miles de filas. Si se llega ahí hay que paginar, y eso es un rediseño de la capa de datos |

## 3. Celular y navegadores

| ID | Requisito | Cómo se cumple hoy |
|---|---|---|
| RNF-13 | Todas las vistas se usan con el pulgar, sin desplazamiento horizontal | Diseño adaptable; la barra inferior se desliza cuando hay muchas pestañas |
| RNF-14 | Lo que no se puede hacer en celular tiene otro camino | Arrastrar y soltar es de computadora: mover una acción del CRM también se hace desde su ventana de edición |
| RNF-15 | Se instala como app | `public/manifest.webmanifest` (modo `standalone`, ícono e color de marca) |
| RNF-16 | Navegadores soportados | Los actuales con soporte de módulos de JavaScript: Chrome, Safari, Edge y Firefox, en computadora y celular. No se soporta Internet Explorer |

## 4. Disponibilidad y datos

| ID | Requisito | Cómo se cumple hoy |
|---|---|---|
| RNF-17 | Publicar no puede cortar el servicio | Vercel publica una versión nueva y recién entonces la sirve; quien esté adentro sigue con la versión vieja hasta recargar |
| RNF-18 | Ninguna migración destruye datos | Regla dura: solo `create if not exists`, `add column if not exists` y políticas; nunca `drop`, `truncate` ni `alter` destructivos |
| RNF-19 | Correr dos veces la misma migración no rompe nada | Todos los `.sql` son idempotentes |
| RNF-20 | Respaldo de la base | Los que hace Supabase en su plan; no hay respaldo propio programado. **Limitación conocida** |
| RNF-21 | Si la base no responde, la app lo dice | `dataError` en el estado global; las listas quedan vacías en vez de romperse |

## 5. Mantenimiento

| ID | Requisito | Cómo se cumple hoy |
|---|---|---|
| RNF-22 | El código se entiende en español | Nombres, comentarios y textos de interfaz en español; los comentarios explican el porqué |
| RNF-23 | Antes de publicar: tipos, revisor y compilación en verde | `npx tsc -b`, `oxlint` y `vite build` |
| RNF-24 | Lo nuevo se prueba sin tocar datos reales | Modo demo con datos de mentira |
| RNF-25 | Lo nuevo entra por una rama de prueba y una llave | Ramas `beta/*`; publicar es exclusivamente hacer push a `main` |
| RNF-26 | Agregar una entidad tiene un camino conocido | `types.ts` → `api.ts` → `supabaseApi.ts` (+ tiempo real) → `localApi.ts` → `seed.ts` → `AppContext.tsx` → un `.sql` |
| RNF-27 | Cada módulo tiene su especificación escrita | Esta carpeta `docs/` |

## 6. Idioma y accesibilidad

| ID | Requisito | Cómo se cumple hoy |
|---|---|---|
| RNF-28 | Todo en español, con fechas en español | `date-fns` con locale `es` |
| RNF-29 | Contraste y tamaños legibles en celular | Paleta de marca con texto oscuro sobre fondos claros |
| RNF-30 | Se puede navegar con teclado lo esencial | Botones y campos nativos; los bloques que no son botones llevan `role` y responden a Enter. **Limitación conocida:** no hubo auditoría de accesibilidad completa |
