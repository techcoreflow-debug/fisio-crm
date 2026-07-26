-- ============================================================================
-- Fisio — Migration 0008: admin InovareTech (global) vs admin de empresa
-- ============================================================================
-- Dois níveis de acesso:
--   - Admin da InovareTech: is_platform_admin = true, sem empresa fixa
--     (company_id null) — vê e opera em todas as empresas.
--   - Demais usuários (incluindo "admin" de uma empresa específica):
--     continuam vinculados a uma única empresa via profiles.company_id,
--     como definido na migration 0001.

alter table profiles alter column company_id drop not null;
alter table profiles add column is_platform_admin boolean not null default false;

create or replace function is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_platform_admin from profiles p where p.id = auth.uid()), false);
$$;

-- Remove as policies antigas (uma empresa só) para recriar com o bypass do admin global
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'companies', 'profiles', 'hospitals', 'clinics', 'units', 'cost_centers', 'teams',
      'health_insurances', 'contracts', 'physiotherapists', 'patients', 'beds', 'admissions',
      'procedures', 'daily_production', 'clinical_evolutions', 'tasy_imports', 'tasy_import_rows',
      'shifts', 'rooms', 'activity_log', 'receivables'
    ])
  loop
    execute format('drop policy if exists "%s_isolation" on %I;', t, t);
  end loop;
end $$;

create policy "companies_isolation" on companies
  for all using (id = current_company_id() or is_platform_admin());

create policy "profiles_isolation" on profiles
  for all using (company_id = current_company_id() or is_platform_admin());

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'hospitals', 'clinics', 'units', 'cost_centers', 'teams', 'health_insurances', 'contracts',
      'physiotherapists', 'patients', 'beds', 'admissions', 'procedures', 'daily_production',
      'clinical_evolutions', 'tasy_imports', 'tasy_import_rows', 'shifts', 'rooms',
      'activity_log', 'receivables'
    ])
  loop
    execute format(
      'create policy "%s_isolation" on %I for all using (company_id = current_company_id() or is_platform_admin());',
      t, t
    );
  end loop;
end $$;
