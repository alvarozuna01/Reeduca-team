-- ============================================================
-- ReEduca · Migración Kickoff 1: la "llave" (feature flag)
-- Pegá TODO este archivo en: Supabase → SQL Editor → New query → Run
-- Se puede correr más de una vez sin romper nada (es idempotente).
--
-- Qué hace: crea la tabla feature_flags, que permite prender
-- funciones nuevas por usuario (o para todos) sin tocar el código.
-- Deja la llave FEATURE_KICKOFF prendida SOLO para el Gerente General.
-- No modifica ninguna tabla existente.
-- ============================================================

create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  flag text not null,
  user_id uuid,                          -- null = valor global (para todo el equipo)
  enabled boolean not null default false,
  unique nulls not distinct (flag, user_id)
);

alter table public.feature_flags enable row level security;

-- Todos pueden LEER las llaves (necesario para saber qué mostrar),
-- pero solo un Gerente puede prenderlas o apagarlas.
drop policy if exists "feature_flags_select" on public.feature_flags;
create policy "feature_flags_select" on public.feature_flags
  for select to authenticated using (true);

drop policy if exists "feature_flags_write_admin" on public.feature_flags;
create policy "feature_flags_write_admin" on public.feature_flags
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Tiempo real: prender/apagar una llave se refleja al instante sin recargar.
do $$ begin alter publication supabase_realtime add table public.feature_flags; exception when duplicate_object then null; end $$;

-- Semilla: FEATURE_KICKOFF prendida solo para el Gerente General.
-- (Si alguna vez te la apagás por error, volvé a correr este archivo.)
insert into public.feature_flags (flag, user_id, enabled)
select 'FEATURE_KICKOFF', p.id, true
from public.profiles p
where p.email = 'alvaro.ozuna01@gmail.com'
on conflict (flag, user_id) do update set enabled = true;
