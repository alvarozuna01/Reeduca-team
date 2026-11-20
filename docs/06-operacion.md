# 06 · Operación

Cómo se trabaja, se publica y se mantiene el sistema en el día a día.

## 1. Las tres reglas de oro

1. **Publicar = hacer push a `main`.** Vercel compila y sirve esa rama sola. No hay otro botón.
2. **Lo nuevo va en una rama `beta/*`** y se merge a `main` recién cuando el Gerente General lo
   aprueba, con un "publicá".
3. **Las migraciones las corre una persona a mano** en Supabase. Publicar código no cambia la base.

## 2. Ambientes

| Ambiente | Para qué | Cómo se levanta | Datos |
|---|---|---|---|
| Desarrollo | Programar contra la base real | `npm run dev` (necesita `.env` con las claves) | Reales: cuidado |
| Demo | Probar sin riesgo | Configuración `demo` de `.claude/launch.json`, o `VITE_SUPABASE_URL=` vacío | De mentira, en el navegador |
| Producción | El equipo | `git push origin main` | Reales |

Variables de entorno (archivo `.env`, nunca se sube):

```
VITE_SUPABASE_URL=https://<proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=<clave anon pública>
```

Si faltan, la app arranca sola en modo demo.

## 3. Publicar un cambio

```bash
npx tsc -b                             # tipos
node node_modules/oxlint/bin/oxlint    # revisor de código
node node_modules/vite/bin/vite.js build   # compilación
```

Con los tres en verde y la prueba hecha en modo demo:

```bash
git checkout main && git merge --ff-only beta/<rama> && git push origin main
```

Después conviene confirmar que la versión nueva está arriba (el archivo `assets/index-*.js` que
sirve https://reeduca-team.vercel.app cambia de nombre en cada publicación).

## 4. Migraciones de base de datos

**Cómo se corre una:** Supabase → SQL Editor → New query → pegar el archivo entero → Run. Todas se
pueden correr dos veces sin romper nada.

| Archivo | Qué agrega |
|---|---|
| `schema.sql` | El esquema base: perfiles, proyectos, tareas, hitos, notas, carpetas, fijados, minutas, con sus RLS |
| `migracion-fase2.sql` | Urgencia e importancia en tareas, cuaderno |
| `migracion-fase3.sql` | Colaboración en tiempo real (incluye lo de la fase 2) |
| `migracion-datos.sql` | Los datos históricos de la planilla vieja: personas, proyectos, 759 tareas |
| `migracion-hitos-backlog.sql` | Bandeja sin fecha y módulo de Hitos |
| `migracion-comentarios.sql` | Tabla `task_comments` y la llave `FEATURE_COMENTARIOS` |
| `migracion-panel-pm.sql` | Lo que necesita el Panel del Gerente y la llave `FEATURE_PANEL` |
| `migracion-orden-proyectos.sql` | Columna de orden de los proyectos |
| `migracion-kickoff-1-llave.sql` | Tabla `feature_flags` y la llave `FEATURE_KICKOFF` |
| `migracion-kickoff-2-tablas.sql` | Tablas del kickoff y de consejos, columnas nuevas de minutas y tareas |
| `migracion-kickoff-3-briefing.sql` | Permisos para que el equipo deje su briefing |
| `migracion-crm-1-esquema.sql` | Todo el CRM: tablas `crm_*`, RLS por lista de acceso, tiempo real |
| *(fuera del repo)* `migracion-crm-2-datos.sql` | Los datos reales del CRM. No se sube: tiene datos personales de contactos |

El detalle columna por columna está en [03 · Modelo de datos](03-modelo-de-datos.md).

**Reglas al escribir una migración nueva:**

- Solo aditiva: `create table if not exists`, `add column if not exists`, políticas. Nunca `drop`,
  `truncate` ni `alter` que cambie o borre lo existente.
- Idempotente: correrla dos veces no puede fallar ni duplicar datos.
- Si la columna es nueva y el código ya está publicado, el guardado tiene que seguir funcionando
  sin ella (ver [02 · Arquitectura](02-arquitectura.md), sección 4.6).

## 5. Permisos del día a día

| Qué quiero | Dónde se hace |
|---|---|
| Prender un módulo para una persona | Panel del Gerente (o Equipo) → llaves por miembro |
| Prender un módulo para todo el equipo | Prender la fila global de esa llave (`user_id` nulo) en el Table Editor de Supabase |
| Dar o quitar acceso al CRM | Panel o Equipo → "Acceso al CRM" |
| Hacer Gerente a alguien | Equipo → cambiar su rol a admin |

## 6. Si algo sale mal

| Síntoma | Qué mirar |
|---|---|
| "No carga nada" | ¿Hay internet? ¿Supabase está caído? En la app, el aviso de error de datos |
| Una pestaña desapareció | Se apagó su llave, o le quitaron el acceso al CRM |
| Alguien no ve lo que otro ve | Es lo esperado en lo privado (cuaderno, briefing, anotaciones) y en el CRM |
| Un cambio no aparece en otra pantalla | Tiempo real caído: recargar la página. Los datos no se pierden |
| Se publicó algo que rompe | `git revert <commit>` y push a `main`; Vercel publica la versión corregida |
| Un dato quedó mal | Corregirlo desde la app. Tocar la base a mano es el último recurso |

## 7. Ramas

| Rama | Para qué |
|---|---|
| `main` | Lo que está publicado. Nunca se trabaja directo acá |
| `beta/*` | Trabajo nuevo (ej. `beta/crm`, `beta/docs`), hasta que se aprueba |

Los mensajes de commit van en español y explican el cambio en criollo.

## 8. Mantenimiento periódico sugerido

| Cada cuánto | Qué |
|---|---|
| Cuando cambia el código | Actualizar el documento del módulo tocado |
| Mensual | Revisar que las llaves prendidas sean las que corresponden |
| Trimestral | `npm outdated` y actualizar dependencias con calma, probando en demo |
| Antes de un cambio grande | Exportar una copia de las tablas desde Supabase |
