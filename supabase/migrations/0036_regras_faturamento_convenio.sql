-- ============================================================================
-- Fisio — Migration 0036: regras de faturamento por convênio
-- ============================================================================
-- Alimenta a Prevenção de glosa (Fechamento) com as regras REAIS de cada
-- convênio, cadastradas por quem conhece o contrato — o sistema não presume
-- regra de convênio nenhum. Tudo opcional: sem preencher, vale a regra geral.
--   max_procedimentos_dia        — limite diário por internação (substitui o limite geral)
--   max_procedimentos_internacao — teto de procedimentos por internação (sessões autorizadas)
--   exige_diagnostico            — false desliga o alerta "sem diagnóstico" para este convênio

alter table health_insurances add column if not exists max_procedimentos_dia integer
  check (max_procedimentos_dia is null or max_procedimentos_dia > 0);
alter table health_insurances add column if not exists max_procedimentos_internacao integer
  check (max_procedimentos_internacao is null or max_procedimentos_internacao > 0);
alter table health_insurances add column if not exists exige_diagnostico boolean not null default true;
