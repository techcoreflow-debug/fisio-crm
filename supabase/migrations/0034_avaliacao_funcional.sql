-- ============================================================================
-- Fisio — Migration 0034: avaliação funcional estruturada
-- ============================================================================
-- Até aqui a evolução clínica era só texto livre: o sistema provava
-- produção (o que foi feito), mas não resultado (o paciente melhorou?).
-- Esta tabela guarda escalas funcionais padronizadas (Barthel, MRC-SS, IMS,
-- FSS-ICU, Borg) em três momentos — admissão, reavaliação e alta — o que
-- permite curva de ganho funcional por paciente, por unidade e por período.
--
-- Uma linha = uma escala aplicada em uma data. O escore é gravado já
-- calculado (e conferido no app), e os itens ficam em jsonb pra auditoria
-- e pra permitir reabrir a avaliação sem perder a resposta de cada item.

create table functional_assessments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  admission_id uuid not null references admissions (id) on delete cascade,
  physiotherapist_id uuid references physiotherapists (id),
  escala text not null check (escala in ('barthel', 'mrc', 'ims', 'fss_icu', 'borg')),
  momento text not null check (momento in ('admissao', 'reavaliacao', 'alta')),
  score integer not null check (score >= 0 and score <= 100),
  itens jsonb not null default '{}'::jsonb,
  observacao text,
  avaliado_em date not null default current_date,
  created_at timestamptz not null default now()
);

create index functional_assessments_admission_idx on functional_assessments (admission_id, avaliado_em);
create index functional_assessments_company_idx on functional_assessments (company_id, avaliado_em);

alter table functional_assessments enable row level security;

create policy "functional_assessments_isolation" on functional_assessments
  for all using (company_id = current_company_id() or is_platform_admin());

-- Dado clínico: leitura, criação e exclusão (correção de lançamento errado);
-- não há edição — uma reavaliação é uma linha nova, preservando a curva.
grant select, insert, delete on public.functional_assessments to authenticated;

alter publication supabase_realtime add table functional_assessments;
