-- ============================================================================
-- Fisio — Migration 0022: procedimento sugerido na fila
-- ============================================================================
-- Ao distribuir, quem distribui pode sugerir qual procedimento espera que
-- seja feito — o fisioterapeuta vê isso em Minha Fila e lança com um
-- clique. Opcional: sem sugestão, ele escolhe na hora de lançar.

alter table patient_queue
  add column procedure_id uuid references procedures (id);
