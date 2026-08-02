-- ============================================================================
-- Fisio — Migration 0020: permissões granulares + faturamento manual
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Permissões: por empresa + papel + módulo, quatro ações (ver/criar/editar/
-- excluir). Sem linha aqui = usa o default embutido no código (ver
-- src/lib/permissions.ts) — só precisa de linha própria quando alguém
-- ajustar manualmente.
-- ---------------------------------------------------------------------------
create table role_permissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  role text not null,
  module_slug text not null,
  can_view boolean not null default true,
  can_create boolean not null default true,
  can_edit boolean not null default true,
  can_delete boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, role, module_slug)
);

alter table role_permissions enable row level security;
create policy "role_permissions_isolation" on role_permissions
  for all using (company_id = current_company_id() or is_platform_admin());

grant select, insert, update, delete on public.role_permissions to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'role_permissions'
  ) then
    execute 'alter publication supabase_realtime add table public.role_permissions';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Faturamento manual (ponte até a importação automática do relatório de
-- Repasse ficar viável — hoje só existe em PDF ilegível por OCR). Mesma
-- chave de conciliação: internação (Nr. Atendimento) + procedimento + data.
-- ---------------------------------------------------------------------------
create table billing_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  admission_id uuid not null references admissions (id) on delete cascade,
  procedure_id uuid references procedures (id),
  competencia date not null,
  data_atendimento date not null,
  quantidade integer not null default 1,
  valor_repasse numeric(12, 2) not null,
  valor_glosado numeric(12, 2) not null default 0,
  origem text not null default 'manual' check (origem in ('manual', 'importado')),
  created_at timestamptz not null default now()
);

create index billing_entries_admission_id_idx on billing_entries (admission_id);
create index billing_entries_competencia_idx on billing_entries (competencia);

alter table billing_entries enable row level security;
create policy "billing_entries_isolation" on billing_entries
  for all using (company_id = current_company_id() or is_platform_admin());

grant select, insert, update, delete on public.billing_entries to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'billing_entries'
  ) then
    execute 'alter publication supabase_realtime add table public.billing_entries';
  end if;
end $$;
