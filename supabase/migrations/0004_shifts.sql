-- ============================================================================
-- Fisio — Migration 0004: escalas de trabalho
-- ============================================================================

create type shift_period as enum ('manha', 'tarde', 'noite');

create table shifts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  physiotherapist_id uuid not null references physiotherapists (id) on delete cascade,
  unit_id uuid references units (id),
  shift_date date not null,
  period shift_period not null,
  created_at timestamptz not null default now(),
  unique (physiotherapist_id, shift_date, period)
);

create index shifts_shift_date_idx on shifts (shift_date);

alter table shifts enable row level security;

create policy "shifts_isolation" on shifts
  for all using (company_id = current_company_id());
