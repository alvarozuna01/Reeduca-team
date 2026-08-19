# ReEduca · Gestión de Equipo

Plataforma web de gestión de equipos, tareas, proyectos y RRHH. Incluye:

- **Tiempo real (multijugador)**: los cambios de cualquier miembro (tareas, Kanban, minutas, notas) aparecen al instante en las pantallas de todos, sin recargar — vía Supabase Realtime (en modo demo, sincroniza entre pestañas del mismo navegador).
- **Mi Día**: pantalla de inicio personal con recordatorios críticos (tareas de 4–5 ★), la agenda de hoy con checkbox rápido y la sección **Fijados** (notas ancladas + recordatorios sueltos).
- **Notas colaborativas**: compartí una nota con personas específicas; la ven y editan en vivo (con indicador de presencia), y cualquier nota se **exporta a PDF** con un clic.
- **Agenda semanal** con drag & drop (mover tareas de día, reordenar prioridad) y edición rápida en panel lateral.
- **Kanban avanzado** con filtros duales (proyecto + semana + persona) y semáforo de carga de las próximas semanas (🔴 >10 tareas · 🟡 3–10 · 🟢 <3).
- **Urgencia e importancia** en cada tarea: toggle "Es urgente" (borde y badge rojos) y calificación de 1–5 estrellas; las de 4–5 ★ aparecen sí o sí en Mi Día del responsable y en el panel del Gerente.
- **Minutas de reuniones**: título, fecha, participantes, resumen y "Acciones acordadas" que se convierten en tareas con un clic.
- **Mi Cuaderno Digital** (privado por usuario, estilo app Notas): carpetas y subcarpetas colapsables, lista con vista previa y notas fijadas, editor de texto enriquecido con autoguardado.
- **Panel del Gerente**: tareas críticas del equipo, carga de trabajo por persona, estado por proyecto y gestión de miembros (RRHH).
- **Proyectos** con color identificativo (las tarjetas del calendario se pintan solas).
- Tareas con descripción, fecha, horas, responsables múltiples, checklist y enlaces (Drive, Notion…).

**Stack (costo $0/mes):** React + Vite + TypeScript · Tailwind CSS · dnd-kit · Supabase (base de datos + login) · Vercel (hosting).

---

## 1. Correr la app en tu compu

> **Importante:** todos los comandos se ejecutan DENTRO de la carpeta `reeduca-team` (esta carpeta), no desde la carpeta que la contiene. Si abriste otra carpeta en VS Code, primero entrá con `cd reeduca-team`.

```bash
cd reeduca-team
npm install
npm run dev
```

Abrí http://localhost:5173. La app arranca en **modo demo**: no necesitás configurar nada, los datos se guardan en tu navegador y entrás eligiendo un perfil. Ideal para probar todo ya mismo.

## 2. Activar cuentas reales (Supabase, gratis)

Cuando quieras que tu equipo entre con email y contraseña desde cualquier compu:

1. Entrá a [supabase.com](https://supabase.com) y creá una cuenta gratis (vos, desde tu navegador).
2. Creá un proyecto nuevo (elegí la región más cercana, ej. South America).
3. Andá a **SQL Editor → New query**, pegá todo el contenido de [`supabase/schema.sql`](supabase/schema.sql) y apretá **Run**.
4. Andá a **Project Settings → API** y copiá dos valores: `Project URL` y `anon public key`.
5. En esta carpeta, copiá el archivo `.env.example` con el nombre `.env` y pegá esos dos valores.
6. Reiniciá `npm run dev`. La pantalla de inicio ahora pide email y contraseña.

> **Importante:** la primera persona que se registre queda automáticamente como **Gerente (admin)**. Registrate vos primero. Después, desde la pestaña **Equipo** podés cambiar roles de los demás.

## 3. Publicar en internet gratis (Vercel)

1. Subí esta carpeta a un repositorio de GitHub.
2. Entrá a [vercel.com](https://vercel.com), iniciá sesión con GitHub e importá el repositorio.
3. En la configuración del proyecto de Vercel, agregá las dos variables de entorno (`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`) con los mismos valores de tu `.env`.
4. Deploy. Vercel te da una URL tipo `https://reeduca-team.vercel.app` para compartir con tu equipo.

## Estructura de la base de datos

| Tabla      | Para qué sirve | Campos principales |
|------------|----------------|--------------------|
| `profiles` | Usuarios / RRHH | nombre, email, rol (`admin`/`member`), color, foto |
| `projects` | Proyectos | nombre, color identificativo, descripción |
| `tasks`    | Tareas | título, descripción, fecha, hora inicio/fin, responsables (varios), estado, posición (orden del día), checklist, enlaces, urgente, importancia (0–5 ★) |
| `note_folders` | Carpetas del cuaderno (privadas) | nombre, carpeta madre (jerarquía), dueño |
| `notes`    | Notas del cuaderno (privadas) | título, contenido enriquecido, fijada, dueño, carpeta |
| `minutes`  | Minutas de reuniones | título, fecha, participantes, resumen, acciones acordadas (con enlace a la tarea creada) |

## Estructura del código

```
src/
  lib/        → capa de datos (modo demo con localStorage + modo Supabase) y utilidades
  state/      → estado global de la app (usuarios, proyectos, tareas, sesión)
  components/ → tarjeta de tarea, editor lateral, barra superior, modales, avatares
  views/      → Agenda (calendario), Kanban, Proyectos, Equipo (panel del gerente), Login
supabase/
  schema.sql  → esquema completo de la base de datos, listo para pegar en Supabase
```
