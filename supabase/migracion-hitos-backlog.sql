-- ============================================================
-- MIGRACIÓN: bandeja sin fecha + módulo de Hitos
-- Correr DESPUÉS de migracion-datos.sql. Seguro correrlo más de una vez.
-- Pegá TODO en: Supabase → SQL Editor → Run
-- ============================================================

-- 1) Estructura
create table if not exists public.hitos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  date date,
  position integer not null default 0
);
alter table public.hitos enable row level security;
drop policy if exists "hitos_authenticated" on public.hitos;
create policy "hitos_authenticated" on public.hitos
  for all to authenticated using (true) with check (true);

alter table public.tasks alter column date drop not null;
alter table public.tasks add column if not exists hito_id uuid references public.hitos (id) on delete set null;

do $$ begin alter publication supabase_realtime add table public.hitos; exception when duplicate_object then null; end $$;

-- 2) Convertir las "tareas-hito" migradas en hitos de verdad

insert into public.hitos (id, project_id, name, date, position)
select t.id, t.project_id, t.title, '2026-09-05', 0
from public.tasks t where t.id = 'd0b1d3d8-96c3-500b-8a9d-31d375e73af6'
on conflict (id) do nothing;
insert into public.hitos (id, project_id, name, date, position)
select t.id, t.project_id, t.title, '2026-10-03', 1
from public.tasks t where t.id = '5cd4e149-844a-57d8-9595-ca3cc3b00355'
on conflict (id) do nothing;
insert into public.hitos (id, project_id, name, date, position)
select t.id, t.project_id, t.title, '2026-11-07', 2
from public.tasks t where t.id = '23e00b99-a1d3-531a-844e-76a17376f7cb'
on conflict (id) do nothing;
insert into public.hitos (id, project_id, name, date, position)
select t.id, t.project_id, t.title, '2026-12-05', 3
from public.tasks t where t.id = '15ec4076-fe8a-55d7-87ee-641b3b4b7833'
on conflict (id) do nothing;
insert into public.hitos (id, project_id, name, date, position)
select t.id, t.project_id, t.title, null, 4
from public.tasks t where t.id = '9f6af53a-7fd8-5353-8dde-4ff00954ce68'
on conflict (id) do nothing;
insert into public.hitos (id, project_id, name, date, position)
select t.id, t.project_id, t.title, null, 5
from public.tasks t where t.id = '0d3b7663-3ea2-5437-b0eb-99f80b0f001a'
on conflict (id) do nothing;
insert into public.hitos (id, project_id, name, date, position)
select t.id, t.project_id, t.title, null, 6
from public.tasks t where t.id = '162073e9-cec0-5754-a52a-a65b5a7a0c96'
on conflict (id) do nothing;
insert into public.hitos (id, project_id, name, date, position)
select t.id, t.project_id, t.title, null, 7
from public.tasks t where t.id = 'a3fe5475-7907-5efb-ada0-a8a5eb8eef8c'
on conflict (id) do nothing;
insert into public.hitos (id, project_id, name, date, position)
select t.id, t.project_id, t.title, null, 8
from public.tasks t where t.id = '2e9f6aa5-b50e-5bca-95ea-28eeb27081d9'
on conflict (id) do nothing;
insert into public.hitos (id, project_id, name, date, position)
select t.id, t.project_id, t.title, null, 9
from public.tasks t where t.id = 'f7dc3d28-fb16-5d31-a38b-43324c5ec2e8'
on conflict (id) do nothing;

-- 3) Vincular las acciones a sus hitos (relación que ya existía en el Excel)
update public.tasks set hito_id = '9f6af53a-7fd8-5353-8dde-4ff00954ce68' where id in (
  'dbe33854-816e-57c1-a4f2-d5b49b9447bf'
);
update public.tasks set hito_id = '0d3b7663-3ea2-5437-b0eb-99f80b0f001a' where id in (
  'a3e4f773-c30a-534a-8150-a38b5673a698',
  'fbba0220-a516-56b9-bb04-79de78e1a952',
  '22a75192-5b3a-5fab-8180-669a0957d143',
  '5563d558-dda7-5b47-8137-d61323248b55',
  '5dc11780-69aa-54c8-aa5b-23eb86e46b36',
  '9c7e2547-8c64-5937-9922-5f5e93326f8b',
  '6353a092-3f85-593c-97b9-d2f16092e86b',
  '389386f6-b395-53c8-b136-12fd21697f52',
  '6fb2ef57-c866-5063-91d4-a1ee6b885705',
  '18ba4ef5-2e31-50f1-aa6f-4cfcf6898ca8',
  '1a714518-2fe8-5c94-b5ab-fdd82bbc3373',
  '55f8e01e-165b-5cce-af7c-76bdba199213'
);
update public.tasks set hito_id = '162073e9-cec0-5754-a52a-a65b5a7a0c96' where id in (
  'aff14886-0e45-5f17-9a15-15659444e661',
  'd7aa0008-69f3-5cdb-bba4-937d062d96e5',
  '83d12502-5823-5292-8035-09ad5ad933df',
  '910727ac-9dd9-5caf-a0da-25737ff51e0b',
  'e630d41b-197b-5e23-8173-513443a9aeb3',
  '6575b778-b484-5b32-a477-717595ab60af',
  '3ed4832a-2754-5c48-b8f9-ac3889ce6a20',
  'dca6907b-72a9-5d45-875b-6a22092d1e43',
  'fa85f1fa-7688-5c91-bc81-df37f0313c49',
  '9615c6b1-3d07-5516-8284-fb4492e0e423',
  '6a9136c4-a104-5844-beaa-0f03bdd9f10f',
  '4061eb96-99a2-525c-a12f-996295436bdc',
  '4b6c7684-6f05-5774-9c2a-457c5cbad157',
  '513599ca-bf15-5872-90d7-2ff5444d1e08',
  '54f854f8-7265-5b57-8d94-c3351617b7c0',
  '00b12c0e-490d-5964-913a-f1fcc06d3f28',
  '3f93196a-d140-57d7-86d7-96dbb073ae15',
  'cdade65a-4905-5c71-a1eb-7c597e8d813f',
  'fc4274e8-c0a7-5d14-888a-cb4861576282',
  '7db918db-f522-51c6-8233-1fafb5c97d7b',
  'fb4015d7-25d6-5695-b3d7-4d02d063d7ae',
  '9676290d-164d-5f33-8158-17acfdca836e',
  'dc61b80d-0529-536b-9be5-4ec54b464531',
  '6b9f9c40-8abe-5368-8c89-1e991f2ae9b1',
  '508acd5f-9de3-56e0-8342-2daf5c2eda03',
  'a593c4ca-d11e-521f-82f4-262ddb2be222',
  '9ada7d67-0039-5a70-a7e2-2b2d29f30177',
  '3f464fca-a2c1-55ff-b08b-1cf99f2d1672',
  '736d7dcd-baae-50b5-81af-9ba4c7684008',
  '276427ab-11fa-5993-a0f3-fa575b096dc7',
  'aaec1a50-6c6e-576c-b895-d566d92cd90b',
  '87ef60c9-59e8-537f-8977-ac100b8b48be',
  '1e467230-b6fa-5ba4-a875-9b42e11520e1',
  '4e6aa8f6-fac6-5b08-9bd6-0db7f56aef14',
  'f07854cf-c773-5e3f-9194-1d07f096d570',
  '7a80777e-d093-5213-9109-ea2460fd2552',
  '8abebd99-6159-5920-a9e7-36491c896cad',
  '64c48d1c-72d0-55c8-aab3-501f4aaf462d',
  'ac3e85a5-ca96-5393-bb91-0b3cecdaec69',
  '60978200-449a-5a75-9c4d-b40dbad4bb75',
  'f35ba4ce-a6e5-52a3-a39f-83eec9f4e479',
  '9aac7d8d-6255-57a0-aabf-42954d8571c9',
  '2eff4ce1-e607-50ef-9611-9d718f422b6b',
  '88e4ec9e-4aa6-51ae-ab8e-7bba701649ed',
  'd46ebde0-9e3d-5da6-9c2a-52506a09a92b',
  '6a0f60fc-5dd8-52ee-961b-9be5cb57d63f',
  'a2d421a5-0b48-5027-9dbb-19f28ebec2aa',
  'd0cf612a-938a-5cd3-9611-c3f6aa519aa9',
  'e8b02bb0-a04e-5ea5-96ef-2ebe561c4e87',
  '7d04d63e-493f-5384-b502-313ba473477e',
  '0c08cc28-27c5-586d-9cba-22a0ecbdac2c',
  '7dd4fc37-fa21-57d4-9cbe-58be6ef6846b',
  '23188e7b-9f42-5e93-8cf2-e180e827d889',
  '09a6d9d6-0af0-534c-a8c1-92d538eaba0a',
  '161f5760-f544-5c77-9b2f-8aff03814d5e',
  '3f3e4471-66aa-5f46-9271-1cb3adef6299',
  '8ee8d9fe-320c-5482-b491-427ea5387181',
  '7b5a4b64-2476-5280-bdf3-3d32ce168bd2',
  '5dd4861b-db20-5a80-afe2-3d02e619c69a',
  'bdbc4395-faac-5bd9-8e5d-d296de5793db',
  'decd5f90-8a27-5262-99c0-020a03350075',
  'b25286d2-029e-5235-a117-945d221ee69e',
  '9a237e4b-33c1-5f7c-9ccb-9f2a7bacc10b',
  'd66662e8-97e9-5033-90f7-a05cfa42bdc7',
  '5dfeb69a-3c69-502f-8fb4-78320dceb3e8',
  'e4b94ed7-c4cd-5b13-ba80-670d697cbec7',
  '7a2cb718-9fce-5cb5-8854-a689360831e5',
  '73e5545a-fab0-53a3-820a-8b69d6092c1c',
  'de654093-1619-5c5a-a9bd-571f198228a5',
  'a80ccc24-bb19-50a5-ab37-33d728697b9c',
  'e730278f-4a4d-5409-8fcf-99e33ce314d1',
  'b33af3b8-f3f5-5387-bb08-39dc5d58a6ad',
  '45e9f159-612a-5933-963e-499a35c406a3',
  'be42ba7b-c553-5fd6-b7ba-4118b1c86744',
  '9ccb56e9-e47d-52bc-96d9-ce93ed7a6359',
  '7ea682e0-5c9e-52ce-9566-32862b1a4bf6',
  'd61755df-bcd5-53ae-8ea2-3ed3d05c88b8'
);
update public.tasks set hito_id = 'a3fe5475-7907-5efb-ada0-a8a5eb8eef8c' where id in (
  '482c9da7-947b-52ba-b46c-7d0bead4ef68',
  '16d7e4b0-cce3-585d-8700-93821502b425',
  '00b3b25a-d5f5-5e44-b6a3-aa8de895b2fa',
  'e89bb51a-f137-566a-a9b1-11d526d14043',
  'b5f367cf-3265-56ac-9d2c-a85f3ce95b27',
  '8cc9c34e-9adc-50dd-b49b-223103eb6d58',
  '5ded0b9c-2f39-5553-aadf-ce0000aa879d',
  'feac462a-6356-59a7-b4df-27c80e95a2bb',
  '57ee6101-90a2-5a38-8936-357e343373be',
  'f02859a7-c6a0-5586-949f-4d43864f7d7c',
  'e2b77784-4e2d-55de-b0da-2907a2b1c5b0',
  '66f73224-dcef-567b-abbf-894fe9c7a08f',
  '2ca2bc02-c42b-517c-8882-16452878a6b2',
  '148e4488-719e-5004-9b31-d731ce42c9a4',
  'd5f949a1-39bc-5f06-9dfc-b9a230a20eda',
  'f6208de7-8ef5-54ee-8ef9-78e966eb90cb',
  '4f3d01e0-b438-5ec9-8048-ece4b421059e',
  '18f116be-4e7a-5a24-931f-78bf3b02dd66',
  'e2c9b973-23b7-53c7-a58b-8ee72e8b22cd'
);
update public.tasks set hito_id = '2e9f6aa5-b50e-5bca-95ea-28eeb27081d9' where id in (
  'a1ed4d1b-7672-5145-85bb-40d0a7f129b0',
  'd407e848-7fb9-5334-bcf5-f8b31826831e',
  '1781a1c2-012f-5417-a5ed-56d204452e00',
  'cb1720f3-1238-5cee-a3d1-f7cb96880bb8',
  'fe7fcb6c-7ac0-58aa-95ff-b079678f172d',
  'c053633a-9824-5c65-9cfe-111a684751ee',
  'db0ac4ef-128f-5593-bd03-34473b148680',
  '0847dcda-f3bd-533b-a1f7-4fe7880e53d1',
  'edf16a98-744d-5b0c-90ce-a1c436779d17',
  '013dcc4a-ec3a-5edb-8fe0-7faa5b70e25a',
  'fb3bc650-62eb-586e-a4e5-a2bb76806272',
  '992ed43c-1d65-5e1b-9ba8-8ca5b989315f',
  'de6ee3c6-3068-5434-af1d-f0ca1ee94aed',
  'f1ee1e39-e1f7-5216-9d2e-a5d75967ede1',
  'ae3e5c51-0acd-5e95-805e-59a9cefd40c6',
  '1560eb50-bcab-5eb9-9ee4-76371016c7b2',
  '3f9f4243-fec1-572d-8ca6-6d4ee4723738',
  '8b222e73-5aa8-54c7-a33e-943168e553a6',
  '5da0e38f-7f9e-5c7f-8d4a-941dc2ef0d73',
  'eb569445-596e-50a9-8d21-2e93306f7703',
  '551d099e-3c48-5366-a8c0-c82e54ebaf3a',
  '879b74f1-ca96-540f-97a8-831d15883ecf',
  'c2611039-3250-5536-8ae5-6399ca9a72f0',
  '3cc20c84-487b-5db1-b494-6da35e11ec99',
  '245867a9-5d70-5c81-8efe-4c25e7fa94f5',
  'c490bd45-d2b1-5ecb-beaa-71847431ae1f',
  'bc1276e1-0482-5681-a5f7-a9ddc1535171',
  '70d92ff6-e42a-580f-ab6e-6533a161046d',
  'b64f85ab-a843-5574-88b2-85a25c49e7fb',
  'd89dcf65-31ff-5543-acad-59c13ab83a28',
  '81828e05-2c8e-5925-96bb-403e94271f7f',
  '80b8792d-bc30-5453-87c6-4d011f189957',
  '70c4f3ca-887d-535d-bad0-13744d50ba88',
  'ee075215-f64b-5c6a-8ad1-612f2dea670b',
  '546ab25c-9d12-5b07-abeb-87ccd9fe0ef8',
  '6710014c-3285-589e-86f5-a9a3e5cfc798',
  '65542c04-281e-5a7f-ab51-80f02bb2f28c',
  '37f2336f-8529-5d42-9c25-a28193ba1793',
  '47d87ff2-d5cd-50ad-a480-e589b222aec1',
  '9b69e163-1e1e-5184-81f5-6089eb63424d',
  '2b21c1e3-097b-5b91-a409-3c8762a7015a',
  '8b82fc1e-e6e3-5b57-9e7d-eaf4e4654b9d',
  'd150d3f9-1d8e-5a40-be90-983fa3eba9ac',
  'fc116ff5-7902-50c2-8fe7-b05d87b69e71',
  '7ac32c84-edd6-5e17-bf47-d696713c116c',
  '9d55916f-6dc3-5c32-9832-087aaeb4f48f',
  '9e2ceaf5-61cb-5fb7-9057-ca0b40a650f6',
  'b376a360-7a97-51bf-a992-dfcbb1702752',
  'b13db55e-d421-5284-a4ed-504e403611d4',
  'a4d2fa40-7d03-5246-894e-0edadcd0cdb3',
  '88a19bae-90f4-5e1f-8356-33c5f8edaadb',
  'c7ce58f1-58c8-5a82-805a-5f570f903c4f',
  '4e15098d-0465-5f82-8399-7462d525ced3',
  'be4fac74-e296-5358-896a-bf75f01da07d',
  '4810aa0b-98fb-5625-b074-c9a4fd0355aa',
  '0d49262d-894e-5d21-8c65-4c170e15c51e',
  '2ee1c378-d6c4-59aa-ab87-6e956a4613b5',
  'd20ec555-5604-546e-82ce-3e5d3e1c5498',
  '9d11d878-5657-5c07-9307-2311cde99e97',
  '7d66d2a0-fb12-5f8b-98f1-2572f54deab2',
  '8af2799b-0b6e-5cb7-9a5e-4b739bef01b4',
  'a4839da6-2783-519e-8754-d4802b0aedfb',
  '382a58c7-5640-571a-b9f8-f2be2b69a72e',
  'ebd86757-6055-5027-8300-511ffb83d787',
  '02cca9b2-8602-5a21-acb5-9790c0c7fb9b',
  'ad8abb82-df50-5bcf-9352-2135f5b27c88',
  'b95b0181-39bc-5018-9bd6-7f68aafe4511',
  '66c10ad0-77b6-5536-a21b-a766e0f9893b',
  '58a31e19-ec40-5151-a3fb-6b020448c8e7',
  '62aff4c0-bbf8-5546-947e-1a69f85bce2b',
  'a8af55b8-039a-5d7b-914f-2f1371b0c67b',
  'e19bd412-d2ca-50e9-8c3c-9219b1b30968',
  '565b6727-7eeb-51a3-9ab9-8be027168f5f',
  '40fff0a5-afac-5e03-ae30-2f92e6651d5e',
  '49a83174-8583-5e66-a2dc-bb5dd1d7217f',
  'a1411e46-8b72-56b1-99e9-f4a2fca5ebcb',
  'e2b6c119-addb-5e6b-890e-1bbd46672b4b',
  '9151caaa-2ec7-565c-a2e0-f9e06abbf512',
  'f945fb70-240d-52f2-a446-ea44685f7a90',
  '02b91c7e-cd09-5621-86b8-f51c34b6b91a',
  'c8c4052f-0a87-5069-bfa6-a168d8a7d878',
  '0afa2cdc-8f97-506e-b4b3-fd85f6ed7090',
  '0307dd0d-3b12-51c5-b77e-a3ab03ea4ac0',
  '1c48e0b2-4fa5-504e-9e43-8891579fbf27',
  '407fd46b-94c3-5feb-b058-82a58f4839cf',
  'b036d5fd-51a3-5629-ab1c-3df884fb07c3',
  '7d3783c3-0cdd-5238-ab00-1a5fbb913016',
  '8d36046f-67c7-519f-b73b-d290f48d6493',
  'ced7d0e4-4d12-58f0-a7a8-49dc1260d7f3',
  '7f1041b2-f005-5590-ba4f-2fe2589bba45',
  'ca42477d-b708-51ce-b56a-1aa6cde407ab',
  '07addd9d-90fa-5a33-b625-c6028ec3f01e',
  '35f6d687-469f-526f-9750-0f32608926b6',
  'ec9daf83-3fc5-56be-b3a8-b88c11460557',
  '81b3630d-a3a5-5385-bc3f-62ef7614b88a',
  '7fc2822a-a622-5cb0-b231-4c8a18b4a150',
  '1023488a-0429-5b0e-8195-2bd8412b3843',
  '862e6771-f9e3-5148-bf05-d01a94be19a6',
  'c29cf5a5-75b1-5616-ae1e-86295f4545da',
  '66140347-ec59-5a4f-9519-b9216681d7af',
  '3fffeaec-e044-533b-96e2-a566b9ee798e',
  'ca587789-1d36-5ec9-9d1b-57313653ee17',
  '974638ec-260f-52c0-99d0-ab7372922605',
  '9883f1f4-5a77-5c0b-a8d8-3ee3cd2e0439',
  '0512c2b7-5155-5c6b-b327-b4ac5abba9dc',
  'e4a0477f-b8d4-5d9d-9220-ad211c7a0459',
  '5c66e18a-c155-58e6-8a0e-1eec0f92d12d',
  '3943f004-4817-528e-992f-597f799aaacc',
  'ed8a81bc-5e9f-5179-8d52-716bfb226b0b',
  'a5068b54-a48b-563e-84dc-3bbcb22b3c5e',
  'ac538200-a726-58d8-bec3-1f343faf2c95',
  '26658244-158b-536e-a7ea-35e3197376c1',
  'fd6b4734-ed83-5d75-b3ec-66463a132b81',
  '1f53f4b7-abf0-5e12-ad8c-063ee4c8210a',
  'cc7c7648-45df-568e-88a7-7555a978caa7',
  'ecb770a8-9d77-5ba3-9bb2-13e96c3e7b28',
  'dce45384-93d3-5203-a9f8-9efeb19341bb',
  '440a2f0f-86da-5598-91a7-81fdccaf2605',
  '71dfb793-ae5f-5e96-acc1-7f37137df4d1',
  'acb27a0b-65ee-5767-91e4-d6c838edbdc8',
  '976ff9b0-4c0a-591c-898f-e8250961b31e',
  '524c46b0-4908-51e8-850b-106ea5852a1b',
  '4d4250e5-25f5-51ed-a232-8fab9c0abe76',
  'cc6359e4-3945-567d-9a96-aecc71cd93f5',
  '1aa04429-eb8c-5c38-b1ae-7b1953e9951b',
  '24f1f942-51ce-5220-8ffc-f8d1f60479de',
  'ace9c821-ae09-56d5-9c76-377edf6fda72',
  'b9d9e512-57dc-5eea-9f0e-2c8178f9c201',
  'da6d3b84-e4b0-568f-9bd9-0608e84cf094',
  'bbf69e44-ff24-5f14-a0c3-f10da09a2ede',
  'f527c26e-7769-5356-8c57-bb6f975f6354',
  'cad4fcf1-d7f0-5fb6-850b-69e862ebd26e',
  '5bbc8aa7-20b2-5b8f-a975-a3779e92a20a',
  '83b316f2-b515-5136-82f3-0dd9d28efe11',
  'bce8ef61-3d6a-51b3-a948-34c512d54158',
  '26bcf85f-12a0-54cf-b128-170d024104ce',
  '1a4d689f-e9e4-562b-ab67-86a603758270',
  '50306219-934a-5052-9d05-2ee352ea6e72',
  '9922a019-9530-5e4e-86ec-a0ea61a5101a',
  'e7592aba-91b9-5556-accf-b8001e879b42',
  'ebd09923-122e-5447-9e3e-e01034b4f64e',
  '45c662ca-18ec-571e-bad8-97d8bf4850a1',
  'c014b850-52ca-51a4-94b5-39d21d434a64',
  '85bd0451-1455-54f2-89cc-ed342d20f47b',
  '41eb7748-0025-54ab-9c27-f0ce6e4318a2',
  'cdb9c0ff-a027-5dde-ad3f-d46412dc7feb',
  'c5befb1d-8c8f-5d3f-9c45-ca5a32617a19',
  '5e299690-adf3-5b61-8975-215aa3715720',
  'c59d8d4c-0cbf-5435-b87a-51ef747505f4',
  'ed684ed8-47d8-53c8-a4af-8a041f4c136c',
  '4c342014-9e47-5e20-b98f-7e761f4d88aa',
  '33d3ae39-1829-5ce9-b6bf-ecdfb10d2717',
  'b9bdd9b0-30fb-5167-87cf-74e93a62db43',
  'c2fecfb9-753d-53d1-9af9-349e75140469',
  'd41a49c0-f299-5e8a-a856-71d0ab947414',
  'e6827112-b01a-5f49-a8d7-c3d3bc1d25ce',
  '143fce77-430b-5e7b-a76e-4e647eba9a3c',
  '3fa70ff1-1010-52b5-8aa2-ffb45365d4b9',
  '348860be-a276-5a44-8ec7-1708def6be68',
  'a1aba8cc-85a8-5942-8ed5-9961255cb6fb',
  '299df32d-45b8-54a7-a7ae-819cffd387ce',
  '58881105-b1cb-5f73-9686-e395137c90b6',
  '6788431d-b0cf-5fda-b67f-b999ceb878bd',
  'fbfe0ef0-4c04-54cd-9b06-31a64f135f32',
  '38e4a347-c75c-5e62-910e-5b7f4511fb93',
  'fdf6be2d-46df-54a1-9049-af736c409bb2'
);
update public.tasks set hito_id = 'f7dc3d28-fb16-5d31-a38b-43324c5ec2e8' where id in (
  '6c6f3edc-a9a9-5f28-917b-2a608f525de9',
  '2ad76c9c-4e98-5a93-94df-4b9b1d8ea340',
  'b019041f-3b87-5b84-8097-aee26b8a998c',
  'b8fc25ce-59a0-5b4a-83d7-11858d7c60e8',
  '4c9284ba-480a-5b49-b49e-a2c427eb912c',
  '223ff530-68f0-5266-b18c-1fb58c9e4ab2',
  '01aa84f2-b056-5071-9940-181a1516187e',
  '10aebd76-4d16-5f2b-9fb1-c6ce6eb7e716',
  '6a8e91c4-88e3-5adf-94c1-4bec0f4c1fdb',
  '2ee958bd-3ba5-568e-a643-3b3e74c392ba',
  'e32f81bd-d61d-5281-9f2b-750875e31cd9',
  '17c1fb45-1290-52c8-be8f-91271af11f28',
  '0fb69c00-4f6c-5796-be3c-efc880b0bfc6',
  'be2b9be4-f613-525f-b43c-8ba18f3c85e1',
  '7384a49d-f281-522d-bf94-e280db58db1c',
  '0a61b19c-2f14-5df2-9afa-51c854edf55a',
  '8f24231b-0c3c-5c61-a202-e55ae36b03ff',
  'd3b10f60-34be-54e7-bbff-25cc78a3230d',
  'd3c44c5e-e695-5fed-adc3-9e281ea670c3'
);

-- 4) Borrar las tareas-hito (ahora viven en la tabla de hitos)
delete from public.tasks where id in ('d0b1d3d8-96c3-500b-8a9d-31d375e73af6', '5cd4e149-844a-57d8-9595-ca3cc3b00355', '23e00b99-a1d3-531a-844e-76a17376f7cb', '15ec4076-fe8a-55d7-87ee-641b3b4b7833', '9f6af53a-7fd8-5353-8dde-4ff00954ce68', '0d3b7663-3ea2-5437-b0eb-99f80b0f001a', '162073e9-cec0-5754-a52a-a65b5a7a0c96', 'a3fe5475-7907-5efb-ada0-a8a5eb8eef8c', '2e9f6aa5-b50e-5bca-95ea-28eeb27081d9', 'f7dc3d28-fb16-5d31-a38b-43324c5ec2e8');

-- 5) Mover a la bandeja "sin fecha" las pendientes estacionadas el 29/08
update public.tasks set date = null
where date = '2026-08-29' and description like '%[Migrado sin fecha — reprogramar]%';

update public.tasks
set description = nullif(trim(both E' \n' from replace(description, '[Migrado sin fecha — reprogramar]', '')), '')
where description like '%[Migrado sin fecha — reprogramar]%';

-- Resumen
select (select count(*) from public.hitos) as hitos,
       (select count(*) from public.tasks where hito_id is not null) as tareas_vinculadas,
       (select count(*) from public.tasks where date is null) as tareas_sin_fecha;