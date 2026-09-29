# 02 · Arquitectura

## 1. La idea en una frase

Es una aplicación web de una sola página (SPA) que corre **entera en el navegador** y habla
directo con Supabase (la base de datos). **No hay servidor propio ni backend**: no hay código
nuestro corriendo en ningún servidor, así que la seguridad no puede depender de la pantalla —
la hace cumplir la base de datos con sus reglas de acceso (RLS).

```
Navegador (React)  ──►  Supabase
  │                       ├── PostgreSQL (los datos + las reglas RLS)
  │                       ├── Auth (usuarios y contraseñas)
  │                       └── Realtime (avisos de cambios en vivo)
  └── localStorage (modo demo y preferencias del navegador)

Vercel sirve los archivos estáticos (HTML, JS, CSS) y publica solo desde la rama main.
```

## 2. Tecnologías

| Pieza | Qué es | Versión |
|---|---|---|
| React 19 | La librería con la que se dibuja la interfaz | `^19.2.8` |
| TypeScript | JavaScript con tipos, para que los errores salten antes de publicar | `~6.0.2` |
| Vite 8 | El empaquetador: arma el sitio y da el servidor de desarrollo | `^8.2.0` |
| Tailwind CSS 4 | Los estilos, escritos como clases en el HTML | `^4.3.3` |
| dnd-kit | Arrastrar y soltar (agenda y Kanban) | `^6.3.1` |
| date-fns | Cuentas con fechas, en español | `^4.4.0` |
| lucide-react | Los íconos | `^1.32.0` |
| html2pdf.js | Exportar una nota a PDF | `^0.14.0` |
| @supabase/supabase-js | Cliente de la base, login y tiempo real | `^2.112.3` |
| oxlint | Revisor de código | `^1.75.0` |

## 3. Mapa de carpetas

```
src/
  App.tsx               Arma la pantalla: barra, vista elegida, ventana de tarea
  types.ts              Los tipos de datos de toda la app (Task, Project, Minute…)
  index.css             Tema de Tailwind (fuente Poppins y azul de marca)
  state/
    AppContext.tsx      El estado global: todo lo que la app tiene en memoria + acciones
  lib/
    api.ts              El contrato de la capa de datos (qué se puede guardar y borrar)
    supabaseApi.ts      Implementación real contra Supabase (+ tablas en tiempo real)
    localApi.ts         Implementación de "modo demo" en localStorage
    seed.ts             Datos de mentira del modo demo
    supabaseClient.ts   Crea el cliente, o null si no hay configuración (→ modo demo)
    utils.ts            Fechas, colores, ids, helpers de tareas
    menciones.ts        Detección de @menciones en texto
    kickoffData.ts      Los cálculos de los bloques del kickoff
    usePref.ts          Preferencias que se recuerdan en ese navegador
  components/           Piezas compartidas (ventana de tarea, tarjetas, selectores, modales…)
  views/                Una pantalla por módulo (MiDia, Agenda, Kanban, Hitos, Minutas,
                        Kickoff, Cuaderno, Proyectos, Panel, Equipo, Login)
  crm/                  El CRM completo, con su propio estado y su propia capa de datos
supabase/               Los .sql que se pegan a mano en el editor SQL de Supabase
docs/                   Esta documentación
```

## 4. Cómo viajan los datos

### 4.1 Una sola carga y todo en memoria

Al entrar, la app pide **todo** con `api.load()` y lo guarda en memoria
(`src/state/AppContext.tsx:128` en adelante). Las pantallas no consultan la base: filtran y
ordenan lo que ya está cargado. Por eso las vistas son instantáneas y por eso el volumen de datos
tiene que seguir siendo chico (ver [05 · No funcionales](05-requisitos-no-funcionales.md)).

### 4.2 Escritura optimista

Cuando alguien guarda algo, primero se actualiza la pantalla y recién después se manda a la base
(por ejemplo `upsertTask`). Si la base falla, el error se registra en la consola y en
`dataError`; la pantalla puede quedar un momento adelantada respecto de la base. Es el costo
elegido a cambio de que la app se sienta inmediata.

### 4.3 Tiempo real

`AppContext` se suscribe al canal `cambios-en-vivo` y escucha los cambios de las tablas listadas
en `REALTIME_TABLES` (`src/lib/supabaseApi.ts:342`): `profiles`, `projects`, `tasks`, `notes`,
`note_folders`, `minutes`, `pins`, `hitos`, `feature_flags`, `task_comments`, `consejos`,
`kickoffs`, `kickoff_briefings`, `kickoff_anotaciones`. El CRM tiene su propio canal
`crm-en-vivo` con las tablas `crm_*`.

Como el tiempo real de Supabase respeta las reglas RLS, a cada persona le llegan solo los cambios
de las filas que tiene derecho a ver: las notas privadas de otro nunca viajan a su navegador.

### 4.4 Dos implementaciones de la capa de datos

`src/lib/api.ts` define el contrato y la app elige sola:

- **Hay configuración de Supabase** (`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`) → `supabaseApi`.
- **No hay configuración** → `localApi`, el **modo demo**: todo queda en el navegador
  (`localStorage`), con datos de mentira de `src/lib/seed.ts`. Sirve para probar cambios sin
  tocar los datos reales.

El CRM repite el mismo patrón por separado en `src/crm/crmApi.ts`.

### 4.5 Nombres: `camelCase` ↔ `snake_case`

En TypeScript los campos van en `camelCase` (`projectId`, `necesitaDecisionGg`) y en Postgres en
`snake_case` (`project_id`, `necesita_decision_gg`). La traducción ocurre en un solo lugar: las
funciones `rowToX` y los objetos que se mandan a guardar, en `src/lib/supabaseApi.ts` y
`src/crm/crmApi.ts`.

### 4.6 Código nuevo contra base vieja

Dos defensas para que publicar código antes de correr el SQL no rompa nada:

1. `load()` tolera tablas que todavía no existen: si una consulta falla, esa lista queda vacía.
2. Al guardar, si la base rechaza una columna que todavía no existe, se reintenta sin esa columna.

## 5. Seguridad

1. **Autenticación:** email y contraseña con Supabase Auth. El perfil vive en `profiles`, con el
   mismo id que el usuario de Auth.
2. **Autorización:** reglas RLS por tabla, en la base. Tres patrones:
   - *Compartido:* lo ve y edita cualquiera con sesión iniciada (tareas, proyectos, minutas…).
   - *Privado de verdad:* solo el dueño (cuaderno, fijados, briefing, anotaciones privadas).
   - *Por lista:* solo quien está en `crm_accesos` (todo el CRM), resuelto con funciones
     `security definer` para evitar recursión entre políticas.
3. **Secretos:** la clave pública (`anon`) viaja en el navegador, y así tiene que ser: es pública
   por diseño y lo que protege son las reglas RLS. El archivo `.env` no se sube al repositorio.
4. **Datos personales de terceros:** la carpeta de migración del CRM (con teléfonos y mails de
   contactos de instituciones) está en `.gitignore` y nunca se sube.

## 6. Interfaz

- **Navegación:** barra superior en computadora y barra inferior deslizable en celular
  (`src/components/TopBar.tsx`). Las pestañas se filtran por rol, llave y acceso al CRM.
- **Estilo:** Tailwind con la fuente Poppins y el azul de marca definidos en `src/index.css`. El
  CRM usa además la fuente Comfortaa y la paleta de la planilla vieja (`src/crm/estilo.ts`), para
  que el equipo comercial reconozca su herramienta.
- **Celular:** todas las vistas funcionan con el pulgar. Lo que no se puede hacer en celular
  (arrastrar y soltar) tiene siempre un camino alternativo.

## 7. Publicación

| Ambiente | Cómo |
|---|---|
| Desarrollo | `npm run dev`, o la configuración `dev` de `.claude/launch.json` |
| Demo (datos de mentira) | Configuración `demo` de `.claude/launch.json`: corre con las variables de Supabase vacías |
| Producción | `git push origin main` → Vercel compila y publica solo |

Las bases de datos **no** se migran solas: cada `.sql` de `supabase/` lo pega una persona en el
editor SQL de Supabase. Ver [06 · Operación](06-operacion.md).

## 8. Decisiones de arquitectura y por qué

| Decisión | Por qué | Qué cuesta |
|---|---|---|
| Sin backend propio | Cero costo, cero mantenimiento de servidores | Toda la seguridad tiene que estar en RLS; no se pueden guardar secretos |
| Cargar todo en memoria al entrar | Vistas instantáneas y filtros libres | Deja de servir si los datos crecen mucho (decenas de miles de filas) |
| Escritura optimista | La app se siente inmediata | Un error de guardado se ve tarde |
| Migraciones a mano | Control total del Gerente General sobre la base, sin herramientas extra | Hay que acordarse de correrlas |
| Llaves por usuario | Probar en producción sin arriesgar al equipo | Más ramas por revisar |
| El CRM con su propio contexto y su propia capa de datos | Sus datos solo se cargan para quien tiene acceso | Algo de código repetido |
