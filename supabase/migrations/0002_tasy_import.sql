-- ============================================================================
-- Fisio — Migration 0002: importação Tasy
-- ============================================================================

create table tasy_imports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  file_name text not null,
  imported_by uuid references auth.users (id),
  total_rows integer not null default 0,
  inconsistencies integer not null default 0,
  status text not null default 'concluida' check (status in ('processando', 'concluida', 'desfeita', 'erro')),
  created_at timestamptz not null default now(),
  undone_at timestamptz
);

create table tasy_import_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references tasy_imports (id) on delete cascade,
  company_id uuid not null references companies (id) on delete cascade,
  raw_data jsonb not null,
  -- registro criado nesta linha (para permitir desfazer a importação)
  created_patient_id uuid references patients (id),
  created_admission_id uuid references admissions (id),
  created_daily_production_id uuid references daily_production (id),
  status text not null default 'novo' check (status in ('novo', 'atualizado', 'inconsistencia', 'ignorado')),
  error_message text,
  created_at timestamptz not null default now()
);

create index tasy_import_rows_import_id_idx on tasy_import_rows (import_id);

alter table tasy_imports enable row level security;
alter table tasy_import_rows enable row level security;

create policy "tasy_imports_isolation" on tasy_imports
  for all using (company_id = current_company_id());

create policy "tasy_import_rows_isolation" on tasy_import_rows
  for all using (company_id = current_company_id());
