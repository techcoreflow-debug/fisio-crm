-- ============================================================================
-- Fisio — Migration 0011: preferências de notificação da empresa
-- ============================================================================
-- A tela de Configurações tinha checkboxes de notificação que não
-- persistiam em lugar nenhum (puro estado local, sem efeito real).
-- Passam a ser um jsonb na própria empresa, editável e lido de verdade.

alter table companies
  add column notification_preferences jsonb not null default '{
    "sem_evolucao_48h": true,
    "tasy_inconsistencias": true,
    "contratos_vencendo": true
  }'::jsonb;
