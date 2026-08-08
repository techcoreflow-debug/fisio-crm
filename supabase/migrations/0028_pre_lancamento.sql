-- ============================================================================
-- Fisio — Migration 0028: pré-lançamento de procedimento
-- ============================================================================
-- Na triagem, quem cadastra a internação já pode indicar qual código de
-- procedimento deve ser usado depois — reduz erro de codificação na hora
-- de lançar de verdade. É só uma referência/sugestão, não lança nada
-- sozinho.

alter table admissions
  add column pre_lancamento_procedure_id uuid references procedures (id);
