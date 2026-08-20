-- ============================================================================
-- Fisio — Migration 0031: transferência de internação (preserva o Nr. Atendimento)
-- ============================================================================
-- Cenário real: paciente internado na Enfermaria vai pra UTI (que pode
-- ser atendida por outra empresa/equipe, fora do nosso sistema) — e
-- depois VOLTA pra Enfermaria com o MESMO Nr. Atendimento. Dar alta
-- nesse meio-tempo quebra a continuidade (a volta viraria uma
-- internação nova, desconectada do histórico). "transferido" é um
-- terceiro status, entre "internado" e "alta" — congela a internação
-- de origem sem fechar ela de vez.

alter table admissions
  add column transferred_at timestamptz,
  add column transfer_destino text;
