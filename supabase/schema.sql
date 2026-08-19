-- ============================================================
-- ReEduca · Gestión de Equipo — Esquema de base de datos
-- Pegá TODO este archivo en: Supabase → SQL Editor → New query → Run
-- ============================================================

-- Perfiles de usuarios (RRHH)
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null default '',
  role text not null default 'member' check (role in ('admin', 'member')),
  color text not null default '#64748B',
  avatar_url text
);

-- Proyectos (cada uno con su color identificativo)
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#5AB6E8',
  description text
);

-- Tareas
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  description text,
  date date not null,
  start_time text,
  end_time text,
  assignee_ids uuid[] not null default '{}',
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  position integer not null default 0,
  checklist jsonb not null default '[]',
  links jsonb not null default '[]',
  urgent boolean not null default false,
  importance integer not null default 0 check (importance between 0 and 5)
);

-- Carpetas del cuaderno de notas (privadas por usuario)
create table public.note_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  parent_id uuid references public.note_folders (id) on delete set null,
  position integer not null default 0
);

-- Notas (privadas por usuario, compartibles con usuarios específicos)
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  folder_id uuid references public.note_folders (id) on delete set null,
  title text not null default '',
  content text not null default '',
  pinned boolean not null default false,
  updated_at timestamptz not null default now(),
  shared_with uuid[] not null default '{}'
);

-- Fijados de "Mi Día": una nota anclada o un recordatorio suelto
create table public.pins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  note_id uuid references public.notes (id) on delete cascade,
  text text,
  position integer not null default 0
);

-- Minutas de reuniones (compartidas por el equipo)
create table public.minutes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date not null,
  participant_ids uuid[] not null default '{}',
  summary text not null default '',
  actions jsonb not null default '[]'
);

-- Al crear una cuenta se crea automáticamente su perfil.
-- La PRIMERA persona en registrarse queda como Gerente (admin).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    case when not exists (select 1 from public.profiles) then 'admin' else 'member' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Seguridad (RLS): solo usuarios con sesión iniciada pueden leer/escribir.
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.note_folders enable row level security;
alter table public.notes enable row level security;
alter table public.minutes enable row level security;
alter table public.pins enable row level security;

create policy "profiles_authenticated" on public.profiles
  for all to authenticated using (true) with check (true);

create policy "projects_authenticated" on public.projects
  for all to authenticated using (true) with check (true);

create policy "tasks_authenticated" on public.tasks
  for all to authenticated using (true) with check (true);

create policy "minutes_authenticated" on public.minutes
  for all to authenticated using (true) with check (true);

-- Las carpetas y fijados son PRIVADOS: cada usuario solo ve los suyos.
create policy "note_folders_own" on public.note_folders
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "pins_own" on public.pins
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Notas: el dueño puede todo; con quien se comparte puede ver y editar.
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

-- Tiempo real: publicar los cambios para que la app los reciba al instante.
do $$ begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.projects; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.tasks; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.notes; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.note_folders; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.minutes; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.pins; exception when duplicate_object then null; end $$;
