-- ============================================================================
-- Fisio — Migration 0003: endereço estruturado (CEP, cidade, estado)
-- ============================================================================
-- Hospitais e clínicas passam a ter endereço estruturado em vez de um único
-- campo de texto livre. Cidade e estado são preenchidos automaticamente no
-- front-end a partir do CEP (API ViaCEP), mas ficam graváveis/editáveis aqui
-- como qualquer outro campo.

alter table hospitals
  drop column if exists address,
  add column cep text,
  add column street text,
  add column neighborhood text,
  add column city text,
  add column state text;

alter table clinics
  drop column if exists address,
  add column cep text,
  add column street text,
  add column neighborhood text,
  add column city text,
  add column state text;
