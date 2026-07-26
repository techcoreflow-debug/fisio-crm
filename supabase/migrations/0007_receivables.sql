-- ============================================================================
-- Fisio — Migration 0007: contas a receber
-- ============================================================================
-- Um lançamento por contrato por competência (mês). Gerado a partir do
-- valor mensal do contrato, com status de pagamento rastreado de verdade
-- (em vez de assumido). É a base real para inadimplência e fechamento
-- financeiro nos dashboards.

create type receivable_status as enum ('pendente', 'pago', 'atrasado');

create table receivables (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  contract_id uuid not null references contracts (id) on delete cascade,
  competencia date not null, -- primeiro dia do mês de referência
  amount numeric(14, 2) not null,
  due_date date not null,
  status receivable_status not null default 'pendente',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (contract_id, competencia)
);

create index receivables_company_id_idx on receivables (company_id);
create index receivables_competencia_idx on receivables (competencia);

alter table receivables enable row level security;

create policy "receivables_isolation" on receivables
  for all using (company_id = current_company_id());
