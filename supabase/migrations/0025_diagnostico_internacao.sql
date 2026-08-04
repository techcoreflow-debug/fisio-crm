-- ============================================================================
-- Fisio — Migration 0025: diagnóstico na internação
-- ============================================================================
-- Texto livre, preenchido ao cadastrar a internação — aparece na
-- listagem de Pacientes Internados e pode entrar na lista impressa.

alter table admissions
  add column diagnostico text;
