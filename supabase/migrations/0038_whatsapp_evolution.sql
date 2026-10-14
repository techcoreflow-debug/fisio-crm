-- ============================================================================
-- Fisio — Migration 0038: WhatsApp via Evolution API
-- ============================================================================
-- Mesmo desenho já usado no OficinaOS (QR code, templates, envio e lote com
-- limite diário), trocando oficina por empresa. A chave da Evolution fica em
-- whatsapp_secrets — RLS ligada SEM nenhuma política: o navegador nunca lê;
-- só a Edge Function `whatsapp` (service_role) acessa.
-- Configuração (whatsapp_settings): o navegador só LÊ; quem grava é a função.
-- Aplicar ANTES de publicar a Edge Function `whatsapp`.

-- Admin da empresa (ou da plataforma) — usado nas políticas de templates.
create or replace function is_company_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and (role = 'admin' or is_platform_admin = true)
  );
$$;

-- Telefone/e-mail do paciente: nenhuma migration do repositório os cria (a 0033 de pesquisa de
-- satisfação não está no repo). `if not exists` torna isto seguro tenha ou não sido aplicado antes.
alter table patients add column if not exists phone text;
alter table patients add column if not exists email text;
-- LGPD: paciente que pediu para não receber mensagens.
alter table patients add column if not exists whatsapp_optout boolean not null default false;

create table whatsapp_settings (
  company_id uuid primary key references companies (id) on delete cascade,
  evolution_url text not null default '',
  instance_name text not null default '',
  api_version text not null default 'v2' check (api_version in ('v1', 'v2')),
  enabled boolean not null default false,
  api_key_set boolean not null default false,
  delay_min_s integer not null default 5 check (delay_min_s between 1 and 120),
  delay_max_s integer not null default 12 check (delay_max_s between 1 and 300),
  daily_limit integer not null default 150 check (daily_limit between 1 and 5000),
  connection_state text,
  connected_number text,
  last_checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table whatsapp_secrets (
  company_id uuid primary key references companies (id) on delete cascade,
  api_key text not null,
  updated_at timestamptz not null default now()
);

create table whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  category text not null default 'outro',
  body text not null,
  active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index whatsapp_templates_company_category_idx on whatsapp_templates (company_id, category);

create table whatsapp_batches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  audience text,
  template_id uuid references whatsapp_templates (id) on delete set null,
  status text not null default 'enviando' check (status in ('enviando', 'pausado', 'concluido', 'cancelado')),
  total integer not null default 0,
  sent integer not null default 0,
  failed integer not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index whatsapp_batches_company_created_idx on whatsapp_batches (company_id, created_at desc);

create table whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  batch_id uuid references whatsapp_batches (id) on delete cascade,
  patient_id uuid references patients (id) on delete set null,
  admission_id uuid references admissions (id) on delete set null,
  recipient_name text,
  to_number text not null,
  body text not null,
  status text not null default 'pendente' check (status in ('pendente', 'enviando', 'enviada', 'falha', 'cancelada')),
  error text,
  provider_message_id text,
  context_type text,
  context_id uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index whatsapp_messages_batch_status_idx on whatsapp_messages (batch_id, status);
create index whatsapp_messages_patient_idx on whatsapp_messages (patient_id);
create index whatsapp_messages_company_created_idx on whatsapp_messages (company_id, created_at desc);
create index whatsapp_messages_company_status_sent_idx on whatsapp_messages (company_id, status, sent_at);

alter table whatsapp_settings enable row level security;
alter table whatsapp_secrets enable row level security;   -- sem política de propósito
alter table whatsapp_templates enable row level security;
alter table whatsapp_batches enable row level security;
alter table whatsapp_messages enable row level security;

create policy "whatsapp_settings_read" on whatsapp_settings
  for select using (company_id = current_company_id() or is_platform_admin());

create policy "whatsapp_templates_read" on whatsapp_templates
  for select using (company_id = current_company_id() or is_platform_admin());
create policy "whatsapp_templates_write" on whatsapp_templates
  for all using ((company_id = current_company_id() and is_company_admin()) or is_platform_admin())
  with check ((company_id = current_company_id() and is_company_admin()) or is_platform_admin());

create policy "whatsapp_batches_isolation" on whatsapp_batches
  for all using (company_id = current_company_id() or is_platform_admin())
  with check (company_id = current_company_id() or is_platform_admin());
create policy "whatsapp_messages_isolation" on whatsapp_messages
  for all using (company_id = current_company_id() or is_platform_admin())
  with check (company_id = current_company_id() or is_platform_admin());

grant select on public.whatsapp_settings to authenticated;
grant select, insert, update, delete on public.whatsapp_templates to authenticated;
grant select, insert, update, delete on public.whatsapp_batches to authenticated;
grant select, insert, update, delete on public.whatsapp_messages to authenticated;
revoke all on public.whatsapp_secrets from anon, authenticated;

-- Modelos padrão (o app também oferece "criar modelos padrão" para empresas novas).
create or replace function seed_whatsapp_templates(p_company uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into whatsapp_templates (company_id, name, category, body, is_default)
  select p_company, t.name, t.category, t.body, true
  from (values
    ('Pesquisa de satisfação pós-alta', 'pesquisa_satisfacao',
     'Olá, {{primeiro_nome}}! Aqui é da {{empresa}}. Gostaríamos de saber como foi sua experiência com a fisioterapia durante a internação. Leva menos de 1 minuto: {{link}}'),
    ('Agradecimento pela alta', 'pos_alta',
     'Olá, {{primeiro_nome}}! A equipe de fisioterapia da {{empresa}} deseja uma ótima recuperação. Se precisar de algo, é só responder esta mensagem.'),
    ('Aviso geral', 'outro',
     'Olá, {{primeiro_nome}}! Aqui é da {{empresa}}.')
  ) as t(name, category, body)
  where (auth.uid() is null or p_company = current_company_id() or is_platform_admin())
  and not exists (
    select 1 from whatsapp_templates w where w.company_id = p_company and w.category = t.category and w.is_default
  );
$$;
revoke all on function seed_whatsapp_templates(uuid) from public, anon;
grant execute on function seed_whatsapp_templates(uuid) to authenticated;

select seed_whatsapp_templates(id) from companies;

do $$
declare t text;
begin
  foreach t in array array['whatsapp_settings', 'whatsapp_batches', 'whatsapp_messages'] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
