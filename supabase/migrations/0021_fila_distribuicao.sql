-- ============================================================================
-- Fisio — Migration 0021: fila de distribuição de atendimentos
-- ============================================================================
-- Quando alguém distribui pacientes internados pra um fisioterapeuta
-- (a "lista do dia"), cada linha aqui é um item dessa fila — o
-- fisioterapeuta enxerga só os seus, em ordem, na agenda dele.

create table patient_queue (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  admission_id uuid not null references admissions (id) on delete cascade,
  physiotherapist_id uuid not null references physiotherapists (id) on delete cascade,
  data date not null,
  sequencia integer not null,
  status text not null default 'pendente' check (status in ('pendente', 'concluido')),
  distribuido_por uuid references profiles (id),
  created_at timestamptz not null default now(),
  unique (company_id, admission_id, data)
);

create index patient_queue_fisio_data_idx on patient_queue (physiotherapist_id, data);

alter table patient_queue enable row level security;
create policy "patient_queue_isolation" on patient_queue
  for all using (company_id = current_company_id() or is_platform_admin());

grant select, insert, update, delete on public.patient_queue to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'patient_queue'
  ) then
    execute 'alter publication supabase_realtime add table public.patient_queue';
  end if;
end $$;
