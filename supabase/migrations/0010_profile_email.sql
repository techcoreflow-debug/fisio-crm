-- ============================================================================
-- Fisio — Migration 0010: e-mail no perfil
-- ============================================================================
-- auth.users não é consultável pelo client (nem authenticated nem anon têm
-- acesso a esse schema) — por isso a tela de Usuários e Permissões precisa
-- do e-mail espelhado em profiles para poder listar os usuários da empresa.

alter table profiles add column email text;

-- Preenche o que já existe (usuários criados antes desta migration)
update profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

-- Atualiza o gatilho de criação de perfil para já gravar o e-mail
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, company_id, full_name, role, is_platform_admin, email)
  values (
    new.id,
    null,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    'admin',
    exists (select 1 from platform_admin_emails e where lower(e.email) = lower(new.email)),
    new.email
  );
  return new;
end;
$$;
