-- ============================================================
-- ReEduca · Migración Kickoff 3: que el equipo pueda dejar su briefing
-- Pegá TODO este archivo en: Supabase → SQL Editor → New query → Run
-- Se puede correr más de una vez sin romper nada (es idempotente).
--
-- Qué hace: hasta ahora solo un Gerente podía crear el kickoff de un lunes
-- en la base, y el briefing de cada persona cuelga de ese lunes. Con esto,
-- cualquiera del equipo puede crear la fila del lunes (una sola por fecha)
-- para poder guardar sus respuestas del viernes. Editar o borrar el kickoff
-- sigue siendo solo de Gerentes. No se toca ningún dato existente.
-- ============================================================

drop policy if exists "kickoffs_write_admin" on public.kickoffs;

-- Crear el lunes: cualquiera del equipo (la fecha es única, así que es una sola fila).
drop policy if exists "kickoffs_insert" on public.kickoffs;
create policy "kickoffs_insert" on public.kickoffs
  for insert to authenticated with check (true);

-- Editarlo (presentes, líneas de la semana, acciones, cerrarlo): solo Gerentes.
drop policy if exists "kickoffs_update_admin" on public.kickoffs;
create policy "kickoffs_update_admin" on public.kickoffs
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Borrarlo: solo Gerentes.
drop policy if exists "kickoffs_delete_admin" on public.kickoffs;
create policy "kickoffs_delete_admin" on public.kickoffs
  for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
