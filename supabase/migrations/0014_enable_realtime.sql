-- ============================================================================
-- Fisio — Migration 0014: habilitar Realtime em todas as tabelas
-- ============================================================================
-- O front-end assina "postgres_changes" pra manter as telas em sincronia
-- sem precisar sair e voltar. Isso só funciona se a tabela estiver na
-- publicação `supabase_realtime` — e tabela nova criada por migration NÃO
-- entra nela automaticamente (é o mesmo botão "Enable Realtime" que existe
-- no Table Editor do painel, só que via SQL e pra todas de uma vez).
--
-- Idempotente: pode rodar de novo sem erro, só adiciona quem ainda não
-- está na publicação.

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'companies', 'profiles', 'hospitals', 'clinics', 'units', 'cost_centers', 'teams',
      'health_insurances', 'contracts', 'physiotherapists', 'patients', 'beds', 'rooms',
      'admissions', 'procedures', 'daily_production', 'clinical_evolutions', 'tasy_imports',
      'tasy_import_rows', 'shifts', 'activity_log', 'receivables'
    ])
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
