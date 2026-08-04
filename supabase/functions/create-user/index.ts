// Edge Function: create-user
//
// Só o admin InovareTech (is_platform_admin = true) pode chamar isso.
// Ações suportadas (campo `action` no corpo da requisição):
//   - "create" (padrão, se omitido): cria usuário já confirmado, vinculado
//     a uma empresa e papel — sem pedir confirmação de e-mail.
//   - "delete": apaga o usuário de vez (auth.users, o que cascade-apaga
//     o perfil dele também).
//   - "reset-password": define uma nova senha pra outro usuário, sem
//     precisar da senha antiga (é o admin fazendo isso, não a própria
//     pessoa trocando a dela).
// Todas usam a service_role key, que por isso PRECISA rodar no servidor
// (Edge Function), nunca no navegador.
//
// Deploy: supabase functions deploy create-user
// Não precisa configurar nada além do deploy — SUPABASE_URL e
// SUPABASE_SERVICE_ROLE_KEY já ficam disponíveis automaticamente pra
// toda Edge Function do projeto.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function erro(mensagem: string, status: number) {
  return new Response(JSON.stringify({ error: mensagem }), { status, headers: CORS_HEADERS });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return erro("Não autenticado.", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const clienteChamador = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: usuarioChamador }, error: erroAuth } = await clienteChamador.auth.getUser();
    if (erroAuth || !usuarioChamador) return erro(`Sessão inválida: ${erroAuth?.message ?? "usuário não encontrado"}`, 401);

    const clienteAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: perfilChamador, error: erroBuscarPerfil } = await clienteAdmin
      .from("profiles")
      .select("is_platform_admin")
      .eq("id", usuarioChamador.id)
      .maybeSingle();
    if (erroBuscarPerfil) return erro(`Falha ao checar permissão: ${erroBuscarPerfil.message}`, 500);
    if (!perfilChamador?.is_platform_admin) return erro(`Só o admin InovareTech pode gerenciar usuários por aqui. (uid=${usuarioChamador.id})`, 403);

    const corpo = await req.json();
    const action = corpo.action ?? "create";

    if (action === "delete") {
      const { userId } = corpo;
      if (!userId) return erro("Informe o usuário a excluir.", 400);
      if (userId === usuarioChamador.id) return erro("Você não pode excluir sua própria conta por aqui.", 400);
      const { error: erroExcluir } = await clienteAdmin.auth.admin.deleteUser(userId);
      if (erroExcluir) return erro(erroExcluir.message, 400);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
    }

    if (action === "reset-password") {
      const { userId, password } = corpo;
      if (!userId || !password) return erro("Informe o usuário e a nova senha.", 400);
      const { error: erroSenha } = await clienteAdmin.auth.admin.updateUserById(userId, { password });
      if (erroSenha) return erro(erroSenha.message, 400);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
    }

    // action === "create" (padrão)
    const { email, password, fullName, companyId, role } = corpo;
    if (!email || !password || !companyId || !role) return erro("Preencha e-mail, senha, empresa e papel.", 400);

    const { data: criado, error: erroCriar } = await clienteAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName || email.split("@")[0] },
    });
    if (erroCriar || !criado.user) return erro(erroCriar?.message ?? "Falha ao criar usuário.", 400);

    const { error: erroPerfil } = await clienteAdmin
      .from("profiles")
      .update({ company_id: companyId, role, full_name: fullName || email.split("@")[0] })
      .eq("id", criado.user.id);
    if (erroPerfil) return erro(`Usuário criado, mas falhou ao vincular: ${erroPerfil.message}`, 500);

    return new Response(JSON.stringify({ ok: true, userId: criado.user.id }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return erro(e instanceof Error ? e.message : "Erro inesperado.", 500);
  }
});
