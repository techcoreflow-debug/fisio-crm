-- ============================================================================
-- Fisio — Migration 0016: ajustes de uso real (paciente, internação, contrato)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Pacientes: sexo + convênio com histórico de mudança
-- ---------------------------------------------------------------------------
alter table patients
  add column sexo text check (sexo in ('M', 'F')),
  add column health_insurance_id uuid references health_insurances (id);

-- Log append-only: cada linha é "a partir desta data, o convênio passou a
-- ser X". O convênio atual do paciente é sempre patients.health_insurance_id
-- (mantido em sincronia pela aplicação); esta tabela é só o histórico.
create table patient_insurance_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  patient_id uuid not null references patients (id) on delete cascade,
  health_insurance_id uuid references health_insurances (id),
  changed_at timestamptz not null default now()
);

create index patient_insurance_history_patient_id_idx on patient_insurance_history (patient_id);

alter table patient_insurance_history enable row level security;
create policy "patient_insurance_history_isolation" on patient_insurance_history
  for all using (company_id = current_company_id() or is_platform_admin());

-- ---------------------------------------------------------------------------
-- Internações: código legível + data/hora exata da alta + confirmação de
-- alta sem atendimento no dia
-- ---------------------------------------------------------------------------
alter table admissions
  add column admission_number bigint generated always as identity,
  add column discharge_at timestamptz,
  add column confirmou_sem_atendimento_alta boolean not null default false;

-- ---------------------------------------------------------------------------
-- Contratos: aplica a todas as unidades do hospital, ou só a alas específicas
-- ---------------------------------------------------------------------------
alter table contracts
  add column aplica_todas_unidades boolean not null default true;

create table contract_units (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  contract_id uuid not null references contracts (id) on delete cascade,
  unit_id uuid not null references units (id) on delete cascade,
  unique (contract_id, unit_id)
);

alter table contract_units enable row level security;
create policy "contract_units_isolation" on contract_units
  for all using (company_id = current_company_id() or is_platform_admin());

-- Precisam das mesmas concessões de tabela dos demais (migration 0012)
grant select, insert, update, delete on public.patient_insurance_history, public.contract_units to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'patient_insurance_history'
  ) then
    execute 'alter publication supabase_realtime add table public.patient_insurance_history';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'contract_units'
  ) then
    execute 'alter publication supabase_realtime add table public.contract_units';
  end if;
end $$;
