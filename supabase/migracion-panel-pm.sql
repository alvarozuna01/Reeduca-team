-- ============================================================
-- ReEduca · Migración: Panel PM del Gerente (Dirección A)
-- Pegá TODO este archivo en: Supabase → SQL Editor → New query → Run
-- Se puede correr más de una vez sin romper nada (es idempotente).
--
-- Qué hace: agrega a las tareas la fecha de completado (para
-- "completadas esta semana" y la actividad reciente), la marca
-- "necesita decisión del Gerente" con su fecha (para la cola de
-- decisiones), y deja la llave FEATURE_PANEL prendida solo para
-- el Gerente General. Columnas nuevas, nada existente se toca.
-- ============================================================

-- 1) Tareas: columnas aditivas
alter table public.tasks add column if not exists completed_at timestamptz;
alter table public.tasks add column if not exists necesita_decision_gg boolean not null default false;
alter table public.tasks add column if not exists necesita_decision_desde timestamptz;

-- 2) La tabla de llaves (por si esta migración se corre antes que las otras).
create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  flag text not null,
  user_id uuid,                          -- null = valor global (para todo el equipo)
  enabled boolean not null default false,
  unique nulls not distinct (flag, user_id)
);
alter table public.feature_flags enable row level security;
drop policy if exists "feature_flags_select" on public.feature_flags;
create policy "feature_flags_select" on public.feature_flags
  for select to authenticated using (true);
drop policy if exists "feature_flags_write_admin" on public.feature_flags;
create policy "feature_flags_write_admin" on public.feature_flags
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
do $$ begin alter publication supabase_realtime add table public.feature_flags; exception when duplicate_object then null; end $$;

-- 3) Llave FEATURE_PANEL prendida SOLO para el Gerente General.
--    El Panel es una pestaña exclusiva de Gerentes; además, con la llave
--    cada persona ve en sus tareas el botón "Necesita decisión del Gerente".
insert into public.feature_flags (flag, user_id, enabled)
select 'FEATURE_PANEL', p.id, true
from public.profiles p
where p.email = 'alvaro.ozuna01@gmail.com'
on conflict (flag, user_id) do update set enabled = true;

-- 4) Fila global apagada: cuando el Panel te convenza, prendela
--    (Table Editor → feature_flags → esta fila → enabled = true) para que
--    el equipo pueda marcar tareas como "necesita decisión". La pestaña
--    Panel seguirá siendo solo de Gerentes.
insert into public.feature_flags (flag, user_id, enabled)
values ('FEATURE_PANEL', null, false)
on conflict (flag, user_id) do nothing;
