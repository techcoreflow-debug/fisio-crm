-- ============================================================================
-- Fisio — Migration 0032: rastreio de movimentação de unidade
-- ============================================================================
-- Cenário real: o hospital passou a ter UTI própria (mesma empresa, mesma
-- equipe de fisio cuidando) — mover o paciente da Enfermaria pra lá não
-- deve usar o fluxo de "Transferir" (pensado pra UTI de OUTRA empresa,
-- que congela a internação). O jeito certo é só trocar a unidade da
-- internação, sem fechar nada — mas isso precisa deixar rastro, e hoje
-- não deixa: a edição comum de internação (unit_id) nunca gravou nada em
-- auditoria.
--
-- Esta migration cria uma tabela dedicada pra isso — não dá pra reaproveitar
-- `activity_log` porque ele só guarda um texto solto por evento, sem
-- relacionar unidade de origem/destino, então não dá pra montar um
-- relatório estruturado (nem calcular "quanto tempo ficou em cada
-- unidade") em cima dele. `admission_unit_history` junta num lugar só os
-- três jeitos de uma internação trocar de lugar: mudança interna (tipo
-- novo), e as duas transferências externas que já existiam
-- (`transferir`/`retornarDeTransferencia`, migration 0031) — que também
-- passam a gravar aqui, pra ter todo o rastreio num relatório só.

create table admission_unit_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  admission_id uuid not null references admissions (id) on delete cascade,
  tipo text not null check (tipo in ('mudanca_unidade', 'transferencia_externa', 'retorno_transferencia')),
  hospital_origem_id uuid references hospitals (id),
  unidade_origem_id uuid references units (id),
  leito_origem_id uuid references beds (id),
  hospital_destino_id uuid references hospitals (id),
  unidade_destino_id uuid references units (id),
  leito_destino_id uuid references beds (id),
  -- Só preenchido em transferência externa / retorno — destino fora do
  -- nosso cadastro de unidades (ex.: "UTI Coronária (Ext)"), texto livre.
  destino_externo text,
  motivo text,
  registrado_por uuid references profiles (id),
  ocorrido_em timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index admission_unit_history_admission_idx on admission_unit_history (admission_id, ocorrido_em);
create index admission_unit_history_company_idx on admission_unit_history (company_id);

alter table admission_unit_history enable row level security;

create policy "admission_unit_history_isolation" on admission_unit_history
  for all using (company_id = current_company_id() or is_platform_admin());

-- Rastreio é auditoria: só criação e leitura, igual activity_log — ninguém
-- edita ou apaga um movimento já registrado, nem o dono da empresa.
grant select, insert on public.admission_unit_history to authenticated;

-- ---------------------------------------------------------------------------
-- Corrige um gap real encontrado nesta mesma área: o check constraint de
-- activity_log (migration 0006) nunca foi ampliado quando 'transferencia',
-- 'retorno_transferencia' e 'quebra_de_alta' passaram a ser gravados pelo
-- repository (migrations 0031 e correções posteriores) — toda chamada de
-- registrarAuditoria com essas ações vinha falhando silenciosamente (o
-- erro só ia pro console, nunca travava a tela). Aproveita e já inclui
-- 'mudanca_unidade', a ação nova desta entrega.
-- ---------------------------------------------------------------------------
alter table activity_log drop constraint activity_log_action_check;
alter table activity_log add constraint activity_log_action_check
  check (action in (
    'criado', 'editado', 'excluido', 'alta', 'importado', 'desfeito',
    'transferencia', 'retorno_transferencia', 'quebra_de_alta', 'mudanca_unidade'
  ));
