-- ============================================================
-- ReEduca · Migración: orden de los proyectos
-- Pegá TODO este archivo en: Supabase → SQL Editor → New query → Run
-- Se puede correr más de una vez sin romper nada (es idempotente).
--
-- Qué hace: agrega a los proyectos una columna "position" con el orden
-- que el Gerente configura desde su panel (Configuración → Orden de los
-- proyectos). Mientras nadie ordene nada, todos quedan en 0 y la lista
-- sigue saliendo en orden alfabético, como hoy. Columna nueva: nada
-- existente se modifica.
-- ============================================================

alter table public.projects add column if not exists position integer not null default 0;
