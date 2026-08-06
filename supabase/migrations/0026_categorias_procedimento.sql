-- ============================================================================
-- Fisio — Migration 0026: categorias de procedimento
-- ============================================================================
-- Antes, "categoria" em procedures era texto livre — cada um digitava do
-- seu jeito (Respiratória, respiratoria, RESPIRATÓRIA...) e isso quebrava
-- os agrupamentos por categoria nos relatórios/painéis. Agora existe uma
-- lista real, escolhida por combo box — o campo `procedures.category`
-- continua sendo texto (não quebra nada que já lê esse campo), só que
-- agora só aceita valores que vêm dessa lista.

create table procedure_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);

alter table procedure_categories enable row level security;
create policy "procedure_categories_isolation" on procedure_categories
  for all using (company_id = current_company_id() or is_platform_admin());

grant select, insert, update, delete on public.procedure_categories to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'procedure_categories'
  ) then
    execute 'alter publication supabase_realtime add table public.procedure_categories';
  end if;
end $$;

-- Popula com as categorias que já estão em uso hoje em cada empresa, pra
-- ninguém perder o que já tinha digitado antes dessa migration.
insert into procedure_categories (company_id, name)
select distinct company_id, category
from procedures
where category is not null and trim(category) <> ''
on conflict (company_id, name) do nothing;
