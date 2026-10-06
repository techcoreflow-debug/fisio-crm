-- ============================================================================
-- Fisio — Migration 0037: alta direta da UTI externa
-- ============================================================================
-- Paciente transferido pra UTI de outra empresa pode ter alta (hospitalar ou
-- óbito) sem "retornar" antes — o fluxo anterior obrigava a reabrir a
-- internação só pra fechá-la, e os pacientes ficavam sem baixa.
--   alta_em_uti_externa: marca a internação cuja alta ocorreu na UTI externa
--     (o destino continua em transfer_destino). Permite filtrar e separar o
--     óbito/alta que NÃO aconteceu sob os cuidados da nossa equipe.
--   tipo 'alta_externa' no rastreio de movimentação (admission_unit_history).

alter table admissions add column if not exists alta_em_uti_externa boolean not null default false;

alter table admission_unit_history drop constraint if exists admission_unit_history_tipo_check;
alter table admission_unit_history add constraint admission_unit_history_tipo_check
  check (tipo in ('mudanca_unidade', 'transferencia_externa', 'retorno_transferencia', 'alta_externa'));
