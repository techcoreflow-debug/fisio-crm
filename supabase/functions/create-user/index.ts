// Edge Function: create-user
//
// Só o admin InovareTech (is_platform_admin = true) pode chamar isso.
// Cria o usuário direto (sem e-mail de confirmação) já vinculado a uma
// empresa e papel — usa a service_role key, que por isso PRECISA rodar
// no servidor (Edge Function), nunca no navegador.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), { status: 401, headers: CORS_HEADERS });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Cliente "de quem chamou" — só pra confirmar que é admin InovareTech.
    const clienteChamador = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: usuarioChamador }, error: erroAuth } = await clienteChamador.auth.getUser();
    if (erroAuth || !usuarioChamador) {
      return new Response(JSON.stringify({ error: "Sessão inválida." }), { status: 401, headers: CORS_HEADERS });
    }

    const clienteAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: perfilChamador } = await clienteAdmin
      .from("profiles")
      .select("is_platform_admin")
      .eq("id", usuarioChamador.id)
      .maybeSingle();
    if (!perfilChamador?.is_platform_admin) {
      return new Response(JSON.stringify({ error: "Só o admin InovareTech pode criar usuários por aqui." }), {
        status: 403,
        headers: CORS_HEADERS,
      });
    }

    const { email, password, fullName, companyId, role } = await req.json();
    if (!email || !password || !companyId || !role) {
      return new Response(JSON.stringify({ error: "Preencha e-mail, senha, empresa e papel." }), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }

    // email_confirm: true — pula a confirmação por e-mail de propósito,
    // é exatamente o que essa função existe pra fazer.
    const { data: criado, error: erroCriar } = await clienteAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName || email.split("@")[0] },
    });
    if (erroCriar || !criado.user) {
      return new Response(JSON.stringify({ error: erroCriar?.message ?? "Falha ao criar usuário." }), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }

    // O gatilho handle_new_user() já criou o perfil (company_id null,
    // role 'admin') — aqui só ajusta pro que foi pedido no formulário.
    const { error: erroPerfil } = await clienteAdmin
      .from("profiles")
      .update({ company_id: companyId, role, full_name: fullName || email.split("@")[0] })
      .eq("id", criado.user.id);
    if (erroPerfil) {
      return new Response(JSON.stringify({ error: `Usuário criado, mas falhou ao vincular: ${erroPerfil.message}` }), {
        status: 500,
        headers: CORS_HEADERS,
      });
    }

    return new Response(JSON.stringify({ ok: true, userId: criado.user.id }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (erro) {
    return new Response(JSON.stringify({ error: erro instanceof Error ? erro.message : "Erro inesperado." }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
});
