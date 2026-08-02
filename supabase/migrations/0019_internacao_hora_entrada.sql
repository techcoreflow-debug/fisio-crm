-- ============================================================================
-- Fisio — Migration 0019: hora de entrada na internação
-- ============================================================================
-- Simétrico ao discharge_at: a entrada também passa a ter horário, não só
-- data — necessário pro fluxo "Novo Atendimento" registrar o momento real.

alter table admissions
  add column admission_time time not null default '08:00';

alter table admissions alter column admission_time drop default;
