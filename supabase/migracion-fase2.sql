-- ============================================================
-- MIGRACIÓN FASE 2 — para bases que ya corrieron el schema de la Fase 1
-- Agrega SOLO lo nuevo: urgencia/importancia en tareas, cuaderno de
-- notas (carpetas + notas privadas) y minutas de reuniones.
-- Es seguro correrlo más de una vez.
-- Pegá TODO este archivo en: Supabase → SQL Editor → New query → Run
-- ============================================================

-- Nuevos campos de tareas
alter table public.tasks add column if not exists urgent boolean not null default false;
alter table public.tasks add column if not exists importance integer not null default 0;

-- Carpetas del cuaderno de notas (privadas por usuario)
create table if not exists public.note_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  parent_id uuid references public.note_folders (id) on delete set null,
  position integer not null default 0
);

-- Notas (privadas por usuario)
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  folder_id uuid references public.note_folders (id) on delete set null,
  title text not null default '',
  content text not null default '',
  pinned boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Minutas de reuniones (compartidas por el equipo)
create table if not exists public.minutes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date not null,
  participant_ids uuid[] not null default '{}',
  summary text not null default '',
  actions jsonb not null default '[]'
);

-- Seguridad (RLS)
alter table public.note_folders enable row level security;
alter table public.notes enable row level security;
alter table public.minutes enable row level security;

drop policy if exists "minutes_authenticated" on public.minutes;
create policy "minutes_authenticated" on public.minutes
  for all to authenticated using (true) with check (true);

-- Las notas y carpetas son PRIVADAS: cada usuario solo ve las suyas.
drop policy if exists "note_folders_own" on public.note_folders;
create policy "note_folders_own" on public.note_folders
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "notes_own" on public.notes;
create policy "notes_own" on public.notes
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
