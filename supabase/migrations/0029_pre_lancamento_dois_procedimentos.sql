-- ============================================================================
-- Fisio — Migration 0029: pré-lançamento com 2 procedimentos (Motora + Respiratória)
-- ============================================================================
-- Ajuste de escopo: por padrão, todo paciente tem os dois tipos de
-- atendimento (Motora e Respiratória) — o pré-lançamento reflete isso.
-- Substitui o campo único da migration 0028 por dois campos nomeados,
-- e exige (na aplicação) que os dois sejam preenchidos juntos, nunca só um.

alter table admissions
  drop column if exists pre_lancamento_procedure_id;

alter table admissions
  add column pre_lancamento_motora_id uuid references procedures (id),
  add column pre_lancamento_respiratoria_id uuid references procedures (id);
