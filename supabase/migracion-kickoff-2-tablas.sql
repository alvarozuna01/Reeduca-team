-- ============================================================
-- ReEduca · Migración Kickoff 2: tablas de consejos y kickoff
-- Pegá TODO este archivo en: Supabase → SQL Editor → New query → Run
-- Se puede correr más de una vez sin romper nada (es idempotente).
--
-- Qué hace: agrega a las minutas las columnas de transcripción, y crea
-- las tablas consejos (solo Gerentes), kickoffs, kickoff_briefings
-- (cada uno el suyo; el Gerente los lee) y kickoff_anotaciones
-- (privadas DE VERDAD: ni el Gerente las ve salvo que se compartan).
-- Todo aditivo: nada existente se modifica ni se borra.
-- ============================================================

-- 1) Minutas: transcripción (Módulo A)
alter table public.minutes add column if not exists transcripcion text;
alter table public.minutes add column if not exists transcripcion_cargada_at timestamptz;
alter table public.minutes add column if not exists estado_procesamiento text not null default 'sin_transcripcion'
  check (estado_procesamiento in ('sin_transcripcion','sin_procesar','procesada'));

-- 2) Tareas: columnas del Panel/Kickoff (por si esta migración corre primero)
alter table public.tasks add column if not exists completed_at timestamptz;
alter table public.tasks add column if not exists necesita_decision_gg boolean not null default false;
alter table public.tasks add column if not exists necesita_decision_desde timestamptz;

-- 3) Consejos (Módulo B) — recomendaciones al Gerente. RLS: solo Gerentes.
create table if not exists public.consejos (
  id uuid primary key default gen_random_uuid(),
  texto text not null,
  por_que text,
  quien_lo_dijo text,
  fecha_recibida date not null default current_date,
  origen_tabla text,
  origen_id uuid,
  cita_origen text,
  estado text not null default 'activo' check (estado in ('activo','archivado')),
  veces_mostrado integer not null default 0,
  ultima_aparicion date,
  creado_por uuid
);
alter table public.consejos enable row level security;
drop policy if exists "consejos_admin" on public.consejos;
create policy "consejos_admin" on public.consejos
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- 4) Kickoffs (Módulo C) — uno por lunes. Todos leen, escriben Gerentes.
create table if not exists public.kickoffs (
  id uuid primary key default gen_random_uuid(),
  fecha date not null unique,
  estado text not null default 'preparado' check (estado in ('preparado','en_curso','cerrado')),
  minuta_id uuid references public.minutes (id) on delete set null,
  consejo_id uuid references public.consejos (id) on delete set null,
  notas jsonb not null default '{}'
);
alter table public.kickoffs enable row level security;
drop policy if exists "kickoffs_select" on public.kickoffs;
create policy "kickoffs_select" on public.kickoffs for select to authenticated using (true);
drop policy if exists "kickoffs_write_admin" on public.kickoffs;
create policy "kickoffs_write_admin" on public.kickoffs
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- 5) Briefings personales (las dos preguntas del viernes).
--    Cada persona escribe SOLO el suyo; lo lee ella y los Gerentes.
--    Es tabla propia (y no un campo del kickoff) porque la RLS protege
--    filas: así cada uno guarda su respuesta sin poder tocar el resto.
create table if not exists public.kickoff_briefings (
  id uuid primary key default gen_random_uuid(),
  kickoff_id uuid not null references public.kickoffs (id) on delete cascade,
  usuario_id uuid not null,
  en_que_trabajo text not null default '',
  necesito_algo text not null default '',
  completado_at timestamptz,
  unique (kickoff_id, usuario_id)
);
alter table public.kickoff_briefings enable row level security;
drop policy if exists "briefings_select_own_or_admin" on public.kickoff_briefings;
create policy "briefings_select_own_or_admin" on public.kickoff_briefings
  for select to authenticated
  using (usuario_id = auth.uid()
         or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "briefings_insert_own" on public.kickoff_briefings;
create policy "briefings_insert_own" on public.kickoff_briefings
  for insert to authenticated with check (usuario_id = auth.uid());
drop policy if exists "briefings_update_own" on public.kickoff_briefings;
create policy "briefings_update_own" on public.kickoff_briefings
  for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
drop policy if exists "briefings_delete_own" on public.kickoff_briefings;
create policy "briefings_delete_own" on public.kickoff_briefings
  for delete to authenticated using (usuario_id = auth.uid());

-- 6) Anotaciones personales del kickoff — privadas de verdad.
--    El Gerente NO las ve, salvo que su dueño las pase a 'compartida'.
create table if not exists public.kickoff_anotaciones (
  id uuid primary key default gen_random_uuid(),
  kickoff_id uuid not null references public.kickoffs (id) on delete cascade,
  usuario_id uuid not null,
  bloque text not null,
  referencia_id uuid,
  texto_resaltado text,
  comentario text not null default '',
  visibilidad text not null default 'privada' check (visibilidad in ('privada','compartida')),
  created_at timestamptz not null default now()
);
alter table public.kickoff_anotaciones enable row level security;
drop policy if exists "anotaciones_select" on public.kickoff_anotaciones;
create policy "anotaciones_select" on public.kickoff_anotaciones
  for select to authenticated using (usuario_id = auth.uid() or visibilidad = 'compartida');
drop policy if exists "anotaciones_insert_own" on public.kickoff_anotaciones;
create policy "anotaciones_insert_own" on public.kickoff_anotaciones
  for insert to authenticated with check (usuario_id = auth.uid());
drop policy if exists "anotaciones_update_own" on public.kickoff_anotaciones;
create policy "anotaciones_update_own" on public.kickoff_anotaciones
  for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
drop policy if exists "anotaciones_delete_own" on public.kickoff_anotaciones;
create policy "anotaciones_delete_own" on public.kickoff_anotaciones
  for delete to authenticated using (usuario_id = auth.uid());

-- 7) Tiempo real: los cambios llegan al instante (respetando la RLS de cada tabla).
do $$ begin alter publication supabase_realtime add table public.consejos; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.kickoffs; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.kickoff_briefings; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.kickoff_anotaciones; exception when duplicate_object then null; end $$;
