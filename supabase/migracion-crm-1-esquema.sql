-- ============================================================
-- ReEduca · Migración CRM 1: esquema del CRM dentro del sistema
-- Pegá TODO este archivo en: Supabase → SQL Editor → New query → Run
-- Se puede correr más de una vez sin romper nada (es idempotente).
--
-- Qué hace:
--  · Crea las tablas del CRM (instituciones, oportunidades, contactos,
--    acciones, bitácora) con prefijo crm_ para no chocar con las del sistema.
--  · Crea la lista de ACCESO AL CRM: solo quien esté en esa lista puede
--    leer o modificar algo del CRM. Es un candado real en la base de datos,
--    no solo en la pantalla. La lista la administran los Gerentes.
--  · Da acceso inicial a Álvaro, Luciana y Malena.
-- No modifica ninguna tabla existente. Los DATOS se cargan con el archivo 2.
-- ============================================================

-- ---------- Lista de acceso ----------
create table if not exists public.crm_accesos (
  user_id uuid primary key,
  otorgado_por uuid,
  created_at timestamptz not null default now()
);

-- ¿El usuario actual tiene acceso al CRM? (security definer: la consulta
-- interna no queda atrapada por la RLS de la propia lista)
create or replace function public.crm_tiene_acceso() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.crm_accesos a where a.user_id = auth.uid())
$$;

create or replace function public.crm_es_gerente() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
$$;

alter table public.crm_accesos enable row level security;
-- Todos pueden ver quién tiene acceso (la app lo necesita para mostrar o no la pestaña).
drop policy if exists "crm_accesos_select" on public.crm_accesos;
create policy "crm_accesos_select" on public.crm_accesos
  for select to authenticated using (true);
-- Dar y quitar acceso: solo Gerentes.
drop policy if exists "crm_accesos_insert" on public.crm_accesos;
create policy "crm_accesos_insert" on public.crm_accesos
  for insert to authenticated with check (public.crm_es_gerente());
drop policy if exists "crm_accesos_delete" on public.crm_accesos;
create policy "crm_accesos_delete" on public.crm_accesos
  for delete to authenticated using (public.crm_es_gerente());

-- ---------- Instituciones ----------
create table if not exists public.crm_instituciones (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,                 -- I001… (el ID que tenía en la planilla)
  nombre text not null,
  segmento text not null default '',  -- Colegio | Universidad | Academia
  ciudad text not null default '',
  direccion text not null default '',
  en_lnr boolean not null default false,
  eq_intelliq int,
  eq_v5 int,
  eq_universo int,
  activo text not null default '',
  drive_url text not null default '',
  especial boolean not null default false,   -- seguimiento especial
  created_at timestamptz not null default now()
);

-- ---------- Oportunidades (una venta concreta de una institución) ----------
-- "Venta" o "posventa" NO se guarda: se deduce de la etapa
-- (CERRADO-GANADO = posventa, CERRADO-NO GANADO = perdida, el resto = venta).
create table if not exists public.crm_oportunidades (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,                 -- O001…
  institucion_id uuid not null references public.crm_instituciones (id) on delete cascade,
  modalidad text not null default '', -- Curricular | Extracurricular | ''
  producto text not null default '',
  etapa text not null default 'CONTACTO INICIAL' check (etapa in (
    'CONTACTO INICIAL','EN SEGUIMIENTO','LLEVAR PROPUESTA FÍSICA','P.FÍSICA ENTREGADA',
    'PROPUESTA ENVIADA','EN REVISIÓN/AJUSTE','CERRADO-GANADO','CERRADO-NO GANADO')),
  valor numeric,
  estado_posventa text not null default '',  -- ACTIVO | ACTIVO-LNR | EN STAND BY | INACTIVO
  objetivo_2027 boolean not null default false,
  responsable_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists crm_oportunidades_inst_idx on public.crm_oportunidades (institucion_id);

-- ---------- Contactos ----------
create table if not exists public.crm_contactos (
  id uuid primary key default gen_random_uuid(),
  institucion_id uuid not null references public.crm_instituciones (id) on delete cascade,
  nombre text not null default '',
  rol text not null default '',
  telefono text not null default '',
  mail text not null default '',
  notas text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists crm_contactos_inst_idx on public.crm_contactos (institucion_id);

-- ---------- Acciones (interacciones / gestiones) ----------
-- Cada acción cuelga de su oportunidad (en la planilla se vinculaba por
-- institución + modalidad). es_lnr = invitación a la Liga, va aparte.
create table if not exists public.crm_interacciones (
  id uuid primary key default gen_random_uuid(),
  institucion_id uuid not null references public.crm_instituciones (id) on delete cascade,
  oportunidad_id uuid references public.crm_oportunidades (id) on delete set null,
  es_lnr boolean not null default false,
  orden int not null default 0,       -- el N° correlativo de la planilla
  accion text not null default '',
  fecha date,
  responsable_ids uuid[] not null default '{}',
  estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE','EN PROCESO','CONCRETADO')),
  tipo text not null default '',      -- llamada | mensaje | mail | reunion | flyer | presupuesto | lnr | respuesta | teavisamos | otro
  horas numeric,
  link text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists crm_interacciones_inst_idx on public.crm_interacciones (institucion_id);
create index if not exists crm_interacciones_fecha_idx on public.crm_interacciones (fecha);

-- ---------- Bitácora (quién cambió qué y cuándo; no se edita ni se borra) ----------
create table if not exists public.crm_bitacora (
  id uuid primary key default gen_random_uuid(),
  fecha_hora timestamptz not null default now(),
  usuario_id uuid,
  usuario text not null default '',   -- nombre o mail de quien hizo el cambio
  cambio text not null default '',    -- Creó | Editó | Borró | Movió | Etapa | …
  institucion text not null default '',
  venta_mod text not null default '',
  accion text not null default '',
  detalle text not null default ''
);
create index if not exists crm_bitacora_fecha_idx on public.crm_bitacora (fecha_hora desc);

-- ---------- Candado: todo el CRM solo para quien tenga acceso ----------
alter table public.crm_instituciones enable row level security;
alter table public.crm_oportunidades enable row level security;
alter table public.crm_contactos enable row level security;
alter table public.crm_interacciones enable row level security;
alter table public.crm_bitacora enable row level security;

drop policy if exists "crm_instituciones_acceso" on public.crm_instituciones;
create policy "crm_instituciones_acceso" on public.crm_instituciones
  for all to authenticated using (public.crm_tiene_acceso()) with check (public.crm_tiene_acceso());
drop policy if exists "crm_oportunidades_acceso" on public.crm_oportunidades;
create policy "crm_oportunidades_acceso" on public.crm_oportunidades
  for all to authenticated using (public.crm_tiene_acceso()) with check (public.crm_tiene_acceso());
drop policy if exists "crm_contactos_acceso" on public.crm_contactos;
create policy "crm_contactos_acceso" on public.crm_contactos
  for all to authenticated using (public.crm_tiene_acceso()) with check (public.crm_tiene_acceso());
drop policy if exists "crm_interacciones_acceso" on public.crm_interacciones;
create policy "crm_interacciones_acceso" on public.crm_interacciones
  for all to authenticated using (public.crm_tiene_acceso()) with check (public.crm_tiene_acceso());

-- Bitácora: se lee y se escribe; nunca se edita ni se borra.
drop policy if exists "crm_bitacora_select" on public.crm_bitacora;
create policy "crm_bitacora_select" on public.crm_bitacora
  for select to authenticated using (public.crm_tiene_acceso());
drop policy if exists "crm_bitacora_insert" on public.crm_bitacora;
create policy "crm_bitacora_insert" on public.crm_bitacora
  for insert to authenticated with check (public.crm_tiene_acceso());

-- ---------- Tiempo real ----------
do $$ begin alter publication supabase_realtime add table public.crm_accesos; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.crm_instituciones; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.crm_oportunidades; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.crm_contactos; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.crm_interacciones; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.crm_bitacora; exception when duplicate_object then null; end $$;

-- ---------- Acceso inicial: Álvaro, Luciana y Malena ----------
-- (por mail o por nombre de pila; después se ajusta desde el Panel → Acceso al CRM)
insert into public.crm_accesos (user_id)
select p.id from public.profiles p
where lower(p.email) in ('alvaro.ozuna01@gmail.com', 'lugomezperasso@gmail.com', 'gomezdelafuentemalena@gmail.com')
   or translate(lower(split_part(trim(p.name), ' ', 1)), 'áéíóú', 'aeiou') in ('alvaro', 'luciana', 'malena')
on conflict (user_id) do nothing;

-- Para verificar quién quedó con acceso, corré:
-- select p.name, p.email from public.crm_accesos a join public.profiles p on p.id = a.user_id;
