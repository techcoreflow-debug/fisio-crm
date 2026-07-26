-- ============================================================================
-- Fisio — Migration 0005: quartos (entre alas/unidades e leitos)
-- ============================================================================
-- Correção de modelo: o Fisio atende empresas de fisioterapia que prestam
-- serviço DENTRO de hospitais (um ou mais) — não empresas donas de clínica
-- própria. A hierarquia física real é:
--   Hospital → Ala/Unidade (units) → Quarto (rooms) → Leito (beds)
-- Quartos ficam entre a unidade (ala) e o leito porque um quarto pode ter
-- mais de um leito (enfermaria compartilhada) ou só um (apartamento).

create table rooms (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  unit_id uuid not null references units (id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now()
);

create index rooms_unit_id_idx on rooms (unit_id);

alter table rooms enable row level security;

create policy "rooms_isolation" on rooms
  for all using (company_id = current_company_id());

-- Leito passa a poder referenciar o quarto (opcional, para dados antigos
-- ou leitos avulsos sem quarto formal cadastrado).
alter table beds
  add column room_id uuid references rooms (id) on delete set null;
