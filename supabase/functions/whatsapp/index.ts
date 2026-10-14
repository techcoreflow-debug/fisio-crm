// whatsapp — integração com a Evolution API (QR Code, envio e disparo em lote).
// Portada do OficinaOS (oficina → empresa). A chave da Evolution fica em
// whatsapp_secrets (sem acesso do navegador). Só https e endereço público.
// Ações: save_config, status, connect, logout, send, process_batch.
//
// Deploy: supabase functions deploy whatsapp   (depois da migration 0038)
// Não precisa de secret extra: SUPABASE_URL, SUPABASE_ANON_KEY e
// SUPABASE_SERVICE_ROLE_KEY já existem em toda Edge Function.

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const fail = (code: string, detail: string) => json({ ok: false, code, detail });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function normalizarNumero(raw: unknown): string | null {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return "55" + d;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d;
  return null;
}

function urlSegura(u: unknown): URL | null {
  let url: URL;
  try { url = new URL(String(u ?? "").trim()); } catch { return null; }
  if (url.protocol !== "https:") return null;
  const h = url.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return null;
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(h)) return null;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return null;
  if (h === "::1" || h.startsWith("[")) return null;
  return url;
}

type Cfg = {
  company_id: string;
  evolution_url: string;
  instance_name: string;
  api_version: "v1" | "v2";
  enabled: boolean;
  delay_min_s: number;
  delay_max_s: number;
  daily_limit: number;
  apiKey: string;
};

type EvoResult = { ok: boolean; status: number; j: any; txt: string; err?: "timeout" | "network" | "bad_url" };

async function evo(cfg: Cfg, method: string, path: string, payload?: unknown, ms = 15000): Promise<EvoResult> {
  const base = urlSegura(cfg.evolution_url);
  if (!base) return { ok: false, status: 0, j: null, txt: "", err: "bad_url" };
  const root = base.origin + base.pathname.replace(/\/+$/, "");
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(root + path, {
      method,
      headers: { apikey: cfg.apiKey, "Content-Type": "application/json" },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal: c.signal,
    });
    const txt = await r.text();
    let j: any = null;
    try { j = JSON.parse(txt); } catch { /* resposta não-JSON */ }
    return { ok: r.ok, status: r.status, j, txt };
  } catch (e) {
    return { ok: false, status: 0, j: null, txt: "", err: (e as Error)?.name === "AbortError" ? "timeout" : "network" };
  } finally {
    clearTimeout(t);
  }
}

function evoErro(r: EvoResult): { code: string; detail: string } {
  if (r.err === "bad_url") return { code: "bad_url", detail: "A URL da Evolution API é inválida ou não é permitida (use https e um endereço público)." };
  if (r.err === "timeout") return { code: "timeout", detail: "A Evolution API não respondeu a tempo." };
  if (r.err === "network") return { code: "network", detail: "Não foi possível falar com a Evolution API." };
  if (r.status === 401 || r.status === 403) return { code: "forbidden", detail: "A Evolution recusou a chave de API. Confira se é a chave global (AUTHENTICATION_API_KEY)." };
  const noWa = r.j?.response?.message?.[0]?.exists === false;
  return { code: "provider_error", detail: (noWa ? "Este número não tem WhatsApp." : r.txt || `Erro ${r.status}`).toString().slice(0, 240) };
}

function qrDe(j: any): { qr: string | null; pairingCode: string | null } {
  const raw: string | undefined = j?.base64 ?? j?.qrcode?.base64;
  const qr = raw ? (raw.startsWith("data:") ? raw : `data:image/png;base64,${raw}`) : null;
  const pairingCode: string | null = j?.pairingCode ?? j?.qrcode?.pairingCode ?? null;
  return { qr, pairingCode };
}

async function estadoDaInstancia(cfg: Cfg): Promise<{ state: string } | { error: EvoResult }> {
  const r = await evo(cfg, "GET", `/instance/connectionState/${encodeURIComponent(cfg.instance_name)}`, undefined, 10000);
  if (r.status === 404) return { state: "nao_criada" };
  if (!r.ok) return { error: r };
  return { state: r.j?.instance?.state ?? r.j?.state ?? "desconhecido" };
}

async function enviarTexto(cfg: Cfg, number: string, text: string): Promise<{ ok: true; id: string | null } | { ok: false; code: string; detail: string }> {
  const delay = 1200 + Math.floor(Math.random() * 1800);
  const payload = cfg.api_version === "v1"
    ? { number, options: { delay }, textMessage: { text } }
    : { number, text, delay };
  const r = await evo(cfg, "POST", `/message/sendText/${encodeURIComponent(cfg.instance_name)}`, payload, 20000);
  if (!r.ok) return { ok: false, ...evoErro(r) };
  return { ok: true, id: r.j?.key?.id ?? null };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ ok: false, code: "method_not_allowed" }, 405);

  const auth = req.headers.get("Authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) return json({ ok: false, code: "unauthorized" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return fail("bad_request", "JSON inválido."); }
  const action = String(body?.action ?? "");
  const companyId = String(body?.companyId ?? "");
  if (!UUID.test(companyId)) return fail("bad_request", "Empresa inválida.");

  const uc = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
  const admin = createClient(SUPABASE_URL, SERVICE);

  const { data: userData, error: userErr } = await uc.auth.getUser(auth.replace(/^bearer /i, ""));
  if (userErr || !userData?.user) return json({ ok: false, code: "unauthorized" }, 401);

  const [pa, own, adm] = await Promise.all([uc.rpc("is_platform_admin"), uc.rpc("current_company_id"), uc.rpc("is_company_admin")]);
  const isPlatform = pa.data === true;
  const isOwnCompany = own.data === companyId;
  const canUse = isPlatform || isOwnCompany;
  const canAdmin = isPlatform || (isOwnCompany && adm.data === true);
  if (!canUse) return json({ ok: false, code: "unauthorized" }, 401);

  async function loadCfg(): Promise<Cfg | null> {
    const [s, k] = await Promise.all([
      admin.from("whatsapp_settings").select("*").eq("company_id", companyId).maybeSingle(),
      admin.from("whatsapp_secrets").select("api_key").eq("company_id", companyId).maybeSingle(),
    ]);
    if (!s.data || !s.data.evolution_url || !s.data.instance_name || !k.data?.api_key) return null;
    return { ...(s.data as any), apiKey: k.data.api_key };
  }

  try {
    if (action === "save_config") {
      if (!canAdmin) return fail("forbidden", "Só administradores podem alterar a configuração do WhatsApp.");
      const url = String(body.evolutionUrl ?? "").trim().replace(/\/+$/, "");
      if (!urlSegura(url)) return fail("bad_url", "A URL da Evolution API precisa começar com https:// e ser um endereço público.");
      const instance = String(body.instanceName ?? "").trim().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
      if (!instance) return fail("bad_request", "Informe o nome da instância (letras, números, - e _).");
      const delayMin = Math.min(Math.max(Number(body.delayMinS) || 5, 1), 120);
      const delayMax = Math.min(Math.max(Number(body.delayMaxS) || 12, delayMin), 300);
      const dailyLimit = Math.min(Math.max(Math.round(Number(body.dailyLimit) || 150), 1), 5000);

      const apiKey = String(body.apiKey ?? "").trim();
      if (apiKey) {
        const { error } = await admin.from("whatsapp_secrets").upsert({ company_id: companyId, api_key: apiKey, updated_at: new Date().toISOString() });
        if (error) return fail("db_error", error.message);
      }
      const { data: hasKey } = await admin.from("whatsapp_secrets").select("company_id").eq("company_id", companyId).maybeSingle();
      const { error } = await admin.from("whatsapp_settings").upsert({
        company_id: companyId,
        evolution_url: url,
        instance_name: instance,
        api_version: body.apiVersion === "v1" ? "v1" : "v2",
        enabled: body.enabled === true,
        api_key_set: !!hasKey,
        delay_min_s: delayMin,
        delay_max_s: delayMax,
        daily_limit: dailyLimit,
        updated_at: new Date().toISOString(),
      });
      if (error) return fail("db_error", error.message);
      return json({ ok: true });
    }

    const cfg = await loadCfg();
    if (!cfg) return fail("not_configured", "WhatsApp (Evolution) ainda não está configurado para esta empresa.");

    if (action === "status") {
      const st = await estadoDaInstancia(cfg);
      if ("error" in st) return json({ ok: false, ...evoErro(st.error) });
      let number: string | null = null;
      if (st.state === "open") {
        const r = await evo(cfg, "GET", `/instance/fetchInstances?instanceName=${encodeURIComponent(cfg.instance_name)}`, undefined, 10000);
        const item = Array.isArray(r.j) ? r.j[0] : r.j;
        const jid: string | undefined = item?.ownerJid ?? item?.owner ?? item?.instance?.owner;
        number = jid ? jid.split("@")[0].replace(/\D/g, "") || null : null;
      }
      await admin.from("whatsapp_settings").update({
        connection_state: st.state,
        connected_number: st.state === "open" ? number : null,
        last_checked_at: new Date().toISOString(),
      }).eq("company_id", companyId);
      return json({ ok: true, state: st.state, number });
    }

    if (action === "connect") {
      if (!canAdmin) return fail("forbidden", "Só administradores podem conectar o WhatsApp.");
      const st = await estadoDaInstancia(cfg);
      if ("error" in st) return json({ ok: false, ...evoErro(st.error) });
      if (st.state === "open") return json({ ok: true, state: "open" });

      const inst = encodeURIComponent(cfg.instance_name);
      const phone = normalizarNumero(body.phoneNumber);

      if (st.state === "nao_criada") {
        const create = await evo(cfg, "POST", "/instance/create", {
          instanceName: cfg.instance_name,
          qrcode: true,
          ...(cfg.api_version === "v2" ? { integration: "WHATSAPP-BAILEYS" } : {}),
          ...(phone ? { number: phone } : {}),
        }, 25000);
        if (!create.ok) {
          const e = evoErro(create);
          if (e.code === "forbidden") e.detail = "Sem permissão para criar a instância. Use a chave GLOBAL da Evolution (AUTHENTICATION_API_KEY) ou crie a instância pelo painel dela.";
          return json({ ok: false, ...e });
        }
        const q = qrDe(create.j);
        if (q.qr || q.pairingCode) return json({ ok: true, state: "connecting", ...q });
        await sleep(2000);
      }

      const r = await evo(cfg, "GET", `/instance/connect/${inst}${phone ? `?number=${phone}` : ""}`, undefined, 25000);
      if (!r.ok) return json({ ok: false, ...evoErro(r) });
      const q = qrDe(r.j);
      return json({ ok: true, state: "connecting", ...q });
    }

    if (action === "logout") {
      if (!canAdmin) return fail("forbidden", "Só administradores podem desconectar o WhatsApp.");
      const r = await evo(cfg, "DELETE", `/instance/logout/${encodeURIComponent(cfg.instance_name)}`, undefined, 15000);
      if (!r.ok && r.status !== 404) return json({ ok: false, ...evoErro(r) });
      await admin.from("whatsapp_settings").update({ connection_state: "close", connected_number: null, last_checked_at: new Date().toISOString() }).eq("company_id", companyId);
      return json({ ok: true });
    }

    if (action === "send") {
      if (!cfg.enabled) return fail("disabled", "O envio pela Evolution está desativado nas configurações.");
      const number = normalizarNumero(body.number);
      if (!number) return fail("bad_number", "Telefone inválido. Use DDD + número.");
      const text = String(body.text ?? "").trim();
      if (!text) return fail("bad_text", "Mensagem vazia.");
      if (text.length > 3500) return fail("bad_text", "Mensagem muito longa (máx. 3500 caracteres).");

      const patientId = UUID.test(String(body.patientId ?? "")) ? String(body.patientId) : null;
      if (patientId) {
        const { data: pac } = await admin.from("patients").select("whatsapp_optout, company_id").eq("id", patientId).maybeSingle();
        if (!pac || pac.company_id !== companyId) return fail("bad_request", "Paciente não encontrado nesta empresa.");
        if (pac.whatsapp_optout) return fail("optout", "Este paciente pediu para não receber mensagens por WhatsApp.");
      }

      const { data: row, error: insErr } = await admin.from("whatsapp_messages").insert({
        company_id: companyId,
        patient_id: patientId,
        admission_id: UUID.test(String(body.admissionId ?? "")) ? body.admissionId : null,
        recipient_name: body.recipientName ? String(body.recipientName).slice(0, 120) : null,
        to_number: number,
        body: text,
        status: "enviando",
        context_type: body.contextType ? String(body.contextType).slice(0, 40) : null,
        context_id: UUID.test(String(body.contextId ?? "")) ? body.contextId : null,
        created_by: userData.user.id,
      }).select("id").single();
      if (insErr) return fail("db_error", insErr.message);

      const res = await enviarTexto(cfg, number, text);
      if (res.ok) {
        await admin.from("whatsapp_messages").update({ status: "enviada", provider_message_id: res.id, sent_at: new Date().toISOString() }).eq("id", row.id);
        return json({ ok: true, id: res.id, messageId: row.id });
      }
      await admin.from("whatsapp_messages").update({ status: "falha", error: res.detail }).eq("id", row.id);
      return json({ ok: false, code: res.code, detail: res.detail, messageId: row.id });
    }

    if (action === "process_batch") {
      if (!cfg.enabled) return fail("disabled", "O envio pela Evolution está desativado nas configurações.");
      const batchId = String(body.batchId ?? "");
      if (!UUID.test(batchId)) return fail("bad_request", "Lote inválido.");
      const { data: batch } = await admin.from("whatsapp_batches").select("*").eq("id", batchId).eq("company_id", companyId).maybeSingle();
      if (!batch) return fail("not_found", "Lote não encontrado.");
      if (batch.status !== "enviando") return json({ ok: true, status: batch.status, remaining: 0, sent: batch.sent, failed: batch.failed });

      const st = await estadoDaInstancia(cfg);
      if ("error" in st) return json({ ok: false, ...evoErro(st.error) });
      if (st.state !== "open") return fail("not_connected", "O WhatsApp não está conectado. Conecte pelo QR Code e retome o lote.");

      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { count: sentToday } = await admin.from("whatsapp_messages").select("id", { count: "exact", head: true })
        .eq("company_id", companyId).eq("status", "enviada").gte("sent_at", since);
      const budget = cfg.daily_limit - (sentToday ?? 0);
      if (budget <= 0) {
        await admin.from("whatsapp_batches").update({ status: "pausado" }).eq("id", batchId);
        return fail("daily_limit", `Limite diário de ${cfg.daily_limit} mensagens atingido. O lote foi pausado; retome amanhã ou aumente o limite.`);
      }

      const take = Math.min(Math.max(Number(body.limit) || 5, 1), 8, budget);
      const { data: pend } = await admin.from("whatsapp_messages").select("id").eq("batch_id", batchId).eq("status", "pendente").order("created_at").limit(take);
      const ids = (pend ?? []).map((m: any) => m.id);
      let claimed: any[] = [];
      if (ids.length) {
        const { data } = await admin.from("whatsapp_messages").update({ status: "enviando" }).in("id", ids).eq("status", "pendente").select("id, to_number, body, patient_id");
        claimed = data ?? [];
      }

      const started = Date.now();
      for (let i = 0; i < claimed.length; i++) {
        const m = claimed[i];
        // Quem pediu para não receber mensagens é pulado, mesmo que o lote já estivesse montado.
        if (m.patient_id) {
          const { data: pac } = await admin.from("patients").select("whatsapp_optout").eq("id", m.patient_id).maybeSingle();
          if (pac?.whatsapp_optout) {
            await admin.from("whatsapp_messages").update({ status: "cancelada", error: "Paciente optou por não receber mensagens." }).eq("id", m.id);
            continue;
          }
        }
        const res = await enviarTexto(cfg, m.to_number, m.body);
        if (res.ok) {
          await admin.from("whatsapp_messages").update({ status: "enviada", provider_message_id: res.id, sent_at: new Date().toISOString(), error: null }).eq("id", m.id);
        } else {
          await admin.from("whatsapp_messages").update({ status: "falha", error: res.detail }).eq("id", m.id);
        }
        if (!res.ok && (res.code === "forbidden" || res.code === "network" || res.code === "bad_url")) {
          const rest = claimed.slice(i + 1).map((x) => x.id);
          if (rest.length) await admin.from("whatsapp_messages").update({ status: "pendente" }).in("id", rest);
          break;
        }
        if (i < claimed.length - 1) {
          if (Date.now() - started > 100000) {
            const rest = claimed.slice(i + 1).map((x) => x.id);
            if (rest.length) await admin.from("whatsapp_messages").update({ status: "pendente" }).in("id", rest);
            break;
          }
          const lo = cfg.delay_min_s * 1000;
          const hi = Math.max(cfg.delay_max_s * 1000, lo);
          await sleep(lo + Math.random() * (hi - lo));
        }
      }

      const count = async (status: string) =>
        (await admin.from("whatsapp_messages").select("id", { count: "exact", head: true }).eq("batch_id", batchId).eq("status", status)).count ?? 0;
      const [sent, failed, pending, sending] = await Promise.all([count("enviada"), count("falha"), count("pendente"), count("enviando")]);
      const remaining = pending + sending;
      const done = remaining === 0;
      await admin.from("whatsapp_batches").update({
        sent, failed,
        ...(done ? { status: "concluido", finished_at: new Date().toISOString() } : {}),
      }).eq("id", batchId);
      return json({ ok: true, status: done ? "concluido" : "enviando", sent, failed, remaining });
    }

    return fail("bad_request", "Ação desconhecida.");
  } catch (e) {
    return fail("internal", e instanceof Error ? e.message : "Erro inesperado.");
  }
});
