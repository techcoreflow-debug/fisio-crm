// Edge Function: ai-assist
//
// Camada única de IA do inovare.fisio. A chave da Anthropic NUNCA vai ao
// navegador: fica só como secret desta função.
//
// Tarefas (campo `task`):
//   - "estruturar_evolucao": texto livre da evolução -> JSON estruturado
//     (o fisioterapeuta SEMPRE confirma/edita antes de gravar).
//   - "narrativa": reescreve o relatório determinístico do período.
//   - "perguntar": responde pergunta usando SOMENTE os números agregados enviados.
//   - "resumo_alta": rascunho de resumo de alta p/ paciente/família (revisão obrigatória).
//
// Segurança / LGPD:
//   - exige usuário autenticado com perfil válido;
//   - remove CPF, e-mail e telefone do texto antes de enviar à IA;
//   - o app não envia nome de paciente (o resumo de alta é montado com dados
//     clínicos agregados; o nome é inserido só no navegador, na impressão);
//   - limite de tamanho de entrada e de saída (max_tokens) + limite simples de uso por usuário.
//
// Deploy:
//   supabase functions deploy ai-assist
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   (opcional) supabase secrets set AI_MODEL=claude-haiku-4-5-20251001
//
// Sem a chave configurada a função responde 503 "IA não configurada" e o
// app continua funcionando normalmente pelo caminho manual.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const MODELO_PADRAO = "claude-haiku-4-5-20251001";
const MAX_ENTRADA = 8000;
const LIMITE_POR_JANELA = 30;
const JANELA_MS = 10 * 60 * 1000;
const usoPorUsuario = new Map<string, number[]>();

function erro(mensagem: string, status: number) {
  return new Response(JSON.stringify({ error: mensagem }), { status, headers: CORS_HEADERS });
}

function limiteExcedido(userId: string): boolean {
  const agora = Date.now();
  const recentes = (usoPorUsuario.get(userId) ?? []).filter((t) => agora - t < JANELA_MS);
  if (recentes.length >= LIMITE_POR_JANELA) {
    usoPorUsuario.set(userId, recentes);
    return true;
  }
  recentes.push(agora);
  usoPorUsuario.set(userId, recentes);
  return false;
}

function anonimizar(texto: string): string {
  return texto
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF removido]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[e-mail removido]")
    .replace(/(\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g, "[telefone removido]");
}

const SISTEMA_BASE =
  "Você é um assistente de apoio para fisioterapeutas hospitalares no Brasil. Responda sempre em português do Brasil, " +
  "de forma objetiva. Nunca invente dados: use apenas o que foi fornecido. Você apoia; a decisão clínica é do profissional.";

async function chamarModelo(sistema: string, usuario: string, maxTokens: number): Promise<string> {
  const chave = Deno.env.get("ANTHROPIC_API_KEY");
  if (!chave) throw new Error("IA não configurada: defina o secret ANTHROPIC_API_KEY desta função no Supabase.");
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": chave, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("AI_MODEL") ?? MODELO_PADRAO,
      max_tokens: maxTokens,
      system: `${SISTEMA_BASE}\n\n${sistema}`,
      messages: [{ role: "user", content: usuario }],
    }),
  });
  if (!resp.ok) {
    const detalhe = await resp.text();
    throw new Error(`A IA não respondeu (HTTP ${resp.status}). ${detalhe.slice(0, 200)}`);
  }
  const json = await resp.json();
  return (json.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n").trim();
}

function extrairJson(texto: string): unknown {
  const inicio = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  if (inicio < 0 || fim <= inicio) throw new Error("A IA não devolveu um resultado estruturado. Tente novamente ou registre manualmente.");
  return JSON.parse(texto.slice(inicio, fim + 1));
}

const SISTEMA_ESTRUTURAR =
  "Converta a evolução fisioterapêutica em JSON, SEM inventar nada que não esteja escrito. Responda APENAS com JSON no formato: " +
  '{"resumo": string (1-2 frases), "intercorrencias": string[], "condutas": string[], "metas": string[], ' +
  '"escalas_citadas": [{"escala": "barthel"|"mrc"|"ims"|"fss_icu"|"borg", "score": number, "trecho": string}]}. ' +
  "Use listas vazias quando o texto não mencionar o item. Só inclua escala se o texto citar o escore numérico explicitamente.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return erro("Não autenticado.", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const cliente = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: erroAuth } = await cliente.auth.getUser();
    if (erroAuth || !user) return erro("Sessão inválida.", 401);

    const { data: perfil } = await cliente.from("profiles").select("id").eq("id", user.id).maybeSingle();
    if (!perfil) return erro("Perfil não encontrado.", 403);

    if (limiteExcedido(user.id)) return erro("Muitas solicitações de IA em pouco tempo. Aguarde alguns minutos.", 429);

    const corpo = await req.json();
    const task = String(corpo.task ?? "");

    if (task === "estruturar_evolucao") {
      const texto = anonimizar(String(corpo.texto ?? "")).slice(0, MAX_ENTRADA);
      if (texto.trim().length < 10) return erro("Texto da evolução muito curto.", 400);
      const saida = await chamarModelo(SISTEMA_ESTRUTURAR, texto, 900);
      return new Response(JSON.stringify({ resultado: extrairJson(saida) }), { status: 200, headers: CORS_HEADERS });
    }

    if (task === "narrativa") {
      const texto = anonimizar(String(corpo.texto ?? "")).slice(0, MAX_ENTRADA);
      if (!texto) return erro("Sem texto base.", 400);
      const saida = await chamarModelo(
        "Reescreva o relatório abaixo para a diretoria do hospital, em 2 a 3 parágrafos curtos, tom profissional. " +
          "Mantenha EXATAMENTE os números fornecidos, não acrescente números nem causas que não estejam no texto.",
        texto,
        700
      );
      return new Response(JSON.stringify({ resultado: saida }), { status: 200, headers: CORS_HEADERS });
    }

    if (task === "perguntar") {
      const pergunta = anonimizar(String(corpo.pergunta ?? "")).slice(0, 500);
      const dados = JSON.stringify(corpo.dados ?? {}).slice(0, MAX_ENTRADA);
      if (!pergunta.trim()) return erro("Escreva uma pergunta.", 400);
      const saida = await chamarModelo(
        "Responda à pergunta usando SOMENTE os dados agregados em JSON fornecidos. Se os dados não bastarem, diga claramente " +
          "que não é possível responder com os dados disponíveis. Cite os números usados. No máximo 5 frases.",
        `DADOS:\n${dados}\n\nPERGUNTA: ${pergunta}`,
        500
      );
      return new Response(JSON.stringify({ resultado: saida }), { status: 200, headers: CORS_HEADERS });
    }

    if (task === "resumo_alta") {
      const dados = JSON.stringify(corpo.dados ?? {}).slice(0, MAX_ENTRADA);
      const saida = await chamarModelo(
        "Escreva um resumo de alta fisioterapêutico para o paciente e sua família, em linguagem simples e acolhedora, até 200 palavras, " +
          "com: o que foi trabalhado, como o paciente evoluiu (apenas conforme os escores fornecidos) e orientações gerais de continuidade " +
          "sem prescrever condutas específicas. Não use o nome do paciente. Termine dizendo que o resumo foi revisado pelo fisioterapeuta responsável.",
        dados,
        600
      );
      return new Response(JSON.stringify({ resultado: saida }), { status: 200, headers: CORS_HEADERS });
    }

    return erro("Tarefa de IA desconhecida.", 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    return erro(msg, msg.startsWith("IA não configurada") ? 503 : 500);
  }
});
