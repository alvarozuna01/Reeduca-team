-- ============================================================
-- MIGRACIÓN FASE 3 — Colaboración en tiempo real
-- Incluye también todo lo de la Fase 2, por si quedó pendiente.
-- Es seguro correrlo más de una vez.
-- Pegá TODO este archivo en: Supabase → SQL Editor → New query → Run
-- ============================================================

-- ---------- Fase 2 (por si falta) ----------

alter table public.tasks add column if not exists urgent boolean not null default false;
alter table public.tasks add column if not exists importance integer not null default 0;

create table if not exists public.note_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  parent_id uuid references public.note_folders (id) on delete set null,
  position integer not null default 0
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  folder_id uuid references public.note_folders (id) on delete set null,
  title text not null default '',
  content text not null default '',
  pinned boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.minutes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date not null,
  participant_ids uuid[] not null default '{}',
  summary text not null default '',
  actions jsonb not null default '[]'
);

-- ---------- Fase 3 ----------

-- Notas compartibles con usuarios específicos
alter table public.notes add column if not exists shared_with uuid[] not null default '{}';

-- Fijados de "Mi Día": una nota anclada o un recordatorio suelto
create table if not exists public.pins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  note_id uuid references public.notes (id) on delete cascade,
  text text,
  position integer not null default 0
);

-- ---------- Seguridad (RLS) ----------

alter table public.note_folders enable row level security;
alter table public.notes enable row level security;
alter table public.minutes enable row level security;
alter table public.pins enable row level security;

drop policy if exists "minutes_authenticated" on public.minutes;
create policy "minutes_authenticated" on public.minutes
  for all to authenticated using (true) with check (true);

drop policy if exists "note_folders_own" on public.note_folders;
create policy "note_folders_own" on public.note_folders
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Notas: el dueño puede todo; con quien se comparte puede ver y editar.
drop policy if exists "notes_own" on public.notes;
drop policy if exists "notes_select_own_or_shared" on public.notes;
drop policy if exists "notes_insert_own" on public.notes;
drop policy if exists "notes_update_own_or_shared" on public.notes;
drop policy if exists "notes_delete_own" on public.notes;

create policy "notes_select_own_or_shared" on public.notes
  for select to authenticated
  using (user_id = auth.uid() or auth.uid() = any (shared_with));

create policy "notes_insert_own" on public.notes
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "notes_update_own_or_shared" on public.notes
  for update to authenticated
  using (user_id = auth.uid() or auth.uid() = any (shared_with))
  with check (user_id = auth.uid() or auth.uid() = any (shared_with));

create policy "notes_delete_own" on public.notes
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "pins_own" on public.pins;
create policy "pins_own" on public.pins
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- Tiempo real ----------
-- Publica los cambios de estas tablas para que la app los reciba al instante.

do $$ begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.projects; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.tasks; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.notes; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.note_folders; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.minutes; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.pins; exception when duplicate_object then null; end $$;
