-- ============================================================================
-- Fisio — Migration 0024: higienização com prazo automático
-- ============================================================================
-- Guarda quando o leito entrou em higienização, pra poder calcular
-- sozinho quando as 2h padrão passaram e ele pode voltar a "livre" —
-- sem precisar de alguém clicar em "Concluir" manualmente (mas o botão
-- manual continua existindo, pra liberar antes das 2h se quiser).

alter table beds
  add column higienizacao_desde timestamptz;
