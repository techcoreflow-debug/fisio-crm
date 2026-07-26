-- ============================================================================
-- Fisio — Migration 0006: trilha de auditoria
-- ============================================================================
-- Registro real de ações sensíveis (criar/editar/excluir cadastros,
-- altas, importações). Alimentado automaticamente pela camada de
-- repositório — nenhuma tela grava aqui diretamente.

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  action text not null check (action in ('criado', 'editado', 'excluido', 'alta', 'importado', 'desfeito')),
  entity_type text not null,
  entity_label text not null,
  created_at timestamptz not null default now()
);

create index activity_log_company_id_idx on activity_log (company_id);
create index activity_log_created_at_idx on activity_log (created_at desc);

alter table activity_log enable row level security;

create policy "activity_log_isolation" on activity_log
  for all using (company_id = current_company_id());

-- Auditoria não pode ser editada ou apagada por ninguém, nem pelo dono
-- da empresa — só o próprio sistema grava (via função/trigger no banco
-- real; no mock, apenas o repository grava, nunca a UI).
revoke update, delete on activity_log from public;
