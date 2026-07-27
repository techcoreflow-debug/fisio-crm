-- ============================================================================
-- Fisio — Migration 0015: glosa (por procedimento e/ou por competência)
-- ============================================================================
-- Parâmetro na empresa decide o modo:
--   glosa_por_procedimento = true  → glosa é lançada por procedimento em
--     daily_production, e a competência soma automaticamente.
--   glosa_por_procedimento = false → glosa é digitada direto na conta a
--     receber (competência), sem detalhar procedimento a procedimento.
-- Os dois conjuntos de campos existem sempre — o parâmetro só muda qual
-- tela a pessoa usa pra registrar, e qual valor o Financeiro trata como
-- fonte da verdade ao mostrar "valor líquido esperado".

alter table companies
  add column glosa_por_procedimento boolean not null default false;

alter table daily_production
  add column glosado boolean not null default false,
  add column valor_glosado numeric(12, 2),
  add column motivo_glosa text,
  add column data_glosa date;

alter table receivables
  add column valor_glosado numeric(14, 2) not null default 0,
  add column motivo_glosa text;
