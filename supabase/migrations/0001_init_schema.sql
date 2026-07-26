-- ============================================================================
-- Fisio — Migration 0001: schema base multiempresa
-- ============================================================================
-- Convenção de isolamento: toda tabela de negócio tem company_id, e uma
-- policy de RLS garante que cada usuário só enxerga linhas da(s) empresa(s)
-- às quais está vinculado via a tabela profiles. Rode esta migration num
-- projeto Supabase novo (conta separada do Fisio).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Empresas (tenant raiz)
-- ---------------------------------------------------------------------------
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cnpj text unique,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Perfis de usuário — vínculo entre auth.users e uma empresa
-- ---------------------------------------------------------------------------
create type user_role as enum ('admin', 'gestor', 'financeiro', 'fisioterapeuta', 'auditor');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  company_id uuid not null references companies (id) on delete cascade,
  full_name text not null,
  role user_role not null default 'fisioterapeuta',
  created_at timestamptz not null default now()
);

create index profiles_company_id_idx on profiles (company_id);

-- Função auxiliar: empresa do usuário autenticado
create or replace function current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Estrutura organizacional
-- ---------------------------------------------------------------------------
create table hospitals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  cnpj text,
  address text,
  created_at timestamptz not null default now()
);

create table clinics (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  address text,
  created_at timestamptz not null default now()
);

create table units (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  hospital_id uuid references hospitals (id) on delete cascade,
  clinic_id uuid references clinics (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  constraint unit_belongs_to_one_parent check (
    (hospital_id is not null and clinic_id is null) or
    (hospital_id is null and clinic_id is not null)
  )
);

create table cost_centers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Convênios e contratos
-- ---------------------------------------------------------------------------
create table health_insurances (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  ans_code text,
  created_at timestamptz not null default now()
);

create table contracts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  hospital_id uuid references hospitals (id),
  health_insurance_id uuid references health_insurances (id),
  cost_center_id uuid references cost_centers (id),
  start_date date not null,
  end_date date,
  monthly_value numeric(14, 2),
  status text not null default 'ativo',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Fisioterapeutas, pacientes, internações, leitos
-- ---------------------------------------------------------------------------
create table physiotherapists (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  user_id uuid references auth.users (id),
  team_id uuid references teams (id),
  full_name text not null,
  professional_registry text,
  created_at timestamptz not null default now()
);

create table patients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  full_name text not null,
  birth_date date,
  document text,
  created_at timestamptz not null default now()
);

create table beds (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  unit_id uuid not null references units (id) on delete cascade,
  code text not null,
  status text not null default 'livre',
  created_at timestamptz not null default now()
);

create table admissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  patient_id uuid not null references patients (id) on delete cascade,
  hospital_id uuid references hospitals (id),
  unit_id uuid references units (id),
  bed_id uuid references beds (id),
  health_insurance_id uuid references health_insurances (id),
  admission_date date not null,
  discharge_date date,
  status text not null default 'internado',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Procedimentos, produção diária, evolução clínica
-- ---------------------------------------------------------------------------
create table procedures (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  code text,
  category text,
  created_at timestamptz not null default now()
);

create table daily_production (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  admission_id uuid references admissions (id) on delete cascade,
  physiotherapist_id uuid references physiotherapists (id),
  procedure_id uuid references procedures (id),
  production_date date not null,
  source text not null default 'manual' check (source in ('manual', 'tasy')),
  created_at timestamptz not null default now()
);

create table clinical_evolutions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  admission_id uuid not null references admissions (id) on delete cascade,
  physiotherapist_id uuid references physiotherapists (id),
  content text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Habilita RLS e cria a policy padrão de isolamento por empresa
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'companies', 'profiles', 'hospitals', 'clinics', 'units', 'cost_centers',
      'teams', 'health_insurances', 'contracts', 'physiotherapists', 'patients',
      'beds', 'admissions', 'procedures', 'daily_production', 'clinical_evolutions'
    ])
  loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;

-- companies: usuário só vê a própria empresa
create policy "companies_isolation" on companies
  for all using (id = current_company_id());

-- profiles: usuário só vê perfis da própria empresa
create policy "profiles_isolation" on profiles
  for all using (company_id = current_company_id());

-- demais tabelas: mesmo padrão, generalizado
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'hospitals', 'clinics', 'units', 'cost_centers', 'teams', 'health_insurances',
      'contracts', 'physiotherapists', 'patients', 'beds', 'admissions', 'procedures',
      'daily_production', 'clinical_evolutions'
    ])
  loop
    execute format(
      'create policy "%s_isolation" on %I for all using (company_id = current_company_id());',
      t, t
    );
  end loop;
end $$;
