-- ============================================================================
-- Fisio — Migration 0013: deduplicação real da importação Tasy
-- ============================================================================
-- Duas garantias que o parser de importação depende:
--
-- 1) "Nr. Atend." do Tasy identifica uma internação. Reimportar o mesmo
--    período (ou um período sobreposto) precisa cair na MESMA internação,
--    não criar uma segunda. `external_reference` guarda esse número.
--
-- 2) Cada linha de produção do Tasy (internação + procedimento + data/hora
--    exata) tem uma referência estável. Reimportar não pode duplicar o
--    lançamento — `tasy_reference` com índice único garante isso no nível
--    do banco (insert com "on conflict do nothing"), não só na aplicação.
--
-- Os demais cadastros (hospital, convênio, fisioterapeuta, paciente,
-- procedimento) usam "buscar por nome/código, criar se não existir" — por
-- isso ganham uma constraint de unicidade por empresa também. Limitação
-- conhecida: nomes de pessoas (fisioterapeuta, paciente) não têm um
-- identificador melhor vindo do relatório (sem CPF/CREFITO) — duas pessoas
-- reais com o mesmo nome cairiam no mesmo cadastro. Aceitável por ora;
-- documentado para quando houver um identificador melhor.

alter table admissions add column external_reference text;
alter table admissions add constraint admissions_company_external_ref_unique unique (company_id, external_reference);

alter table daily_production add column tasy_reference text;
alter table daily_production add constraint daily_production_company_tasy_ref_unique unique (company_id, tasy_reference);

alter table hospitals add constraint hospitals_company_name_unique unique (company_id, name);
alter table health_insurances add constraint health_insurances_company_name_unique unique (company_id, name);
alter table physiotherapists add constraint physiotherapists_company_name_unique unique (company_id, full_name);
alter table patients add constraint patients_company_name_unique unique (company_id, full_name);
alter table procedures add constraint procedures_company_code_unique unique (company_id, code);
