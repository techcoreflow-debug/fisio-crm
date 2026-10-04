-- ============================================================================
-- Fisio — Migration 0033: dados opcionais do fisioterapeuta
-- ============================================================================
-- Pedido explícito: data de nascimento, CPF, tipo do registro profissional
-- (CREFITO, CRM etc.) e número do registro, todos OPCIONAIS no cadastro de
-- fisioterapeutas — nenhum vira obrigatório, e nenhum dado existente é
-- tocado (`professional_registry`, já em uso, continua como estava;
-- `registry_type`/`registry_number` são campos novos e independentes,
-- usados daqui pra frente pra derivar `professional_registry` quando
-- preenchidos).

alter table physiotherapists
  add column birth_date date,
  add column document text,
  add column registry_type text,
  add column registry_number text;
