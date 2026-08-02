-- ============================================================================
-- Fisio — Migration 0018: hora no lançamento de produção
-- ============================================================================
-- Todo lançamento de procedimento passa a ter horário, não só data —
-- necessário pra saber exatamente quando o atendimento aconteceu (e ajuda
-- a conciliação com o Tasy, que também tem horário exato).

alter table daily_production
  add column production_time time not null default '08:00';

alter table daily_production alter column production_time drop default;
