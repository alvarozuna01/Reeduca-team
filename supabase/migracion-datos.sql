-- ============================================================
-- MIGRACIÓN DE DATOS: sistema anterior (Excel) → ReEduca Team
-- Requiere haber corrido antes migracion-fase3.sql.
-- Es seguro correrlo más de una vez (no duplica nada).
-- Pegá TODO este archivo en: Supabase → SQL Editor → Run
-- ============================================================

do $$ begin
  if to_regclass('public.pins') is null then
    raise exception 'Primero corré supabase/migracion-fase3.sql';
  end if;
end $$;

begin;

-- 1) Registro con ADOPCIÓN: si alguien crea su cuenta con un email (o nombre)
--    que coincide con un perfil migrado, hereda ese perfil y todas sus tareas.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  nuevo_nombre text := coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1));
  viejo uuid;
begin
  select p.id into viejo from public.profiles p
    where p.id not in (select u.id from auth.users u)
      and (lower(p.email) = lower(new.email)
           or (translate(lower(split_part(trim(p.name), ' ', 1)), 'áéíóúüñ', 'aeiouun')
               = translate(lower(split_part(trim(nuevo_nombre), ' ', 1)), 'áéíóúüñ', 'aeiouun')))
    limit 1;
  if viejo is not null then
    update public.profiles set id = new.id, email = new.email where id = viejo;
    update public.tasks set assignee_ids = array_replace(assignee_ids, viejo, new.id) where viejo = any(assignee_ids);
    update public.minutes set participant_ids = array_replace(participant_ids, viejo, new.id) where viejo = any(participant_ids);
    update public.notes set user_id = new.id where user_id = viejo;
    update public.notes set shared_with = array_replace(shared_with, viejo, new.id) where viejo = any(shared_with);
    update public.note_folders set user_id = new.id where user_id = viejo;
    update public.pins set user_id = new.id where user_id = viejo;
  else
    insert into public.profiles (id, name, email, role)
    values (new.id, nuevo_nombre, new.email,
            case when not exists (select 1 from public.profiles) then 'admin' else 'member' end);
  end if;
  return new;
end;
$fn$;

-- 2) Personas → perfiles (si ya existe por email o nombre, se reutiliza)
create temp table mapa_personas (viejo text primary key, nuevo uuid) on commit drop;

do $$
declare rec record; v uuid;
begin
  for rec in
    select * from (values
      ('P001', 'Guillermo Figueredo', 'guillermo@cfeventos.com.py', '#1A237E', 'admin', '685008c7-b03f-531d-81ea-57c3f6398c91'::uuid),
      ('P002', 'Álvaro', 'alvaro.ozuna01@gmail.com', '#8D6E63', 'admin', '0db99abf-4681-5ee9-9198-b975e52fc79f'::uuid),
      ('P003', 'Pablo Guershanik', 'pguerschanik@gmail.com', '#E65100', 'member', 'f1d64c3e-c88d-53b0-a049-9a47dcb62321'::uuid),
      ('P004', 'Auxiliar de Formación', '', '#F9A825', 'member', '72f692aa-ea18-522f-8877-30c500bd4683'::uuid),
      ('P005', 'Diana Benitez', 'dianabenitez114@gmail.com', '#0277BD', 'member', 'c44e1542-ca67-5212-aace-1f2a9484a1a0'::uuid),
      ('P006', 'Luciana Gomez', 'lugomezperasso@gmail.com', '#C2185B', 'member', '41065784-f8af-55d5-9ad2-64d7232213e3'::uuid),
      ('P007', 'Malena Rojas', 'gomezdelafuentemalena@gmail.com', '#FF2FE0', 'member', '42008e31-edcf-50d4-acf9-e8b4beec389d'::uuid),
      ('P008', 'Alejandro', '', '#8D6E63', 'member', '9bc6d623-096b-5d81-84de-17516aed09da'::uuid),
      ('P009', 'MEC', '', '#607D8B', 'member', '4d9a37da-93f6-50a1-a148-96a0f0b14cf1'::uuid),
      ('P010', 'Proveedor externo', '', '#795548', 'member', 'b2cb9b58-b3f1-51ce-a2d2-7e39ab9f36dd'::uuid),
      ('P011', 'Equilibrium', '', '#455A64', 'member', 'ae80e7ba-4d91-5d04-87f3-a07872e968ef'::uuid)
    ) as t(viejo, nombre, email, color, rol)
  loop
    v := null;
    if rec.email <> '' then
      select id into v from public.profiles where lower(email) = lower(rec.email) limit 1;
    end if;
    if v is null then
      select id into v from public.profiles
        where translate(lower(split_part(trim(name), ' ', 1)), 'áéíóúüñ', 'aeiouun')
            = translate(lower(split_part(trim(rec.nombre), ' ', 1)), 'áéíóúüñ', 'aeiouun')
        limit 1;
    end if;
    if v is null then
      insert into public.profiles (id, name, email, role, color)
      values (rec.column6, rec.nombre, rec.email, rec.rol, rec.color)
      on conflict (id) do nothing;
      v := rec.column6;
    end if;
    insert into mapa_personas values (rec.viejo, v) on conflict do nothing;
  end loop;
end $$;

-- 3) Proyectos (si ya existe uno con el mismo nombre, se reutiliza)
create temp table mapa_proyectos (viejo text primary key, nuevo uuid) on commit drop;

do $$
declare rec record; v uuid;
begin
  for rec in
    select * from (values
      ('PR01', 'Acciones de Reeduca', '#6CC5E8', 'Migrado del sistema anterior.', 'edb34819-464e-51bf-99be-475f7f0270ab'::uuid),
      ('PR02', 'Acciones de la Liga', '#4A7FE0', 'Migrado del sistema anterior.', '48c13aa2-fb46-5b32-a158-1cab6b194f40'::uuid),
      ('PR03', 'Acciones Aulas 4.0', '#52B5B5', 'Migrado del sistema anterior.', 'fcd9f988-7d20-5fa1-a4fb-1e5e4aaed3c2'::uuid),
      ('PR04', 'Acciones de Proyectos', '#8CC97C', 'Migrado del sistema anterior.', '2ab69b41-6f9a-5b7b-b3b4-f99164772ad9'::uuid),
      ('PR05', 'Acciones FIFA', '#E8B93C', 'Migrado del sistema anterior.', '833ce28b-2efa-542a-af74-af385c4fe96a'::uuid),
      ('PR06', 'Mkt. Kalix', '#E8752F', 'Migrado del sistema anterior.', '76e95763-2d5b-5eea-b5eb-65309dff06d7'::uuid),
      ('PR08', 'Vacaciones y feriados', '#B01D1D', 'Migrado del sistema anterior.', '09d25be3-e9ba-59aa-8b8c-1f1b23d36b52'::uuid),
      ('PR09', 'Eventos externos', '#F5A8C8', 'Migrado del sistema anterior.', 'a9495fe3-e71c-5018-b58f-30c225d11c44'::uuid)
    ) as t(viejo, nombre, color, descripcion)
  loop
    select id into v from public.projects where lower(name) = lower(rec.nombre) limit 1;
    if v is null then
      insert into public.projects (id, name, color, description)
      values (rec.column5, rec.nombre, rec.color, rec.descripcion)
      on conflict (id) do nothing;
      v := rec.column5;
    end if;
    insert into mapa_proyectos values (rec.viejo, v) on conflict do nothing;
  end loop;
end $$;

-- 4) Tareas (acciones + hitos del sistema anterior)
create temp table stage_tareas (
  id uuid, proyecto text, titulo text, descripcion text, fecha date,
  asignados text[], estado text, posicion int, checklist jsonb, enlaces jsonb, importancia int
) on commit drop;

insert into stage_tareas values
('dbe33854-816e-57c1-a4f2-d5b49b9447bf', 'PR05', 'Elaboración del plan de trabajo.', null, '2026-06-15', array['P006']::text[], 'done', 0, '[{"id": "9318c520-5d24-5f41-9582-06c901cff788", "text": "Plan de trabajo estructurado, validado y consensuado con las partes involucradas.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('b9ea6e48-ab09-5e4c-ad6c-1abcce2237ba', 'PR01', 'PEDIR A SOFI LA CANCHA DEL CDS PARA LLEVAR A LA EXPO.', 'Pendiente.', '2026-06-29', array['P006']::text[], 'done', 0, '[]'::jsonb, '[]'::jsonb, 0),
('cc981931-3cd6-5ce2-9905-2caf10891925', 'PR02', 'INSUMOS AULAS 4.0', '01. PLAN DE TRABAJO
02. GESTIÓN DEL PROYECTO
01. ACTA DE FORMALIZACIÓN DE LA IMPLEMENTACIÓN – SEGUNDO CUATRIMESTRE 2026
03. MANUAL DE USO Y ROTACIÓN DE KITS
01. FERIA PEDAGÓGICA', '2026-06-29', array['P002']::text[], 'done', 1, '[]'::jsonb, '[]'::jsonb, 0),
('49af4e72-4099-570e-9dd3-22f17e36fb6f', 'PR04', 'PROYECTO CONACYT', 'https://drive.google.com/open?id=1jmrHa3Y47ue0Pz8n6vxCdxbzDpH-Q-2R&usp=drive_copy', '2026-06-29', array['P002']::text[], 'done', 2, '[]'::jsonb, '[]'::jsonb, 0),
('2b1489c2-a68f-5ed5-97cc-02d936560913', 'PR06', 'PLAN DE COMUNICACIÓN KALIX.', 'IDEAS DE CONTENIDO', '2026-06-29', array['P006']::text[], 'done', 3, '[]'::jsonb, '[]'::jsonb, 0),
('c45db8eb-bba3-53a9-9c37-d69478f1614e', 'PR08', 'FERIADO', null, '2026-06-30', array['P002']::text[], 'done', 0, '[]'::jsonb, '[]'::jsonb, 0),
('947390f1-1b4b-5b62-bbb1-f2c44637f14c', 'PR01', 'EDITAR DOC. DE MALE', 'https://docs.google.com/document/d/1Phf0bK2ZP1XJCHA_DgB2WC6o44lx4UttJo2tLSKFBUw/edit?tab=t.0', '2026-07-01', array['P007']::text[], 'done', 0, '[]'::jsonb, '[]'::jsonb, 0),
('b71acac6-31ca-58be-b72d-3affad1356b4', 'PR01', 'CALENDARIO MENSUAL', 'ESTE DOC.', '2026-07-01', array['P006']::text[], 'done', 1, '[]'::jsonb, '[]'::jsonb, 0),
('a3e4f773-c30a-534a-8150-a38b5673a698', 'PR05', 'Consolidación de asistencia de participantes', 'Alejandro complementa la asistencia en base a la respuesta de las encuestas.', '2026-07-01', array['P008','P011']::text[], 'todo', 2, '[{"id": "e539c7bb-021d-5e92-9af2-f3b4d2d308ed", "text": "Base consolidada de asistencia cargada al drive.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('bff18feb-e6fe-552f-8318-351abd2f2b10', 'PR06', 'APROBAR PUBLICACIONES EN METRICOOL.', null, '2026-07-01', array['P006']::text[], 'done', 3, '[]'::jsonb, '[]'::jsonb, 0),
('51796200-dc8d-51c0-8784-be030a8f5d2a', 'PR08', 'DEADLINE PROYECTO CONACYT', 'https://drive.google.com/open?id=1jmrHa3Y47ue0Pz8n6vxCdxbzDpH-Q-2R&usp=drive_copy', '2026-07-01', array['P002']::text[], 'done', 4, '[]'::jsonb, '[]'::jsonb, 0),
('5f4c75c8-13b1-52f6-b2cc-d82bd62df73d', 'PR01', 'ALVARO ENVÍA INVITACIÓN A MEC PARA AULAS 4.0', 'Ale invitó en el grupo de docentes MEC.
Álvaro le madó a Alejandrino.', '2026-07-02', array['P002']::text[], 'done', 0, '[]'::jsonb, '[]'::jsonb, 0),
('f90c3825-edcd-5be7-98e6-fab91581380e', 'PR01', 'CONSULTAR A ITTI SI HABRÁN ENTRADAS GRATUITAS PARA PARTICIPANTES DE LA LNR.', 'Solo 80 entradas gratis.
Álvaro hizo una distribución tentativa de entradas.
Se invitarán a directivos de diversas insituiones y referentes del MEC.', '2026-07-02', array['P002','P009']::text[], 'done', 1, '[]'::jsonb, '[]'::jsonb, 0),
('2de52023-c2a2-5dbc-88a3-92bd13271885', 'PR02', 'INSUMOS AULAS 4.0: REDACTAR "REGLAS GRALES" DEL JUEGO + DOCS DE REGISTRO', '02. COMPETENCIA DE PROGRAMACIÓN VEX IQ
03. RECOMENDACIONES PARA PREPARARSE PARA LA COMPETENCIA
05. COMPETENCIA EN CANCHA VEX IQ
06. CRONOGRAMA DE LA COMPETENCIA
07. PUNTAJE DE LAS PARTIDAS
08. REGISTRO DE PUNTAJES', '2026-07-02', array['P002']::text[], 'done', 2, '[]'::jsonb, '[]'::jsonb, 0),
('2a9c56ca-b283-5fd2-9449-a04dbf6ce284', 'PR05', 'REU FIFA: PABLO', 'Se compartieron ideas grales. sobre la propuesta para el encuentro e cierre con directivos. Se acordó que Pabo armaría el viernes por la mañana el borrador de la pres. Luciana lo eidita el lunes de mañana.', '2026-07-02', array['P003']::text[], 'done', 3, '[]'::jsonb, '[]'::jsonb, 0),
('968af850-5bd4-5e77-ae4f-85f828c00753', 'PR06', 'PEDIDO DE INVI A KALIX. (EXPO):', 'PREPARAR TEXTO: PARA DIRECTIVOS DE INSTITUCIONES, OTRA PARA PANELISTAS
9.0', '2026-07-02', array['P006']::text[], 'done', 4, '[]'::jsonb, '[]'::jsonb, 0),
('98d84afe-8b96-5d09-8ca7-26735a298eac', 'PR06', 'METRICOOL: REVISADO', 'Feedback enviado.', '2026-07-02', array['P006']::text[], 'done', 5, '[]'::jsonb, '[]'::jsonb, 0),
('b5ff5dfc-5f64-544b-b1bf-54a5d6d3a9ec', 'PR06', 'PEDIDO DE FLYER A KALIX. (EXPO)', 'Hecho en el grupo.
También se compartió la competecia del 4 y 11.', '2026-07-02', array['P006']::text[], 'done', 6, '[]'::jsonb, '[]'::jsonb, 0),
('48e44eab-8667-5657-8726-208bca34e85e', 'PR02', 'IMPRIMIR 1 COPIA', '05. COMPETENCIA EN CANCHA VEX IQ', '2026-07-03', array['P002']::text[], 'done', 0, '[]'::jsonb, '[]'::jsonb, 0),
('5ff3bd79-bf2a-5ca6-a5c6-74b4731fd52f', 'PR02', 'MALE: PREPARAR GRILLA DE PUNTAJE DEL DESAFÍO', '04. traduccion highrise-game-manual.pdf
No es muy claro en esta traducción. Capaz hay que buscar otra fuente para entender mejor.', '2026-07-03', array['P007']::text[], 'done', 1, '[]'::jsonb, '[]'::jsonb, 0),
('80ba255c-98f3-5ad2-b888-308d8481a256', 'PR02', 'IMPRIMIR 20 COPIAS', '06. CRONOGRAMA DE LA COMPETENCIA', '2026-07-03', array['P002']::text[], 'done', 2, '[]'::jsonb, '[]'::jsonb, 0),
('d6e3c050-e085-5eb7-9730-6b5c1e0f3f54', 'PR02', 'IMPRIMIR 3 COPIAS', '07. PUNTAJE DE LAS PARTIDAS', '2026-07-03', array['P002']::text[], 'done', 3, '[]'::jsonb, '[]'::jsonb, 0),
('ff542fc3-510f-5782-bde1-8314dd6eacf9', 'PR02', 'IMPRIMIR UNA COPIA. LUEGO RECORTAR Y GUARDAR PARA LLEVAR MAÑANA', 'PITS. AULAS 4.0.pdf
Son los nombres de los equipos que deben ir pegados en sus lugares asignados, para que puedan identificarse entre ellos. Ver de llevar cinta para pegar en las mesas. Puede ser de papel o la ancha.
10.0', '2026-07-03', array['P002']::text[], 'done', 4, '[]'::jsonb, '[]'::jsonb, 0),
('d374b1a9-7367-5079-b874-8e09a0ab4220', 'PR03', 'CF: ENVÍA CARTEL AL DEFENSORES', 'Hecho!', '2026-07-03', array['P003']::text[], 'done', 5, '[]'::jsonb, '[]'::jsonb, 0),
('526fcb4a-7d56-51d2-b11f-da09e46e729b', 'PR05', 'PABLO PREPARA BASE DE PRES PARA DIRECTIVOS', 'Solicitar base para preparar pres.', '2026-07-03', array['P003']::text[], 'done', 6, '[]'::jsonb, '[]'::jsonb, 0),
('83f423d3-2344-59a6-8e41-39ba794c2fd4', 'PR05', 'REU CON EQUILIBRIUM: 9:00 AM', null, '2026-07-03', array['P011']::text[], 'done', 7, '[]'::jsonb, '[]'::jsonb, 0),
('0c59965a-475c-5c85-82f6-40144f307b82', 'PR06', 'REVISIÓN DE AJUSTES EN METRICOOL', 'Flyer aprobado.', '2026-07-03', array['P006']::text[], 'done', 8, '[]'::jsonb, '[]'::jsonb, 0),
('9f6fee4e-b4d9-5d88-80f1-65ba7c1b641e', 'PR09', 'MALLA CURRICULAR VEX 123', 'SECUENCIA DE TALLERES. 1,2,3.', '2026-07-03', array['P006']::text[], 'done', 9, '[]'::jsonb, '[]'::jsonb, 0),
('299c5e82-d673-5eac-b4d6-8ac0bddc70aa', 'PR03', 'COMPETENCIA MATCHES. 9:00 A 13:00 HS.', 'Hecho! Asisten Álvaro, Ale y Male por parte de REEDUCA.', '2026-07-04', array['P002','P007','P008']::text[], 'done', 0, '[]'::jsonb, '[]'::jsonb, 0),
('fa758063-ec90-5bbd-a0b7-ccc417375b6b', 'PR03', 'CREAR CARPETA DE FOTOS DEL EVENTO PARA COMPARTIR CON KALIX.', '02. AULAS 4.0', '2026-07-05', array['P003']::text[], 'done', 0, '[]'::jsonb, '[]'::jsonb, 0),
('25e5f5c9-73ee-526c-9357-521690f87ef7', 'PR09', 'MALLA CURRICULAR VEX GO', 'En proceso.
SECUENCIA DE TALLERES. VEX GO', '2026-07-05', array['P006']::text[], 'done', 1, '[]'::jsonb, '[]'::jsonb, 0),
('1e9d20ca-c8a3-5927-8ec2-9ee6d12f5892', 'PR01', 'PRESUPUESTO LAS ALMENAS', 'Pendiente.
LAS ALMENAS - JULIO 2026.docx', '2026-07-06', array['P006']::text[], 'done', 0, '[]'::jsonb, '[]'::jsonb, 0),
('82d78caf-1079-5099-9104-4ccba60a6040', 'PR01', 'PRESUPUESTO SUMA', 'Pendiente.
PROPUESTA SUMA. JULIO 2026.docx
Propuesta enviada por Lu.', '2026-07-06', array['P006']::text[], 'done', 1, '[]'::jsonb, '[]'::jsonb, 0),
('0f7ec25e-fa8e-5a6e-a612-ab88b550f052', 'PR02', 'LNR: VER SEDE DE APERTURA Y 2DA. FECHA.', 'Álvaro le escribe a Sofi para reotmar solicitud de Lu.', '2026-07-06', array['P002']::text[], 'done', 2, '[]'::jsonb, '[]'::jsonb, 0),
('bd5934d9-4d7f-5880-98be-cd1d514a5edc', 'PR03', 'GUÍA DE PRES. DOCENTE. AULAS 4.0', '11. PROPUESTA DE PRESENTACIÓN PARA DOCENTES
Ver: desafío para Cortex. (Prep. doc. para Raquel en base a la propuesta de Ale.)
13.0', '2026-07-06', array['P008']::text[], 'done', 3, '[]'::jsonb, '[]'::jsonb, 0),
('0e1a9b0e-fe13-5a1e-8d2f-480e8e5be8af', 'PR05', 'REU DE EDICIÓN', 'Hecha con Ale.
Hecha con con Pablo.', '2026-07-06', array['P003']::text[], 'done', 4, '[]'::jsonb, '[]'::jsonb, 0),
('1e72e8ce-d935-5034-b94b-f09ddf3da935', 'PR05', 'PREPARAR PRES. DE DIRECTIVOS: LU', 'Editado y compartido con Pablo.', '2026-07-06', array['P003','P006']::text[], 'done', 5, '[]'::jsonb, '[]'::jsonb, 0),
('d5cc7d0e-aa5f-5f8e-8b70-4f0ee5379292', 'PR06', 'GRABACIÓN CON KALIX: EN LA OFI.', 'Galería de fotos para creación de materiales. Reels.
Feedback de invitaciones: cambiar imágenes.
Revisar metricool: queda 1 pendiente.', '2026-07-06', array['P006']::text[], 'done', 6, '[]'::jsonb, '[]'::jsonb, 0),
('3a96ba1e-a883-5153-b2ec-8497cf874b95', 'PR09', 'ALE: SUBIR AL DRIVE LAS TRADUCCIONES DE LAS ACTIVIDADES.', '06. TRADUCCIONES DE ALE', '2026-07-06', array['P008']::text[], 'done', 7, '[]'::jsonb, '[]'::jsonb, 0),
('320d3398-da99-5c23-8196-3bd7fee17874', 'PR01', 'SEGUIMIENTO A 3 INSTITUCIONES. (ÁLVARO + MALE)', 'En proceso.
Male está preparando notas para Oviedo y Caaguazú', '2026-07-07', array['P002','P007']::text[], 'done', 0, '[]'::jsonb, '[]'::jsonb, 0);
insert into stage_tareas values
('59f55f1e-f5f3-584a-8e15-e0b711a6160d', 'PR01', 'SOLICITUD PARA DECLARAR A LA LNR DE INTERÉS EDUCATIVO', 'Tramitada por Álvaro.', '2026-07-07', array['P002']::text[], 'done', 1, '[]'::jsonb, '[]'::jsonb, 0),
('e64191c7-cf09-5a1c-8e6f-dfa1486a5ca6', 'PR01', 'CONVOCATORIA PARA PRESENTAR EN LA EXPO: INVITAR A EXPOSITORES.', 'Lu: Ajuste de invitaciones en CANVA. (imágenes)
Álvaro: invita al target: directivos y expositores.
Invitar RSE de TIGO y otras empresas.', '2026-07-07', array['P002']::text[], 'done', 2, '[]'::jsonb, '[]'::jsonb, 0),
('26af053b-ed6d-51fe-af99-05a0ca48e7a2', 'PR03', 'REU DE SEGUIMIENTO CON RAQUEL', 'Solicita un encuentro para mañana con todos los docentes para aclarar dudas.
14.0', '2026-07-07', array['P003']::text[], 'done', 3, '[]'::jsonb, '[]'::jsonb, 0),
('fbba0220-a516-56b9-bb04-79de78e1a952', 'PR05', 'Consolidación de entregas y tareas', 'Semalmente: completar si entregó o no entregó.', '2026-07-07', array['P005']::text[], 'todo', 4, '[{"id": "0faa33e9-91e6-5e57-92b8-c85b497317ae", "text": "Completar la matriz de entregables", "done": false}]'::jsonb, '[]'::jsonb, 0),
('0cd6c568-c14a-55d1-a424-d5e5a73b56b1', 'PR01', 'ELABORAR PRES + PROGRAMA EXPO A ITTI', 'Pres. 04 terminada y compartida con Álvaro.
PITCH AULAS 4.0
Pres. 01 terminada y compartida con Álvaro.
Pres. 02 terminada y compartida con Álvaro.
Pres. 05 terminada y compartida con Álvaro.
PANEL. ROBÓTICA EDUCATIVA: DEL AULA A LOS GRANDES DESAFÍOS
En proceso: delineamiento gráfico de la press + borrador de contenido de la intro.', '2026-07-08', array['P002']::text[], 'done', 0, '[]'::jsonb, '[]'::jsonb, 0),
('691b490e-20e7-51d3-aaa4-2fc6d9699318', 'PR01', 'ENVIAR PRES + PROGRAMA EXPO A ITTI', 'En proceso de elaboración.
Hecho. Compartido los docs. de Canva a los mails solicitados.', '2026-07-08', array['P006']::text[], 'done', 1, '[]'::jsonb, '[]'::jsonb, 0),
('9adcc705-f8c2-57bc-97b4-84daf9f8fdd4', 'PR01', 'SEGUIMIENTO A CLUBES. (MALE)', null, '2026-07-08', array['P007']::text[], 'done', 2, '[]'::jsonb, '[]'::jsonb, 0),
('bdb2ba80-09a6-5535-8471-7ab2ee4a982a', 'PR01', 'SOLICITAR PRES DE LA EXPO A SANTINI.', 'Álvaro.', '2026-07-08', array['P002']::text[], 'done', 3, '[]'::jsonb, '[]'::jsonb, 0),
('3c7a3998-4178-53e9-a72b-f25df9b8e3aa', 'PR03', 'REU DE SEGUIMIENTO DE 7 A 8 PM.', 'Preparar link.', '2026-07-08', array['P003']::text[], 'done', 4, '[]'::jsonb, '[]'::jsonb, 0),
('fa830ba5-ebe4-57c8-827f-6d3895176c8a', 'PR05', 'EDICIÓN FIFA 1ERO.: PREPARAR EL COMPENDIO A SER ENVIADO AL MEC', 'En proceso.', '2026-07-08', array['P009']::text[], 'todo', 5, '[]'::jsonb, '[]'::jsonb, 0),
('16a9ff22-de1e-5f3a-996f-e62e43673065', 'PR01', 'INVITAR DIRECTIOVS Y REFERENTES PARA LA EXPO.', 'Álvaro: invita al target: directivos y expositores.
Invitar RSE de TIGO y otras empresas.', '2026-07-09', array['P002']::text[], 'done', 0, '[]'::jsonb, '[]'::jsonb, 0),
('2db325a6-f4c7-5d53-81ad-061bab59c20a', 'PR01', '6:00 PM. MUESTRA CDS.', null, '2026-07-09', array['P006']::text[], 'done', 1, '[]'::jsonb, '[]'::jsonb, 0),
('add82845-f4cf-5651-b091-0756eab9c492', 'PR04', 'SEGUIMIENTO PROPUESTA RODRIGO ÁNTOLA', 'Solicitar documentos.', '2026-07-09', array['P002']::text[], 'done', 2, '[]'::jsonb, '[]'::jsonb, 0),
('66b847b0-bcc9-5453-a9e8-8748b9558583', 'PR05', 'EDICIÓN FIFA 1ERO.: PREPARAR EL COMPENDIO A SER ENVIADO AL MEC + REVISÓN GENERAL', 'EDUCACIÓN DIGITAL. 1ER. GRADO.docx
EDUCACIÓN DIGITAL. 1ER. GRADO.pdf', '2026-07-09', array['P009']::text[], 'done', 3, '[]'::jsonb, '[]'::jsonb, 0),
('a192e3cc-668e-51e0-a72a-6ee2d9f6b707', 'PR05', 'ENCUENTRO DIRECTIVOS MAÑANA Y TARDE. PABLO Y ALE', 'Acompaña Álvaro.', '2026-07-09', array['P002']::text[], 'done', 4, '[]'::jsonb, '[]'::jsonb, 0),
('d2ef295d-f7a1-5d41-b0a0-c24b6b31b7bb', 'PR05', 'ORGANIZAR CARPETA FIFA', 'https://drive.google.com/open?id=1kA6vMok6e9drxiSMMeWDUX8QE7TBaZas&usp=drive_copy', '2026-07-09', array['P003']::text[], 'done', 5, '[]'::jsonb, '[]'::jsonb, 0),
('4dbbf0f3-919d-58d3-af8e-4fdafb85ef5b', 'PR06', 'REU CON JOHA: PLAN DE COMUNICACIÓN PARA LAS SIGUIENTES SEMANAS: EVENTOS REEDUCA.', 'COMUNICACIÓN REEDUCA', '2026-07-09', array['P006']::text[], 'done', 6, '[]'::jsonb, '[]'::jsonb, 0),
('a69fac5b-0d52-5b04-833d-5f4eb82b9f78', 'PR06', 'REVISAR PROYECTO QUE VENCE EL 28 DE JULIO: DOC. EN EL WHATSAPP.', 'Revisado. Visita agendada para el lunes 13.', '2026-07-09', array['P006']::text[], 'done', 7, '[]'::jsonb, '[]'::jsonb, 0),
('02a8525e-0e90-580a-a73f-ae2f343e7802', 'PR01', 'ENVIAR GUIONES PARA CONVERSATORIO.', 'Álvaro envía el guión a Milciades y Juan.
17.0', '2026-07-10', array['P002']::text[], 'done', 0, '[]'::jsonb, '[]'::jsonb, 0),
('011b6e5a-8600-53a9-b7ea-880040be48c7', 'PR03', 'PREP. INSUMOS DE COMPETENCIA DE PROGRAMACIÓN', 'Diseñar 4 desafìos. - Hecho.
Imprimir 16 copias.
12. DESAFÍOS DE PROGRAMACIÓN
Elaborar certificados.
09. CRONOGRAMA DE COMPETENCIA DE PROGRAMACIÓN VEX IQ
10. PUNTAJE DE LOS DESAFÍOS DE PROGRAMACIÓN', '2026-07-10', array['P003']::text[], 'done', 1, '[]'::jsonb, '[]'::jsonb, 0),
('c8cd1860-afa1-510d-92ca-f61bb4ab795b', 'PR03', 'PREP. IMPLEMENTOS DESAFÍO CORTEX: BOTELLAS DE 500ML. VER EN LA OFI.', 'En proceso. Elaborado por Ale.', '2026-07-10', array['P008']::text[], 'todo', 2, '[]'::jsonb, '[]'::jsonb, 0),
('06c30170-ac9b-5bc3-8d02-f29a162190da', 'PR05', 'SEGUIMIENTO A APROBACIÓN DEL PLAN DE FORMACIÓN POR EL MEC', 'Álvaro había hecho la solicitud. Verificar en qué estado se encuentra.', '2026-07-10', array['P002']::text[], 'done', 3, '[]'::jsonb, '[]'::jsonb, 0),
('3246b912-56e6-507f-a589-8715b2a4ac88', 'PR05', 'COMPARTIR CON PABLO LA EDICIÓN FIFA 1ERO. A SER ENVIADO AL MEC', 'Hecho', '2026-07-10', array['P003']::text[], 'done', 4, '[]'::jsonb, '[]'::jsonb, 0),
('404c25c2-3dde-59f0-b6ca-4c00bf1928ca', 'PR05', 'REDACTAR HITO DE GAMIFICACIÓN', null, '2026-07-10', array['P003']::text[], 'done', 5, '[]'::jsonb, '[]'::jsonb, 0),
('8c90f7c0-8798-502c-90c4-c762781b5f5f', 'PR05', 'PLANIFICACIÓN DE EVALUACIÓN', 'MINUTA. 10.07.2026', '2026-07-10', array['P003']::text[], 'done', 6, '[]'::jsonb, '[]'::jsonb, 0),
('ae9d3030-9d66-51a3-b168-114694b8f14c', 'PR03', 'COMPETENCIA PROGRAMACIÓN. 9:00 A 12:00 HS.', null, '2026-07-11', array['P003']::text[], 'done', 0, '[]'::jsonb, '[]'::jsonb, 0),
('fb879b9e-1404-5649-987d-a3763b65d1e4', 'PR05', 'TERMINAR UNIDADES PENDIENTES DE LA GUÍA DOCENTE 1ER. GRADO.', 'En proceso.', '2026-07-11', array['P006']::text[], 'done', 1, '[]'::jsonb, '[]'::jsonb, 0),
('09e5c2b5-57a0-5c30-81ae-28b303ccca5e', 'PR01', 'VISITA A MELODÍA', 'Van Álvaro y Pablo.', '2026-07-13', array['P002','P003']::text[], 'done', 0, '[]'::jsonb, '[]'::jsonb, 0),
('22a75192-5b3a-5fab-8180-669a0957d143', 'PR05', 'Cuantificación de docentes con pendientes', 'Mensajes a grupos de whatsapp según necesidad', '2026-07-13', array['P008']::text[], 'todo', 1, '[{"id": "35a2cc6b-b9b3-5ae6-abab-bc4bb7257d85", "text": "Reporte de observaciones", "done": false}]'::jsonb, '[]'::jsonb, 0),
('8e8feaae-b4ae-57cf-854c-8ba7daf7aa07', 'PR08', 'DISEÑAR CAPACITACIÓN EXCLUSIVA DEL MEC', 'Pendiente.', '2026-07-13', array['P009']::text[], 'todo', 2, '[]'::jsonb, '[]'::jsonb, 0),
('14f0ede3-0311-533f-856a-56161ef3bb50', 'PR01', 'REUNIÓN CON LA UNIVERSIDAD', 'Álvaro y Pablo. 9:30 am.', '2026-07-14', array['P002','P003']::text[], 'done', 0, '[]'::jsonb, '[]'::jsonb, 0),
('df137aae-9afb-5d1b-bda1-08394cebcfda', 'PR01', 'INTERCOLEGIAL CDS 11. 12. 13/11', 'Sandra se comunicó con Lu solicitando acompañamiento. Ver activación conforme a fecha asignada para la primera fecha.
21.0', '2026-07-14', array['P006']::text[], 'done', 1, '[]'::jsonb, '[]'::jsonb, 0),
('ad766a30-5e6c-59d3-bc17-d10ec92556a5', 'PR03', 'PRESS. AULAS 4.0 PARA LA EXPO.', 'Llamada con Raquel para criterios de la presentación.', '2026-07-14', array['P003']::text[], 'done', 2, '[]'::jsonb, '[]'::jsonb, 0),
('1d11ba54-89cb-59ae-9aef-8d19c863dfdf', 'PR04', 'SEGUIMIENTO CONACYT: ÁLVARO', 'Revisado. Sin retorno.', '2026-07-14', array['P002']::text[], 'done', 3, '[]'::jsonb, '[]'::jsonb, 0),
('4195322c-7ea4-50ed-9fd4-366fc9683630', 'PR05', 'REVISIÓN MÓDULO DIRECTIVOS.', '01. INFORME DE REVISIÓN PEDAGÓGICA. SENSIBILIZACIÓN DIRECTIVOS', '2026-07-14', array['P003']::text[], 'done', 4, '[]'::jsonb, '[]'::jsonb, 0),
('8298158b-9910-5988-9832-1ba8f32d8cc4', 'PR05', 'REVISIÓN DEL MÓDULO 1', '02. INFORME DE REVISIÓN PEDAGÓGICA. MÓDULO 1
03. INFORME DE REVISIÓN PEDAGÓGICA. MÓDULO 2. S1
04. INFORME DE REVISIÓN PEDAGÓGICA. MÓDULO 2. S2
05. INFORME DE REVISIÓN PEDAGÓGICA. MÓDULO 2. S3
06. INFORME DE REVISIÓN PEDAGÓGICA. MÓDULO 2. S4
07. INFORME DE REVISIÓN PEDAGÓGICA. MÓDULO 2. S5', '2026-07-14', array['P003']::text[], 'done', 5, '[]'::jsonb, '[]'::jsonb, 0),
('99c236df-2319-5884-a820-31c925b83f4b', 'PR05', 'ARQUITECTURA PEDAGÓGICA  MÓDULO 2', 'En proceso.
https://docs.google.com/spreadsheets/d/1TmbRmBzmSWbhzIb7CwxGZDSRgQklDMj-S6tgIS4BQHo/edit?gid=0#gid=0', '2026-07-14', array['P003']::text[], 'todo', 6, '[]'::jsonb, '[]'::jsonb, 0),
('a1b199e0-066e-5e42-8f39-acbb790debfc', 'PR05', 'Reunión de revisión de módulos.', 'Álvaro, Pablo, Luciana.', '2026-07-14', array['P002','P003','P006']::text[], 'done', 7, '[]'::jsonb, '[]'::jsonb, 0),
('f63c1acf-3d02-53b7-89df-0e8756014e63', 'PR05', 'ARQUITECTURA PEDAGÓGICA  MÓDULO 1', 'Hecho.
https://docs.google.com/spreadsheets/d/1TmbRmBzmSWbhzIb7CwxGZDSRgQklDMj-S6tgIS4BQHo/edit?gid=0#gid=0', '2026-07-14', array['P003']::text[], 'done', 8, '[]'::jsonb, '[]'::jsonb, 0),
('48c41618-509b-5fb8-83fa-48c655b97d96', 'PR01', 'MANDAR A HACER LAS CAMISAS', 'Male
Antes estaba en el proyecto «Male». Ahora es una acción de Reeduca.', '2026-07-16', array['P007']::text[], 'done', 0, '[]'::jsonb, '[]'::jsonb, 0);
insert into stage_tareas values
('e220e781-d814-5c61-8ba4-2655efba142f', 'PR01', 'GACETILLA DE PRENSA PARA LA EXPO.', 'PROPUESTA DE GACETILLA. AULAS 4.0.docx', '2026-07-16', array['P006']::text[], 'done', 1, '[]'::jsonb, '[]'::jsonb, 0),
('ef71cde4-5126-5f46-965b-8e5daee4aa0c', 'PR05', 'ARQUITECTURA PEDAGÓGICA MÓDULO 2', 'Doc. de Pablo, terminado hasta el módulo 2.
https://docs.google.com/document/d/1fGBbh7M9Zye2HIXdf8wb3bCOwfKw3YFW/edit
Replanteamiento. En proceso.
https://docs.google.com/spreadsheets/d/1TmbRmBzmSWbhzIb7CwxGZDSRgQklDMj-S6tgIS4BQHo/edit?gid=0#gid=0
Terminado: Módulo 2. Sesiones 1 al 7.
REPLANTEAMIENTO DE LOS MÓDULOS
Arquitectura Segunda Cohorte.docx', '2026-07-16', array['P003']::text[], 'done', 2, '[]'::jsonb, '[]'::jsonb, 0),
('91959004-37a1-549d-8165-fdf03999fb45', 'PR01', 'RETIRAR LAS CAMISAS', 'Alvaro 4pm', '2026-07-17', array['P002']::text[], 'done', 0, '[]'::jsonb, '[]'::jsonb, 0),
('afbf10b3-ebf5-5b33-9691-fa32a8183376', 'PR01', 'ENVIAR QR DE ENTRADAS A LOS QUE CONFIRMARON', 'Male
Antes estaba en el proyecto «Male». Ahora es una acción de Reeduca.', '2026-07-17', array['P007']::text[], 'done', 1, '[]'::jsonb, '[]'::jsonb, 0),
('f04151a4-786e-5a05-a5ac-8c05d0c04196', 'PR01', 'REFUERZO DE CORREO PARA CONFIRMACIÓN DE ASISTENCIA', 'Male
Antes estaba en el proyecto «Male». Ahora es una acción de Reeduca.', '2026-07-17', array['P007']::text[], 'done', 2, '[]'::jsonb, '[]'::jsonb, 0),
('f9c4faf9-0e1a-580d-bbbf-ae7748fc72d1', 'PR04', 'REU PROYECTO MELODÍA. 8:30 AM', 'Álvaro, Pablo, Luciana.', '2026-07-17', array['P002','P003','P006']::text[], 'done', 3, '[]'::jsonb, '[]'::jsonb, 0),
('713f2d87-1d84-57ef-a18e-8ad47738e9fe', 'PR05', 'REUNION CON LA 
Universidad Católica Nuestra Señora de la Asunción Campus Guaira', 'Alvaro y Pablo - 9:45', '2026-07-17', array['P002','P003']::text[], 'done', 4, '[]'::jsonb, '[]'::jsonb, 0),
('b963a862-39b7-5289-b6f0-acba6d718a7d', 'PR05', 'ARQUITECTURA PEDAGÓGICA MÓDULO 4', null, '2026-07-17', array['P003']::text[], 'done', 5, '[]'::jsonb, '[]'::jsonb, 0),
('c0be755d-815f-562e-a107-84e095a914d4', 'PR01', 'LANZAMIENTO LNR. EXPO. 11:00 A 13:00 HS.', null, '2026-07-18', array['P006']::text[], 'done', 0, '[]'::jsonb, '[]'::jsonb, 0),
('177d1706-a5a0-5788-9538-8686b8d4a861', 'PR01', 'VER ACCIONES DEL PIPELINE VENTAS - MALENA', 'Actualizar datos del pipeline
Completar el pipeline para Universidades.
https://docs.google.com/spreadsheets/d/181ZomPlK4SMim80W0W-gZIe_uTVDWq7pBa_PQlacy28/edit?gid=1651662568#gid=1651662568
Actualizar la info. del pipeline de academias.
https://docs.google.com/spreadsheets/d/181ZomPlK4SMim80W0W-gZIe_uTVDWq7pBa_PQlacy28/edit?gid=1935931437#gid=1935931437
27.0', '2026-07-20', array['P007']::text[], 'done', 0, '[]'::jsonb, '[]'::jsonb, 0),
('84b5578f-7703-53e3-bf19-593d56a9c284', 'PR01', 'VER INSITUCIONES EN LAS QUE SE PUEDA DECLARAR DE INTERÉS A LA LNR', 'MEC
CONACYT', '2026-07-20', array['P009']::text[], 'done', 1, '[]'::jsonb, '[]'::jsonb, 0),
('e7ec2db3-5a13-5d78-8ea5-a5cd0f1f2389', 'PR01', 'CARTAS DE AGRADECIMIENTO.', 'Enviadas por Álvaro.', '2026-07-20', array['P002']::text[], 'done', 2, '[]'::jsonb, '[]'::jsonb, 0),
('dfa53248-b7a6-51a9-b4e4-031522968ad2', 'PR05', 'Proyecto de capacitación Cohorte 2', 'Enviado a Blas para revision', '2026-07-20', array['P003']::text[], 'done', 3, '[]'::jsonb, '[]'::jsonb, 0),
('fb13b1e7-27c6-5566-90a2-d55affd293f2', 'PR05', 'DiISEÑO DE MATRIZ DE IMPLEMENTACIÓN', 'MATRIZ DE INDICADORES DE IMPLEMENTACIÓN
Compartido con el equipo para su revisión.', '2026-07-20', array['P003']::text[], 'done', 4, '[]'::jsonb, '[]'::jsonb, 0),
('6503b7c3-358b-53a1-9283-a2e7c6597898', 'PR06', 'REUNIÓN KALIX. 10:40', 'Revisar calendario de redes: revisar esta tarde/ ver contenido proyectado.
Pasar acceso a canva de materiales para el Kali Link', '2026-07-20', array['P006']::text[], 'done', 5, '[]'::jsonb, '[]'::jsonb, 0),
('9f365b43-7386-5281-ae6b-8b859cb4cb6d', 'PR06', 'SUBIR FOTOS DE LA EXPO.', '03. EXPO', '2026-07-20', array['P006']::text[], 'done', 6, '[]'::jsonb, '[]'::jsonb, 0),
('b6b7f3a3-a353-5955-b0d7-577c0908881d', 'PR08', 'VACACIONES DE INVIERNO', null, '2026-07-20', array['P002']::text[], 'done', 7, '[]'::jsonb, '[]'::jsonb, 0),
('1a65c2e1-d64f-5c45-8c25-dbfad63773e2', 'PR01', 'VER ACCIONES DEL PIPELINE VENTAS - MALENA', 'Incluir en el pipeline ventas los datos del Goethe, Colegio Grace, Colegio Las Colinas
https://docs.google.com/spreadsheets/d/181ZomPlK4SMim80W0W-gZIe_uTVDWq7pBa_PQlacy28/edit?gid=0#gid=0
Antes estaba en el proyecto «Male». Ahora es una acción de Reeduca.', '2026-07-21', array['P007']::text[], 'done', 0, '[]'::jsonb, '[]'::jsonb, 0),
('2b684736-bdc2-5995-9570-0626b617bdb3', 'PR02', 'NOTA DE SOLICITUD LNR - INTERÉS EDUCATIVO', 'NOTA INTERÉS EDUCATIVO
Revisar nota: Álvaro.
Enviar nota: Álvaro.', '2026-07-21', array['P002']::text[], 'done', 1, '[]'::jsonb, '[]'::jsonb, 0),
('9461e241-223e-54a0-a859-1668c6e00627', 'PR05', 'REUNIÓN CON EQUILIBRIUM. 2:00 PM.', 'Hecha. Asisten Álvaro, Pablo, Diana y Ale.', '2026-07-21', array['P002','P003','P005','P008']::text[], 'done', 2, '[]'::jsonb, '[]'::jsonb, 0),
('c52fc99c-d845-5bce-a62b-fef962a9129f', 'PR05', 'REUNIÓN CON EL EQUIPO', 'Analizr matriz de implementación
MATRIZ DE INDICADORES DE IMPLEMENTACIÓN', '2026-07-21', array['P003']::text[], 'done', 3, '[]'::jsonb, '[]'::jsonb, 0),
('f29546a8-9ecd-51eb-8223-5a27364f5d64', 'PR05', 'DOCUMENTOS FIFA EN PROCESO DE DESARROLLO', null, '2026-07-22', array['P003']::text[], 'done', 0, '[]'::jsonb, '[]'::jsonb, 0),
('0faa34f2-f156-50ee-a33c-353beeaa9959', 'PR01', 'ACTUALIZAR EL PIPELINE', 'Male
Antes estaba en el proyecto «Male». Ahora es una acción de Reeduca.', '2026-07-23', array['P007']::text[], 'done', 0, '[]'::jsonb, '[]'::jsonb, 0),
('34476598-03f2-5376-8642-7500dc31e44f', 'PR05', 'Diseño de sistema de alertas tempranas', '04. DISEÑO DEL SISTEMA DE ALERTAS TEMPRANAS', '2026-07-23', array['P003']::text[], 'done', 1, '[]'::jsonb, '[]'::jsonb, 0),
('3992b008-7171-58af-b88e-2bb56ee30b22', 'PR05', 'REUNIÓN PED', '11:00 HS', '2026-07-23', array['P003']::text[], 'done', 2, '[]'::jsonb, '[]'::jsonb, 0),
('4d862cc3-89ad-5825-815d-1517bf381ae6', 'PR05', 'REUNIÓN DE EQUIPO. TEMAS DE FIFA', 'Con relación a la Feria Pedagógica.', '2026-07-23', array['P003']::text[], 'done', 3, '[]'::jsonb, '[]'::jsonb, 0),
('6a60ba1c-8115-5b0f-a43c-aad457b3f567', 'PR05', 'DISEÑO DE PROTOCOLO DE VISITAS', '05. PROTOCOLO DE VISITAS DE SEGUIMIENTO
30.0', '2026-07-23', array['P003']::text[], 'done', 4, '[]'::jsonb, '[]'::jsonb, 0),
('9d37f8c8-3de2-5844-bc5d-17db71dc678d', 'PR05', 'Diseño de rúbrica de observación de clases', '03. RÚBRICA DE OBSERVACIÓN DE CLASES', '2026-07-23', array['P003']::text[], 'done', 5, '[]'::jsonb, '[]'::jsonb, 0),
('e61fab4f-0088-5e10-9c06-299673dadafd', 'PR05', 'DISEÑO DE MATRIZ DE IMPLEMENTACIÓN', 'Terminar de ajustar documento, acorde al feedback.
02. MATRIZ DE INDICADORES DE IMPLEMENTACIÓN. 2DO. BORRADOR', '2026-07-23', array['P003']::text[], 'done', 6, '[]'::jsonb, '[]'::jsonb, 0),
('b7c77085-ee54-59fe-8161-9ea3e1f9f082', 'PR06', 'REVISAR METRICOOL', 'Publicación aprobada.
Publicaciones revisadas.
Publicaciones aprobadas.', '2026-07-23', array['P006']::text[], 'done', 7, '[]'::jsonb, '[]'::jsonb, 0),
('13f87d1f-fceb-54c8-9ab8-3ca1b6e20ac5', 'PR01', 'VER ACCIONES DEL PIPELINE POS VENTAS - MALENA', 'Ordenar y actualizar el pipeline.', '2026-07-24', array['P007']::text[], 'done', 0, '[]'::jsonb, '[]'::jsonb, 0),
('24277deb-5b55-5481-85c1-babd7393d138', 'PR01', 'PARA EQUIPOS LNR', 'Fotos de cómo se están preparando para la primera fecha.', '2026-07-24', array['P006']::text[], 'done', 1, '[]'::jsonb, '[]'::jsonb, 0),
('3121734d-2b66-53d4-ab69-23ef3a383fed', 'PR01', 'FORM PARA ACADEMIAS', 'Logos + horarios + edades + redes + dirección + mail + cel', '2026-07-24', array['P002']::text[], 'done', 2, '[]'::jsonb, '[]'::jsonb, 0),
('8fcb71d1-5b2b-5166-bcb3-e3c5d7cf63f4', 'PR01', 'HACER SEGUIMIENTO A CENTRO REGIONAL DE CDE', 'Enviar un documento sobre la LNR y comentandole la categoria V5 (MALE)
Antes estaba en el proyecto «Male». Ahora es una acción de Reeduca.', '2026-07-24', array['P007']::text[], 'done', 3, '[]'::jsonb, '[]'::jsonb, 0),
('0355ae89-c2aa-5aa9-8c10-b6ec9b97ed1c', 'PR01', 'Enviar invitaciones a la LNR - A RECUPERAR', 'Centro Educativo Campo Verde
Centro Educativo Maristas San Pablo', '2026-07-27', array['P003']::text[], 'done', 0, '[]'::jsonb, '[]'::jsonb, 0),
('1a7344e0-ced4-542a-80b9-3a3462ccfaba', 'PR01', 'Enviar invitaciones a la LNR - CLIENTES  Enviado el 17/07', 'Colegio 1ero. de Marzo
Colegio Aula Viva - Extracurricular
Colegio Los Laureles
San Ignacio de Loyola (SIL) - Curricular
Panamerican International School
Arambe', '2026-07-27', array['P006']::text[], 'done', 1, '[]'::jsonb, '[]'::jsonb, 0),
('214eeba4-2d29-5e96-945b-8fbf4696ab6c', 'PR01', 'ARMAR ESTRUCTURA SHOW & TELL PARA EL MEC', 'Pendiente.
Hecho
Pendiente: corregir diapositivas.', '2026-07-27', array['P009']::text[], 'done', 2, '[]'::jsonb, '[]'::jsonb, 0),
('c4127346-3a12-5cf7-bff5-9430d8833a3e', 'PR01', 'SEGUIMIENTO PARAGUAY TECH WEEK', 'Ver: material enviado para su difusión - Compartir con Kalix
https://docs.google.com/presentation/d/1Mndl8C3VPPNvCc6kvkcnuPZ8gj1_ljhrx4GKGLb4TiQ/edit?slide=id.g34972d08e26_0_88#slide=id.g34972d08e26_0_88
Kalix va a calendarizar posteos en Metricool.', '2026-07-27', array['P006']::text[], 'done', 3, '[]'::jsonb, '[]'::jsonb, 0),
('f042c3c9-0701-50d6-82a3-97fadec3e228', 'PR01', 'SEGUIMIENTO VENTAS INICIADAS + INVITACIÓN A LA LIGA COMO ACCIÓN INMEDIATA', 'Berta CDE. Mandar mensaje: apertura de club extracurricular. Álvaro.
Canindeyu - Lu
Centro Educativo Leonarda Sánchez de Páez
Colegio Aldea de los Niños
Colegio Bertoni
Colegio Centro Educacional Cristiano', '2026-07-27', array['P002']::text[], 'done', 4, '[]'::jsonb, '[]'::jsonb, 0),
('f61bfc08-0075-5d1b-b72f-2d97660875b5', 'PR01', 'ENTREGA DE CANCHA     CPCC', 'Alvaro  -   (9-11) AM
Antes estaba en el proyecto «Male». Ahora es una acción de Reeduca.', '2026-07-27', array['P002']::text[], 'done', 5, '[]'::jsonb, '[]'::jsonb, 0);
insert into stage_tareas values
('fb72eedc-d8a9-51ae-ab20-e004883130e0', 'PR01', 'Enviar invitaciones a la LNR - CLIENTES POTENCIALES', 'Británico paraguayo - CDE
Colegio Santa Ana
Centro Educativo María Auxiliadora
Centro Educativo María Serrana
Centro Educativo Nuevo Milenio
Colegio Adventista de Asunción', '2026-07-27', array['P006']::text[], 'done', 6, '[]'::jsonb, '[]'::jsonb, 0),
('02c04ba8-96e7-5489-b6df-1a0cb60242aa', 'PR02', 'Enviar invitacion LNR · Colegio Santa Cecilia', 'Segmento: cliente potencial.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 7, '[]'::jsonb, '[]'::jsonb, 0),
('0760eb7f-0226-5311-b417-0d51a63b5240', 'PR02', 'Enviar invitacion LNR · Nuestra Sra del Huerto', 'Segmento: cliente.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 8, '[]'::jsonb, '[]'::jsonb, 0),
('089134a2-4242-5ca2-a6fa-2f4fc9410932', 'PR02', 'Enviar invitacion LNR · Panamerican International School', 'Segmento: cliente.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 9, '[]'::jsonb, '[]'::jsonb, 0),
('0f0df8a4-068b-570f-b204-36f98e9f539b', 'PR02', 'Enviar invitacion LNR · Británico paraguayo - CDE', 'Segmento: cliente potencial.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 10, '[]'::jsonb, '[]'::jsonb, 0),
('10f6c636-893b-529f-b370-b861c88948b0', 'PR02', 'Enviar invitacion LNR · Colegio Técnico San Juan Bautista', 'Segmento: cliente potencial.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 11, '[]'::jsonb, '[]'::jsonb, 0),
('12f7f237-13c5-5d9b-aa1e-ff1e3c98c9f8', 'PR02', 'Enviar invitacion LNR · ARMAR ESTRUCTURA SHOW & TELL PARA EL MEC', 'Segmento: a recuperar.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 12, '[]'::jsonb, '[]'::jsonb, 0),
('17a7a8de-f19d-5099-bfca-cda7f6a6ed94', 'PR02', 'Enviar invitacion LNR · Colegio Bautista Nueva Jerusalén', 'Segmento: cliente potencial.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 13, '[]'::jsonb, '[]'::jsonb, 0),
('22b2fd97-0aa1-5597-b69e-47f821d99407', 'PR02', 'Enviar invitacion LNR · Colegio 1ero. de Marzo', 'Segmento: cliente.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 14, '[]'::jsonb, '[]'::jsonb, 0),
('2454599f-acf3-514c-b667-f32a049ed040', 'PR02', 'Enviar invitacion LNR · CDS', 'Segmento: cliente.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 15, '[]'::jsonb, '[]'::jsonb, 0),
('2af18443-9228-53b7-9e29-c38784bc219b', 'PR02', 'Enviar invitacion LNR · Colegio Santa Teresa de Jesús', 'Segmento: cliente potencial.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 16, '[]'::jsonb, '[]'::jsonb, 0),
('2f47a521-f748-5d91-853d-072093e83abe', 'PR02', 'Enviar invitacion LNR · ASA', 'Segmento: cliente.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 17, '[]'::jsonb, '[]'::jsonb, 0),
('2f687401-bbdd-5546-b06a-51cfa504e394', 'PR02', 'Enviar invitacion LNR · Arambe', 'Segmento: cliente.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 18, '[]'::jsonb, '[]'::jsonb, 0),
('3121f161-3024-5cd8-a482-9c2aca562c8b', 'PR02', 'Enviar invitacion LNR · Centro Educativo Campo Verde', 'Segmento: a recuperar.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 19, '[]'::jsonb, '[]'::jsonb, 0),
('33a949df-e558-5d1e-8b59-8efa2b9830b7', 'PR02', 'Enviar invitacion LNR · Spark', 'Segmento: cliente.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 20, '[]'::jsonb, '[]'::jsonb, 0),
('3b434f4a-8bf4-5ef6-9466-31dd3f440ec0', 'PR02', 'Enviar invitacion LNR · Colegio Grace', 'Segmento: cliente potencial.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 21, '[]'::jsonb, '[]'::jsonb, 0),
('3c0e41a2-edfc-55e3-aa44-ad2e6930743f', 'PR02', 'Enviar invitacion LNR · Colegio San José', 'Segmento: cliente potencial.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 22, '[]'::jsonb, '[]'::jsonb, 0),
('41973d5a-eece-50dc-9fb4-157b40492a1f', 'PR02', 'Enviar invitacion LNR · Colegio Anglo Americano', 'Segmento: cliente potencial.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 23, '[]'::jsonb, '[]'::jsonb, 0),
('56f72cf8-51ff-5b3a-a128-d66e25a581af', 'PR02', 'Enviar invitacion LNR · SEK', 'Segmento: cliente.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 24, '[]'::jsonb, '[]'::jsonb, 0),
('5c5890df-c4dc-5e9f-969d-5c629f9fc773', 'PR02', 'Enviar invitacion LNR · Colegio Bautista de Villa Morra', 'Segmento: cliente potencial.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 25, '[]'::jsonb, '[]'::jsonb, 0),
('6266fb04-9857-5acf-ade7-a7e7b0c94baa', 'PR02', 'Enviar invitacion LNR · Colegio Alberto Schweitzer', 'Segmento: cliente potencial.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 26, '[]'::jsonb, '[]'::jsonb, 0),
('6517e4f1-0d4e-5e3d-b58c-ea3e5bb16929', 'PR02', 'Enviar invitacion LNR · Centro Educativo María Auxiliadora', 'Segmento: cliente potencial.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 27, '[]'::jsonb, '[]'::jsonb, 0),
('67cf0f29-901f-50d7-a49a-0903d8bf5db4', 'PR02', 'Enviar invitacion LNR · Eco Colegio', 'Segmento: cliente potencial.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 28, '[]'::jsonb, '[]'::jsonb, 0),
('6ec269f7-d64d-5dc2-8917-92bc53d24eb5', 'PR02', 'Enviar invitacion LNR · Colegio Adventista de Asunción', 'Segmento: cliente potencial.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 29, '[]'::jsonb, '[]'::jsonb, 0),
('6fd37984-903a-5834-a431-e6f674485c43', 'PR02', 'Enviar invitacion LNR · RP Robotics', 'Segmento: cliente.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 30, '[]'::jsonb, '[]'::jsonb, 0),
('834b2ccb-5e78-5ef1-abda-70d198bea04d', 'PR02', 'Enviar invitacion LNR · Colegio Aula Viva - Extracurricular', 'Segmento: cliente.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 31, '[]'::jsonb, '[]'::jsonb, 0),
('90fa77d6-9d56-5280-a094-da3d2d83ee41', 'PR02', 'Enviar invitacion LNR · San Ignacio de Loyola (SIL) - Curricular', 'Segmento: cliente.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 32, '[]'::jsonb, '[]'::jsonb, 0),
('9326ca40-315b-5441-9851-cf4c1b36b0d4', 'PR02', 'Enviar invitacion LNR · England College Paraguay', 'Segmento: cliente potencial.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 33, '[]'::jsonb, '[]'::jsonb, 0),
('990b415b-52ac-5bb7-b83d-b3b6578c508b', 'PR02', 'Enviar invitacion LNR · Colegio Gabriela Mistral', 'Segmento: cliente potencial.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 34, '[]'::jsonb, '[]'::jsonb, 0),
('9b237346-b6f6-5bee-9330-d7f43a7960a4', 'PR02', 'Enviar invitacion LNR · Colegio Los Laureles', 'Segmento: cliente.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 35, '[]'::jsonb, '[]'::jsonb, 0),
('a2ed56de-d5d7-5ac3-99f0-268122600cb4', 'PR02', 'Enviar invitacion LNR · CEL', 'Segmento: cliente.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 36, '[]'::jsonb, '[]'::jsonb, 0),
('a375bf69-f924-5c1c-9579-999a9249d77f', 'PR02', 'Enviar invitacion LNR · Escuela Básica Heinfried Wolfgang Kress', 'Segmento: cliente.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 37, '[]'::jsonb, '[]'::jsonb, 0),
('a9e62d47-0cbb-5e8b-af76-6eae1ec82eab', 'PR02', 'Enviar invitacion LNR · Centro Educativo María Serrana', 'Segmento: cliente potencial.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 38, '[]'::jsonb, '[]'::jsonb, 0),
('aa72f747-86df-5b2b-b671-8c59ade33a71', 'PR02', 'Enviar invitacion LNR · Robolabz Robotics Academy', 'Segmento: cliente.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 39, '[]'::jsonb, '[]'::jsonb, 0),
('b93d4097-9bd2-54c3-a347-f950814875f7', 'PR02', 'Enviar invitacion LNR · Centro Educativo Maristas San Pablo', 'Segmento: a recuperar.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 40, '[]'::jsonb, '[]'::jsonb, 0),
('b9d05aed-ef78-576c-aaf7-82963a584d19', 'PR02', 'Enviar invitacion LNR · Pan American International School', 'Segmento: cliente.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 41, '[]'::jsonb, '[]'::jsonb, 0),
('ba877522-96e7-5de7-a237-ca2f68ece301', 'PR02', 'Enviar invitacion LNR · Holy Spirit School - Rinconcito de Luz', 'Segmento: cliente potencial.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 42, '[]'::jsonb, '[]'::jsonb, 0),
('bd1893a0-1b67-565a-9479-a6ca2460347e', 'PR02', 'Enviar invitacion LNR · Robotverse Academy', 'Segmento: cliente.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 43, '[]'::jsonb, '[]'::jsonb, 0),
('bfa6fcff-4046-5987-b192-6d8ce4cd84f0', 'PR02', 'Enviar invitacion LNR · Centro Educativo Nuevo Milenio', 'Segmento: cliente potencial.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 44, '[]'::jsonb, '[]'::jsonb, 0),
('c97c84d9-ee3f-58e3-9f93-d6ea89af4fd8', 'PR02', 'Enviar invitacion LNR · Euro school py', 'Segmento: cliente potencial.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 45, '[]'::jsonb, '[]'::jsonb, 0);
insert into stage_tareas values
('cd19e10b-164e-5688-9666-bd8e76ee6ae1', 'PR02', 'Enviar invitacion LNR · Centro de Capacitación Nikola Tesla', 'Segmento: cliente.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 46, '[]'::jsonb, '[]'::jsonb, 0),
('daf5a435-ed5c-5ad2-80a3-55c27ab4c553', 'PR02', 'Enviar invitacion LNR · Colegio Experimental Paraguay Brasil (CEPB)', 'Segmento: cliente potencial.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 47, '[]'::jsonb, '[]'::jsonb, 0),
('e9e2191f-05d3-56bf-9bbb-ed552ae0c851', 'PR02', 'Enviar invitacion LNR · Lycée Français International Marcel Pagnol d''Asunción', 'Segmento: cliente potencial.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 48, '[]'::jsonb, '[]'::jsonb, 0),
('ed701762-430d-523e-ba7c-e2cc05522482', 'PR02', 'Enviar invitacion LNR · Colegio Politécnico Cooperativa Capiatá', 'Segmento: cliente.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 49, '[]'::jsonb, '[]'::jsonb, 0),
('f5db37da-a9ae-56a3-a993-062e5f3a08a0', 'PR02', 'Enviar invitacion LNR · Cervantes', 'Segmento: cliente.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 50, '[]'::jsonb, '[]'::jsonb, 0),
('f7d756f4-8ef7-5b7c-9cd4-5a2bfa96fde7', 'PR02', 'Enviar invitacion LNR · Colegio Santa Ana', 'Segmento: cliente potencial.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 51, '[]'::jsonb, '[]'::jsonb, 0),
('faf1391b-75fb-56cc-a5db-5c4c62dd40e3', 'PR02', 'Enviar invitacion LNR · ICI', 'Segmento: cliente.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 52, '[]'::jsonb, '[]'::jsonb, 0),
('fe8c3d99-77fe-5a69-9a18-6878cafe9716', 'PR02', 'Enviar invitacion LNR · Colegio Iberoamericano ASUNCIÓN CENTRO', 'Segmento: cliente potencial.
Del envio masivo de invitaciones a la LNR del 27 de julio.', '2026-07-27', array['P006','P007']::text[], 'done', 53, '[]'::jsonb, '[]'::jsonb, 0),
('18c38d66-489e-5247-a187-f080f7f38fbd', 'PR03', 'AULAS 4.0', 'Escribir a Raquel: fijar fecha para la capacitación.
Preguntar a Raquel el carácter de las ferias pedagógicas: criterios evaluativos.', '2026-07-27', array['P003']::text[], 'done', 54, '[]'::jsonb, '[]'::jsonb, 0),
('4fbfcadd-4faf-51ce-a724-16c2fbe93674', 'PR03', 'PROPUESTA DE CLUB DE ROBÓTICA', null, '2026-07-27', array['P003']::text[], 'done', 55, '[]'::jsonb, '[]'::jsonb, 0),
('14f5beda-0223-59d1-b2ca-9d0374801fa4', 'PR04', 'INVITACIÓN LNR. REEDUCA', null, '2026-07-27', array['P002']::text[], 'done', 56, '[]'::jsonb, '[]'::jsonb, 0),
('ed83c6fe-1200-5ebf-93c6-a2cc064802a8', 'PR04', 'INVITACIÓN LNR. FUNDACIÓN STEM', null, '2026-07-27', array['P002']::text[], 'done', 57, '[]'::jsonb, '[]'::jsonb, 0),
('f4ff5877-2427-5d5c-b8b7-b57673807e82', 'PR04', 'PROPUESTA DEFENSORES DEL CHACO', null, '2026-07-27', array['P002']::text[], 'done', 58, '[]'::jsonb, '[]'::jsonb, 0),
('14f3aba5-a785-5f57-af36-967da994d22c', 'PR01', 'BUSCAR LOS COLEGIOS QUE CUENTAN CON IMPLEMENTOS POR PRIMERA VEZ', 'Male
Antes estaba en el proyecto «Male». Ahora es una acción de Reeduca.', '2026-07-28', array['P007']::text[], 'done', 0, '[]'::jsonb, '[]'::jsonb, 0),
('51038d2e-8a26-546f-9662-2b6fe299dd33', 'PR01', 'CORREGIR PRESS PARA EL MEC', 'Hecho', '2026-07-28', array['P009']::text[], 'done', 1, '[]'::jsonb, '[]'::jsonb, 0),
('6f5f37c4-8532-5c0d-9d21-c7dd67252c83', 'PR01', 'SEGUIMIENTO A LOS PRESUPUESTOS DE UNCA Y LA UC DE GUAIRA', 'Male
Antes estaba en el proyecto «Male». Ahora es una acción de Reeduca.', '2026-07-28', array['P007']::text[], 'done', 2, '[]'::jsonb, '[]'::jsonb, 0),
('adb06a75-e122-53f4-815e-a35a84b6392a', 'PR01', 'SUBIR PRESENTACIONES DE REEDUCA AL DRIVE', '05. PRESENTACIONES REEDUCA
La carpeta está dentro de clientes, ya que las presentación están hechas con miras a ventas potenciales.', '2026-07-28', array['P006']::text[], 'done', 3, '[]'::jsonb, '[]'::jsonb, 0),
('b1d97bd5-ea2f-5d5e-b8bd-a263f2876778', 'PR01', 'PREPARAR PRESUPUESTO PARA EL COLEGIO EXP. DE LA U. CATÓLICA', null, '2026-07-28', array['P006']::text[], 'done', 4, '[]'::jsonb, '[]'::jsonb, 0),
('f4e81ec8-6c4e-5c7a-8f70-0091ecfbee4b', 'PR01', '9:30 HS. REUNIÓN DE VENTAS. VIRTUAL. COLEGIO EXPERIMENTAL DE LA U.C. ITAPÚA', 'Álvaro, Pablo y Lu', '2026-07-28', array['P002','P003','P006']::text[], 'done', 5, '[]'::jsonb, '[]'::jsonb, 0),
('cf8cc59d-a7c5-5ad1-b69a-1eb0d4b2d800', 'PR03', 'ENVIAR PRESUPUESTO + NOTAS A RAQUEL', 'Hecho.
Compartir posteos de insta en el grupo para dar visibilidad al proyecto y captar nuevos seguidores.', '2026-07-28', array['P003']::text[], 'done', 6, '[]'::jsonb, '[]'::jsonb, 0),
('833a730f-9847-5f5f-8d88-7f6a19486e9b', 'PR04', 'PROPUESTA COLEGIO EXP. DE LA U. CATÓLICA', 'Falra el nombre de la directora y habría que verificar si el nombre de la institución es correcto.', '2026-07-28', array['P002']::text[], 'done', 7, '[]'::jsonb, '[]'::jsonb, 0),
('21bb7bca-3c37-5543-91d0-516e927bd283', 'PR01', 'REU: COLEGIO DE MARIANO ROQUE ALONSO. 10:00 HS.', 'Propuesta de venta: Álvaro y Lu.', '2026-07-29', array['P002','P006']::text[], 'done', 0, '[]'::jsonb, '[]'::jsonb, 0),
('22ec828d-47a3-577c-8377-21e96059d72b', 'PR01', 'REUNIÓN EN EL COLEGIO SEK', 'Alvaro Ozuna 3pm
Antes estaba en el proyecto «Male». Ahora es una acción de Reeduca.', '2026-07-29', array['P002']::text[], 'done', 1, '[]'::jsonb, '[]'::jsonb, 0),
('fa389757-be23-510b-8e77-29ca8c181fd2', 'PR01', 'SEGUIMIENTO FORM ACADEMIAS', 'Recibido en whatsapp: lista de Male', '2026-07-29', array['P007']::text[], 'done', 2, '[]'::jsonb, '[]'::jsonb, 0),
('b98d2ee6-5738-5e2b-a119-a6e65f1967b6', 'PR04', 'PROYECTO MELODÍA', 'https://docs.google.com/document/d/1wuHvBjp2d42NQ5ACNxfYZJKcQpMFN_0GpiQbGthUnVY/edit?usp=drive_link', '2026-07-29', array['P002']::text[], 'done', 3, '[]'::jsonb, '[]'::jsonb, 0),
('34da49b7-0162-5fd8-bc28-b184914681f7', 'PR06', 'KALIX', 'Revisar, proponer, aprobar.', '2026-07-29', array['P006']::text[], 'done', 4, '[]'::jsonb, '[]'::jsonb, 0),
('eca9bad6-da59-55ca-a7ac-b2a539261438', 'PR08', 'PREPARAR FACTURAS PARA COBRAR!!!!', '* ALVARO                                            *LU                                             *ALE                                     *PABLO', '2026-07-29', array['P002']::text[], 'done', 5, '[]'::jsonb, '[]'::jsonb, 0),
('027bdd0c-753b-5fb1-8699-4e606a619233', 'PR01', 'SOLICITAR REUNION DE MANERA PRESENCIAL (ASUNCION)', 'Collège De L` Immaculée Conception
Colegio Iberoamericano ASUNCIÓN CENTRO
Colegio Bautista de Villa Morra
Antes estaba en el proyecto «Male». Ahora es una acción de Reeduca.', '2026-07-30', array['P007']::text[], 'done', 0, '[]'::jsonb, '[]'::jsonb, 0),
('a37de0a1-c806-574a-a318-26c120037b5c', 'PR01', 'PRESUPUESTO DEL COLEGIO EXP. DE LA U. CATÓLICA', 'PROPUESTA COLEGIO EXP. DE LA U. CATÓLICA
Verificar envío.', '2026-07-30', array['P006']::text[], 'done', 1, '[]'::jsonb, '[]'::jsonb, 0),
('c9cd04dc-a4ff-5dc9-aa16-1ca2e3ec6346', 'PR01', 'PREPARAR PRESUPUESTO PARA EL COLEGIO DE MA. ROQUE ALONSO', 'Propuesta para club extracurricular + propuesta curricular.
https://docs.google.com/document/d/1od7ec878Fb5tNR0eD90pMZo8BK-8rQYI/edit', '2026-07-30', array['P006']::text[], 'done', 2, '[]'::jsonb, '[]'::jsonb, 0),
('13873e5e-14f3-564a-bda4-40cb9673db7e', 'PR05', 'CANVA: PRES MÓDULO 1', 'Compartida con Pablo para verificar ajustes.', '2026-07-30', array['P003']::text[], 'done', 3, '[]'::jsonb, '[]'::jsonb, 0),
('4b3d2abc-fbc6-5f88-9881-1b2bcde6bbac', 'PR05', 'REVISIÓN DE RÚBRICA', 'Ale, Di y Lu.', '2026-07-30', array['P005','P006','P008']::text[], 'done', 4, '[]'::jsonb, '[]'::jsonb, 0),
('7722826d-810b-5da1-8da1-d326c432ae10', 'PR05', 'CANVA: PRES MÓDULO 2. S1', 'En proceso.
Compartido con Pablo.', '2026-07-30', array['P006']::text[], 'done', 5, '[]'::jsonb, '[]'::jsonb, 0),
('c060806f-af76-5a64-8e31-09e3aab77d64', 'PR05', 'CARGAR DATOS DE FECHAS CLAVE EN EL CALENDAR', 'Capacitaciones.
Entrega de misiones.
Evaluaciones', '2026-07-30', array['P003']::text[], 'done', 6, '[]'::jsonb, '[]'::jsonb, 0),
('e977c004-fe76-581a-97ad-789d7282e116', 'PR08', 'PREPARAR FACTURAS PARA COBRAR!!!! (HASTA EL MEDIO DIA)', '* ALVARO                                            *LU                                             *ALE                                     *PABLO', '2026-07-30', array['P002']::text[], 'done', 7, '[]'::jsonb, '[]'::jsonb, 0),
('524a6d69-bc24-59b5-8788-cd79d5eb4e00', 'PR01', 'VOLUNTARIADO EN EL OPEN ROBOTICS', 'Male y Alvaro a las 8 de la mañana
Antes estaba en el proyecto «Male». Ahora es una acción de Reeduca.', '2026-07-31', array['P002','P007']::text[], 'done', 0, '[]'::jsonb, '[]'::jsonb, 0),
('80dc980d-c845-57bf-9ea8-ab6836df0673', 'PR01', 'ACTIVACIÓN EN EL GRUPO DE COACHES', 'Postear mensaje para captar nuevos seguidores e interacciones.
Abrir sesión de whatsapp en mi compu.
Mensaje para captar nuevos seguidores e interacciones.', '2026-07-31', array['P006']::text[], 'done', 1, '[]'::jsonb, '[]'::jsonb, 0),
('a50faadb-4fa9-5f7f-95f4-3966edbd6bd6', 'PR01', 'SEGUIMIENTO FOTOS CÓMO SE ESTÁN PREPARANDO PARA LA LNR', null, '2026-07-31', array['P006']::text[], 'done', 2, '[]'::jsonb, '[]'::jsonb, 0),
('53a9e399-86ef-55ab-86f4-fbb24b7b22bd', 'PR05', 'REUNIÓN DE GAMIFICACIÓN', null, '2026-07-31', array['P003']::text[], 'done', 3, '[]'::jsonb, '[]'::jsonb, 0),
('289306d7-f05a-5f49-93ad-6c6e60acb8d7', 'PR01', 'DESAYUNO DIRECTIVOS Y COORDINADORES', null, '2026-08-01', array['P006']::text[], 'done', 0, '[]'::jsonb, '[]'::jsonb, 0);
insert into stage_tareas values
('0b429cd4-6934-5437-99ab-f64de7eee901', 'PR01', 'Male: actualizar el pipelne pos venta.', 'Antes estaba en el proyecto «Male». Ahora es una acción de Reeduca.', '2026-08-03', array['P007']::text[], 'done', 0, '[]'::jsonb, '[]'::jsonb, 0),
('bbe76c1f-546a-5d50-928a-189f3be9f035', 'PR01', 'SEGUIMIENTO POS VENTA. MALE & LU', 'Lista actualizada de colegios: datos pendientes.
Añadir a coaches nuevos al grupo LNR.', '2026-08-03', array['P007']::text[], 'done', 1, '[]'::jsonb, '[]'::jsonb, 0),
('ed0942df-dafc-5af8-9610-0f1aebf8ebf7', 'PR02', 'WHASTAPP COACHES: FECHAS LNR', 'Mensaje publicado.', '2026-08-03', array['P002']::text[], 'done', 2, '[]'::jsonb, '[]'::jsonb, 0),
('d7db8961-c28b-518b-8ba4-6dc5fd3f91d2', 'PR04', 'CUMPLE DE DI', '¡Almuerzo!', '2026-08-03', array['P005']::text[], 'todo', 3, '[]'::jsonb, '[]'::jsonb, 0),
('1c04addf-1773-562d-999b-a831637083f7', 'PR05', 'EDICIÓN GUÍA DOCENTE UNIDAD 2', 'Terminada.', '2026-08-03', array['P003']::text[], 'done', 4, '[]'::jsonb, '[]'::jsonb, 0),
('1e6b2e37-837b-521c-b193-3474474ace62', 'PR05', 'EDICIÓN GUÍA DOCENTE UNIDAD 1', 'Terminada.', '2026-08-03', array['P003']::text[], 'done', 5, '[]'::jsonb, '[]'::jsonb, 0),
('3f34b436-cd1b-5b85-b691-796d9d54c704', 'PR05', 'VER: FORMULARIOS AL FINAL DE CADA SESIÓN.', '¿En dónde están alojados?
¿Quién se encarga de recabar los datos?', '2026-08-03', array['P003']::text[], 'todo', 6, '[]'::jsonb, '[]'::jsonb, 0),
('606c737b-08fc-53fa-aba1-a468625949b6', 'PR05', 'PRES. A DIRECTIVOS. TM. 10:00 HS.', 'Pablo + Diana', '2026-08-03', array['P003','P005']::text[], 'todo', 7, '[]'::jsonb, '[]'::jsonb, 0),
('77e5f1b7-27bf-527b-a4db-9644457d406d', 'PR05', 'EDICIÓN GUÍA DOCENTE UNIDAD 3', 'Terminada.', '2026-08-03', array['P003']::text[], 'done', 8, '[]'::jsonb, '[]'::jsonb, 0),
('9c7e2547-8c64-5937-9922-5f5e93326f8b', 'PR05', 'Recepción de tareas de regularización', 'Revisar una vez al mes hasta la primera semana de noviembre y registrar nuevas entregas.', '2026-08-03', array['P004','P005']::text[], 'todo', 9, '[{"id": "79e21091-afaf-5c2b-9fd2-4d4651e3ad34", "text": "Evidencias actualizadas (CARGAR EN EL CLASSROOM EL AVISO CON LAS FECHAS DE RECEPCIÓN DE TAREAS)", "done": false}]'::jsonb, '[]'::jsonb, 0),
('befe5e5b-ebee-534c-a894-518054b31af1', 'PR05', 'PRES. A DIRECTIVOS. TT. 14:30 HS.', 'Pablo + Álvaro + Diana', '2026-08-03', array['P002','P003','P005']::text[], 'done', 10, '[]'::jsonb, '[]'::jsonb, 0),
('3a416a02-a749-57ca-b126-5c4f730de8b0', 'PR06', 'KALIX: SEGUIMIENTO A POSTEOS SEMANALES', 'Solicitar posteos en el grupo.
Revisar propuesta de posteos.
https://docs.google.com/document/d/1TWCZaauLDyNxfPMV6h1BG92wxDN363J0/edit
Terminado y compartido con Kalix.', '2026-08-03', array['P006']::text[], 'done', 11, '[]'::jsonb, '[]'::jsonb, 0),
('6e53185b-5cc4-55ba-a67f-2a3919d01bfa', 'PR09', 'PARAGUAY TECH WEEK', null, '2026-08-03', array['P006']::text[], 'done', 12, '[]'::jsonb, '[]'::jsonb, 0),
('59eb382d-7271-5e9e-a389-c3d98a174488', 'PR01', 'SEGUIMIENTO: PIPELINE POS VENTA', 'https://docs.google.com/spreadsheets/d/1jMR0_44g9o9AOl_cx3Ez8O4LUw-LlKyPIzl0c-rCyjk/edit?gid=1038430606#gid=1038430606
Male: actualizar datos.
Male + Lu: revisar procesos del pipeline.
Male + Lu: programar/ ejecutar acciones.', '2026-08-04', array['P006','P007']::text[], 'done', 0, '[]'::jsonb, '[]'::jsonb, 0),
('5c18ea20-4745-5de3-b916-549f46f9ff00', 'PR01', 'NOTA PARA BERTA', 'PDF enviado a Álvaro.', '2026-08-04', array['P002']::text[], 'done', 1, '[]'::jsonb, '[]'::jsonb, 0),
('7c0cf628-d7bd-531c-8b25-a6a90aa012b4', 'PR01', 'REVISIÓN DEL PIPELINE DE VENTAS', 'Álvaro + Lu + Male', '2026-08-04', array['P002','P006','P007']::text[], 'done', 2, '[]'::jsonb, '[]'::jsonb, 0),
('7c5538dc-e599-5064-a718-65acb1130c88', 'PR01', 'INSUMOS IQ PRIMERA GENERACIÓN', 'Male: Responder mensaje de Diego.', '2026-08-04', array['P007']::text[], 'done', 3, '[]'::jsonb, '[]'::jsonb, 0),
('c1fe7274-b1f4-5e5b-be8e-1ef1a3bc7c6e', 'PR01', 'CARGAR DATOS AL PIPELINE DE VENTAS', 'Male
Álvaro va a automarizar la carga de datos el fin de semana.
Antes estaba en el proyecto «Male». Ahora es una acción de Reeduca.', '2026-08-04', array['P002']::text[], 'done', 4, '[]'::jsonb, '[]'::jsonb, 0),
('4cf81b1d-37ef-5712-ae32-5b0ae4015941', 'PR05', 'EDICIÓN GUÍA DOCENTE UNIDAD 4', 'Terminado.
Iniciada. En proceso.', '2026-08-04', array['P003']::text[], 'done', 5, '[]'::jsonb, '[]'::jsonb, 0),
('03112e47-efc8-51e0-8052-bdb6f40d5a9a', 'PR01', 'SEGUIMIENTO DE ITTI', 'Hecho.', '2026-08-05', array['P006']::text[], 'done', 0, '[]'::jsonb, '[]'::jsonb, 0),
('2a1d49fe-b359-5051-bb20-e6eb5c39b9f5', 'PR01', 'Ver pendientes pipeline Ventas', 'Male :0
Antes estaba en el proyecto «Male». Ahora es una acción de Reeduca.', '2026-08-05', array['P007']::text[], 'done', 1, '[]'::jsonb, '[]'::jsonb, 0),
('df2009a4-32ba-5959-abd1-5cb17fbf2864', 'PR01', 'ALIANZA ESTRATÉGICA CON CISOFT', 'Conversado con Vane Cañete.', '2026-08-05', array['P006']::text[], 'done', 2, '[]'::jsonb, '[]'::jsonb, 0),
('37458fad-b134-5e81-9828-6e99126ee7ac', 'PR06', 'KALIX: AGENDA DE LA LNR', 'Insertar sedes; solicitar edición y publicación de flyer.', '2026-08-05', array['P006']::text[], 'done', 3, '[]'::jsonb, '[]'::jsonb, 0),
('5cc737a4-aa58-5387-91a2-e761cc4cc0aa', 'PR09', 'CORPORATE REVERSE PITCH. 17:00 A 18:00 HS. CLUB TOUCH', 'Lu', '2026-08-05', array['P006']::text[], 'done', 4, '[]'::jsonb, '[]'::jsonb, 0),
('6f24c1b8-7929-5a9f-b4d2-d27025d1a6a4', 'PR09', 'MUJERES QUE ESCALAN. 11:30 A 13:00 HS. CLUB TOUCH', 'Lu', '2026-08-05', array['P006']::text[], 'done', 5, '[]'::jsonb, '[]'::jsonb, 0),
('0a65df1c-895b-55be-9dfc-7b4413417345', 'PR01', 'FECHA DE ENCUENTRO PARA DOCENTES DE CLUBES NUEVOS', null, '2026-08-06', array['P006']::text[], 'todo', 0, '[]'::jsonb, '[]'::jsonb, 0),
('71c7d013-7cb6-5eaa-8951-cd0df45b035e', 'PR01', 'SEGUIMIENTO DE PIPELINE: LU', 'Hecho.', '2026-08-06', array['P006']::text[], 'done', 1, '[]'::jsonb, '[]'::jsonb, 0),
('8a088848-5e4c-5e03-8b7c-81c08ba117bd', 'PR01', 'PREPARAR LA PROPUESTA PARA EL SANTA ANA', 'https://docs.google.com/document/d/1_vpCFm6SDgbYBYq9AM0R4o2f7qNQYnaYtgD5JCO14o8/edit?tab=t.0
Álvaro: revisar y aprobar.
Lu: enviar a Elvira', '2026-08-06', array['P002','P006']::text[], 'todo', 2, '[]'::jsonb, '[]'::jsonb, 0),
('d3e64b8a-c7bc-54bd-b2c5-75ba92aaa22d', 'PR01', 'REUNIÓN DE PLANIFICACIÓN', 'Hecho: Álvaro, Male, Pablo, Di & Lu', '2026-08-06', array['P002','P003','P005','P006','P007']::text[], 'done', 3, '[]'::jsonb, '[]'::jsonb, 0),
('cb81940d-7cf2-5828-b774-8aeaeaa6da22', 'PR03', 'MENSAJE DE SEGUIMIENTO A RAQUEL', 'FIjar fecha de capacitación.
Ver: equipo de competición.', '2026-08-06', array['P003']::text[], 'todo', 4, '[]'::jsonb, '[]'::jsonb, 0),
('035e65d7-7139-5521-a409-6131cea42bf4', 'PR05', 'PRESENTACIONES PARA COHORTE 2', 'Pablo pasa foto para pres M1.
Lu: insertar diapos pendientes.
Bajar a PPTS y compartir.
Pablo:  revisar pres Módulo 2. S1.', '2026-08-06', array['P003']::text[], 'todo', 5, '[]'::jsonb, '[]'::jsonb, 0),
('1e3583a1-1fc5-5aef-879a-ff5cc0079f8c', 'PR05', 'PASAR CALENDARIO DE VISITAS A PATTY. DI', 'Solicitar comunicación con directores y supervisores zonales.
Correo: Patty. Whatsapp: Di.', '2026-08-06', array['P005']::text[], 'todo', 6, '[]'::jsonb, '[]'::jsonb, 0),
('4f86847e-f459-5704-b94a-80b318801891', 'PR05', 'EDICIÓN GUÍA DOCENTE UNIDAD 5', 'En proceso.
Terminado', '2026-08-06', array['P003']::text[], 'done', 7, '[]'::jsonb, '[]'::jsonb, 0),
('6e2cac1f-2a67-5531-97f9-ce8263808aba', 'PR05', 'TIEMPO LÍMITE PARA EXAMENES', 'Pablo investiga cómo cronometrar el examen.
Se elige y se elaboran la evaluación final del Módulo 2.', '2026-08-06', array['P003']::text[], 'todo', 8, '[]'::jsonb, '[]'::jsonb, 0),
('823efa14-be58-50b7-9ce1-5f6e83e32468', 'PR05', 'AVERIGUAR QUIEN CREA LOS CLASSROOM', 'Pablo', '2026-08-06', array['P003']::text[], 'todo', 9, '[]'::jsonb, '[]'::jsonb, 0),
('9f63fb93-a8f1-58b6-93c9-360b3efd8627', 'PR05', 'EDICIÓN GUÍA DOCENTE UNIDAD 6', 'Terminado
13.0', '2026-08-06', array['P003']::text[], 'done', 10, '[]'::jsonb, '[]'::jsonb, 0),
('bc68847c-1574-5e4c-9261-560ebeac988c', 'PR01', 'ORDENAR EL DEPOSITO', 'Male
Antes estaba en el proyecto «Male». Ahora es una acción de Reeduca.', '2026-08-07', array['P007']::text[], 'todo', 0, '[]'::jsonb, '[]'::jsonb, 0),
('7017c832-c928-50e4-b824-770c4413887b', 'PR05', 'COMUNICAR VISITAS A DIRECTIVOS', 'Di.', '2026-08-07', array['P005']::text[], 'todo', 1, '[]'::jsonb, '[]'::jsonb, 0),
('91de7d81-1aa2-5b8b-be4d-f275ebb485a4', 'PR05', 'HACER PEDIDO DE MATERIALES PARA SESIÓN PRESENCIAL.', 'Pablo', '2026-08-07', array['P003']::text[], 'todo', 2, '[]'::jsonb, '[]'::jsonb, 0),
('95d2a160-bc8e-5046-b021-4c5f1a3c82d3', 'PR05', 'COMUNICAR AUTOEVALUACIONES A DOCENTES', 'Di.', '2026-08-07', array['P005']::text[], 'todo', 3, '[]'::jsonb, '[]'::jsonb, 0);
insert into stage_tareas values
('9a98e031-1115-5eab-848a-baaa382e4702', 'PR05', 'SUBIR AUTOEVALUACIONES', 'Pablo
Comunicar por flyer: alzamos las autoevaluaciones, cual es la finalidad, hasta cuando están disponibles: hasta el día antes del examne final. Compartimos fecha del examen final. Diponibilidad de x a x fecha.', '2026-08-07', array['P003']::text[], 'todo', 4, '[]'::jsonb, '[]'::jsonb, 0),
('bcbd7f0d-7a7a-5f91-8154-4b74f9383599', 'PR05', 'AVERIGUAR QUIEN CREA LOS CLASSRTOOM', 'Hecho. Se encarga Equlibrium. Reeduca carga el contenido.', '2026-08-07', array['P003']::text[], 'done', 5, '[]'::jsonb, '[]'::jsonb, 0),
('fb7ca264-e66d-5c4e-858f-fe254a25bb29', 'PR05', 'REVISAR EXÁMENES FIFA. LU', 'Hecho.
5 exámenes de 20 preguntas.
Para el examen final se extraerán 20 preguntas de las 5 autoevaluaciones.', '2026-08-07', array['P006']::text[], 'done', 6, '[]'::jsonb, '[]'::jsonb, 0),
('ff0946fb-0552-5687-a0f0-b7c612039a11', 'PR05', 'EDICIÓN GUÍA DOCENTE UNIDAD 7', 'Terminado', '2026-08-07', array['P003']::text[], 'done', 7, '[]'::jsonb, '[]'::jsonb, 0),
('ff52afb7-abdf-5f4e-a83c-66f56a6a3daf', 'PR05', 'EDITAR PRES M2. S1.', 'Lu', '2026-08-07', array['P006']::text[], 'done', 8, '[]'::jsonb, '[]'::jsonb, 0),
('0d075751-d5fa-5625-a940-6af1d8767d57', 'PR05', 'EDICIÓN GUÍA DOCENTE UNIDAD 8', null, '2026-08-09', array['P003']::text[], 'done', 0, '[]'::jsonb, '[]'::jsonb, 0),
('2a9b00a6-6392-5b10-aa6f-aa4c5740959b', 'PR05', 'SUBIR DOCS. LIBRO DE 1ER. GRADO', '01. 1ER. GRADO
02. LIBROS', '2026-08-09', array['P003']::text[], 'todo', 1, '[]'::jsonb, '[]'::jsonb, 0),
('a1f7d729-9830-5b65-a6f0-2df21064a641', 'PR01', 'PRESS ALIANZA REEDUCA+CISOFT', 'Álvaro: revisar.
Lu: enviar a Andrea', '2026-08-10', array['P006']::text[], 'done', 0, '[]'::jsonb, '[{"id": "f84a2ec5-bb29-5e9e-a314-bd769e0920be", "label": "Abrir archivo", "url": "https://www.canva.com/design/DAHR1FYBhY0/6HFEO4uATlvb5Otm5R2lig/edit"}]'::jsonb, 0),
('a60af22d-cd62-55bf-8deb-285fbd692a05', 'PR01', 'ENVIAR PROPUESTA AL SANTA ANA', 'Propuesta enviada', '2026-08-10', array['P006']::text[], 'done', 1, '[]'::jsonb, '[{"id": "3ae5918f-a504-5a96-b3d7-dbac2e9047e6", "label": "Abrir archivo", "url": "https://docs.google.com/document/d/1_vpCFm6SDgbYBYq9AM0R4o2f7qNQYnaYtgD5JCO14o8/edit?tab=t.0"}]'::jsonb, 0),
('d1b32f38-59e9-56bc-a5b7-9a5f6f40371c', 'PR01', 'REUNIÓN CON CDI', 'Paty Tala (11:00)', '2026-08-10', array['P006']::text[], 'done', 2, '[]'::jsonb, '[{"id": "9af7a8c3-dc91-50ae-990b-dce3158763ab", "label": "Abrir archivo", "url": "https://calendar.app.google/7RREm2rBbrZfczXHA"}]'::jsonb, 0),
('1ff20c52-82aa-56a1-ad04-01a4c443f446', 'PR02', 'COMUNICAR INSCRIPCION LNR', 'Flyer comunicado de la inscripción oficial LNR.', '2026-08-10', array['P002']::text[], 'done', 3, '[]'::jsonb, '[]'::jsonb, 0),
('c89a0ebe-0a0d-5023-88b9-06d89ccfe5f4', 'PR02', 'SEGUIMIENTO MITIC', 'Hecho.', '2026-08-10', array['P002']::text[], 'doing', 4, '[]'::jsonb, '[{"id": "372b9bdc-7ff3-55a2-b94f-07be7b2777dd", "label": "Abrir archivo", "url": "https://mitic.gov.py/interestecnologico/"}]'::jsonb, 0),
('813880f3-a891-5d01-b7e2-9a40becff32b', 'PR03', 'FACEBOOK', 'Solicitar a Joha un "representante" de Kalix para la cuenta de Reeduca.
17.0', '2026-08-10', array['P002']::text[], 'todo', 5, '[]'::jsonb, '[]'::jsonb, 0),
('21e16730-d7e2-5552-aad6-7b05f8f7fce0', 'PR05', 'REVISAR ÍNDICE DE 4TO. GRADO', 'Lu: propuesta de capacidades para cada unidad, conforme a lo que se pretende trabajar.', '2026-08-10', array['P006']::text[], 'done', 6, '[]'::jsonb, '[{"id": "97d70058-ef2e-557a-80f9-2c62b535f154", "label": "Abrir archivo", "url": "https://docs.google.com/spreadsheets/d/1uoD163GroB-ofJsjaycYC773SRWOjfWcRqebXhSVpqY/edit?gid=310886155#gid=310886155"}]'::jsonb, 0),
('2b3ed0e8-ccc8-5e01-9f6b-7955979672d8', 'PR05', 'EDITAR UNIDAD 1. 4TO GRADO', 'Lu: hacer ajustes conforme a lo conversado.
Subir docs. al drive.', '2026-08-10', array['P006']::text[], 'done', 7, '[]'::jsonb, '[]'::jsonb, 0),
('48367bca-f2cf-596c-82dd-978acd3322ca', 'PR05', 'COMUNICAR DEADLINE DE TAREAS.', 'Di: grupos de whatsapp', '2026-08-10', array['P005']::text[], 'todo', 8, '[]'::jsonb, '[]'::jsonb, 0),
('cd7a17f2-bda9-5417-b389-4f683e610a43', 'PR05', 'ENTREGA DE GUÍA DOCENTE DEL 1ER. GRADO', 'Entregar el compendio, como para ser enviado al MEC.', '2026-08-10', array['P009']::text[], 'done', 9, '[]'::jsonb, '[]'::jsonb, 0),
('ddb80907-6709-5644-a04d-072578ee9ebf', 'PR05', 'LIBRO DE 4TO.', 'Revisar las unidades editadas.
Fijar hoja de ruta.', '2026-08-10', array['P003']::text[], 'todo', 10, '[]'::jsonb, '[]'::jsonb, 0),
('e8b3b826-5860-5750-9d53-e49e6883a62b', 'PR05', 'INICIO DE VISITAS A ESCUELAS', 'Di: Capital
Aún no se iniciaron', '2026-08-10', array['P005']::text[], 'todo', 11, '[]'::jsonb, '[]'::jsonb, 0),
('7f9469b1-295a-594f-8fab-3a0e4bc850fa', 'PR06', 'KALIX: REVISAR METRICOOL', 'Revisar posteo a ser reestructurado.', '2026-08-10', array['P006']::text[], 'done', 12, '[]'::jsonb, '[]'::jsonb, 0),
('c4aeb35d-11a7-5ec1-b55f-3c470855fcd3', 'PR02', 'CUENTA DE FACEBOOK', 'Álvaro + Guille
Asignar a alguien de Kalix para que maneje la cuenta', '2026-08-11', array['P001','P002']::text[], 'doing', 0, '[]'::jsonb, '[]'::jsonb, 0),
('2eb51f35-6829-5401-8282-73b0ccf7ff9c', 'PR05', 'Revisión final · Unidad 5 · 1ro', 'Luciana edita la unidad una vez que Pablo validó los ajustes.
Recién con esto la unidad queda cerrada.', '2026-08-11', array['P006']::text[], 'done', 1, '[]'::jsonb, '[]'::jsonb, 0),
('3c5d5291-a2dc-5798-9961-f3d1e59bdd3e', 'PR05', 'Revisión final · Unidad 4 · 1ro', 'Luciana edita la unidad una vez que Pablo validó los ajustes.
Recién con esto la unidad queda cerrada.', '2026-08-11', array['P006']::text[], 'done', 2, '[]'::jsonb, '[]'::jsonb, 0),
('4f97fb3d-d929-5fc6-88bd-2527795a760e', 'PR05', 'DESARROLLAR PRE. M2. S2.', 'Lu', '2026-08-11', array['P006']::text[], 'done', 3, '[]'::jsonb, '[]'::jsonb, 0),
('6c7c0cc7-dcec-55a2-91b6-f8c4241355a4', 'PR05', 'Revisión final · Unidad 1 · 1ro', 'Luciana edita la unidad una vez que Pablo validó los ajustes.
Recién con esto la unidad queda cerrada.', '2026-08-11', array['P006']::text[], 'done', 4, '[]'::jsonb, '[]'::jsonb, 0),
('6da2bb37-165c-586f-9e63-94e7f39f377a', 'PR05', 'Edición final · libro de 1ro', 'Edición del libro completo, con todos los módulos ya cerrados.
(salió del proceso editorial el 16/08/2026)', '2026-08-11', array['P006']::text[], 'done', 5, '[]'::jsonb, '[]'::jsonb, 0),
('7be96731-b2a1-5a8d-b3f4-f9d674df6e54', 'PR05', 'Revisión final · Unidad 6 · 1ro', 'Luciana edita la unidad una vez que Pablo validó los ajustes.
Recién con esto la unidad queda cerrada.', '2026-08-11', array['P006']::text[], 'done', 6, '[]'::jsonb, '[]'::jsonb, 0),
('814b86c6-7f3b-5e54-b352-7866c1fa3768', 'PR05', 'Revisión final · Unidad 3 · 1ro', 'Luciana edita la unidad una vez que Pablo validó los ajustes.
Recién con esto la unidad queda cerrada.', '2026-08-11', array['P006']::text[], 'done', 7, '[]'::jsonb, '[]'::jsonb, 0),
('84d39589-8bc6-5740-b0eb-4fbdfcdee8e9', 'PR05', 'CLASSROOM', 'Consultar con Equilibrium si ya se crearon.', '2026-08-11', array['P011']::text[], 'doing', 8, '[]'::jsonb, '[]'::jsonb, 0),
('884e47cf-92b7-56fd-bfb3-35c5d398280b', 'PR05', 'Revisión final · Unidad 8 · 1ro', 'Luciana edita la unidad una vez que Pablo validó los ajustes.
Recién con esto la unidad queda cerrada.', '2026-08-11', array['P006']::text[], 'done', 9, '[]'::jsonb, '[]'::jsonb, 0),
('ab059413-2912-5159-bdea-64ca38ef059c', 'PR05', 'Revisión final · Unidad 7 · 1ro', 'Luciana edita la unidad una vez que Pablo validó los ajustes.
Recién con esto la unidad queda cerrada.', '2026-08-11', array['P006']::text[], 'done', 10, '[]'::jsonb, '[]'::jsonb, 0),
('b3194812-e1cc-5ce2-8d9f-2df65a552529', 'PR05', 'Draft unidad 4, libro 4to', null, '2026-08-11', array['P002']::text[], 'done', 11, '[]'::jsonb, '[]'::jsonb, 0),
('c1224b9e-3eb1-5474-b7b6-71450c93c651', 'PR05', 'Revisión final · Unidad 2 · 1ro', 'Luciana edita la unidad una vez que Pablo validó los ajustes.
Recién con esto la unidad queda cerrada.', '2026-08-11', array['P006']::text[], 'done', 12, '[]'::jsonb, '[]'::jsonb, 0),
('7109d494-4e2a-5e3e-b16e-143b88ec015f', 'PR05', 'CARGAR CONTENIDO DE CLASSROOM', 'Pablo', '2026-08-12', array['P003']::text[], 'todo', 0, '[]'::jsonb, '[]'::jsonb, 0),
('e5aae8f0-44dd-5624-bd20-727d43fbe415', 'PR01', 'ACTUALIZAR EL PIPELINE', 'Ajustar fechas y procesos.', '2026-08-13', array['P006']::text[], 'done', 0, '[]'::jsonb, '[{"id": "f0ee406c-34ff-555b-98fc-3c9e22872961", "label": "Abrir archivo", "url": "https://script.google.com/macros/s/AKfycbzUM8D2FQgcCR_wM4p3KxiJNj2bndL5uSU6pvlXOWjuk00s7A9X3w4pVeLjMuw4UQEb/exec"}]'::jsonb, 0),
('bfd8517f-d5f0-5aac-8d43-72130e5060cd', 'PR02', 'Proceso de Registro LNR', 'Elaborar una gacetilla como instructivo para que las instituciones procesen el registro y el pago del ID de la temporada.', '2026-08-13', array['P003']::text[], 'todo', 1, '[]'::jsonb, '[]'::jsonb, 0),
('6781a642-c897-5a14-bde8-c9fc363d59c4', 'PR04', 'AJUSTAR PROYECTO UNIDA', 'Verificar texto y anexar presupuesto.', '2026-08-13', array['P002','P006']::text[], 'todo', 2, '[]'::jsonb, '[{"id": "34b43188-e853-5848-9507-88893089e622", "label": "Abrir archivo", "url": "https://docs.google.com/document/d/1lLo8Oh51ombRe-M0Xx3I3NoCKwEDUG1faj_h8Yg4jrU/edit?tab=t.0"}]'::jsonb, 0),
('38191730-2b33-5833-9440-4099624ba48c', 'PR05', 'REVISIÓN DE UNIDADES 1 A 3. LIBRO DEL 4TO. GRADO', null, '2026-08-13', array['P003','P006']::text[], 'todo', 3, '[]'::jsonb, '[]'::jsonb, 0),
('a129d320-d566-51d6-901b-1ae4a66e098d', 'PR05', 'VISITA A LAS ESCUELAS', null, '2026-08-13', array['P005']::text[], 'todo', 4, '[]'::jsonb, '[]'::jsonb, 0),
('be9ab4a6-0274-5546-8991-b762b8339a74', 'PR05', 'REVISAR Y AJUSTAR RÚBRICA DE OBSERVACIÓN DE CLASES', 'Proceso iniciado: ver comentarios de Alejandro y ajustar formato a ser impreso.', '2026-08-13', array['P006']::text[], 'doing', 5, '[]'::jsonb, '[]'::jsonb, 0);
insert into stage_tareas values
('dbaf9924-965a-5b51-9e20-9c92722d6f6e', 'PR05', 'CUENTAS DE CLASSROOM - CAPACITACION C2', 'Consultar con Eaquilibrium si se crearon las cuentas. En caso de que no lo hayan hecho, consultar para cuando estarían.', '2026-08-13', array['P003']::text[], 'todo', 6, '[]'::jsonb, '[]'::jsonb, 0),
('e4adfdc4-6575-5de9-841d-6fc0036fe1fd', 'PR05', 'ELABORAR PRESENTACIÓN DEL MÓDULO 2. SESIÓN 3', 'Base de la presentación.', '2026-08-13', array['P006']::text[], 'doing', 7, '[]'::jsonb, '[]'::jsonb, 0),
('c9afaea1-c781-515f-92a8-8ce2ba880415', 'PR06', 'SEGUIMIENTO A CUENTA DE FACEBOOK', 'Asignar a Joha.
Si me agrega desde el mail es: martinezcamij@gmail.com 
Si es desde Facebook: https://www.facebook.com/share/1EjtmSnGN8/', '2026-08-13', array['P002','P006']::text[], 'todo', 8, '[]'::jsonb, '[]'::jsonb, 0),
('0a1faf7e-b135-58a0-b1cc-15fc3852c24f', 'PR01', 'Entregar Implementos Cancha (CEL)', null, '2026-08-14', array['P002','P007']::text[], 'todo', 0, '[]'::jsonb, '[]'::jsonb, 0),
('0bf663b2-5c68-5744-9928-9098e362751e', 'PR01', 'Entregar propuesta al CTN (posible cede)', null, '2026-08-14', array['P002','P007']::text[], 'todo', 1, '[]'::jsonb, '[]'::jsonb, 0),
('0eeeb225-037c-5d4f-81b0-8130164ebf43', 'PR05', 'REVISAR Y AJUSTAR RÚBRICA DE OBSERVACIÓN DE CLASES', 'Proceso iniciado: ver comentarios de Alejandro y ajustar formato a ser impreso.', '2026-08-14', array['P006']::text[], 'todo', 2, '[]'::jsonb, '[]'::jsonb, 0),
('83d47918-4163-5710-b708-2a4cf4d89915', 'PR05', 'RECORDATORIO DEADLINE DE TAREAS.', 'Di: grupos de whatsapp', '2026-08-14', array['P005']::text[], 'todo', 3, '[]'::jsonb, '[]'::jsonb, 0),
('a753bbed-ea03-5770-b056-39c6592ff9af', 'PR05', 'VISITA A LAS ESCUELAS', null, '2026-08-14', array['P005']::text[], 'todo', 4, '[]'::jsonb, '[]'::jsonb, 0),
('c301c2fb-776a-5ab2-ab24-a29d978a8d5b', 'PR06', 'VER: MATERIALES LNR', 'Hacer relevamiento de lo que tenemos hoy.
Definir y hacer lista de necesidades. Determinar cuáles se ejecutarán ahora, conforme al presupuesto.
Preparar lista de materiales a ser diagramados por Kalix: certificados, nombres para pits, zócalos para publis.', '2026-08-14', array['P002','P006','P007']::text[], 'doing', 5, '[]'::jsonb, '[]'::jsonb, 0),
('0a08fb78-ece8-55c6-b505-5362ea5e7a03', 'PR05', 'Escritura · Unidad 8 · 1ro', 'Se dio por hecho: un paso posterior de esta unidad ya estaba completado.', '2026-08-16', array['P003']::text[], 'done', 0, '[]'::jsonb, '[]'::jsonb, 0),
('1eea30a6-584d-5b05-a7c0-5a9d48293022', 'PR05', 'Validación de la edición · Unidad 3 · 1ro', 'Se dio por hecho: un paso posterior de esta unidad ya estaba completado.', '2026-08-16', array['P003']::text[], 'done', 1, '[]'::jsonb, '[]'::jsonb, 0),
('2bfd1f37-42e3-5d47-ada1-7d6c68ee4a5b', 'PR05', 'Edición · Unidad 6 · 1ro', 'Se dio por hecho: un paso posterior de esta unidad ya estaba completado.', '2026-08-16', array['P006']::text[], 'done', 2, '[]'::jsonb, '[]'::jsonb, 0),
('317ea108-aa95-5257-bce5-613038040fed', 'PR05', 'Validación de la edición · Unidad 5 · 1ro', 'Se dio por hecho: un paso posterior de esta unidad ya estaba completado.', '2026-08-16', array['P003']::text[], 'done', 3, '[]'::jsonb, '[]'::jsonb, 0),
('43d80f1c-d57f-5627-85aa-e75fe7e28588', 'PR05', 'Escritura · Unidad 5 · 1ro', 'Se dio por hecho: un paso posterior de esta unidad ya estaba completado.', '2026-08-16', array['P003']::text[], 'done', 4, '[]'::jsonb, '[]'::jsonb, 0),
('47ecf461-e762-5cd0-80b2-70904beac245', 'PR05', 'Validación de la edición · Unidad 1 · 1ro', 'Se dio por hecho: un paso posterior de esta unidad ya estaba completado.', '2026-08-16', array['P003']::text[], 'done', 5, '[]'::jsonb, '[]'::jsonb, 0),
('4b7d86da-651e-5b08-8bdc-cf6fa9e6ab85', 'PR05', 'Validación de la edición · Unidad 6 · 1ro', 'Se dio por hecho: un paso posterior de esta unidad ya estaba completado.', '2026-08-16', array['P003']::text[], 'done', 6, '[]'::jsonb, '[]'::jsonb, 0),
('523120d6-e37b-5732-a53c-159b45cfd9bc', 'PR05', 'Edición · Unidad 1 · 1ro', 'Se dio por hecho: un paso posterior de esta unidad ya estaba completado.', '2026-08-16', array['P006']::text[], 'done', 7, '[]'::jsonb, '[]'::jsonb, 0),
('584c9f36-0206-52ba-965f-deacd8a8b88f', 'PR05', 'Escritura · Unidad 3 · 1ro', 'Se dio por hecho: un paso posterior de esta unidad ya estaba completado.', '2026-08-16', array['P003']::text[], 'done', 8, '[]'::jsonb, '[]'::jsonb, 0),
('5b8c3f21-b8c3-5296-a05c-b1a2701c0409', 'PR05', 'Escritura · Unidad 1 · 4to', 'Paso del proceso editorial.', '2026-08-16', array['P003']::text[], 'done', 9, '[]'::jsonb, '[]'::jsonb, 0),
('61101d30-3969-57bb-b8af-a037f15d080d', 'PR05', 'Validación de la edición · Unidad 7 · 1ro', 'Se dio por hecho: un paso posterior de esta unidad ya estaba completado.', '2026-08-16', array['P003']::text[], 'done', 10, '[]'::jsonb, '[]'::jsonb, 0),
('61d7988d-1cd4-5f30-87ab-c9e98c2d2932', 'PR05', 'Validación de la edición · Unidad 2 · 1ro', 'Se dio por hecho: un paso posterior de esta unidad ya estaba completado.', '2026-08-16', array['P003']::text[], 'done', 11, '[]'::jsonb, '[]'::jsonb, 0),
('6d00cba1-eb4b-52fd-861a-cbbe5c6dcc2b', 'PR05', 'Escritura · Unidad 4 · 1ro', 'Se dio por hecho: un paso posterior de esta unidad ya estaba completado.', '2026-08-16', array['P003']::text[], 'done', 12, '[]'::jsonb, '[]'::jsonb, 0),
('6db44d59-188a-5b00-bad8-4fc1c9066702', 'PR05', 'Edición · Unidad 7 · 1ro', 'Se dio por hecho: un paso posterior de esta unidad ya estaba completado.', '2026-08-16', array['P006']::text[], 'done', 13, '[]'::jsonb, '[]'::jsonb, 0),
('7a9c721e-5d49-5674-bae8-4131a9a5ec2b', 'PR05', 'Escritura · Unidad 6 · 1ro', 'Se dio por hecho: un paso posterior de esta unidad ya estaba completado.', '2026-08-16', array['P003']::text[], 'done', 14, '[]'::jsonb, '[]'::jsonb, 0),
('7f49790d-0b50-5662-9139-b86d17b32376', 'PR05', 'Validación de la edición · Unidad 4 · 1ro', 'Se dio por hecho: un paso posterior de esta unidad ya estaba completado.', '2026-08-16', array['P003']::text[], 'done', 15, '[]'::jsonb, '[]'::jsonb, 0),
('81b5fd44-c7d0-5798-9aab-49d6351b6a42', 'PR05', 'Escritura · Unidad 3 · 4to', 'Paso del proceso editorial.', '2026-08-16', array['P003']::text[], 'done', 16, '[]'::jsonb, '[]'::jsonb, 0),
('a4564ea7-fe21-54f6-a3f9-5f5b26d9005d', 'PR05', 'Escritura · Unidad 2 · 1ro', 'Se dio por hecho: un paso posterior de esta unidad ya estaba completado.', '2026-08-16', array['P003']::text[], 'done', 17, '[]'::jsonb, '[]'::jsonb, 0),
('a95f8633-4c41-5142-ba1a-1219286110af', 'PR05', 'Edición · Unidad 2 · 1ro', 'Se dio por hecho: un paso posterior de esta unidad ya estaba completado.', '2026-08-16', array['P006']::text[], 'done', 18, '[]'::jsonb, '[]'::jsonb, 0),
('b770deb1-bdbc-5b7e-9247-3d6397a6be36', 'PR05', 'Edición · Unidad 3 · 1ro', 'Se dio por hecho: un paso posterior de esta unidad ya estaba completado.', '2026-08-16', array['P006']::text[], 'done', 19, '[]'::jsonb, '[]'::jsonb, 0),
('bb41f8f6-93ef-5da8-85a6-26f88881b3fb', 'PR05', 'Escritura · Unidad 7 · 1ro', 'Se dio por hecho: un paso posterior de esta unidad ya estaba completado.', '2026-08-16', array['P003']::text[], 'done', 20, '[]'::jsonb, '[]'::jsonb, 0),
('be8748a9-ea47-5701-9df6-b3b147eded4c', 'PR05', 'Edición · Unidad 4 · 1ro', 'Se dio por hecho: un paso posterior de esta unidad ya estaba completado.', '2026-08-16', array['P006']::text[], 'done', 21, '[]'::jsonb, '[]'::jsonb, 0),
('c6e23d52-2adf-58ff-8a46-953aa703ac72', 'PR05', 'Validación de la edición · Unidad 8 · 1ro', 'Se dio por hecho: un paso posterior de esta unidad ya estaba completado.', '2026-08-16', array['P003']::text[], 'done', 22, '[]'::jsonb, '[]'::jsonb, 0),
('d7c3f8ab-41a4-5f4f-9cb7-f97b0c0ca3d3', 'PR05', 'Escritura · Unidad 1 · 1ro', 'Se dio por hecho: un paso posterior de esta unidad ya estaba completado.', '2026-08-16', array['P003']::text[], 'done', 23, '[]'::jsonb, '[]'::jsonb, 0),
('d7ebddeb-146d-5ab0-9001-b5c290cc535d', 'PR05', 'Edición · Unidad 5 · 1ro', 'Se dio por hecho: un paso posterior de esta unidad ya estaba completado.', '2026-08-16', array['P006']::text[], 'done', 24, '[]'::jsonb, '[]'::jsonb, 0),
('e6b485a5-11bf-5722-a27b-48dbea277644', 'PR05', 'Escritura · Unidad 2 · 4to', 'Paso del proceso editorial.', '2026-08-16', array['P003']::text[], 'done', 25, '[]'::jsonb, '[]'::jsonb, 0),
('e9a3fd2c-80b3-51ed-8642-136a79658b71', 'PR05', 'Edición · Unidad 8 · 1ro', 'Se dio por hecho: un paso posterior de esta unidad ya estaba completado.', '2026-08-16', array['P006']::text[], 'done', 26, '[]'::jsonb, '[]'::jsonb, 0),
('0b3eedf3-605e-5e5a-a74c-f1d8ac8374d3', 'PR01', 'Ver acciones comerciales con Luciana', 'Status de Agendamiento de reuniones con clientes.', '2026-08-17', array['P002','P006']::text[], 'todo', 0, '[]'::jsonb, '[]'::jsonb, 0),
('41cedd25-f1df-532e-83bf-cce1a8b4c149', 'PR01', 'SEGUIMIENTO A COLEGIO +595 986 393053', 'Respondieron a un llamado, pero no identificamos quienes son. Estamos en contacto, mandando los datos correspondientes y tratando de averiguar sutilmente quienes son.', '2026-08-17', array['P006','P007']::text[], 'done', 1, '[]'::jsonb, '[]'::jsonb, 0),
('7ece2a6d-3575-5961-9739-0dca0c385f4e', 'PR01', 'ENVIAR PROPUESTA AL BRITÁNICO PARAGUAYO - CDE', 'Contacto: Matías. Se solicita enviar por whatsapp', '2026-08-17', array['P006']::text[], 'done', 2, '[]'::jsonb, '[{"id": "22a3c1b6-2ef7-5101-88c5-7329bf5c1c8d", "label": "Abrir archivo", "url": "https://drive.google.com/open?id=1EED9qql1ciLMmTULcwEbf8c6XQAeI8mB&usp=drive_copy"}]'::jsonb, 0),
('cd804f1f-1569-54d2-a388-65a4d23064c3', 'PR01', 'Actualizar sistema de Finanzas Reeduca', 'A las 8:00, y que después Malena cargue', '2026-08-17', array['P002']::text[], 'done', 3, '[]'::jsonb, '[]'::jsonb, 0);
insert into stage_tareas values
('7d906b2e-090a-5313-a605-f0a7ff9a9388', 'PR02', 'TUTORIAL DE CREACION DE VEX ID', 'Trabajar la edición: Lu.', '2026-08-17', array['P002','P006','P007']::text[], 'done', 4, '[]'::jsonb, '[{"id": "b20cb75b-ee4d-5aac-964c-ae89f3bccddb", "label": "Abrir archivo", "url": "https://canva.link/md2mcfpakwzw7gz"}]'::jsonb, 0),
('e868c457-aa84-588e-9852-5aa5122eaa59', 'PR03', 'Recordar fecha envío de examen para aulas 4.0', 'Verificar fecha límite para el cierre de la certificación.
De ahí para atrás, fijar una fecha para evaluación y otra para recuperatorio.', '2026-08-17', array['P002','P003']::text[], 'done', 5, '[]'::jsonb, '[]'::jsonb, 0),
('880371a3-7bf5-55e6-8b09-589178f9677a', 'PR05', 'Calendarizar visitas a IFDs para cierre FIFA', null, '2026-08-17', array['P002']::text[], 'todo', 6, '[]'::jsonb, '[]'::jsonb, 0),
('de311c98-2ca2-5b7e-a613-4de95989da4e', 'PR05', 'Cerrar instrumento de recolección de datos FIFA', null, '2026-08-17', array['P002','P003','P006']::text[], 'done', 7, '[]'::jsonb, '[]'::jsonb, 0),
('ee0069f0-6f47-55d2-8db0-8ec0f6ffb0e1', 'PR05', 'Imprimir y Plastificar Instrumento.', null, '2026-08-17', array['P002']::text[], 'done', 8, '[]'::jsonb, '[]'::jsonb, 0),
('28fe04aa-65e1-534d-a9be-ec71c06d2fb3', 'PR01', 'Ver acciones comerciales con Luciana', 'Status de Agendamiento de reuniones con clientes.', '2026-08-18', array['P002','P006']::text[], 'todo', 0, '[]'::jsonb, '[]'::jsonb, 0),
('33d3ee98-216e-5af5-aeea-a19800520a44', 'PR01', 'Copia de llave para Male', null, '2026-08-18', array['P002','P007']::text[], 'todo', 1, '[]'::jsonb, '[]'::jsonb, 0),
('6ec7760c-0b4a-53fd-a6c6-5d1c2ea08087', 'PR01', 'Cancelar suscripción de wix.', null, '2026-08-18', array['P002']::text[], 'done', 2, '[]'::jsonb, '[]'::jsonb, 0),
('ddee365c-4f56-5d87-ab0d-363bde9a56c4', 'PR01', 'SEGUIMIENTO A PROPUESTAS.', 'Mensaje enviado a Paty Fauvety; SUMA.', '2026-08-18', array['P006']::text[], 'done', 3, '[]'::jsonb, '[]'::jsonb, 0),
('ee3a58b6-f1ec-5d0b-a919-6e5b65003834', 'PR01', 'VENTAS.', 'Desde el lunes retomamos el proceso del pipeline, sigueindo el orden TODAS LAS INSTITUCIONES, del pipeline LU. Se avanzó hasta Centro Educativo Nuevo Milenio, atendiendo que se mandaron documentos con la información solicitada por cada institución.', '2026-08-18', array['P006']::text[], 'done', 4, '[]'::jsonb, '[]'::jsonb, 0),
('f2959bec-a268-5463-b637-0b1a6479c8ee', 'PR01', 'Enviar propuesta de show and tell para el MEC', 'Lu: redactar mail de invitación.', '2026-08-18', array['P002']::text[], 'todo', 5, '[]'::jsonb, '[]'::jsonb, 0),
('fc302efc-ddab-5b6c-94e1-a252d7339b43', 'PR01', 'Cargar facturas y movimientos de Agosto en Sistema', 'Cargar despues de que Alvaro actualice', '2026-08-18', array['P007']::text[], 'todo', 6, '[]'::jsonb, '[]'::jsonb, 0),
('ffad6b19-2ec4-5b73-8ff6-c276fc6b15ee', 'PR01', 'Actualizar Pipeline Ventas', 'Actualizar con Lu los pendientes, enviar mensajes de seguimiento', '2026-08-18', array['P007']::text[], 'done', 7, '[]'::jsonb, '[]'::jsonb, 0),
('9783e01c-0a2e-5200-83b0-601594ca8f3e', 'PR03', 'Ver fecha de cierre de aulas 4.0 para agendar examen 3 semanas antes.', 'Luego de definir fecha, comunicar y agendarla', '2026-08-18', array['P002','P006']::text[], 'done', 8, '[]'::jsonb, '[]'::jsonb, 0),
('44dbbffc-6663-53ee-ae55-754b803e8506', 'PR05', 'FORMULARIO REGISTRO DE EQUIPOS', null, '2026-08-18', array['P002']::text[], 'done', 9, '[]'::jsonb, '[]'::jsonb, 0),
('5dc11780-69aa-54c8-aa5b-23eb86e46b36', 'PR05', 'Diseño de planilla de puntajes', null, '2026-08-18', array['P002','P003','P006','P008']::text[], 'todo', 10, '[{"id": "852c014e-34a0-5705-af73-ca10054e615b", "text": "Sistema de registro", "done": false}]'::jsonb, '[]'::jsonb, 0),
('82b92bdd-7a79-544f-a3de-64895f170fef', 'PR05', 'DESARROLLO DEL MÓDULO 2. SESIÓN 3', null, '2026-08-18', array['P006']::text[], 'todo', 11, '[]'::jsonb, '[]'::jsonb, 0),
('b1074cc4-7bf8-5169-ab7d-15298d52c5a6', 'PR05', 'Viatico para Diana y Pablo', null, '2026-08-18', array['P007']::text[], 'todo', 12, '[]'::jsonb, '[]'::jsonb, 0),
('eba52403-6aee-5183-ad5c-6ca1e6be7929', 'PR05', 'Crear el examen para FIFA con appscripts.', null, '2026-08-18', array['P002']::text[], 'todo', 13, '[]'::jsonb, '[]'::jsonb, 0),
('fb3bc650-62eb-586e-a4e5-a2bb76806272', 'PR05', 'Escritura · Unidad 4 · 4to', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 4)', '2026-08-18', array['P003']::text[], 'done', 14, '[{"id": "852c014e-34a0-5705-af73-ca10054e615b", "text": "Unidad presentada en formato Word.", "done": false}]'::jsonb, '[{"id": "1a356c0f-a08b-59fb-9a59-d6dcd6b1bf73", "label": "Abrir archivo", "url": "https://drive.google.com/drive/folders/1_gdZbhdCLjtBoV5VURU0KGKsAr9KLYJd?usp=drive_link"}]'::jsonb, 0),
('9c0e4afc-c53d-5205-9f95-f5dd3511e5cd', 'PR09', 'Agendar retiro de cancha V5 y montaje en Cristo Rey', null, '2026-08-18', array['P002','P007']::text[], 'todo', 15, '[]'::jsonb, '[]'::jsonb, 0),
('08bce2a4-4dc5-5e82-b0c0-6215c93b8ba6', 'PR01', 'EVENTO JÓVENES CONECTADOS. MEC', '10:30 online.', '2026-08-19', array['P006']::text[], 'done', 0, '[]'::jsonb, '[{"id": "93cc9e6d-fa05-50aa-8b0c-c1ffe177abb4", "label": "Abrir archivo", "url": "https://meet.google.com/ert-adfs-yka"}]'::jsonb, 0),
('7a261556-edeb-518d-990f-4421b8d5f3f6', 'PR01', 'REU CON COTY/ CEI.', '10:00 hs. virtual. 
Obs.: Probablemente no se unan a la Liga ya que acaban de comprar insumos para FTC. De igual manera, solicitan les enviemos la propuesta extracuricular. Les interesa una propuesta escalonada de implementación curricular.', '2026-08-19', array['P006']::text[], 'done', 1, '[]'::jsonb, '[]'::jsonb, 0),
('9f3c2f59-dbfd-5a91-903c-c1c234497830', 'PR01', 'Hablar con Lu - idea de reuniones con clientes', null, '2026-08-19', array['P002','P006']::text[], 'todo', 2, '[]'::jsonb, '[]'::jsonb, 0),
('c7975a90-5ab1-5340-b426-737523f5ff20', 'PR01', 'Rediseñar el sistema financiero', null, '2026-08-19', array['P002','P007']::text[], 'done', 3, '[]'::jsonb, '[]'::jsonb, 0),
('2572f802-b708-5b89-8174-5b7ea0acc49f', 'PR05', 'CAPACITACIÓN PRES. M1+M2.S1', 'Grupo 2 Paraguarí. 13:00 a 17:00 hs.', '2026-08-19', array['P003','P006']::text[], 'doing', 4, '[]'::jsonb, '[]'::jsonb, 0),
('ab9a0b5d-1abf-57cb-8ea5-d867fdee1cef', 'PR05', 'Cotejo de participantes. Cohorte 1.', 'Grupos terminados: G1. G2. G3. G4. G5. G6.', '2026-08-19', array['P006']::text[], 'done', 5, '[]'::jsonb, '[]'::jsonb, 0),
('2b559fd5-6e11-5db4-9fb1-34fbfd0c844b', 'PR01', 'RECUPERAR CUENTA DE FACEBOOK', 'Álvaro', '2026-08-20', array['P002']::text[], 'todo', 0, '[]'::jsonb, '[]'::jsonb, 0),
('91ffaa71-922f-57b0-9392-ddbc3b4c3a7a', 'PR01', 'PROPUESTA CEI', 'Redactado, aprovado por Álvaro y enviado.', '2026-08-20', array['P006']::text[], 'done', 1, '[]'::jsonb, '[{"id": "7c4098b6-d19b-5722-98a9-8e1aa4c3d8c8", "label": "Abrir archivo", "url": "https://drive.google.com/drive/folders/1fmysn8-sZwAW5hybXnEBKDT1ESHCQncA"}]'::jsonb, 0),
('94e70ed2-d497-5614-8560-c1b8ba731822', 'PR01', 'Entregar Cancha al CEL y visitar IFD NSA', 'Ir al IFD para preguntar por docs necesarios para certificar. Llevar proyecto de capacitacion y resolución.', '2026-08-20', array['P002']::text[], 'todo', 2, '[]'::jsonb, '[]'::jsonb, 0),
('22029ba8-3b34-5a3d-8731-05d769976ac3', 'PR02', 'Publicar link de inscripción LNR', 'Enviar horario: 8 a 17:30hs
Enviar ubicación', '2026-08-20', array['P006']::text[], 'done', 3, '[]'::jsonb, '[]'::jsonb, 0),
('5cd2906f-5825-594a-8423-e0958de9d096', 'PR02', 'MITIC', 'Solicitud para declarar a la LNR de interés tecnológico.
Conversado con Astrid Sanz', '2026-08-20', array['P002']::text[], 'todo', 4, '[]'::jsonb, '[]'::jsonb, 0),
('29b16721-7036-5100-bf2f-c7e9e6f4289d', 'PR05', 'CAPACITACIÓN PRES. M1+M2.S1', 'Grupo 3 Paraguarí. 13:00 a 17:00hs.', '2026-08-20', array['P003','P006']::text[], 'todo', 5, '[]'::jsonb, '[]'::jsonb, 0),
('3412a937-55b5-5632-9ce9-188d9deb6694', 'PR05', 'PADRÓN DOCENTE. FIFA', 'Listas cotejadas. Queda pendiente identificar cuentas huérfanas del Classroom.', '2026-08-20', array['P006']::text[], 'done', 6, '[]'::jsonb, '[{"id": "c588fe96-7ce6-54b1-acf8-8f42c4b4b69a", "label": "Abrir archivo", "url": "https://docs.google.com/spreadsheets/d/19WkQbRiPg0o5jbXy7xdF0Rg0S-MMqc9tZH4WujMHw7E/edit?gid=475251939#gid=475251939"}]'::jsonb, 0),
('847ffa23-7672-5081-9af1-fd3f83e49f5d', 'PR06', 'SOLICITUD DE MATERIALES PARA REDES', null, '2026-08-20', array['P006']::text[], 'done', 7, '[]'::jsonb, '[]'::jsonb, 0),
('7660be09-1abc-5955-9bee-7b7ac294e09a', 'PR01', 'Mail a Yeruti', 'FSTEM + Reeduca socios Jóvenes conectados. Enviar mail.', '2026-08-21', array['P002']::text[], 'todo', 0, '[]'::jsonb, '[]'::jsonb, 0),
('9cf0fc1b-67d8-5da9-bf27-76186839bb90', 'PR01', 'Enviar Mail al MEC - Show and Tell', null, '2026-08-21', array['P002']::text[], 'todo', 1, '[]'::jsonb, '[]'::jsonb, 0),
('b92323c5-aac6-51ca-a9e0-966a2a473b5a', 'PR01', 'PREPARAR INSUMOS PARA EL INTERCOLEGIAL CRISTO REY', null, '2026-08-21', array['P006','P007']::text[], 'todo', 2, '[]'::jsonb, '[]'::jsonb, 0),
('d6ff588e-7151-5c47-a4fd-5d4663cc6717', 'PR01', 'Montar cancha en cristo rey', null, '2026-08-21', array['P002','P007']::text[], 'todo', 3, '[]'::jsonb, '[]'::jsonb, 0),
('5563d558-dda7-5b47-8137-d61323248b55', 'PR05', 'Definición de criterios de certificación MEC - Recibir la info de los IFD (EDGAR)', 'Recepción de información sujeta al MEC', '2026-08-21', array['P002']::text[], 'todo', 4, '[{"id": "852c014e-34a0-5705-af73-ca10054e615b", "text": "Insumo para Matriz de Certificacion", "done": false}]'::jsonb, '[]'::jsonb, 0);
insert into stage_tareas values
('a958a801-a077-5953-9595-35cfee37da05', 'PR05', 'CAPACITACIÓN PRES. M1+M2.S1', 'Grupo 1 Central. 13:00 a 17:00 hs.
Vamos Luciana, Álvaro, Pablo', '2026-08-21', array['P002','P003','P006']::text[], 'todo', 5, '[]'::jsonb, '[]'::jsonb, 0),
('dd6608fc-8f6d-522f-8d6c-25052c9ccc98', 'PR09', 'Cumpleaños de LU!!!', null, '2026-08-21', array['P002','P003','P005','P006','P007']::text[], 'todo', 6, '[]'::jsonb, '[]'::jsonb, 0),
('0fdcb720-4383-5e46-b780-ebe82dbf0ad8', 'PR01', 'INTERCOLEGIAL CRISTO REY', 'INTERCOLEGIAL CRISTO REY', '2026-08-23', array['P002','P006','P007']::text[], 'todo', 0, '[]'::jsonb, '[]'::jsonb, 0),
('5eb1c24e-90b0-5bc6-9460-f4b3c1d9b52d', 'PR01', 'Enviar propuesta sin precio a UNIDA', null, '2026-08-24', array['P002','P006']::text[], 'todo', 0, '[]'::jsonb, '[]'::jsonb, 0),
('65ede34e-6f83-5ff6-9ba6-4720b8ffc6bf', 'PR05', 'CAPACITACIÓN PRES. M1+M2.S1', 'Grupo 4 Coordillera. 13:00 a 17:00 hs.', '2026-08-25', array['P003','P006']::text[], 'todo', 0, '[]'::jsonb, '[]'::jsonb, 0),
('ec42d37f-d483-5132-a91a-b6da7a9934cb', 'PR05', 'CAPACITACIÓN PRES. M1+M2.S1', 'Grupo 5 Coordillera. 13:00 a 17:00 hs.', '2026-08-26', array['P003','P006']::text[], 'todo', 0, '[]'::jsonb, '[]'::jsonb, 0),
('5f15ffeb-7ea4-5cba-a235-e750f9d76066', 'PR01', 'Generar Facturas para cobrar', null, '2026-08-27', array['P002','P003','P006','P007']::text[], 'todo', 0, '[]'::jsonb, '[]'::jsonb, 0),
('6b22edb5-2a2d-50c9-a0a4-41d920524cf5', 'PR01', 'RAUL', 'Pedirle la planilla de IPS y la factura a Raul', '2026-08-27', array['P007']::text[], 'todo', 1, '[]'::jsonb, '[]'::jsonb, 0),
('4bbd04fd-ef53-5bfe-b170-372c2b19c9de', 'PR05', 'CAPACITACIÓN PRES. M1+M2.S1', 'Grupo 6 Central. 13:00 a 17:00 hs.', '2026-08-27', array['P003','P006']::text[], 'todo', 2, '[]'::jsonb, '[]'::jsonb, 0),
('4a3dde1e-a803-502b-b441-9bb592908a38', 'PR03', 'Comunicación a docentes · Examen de Aulas 4.0', 'Carga y comunicación: el auxiliar o Diana.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P005']::text[], 'todo', 0, '[]'::jsonb, '[]'::jsonb, 0),
('4b1c6634-10e8-53c2-a357-baf335c3c151', 'PR03', 'Carga en plataforma · Examen de Aulas 4.0', 'Carga y comunicación: el auxiliar o Diana.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P005']::text[], 'todo', 1, '[]'::jsonb, '[]'::jsonb, 0),
('56d16d49-639c-5b72-956f-c1d455ad04fa', 'PR03', 'Validación pedagógica · Examen de Aulas 4.0', 'Solo si el contenido es pedagógico. Si es técnico (programación,
robótica), poné Tipo_Contenido = tecnico y este paso pasa a NO APLICA.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 2, '[]'::jsonb, '[]'::jsonb, 0),
('7b80e3aa-4014-5c5b-81e0-b19098f114a3', 'PR03', 'Diseño · Examen de Aulas 4.0', 'Los exámenes los diseña Pablo.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P003']::text[], 'todo', 3, '[]'::jsonb, '[]'::jsonb, 0),
('0053a927-b89d-5f5f-8675-5442e2821024', 'PR05', 'Validación pedagógica · Examen final · Módulo 2', 'Solo si el contenido es pedagógico. Si es técnico (programación,
robótica), poné Tipo_Contenido = tecnico y este paso pasa a NO APLICA.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 4, '[]'::jsonb, '[]'::jsonb, 0),
('00f8e95b-ca0a-5215-9e27-ab4cffe3aab0', 'PR05', 'Revisión final · Unidad 2 · 4to', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 5, '[]'::jsonb, '[]'::jsonb, 0),
('02cca9b2-8602-5a21-acb5-9790c0c7fb9b', 'PR05', 'Traducción · 2do', '[Migrado sin fecha — reprogramar]', '2026-08-29', array['P010']::text[], 'todo', 6, '[{"id": "6265a2b4-8abc-5399-acbd-5be5f2f8553b", "text": "Libro traducido", "done": false}]'::jsonb, '[]'::jsonb, 0),
('03eb0738-6804-5f74-b875-24631882eb66', 'PR05', 'Revisión final · Unidad 2 · 3ro', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 7, '[]'::jsonb, '[]'::jsonb, 0),
('0609d7d2-b32f-5d65-b1fc-31b44c62bbbf', 'PR05', 'Revisión final · Unidad 4 · 6to', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 8, '[]'::jsonb, '[]'::jsonb, 0),
('08b447d1-2523-58cb-a8d3-7a8f14592dab', 'PR05', 'Diseño · Autoevaluación 4', 'Los exámenes los diseña Pablo.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P003']::text[], 'todo', 9, '[]'::jsonb, '[]'::jsonb, 0),
('0d20cc81-42ee-5058-9d5d-36bfd9166a15', 'PR05', 'Edición final · libro de 3ro', 'Edición del libro completo, con todos los módulos ya cerrados.
(salió del proceso editorial el 16/08/2026)
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 10, '[]'::jsonb, '[]'::jsonb, 0),
('0d3b7663-3ea2-5437-b0eb-99f80b0f001a', 'PR05', 'HITO 1 - CIERRE PEDAGÓGICO, ACADÉMICO Y ADMINISTRATIVO DE LA COHORTE 1', 'Hito del proyecto. [Migrado sin fecha — definir]', '2026-08-29', array['P003']::text[], 'todo', 11, '[]'::jsonb, '[]'::jsonb, 5),
('1023488a-0429-5b0e-8195-2bd8412b3843', 'PR05', 'Diagramación en español', '(salió del proceso editorial el 16/08/2026)
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P010']::text[], 'todo', 12, '[{"id": "6634a805-1bb8-5bec-841f-e0d7096b7e2d", "text": "Material listo para su distribución", "done": false}]'::jsonb, '[]'::jsonb, 0),
('1193f7c7-21d6-55cf-9621-64b43563f1d8', 'PR05', 'Edición final · libro de 5to', 'Edición del libro completo, con todos los módulos ya cerrados.
(salió del proceso editorial el 16/08/2026)
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 13, '[]'::jsonb, '[]'::jsonb, 0),
('11be02eb-6052-53e0-a63f-9f623cf6db2f', 'PR05', 'Revisión final · Unidad 7 · 4to', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 14, '[]'::jsonb, '[]'::jsonb, 0),
('125815c2-f6e1-50f2-8adc-6149357a8860', 'PR05', 'Comunicación a docentes · Examen final · Módulo 3', 'Carga y comunicación: el auxiliar o Diana.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P005']::text[], 'todo', 15, '[]'::jsonb, '[]'::jsonb, 0),
('1301bd0e-6596-5c5c-b88a-9a869ad97e5b', 'PR05', 'Carga en plataforma · Autoevaluación 5', 'Carga y comunicación: el auxiliar o Diana.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P005']::text[], 'todo', 16, '[]'::jsonb, '[]'::jsonb, 0),
('160fcf0c-cd33-577e-a2dd-1335a7d045d5', 'PR05', 'Revisión final · Unidad 7 · 3ro', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 17, '[]'::jsonb, '[]'::jsonb, 0),
('161f5760-f544-5c77-9b2f-8aff03814d5e', 'PR05', 'Arquitectura de sesiones · Módulo 1 de formación', 'Cómo se estructura el módulo: sesiones, tiempos, secuencia.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P003']::text[], 'todo', 18, '[]'::jsonb, '[]'::jsonb, 0),
('162073e9-cec0-5754-a52a-a65b5a7a0c96', 'PR05', 'HITO 4 - REVISIÓN DE CAPACITACIONES E IMPLEMENTACIÓN DE LA COHORTE 2', 'Hito del proyecto. [Migrado sin fecha — definir]', '2026-08-29', array['P003']::text[], 'todo', 19, '[]'::jsonb, '[]'::jsonb, 5),
('17112712-ea4b-558b-9a70-615c1d83587e', 'PR05', 'Comunicación a docentes · Autoevaluación 2', 'Carga y comunicación: el auxiliar o Diana.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P005']::text[], 'todo', 20, '[]'::jsonb, '[]'::jsonb, 0),
('1829c5fc-765c-56fa-b78b-21508e50016b', 'PR05', 'Validación pedagógica · Examen final · Módulo 3', 'Solo si el contenido es pedagógico. Si es técnico (programación,
robótica), poné Tipo_Contenido = tecnico y este paso pasa a NO APLICA.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 21, '[]'::jsonb, '[]'::jsonb, 0),
('1be4b095-596c-5443-a649-ef824bea1275', 'PR05', 'Edición · Unidad 2 · 4to', 'Paso del proceso editorial.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 22, '[]'::jsonb, '[]'::jsonb, 0),
('1fbd4804-668a-5add-9733-3b060df1d9eb', 'PR05', 'Comunicación a docentes · Examen final · Módulo 4', 'Carga y comunicación: el auxiliar o Diana.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P005']::text[], 'todo', 23, '[]'::jsonb, '[]'::jsonb, 0),
('20834c58-1a1d-5b2d-b9eb-509deab5bd7f', 'PR05', 'Revisión final · Unidad 1 · 5to', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 24, '[]'::jsonb, '[]'::jsonb, 0),
('2300811d-de1f-56c2-a790-49d275cce5ca', 'PR05', 'Revisión final · Unidad 5 · 6to', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 25, '[]'::jsonb, '[]'::jsonb, 0),
('245e03bf-6e20-5d53-8e79-e502a9bcd7bd', 'PR05', 'Diseño · Autoevaluación 3', 'Los exámenes los diseña Pablo.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P003']::text[], 'todo', 26, '[]'::jsonb, '[]'::jsonb, 0),
('248bd7f9-aa44-5aae-8826-152c67c74da9', 'PR05', 'Revisión final · Unidad 6 · 5to', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 27, '[]'::jsonb, '[]'::jsonb, 0),
('2b6d56eb-6081-5de9-bb26-909eda8c101b', 'PR05', 'Comunicación a docentes · Examen final · Módulo 2', 'Carga y comunicación: el auxiliar o Diana.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P005']::text[], 'todo', 28, '[]'::jsonb, '[]'::jsonb, 0),
('2e81075d-39e1-53c6-9344-2c66c90ba8cf', 'PR05', 'Comunicación a docentes · Autoevaluación 3', 'Carga y comunicación: el auxiliar o Diana.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P005']::text[], 'todo', 29, '[]'::jsonb, '[]'::jsonb, 0),
('2e9f6aa5-b50e-5bca-95ea-28eeb27081d9', 'PR05', 'HITO 4 - DESARROLLO EDITORIAL DE LA COLECCIÓN FIFA FOUNDATION', 'Hito del proyecto. [Migrado sin fecha — definir]', '2026-08-29', array['P003']::text[], 'todo', 30, '[]'::jsonb, '[]'::jsonb, 5);
insert into stage_tareas values
('3361630e-1c29-579a-9a27-3468aa6a300a', 'PR05', 'Revisión final · Unidad 1 · 3ro', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 31, '[]'::jsonb, '[]'::jsonb, 0),
('3805d5ff-f819-5309-a2cd-9c42c513e055', 'PR05', 'Revisión final · Unidad 1 · 6to', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 32, '[]'::jsonb, '[]'::jsonb, 0),
('38e4a347-c75c-5e62-910e-5b7f4511fb93', 'PR05', 'Validación final del MEC · 6to', '[Migrado sin fecha — reprogramar]', '2026-08-29', array['P009']::text[], 'todo', 33, '[{"id": "c3926132-fe5a-51ec-9fae-5dd2fd6bfb00", "text": "Aprobación oficial: FIFA + MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('3905c3a2-ab95-5efb-8bdf-f490075f18a8', 'PR05', 'Carga en plataforma · Examen final · Módulo 3', 'Carga y comunicación: el auxiliar o Diana.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P005']::text[], 'todo', 34, '[]'::jsonb, '[]'::jsonb, 0),
('3ce3a485-2600-519a-939e-7ed5ed5172d6', 'PR05', 'Comunicación a docentes · Autoevaluación 5', 'Carga y comunicación: el auxiliar o Diana.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P005']::text[], 'todo', 35, '[]'::jsonb, '[]'::jsonb, 0),
('3ed5ac8c-1fc7-5617-b026-b9cd5ce3e992', 'PR05', 'Revisión final · Unidad 4 · 3ro', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 36, '[]'::jsonb, '[]'::jsonb, 0),
('3f3e4471-66aa-5f46-9271-1cb3adef6299', 'PR05', 'Contenido técnico · Módulo 1 de formación', 'El contenido de robótica y programación del módulo.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P003']::text[], 'todo', 37, '[]'::jsonb, '[]'::jsonb, 0),
('41b9ad48-bf19-5f72-acd7-bd31516cdb59', 'PR05', 'Validación pedagógica · Autoevaluación 4', 'Solo si el contenido es pedagógico. Si es técnico (programación,
robótica), poné Tipo_Contenido = tecnico y este paso pasa a NO APLICA.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 38, '[]'::jsonb, '[]'::jsonb, 0),
('42cae689-bb89-5c5a-bd66-adf3e9c9840f', 'PR05', 'Edición final · libro de 2do', 'Edición del libro completo, con todos los módulos ya cerrados.
(salió del proceso editorial el 16/08/2026)
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 39, '[]'::jsonb, '[]'::jsonb, 0),
('4312b70a-2938-5da5-a588-28f9838f379a', 'PR05', 'Diseño · Examen final · Módulo 3', 'Los exámenes los diseña Pablo.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P003']::text[], 'todo', 40, '[]'::jsonb, '[]'::jsonb, 0),
('44fcd4d2-9975-503b-aa38-91f8b520062f', 'PR05', 'Diseño · Autoevaluación 1', 'Los exámenes los diseña Pablo.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P003']::text[], 'todo', 41, '[]'::jsonb, '[]'::jsonb, 0),
('455fafa1-b840-55d3-b07a-c8cc2f01915e', 'PR05', 'Carga en plataforma · Autoevaluación 1', 'Carga y comunicación: el auxiliar o Diana.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P005']::text[], 'todo', 42, '[]'::jsonb, '[]'::jsonb, 0),
('45e9f159-612a-5933-963e-499a35c406a3', 'PR05', 'Contenido técnico · Módulo 4 de formación', 'El contenido de robótica y programación del módulo.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P003']::text[], 'todo', 43, '[]'::jsonb, '[]'::jsonb, 0),
('4774ee55-5911-568c-ace0-17912355cf20', 'PR05', 'Revisión final · Unidad 8 · 4to', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 44, '[]'::jsonb, '[]'::jsonb, 0),
('4a2bb161-d13a-56a2-820d-23c1cd98eb4a', 'PR05', 'Cierre del libro · 1ro', 'Pablo y Luciana autorizan que el libro está listo para entregar al MEC.
No avanza hasta que los dos den el visto bueno.
(salió del proceso editorial el 16/08/2026)
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P003','P006']::text[], 'todo', 45, '[{"id": "3e069bca-3b4d-525d-8235-bb8d16c0b13e", "text": "Visto bueno de Pablo", "done": false}, {"id": "e1f052dc-c6a3-5e56-b20a-c44444880c48", "text": "Visto bueno de Luciana", "done": false}]'::jsonb, '[]'::jsonb, 0),
('4b68137d-0573-5832-860c-848922944e5f', 'PR05', 'Revisión final · Unidad 2 · 6to', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 46, '[]'::jsonb, '[]'::jsonb, 0),
('544c9968-6d0d-5acb-8a3a-adb19b1b5857', 'PR05', 'Revisión final · Unidad 5 · 3ro', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 47, '[]'::jsonb, '[]'::jsonb, 0),
('5ab9de3d-dfb0-5723-b57c-26e30be37a14', 'PR05', 'Validación pedagógica · Autoevaluación 3', 'Solo si el contenido es pedagógico. Si es técnico (programación,
robótica), poné Tipo_Contenido = tecnico y este paso pasa a NO APLICA.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 48, '[]'::jsonb, '[]'::jsonb, 0),
('5b5f27d8-f4ba-56dc-ad7c-7983a5c085ac', 'PR05', 'Edición final · libro de 4to', 'Edición del libro completo, con todos los módulos ya cerrados.
(salió del proceso editorial el 16/08/2026)
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 49, '[]'::jsonb, '[]'::jsonb, 0),
('5bbc8aa7-20b2-5b8f-a975-a3779e92a20a', 'PR05', 'Diagramación en guaraní', '(salió del proceso editorial el 16/08/2026)
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P010']::text[], 'todo', 50, '[{"id": "c46b76e2-ca1c-55e7-9893-05b627bce06f", "text": "Material listo para su distribución", "done": false}]'::jsonb, '[]'::jsonb, 0),
('5dd4861b-db20-5a80-afe2-3d02e619c69a', 'PR05', 'Módulo listo · Módulo 1 de formación', 'Pablo y Luciana confirman que el módulo está para dictarse.
No avanza hasta que los dos den el visto bueno.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P003','P006']::text[], 'todo', 51, '[{"id": "161ef9cd-b406-5020-a664-72fb70b51d24", "text": "Visto bueno de Pablo", "done": false}, {"id": "a078909f-90c7-5b0e-a7af-9368f2a59188", "text": "Visto bueno de Luciana", "done": false}]'::jsonb, '[]'::jsonb, 0),
('5dfeb69a-3c69-502f-8fb4-78320dceb3e8', 'PR05', 'Módulo listo · Módulo 2 de formación', 'Pablo y Luciana confirman que el módulo está para dictarse.
No avanza hasta que los dos den el visto bueno.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P003','P006']::text[], 'todo', 52, '[{"id": "27931d70-2d98-5ae6-8565-03ca0cb56dc3", "text": "Visto bueno de Pablo", "done": false}, {"id": "1cbe4163-e7b7-54e0-b8ae-f5894545ec6a", "text": "Visto bueno de Luciana", "done": false}]'::jsonb, '[]'::jsonb, 0),
('652a2ffb-d561-588e-bdba-2a5f09d60ed0', 'PR05', 'Revisión final · Unidad 8 · 5to', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 53, '[]'::jsonb, '[]'::jsonb, 0),
('66140347-ec59-5a4f-9519-b9216681d7af', 'PR05', 'Diagramación en guaraní', '(salió del proceso editorial el 16/08/2026)
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P010']::text[], 'todo', 54, '[{"id": "027b6c4c-83e9-55ed-8480-97110d65aff9", "text": "Material listo para su distribución", "done": false}]'::jsonb, '[]'::jsonb, 0),
('6788431d-b0cf-5fda-b67f-b999ceb878bd', 'PR05', 'Diagramación en español', '(salió del proceso editorial el 16/08/2026)
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P010']::text[], 'todo', 55, '[{"id": "0300e170-c6f4-5506-ac58-d0a50df9b490", "text": "Material listo para su distribución", "done": false}]'::jsonb, '[]'::jsonb, 0),
('6ef382d5-f376-56fd-8fc1-065a311133f6', 'PR05', 'Revisión final · Unidad 1 · 4to', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 56, '[]'::jsonb, '[]'::jsonb, 0),
('70c4f3ca-887d-535d-bad0-13744d50ba88', 'PR05', 'Validación final del MEC · 4to', '[Migrado sin fecha — reprogramar]', '2026-08-29', array['P009']::text[], 'todo', 57, '[{"id": "40cc9def-eebb-59dc-a365-1042d5f39fd6", "text": "Aprobación oficial: FIFA + MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('73e5545a-fab0-53a3-820a-8b69d6092c1c', 'PR05', 'Revisión metodológica · Módulo 3 de formación', 'Luciana revisa que las actividades funcionen pedagógicamente.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 58, '[]'::jsonb, '[]'::jsonb, 0),
('7547790c-2719-5805-81b4-0de64788e6ab', 'PR05', 'Revisión final · Unidad 3 · 2do', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 59, '[]'::jsonb, '[]'::jsonb, 0),
('79358109-3d96-5219-a35a-41176a145048', 'PR05', 'Revisión final · Unidad 4 · 4to', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 60, '[]'::jsonb, '[]'::jsonb, 0),
('7a2cb718-9fce-5cb5-8854-a689360831e5', 'PR05', 'Contenido técnico · Módulo 3 de formación', 'El contenido de robótica y programación del módulo.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P003']::text[], 'todo', 61, '[]'::jsonb, '[]'::jsonb, 0),
('7b5a4b64-2476-5280-bdf3-3d32ce168bd2', 'PR05', 'PPTs y materiales · Módulo 1 de formación', 'Presentaciones, guías y todo lo que se entrega en la sesión.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 62, '[]'::jsonb, '[]'::jsonb, 0),
('7c87951a-4be1-5ea5-a72c-56207c6e0484', 'PR05', 'Cierre del libro · 5to', 'Pablo y Luciana autorizan que el libro está listo para entregar al MEC.
No avanza hasta que los dos den el visto bueno.
(salió del proceso editorial el 16/08/2026)
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P003','P006']::text[], 'todo', 63, '[{"id": "657d21b9-8e86-5ca9-a6e4-a6ed8bdc9c70", "text": "Visto bueno de Pablo", "done": false}, {"id": "ec6645c0-bcee-52b6-b7ed-61ee6406a9ee", "text": "Visto bueno de Luciana", "done": false}]'::jsonb, '[]'::jsonb, 0),
('7ea682e0-5c9e-52ce-9566-32862b1a4bf6', 'PR05', 'Instrumento de evaluación · Módulo 4 de formación', 'El examen del módulo. En el módulo 1 no aplica.
Se apoya en el examen EVAL·EX4.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P003']::text[], 'todo', 64, '[]'::jsonb, '[]'::jsonb, 0),
('80b8792d-bc30-5453-87c6-4d011f189957', 'PR05', 'Traducción · 4to', '[Migrado sin fecha — reprogramar]', '2026-08-29', array['P010']::text[], 'todo', 65, '[{"id": "0d312015-48b9-5833-bafe-56a6b50310f9", "text": "Libro traducido", "done": false}]'::jsonb, '[]'::jsonb, 0),
('81828e05-2c8e-5925-96bb-403e94271f7f', 'PR05', 'Diagramación en español', '(salió del proceso editorial el 16/08/2026)
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P010']::text[], 'todo', 66, '[{"id": "c469a089-2e3a-5f42-99c9-44014e18addb", "text": "Material listo para su distribución", "done": false}]'::jsonb, '[]'::jsonb, 0),
('829af2a7-3244-5762-9120-fdc17125aeda', 'PR05', 'Validación pedagógica · Autoevaluación 1', 'Solo si el contenido es pedagógico. Si es técnico (programación,
robótica), poné Tipo_Contenido = tecnico y este paso pasa a NO APLICA.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 67, '[]'::jsonb, '[]'::jsonb, 0),
('862e6771-f9e3-5148-bf05-d01a94be19a6', 'PR05', 'Traducción · 5to', '[Migrado sin fecha — reprogramar]', '2026-08-29', array['P010']::text[], 'todo', 68, '[{"id": "27cb9748-fe67-58dd-bbfa-0884716d8292", "text": "Libro traducido", "done": false}]'::jsonb, '[]'::jsonb, 0),
('889fb0de-1207-573f-990b-3664da6ddbde', 'PR05', 'Revisión final · Unidad 2 · 5to', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 69, '[]'::jsonb, '[]'::jsonb, 0),
('89673510-d686-5158-81f6-2ceec3e63951', 'PR05', 'Diseño · Autoevaluación 5', 'Los exámenes los diseña Pablo.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P003']::text[], 'todo', 70, '[]'::jsonb, '[]'::jsonb, 0);
insert into stage_tareas values
('8a5fd738-ab72-583a-be0c-4aa38a22095f', 'PR05', 'Revisión final · Unidad 5 · 2do', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 71, '[]'::jsonb, '[]'::jsonb, 0),
('8e7bf1f8-3608-54ad-ae9c-b656d00808eb', 'PR05', 'Revisión final · Unidad 7 · 2do', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 72, '[]'::jsonb, '[]'::jsonb, 0),
('8ee8d9fe-320c-5482-b491-427ea5387181', 'PR05', 'Revisión metodológica · Módulo 1 de formación', 'Luciana revisa que las actividades funcionen pedagógicamente.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 73, '[]'::jsonb, '[]'::jsonb, 0),
('8fa3d4f5-965c-5868-8254-986184d8490d', 'PR05', 'Revisión final · Unidad 4 · 2do', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 74, '[]'::jsonb, '[]'::jsonb, 0),
('900573ce-2bef-5ae2-a619-838d4465f590', 'PR05', 'Revisión final · Unidad 6 · 2do', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 75, '[]'::jsonb, '[]'::jsonb, 0),
('91358641-4f8a-511d-8ec0-c6afe9a19d0a', 'PR05', 'Diseño · Examen final · Módulo 4', 'Los exámenes los diseña Pablo.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P003']::text[], 'todo', 76, '[]'::jsonb, '[]'::jsonb, 0),
('95cf4ef6-348d-5028-a9d0-1b50cdeadaef', 'PR05', 'Revisión final · Unidad 6 · 3ro', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 77, '[]'::jsonb, '[]'::jsonb, 0),
('97623782-50b5-5694-9b05-228eb26e6e76', 'PR05', 'Revisión final · Unidad 5 · 4to', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 78, '[]'::jsonb, '[]'::jsonb, 0),
('9a237e4b-33c1-5f7c-9ccb-9f2a7bacc10b', 'PR05', 'PPTs y materiales · Módulo 2 de formación', 'Presentaciones, guías y todo lo que se entrega en la sesión.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 79, '[]'::jsonb, '[]'::jsonb, 0),
('9b2b546e-bc60-51be-9a50-dfd262d6edcf', 'PR05', 'Revisión final · Unidad 6 · 6to', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 80, '[]'::jsonb, '[]'::jsonb, 0),
('9ccb56e9-e47d-52bc-96d9-ce93ed7a6359', 'PR05', 'PPTs y materiales · Módulo 4 de formación', 'Presentaciones, guías y todo lo que se entrega en la sesión.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 81, '[]'::jsonb, '[]'::jsonb, 0),
('9eeb3b5f-cb11-50fc-8d54-04aa87b97d0a', 'PR05', 'Validación pedagógica · Autoevaluación 2', 'Solo si el contenido es pedagógico. Si es técnico (programación,
robótica), poné Tipo_Contenido = tecnico y este paso pasa a NO APLICA.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 82, '[]'::jsonb, '[]'::jsonb, 0),
('9f6af53a-7fd8-5353-8dde-4ff00954ce68', 'PR05', 'HITO O. ANTEPROYECTO', 'Hito del proyecto. [Migrado sin fecha — definir]', '2026-08-29', array['P003']::text[], 'todo', 83, '[]'::jsonb, '[]'::jsonb, 5),
('a371cc14-580e-5da7-a5ca-f5f798e3b43b', 'PR05', 'Revisión final · Unidad 8 · 2do', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 84, '[]'::jsonb, '[]'::jsonb, 0),
('a3c0b2e6-c2a1-5527-b1b5-24d4aa8c7eac', 'PR05', 'Revisión final · Unidad 8 · 3ro', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 85, '[]'::jsonb, '[]'::jsonb, 0),
('a3fe5475-7907-5efb-ada0-a8a5eb8eef8c', 'PR05', 'HITO 3 - SISTEMA DE MONITOREO, ACOMPAÑAMIENTO E IMPLEMENTACIÓN ESCOLAR', 'Hito del proyecto. [Migrado sin fecha — definir]', '2026-08-29', array['P003']::text[], 'todo', 86, '[]'::jsonb, '[]'::jsonb, 5),
('a424a68f-e129-55c6-a79f-f130b6e71d4c', 'PR05', 'Revisión final · Unidad 7 · 6to', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 87, '[]'::jsonb, '[]'::jsonb, 0),
('a80ccc24-bb19-50a5-ab37-33d728697b9c', 'PR05', 'Instrumento de evaluación · Módulo 3 de formación', 'El examen del módulo. En el módulo 1 no aplica.
Se apoya en el examen EVAL·EX3.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P003']::text[], 'todo', 88, '[]'::jsonb, '[]'::jsonb, 0),
('a817b31b-04a5-585c-9bcf-ad8a9471cd99', 'PR05', 'Revisión final · Unidad 3 · 5to', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 89, '[]'::jsonb, '[]'::jsonb, 0),
('ad8abb82-df50-5bcf-9352-2135f5b27c88', 'PR05', 'Validación final del MEC · 2do', '[Migrado sin fecha — reprogramar]', '2026-08-29', array['P009']::text[], 'todo', 90, '[{"id": "57c5befc-c37f-517c-a50f-ddb64d971b84", "text": "Aprobación oficial: FIFA + MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('b25260f0-f5a0-5ebd-838c-b5746af8df15', 'PR05', 'Revisión final · Unidad 6 · 4to', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 91, '[]'::jsonb, '[]'::jsonb, 0),
('b25286d2-029e-5235-a117-945d221ee69e', 'PR05', 'Revisión metodológica · Módulo 2 de formación', 'Luciana revisa que las actividades funcionen pedagógicamente.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 92, '[]'::jsonb, '[]'::jsonb, 0),
('b33af3b8-f3f5-5387-bb08-39dc5d58a6ad', 'PR05', 'Arquitectura de sesiones · Módulo 4 de formación', 'Cómo se estructura el módulo: sesiones, tiempos, secuencia.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P003']::text[], 'todo', 93, '[]'::jsonb, '[]'::jsonb, 0),
('b93f3209-c2fe-5381-9bda-7c2f9a11bc87', 'PR05', 'Revisión final · Unidad 2 · 2do', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 94, '[]'::jsonb, '[]'::jsonb, 0),
('b95b0181-39bc-5018-9bd6-7f68aafe4511', 'PR05', 'Diagramación en guaraní', '(salió del proceso editorial el 16/08/2026)
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P010']::text[], 'todo', 95, '[{"id": "d5972678-b880-51b4-a99a-2aace6972857", "text": "Material listo para su distribución", "done": false}]'::jsonb, '[]'::jsonb, 0),
('b99a72b8-2b49-5917-af2b-24af1290c72a', 'PR05', 'Carga en plataforma · Autoevaluación 2', 'Carga y comunicación: el auxiliar o Diana.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P005']::text[], 'todo', 96, '[]'::jsonb, '[]'::jsonb, 0),
('bb8dfb44-51ea-506a-baf8-2193d659a33f', 'PR05', 'Revisión final · Unidad 8 · 6to', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 97, '[]'::jsonb, '[]'::jsonb, 0),
('bbf69e44-ff24-5f14-a0c3-f10da09a2ede', 'PR05', 'Diagramación en español', '(salió del proceso editorial el 16/08/2026)
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P010']::text[], 'todo', 98, '[{"id": "a7dd1a1c-62f1-5947-81a7-48f1da019a25", "text": "Material listo para su distribución", "done": false}]'::jsonb, '[]'::jsonb, 0),
('bdbc4395-faac-5bd9-8e5d-d296de5793db', 'PR05', 'Arquitectura de sesiones · Módulo 2 de formación', 'Cómo se estructura el módulo: sesiones, tiempos, secuencia.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P003']::text[], 'todo', 99, '[]'::jsonb, '[]'::jsonb, 0),
('be0b0518-f80b-5365-a30a-a192015896c4', 'PR05', 'Cierre del libro · 2do', 'Pablo y Luciana autorizan que el libro está listo para entregar al MEC.
No avanza hasta que los dos den el visto bueno.
(salió del proceso editorial el 16/08/2026)
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P003','P006']::text[], 'todo', 100, '[{"id": "f64b3f79-68cc-5cd1-b49c-ca5a69e7a21e", "text": "Visto bueno de Pablo", "done": false}, {"id": "4f9aeffd-288b-5851-a931-967b16a594f9", "text": "Visto bueno de Luciana", "done": false}]'::jsonb, '[]'::jsonb, 0),
('be42ba7b-c553-5fd6-b7ba-4118b1c86744', 'PR05', 'Revisión metodológica · Módulo 4 de formación', 'Luciana revisa que las actividades funcionen pedagógicamente.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 101, '[]'::jsonb, '[]'::jsonb, 0),
('bf90b66a-c9e3-5ea6-af55-1d7b894a2e56', 'PR05', 'Diseño · Examen final · Módulo 2', 'Los exámenes los diseña Pablo.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P003']::text[], 'todo', 102, '[]'::jsonb, '[]'::jsonb, 0),
('c053633a-9824-5c65-9cfe-111a684751ee', 'PR05', 'Validación final del MEC · 1ro', '[Migrado sin fecha — reprogramar]', '2026-08-29', array['P009']::text[], 'todo', 103, '[{"id": "7bde9de7-f154-5261-b24c-30fc1e6750f2", "text": "Aprobación oficial: FIFA + MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('c17be263-7841-5fc6-aef6-6b11c3c4f123', 'PR05', 'Revisión final · Unidad 7 · 5to', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 104, '[]'::jsonb, '[]'::jsonb, 0),
('c29cf5a5-75b1-5616-ae1e-86295f4545da', 'PR05', 'Validación final del MEC · 5to', '[Migrado sin fecha — reprogramar]', '2026-08-29', array['P009']::text[], 'todo', 105, '[{"id": "df752bc9-429e-53b6-bb15-6840b40c9bbe", "text": "Aprobación oficial: FIFA + MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('c3e50987-0cb0-56b2-aa98-047b7695f35b', 'PR05', 'Carga en plataforma · Autoevaluación 4', 'Carga y comunicación: el auxiliar o Diana.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P005']::text[], 'todo', 106, '[]'::jsonb, '[]'::jsonb, 0),
('c5429eb9-17e0-5bbc-bacb-d0be5181a3d5', 'PR05', 'Revisión final · Unidad 1 · 2do', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 107, '[]'::jsonb, '[]'::jsonb, 0),
('c7ac211f-0447-54c2-9e58-89d2871b41e1', 'PR05', 'Revisión final · Unidad 3 · 3ro', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 108, '[]'::jsonb, '[]'::jsonb, 0),
('c985b294-da27-54ca-ad48-a8105ebcdb04', 'PR05', 'Carga en plataforma · Autoevaluación 3', 'Carga y comunicación: el auxiliar o Diana.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P005']::text[], 'todo', 109, '[]'::jsonb, '[]'::jsonb, 0),
('c9abf2c2-13c8-5322-b4c6-31e6f6f62708', 'PR05', 'Diseño · Autoevaluación 2', 'Los exámenes los diseña Pablo.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P003']::text[], 'todo', 110, '[]'::jsonb, '[]'::jsonb, 0);
insert into stage_tareas values
('cad4fcf1-d7f0-5fb6-850b-69e862ebd26e', 'PR05', 'Validación final del MEC · 3ro', '[Migrado sin fecha — reprogramar]', '2026-08-29', array['P009']::text[], 'todo', 111, '[{"id": "1adbe1e5-a9fe-5efa-af20-ee159dbc97ae", "text": "Aprobación oficial: FIFA + MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('cb1720f3-1238-5cee-a3d1-f7cb96880bb8', 'PR05', 'Diagramación en español', '(salió del proceso editorial el 16/08/2026)
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P010']::text[], 'todo', 112, '[{"id": "424d216d-6434-5dc2-9530-6be9acc4f9a8", "text": "Material listo para su distribución", "done": false}]'::jsonb, '[]'::jsonb, 0),
('d2a26380-07e0-5618-a303-e3d2838c6894', 'PR05', 'Revisión final · Unidad 3 · 6to', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 113, '[]'::jsonb, '[]'::jsonb, 0),
('d3ad44aa-8b95-54d6-aada-78ea366db8fa', 'PR05', 'Cierre del libro · 6to', 'Pablo y Luciana autorizan que el libro está listo para entregar al MEC.
No avanza hasta que los dos den el visto bueno.
(salió del proceso editorial el 16/08/2026)
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P003','P006']::text[], 'todo', 114, '[{"id": "65a4b4df-cbae-5908-ad18-5f451c7a5514", "text": "Visto bueno de Pablo", "done": false}, {"id": "595605fc-a9f9-5d59-9e63-4b040e4d11c6", "text": "Visto bueno de Luciana", "done": false}]'::jsonb, '[]'::jsonb, 0),
('d61755df-bcd5-53ae-8ea2-3ed3d05c88b8', 'PR05', 'Módulo listo · Módulo 4 de formación', 'Pablo y Luciana confirman que el módulo está para dictarse.
No avanza hasta que los dos den el visto bueno.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P003','P006']::text[], 'todo', 115, '[{"id": "62d733a5-acaf-5670-8998-f17a0b5fe0a6", "text": "Visto bueno de Pablo", "done": false}, {"id": "24fd11d0-d891-5961-aa76-b3aa080f7408", "text": "Visto bueno de Luciana", "done": false}]'::jsonb, '[]'::jsonb, 0),
('d66662e8-97e9-5033-90f7-a05cfa42bdc7', 'PR05', 'Instrumento de evaluación · Módulo 2 de formación', 'El examen del módulo. En el módulo 1 no aplica.
Se apoya en el examen EVAL·EX2.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P003']::text[], 'todo', 116, '[]'::jsonb, '[]'::jsonb, 0),
('d90592ae-4e34-5c83-aa99-0c2b16dc5d90', 'PR05', 'Revisión final · Unidad 3 · 4to', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 117, '[]'::jsonb, '[]'::jsonb, 0),
('db0ac4ef-128f-5593-bd03-34473b148680', 'PR05', 'Diagramación en guaraní', '(salió del proceso editorial el 16/08/2026)
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P010']::text[], 'todo', 118, '[{"id": "d06ab2f5-3e79-5a92-b238-0ae25cd29a10", "text": "Material listo para su distribución", "done": false}]'::jsonb, '[]'::jsonb, 0),
('dc360b4c-01db-50c5-bf66-06b4a3768d34', 'PR05', 'Edición final · libro de 6to', 'Edición del libro completo, con todos los módulos ya cerrados.
(salió del proceso editorial el 16/08/2026)
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 119, '[]'::jsonb, '[]'::jsonb, 0),
('dc800ba6-5ca4-51af-a3d4-a5867b1d28c1', 'PR05', 'Validación pedagógica · Examen final · Módulo 4', 'Solo si el contenido es pedagógico. Si es técnico (programación,
robótica), poné Tipo_Contenido = tecnico y este paso pasa a NO APLICA.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 120, '[]'::jsonb, '[]'::jsonb, 0),
('de654093-1619-5c5a-a9bd-571f198228a5', 'PR05', 'PPTs y materiales · Módulo 3 de formación', 'Presentaciones, guías y todo lo que se entrega en la sesión.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 121, '[]'::jsonb, '[]'::jsonb, 0),
('decd5f90-8a27-5262-99c0-020a03350075', 'PR05', 'Contenido técnico · Módulo 2 de formación', 'El contenido de robótica y programación del módulo.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P003']::text[], 'todo', 122, '[]'::jsonb, '[]'::jsonb, 0),
('dfb46f2d-d666-500f-bde9-79a11cbff711', 'PR05', 'Revisión final · Unidad 4 · 5to', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 123, '[]'::jsonb, '[]'::jsonb, 0),
('dff173a1-28ae-59b5-9f80-6e697c9833bf', 'PR05', 'Comunicación a docentes · Autoevaluación 1', 'Carga y comunicación: el auxiliar o Diana.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P005']::text[], 'todo', 124, '[]'::jsonb, '[]'::jsonb, 0),
('e15818fe-8caf-541b-a958-5e0fd061ed26', 'PR05', 'Edición · Unidad 1 · 4to', 'Paso del proceso editorial.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 125, '[]'::jsonb, '[]'::jsonb, 0),
('e4b94ed7-c4cd-5b13-ba80-670d697cbec7', 'PR05', 'Arquitectura de sesiones · Módulo 3 de formación', 'Cómo se estructura el módulo: sesiones, tiempos, secuencia.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P003']::text[], 'todo', 126, '[]'::jsonb, '[]'::jsonb, 0),
('e4ef0aeb-b8e8-5cb4-8698-06fc945dd5d1', 'PR05', 'Validación de la edición · Unidad 1 · 4to', 'Paso del proceso editorial.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P003']::text[], 'todo', 127, '[]'::jsonb, '[]'::jsonb, 0),
('e7254748-7788-5b4d-861b-3f0f23cff2c6', 'PR05', 'Cierre del libro · 4to', 'Pablo y Luciana autorizan que el libro está listo para entregar al MEC.
No avanza hasta que los dos den el visto bueno.
(salió del proceso editorial el 16/08/2026)
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P003','P006']::text[], 'todo', 128, '[{"id": "0fd2d0de-8c8b-54a6-828d-22ea919e6cbc", "text": "Visto bueno de Pablo", "done": false}, {"id": "e5b7c58b-e5ec-5dd5-8903-e71974aa36df", "text": "Visto bueno de Luciana", "done": false}]'::jsonb, '[]'::jsonb, 0),
('e730278f-4a4d-5409-8fcf-99e33ce314d1', 'PR05', 'Módulo listo · Módulo 3 de formación', 'Pablo y Luciana confirman que el módulo está para dictarse.
No avanza hasta que los dos den el visto bueno.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P003','P006']::text[], 'todo', 129, '[{"id": "b754fe6e-a974-53c9-b9bc-6f72a90a52b2", "text": "Visto bueno de Pablo", "done": false}, {"id": "70c38166-bc98-5fec-9362-01dc700cc240", "text": "Visto bueno de Luciana", "done": false}]'::jsonb, '[]'::jsonb, 0),
('ea4412a4-0e74-5b48-a7cf-b1f56867cc00', 'PR05', 'Carga en plataforma · Examen final · Módulo 4', 'Carga y comunicación: el auxiliar o Diana.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P005']::text[], 'todo', 130, '[]'::jsonb, '[]'::jsonb, 0),
('ebd86757-6055-5027-8300-511ffb83d787', 'PR05', 'Diagramación en español', '(salió del proceso editorial el 16/08/2026)
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P010']::text[], 'todo', 131, '[{"id": "b10a822b-240b-5ba8-b6b5-0bbd8e85f827", "text": "Material listo para su distribución", "done": false}]'::jsonb, '[]'::jsonb, 0),
('ee075215-f64b-5c6a-8ad1-612f2dea670b', 'PR05', 'Diagramación en guaraní', '(salió del proceso editorial el 16/08/2026)
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P010']::text[], 'todo', 132, '[{"id": "62c63fd0-0d07-50a9-8f99-082de47c54a0", "text": "Material listo para su distribución", "done": false}]'::jsonb, '[]'::jsonb, 0),
('ee7f713f-787b-586b-b42f-011bce17d033', 'PR05', 'Revisión final · Unidad 5 · 5to', 'Luciana edita el módulo una vez que Pablo validó los ajustes.
Recién con esto el módulo queda cerrado.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 133, '[]'::jsonb, '[]'::jsonb, 0),
('f120f237-3ec8-5117-b9c7-ca846d648a95', 'PR05', 'Cierre del libro · 3ro', 'Pablo y Luciana autorizan que el libro está listo para entregar al MEC.
No avanza hasta que los dos den el visto bueno.
(salió del proceso editorial el 16/08/2026)
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P003','P006']::text[], 'todo', 134, '[{"id": "3f001bd7-c893-5b3b-9e00-b4963bceb7ae", "text": "Visto bueno de Pablo", "done": false}, {"id": "9e540efa-5fda-5254-b45e-906b18bc0e02", "text": "Visto bueno de Luciana", "done": false}]'::jsonb, '[]'::jsonb, 0),
('f1f34936-774d-53eb-a39d-8346a0d99e14', 'PR05', 'Comunicación a docentes · Autoevaluación 4', 'Carga y comunicación: el auxiliar o Diana.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P005']::text[], 'todo', 135, '[]'::jsonb, '[]'::jsonb, 0),
('f4722805-7116-5cb2-8edc-d997bfe4cd47', 'PR05', 'Carga en plataforma · Examen final · Módulo 2', 'Carga y comunicación: el auxiliar o Diana.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P005']::text[], 'todo', 136, '[]'::jsonb, '[]'::jsonb, 0),
('f527c26e-7769-5356-8c57-bb6f975f6354', 'PR05', 'Traducción · 3ro', '[Migrado sin fecha — reprogramar]', '2026-08-29', array['P010']::text[], 'todo', 137, '[{"id": "faf959ec-05ae-5ab5-bc3e-0ab0559fcc3e", "text": "Libro traducido", "done": false}]'::jsonb, '[]'::jsonb, 0),
('f7dc3d28-fb16-5d31-a38b-43324c5ec2e8', 'PR05', 'HITO 5. CIERRE, EVALUACIÓN DE IMPACTO Y SOSTENIBILIDAD DEL PROYECTO', 'Hito del proyecto. [Migrado sin fecha — definir]', '2026-08-29', array['P003']::text[], 'todo', 138, '[]'::jsonb, '[]'::jsonb, 5),
('fbfe0ef0-4c04-54cd-9b06-31a64f135f32', 'PR05', 'Traducción · 6to', '[Migrado sin fecha — reprogramar]', '2026-08-29', array['P010']::text[], 'todo', 139, '[{"id": "f0a61705-070d-51e3-8925-7358eeb8f848", "text": "Libro traducido", "done": false}]'::jsonb, '[]'::jsonb, 0),
('fccb40af-8004-5615-8e7b-f87c6507e81b', 'PR05', 'Validación pedagógica · Autoevaluación 5', 'Solo si el contenido es pedagógico. Si es técnico (programación,
robótica), poné Tipo_Contenido = tecnico y este paso pasa a NO APLICA.
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P006']::text[], 'todo', 140, '[]'::jsonb, '[]'::jsonb, 0),
('fdf6be2d-46df-54a1-9049-af736c409bb2', 'PR05', 'Diagramación en guaraní', '(salió del proceso editorial el 16/08/2026)
[Migrado sin fecha — reprogramar]', '2026-08-29', array['P010']::text[], 'todo', 141, '[{"id": "f59083b4-f00f-5ccf-afe9-0bbfdd6bf084", "text": "Material listo para su distribución", "done": false}]'::jsonb, '[]'::jsonb, 0),
('fe7fcb6c-7ac0-58aa-95ff-b079678f172d', 'PR05', 'Traducción · 1ro', '[Migrado sin fecha — reprogramar]', '2026-08-29', array['P010']::text[], 'todo', 142, '[{"id": "59307434-7fcb-53ba-a4db-39e3e44dfe0c", "text": "Libro traducido", "done": false}]'::jsonb, '[]'::jsonb, 0),
('0847dcda-f3bd-533b-a1f7-4fe7880e53d1', 'PR05', 'Validación de la edición · Unidad 2 · 4to', 'Pablo verifica que el ajuste no rompió lo técnico.', '2026-08-31', array['P003','P006']::text[], 'todo', 0, '[{"id": "be29242c-989a-5a72-9372-e401042d2bce", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('83789f2d-c808-549b-8f9b-5ca49243d7b2', 'PR05', 'CAPACITACIÓN VIRT. M2.S2 + M2.S3', 'Grupo 1 Central. 12:30 a 14:30 hs.', '2026-08-31', array['P003','P006']::text[], 'todo', 1, '[]'::jsonb, '[]'::jsonb, 0),
('6353a092-3f85-593c-97b9-d2f16092e86b', 'PR05', 'Elaboración de nómina certificable', 'Planilla de calificación final.', '2026-09-03', array['P003','P006','P008']::text[], 'todo', 0, '[{"id": "0f64373c-21a5-5bc4-aef3-3eafc2733543", "text": "Nómina oficial", "done": false}]'::jsonb, '[]'::jsonb, 0),
('5f813d50-bd15-5b1b-ae95-bb3d495eea83', 'PR05', 'CAPACITACIÓN VIRT. M2.S2 + M2.S3', 'Grupo 1 Central. 12:30 a 14:30 hs.', '2026-09-04', array['P003','P006']::text[], 'todo', 0, '[]'::jsonb, '[]'::jsonb, 0),
('edf16a98-744d-5b0c-90ce-a1c436779d17', 'PR05', 'Edición · Unidad 3 · 4to', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 3)', '2026-09-04', array['P006']::text[], 'todo', 1, '[{"id": "ef701b6f-99f4-5993-9930-0b4e699b9efa", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('d0b1d3d8-96c3-500b-8a9d-31d375e73af6', 'PR02', 'Liga · Fecha 1', 'Hito del proyecto.', '2026-09-05', array['P002']::text[], 'todo', 0, '[]'::jsonb, '[]'::jsonb, 5),
('013dcc4a-ec3a-5edb-8fe0-7faa5b70e25a', 'PR05', 'Validación de la edición · Unidad 3 · 4to', 'Pablo verifica que el ajuste no rompió lo técnico.', '2026-09-08', array['P003','P006']::text[], 'todo', 0, '[{"id": "f3ee4d2e-616a-533d-918f-a5ed11f1711f", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('389386f6-b395-53c8-b136-12fd21697f52', 'PR05', 'Enviar administrativa de nómina', 'IFD + MEC: revisar y aprobar.', '2026-09-08', array['P002']::text[], 'todo', 1, '[{"id": "80b3afb0-0153-502c-99c7-e5cae47f920c", "text": "Nómina validada", "done": false}]'::jsonb, '[]'::jsonb, 0);
insert into stage_tareas values
('0401f212-d485-5e55-8ca0-d0bb1de55e3d', 'PR05', 'CAPACITACIÓN VIRT. M2.S2 + M2.S3', 'Grupo 1 Central. 12:30 a 14:30 hs.', '2026-09-10', array['P003','P006']::text[], 'todo', 0, '[]'::jsonb, '[]'::jsonb, 0),
('546ab25c-9d12-5b07-abeb-87ccd9fe0ef8', 'PR05', 'Escritura · Unidad 1 · 2do', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 1)', '2026-09-14', array['P003']::text[], 'todo', 0, '[{"id": "713a3b9b-2b1d-51df-af04-54d845400268", "text": "Borrador consolidado", "done": false}]'::jsonb, '[]'::jsonb, 0),
('6fb2ef57-c866-5063-91d4-a1ee6b885705', 'PR05', 'Presentación de documentación para certificación', 'Consolidar documentación requerida por IFD y acta correspondiente del MEC para expedición de la certificación.', '2026-09-14', array['P002']::text[], 'todo', 1, '[{"id": "97078612-635c-543c-a6ee-5ab419ec206a", "text": "Expediente presentado", "done": false}]'::jsonb, '[]'::jsonb, 0),
('992ed43c-1d65-5e1b-9ba8-8ca5b989315f', 'PR05', 'Edición · Unidad 4 · 4to', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 4)', '2026-09-14', array['P006']::text[], 'todo', 2, '[{"id": "32953f3a-5560-5d3f-891d-2e3f798d773d", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('197002de-656a-537a-aa1d-5bd82235e67d', 'PR05', 'CAPACITACIÓN VIRT. M2.S2 + M2.S3', 'Grupo 1 Central. 12:30 a 14:30 hs.', '2026-09-15', array['P003','P006']::text[], 'todo', 0, '[]'::jsonb, '[]'::jsonb, 0),
('6710014c-3285-589e-86f5-a9a3e5cfc798', 'PR05', 'Edición · Unidad 1 · 2do', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 1)', '2026-09-16', array['P006']::text[], 'todo', 0, '[{"id": "2b31889d-b071-5c5f-8246-c2ac51f372ba", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('de6ee3c6-3068-5434-af1d-f0ca1ee94aed', 'PR05', 'Validación de la edición · Unidad 4 · 4to', 'Pablo verifica que el ajuste no rompió lo técnico.', '2026-09-16', array['P003','P006']::text[], 'todo', 1, '[{"id": "e39ccd79-8b99-5d22-b0b8-8aa7b0b1baac", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('18ba4ef5-2e31-50f1-aa6f-4cfcf6898ca8', 'PR05', 'Sistematización de resultados Cohorte 1', null, '2026-09-17', array['P006','P008']::text[], 'todo', 0, '[{"id": "7529132b-04df-510b-9956-37e48bcbe9f1", "text": "Informe de resultados", "done": false}]'::jsonb, '[]'::jsonb, 0),
('65542c04-281e-5a7f-ab51-80f02bb2f28c', 'PR05', 'Validación de la edición · Unidad 1 · 2do', 'Pablo verifica que el ajuste no rompió lo técnico.', '2026-09-18', array['P003','P006']::text[], 'todo', 0, '[{"id": "86cc152d-7eda-5ae8-8840-e82bf85d627b", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('f1ee1e39-e1f7-5216-9d2e-a5d75967ede1', 'PR05', 'Escritura · Unidad 5 · 4to', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 5)', '2026-09-18', array['P003']::text[], 'todo', 1, '[{"id": "a22e3dfa-3cca-5e3a-87c1-1d5277a4547e", "text": "Unidad presentada en formato Word.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('37f2336f-8529-5d42-9c25-a28193ba1793', 'PR05', 'Escritura · Unidad 2 · 2do', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 2)', '2026-09-22', array['P003']::text[], 'todo', 0, '[{"id": "c254fc7f-00a9-5980-be8c-a706308b68a9", "text": "Unidad presentada en formato Word.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('ae3e5c51-0acd-5e95-805e-59a9cefd40c6', 'PR05', 'Edición · Unidad 5 · 4to', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 5)', '2026-09-22', array['P006']::text[], 'todo', 1, '[{"id": "481d75af-920b-5152-b850-538784723194", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('1a714518-2fe8-5c94-b5ab-fdd82bbc3373', 'PR05', 'Elaboración de informe de cierre Cohorte 1', null, '2026-09-23', array['P006']::text[], 'todo', 0, '[{"id": "6f3fa276-679f-57a9-952b-d66c2507dab1", "text": "Informe final aprobado", "done": false}]'::jsonb, '[]'::jsonb, 0),
('1560eb50-bcab-5eb9-9ee4-76371016c7b2', 'PR05', 'Validación de la edición · Unidad 5 · 4to', 'Pablo verifica que el ajuste no rompió lo técnico.', '2026-09-24', array['P003','P006']::text[], 'todo', 0, '[{"id": "6fced833-3be1-5ba3-ab8c-35fb6be425d1", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('47d87ff2-d5cd-50ad-a480-e589b222aec1', 'PR05', 'Edición · Unidad 2 · 2do', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 2)', '2026-09-24', array['P006']::text[], 'todo', 1, '[{"id": "f3b368e9-20d4-57f8-81c0-141d0330830b", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('3f9f4243-fec1-572d-8ca6-6d4ee4723738', 'PR05', 'Escritura · Unidad 6 · 4to', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 6)', '2026-09-28', array['P003']::text[], 'todo', 0, '[{"id": "4f34f2f1-6258-55e4-a558-e27d4d707e2a", "text": "Unidad presentada en formato Word.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('9b69e163-1e1e-5184-81f5-6089eb63424d', 'PR05', 'Validación de la edición · Unidad 2 · 2do', 'Pablo verifica que el ajuste no rompió lo técnico.', '2026-09-28', array['P003','P006']::text[], 'todo', 1, '[{"id": "88f5fca2-acba-5b0a-adcf-78087aabdc9b", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('55f8e01e-165b-5cce-af7c-76bdba199213', 'PR05', 'Presentación al Comité  FIFA', null, '2026-09-30', array['P006']::text[], 'todo', 0, '[{"id": "2d034cea-be6e-5a8f-a52a-202235d56ce8", "text": "Acta de cierre", "done": false}]'::jsonb, '[]'::jsonb, 0),
('2b21c1e3-097b-5b91-a409-3c8762a7015a', 'PR05', 'Escritura · Unidad 3 · 2do', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 3)', '2026-10-01', array['P003']::text[], 'todo', 0, '[{"id": "552c056a-021a-544b-810e-075cc9571f10", "text": "Unidad presentada en formato Word.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('8b222e73-5aa8-54c7-a33e-943168e553a6', 'PR05', 'Edición · Unidad 6 · 4to', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 6)', '2026-10-01', array['P006']::text[], 'todo', 1, '[{"id": "18965a93-15d5-5ec5-aad6-049bfaad1965", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('aff14886-0e45-5f17-9a15-15659444e661', 'PR05', 'Auditoría pedagógica de materiales utilizados en Cohorte 1', 'Revisar los materiales utilizados en la Cohorte 1 para identificar fortalezas, debilidades y oportunidades de mejora en contenidos, secuencia didáctica, metodología y recursos utilizados.', '2026-10-01', array['P006']::text[], 'done', 2, '[{"id": "fa51ca21-81d8-5e71-bf76-325f01d559d8", "text": "Informe de hallazgos/ auditoría", "done": false}]'::jsonb, '[]'::jsonb, 0),
('5cd4e149-844a-57d8-9595-ca3cc3b00355', 'PR02', 'Liga · Fecha 2', 'Hito del proyecto.', '2026-10-03', array['P002']::text[], 'todo', 0, '[]'::jsonb, '[]'::jsonb, 5),
('5da0e38f-7f9e-5c7f-8d4a-941dc2ef0d73', 'PR05', 'Validación de la edición · Unidad 6 · 4to', 'Pablo verifica que el ajuste no rompió lo técnico.', '2026-10-05', array['P003','P006']::text[], 'todo', 0, '[{"id": "c5398d2c-9ad1-599f-aa5e-1621e28b766c", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('66c10ad0-77b6-5536-a21b-a766e0f9893b', 'PR05', 'Escritura · Unidad 1 · 5to', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 1)', '2026-10-05', array['P003']::text[], 'todo', 1, '[{"id": "0d7671ea-4b6a-585f-b5cb-66d9ac8b6958", "text": "Borrador consolidado", "done": false}]'::jsonb, '[]'::jsonb, 0),
('8b82fc1e-e6e3-5b57-9e7d-eaf4e4654b9d', 'PR05', 'Edición · Unidad 3 · 2do', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 3)', '2026-10-05', array['P006']::text[], 'todo', 2, '[{"id": "2e4cf7aa-3760-59f8-9196-393321fe0698", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('58a31e19-ec40-5151-a3fb-6b020448c8e7', 'PR05', 'Edición · Unidad 1 · 5to', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 1)', '2026-10-07', array['P006']::text[], 'todo', 0, '[{"id": "ee8783e9-e6a7-5ba4-a677-6e61fda08a9a", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('d150d3f9-1d8e-5a40-be90-983fa3eba9ac', 'PR05', 'Validación de la edición · Unidad 3 · 2do', 'Pablo verifica que el ajuste no rompió lo técnico.', '2026-10-07', array['P003','P006']::text[], 'todo', 1, '[{"id": "2406f33d-d211-5018-b02d-2bfa36f0f57b", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('d7aa0008-69f3-5cdb-bba4-937d062d96e5', 'PR05', 'Validar Plan de Formación de Cohorte 3 con el Ministerio.', 'Presentar la propuesta formativa al Ministerio, incorporar observaciones recibidas y realizar los ajustes necesarios para su aprobación.', '2026-10-07', array['P002','P011']::text[], 'todo', 2, '[]'::jsonb, '[]'::jsonb, 0),
('eb569445-596e-50a9-8d21-2e93306f7703', 'PR05', 'Escritura · Unidad 7 · 4to', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 7)', '2026-10-07', array['P003']::text[], 'todo', 3, '[{"id": "4e4506b0-9ab9-5f04-89f3-c5d7686117b2", "text": "Unidad presentada en formato Word.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('83d12502-5823-5292-8035-09ad5ad933df', 'PR05', 'Revisión técnica de contenidos', 'Revisar contenidos para asegurar precisión conceptual, pertinencia temática y coherencia con los objetivos de aprendizaje definidos.', '2026-10-08', array['P003']::text[], 'todo', 0, '[{"id": "be94f769-eafa-53bd-b538-44ab4cf7a178", "text": "Informe técnico", "done": false}]'::jsonb, '[]'::jsonb, 0),
('551d099e-3c48-5366-a8c0-c82e54ebaf3a', 'PR05', 'Edición · Unidad 7 · 4to', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 7)', '2026-10-09', array['P006']::text[], 'todo', 0, '[{"id": "23c88ae4-45b3-53ca-a01b-fe65e6352161", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('62aff4c0-bbf8-5546-947e-1a69f85bce2b', 'PR05', 'Validación de la edición · Unidad 1 · 5to', 'Pablo verifica que el ajuste no rompió lo técnico.', '2026-10-09', array['P003','P006']::text[], 'todo', 1, '[{"id": "906aa2db-6bf2-55b3-9c52-74d70b467df6", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('fc116ff5-7902-50c2-8fe7-b05d87b69e71', 'PR05', 'Escritura · Unidad 4 · 2do', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 4)', '2026-10-09', array['P003']::text[], 'todo', 2, '[{"id": "a0d4abee-c9e8-523f-b158-0accbd0a24ea", "text": "Unidad presentada en formato Word.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('7ac32c84-edd6-5e17-bf47-d696713c116c', 'PR05', 'Edición · Unidad 4 · 2do', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 4)', '2026-10-13', array['P006']::text[], 'todo', 0, '[{"id": "f916150d-50cf-5ae9-a265-a0dc5176292d", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('879b74f1-ca96-540f-97a8-831d15883ecf', 'PR05', 'Validación de la edición · Unidad 7 · 4to', 'Pablo verifica que el ajuste no rompió lo técnico.', '2026-10-13', array['P003','P006']::text[], 'todo', 1, '[{"id": "a65e65b0-1ba9-50d9-b9c6-ec97681dad0f", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('a8af55b8-039a-5d7b-914f-2f1371b0c67b', 'PR05', 'Escritura · Unidad 2 · 5to', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 2)', '2026-10-13', array['P003']::text[], 'todo', 2, '[{"id": "467b4ce8-728d-5b19-933d-d66774d12cbd", "text": "Unidad presentada en formato Word.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('910727ac-9dd9-5caf-a0da-25737ff51e0b', 'PR05', 'Revisión metodológica de actividades', 'Revisar las actividades diseñadas para verificar su alineación metodológica y pedagógica, identificando oportunidades de mejora que fortalezcan la experiencia de aprendizaje y aseguren coherencia con los objetivos del proyecto.', '2026-10-14', array['P003','P006','P008']::text[], 'done', 0, '[{"id": "5f64f978-2719-5f96-b4a0-12002227cb84", "text": "Matriz de ajustes", "done": false}]'::jsonb, '[]'::jsonb, 0),
('9d55916f-6dc3-5c32-9832-087aaeb4f48f', 'PR05', 'Validación de la edición · Unidad 4 · 2do', 'Pablo verifica que el ajuste no rompió lo técnico.', '2026-10-15', array['P003','P006']::text[], 'todo', 0, '[{"id": "ab935cc0-fcd1-598a-9ae0-8e568159c9d9", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('c2611039-3250-5536-8ae5-6399ca9a72f0', 'PR05', 'Escritura · Unidad 8 · 4to', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 8)', '2026-10-15', array['P003']::text[], 'todo', 1, '[{"id": "1415bc1a-d2ae-5bca-871a-f375c94979fc", "text": "Unidad presentada en formato Word.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('e19bd412-d2ca-50e9-8c3c-9219b1b30968', 'PR05', 'Edición · Unidad 2 · 5to', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 2)', '2026-10-15', array['P006']::text[], 'todo', 2, '[{"id": "efb786d0-567b-59a6-a8bb-da46192cc01c", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0);
insert into stage_tareas values
('3cc20c84-487b-5db1-b494-6da35e11ec99', 'PR05', 'Edición · Unidad 8 · 4to', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 8)', '2026-10-19', array['P006']::text[], 'todo', 0, '[{"id": "836faf7f-b8ff-5dfb-aba9-654cf99b411a", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('565b6727-7eeb-51a3-9ab9-8be027168f5f', 'PR05', 'Validación de la edición · Unidad 2 · 5to', 'Pablo verifica que el ajuste no rompió lo técnico.', '2026-10-19', array['P003','P006']::text[], 'todo', 1, '[{"id": "c086d8f7-f8b4-5992-84b1-d125c8525ab4", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('9e2ceaf5-61cb-5fb7-9057-ca0b40a650f6', 'PR05', 'Escritura · Unidad 5 · 2do', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 5)', '2026-10-19', array['P003']::text[], 'todo', 2, '[{"id": "57524e6c-681b-5f41-b6da-c21c10ef7d25", "text": "Unidad presentada en formato Word.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('e630d41b-197b-5e23-8173-513443a9aeb3', 'PR05', 'Armado de la arquitectura de los módulos y las sesiones.', 'Diseñar la estructura general del recorrido formativo definiendo módulos, sesiones, secuencia pedagógica, objetivos, actividades y articulación entre contenidos.', '2026-10-19', array['P003','P006']::text[], 'todo', 3, '[{"id": "b2dda63b-712a-52e8-8bdf-d3e2e1d2bfba", "text": "Arquitectura base termianda.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('245867a9-5d70-5c81-8efe-4c25e7fa94f5', 'PR05', 'Validación de la edición · Unidad 8 · 4to', 'Pablo verifica que el ajuste no rompió lo técnico.', '2026-10-21', array['P003','P006']::text[], 'todo', 0, '[{"id": "6eb354b8-4530-5a2a-8a92-0bdd50b4ade9", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('40fff0a5-afac-5e03-ae30-2f92e6651d5e', 'PR05', 'Escritura · Unidad 3 · 5to', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 3)', '2026-10-21', array['P003']::text[], 'todo', 1, '[{"id": "e07447c9-5d03-544c-9611-7666daedee0f", "text": "Unidad presentada en formato Word.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('b376a360-7a97-51bf-a992-dfcbb1702752', 'PR05', 'Edición · Unidad 5 · 2do', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 5)', '2026-10-21', array['P006']::text[], 'todo', 2, '[{"id": "569326a9-3b05-558d-8ec1-6eaba831f68f", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('49a83174-8583-5e66-a2dc-bb5dd1d7217f', 'PR05', 'Edición · Unidad 3 · 5to', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 3)', '2026-10-23', array['P006']::text[], 'todo', 0, '[{"id": "f678a98f-2c2c-5f74-b539-4331bb553f6e", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('a1ed4d1b-7672-5145-85bb-40d0a7f129b0', 'PR05', 'Diagramación · 1ro', null, '2026-10-23', array['P006']::text[], 'todo', 1, '[{"id": "4c40f8c2-2ea2-5518-a60d-62f0ab3a3627", "text": "Acta aprobación", "done": false}]'::jsonb, '[]'::jsonb, 0),
('b13db55e-d421-5284-a4ed-504e403611d4', 'PR05', 'Validación de la edición · Unidad 5 · 2do', 'Pablo verifica que el ajuste no rompió lo técnico.', '2026-10-23', array['P003','P006']::text[], 'todo', 2, '[{"id": "1c2eba28-0e08-5f85-a4f0-659866f07b55", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('c490bd45-d2b1-5ecb-beaa-71847431ae1f', 'PR05', 'Desarrollo guía docente', '(salió del proceso editorial el 16/08/2026)', '2026-10-23', array['P006']::text[], 'todo', 3, '[{"id": "e4d3a8b5-1cf5-5fe5-bc21-5e88ad196868", "text": "Versión corregida", "done": false}]'::jsonb, '[]'::jsonb, 0),
('a1411e46-8b72-56b1-99e9-f4a2fca5ebcb', 'PR05', 'Validación de la edición · Unidad 3 · 5to', 'Pablo verifica que el ajuste no rompió lo técnico.', '2026-10-27', array['P003','P006']::text[], 'todo', 0, '[{"id": "b4fe4f44-9dc4-5681-80af-28dd47a472e7", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('a4d2fa40-7d03-5246-894e-0edadcd0cdb3', 'PR05', 'Escritura · Unidad 6 · 2do', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 6)', '2026-10-27', array['P003']::text[], 'todo', 1, '[{"id": "2f2d0191-9bb5-5958-9f03-94dbb82a656e", "text": "Unidad presentada en formato Word.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('bc1276e1-0482-5681-a5f7-a9ddc1535171', 'PR05', 'Validación interna', '(salió del proceso editorial el 16/08/2026)', '2026-10-27', array['P003','P006']::text[], 'todo', 2, '[{"id": "40848b5a-0463-53bd-93b5-1c28ba968429", "text": "Guía docente", "done": false}]'::jsonb, '[]'::jsonb, 0),
('d407e848-7fb9-5334-bcf5-f8b31826831e', 'PR05', 'Presentación al MEC · 1ro', null, '2026-10-27', array['P002']::text[], 'todo', 3, '[{"id": "19e2e3f6-c601-5dfd-a51f-c5700484235d", "text": "Expediente MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('6575b778-b484-5b32-a477-717595ab60af', 'PR05', 'Adecuación de evaluaciones', 'Revisar y ajustar evaluaciones, criterios de corrección e instrumentos para asegurar coherencia con los contenidos y resultados de aprendizaje esperados.', '2026-10-28', array['P003','P006','P008']::text[], 'todo', 0, '[{"id": "9c5ac420-de4b-53e8-8819-5d1074c42358", "text": "Instrumentos actualizados", "done": false}]'::jsonb, '[]'::jsonb, 0),
('1781a1c2-012f-5417-a5ed-56d204452e00', 'PR05', 'Correcciones (sugerencias del MEC)', '(salió del proceso editorial el 16/08/2026)', '2026-10-29', array['P003','P006','P008']::text[], 'todo', 0, '[{"id": "c8ee106c-26d2-50e3-ae73-f2c2de261245", "text": "Versión corregida", "done": false}]'::jsonb, '[]'::jsonb, 0),
('70d92ff6-e42a-580f-ab6e-6533a161046d', 'PR05', 'Diagramación · 4to', null, '2026-10-29', array['P006']::text[], 'todo', 1, '[{"id": "37a1ebf0-cc6a-569e-8bae-1044dd3823d6", "text": "Acta aprobación", "done": false}]'::jsonb, '[]'::jsonb, 0),
('88a19bae-90f4-5e1f-8356-33c5f8edaadb', 'PR05', 'Edición · Unidad 6 · 2do', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 6)', '2026-10-29', array['P006']::text[], 'todo', 2, '[{"id": "55e6d62b-435a-5607-b682-d050641027a9", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('e2b6c119-addb-5e6b-890e-1bbd46672b4b', 'PR05', 'Escritura · Unidad 4 · 5to', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 4)', '2026-10-29', array['P003']::text[], 'todo', 3, '[{"id": "85a678d4-557c-5562-91b2-8afdb8e1e73a", "text": "Unidad presentada en formato Word.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('482c9da7-947b-52ba-b46c-7d0bead4ef68', 'PR05', 'Definición de indicadores de implementación', 'Definir variables de seguimiento, fuentes de información, periodicidad y criterios de medición del proceso de implementación', '2026-11-02', array['P006','P008']::text[], 'todo', 0, '[{"id": "4f831f71-f07d-57fc-bc99-3b3486dc087e", "text": "Matriz de indicadores", "done": false}]'::jsonb, '[]'::jsonb, 0),
('9151caaa-2ec7-565c-a2e0-f9e06abbf512', 'PR05', 'Edición · Unidad 4 · 5to', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 4)', '2026-11-02', array['P006']::text[], 'todo', 1, '[{"id": "3705b795-d123-523f-bfac-fd49b101edbb", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('b64f85ab-a843-5574-88b2-85a25c49e7fb', 'PR05', 'Presentación al MEC · 4to', null, '2026-11-02', array['P002']::text[], 'todo', 2, '[{"id": "60499bf2-ffc4-583e-8a39-5295ff08dbb2", "text": "Expediente MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('c7ce58f1-58c8-5a82-805a-5f570f903c4f', 'PR05', 'Validación de la edición · Unidad 6 · 2do', 'Pablo verifica que el ajuste no rompió lo técnico.', '2026-11-02', array['P003','P006']::text[], 'todo', 3, '[{"id": "d9b9928a-9d91-5c5e-98cb-2ca2d493c92e", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('3ed4832a-2754-5c48-b8f9-ac3889ce6a20', 'PR05', 'Ajuste y actualización de PPTs y materiales', 'Actualizar presentaciones y recursos de soporte incorporando ajustes pedagógicos y técnicos. Incluye elaboración y diagramación de PDFs, videos, enlaces, glosario y materiales complementarios.', '2026-11-03', array['P006','P008']::text[], 'todo', 0, '[{"id": "6580d4b6-599d-5a01-8753-5f98e49dbfa8", "text": "Material actualizado de los 5 Módulos (21 sesiones en total)", "done": false}]'::jsonb, '[]'::jsonb, 0),
('4e15098d-0465-5f82-8399-7462d525ced3', 'PR05', 'Escritura · Unidad 7 · 2do', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 7)', '2026-11-04', array['P003']::text[], 'todo', 0, '[{"id": "2a0c98d4-de93-5edd-94a5-bf8534403dbe", "text": "Unidad presentada en formato Word.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('d89dcf65-31ff-5543-acad-59c13ab83a28', 'PR05', 'Correcciones (sugerencias del MEC)', '(salió del proceso editorial el 16/08/2026)', '2026-11-04', array['P003','P006','P008']::text[], 'todo', 1, '[{"id": "718fe9cf-83d6-527f-8c1b-0512da987355", "text": "Versión corregida", "done": false}]'::jsonb, '[]'::jsonb, 0),
('f945fb70-240d-52f2-a446-ea44685f7a90', 'PR05', 'Validación de la edición · Unidad 4 · 5to', 'Pablo verifica que el ajuste no rompió lo técnico.', '2026-11-04', array['P003','P006']::text[], 'todo', 2, '[{"id": "cfc8d8c0-0ab6-56dc-b4e0-15c1ab23cd94", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('02b91c7e-cd09-5621-86b8-f51c34b6b91a', 'PR05', 'Escritura · Unidad 5 · 5to', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 5)', '2026-11-06', array['P003']::text[], 'todo', 0, '[{"id": "acc7362c-0a28-54c1-a73e-bd83394a7128", "text": "Unidad presentada en formato Word.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('be4fac74-e296-5358-896a-bf75f01da07d', 'PR05', 'Edición · Unidad 7 · 2do', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 7)', '2026-11-06', array['P006']::text[], 'todo', 1, '[{"id": "2069184c-8f55-59f2-a6fd-56c9958ded77", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('23e00b99-a1d3-531a-844e-76a17376f7cb', 'PR02', 'Liga · Fecha 3', 'Hito del proyecto.', '2026-11-07', array['P002']::text[], 'todo', 0, '[]'::jsonb, '[]'::jsonb, 5),
('4810aa0b-98fb-5625-b074-c9a4fd0355aa', 'PR05', 'Validación de la edición · Unidad 7 · 2do', 'Pablo verifica que el ajuste no rompió lo técnico.', '2026-11-10', array['P003','P006']::text[], 'todo', 0, '[{"id": "e8a6e754-3983-5a15-8003-154fc0d7af5c", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('c8c4052f-0a87-5069-bfa6-a168d8a7d878', 'PR05', 'Edición · Unidad 5 · 5to', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 5)', '2026-11-10', array['P006']::text[], 'todo', 1, '[{"id": "88225afd-3824-5603-9fd3-929a52fb4d99", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('dca6907b-72a9-5d45-875b-6a22092d1e43', 'PR05', 'Validación en Mesa Pedagógica', 'Presentar la versión ajustada de materiales, recoger retroalimentación y aprobar la versión final antes de implementación.', '2026-11-10', array['P003','P006']::text[], 'todo', 2, '[{"id": "b9590590-bf16-5432-8a41-373e91e87a74", "text": "Acta de aprobación", "done": false}]'::jsonb, '[]'::jsonb, 0),
('fa85f1fa-7688-5c91-bc81-df37f0313c49', 'PR05', 'Animar en PPTS', 'Incorporar animaciones, transiciones, elementos visuales y ajustes de navegación para mejorar la experiencia de uso de los materiales.', '2026-11-11', array['P003','P006']::text[], 'todo', 0, '[{"id": "5839a6ee-7ae5-541d-bf61-3e9e936d569a", "text": "Material animado", "done": false}]'::jsonb, '[]'::jsonb, 0),
('0afa2cdc-8f97-506e-b4b3-fd85f6ed7090', 'PR05', 'Validación de la edición · Unidad 5 · 5to', 'Pablo verifica que el ajuste no rompió lo técnico.', '2026-11-12', array['P003','P006']::text[], 'todo', 0, '[{"id": "8e9d8b19-375b-57cd-bfd1-024288b48f00", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('0d49262d-894e-5d21-8c65-4c170e15c51e', 'PR05', 'Escritura · Unidad 8 · 2do', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 8)', '2026-11-12', array['P003']::text[], 'todo', 1, '[{"id": "1373e94a-9554-5ecb-8407-37475423a889", "text": "Unidad presentada en formato Word.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('0307dd0d-3b12-51c5-b77e-a3ab03ea4ac0', 'PR05', 'Escritura · Unidad 6 · 5to', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 6)', '2026-11-16', array['P003']::text[], 'todo', 0, '[{"id": "6eb8619b-7a6a-5fb3-94eb-a7ea2bad64dd", "text": "Unidad presentada en formato Word.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('2ee1c378-d6c4-59aa-ab87-6e956a4613b5', 'PR05', 'Edición · Unidad 8 · 2do', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 8)', '2026-11-16', array['P006']::text[], 'todo', 1, '[{"id": "5b62f6f3-ec38-51cc-bcdf-4b7bee3a838b", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('1c48e0b2-4fa5-504e-9e43-8891579fbf27', 'PR05', 'Edición · Unidad 6 · 5to', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 6)', '2026-11-18', array['P006']::text[], 'todo', 0, '[{"id": "281755e4-c771-549e-a2ff-2cfb6e8ef071", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0);
insert into stage_tareas values
('d20ec555-5604-546e-82ce-3e5d3e1c5498', 'PR05', 'Validación de la edición · Unidad 8 · 2do', 'Pablo verifica que el ajuste no rompió lo técnico.', '2026-11-18', array['P003','P006']::text[], 'todo', 1, '[{"id": "db3be09a-4733-523e-aea7-0c1105064796", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('407fd46b-94c3-5feb-b058-82a58f4839cf', 'PR05', 'Validación de la edición · Unidad 6 · 5to', 'Pablo verifica que el ajuste no rompió lo técnico.', '2026-11-20', array['P003','P006']::text[], 'todo', 0, '[{"id": "1f239f71-1dec-56d1-9e86-822c8526d951", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('9d11d878-5657-5c07-9307-2311cde99e97', 'PR05', 'Desarrollo guía docente', '(salió del proceso editorial el 16/08/2026)', '2026-11-20', array['P006']::text[], 'todo', 1, '[{"id": "7eb8f97b-2140-530c-b148-76ff16f33566", "text": "Versión corregida", "done": false}]'::jsonb, '[]'::jsonb, 0),
('16d7e4b0-cce3-585d-8700-93821502b425', 'PR05', 'Diseño de criterios de implementación', 'Elaborar estándares y lineamientos para asegurar criterios homogéneos de implementación y definir cómo completar el instrumento', '2026-11-24', array['P003','P006','P008']::text[], 'todo', 0, '[{"id": "a30f69cb-1c61-540b-825f-aebc5023f4ea", "text": "Documento de estándares: cómo se llena.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('7d66d2a0-fb12-5f8b-98f1-2572f54deab2', 'PR05', 'Validación interna', '(salió del proceso editorial el 16/08/2026)', '2026-11-24', array['P003','P006']::text[], 'todo', 1, '[{"id": "19ea2aa3-be32-51df-9944-51180222a1f8", "text": "Guía docente", "done": false}]'::jsonb, '[]'::jsonb, 0),
('b036d5fd-51a3-5629-ab1c-3df884fb07c3', 'PR05', 'Escritura · Unidad 7 · 5to', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 7)', '2026-11-24', array['P003']::text[], 'todo', 2, '[{"id": "cdd98542-9580-545f-a963-96bd7080c9ef", "text": "Unidad presentada en formato Word.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('9615c6b1-3d07-5516-8284-fb4492e0e423', 'PR05', 'Publicación versión Cohorte 2 (por sesión, por semana)', 'Organizar, cargar y publicar los materiales finales por sesión y semana, asegurando trazabilidad mediante planilla de registro y control de versiones.', '2026-11-25', array['P003']::text[], 'todo', 0, '[{"id": "acabe929-2bc3-539b-8213-bd06abb08d47", "text": "Material: PPTS, recursos: PDF, audivisual.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('7d3783c3-0cdd-5238-ab00-1a5fbb913016', 'PR05', 'Edición · Unidad 7 · 5to', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 7)', '2026-11-26', array['P006']::text[], 'todo', 0, '[{"id": "4dfa363b-02f3-566e-9f7d-597eb7530a4a", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('8af2799b-0b6e-5cb7-9a5e-4b739bef01b4', 'PR05', 'Diagramación · 2do', null, '2026-11-26', array['P006']::text[], 'todo', 1, '[{"id": "36c16f83-1a75-5ce7-8f50-defc539a3412", "text": "Acta aprobación", "done": false}]'::jsonb, '[]'::jsonb, 0),
('8d36046f-67c7-519f-b73b-d290f48d6493', 'PR05', 'Validación de la edición · Unidad 7 · 5to', 'Pablo verifica que el ajuste no rompió lo técnico.', '2026-11-30', array['P003','P006']::text[], 'todo', 0, '[{"id": "62d64da7-e0f6-5025-9376-ebafc4a680e7", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('a4839da6-2783-519e-8754-d4802b0aedfb', 'PR05', 'Presentación al MEC · 2do', null, '2026-11-30', array['P002']::text[], 'todo', 1, '[{"id": "88643815-01f3-51ef-bb78-3eadc115f739", "text": "Expediente MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('6a9136c4-a104-5844-beaa-0f03bdd9f10f', 'PR05', 'Confirmación de escuelas participantes', 'Contactar, confirmar participación y consolidar el listado definitivo de escuelas que integrarán la cohorte, verificando disponibilidad y condiciones de implementación.', '2026-12-01', array['P005']::text[], 'todo', 0, '[{"id": "0bb937c7-15cb-5fcc-8d82-f413d5b658fe", "text": "Base de escuelas", "done": false}]'::jsonb, '[]'::jsonb, 0),
('382a58c7-5640-571a-b9f8-f2be2b69a72e', 'PR05', 'Correcciones (sugerencias del MEC)', '(salió del proceso editorial el 16/08/2026)', '2026-12-02', array['P003','P006','P008']::text[], 'todo', 0, '[{"id": "ec4a23a0-6146-55ce-9847-3a6609329fc3", "text": "Versión corregida", "done": false}]'::jsonb, '[]'::jsonb, 0),
('ced7d0e4-4d12-58f0-a7a8-49dc1260d7f3', 'PR05', 'Escritura · Unidad 8 · 5to', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 8)', '2026-12-02', array['P003']::text[], 'todo', 1, '[{"id": "be6f3f17-2728-55c2-8e3e-f0a18ccf1099", "text": "Unidad presentada en formato Word.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('4061eb96-99a2-525c-a12f-996295436bdc', 'PR05', 'Actualización de base de docentes', 'Depurar, completar y actualizar la información de docentes participantes para asegurar consistencia con la matrícula y distribución institucional.', '2026-12-03', array['P005']::text[], 'todo', 0, '[{"id": "cbcd0bcb-891c-506c-976a-cdf376e699a8", "text": "Base consolidada", "done": false}]'::jsonb, '[]'::jsonb, 0),
('7f1041b2-f005-5590-ba4f-2fe2589bba45', 'PR05', 'Edición · Unidad 8 · 5to', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 8)', '2026-12-04', array['P006']::text[], 'todo', 0, '[{"id": "95977369-8e42-5852-b452-f67df4e59eb7", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('15ec4076-fe8a-55d7-87ee-641b3b4b7833', 'PR02', 'Liga · Final', 'Hito del proyecto.', '2026-12-05', array['P002']::text[], 'todo', 0, '[]'::jsonb, '[]'::jsonb, 5),
('4b6c7684-6f05-5774-9c2a-457c5cbad157', 'PR05', 'Calendarizar el Plan de Formación de Cohorte 2.', 'Organizar el recorrido formativo definiendo el orden de implementación, sesiones, duración, hitos y fechas de ejecución de cada módulo.', '2026-12-07', array['P002','P003','P008']::text[], 'todo', 0, '[{"id": "30d2905d-8e36-5d59-ad7a-5a3e57161a91", "text": "Ajustar secuencia, sesiones y fechas", "done": false}]'::jsonb, '[]'::jsonb, 0),
('513599ca-bf15-5872-90d7-2ff5444d1e08', 'PR05', 'Planificación logística', 'Coordinar requerimientos operativos para la ejecución de las capacitaciones: espacios, materiales, convocatorias, recursos técnicos y soporte.', '2026-12-09', array['P011']::text[], 'todo', 0, '[{"id": "6f6996b7-b0dc-5728-afd7-451bc8eae416", "text": "Plan logístico", "done": false}]'::jsonb, '[]'::jsonb, 0),
('ca42477d-b708-51ce-b56a-1aa6cde407ab', 'PR05', 'Validación de la edición · Unidad 8 · 5to', 'Pablo verifica que el ajuste no rompió lo técnico.', '2026-12-09', array['P003','P006']::text[], 'todo', 1, '[{"id": "d060be1a-8b5c-583d-94c7-3a645f493665", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('07addd9d-90fa-5a33-b625-c6028ec3f01e', 'PR05', 'Desarrollo guía docente', '(salió del proceso editorial el 16/08/2026)', '2026-12-11', array['P006']::text[], 'todo', 0, '[{"id": "b72d6f57-43a3-537e-b643-297ab4fab9a3", "text": "Versión corregida", "done": false}]'::jsonb, '[]'::jsonb, 0),
('54f854f8-7265-5b57-8d94-c3351617b7c0', 'PR05', 'Capacitación interna de facilitadores', 'Realizar sesiones internas para transferir lineamientos metodológicos, criterios de implementación, uso de materiales y protocolos de seguimiento.', '2026-12-11', array['P003','P005','P006','P008']::text[], 'todo', 1, '[{"id": "56d5efd5-b6d1-5318-937e-432445b5928b", "text": "Facilitadores habilitados", "done": false}]'::jsonb, '[]'::jsonb, 0),
('35f6d687-469f-526f-9750-0f32608926b6', 'PR05', 'Validación interna', '(salió del proceso editorial el 16/08/2026)', '2026-12-15', array['P003','P006']::text[], 'todo', 0, '[{"id": "0c6f4ea8-747e-5e28-8850-28e4ba16c91d", "text": "Guía docente", "done": false}]'::jsonb, '[]'::jsonb, 0),
('00b12c0e-490d-5964-913a-f1fcc06d3f28', 'PR05', 'Configuración de sistemas de seguimiento', 'Configurar tableros, formularios y mecanismos de monitoreo para registrar asistencia, avance académico, entregas y alertas durante la implementación.', '2026-12-16', array['P006','P008']::text[], 'todo', 0, '[{"id": "2d57b7ef-44ee-514c-9240-251dc4e158fa", "text": "Dashboard operativo", "done": false}]'::jsonb, '[]'::jsonb, 0),
('ec9daf83-3fc5-56be-b3a8-b88c11460557', 'PR05', 'Diagramación · 5to', null, '2026-12-17', array['P006']::text[], 'todo', 0, '[{"id": "0b41f2d6-1400-592e-a364-a05d4d087072", "text": "Acta aprobación", "done": false}]'::jsonb, '[]'::jsonb, 0),
('81b3630d-a3a5-5385-bc3f-62ef7614b88a', 'PR05', 'Presentación al MEC · 5to', null, '2026-12-21', array['P002']::text[], 'todo', 0, '[{"id": "7c622ff3-6ca7-546b-8edb-7708848109c4", "text": "Expediente MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('3f93196a-d140-57d7-86d7-96dbb073ae15', 'PR05', 'Jornada de lanzamiento', 'Realizar la apertura oficial de la cohorte, presentar objetivos, cronograma, metodología de trabajo y lineamientos para participantes y facilitadores.', '2026-12-22', array['P003','P005','P008']::text[], 'todo', 0, '[{"id": "58ac11e1-f228-54cb-b43f-72e86d21de33", "text": "Acta de lanzamiento", "done": false}]'::jsonb, '[]'::jsonb, 0),
('00b3b25a-d5f5-5e44-b6a3-aa8de895b2fa', 'PR05', 'Diseño de rúbrica de observación de clases', 'Diseñar criterios observables, niveles de desempeño y evidencias esperadas para observación en aula', '2026-12-23', array['P006','P008']::text[], 'todo', 0, '[{"id": "eaf43244-6e56-5d35-9671-a6fd8047cfcb", "text": "Rúbrica validada", "done": false}]'::jsonb, '[]'::jsonb, 0),
('7fc2822a-a622-5cb0-b231-4c8a18b4a150', 'PR05', 'Correcciones (sugerencias del MEC)', '(salió del proceso editorial el 16/08/2026)', '2026-12-23', array['P003','P006','P008']::text[], 'todo', 1, '[{"id": "9d5e89d7-e836-5b59-900c-0e6255d6d7c5", "text": "Versión corregida", "done": false}]'::jsonb, '[]'::jsonb, 0),
('cdade65a-4905-5c71-a1eb-7c597e8d813f', 'PR05', 'Módulo 1 + Inicio de Módulo 2. Presencial', 'Implementar sesiones presenciales previstas, desarrollar actividades, acompañar participación y registrar asistencia y observaciones operativas.', '2027-01-07', array['P003','P005','P008']::text[], 'todo', 0, '[{"id": "969d3a3c-bf45-5ec1-9d33-00194ae6cbe4", "text": "Capacitación ejecutada", "done": false}]'::jsonb, '[]'::jsonb, 0),
('3fffeaec-e044-533b-96e2-a566b9ee798e', 'PR05', 'Escritura · Unidad 1 · 3ro', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 1)', '2027-01-11', array['P003']::text[], 'todo', 0, '[{"id": "f5ff1935-2a99-5649-aced-d7c6e6f6767c", "text": "Borrador consolidado", "done": false}]'::jsonb, '[]'::jsonb, 0),
('ca587789-1d36-5ec9-9d1b-57313653ee17', 'PR05', 'Edición · Unidad 1 · 3ro', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 1)', '2027-01-14', array['P006']::text[], 'todo', 0, '[{"id": "70d65e3e-5219-57a3-9f4a-8be9df34fda2", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('974638ec-260f-52c0-99d0-ab7372922605', 'PR05', 'Validación de la edición · Unidad 1 · 3ro', 'Pablo verifica que el ajuste no rompió lo técnico.', '2027-01-19', array['P003','P006']::text[], 'todo', 0, '[{"id": "4afb5e06-2fd8-559e-8e55-9e71aab5c3a8", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('fc4274e8-c0a7-5d14-888a-cb4861576282', 'PR05', 'Seguimiento Módulo 1 + Inicio de Módulo 2', 'Monitorear asistencia, participación, entregas y desempeño académico para identificar necesidades de acompañamiento y ajustes.', '2027-01-21', array['P006','P008']::text[], 'todo', 0, '[{"id": "dca23643-5949-5f9f-8a2b-4c6329507d9c", "text": "Informe académico", "done": false}]'::jsonb, '[]'::jsonb, 0),
('9883f1f4-5a77-5c0b-a8d8-3ee3cd2e0439', 'PR05', 'Escritura · Unidad 2 · 3ro', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 2)', '2027-01-22', array['P003']::text[], 'todo', 0, '[{"id": "b9e00dd3-6b70-521e-b4ef-0c195cfadd2b", "text": "Unidad presentada en formato Word.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('e89bb51a-f137-566a-a9b1-11d526d14043', 'PR05', 'Diseño de protocolo de visitas', 'Definir objetivos, momentos, instrumentos y procedimiento para visitas de seguimiento', '2027-01-22', array['P006','P008']::text[], 'todo', 1, '[{"id": "d618453b-7b34-575d-a9e3-ce633140cb1f", "text": "Protocolo aprobado", "done": false}]'::jsonb, '[]'::jsonb, 0),
('7db918db-f522-51c6-8233-1fafb5c97d7b', 'PR05', 'Módulo 2. Sesiones virtuales.', 'Facilitar sesiones virtuales, monitorear participación, resolver consultas y registrar evidencias de implementación.', '2027-01-25', array['P003','P005','P008']::text[], 'todo', 0, '[{"id": "573a514e-9790-5456-8448-b8c674a0ec8f", "text": "Capacitación ejecutada", "done": false}]'::jsonb, '[]'::jsonb, 0),
('0512c2b7-5155-5c6b-b327-b4ac5abba9dc', 'PR05', 'Edición · Unidad 2 · 3ro', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 2)', '2027-01-27', array['P006']::text[], 'todo', 0, '[{"id": "4330d53f-75c4-5567-9b19-55fecf04141b", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('e4a0477f-b8d4-5d9d-9220-ad211c7a0459', 'PR05', 'Validación de la edición · Unidad 2 · 3ro', 'Pablo verifica que el ajuste no rompió lo técnico.', '2027-02-01', array['P003','P006']::text[], 'todo', 0, '[{"id": "aa11b659-d557-5f32-af5a-34cbbca70f57", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('5c66e18a-c155-58e6-8a0e-1eec0f92d12d', 'PR05', 'Escritura · Unidad 3 · 3ro', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 3)', '2027-02-04', array['P003']::text[], 'todo', 0, '[{"id": "a988abb1-cfe9-58a5-83b6-00e827e0b418", "text": "Unidad presentada en formato Word.", "done": false}]'::jsonb, '[]'::jsonb, 0);
insert into stage_tareas values
('fb4015d7-25d6-5695-b3d7-4d02d063d7ae', 'PR05', 'Módulo 2. Sesión presencial de cierre', 'Ejecutar actividades presenciales previstas y consolidar evidencias de participación y aprendizaje.', '2027-02-08', array['P003','P005','P008']::text[], 'todo', 0, '[{"id": "caa339c8-f5dd-5bc2-b1c1-162de6074137", "text": "Capacitación ejecutada", "done": false}]'::jsonb, '[]'::jsonb, 0),
('3943f004-4817-528e-992f-597f799aaacc', 'PR05', 'Edición · Unidad 3 · 3ro', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 3)', '2027-02-09', array['P006']::text[], 'todo', 0, '[{"id": "da729399-92a8-5032-91f7-bfb9eb527e42", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('ed8a81bc-5e9f-5179-8d52-716bfb226b0b', 'PR05', 'Validación de la edición · Unidad 3 · 3ro', 'Pablo verifica que el ajuste no rompió lo técnico.', '2027-02-12', array['P003','P006']::text[], 'todo', 0, '[{"id": "9866ca83-fc3f-555d-8bfe-13f29147a8a4", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('b5f367cf-3265-56ac-9d2c-a85f3ce95b27', 'PR05', 'Diseño de sistema de alertas tempranas', 'Definir indicadores críticos, umbrales, responsables, frecuencia de monitoreo y acciones de respuesta', '2027-02-15', array['P006','P008']::text[], 'todo', 0, '[{"id": "b6c29d68-9535-5731-a830-fc7487037a06", "text": "Sistema de alertas", "done": false}]'::jsonb, '[]'::jsonb, 0),
('a5068b54-a48b-563e-84dc-3bbcb22b3c5e', 'PR05', 'Escritura · Unidad 4 · 3ro', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 4)', '2027-02-17', array['P003']::text[], 'todo', 0, '[{"id": "35c83a64-460d-5328-880f-9c3f8d0d1841", "text": "Unidad presentada en formato Word.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('9676290d-164d-5f33-8158-17acfdca836e', 'PR05', 'Seguimiento Módulo 2', 'Revisar avance académico y nivel de implementación para identificar alertas y oportunidades de mejora.', '2027-02-22', array['P006','P008']::text[], 'todo', 0, '[{"id": "a09bc281-9799-5103-a962-3fe85b74b62d", "text": "Informe académico", "done": false}]'::jsonb, '[]'::jsonb, 0),
('ac538200-a726-58d8-bec3-1f343faf2c95', 'PR05', 'Edición · Unidad 4 · 3ro', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 4)', '2027-02-22', array['P006']::text[], 'todo', 1, '[{"id": "32cf342a-0294-56cb-8439-de8e97ea145f", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('dc61b80d-0529-536b-9be5-4ec54b464531', 'PR05', 'Módulo 3. Sesión presencial.', 'Desarrollar actividades presenciales, registrar resultados y acompañar el cumplimiento del recorrido formativo.', '2027-02-24', array['P003','P005','P008']::text[], 'todo', 0, '[{"id": "6bec6f8b-224a-502a-b0a5-2ebe506b3041", "text": "Capacitación ejecutada", "done": false}]'::jsonb, '[]'::jsonb, 0),
('26658244-158b-536e-a7ea-35e3197376c1', 'PR05', 'Validación de la edición · Unidad 4 · 3ro', 'Pablo verifica que el ajuste no rompió lo técnico.', '2027-02-25', array['P003','P006']::text[], 'todo', 0, '[{"id": "b7d9e16f-e21a-5918-ba96-0eb6a1d57ab6", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('fd6b4734-ed83-5d75-b3ec-66463a132b81', 'PR05', 'Escritura · Unidad 5 · 3ro', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 5)', '2027-03-03', array['P003']::text[], 'todo', 0, '[{"id": "5217a9fd-e382-5d41-89fa-d5fd6aab602f", "text": "Unidad presentada en formato Word.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('1f53f4b7-abf0-5e12-ad8c-063ee4c8210a', 'PR05', 'Edición · Unidad 5 · 3ro', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 5)', '2027-03-08', array['P006']::text[], 'todo', 0, '[{"id": "b6ea4834-cad8-59db-b5ea-0c0f4a34cb16", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('83b316f2-b515-5136-82f3-0dd9d28efe11', 'PR05', 'Escritura · Unidad 1 · 6to', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 1)', '2027-03-08', array['P003']::text[], 'todo', 1, '[{"id": "4cfeee10-70a5-55fa-ac27-2e39322b4c68", "text": "Borrador consolidado", "done": false}]'::jsonb, '[]'::jsonb, 0),
('6b9f9c40-8abe-5368-8c89-1e991f2ae9b1', 'PR05', 'Módulo 3. Sesiones virtuales.', 'Facilitar espacios virtuales, realizar seguimiento de participación y consolidar evidencias académicas.', '2027-03-11', array['P003','P005','P008']::text[], 'todo', 0, '[{"id": "8810e1f5-0fd1-5de2-9e71-b83c8caab0e6", "text": "Capacitación ejecutada", "done": false}]'::jsonb, '[]'::jsonb, 0),
('bce8ef61-3d6a-51b3-a948-34c512d54158', 'PR05', 'Edición · Unidad 1 · 6to', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 1)', '2027-03-11', array['P006']::text[], 'todo', 1, '[{"id": "f8e10dbf-adf5-5b5f-af07-e3ca4fcae2c5", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('cc7c7648-45df-568e-88a7-7555a978caa7', 'PR05', 'Validación de la edición · Unidad 5 · 3ro', 'Pablo verifica que el ajuste no rompió lo técnico.', '2027-03-11', array['P003','P006']::text[], 'todo', 2, '[{"id": "199d9f7e-f984-5561-af46-be1713ddf659", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('508acd5f-9de3-56e0-8342-2daf5c2eda03', 'PR05', 'Módulo 3. Sesión presencial de cierre', 'Ejecutar cierre presencial del módulo y consolidar avances de aprendizaje alcanzados.', '2027-03-15', array['P003','P005','P008']::text[], 'todo', 0, '[{"id": "9318dca5-f296-5fdc-8621-bc773399d4d2", "text": "Capacitación ejecutada", "done": false}]'::jsonb, '[]'::jsonb, 0),
('26bcf85f-12a0-54cf-b128-170d024104ce', 'PR05', 'Validación de la edición · Unidad 1 · 6to', 'Pablo verifica que el ajuste no rompió lo técnico.', '2027-03-16', array['P003','P006']::text[], 'todo', 0, '[{"id": "35f67487-3631-5994-9558-6bc3d95e41f6", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('ecb770a8-9d77-5ba3-9bb2-13e96c3e7b28', 'PR05', 'Escritura · Unidad 6 · 3ro', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 6)', '2027-03-16', array['P003']::text[], 'todo', 1, '[{"id": "7cc9d2da-d66b-5616-9efe-2a6cd5f2611d", "text": "Unidad presentada en formato Word.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('1a4d689f-e9e4-562b-ab67-86a603758270', 'PR05', 'Escritura · Unidad 2 · 6to', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 2)', '2027-03-19', array['P003']::text[], 'todo', 0, '[{"id": "0985de32-d76b-530c-971a-da7b0416fcb4", "text": "Unidad presentada en formato Word.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('dce45384-93d3-5203-a9f8-9efeb19341bb', 'PR05', 'Edición · Unidad 6 · 3ro', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 6)', '2027-03-19', array['P006']::text[], 'todo', 1, '[{"id": "c820d6c6-9665-53b9-927c-880cbfafad39", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('440a2f0f-86da-5598-91a7-81fdccaf2605', 'PR05', 'Validación de la edición · Unidad 6 · 3ro', 'Pablo verifica que el ajuste no rompió lo técnico.', '2027-03-24', array['P003','P006']::text[], 'todo', 0, '[{"id": "e00ebf95-f74d-5a03-b091-a8508ce4557f", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('50306219-934a-5052-9d05-2ee352ea6e72', 'PR05', 'Edición · Unidad 2 · 6to', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 2)', '2027-03-24', array['P006']::text[], 'todo', 1, '[{"id": "e4a0ae94-fe55-51c8-8646-248201a59b7b", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('8cc9c34e-9adc-50dd-b49b-223103eb6d58', 'PR05', 'Capacitación del equipo de soporte en terreno', 'Preparación y desarrollo de capacitación interna para uso de instrumentos y criterios de seguimiento. Incluye 4 horas cátedra + preparación', '2027-03-29', array['P006','P008']::text[], 'todo', 0, '[{"id": "31720c20-c6ce-50e8-9d97-0ccf832797c6", "text": "Equipo capacitado", "done": false}]'::jsonb, '[]'::jsonb, 0),
('71dfb793-ae5f-5e96-acc1-7f37137df4d1', 'PR05', 'Escritura · Unidad 7 · 3ro', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 7)', '2027-03-31', array['P003']::text[], 'todo', 0, '[{"id": "d9954fcb-c5fa-5166-badc-8ac40de6379d", "text": "Unidad presentada en formato Word.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('9922a019-9530-5e4e-86ec-a0ea61a5101a', 'PR05', 'Validación de la edición · Unidad 2 · 6to', 'Pablo verifica que el ajuste no rompió lo técnico.', '2027-03-31', array['P003','P006']::text[], 'todo', 1, '[{"id": "28f55f55-c9e0-56f2-b1eb-89c51bd99160", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('a593c4ca-d11e-521f-82f4-262ddb2be222', 'PR05', 'Seguimiento Módulo 3', 'Analizar resultados del módulo y definir acciones de acompañamiento cuando corresponda.', '2027-03-31', array['P006','P008']::text[], 'todo', 2, '[{"id": "df43d31e-81cc-537a-bfe7-6eddbc772b91", "text": "Informe académico", "done": false}]'::jsonb, '[]'::jsonb, 0),
('9ada7d67-0039-5a70-a7e2-2b2d29f30177', 'PR05', 'Módulo 4. Sesión presencial.', 'Implementar la sesión presencial asegurando cumplimiento metodológico y registro de evidencias.', '2027-04-02', array['P003','P005','P008']::text[], 'todo', 0, '[{"id": "07243105-5f97-5a14-8a74-7a097910b4ee", "text": "Capacitación ejecutada", "done": false}]'::jsonb, '[]'::jsonb, 0),
('acb27a0b-65ee-5767-91e4-d6c838edbdc8', 'PR05', 'Edición · Unidad 7 · 3ro', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 7)', '2027-04-05', array['P006']::text[], 'todo', 0, '[{"id": "bf1a5019-df62-51e1-85d8-a4ecf637d638", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('e7592aba-91b9-5556-accf-b8001e879b42', 'PR05', 'Escritura · Unidad 3 · 6to', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 3)', '2027-04-05', array['P003']::text[], 'todo', 1, '[{"id": "d8189dfd-8b02-5386-b9f0-efc0becafbee", "text": "Unidad presentada en formato Word.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('976ff9b0-4c0a-591c-898f-e8250961b31e', 'PR05', 'Validación de la edición · Unidad 7 · 3ro', 'Pablo verifica que el ajuste no rompió lo técnico.', '2027-04-08', array['P003','P006']::text[], 'todo', 0, '[{"id": "4e2b7bf2-8fb5-5c69-a778-eb2d54c118be", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('ebd09923-122e-5447-9e3e-e01034b4f64e', 'PR05', 'Edición · Unidad 3 · 6to', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 3)', '2027-04-08', array['P006']::text[], 'todo', 1, '[{"id": "d83d3841-9dbb-52a9-8586-388ec7318b25", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('5ded0b9c-2f39-5553-aadf-ce0000aa879d', 'PR05', 'Aplicación piloto de instrumentos', 'Aplicación inicial de instrumentos en una muestra de escuelas o procesos para verificar funcionamiento y registrar incidencias', '2027-04-12', array['P005']::text[], 'todo', 0, '[{"id": "6204fc08-0f81-5ac4-9f60-92cebd81697f", "text": "Instrumentos testeados", "done": false}]'::jsonb, '[]'::jsonb, 0),
('45c662ca-18ec-571e-bad8-97d8bf4850a1', 'PR05', 'Validación de la edición · Unidad 3 · 6to', 'Pablo verifica que el ajuste no rompió lo técnico.', '2027-04-13', array['P003','P006']::text[], 'todo', 0, '[{"id": "bec7a610-8b11-5990-ba1e-d5187086282c", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('524c46b0-4908-51e8-850b-106ea5852a1b', 'PR05', 'Escritura · Unidad 8 · 3ro', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 8)', '2027-04-13', array['P003']::text[], 'todo', 1, '[{"id": "525125ba-fdf3-5f80-8ac5-4473cf1969e1", "text": "Unidad presentada en formato Word.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('3f464fca-a2c1-55ff-b08b-1cf99f2d1672', 'PR05', 'Módulo 4. Sesiones virtuales.', 'Ejecutar sesiones virtuales y acompañar el avance académico de participantes.', '2027-04-16', array['P003','P005','P008']::text[], 'todo', 0, '[{"id": "ccbfcec1-c789-5a0c-9afe-c7bdf5d7f073", "text": "Capacitación ejecutada", "done": false}]'::jsonb, '[]'::jsonb, 0),
('4d4250e5-25f5-51ed-a232-8fab9c0abe76', 'PR05', 'Edición · Unidad 8 · 3ro', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 8)', '2027-04-16', array['P006']::text[], 'todo', 1, '[{"id": "22e49635-58d7-51b9-acce-73d2d7d16e5e", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('c014b850-52ca-51a4-94b5-39d21d434a64', 'PR05', 'Escritura · Unidad 4 · 6to', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 4)', '2027-04-16', array['P003']::text[], 'todo', 2, '[{"id": "09a5e211-1f75-5271-8486-b3f3f51e89d6", "text": "Unidad presentada en formato Word.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('736d7dcd-baae-50b5-81af-9ba4c7684008', 'PR05', 'Modulo 4. Sesión presencial de cierre', 'Ejecutar cierre presencial del módulo y consolidar avances de aprendizaje alcanzados.', '2027-04-20', array['P006','P008']::text[], 'todo', 0, '[]'::jsonb, '[]'::jsonb, 0),
('85bd0451-1455-54f2-89cc-ed342d20f47b', 'PR05', 'Edición · Unidad 4 · 6to', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 4)', '2027-04-21', array['P006']::text[], 'todo', 0, '[{"id": "92782a63-d23d-5645-b59d-7adf37a21130", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('cc6359e4-3945-567d-9a96-aecc71cd93f5', 'PR05', 'Validación de la edición · Unidad 8 · 3ro', 'Pablo verifica que el ajuste no rompió lo técnico.', '2027-04-21', array['P003','P006']::text[], 'todo', 1, '[{"id": "d29752f5-2ef2-55c9-bc58-74e7c9f3944b", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0);
insert into stage_tareas values
('1aa04429-eb8c-5c38-b1ae-7b1953e9951b', 'PR05', 'Desarrollo guía docente', '(salió del proceso editorial el 16/08/2026)', '2027-04-26', array['P006']::text[], 'todo', 0, '[{"id": "b188f23b-abba-559a-87a7-96dacbc57a46", "text": "Versión corregida", "done": false}]'::jsonb, '[]'::jsonb, 0),
('41eb7748-0025-54ab-9c27-f0ce6e4318a2', 'PR05', 'Validación de la edición · Unidad 4 · 6to', 'Pablo verifica que el ajuste no rompió lo técnico.', '2027-04-26', array['P003','P006']::text[], 'todo', 1, '[{"id": "7a2304a6-ebd6-5b08-88dd-1fee0dffbfeb", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('24f1f942-51ce-5220-8ffc-f8d1f60479de', 'PR05', 'Validación interna', '(salió del proceso editorial el 16/08/2026)', '2027-04-29', array['P003','P006']::text[], 'todo', 0, '[{"id": "56b298f6-7b62-5d02-8edb-099a91d49d43", "text": "Guía docente", "done": false}]'::jsonb, '[]'::jsonb, 0),
('cdb9c0ff-a027-5dde-ad3f-d46412dc7feb', 'PR05', 'Escritura · Unidad 5 · 6to', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 5)', '2027-04-29', array['P003']::text[], 'todo', 1, '[{"id": "d956004b-b520-5d54-97f8-6087af462052", "text": "Unidad presentada en formato Word.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('276427ab-11fa-5993-a0f3-fa575b096dc7', 'PR05', 'Seguimiento Módulo 4', 'Consolidar información de desempeño y realizar seguimiento académico del módulo.', '2027-05-04', array['P006','P008']::text[], 'todo', 0, '[{"id": "3bebd93b-45af-5b9f-a76e-4738b9225b43", "text": "Informe académico", "done": false}]'::jsonb, '[]'::jsonb, 0),
('ace9c821-ae09-56d5-9c76-377edf6fda72', 'PR05', 'Diagramación · 3ro', null, '2027-05-04', array['P006']::text[], 'todo', 1, '[{"id": "791e788e-f1ec-5ed9-a278-4f56b8981276", "text": "Acta aprobación", "done": false}]'::jsonb, '[]'::jsonb, 0),
('c5befb1d-8c8f-5d3f-9c45-ca5a32617a19', 'PR05', 'Edición · Unidad 5 · 6to', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 5)', '2027-05-04', array['P006']::text[], 'todo', 2, '[{"id": "2ade9fa5-41e6-5ae7-93b5-63f34dc8c6f9", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('feac462a-6356-59a7-b4df-27c80e95a2bb', 'PR05', 'Validación de indicadores', 'Revisión y ajuste de formularios e indicadores cada 2 meses según resultados del piloto y consistencia de datos', '2027-05-04', array['P008']::text[], 'todo', 3, '[{"id": "6d568f18-0781-5c02-903e-0301070f98ed", "text": "Informe de validación", "done": false}]'::jsonb, '[]'::jsonb, 0),
('aaec1a50-6c6e-576c-b895-d566d92cd90b', 'PR05', 'Módulo 5. Sesión presencial.', 'Ejecutar actividades de cierre del recorrido formativo y consolidar evidencias finales de participación.', '2027-05-06', array['P003','P005','P008']::text[], 'todo', 0, '[{"id": "99565c5d-5b21-5a68-8240-f3d69b7bec2f", "text": "Capacitación ejecutada", "done": false}]'::jsonb, '[]'::jsonb, 0),
('5e299690-adf3-5b61-8975-215aa3715720', 'PR05', 'Validación de la edición · Unidad 5 · 6to', 'Pablo verifica que el ajuste no rompió lo técnico.', '2027-05-07', array['P003','P006']::text[], 'todo', 0, '[{"id": "f667d8a6-11af-5bef-9355-afdf2fb851d6", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('b9d9e512-57dc-5eea-9f0e-2c8178f9c201', 'PR05', 'Presentación al MEC · 3ro', null, '2027-05-07', array['P002']::text[], 'todo', 1, '[{"id": "414f53ec-fe90-5deb-9d0c-be5867a76051", "text": "Expediente MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('c59d8d4c-0cbf-5435-b87a-51ef747505f4', 'PR05', 'Escritura · Unidad 6 · 6to', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 6)', '2027-05-12', array['P003']::text[], 'todo', 0, '[{"id": "9e267c43-e119-5658-895b-eb0225666715", "text": "Unidad presentada en formato Word.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('da6d3b84-e4b0-568f-9bd9-0608e84cf094', 'PR05', 'Correcciones (sugerencias del MEC)', '(salió del proceso editorial el 16/08/2026)', '2027-05-12', array['P003','P006','P008']::text[], 'todo', 1, '[{"id": "ca83f675-6d44-5028-b39f-cb8907d5ab80", "text": "Versión corregida", "done": false}]'::jsonb, '[]'::jsonb, 0),
('ed684ed8-47d8-53c8-a4af-8a041f4c136c', 'PR05', 'Edición · Unidad 6 · 6to', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 6)', '2027-05-18', array['P006']::text[], 'todo', 0, '[{"id": "843ee01f-513a-5c2f-b6a0-aa8be29f349b", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('4c342014-9e47-5e20-b98f-7e761f4d88aa', 'PR05', 'Validación de la edición · Unidad 6 · 6to', 'Pablo verifica que el ajuste no rompió lo técnico.', '2027-05-21', array['P003','P006']::text[], 'todo', 0, '[{"id": "db39042a-0fc8-54f0-8109-818b8bfa5574", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('87ef60c9-59e8-537f-8977-ac100b8b48be', 'PR05', 'Seguimiento Módulo 5', 'Verificar cierre académico del módulo, consolidar hallazgos y generar recomendaciones para el cierre de cohorte.', '2027-05-21', array['P006','P008']::text[], 'todo', 1, '[{"id": "d360512d-cc49-50fe-9b9f-15aead8cf516", "text": "Informe académico", "done": false}]'::jsonb, '[]'::jsonb, 0),
('1e467230-b6fa-5ba4-a875-9b42e11520e1', 'PR05', 'Consolidación de asistencia de participantes', 'Consolidar registros de participación y asistencia provenientes de todos los espacios formativos para generar la base final de seguimiento.', '2027-05-25', array['P005','P008']::text[], 'todo', 0, '[{"id": "35005202-98d1-50fb-9afc-3b2414b0d4c6", "text": "Base consolidada de asistencia", "done": false}]'::jsonb, '[]'::jsonb, 0),
('33d3ae39-1829-5ce9-b6bf-ecdfb10d2717', 'PR05', 'Escritura · Unidad 7 · 6to', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 7)', '2027-05-26', array['P003']::text[], 'todo', 0, '[{"id": "3e76ecfb-ff45-53d1-b8bd-ac58a2d9db32", "text": "Unidad presentada en formato Word.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('4e6aa8f6-fac6-5b08-9bd6-0db7f56aef14', 'PR05', 'Consolidación de entregas y tareas', 'Organizar entregas realizadas por participantes y actualizar el estado de cumplimiento por módulo y actividad.', '2027-05-27', array['P005','P008']::text[], 'todo', 0, '[{"id": "3bc40115-a2a3-54c0-a3fa-795fa785ced9", "text": "Matriz de entregables", "done": false}]'::jsonb, '[]'::jsonb, 0),
('b9bdd9b0-30fb-5167-87cf-74e93a62db43', 'PR05', 'Edición · Unidad 7 · 6to', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 7)', '2027-05-31', array['P006']::text[], 'todo', 0, '[{"id": "99f7076a-fa81-5456-a625-53af008e9a77", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('f07854cf-c773-5e3f-9194-1d07f096d570', 'PR05', 'Cruce asistencia + tareas', 'Integrar asistencia, entregas y desempeño académico para construir una base única de validación.', '2027-06-01', array['P002','P005','P008']::text[], 'todo', 0, '[{"id": "40068075-0132-588d-b067-1e1741c8d476", "text": "Base única de seguimiento", "done": false}]'::jsonb, '[]'::jsonb, 0),
('57ee6101-90a2-5a38-8936-357e343373be', 'PR05', 'Ajuste del sistema', 'Incorporación de hallazgos del piloto, ajustes metodológicos y consolidación de versión operativa final', '2027-06-02', array['P006']::text[], 'todo', 0, '[{"id": "4f34b011-6727-5d36-be08-f96c0d435717", "text": "Versión final del sistema", "done": false}]'::jsonb, '[]'::jsonb, 0),
('7a80777e-d093-5213-9109-ea2460fd2552', 'PR05', 'Identificación de docentes con pendientes', 'Identificar participantes con requisitos incompletos y generar reportes para seguimiento y regularización.', '2027-06-03', array['P003','P008']::text[], 'todo', 0, '[{"id": "10d77a9d-6c8e-56d5-a071-c0f58a99eebe", "text": "Reporte de observaciones", "done": false}]'::jsonb, '[]'::jsonb, 0),
('c2fecfb9-753d-53d1-9af9-349e75140469', 'PR05', 'Validación de la edición · Unidad 7 · 6to', 'Pablo verifica que el ajuste no rompió lo técnico.', '2027-06-03', array['P003','P006']::text[], 'todo', 1, '[{"id": "47e61c72-0e0d-5101-8a4e-464fbe9a1c72", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('8abebd99-6159-5920-a9e7-36491c896cad', 'PR05', 'Corrección de tareas pendientes', 'Revisar tareas pendientes, validar evidencias entregadas y actualizar registros académicos correspondientes.', '2027-06-07', array['P003','P005']::text[], 'todo', 0, '[{"id": "99512935-c70b-5c82-9408-4e0759e0bfa4", "text": "Tareas corregidas", "done": false}]'::jsonb, '[]'::jsonb, 0),
('d41a49c0-f299-5e8a-a856-71d0ab947414', 'PR05', 'Escritura · Unidad 8 · 6to', '(antes: Desarrollo: contenido técnico y pedagógico Módulo 8)', '2027-06-08', array['P003']::text[], 'todo', 0, '[{"id": "646aeaa4-1c16-546a-bbfe-886b51c87d2f", "text": "Unidad presentada en formato Word.", "done": false}]'::jsonb, '[]'::jsonb, 0),
('e6827112-b01a-5f49-a8d7-c3d3bc1d25ce', 'PR05', 'Edición · Unidad 8 · 6to', 'Luciana adapta el contenido al nivel del grado.
(antes: Edición. Módulo 8)', '2027-06-11', array['P006']::text[], 'todo', 0, '[{"id": "7589832d-2c01-5c98-afb0-d1ccfce45bc0", "text": "Ajustes a la propuesta", "done": false}]'::jsonb, '[]'::jsonb, 0),
('143fce77-430b-5e7b-a76e-4e647eba9a3c', 'PR05', 'Validación de la edición · Unidad 8 · 6to', 'Pablo verifica que el ajuste no rompió lo técnico.', '2027-06-16', array['P003','P006']::text[], 'todo', 0, '[{"id": "343d003c-291e-5552-a7ce-99cb3cbf719c", "text": "Material validado, listo para aprobación del MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('64c48d1c-72d0-55c8-aab3-501f4aaf462d', 'PR05', 'Recepción de tareas de regularización', 'Recibir, organizar y verificar evidencias enviadas por participantes dentro del período de regularización.', '2027-06-16', array['P008']::text[], 'todo', 1, '[{"id": "c736dc4b-7364-58e6-80bf-9f9d521c666c", "text": "Evidencias actualizadas", "done": false}]'::jsonb, '[]'::jsonb, 0),
('ac3e85a5-ca96-5393-bb91-0b3cecdaec69', 'PR05', 'Seguimiento a docentes con pendientes', 'Realizar contacto y monitoreo de docentes pendientes para promover el cierre de requisitos académicos.', '2027-06-18', array['P005']::text[], 'todo', 0, '[{"id": "334e40ee-61f9-5412-aadb-525700cf866c", "text": "Registro de seguimiento", "done": false}]'::jsonb, '[]'::jsonb, 0),
('3fa70ff1-1010-52b5-8aa2-ffb45365d4b9', 'PR05', 'Desarrollo guía docente', '(salió del proceso editorial el 16/08/2026)', '2027-06-21', array['P006']::text[], 'todo', 0, '[{"id": "693994de-ff40-56c4-9419-14618f689c0f", "text": "Versión corregida", "done": false}]'::jsonb, '[]'::jsonb, 0),
('60978200-449a-5a75-9c4d-b40dbad4bb75', 'PR05', 'Carga de puntajes finales', 'Consolidar resultados finales y actualizar planillas oficiales de calificaciones.', '2027-06-22', array['P005','P008']::text[], 'todo', 0, '[{"id": "c291da23-6829-5a17-aee9-a282ac4bb6bc", "text": "Base consolidada", "done": false}]'::jsonb, '[]'::jsonb, 0),
('348860be-a276-5a44-8ec7-1708def6be68', 'PR05', 'Validación interna', '(salió del proceso editorial el 16/08/2026)', '2027-06-24', array['P003','P006']::text[], 'todo', 0, '[{"id": "8a5f293d-dd0f-5b6a-bdf4-e1ef8f4f52a8", "text": "Guía docente", "done": false}]'::jsonb, '[]'::jsonb, 0),
('f35ba4ce-a6e5-52a3-a39f-83eec9f4e479', 'PR05', 'Validación de cumplimiento de requisitos', 'Verificar cumplimiento de criterios de certificación considerando asistencia, entregas, evaluaciones y puntajes finales.', '2027-06-24', array['P003','P006','P008']::text[], 'todo', 1, '[{"id": "0c6c5c40-2260-58b0-83fb-252593f98618", "text": "Informe de cumplimiento", "done": false}]'::jsonb, '[]'::jsonb, 0),
('a1aba8cc-85a8-5942-8ed5-9961255cb6fb', 'PR05', 'Diagramación · 6to', null, '2027-06-29', array['P006']::text[], 'todo', 0, '[{"id": "0b595b89-3066-5446-8b4e-af8d1fb671fa", "text": "Acta aprobación", "done": false}]'::jsonb, '[]'::jsonb, 0),
('9aac7d8d-6255-57a0-aabf-42954d8571c9', 'PR05', 'Elaboración de nómina certificable', 'Consolidar listado final de participantes habilitados para certificación conforme a criterios establecidos.', '2027-06-30', array['P002','P003','P008']::text[], 'todo', 0, '[{"id": "0e311f69-2b42-5e5a-834b-0e132117785c", "text": "Nómina oficial", "done": false}]'::jsonb, '[]'::jsonb, 0),
('2eff4ce1-e607-50ef-9611-9d718f422b6b', 'PR05', 'Revisión administrativa de nómina', 'Revisar consistencia administrativa de la nómina y gestionar validaciones institucionales correspondientes.', '2027-07-01', array['P002']::text[], 'todo', 0, '[{"id": "ca515a31-b3d2-55f8-bbfe-fbfdb0b471a0", "text": "Nómina validada", "done": false}]'::jsonb, '[]'::jsonb, 0),
('299df32d-45b8-54a7-a7ae-819cffd387ce', 'PR05', 'Presentación al MEC · 6to', null, '2027-07-02', array['P002']::text[], 'todo', 0, '[{"id": "49ad5276-d24e-5c7a-b265-f3f5f1778b4f", "text": "Expediente MEC", "done": false}]'::jsonb, '[]'::jsonb, 0),
('88e4ec9e-4aa6-51ae-ab8e-7bba701649ed', 'PR05', 'Presentación de documentación para certificación', 'Reuniry presentar documentación requerida para el proceso formal de certificación.', '2027-07-02', array['P002']::text[], 'todo', 1, '[{"id": "a3c48fd9-9b23-5839-a39d-ca3ce4fdb68b", "text": "Expediente presentado", "done": false}]'::jsonb, '[]'::jsonb, 0),
('d46ebde0-9e3d-5da6-9c2a-52506a09a92b', 'PR05', 'Sistematización de resultados Cohorte 1', 'Consolidar datos cuantitativos y cualitativos de implementación para identificar resultados, aprendizajes y hallazgos.', '2027-07-05', array['P006','P008']::text[], 'todo', 0, '[{"id": "55ca5dfd-a00e-568c-a801-d87cda9962de", "text": "Informe de resultados", "done": false}]'::jsonb, '[]'::jsonb, 0);
insert into stage_tareas values
('58881105-b1cb-5f73-9686-e395137c90b6', 'PR05', 'Correcciones (sugerencias del MEC)', '(salió del proceso editorial el 16/08/2026)', '2027-07-07', array['P003','P006','P008']::text[], 'todo', 0, '[{"id": "20476b1d-a84e-58a2-a4a5-db4d47fd712a", "text": "Versión corregida", "done": false}]'::jsonb, '[]'::jsonb, 0),
('f02859a7-c6a0-5586-949f-4d43864f7d7c', 'PR05', 'Visitas de seguimiento', 'Organización y ejecución de visitas según calendario.', '2027-07-09', array['P005']::text[], 'todo', 0, '[{"id": "aa9ec383-5475-5b20-84f3-6f3357b966b1", "text": "Registro consolidado de visitas", "done": false}]'::jsonb, '[]'::jsonb, 0),
('6a0f60fc-5dd8-52ee-961b-9be5cb57d63f', 'PR05', 'Identificación de mejoras para Cohorte 3', 'Definir acciones de mejora a partir de resultados, encuestas y análisis de implementación.', '2027-07-13', array['P006']::text[], 'todo', 0, '[{"id": "82931eab-d6f9-543c-a66a-15e3294bb25a", "text": "Matriz de mejoras", "done": false}]'::jsonb, '[]'::jsonb, 0),
('a2d421a5-0b48-5027-9dbb-19f28ebec2aa', 'PR05', 'Auditoría pedagógica de materiales utilizados en Cohorte 2', 'Revisar materiales implementados para evaluar coherencia pedagógica y proponer mejoras.', '2027-07-16', array['P006']::text[], 'todo', 0, '[{"id": "da7917bf-ffe6-5a3d-abb8-9b0a2789445c", "text": "Informe de hallazgos/ auditoría", "done": false}]'::jsonb, '[]'::jsonb, 0),
('d0cf612a-938a-5cd3-9611-c3f6aa519aa9', 'PR05', 'Revisión metodológica de actividades', 'Evaluar actividades implementadas para identificar ajustes metodológicos y de secuencia didáctica.', '2027-07-22', array['P006','P008']::text[], 'todo', 0, '[{"id": "89114c2b-74fe-5e71-acb2-3f603a991871", "text": "Matriz de ajustes", "done": false}]'::jsonb, '[]'::jsonb, 0),
('e8b02bb0-a04e-5ea5-96ef-2ebe561c4e87', 'PR05', 'Adecuación de evaluaciones', 'Ajustar instrumentos de evaluación según resultados observados en la implementación.', '2027-07-27', array['P003','P006','P008']::text[], 'todo', 0, '[{"id": "6b67274d-8317-5f85-8d09-1a52d6572ffd", "text": "Instrumentos actualizados", "done": false}]'::jsonb, '[]'::jsonb, 0),
('7d04d63e-493f-5384-b502-313ba473477e', 'PR05', 'Ajuste y actualización de PPTs y materiales', 'Incorporar mejoras en materiales pedagógicos, recursos visuales y soportes (PPTs, PDFs, videos, enlaces, glosario).', '2027-07-30', array['P002','P003','P008']::text[], 'todo', 0, '[{"id": "c5254120-1d9d-5889-92e3-78aa81e0a885", "text": "Material actualizado", "done": false}]'::jsonb, '[]'::jsonb, 0),
('0c08cc28-27c5-586d-9cba-22a0ecbdac2c', 'PR05', 'Validación en Mesa Pedagógica', 'Revisar ajustes finales y aprobar versión definitiva de materiales y lineamientos.', '2027-08-20', array['P003','P006']::text[], 'todo', 0, '[{"id": "cfc33fad-5667-5884-9f10-b0daf0831f26", "text": "Acta de aprobación", "done": false}]'::jsonb, '[]'::jsonb, 0),
('7dd4fc37-fa21-57d4-9cbe-58be6ef6846b', 'PR05', 'Publicación versión Cohorte 2 (por módulo, por semana)', 'Organizar y publicar materiales finales con control de versiones y trazabilidad por módulo y semana.', '2027-08-23', array['P006']::text[], 'todo', 0, '[{"id": "8a1a958f-61c8-56d0-bd25-693763c702e3", "text": "Material oficial", "done": false}]'::jsonb, '[]'::jsonb, 0),
('23188e7b-9f42-5e93-8cf2-e180e827d889', 'PR05', 'Elaboración de informe de cierre Cohorte 1', 'Elaborar informe ejecutivo consolidando resultados, aprendizajes y recomendaciones del proceso.', '2027-08-26', array['P006']::text[], 'todo', 0, '[{"id": "1d112dd8-4356-5e4c-9b92-b9cc7667eb30", "text": "Informe final aprobado", "done": false}]'::jsonb, '[]'::jsonb, 0),
('09a6d9d6-0af0-534c-a8c1-92d538eaba0a', 'PR05', 'Presentación al Comité Ejecutivo FIFA', 'Presentar resultados finales del proceso y recomendaciones estratégicas para continuidad del programa.', '2027-09-01', array['P006']::text[], 'todo', 0, '[{"id": "4ff154e5-c0ab-54ff-a94b-326700736fc9", "text": "Acta de cierre", "done": false}]'::jsonb, '[]'::jsonb, 0),
('e2b77784-4e2d-55de-b0da-2907a2b1c5b0', 'PR05', 'Aplicación de rúbricas', 'Aplicación de formularios y rúbricas definidas previamente; consolidación de formularios finales', '2027-09-10', array['P005']::text[], 'todo', 0, '[{"id": "d4c26a56-93ad-5fb1-ae2e-40c15c0cbae3", "text": "Reportes de observación generados", "done": false}]'::jsonb, '[]'::jsonb, 0),
('66f73224-dcef-567b-abbf-894fe9c7a08f', 'PR05', 'Revisión de evidencias de soporte escolares', 'Revisión documental y clasificación de evidencias remitidas por las escuelas', '2027-11-15', array['P008']::text[], 'todo', 0, '[{"id": "eb053f41-40e9-5802-92ef-afc47a45aed3", "text": "Banco de evidencias consolidado", "done": false}]'::jsonb, '[]'::jsonb, 0),
('2ca2bc02-c42b-517c-8882-16452878a6b2', 'PR05', 'Identificación de escuelas en riesgo', 'Análisis de alertas e identificación de escuelas con riesgo de implementación o cumplimiento', '2027-12-23', array['P006','P008']::text[], 'todo', 0, '[{"id": "5822fdf6-f9af-5d9e-8d73-a0227b6a62c9", "text": "Reportes de riesgo emitido", "done": false}]'::jsonb, '[]'::jsonb, 0),
('148e4488-719e-5004-9b31-d731ce42c9a4', 'PR05', 'Planes de mejora institucional', 'Cómo rescatar a la escuela.', '2028-01-24', array['P006']::text[], 'todo', 0, '[{"id": "0175a769-8f04-512e-a630-e7af372c613b", "text": "Planes de mejora implementado", "done": false}]'::jsonb, '[]'::jsonb, 0),
('d5f949a1-39bc-5f06-9dfc-b9a230a20eda', 'PR05', 'Seguimiento de implementación', 'Seguimiento del cumplimiento y de la implementación pedagógica. Revisión cada dos meses para identificar avances y aspectos de mejora.', '2028-02-04', array['P002','P006','P008']::text[], 'todo', 0, '[{"id": "b0634306-8acb-5125-aeff-d5f3263afc4e", "text": "Reportes consolidados de implementación", "done": false}]'::jsonb, '[]'::jsonb, 0),
('f6208de7-8ef5-54ee-8ef9-78e966eb90cb', 'PR05', 'Auditorías pedagógicas', 'Ajustar indicadores según evidencia generada, tendencias observadas y necesidades de seguimiento', '2028-03-14', array['P006']::text[], 'todo', 0, '[{"id": "db71ad71-e4ec-5588-8074-ff0d04853138", "text": "Informes de auditoría", "done": false}]'::jsonb, '[]'::jsonb, 0),
('6c6f3edc-a9a9-5f28-917b-2a608f525de9', 'PR05', 'Consolidación de información de las tres cohortes', 'Integrar bases de datos de las tres cohortes, depurar registros y consolidar información final de participantes del proyecto.', '2028-04-03', array['P008']::text[], 'todo', 0, '[{"id": "08f49b71-8a27-555d-96d5-17c3923fbad8", "text": "Base consolidada de beneficiarios", "done": false}]'::jsonb, '[]'::jsonb, 0),
('2ad76c9c-4e98-5a93-94df-4b9b1d8ea340', 'PR05', 'Sistematización de indicadores de participación', 'Analizar datos de asistencia, permanencia y participación en las tres cohortes para generar indicadores comparativos.', '2028-04-12', array['P008']::text[], 'todo', 0, '[{"id": "3f7b2adc-0358-51bb-bd90-f9ab9bba59c6", "text": "Reporte de participación", "done": false}]'::jsonb, '[]'::jsonb, 0),
('b019041f-3b87-5b84-8097-aee26b8a998c', 'PR05', 'Sistematización de indicadores de implementación escolar', 'Analizar nivel de implementación en escuelas, cumplimiento de actividades y calidad de ejecución del programa.', '2028-04-19', array['P002','P005']::text[], 'todo', 0, '[{"id": "73ec7859-424c-5700-98cd-ff78bd7254ab", "text": "Reporte de implementación", "done": false}]'::jsonb, '[]'::jsonb, 0),
('4f3d01e0-b438-5ec9-8048-ece4b421059e', 'PR05', 'Actualización de indicadores', 'Ajustar indicadores según evidencia generada, tendencias observadas y necesidades de seguimiento', '2028-04-20', array['P008']::text[], 'todo', 0, '[{"id": "f52ca21a-79d3-5c16-a726-6fb29e6f177a", "text": "Indicadores institucionales actualizados", "done": false}]'::jsonb, '[]'::jsonb, 0),
('b8fc25ce-59a0-5b4a-83d7-11858d7c60e8', 'PR05', 'Análisis de cumplimiento de metas comprometidas con FIFA Foundation', 'Contrastar metas planificadas vs. ejecutadas, identificando nivel de logro de compromisos institucionales.', '2028-04-27', array['P002']::text[], 'todo', 0, '[{"id": "e25d632c-cc17-56e9-8c2f-32531a94197d", "text": "Informe de cumplimiento", "done": false}]'::jsonb, '[]'::jsonb, 0),
('4c9284ba-480a-5b49-b49e-a2c427eb912c', 'PR05', 'Elaboración de informe de impacto educativo', 'Analizar efectos del proyecto en aprendizajes, prácticas pedagógicas y resultados educativos observados.', '2028-05-04', array['P006']::text[], 'todo', 0, '[{"id": "92f3755b-4709-529a-a11f-ee3c548c7c42", "text": "Informe de impacto educativo", "done": false}]'::jsonb, '[]'::jsonb, 0),
('18f116be-4e7a-5a24-931f-78bf3b02dd66', 'PR05', 'Informe semestral FIFA Foundation', 'Alejandro provee datos e interpretación; Lu consolida, estructura y prepara versión final del informe', '2028-05-12', array['P006','P008']::text[], 'todo', 0, '[{"id": "f86ba3e8-1dae-5ed2-8fee-c93e96ca1d9f", "text": "Informes entregados", "done": false}]'::jsonb, '[]'::jsonb, 0),
('223ff530-68f0-5266-b18c-1fb58c9e4ab2', 'PR05', 'Elaboración de informe de impacto institucional', 'Sistematizar cambios organizacionales, capacidades instaladas y mejoras en gestión pedagógica del sistema.', '2028-05-18', array['P008']::text[], 'todo', 0, '[{"id": "ecf0f0d6-102e-5d26-8fef-674661510e1d", "text": "Informe de impacto institucional", "done": false}]'::jsonb, '[]'::jsonb, 0),
('01aa84f2-b056-5071-9940-181a1516187e', 'PR05', 'Recolección de buenas prácticas de escuelas participantes', 'Identificar y documentar experiencias exitosas implementadas en escuelas durante el proyecto.', '2028-05-26', array['P005']::text[], 'todo', 0, '[{"id": "4a9c9369-13fa-5bb1-8951-e82c32d481f5", "text": "Banco de buenas prácticas", "done": false}]'::jsonb, '[]'::jsonb, 0),
('10aebd76-4d16-5f2b-9fb1-c6ce6eb7e716', 'PR05', 'Identificación de experiencias destacadas', 'Seleccionar casos representativos de alto impacto pedagógico y organizarlos en formato de sistematización.', '2028-06-02', array['P005']::text[], 'todo', 0, '[{"id": "5477f43a-d7ce-56af-a127-7646b9eace79", "text": "Catálogo de casos destacados", "done": false}]'::jsonb, '[]'::jsonb, 0),
('6a8e91c4-88e3-5adf-94c1-4bec0f4c1fdb', 'PR05', 'Documentación de lecciones aprendidas', 'Consolidar aprendizajes clave del equipo técnico, pedagógico y operativo durante toda la implementación.', '2028-06-08', array['P002','P003','P006']::text[], 'todo', 0, '[{"id": "3b7bade6-c10e-5a0f-a03d-6578816d7250", "text": "Documento de lecciones aprendidas", "done": false}]'::jsonb, '[]'::jsonb, 0),
('2ee958bd-3ba5-568e-a643-3b3e74c392ba', 'PR05', 'Elaboración de memoria metodológica del proyecto', 'Describir el diseño, implementación, ajustes y evolución metodológica del proyecto completo.', '2028-06-15', array['P006']::text[], 'todo', 0, '[{"id": "c145f195-4af5-5f15-9915-7d8e7b8ba3d3", "text": "Memoria metodológica", "done": false}]'::jsonb, '[]'::jsonb, 0),
('e32f81bd-d61d-5281-9f2b-750875e31cd9', 'PR05', 'Consolidación de la colección editorial desarrollada', 'Organizar y sistematizar todos los materiales pedagógicos producidos durante el proyecto en formato editorial final.', '2028-06-27', array['P006']::text[], 'todo', 0, '[{"id": "83b5c2bb-e675-53e8-9e39-70e7acf0f756", "text": "Colección editorial final", "done": false}]'::jsonb, '[]'::jsonb, 0),
('17c1fb45-1290-52c8-be8f-91271af11f28', 'PR05', 'Consolidación de guías docentes', 'Sistematizar guías, orientaciones y materiales de apoyo docente para su uso futuro.', '2028-07-06', array['P006']::text[], 'todo', 0, '[{"id": "59c1628c-1a6e-547a-9f0f-5aa156b521e7", "text": "Colección editorial final", "done": false}]'::jsonb, '[]'::jsonb, 0),
('0fb69c00-4f6c-5796-be3c-efc880b0bfc6', 'PR05', 'Identificación de oportunidades de continuidad', 'Analizar viabilidad de continuidad del proyecto en nuevas fases, escalamiento o nuevas cohortes.', '2028-07-14', array['P002']::text[], 'todo', 0, '[{"id": "061ec802-5045-5cdb-add0-844d55072eb5", "text": "Documento de oportunidades", "done": false}]'::jsonb, '[]'::jsonb, 0),
('be2b9be4-f613-525f-b43c-8ba18f3c85e1', 'PR05', 'Diseño de estrategia de escalamiento nacional', 'Definir modelo de expansión del proyecto a nivel nacional, considerando recursos, alcance y sostenibilidad.', '2028-07-20', array['P002','P006']::text[], 'todo', 0, '[{"id": "f5bbb916-d45d-5c1e-8736-829276aef51d", "text": "Estrategia de escalamiento", "done": false}]'::jsonb, '[]'::jsonb, 0),
('7384a49d-f281-522d-bf94-e280db58db1c', 'PR05', 'Elaboración del informe final del proyecto', 'Consolidar todos los resultados, indicadores e impactos en un informe final integral para presentación institucional.', '2028-07-31', array['P002','P006']::text[], 'todo', 0, '[{"id": "6f9ee574-820b-5b97-a570-9ecc10d32a89", "text": "Informe final FIFA Foundation", "done": false}]'::jsonb, '[]'::jsonb, 0),
('e2c9b973-23b7-53c7-a58b-8ee72e8b22cd', 'PR05', 'Ajustes de mejora continua', 'Implementar mejoras derivadas del monitoreo, auditorías y resultados de implementación', '2028-07-31', array['P006']::text[], 'todo', 1, '[{"id": "30d4b37b-d76c-5f57-a063-b6482506f8f1", "text": "Registro de acciones implementadas", "done": false}]'::jsonb, '[]'::jsonb, 0),
('0a61b19c-2f14-5df2-9afa-51c854edf55a', 'PR05', 'Presentación ejecutiva de resultados', 'Preparar y presentar resultados finales del proyecto a instancias directivas y financiadores.', '2028-08-14', array['P002']::text[], 'todo', 0, '[{"id": "5189042d-29db-5a48-b718-87cfcbf8590e", "text": "Presentación ejecutiva", "done": false}]'::jsonb, '[]'::jsonb, 0),
('8f24231b-0c3c-5c61-a202-e55ae36b03ff', 'PR05', 'Evento de cierre y socialización de resultados', 'Organizar evento final de presentación de resultados, aprendizajes y cierre institucional del proyecto.', '2028-08-16', array['P002','P003','P006']::text[], 'todo', 0, '[{"id": "4f4cad95-50ab-5ffa-a387-37b5710f9810", "text": "Evento de cierre", "done": false}]'::jsonb, '[]'::jsonb, 0),
('d3b10f60-34be-54e7-bbff-25cc78a3230d', 'PR05', 'Entrega oficial de productos y resultados a FIFA Foundation', 'Consolidar y entregar oficialmente todos los productos, evidencias e informes finales del proyecto.', '2028-08-25', array['P002']::text[], 'todo', 0, '[{"id": "319c22ff-fc8c-59fc-98b0-4c97e20ea55f", "text": "Acta de cierre del proyecto", "done": false}]'::jsonb, '[]'::jsonb, 0),
('d3c44c5e-e695-5fed-adc3-9e281ea670c3', 'PR05', 'REDACTAR GAMIFICACIÓN', null, '2028-08-29', array['P003']::text[], 'todo', 0, '[]'::jsonb, '[]'::jsonb, 0);

insert into public.tasks (id, project_id, title, description, date, assignee_ids, status, position, checklist, links, urgent, importance)
select s.id, mp.nuevo, s.titulo, s.descripcion, s.fecha,
       coalesce((select array_agg(m.nuevo) from mapa_personas m where m.viejo = any(s.asignados)), '{}'),
       s.estado, s.posicion, s.checklist, s.enlaces, false, s.importancia
from stage_tareas s
join mapa_proyectos mp on mp.viejo = s.proyecto
on conflict (id) do nothing;

commit;

-- Resumen
select (select count(*) from public.projects) as proyectos,
       (select count(*) from public.profiles) as personas,
       (select count(*) from public.tasks) as tareas;