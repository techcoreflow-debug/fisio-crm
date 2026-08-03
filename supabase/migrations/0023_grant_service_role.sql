-- ============================================================================
-- Fisio — Migration 0023: garantir acesso do service_role
-- ============================================================================
-- A Edge Function create-user usa a service_role key pra checar se quem
-- chamou é admin InovareTech e pra criar o perfil do usuário novo. Isso
-- só funciona se o role `service_role` tiver GRANT nas tabelas — em
-- teoria já vem por padrão no Supabase, mas como as migrations
-- anteriores só concederam explicitamente pra `authenticated`, deixa
-- isso garantido de propósito, sem depender do que veio "de fábrica".

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Qualquer tabela criada depois desta migration já nasce com o grant,
-- sem precisar lembrar de repetir isso em toda migration nova.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
