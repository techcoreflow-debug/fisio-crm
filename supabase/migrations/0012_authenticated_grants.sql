-- ============================================================================
-- Fisio — Migration 0012: permissões de tabela para o role authenticated
-- ============================================================================
-- RLS (row level security) e GRANT (privilégio de tabela) são camadas
-- diferentes no Postgres — RLS decide QUAIS linhas, GRANT decide SE a
-- operação é permitida na tabela. As migrations anteriores configuraram
-- RLS em todas as tabelas mas nunca concederam o GRANT básico ao role
-- `authenticated`, então todo usuário logado tomava "permission denied"
-- (42501) antes mesmo da RLS entrar em ação. Este é o motivo da tela de
-- login ficar presa em "preparando acesso" — a consulta ao próprio perfil
-- já batia nessa barreira.

grant usage on schema public to authenticated;

grant select, insert, update, delete on
  public.companies,
  public.profiles,
  public.hospitals,
  public.clinics,
  public.units,
  public.cost_centers,
  public.teams,
  public.health_insurances,
  public.contracts,
  public.physiotherapists,
  public.patients,
  public.beds,
  public.rooms,
  public.admissions,
  public.procedures,
  public.daily_production,
  public.clinical_evolutions,
  public.tasy_imports,
  public.tasy_import_rows,
  public.shifts,
  public.receivables,
  public.platform_admin_emails
to authenticated;

-- activity_log é auditoria: só criação e leitura, nunca update/delete
-- (a migration 0006 já revogou isso de PUBLIC de propósito — mantém aqui).
grant select, insert on public.activity_log to authenticated;
