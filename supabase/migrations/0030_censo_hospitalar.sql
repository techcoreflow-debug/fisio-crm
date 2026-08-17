-- ============================================================================
-- Fisio — Migration 0030: censo diário do hospital
-- ============================================================================
-- O sistema só sabe quantos pacientes A EQUIPE DE FISIO atende — não sabe
-- quantos estão internados no hospital como um todo (isso é um dado do
-- hospital, não nosso). Pra calcular "% dos internados que têm
-- indicação de fisioterapia", precisa desse número lançado manualmente,
-- um valor por hospital por dia.

create table hospital_census (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  hospital_id uuid not null references hospitals (id) on delete cascade,
  census_date date not null,
  total_internados integer not null check (total_internados >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hospital_id, census_date)
);

alter table hospital_census enable row level security;
create policy "hospital_census_isolation" on hospital_census
  for all using (company_id = current_company_id() or is_platform_admin());

grant select, insert, update, delete on public.hospital_census to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'hospital_census'
  ) then
    execute 'alter publication supabase_realtime add table public.hospital_census';
  end if;
end $$;
