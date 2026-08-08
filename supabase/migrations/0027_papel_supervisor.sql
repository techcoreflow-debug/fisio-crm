-- ============================================================================
-- Fisio — Migration 0027: papel supervisor
-- ============================================================================
-- Mesmo acesso do fisioterapeuta (lançador) nos módulos do dia a dia, mais
-- visão e controle dos painéis operacionais (Painel do Gestor, Dashboard
-- Operacional, Impacto Assistencial, Leitos, Escalas, Evolução Clínica,
-- Fisioterapeutas, Procedimentos, Relatórios) — sem ser admin, e sem
-- nenhum acesso a informação financeira/faturamento.

alter type user_role add value if not exists 'supervisor';
