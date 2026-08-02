-- ============================================================================
-- Fisio — Migration 0017: Tasy vira conciliação, não carga
-- ============================================================================
-- Mudança de modelo: a equipe lança o procedimento manualmente primeiro.
-- O Tasy chega depois como conferência — cada linha do relatório tenta
-- casar com um lançamento manual já existente (paciente + código do
-- procedimento + data). Bateu = confirmado/baixado. Não bateu = fica como
-- pendência pra alguém decidir (não vira glosa sozinho).
--
-- A importação NÃO cria mais hospital/convênio/fisioterapeuta/paciente/
-- procedimento/internação — isso é tudo cadastro manual, anterior ao Tasy.

alter table daily_production
  add column confirmado_tasy boolean not null default false,
  add column confirmado_em timestamptz;

alter table tasy_import_rows
  add column matched_daily_production_id uuid references daily_production (id);

alter table tasy_import_rows drop constraint tasy_import_rows_status_check;
alter table tasy_import_rows add constraint tasy_import_rows_status_check
  check (status in ('confirmado', 'pendente', 'ignorado'));

comment on column tasy_import_rows.created_patient_id is
  'Legado do modelo antigo (carga) — não usado no modelo de conciliação.';
comment on column tasy_import_rows.created_admission_id is
  'Legado do modelo antigo (carga) — não usado no modelo de conciliação.';
comment on column tasy_import_rows.created_daily_production_id is
  'Legado do modelo antigo (carga) — não usado no modelo de conciliação.';
