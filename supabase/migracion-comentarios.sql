-- ============================================================
-- ReEduca · Migración: comentarios en tareas
-- Pegá TODO este archivo en: Supabase → SQL Editor → New query → Run
-- Se puede correr más de una vez sin romper nada (es idempotente).
--
-- Qué hace: crea la tabla task_comments para que cualquiera pueda
-- comentar en las tareas de otros. Todos leen todos los comentarios;
-- cada uno escribe como sí mismo y borra los suyos (un Gerente puede
-- borrar cualquiera). Queda detrás de la llave FEATURE_COMENTARIOS,
-- prendida solo para el Gerente General hasta que decidas abrirla.
-- No modifica ninguna tabla existente.
-- ============================================================

-- La tabla de llaves (por si esta migración se corre antes que la del kickoff).
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

-- Comentarios en tareas.
create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null,
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists task_comments_task_id_idx on public.task_comments (task_id);

alter table public.task_comments enable row level security;

-- Todos los del equipo ven todos los comentarios (para eso existen).
drop policy if exists "task_comments_select" on public.task_comments;
create policy "task_comments_select" on public.task_comments
  for select to authenticated using (true);

-- Cada uno comenta como sí mismo (no se puede firmar como otro).
drop policy if exists "task_comments_insert_own" on public.task_comments;
create policy "task_comments_insert_own" on public.task_comments
  for insert to authenticated with check (user_id = auth.uid());

-- Borrar: el autor, o un Gerente (moderación).
drop policy if exists "task_comments_delete_own_or_admin" on public.task_comments;
create policy "task_comments_delete_own_or_admin" on public.task_comments
  for delete to authenticated
  using (user_id = auth.uid()
         or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- (Sin política de UPDATE a propósito: los comentarios no se editan, se borran.)

-- Tiempo real: un comentario nuevo aparece al instante en todos lados.
do $$ begin alter publication supabase_realtime add table public.task_comments; exception when duplicate_object then null; end $$;

-- Llave FEATURE_COMENTARIOS:
-- 1) Prendida para el Gerente General (para que pruebes primero).
insert into public.feature_flags (flag, user_id, enabled)
select 'FEATURE_COMENTARIOS', p.id, true
from public.profiles p
where p.email = 'alvaro.ozuna01@gmail.com'
on conflict (flag, user_id) do update set enabled = true;

-- 2) Fila global apagada, lista para prender cuando decidas abrirlo al equipo:
--    Supabase → Table Editor → feature_flags → esta fila → enabled = true.
--    (do nothing: si ya la prendiste, volver a correr esto NO la apaga.)
insert into public.feature_flags (flag, user_id, enabled)
values ('FEATURE_COMENTARIOS', null, false)
on conflict (flag, user_id) do nothing;
