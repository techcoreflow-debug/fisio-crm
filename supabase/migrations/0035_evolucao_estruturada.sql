-- ============================================================================
-- Fisio — Migration 0035: evolução clínica estruturada
-- ============================================================================
-- Guarda, junto da evolução em texto livre, o resumo estruturado (resumo,
-- intercorrências, condutas, metas) que o fisioterapeuta CONFIRMOU — seja
-- ele sugerido pela IA ou digitado à mão. O texto original continua sendo
-- o registro oficial; a coluna é opcional e nula para evoluções antigas.

alter table clinical_evolutions add column if not exists estruturado jsonb;
