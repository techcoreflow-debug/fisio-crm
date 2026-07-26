-- ============================================================================
-- Fisio — Migration 0009: super-admins da plataforma + criação automática de perfil
-- ============================================================================
-- Lista de e-mails que sempre viram admin da InovareTech (is_platform_admin)
-- assim que criam conta — sem precisar de update manual depois do cadastro.
-- Adicionar alguém novo à lista é só um insert nesta tabela, sem nova migration.

create table platform_admin_emails (
  email text primary key,
  created_at timestamptz not null default now()
);

insert into platform_admin_emails (email) values ('kleberfnascimento@gmail.com');

-- Cria o perfil automaticamente quando alguém se cadastra (auth.users),
-- marcando como admin da plataforma se o e-mail estiver na lista acima.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, company_id, full_name, role, is_platform_admin)
  values (
    new.id,
    null,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    'admin',
    exists (select 1 from platform_admin_emails e where lower(e.email) = lower(new.email))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

alter table platform_admin_emails enable row level security;

-- Só admin da plataforma administra essa lista.
create policy "platform_admin_emails_read" on platform_admin_emails
  for select using (is_platform_admin());

create policy "platform_admin_emails_write" on platform_admin_emails
  for insert with check (is_platform_admin());

create policy "platform_admin_emails_delete" on platform_admin_emails
  for delete using (is_platform_admin());
