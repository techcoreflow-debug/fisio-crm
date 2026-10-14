import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { chamarEdgeFunction } from "@/lib/edge-function";
import { useSupabaseCollection, inserirLinha, atualizarLinha, excluirLinha } from "@/data/supabase-collection";
import { useAppStore } from "@/store/app-store";
import type { WhatsappBatch, WhatsappMessage, WhatsappSettings, WhatsappTemplate } from "@/types/domain";

/** Erro da Edge Function `whatsapp` com o código que ela devolveu (ex.: not_connected, optout, daily_limit). */
export class ErroWhatsapp extends Error {
  codigo: string;
  constructor(codigo: string, mensagem: string) {
    super(mensagem);
    this.codigo = codigo;
  }
}

interface RespostaWhatsapp {
  ok: boolean;
  code?: string;
  detail?: string;
  [chave: string]: unknown;
}

/** A função devolve HTTP 200 com { ok:false, code, detail } nos erros "de negócio" — aqui viram exceção. */
export async function chamarWhatsapp<T extends RespostaWhatsapp = RespostaWhatsapp>(
  action: string,
  companyId: string,
  extra: Record<string, unknown> = {}
): Promise<T> {
  const r = await chamarEdgeFunction<T>("whatsapp", { action, companyId, ...extra });
  if (!r.ok) throw new ErroWhatsapp(r.code ?? "erro", r.detail ?? "Não foi possível concluir a ação no WhatsApp.");
  return r;
}

export function useWhatsappTemplates(): WhatsappTemplate[] {
  return useSupabaseCollection<WhatsappTemplate>("whatsapp_templates", { company_id: useAppStore((s) => s.activeCompanyId) }, "name");
}
export function useWhatsappBatches(): WhatsappBatch[] {
  return useSupabaseCollection<WhatsappBatch>("whatsapp_batches", { company_id: useAppStore((s) => s.activeCompanyId) }, "created_at", true);
}
export function useWhatsappMessages(): WhatsappMessage[] {
  return useSupabaseCollection<WhatsappMessage>("whatsapp_messages", { company_id: useAppStore((s) => s.activeCompanyId) }, "created_at", true);
}

/** Configuração da empresa (linha única, chave = company_id). `carregando` evita piscar "não configurado". */
export function useWhatsappSettings(): { config: WhatsappSettings | null; carregando: boolean; recarregar: () => Promise<void> } {
  const empresaId = useAppStore((s) => s.activeCompanyId);
  const [config, setConfig] = useState<WhatsappSettings | null>(null);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    if (!empresaId) return;
    const { data } = await supabase.from("whatsapp_settings").select("*").eq("company_id", empresaId).maybeSingle();
    setConfig((data as WhatsappSettings | null) ?? null);
    setCarregando(false);
  }, [empresaId]);

  useEffect(() => {
    setCarregando(true);
    void recarregar();
  }, [recarregar]);

  return { config, carregando, recarregar };
}

/** O envio automático só vale se estiver ligado E conectado. Senão, a tela cai no wa.me manual. */
export function envioAutomaticoDisponivel(config: WhatsappSettings | null): boolean {
  return !!config && config.enabled && config.api_key_set && config.connection_state === "open";
}

export const whatsapp = {
  salvarConfig: (companyId: string, c: {
    evolutionUrl: string; instanceName: string; apiKey?: string; apiVersion: "v1" | "v2";
    enabled: boolean; delayMinS: number; delayMaxS: number; dailyLimit: number;
  }) => chamarWhatsapp("save_config", companyId, c),

  status: (companyId: string) => chamarWhatsapp<RespostaWhatsapp & { state: string; number: string | null }>("status", companyId),

  conectar: (companyId: string, phoneNumber?: string) =>
    chamarWhatsapp<RespostaWhatsapp & { state: string; qr?: string | null; pairingCode?: string | null }>("connect", companyId, { phoneNumber }),

  desconectar: (companyId: string) => chamarWhatsapp("logout", companyId),

  enviar: (companyId: string, m: {
    number: string; text: string; patientId?: string | null; admissionId?: string | null;
    recipientName?: string | null; contextType?: string; contextId?: string | null;
  }) => chamarWhatsapp<RespostaWhatsapp & { messageId: string }>("send", companyId, m),

  processarLote: (companyId: string, batchId: string, limit = 5) =>
    chamarWhatsapp<RespostaWhatsapp & { status: string; sent: number; failed: number; remaining: number }>("process_batch", companyId, { batchId, limit }),

  /** Cria o lote + as mensagens pendentes. Quem for enviar é a Edge Function (com intervalo e limite diário). */
  criarLote: async (companyId: string, dados: {
    nome: string; audiencia: string; templateId: string | null;
    mensagens: { patientId: string | null; admissionId: string | null; nome: string; numero: string; texto: string; contextId?: string | null }[];
  }): Promise<WhatsappBatch> => {
    const lote = await inserirLinha<WhatsappBatch>("whatsapp_batches", {
      company_id: companyId, name: dados.nome, audience: dados.audiencia,
      template_id: dados.templateId, total: dados.mensagens.length,
    });
    const linhas = dados.mensagens.map((m) => ({
      company_id: companyId, batch_id: lote.id, patient_id: m.patientId, admission_id: m.admissionId,
      recipient_name: m.nome, to_number: m.numero, body: m.texto, status: "pendente",
      context_type: "pesquisa_satisfacao", context_id: m.contextId ?? null,
    }));
    for (let i = 0; i < linhas.length; i += 200) {
      const { error } = await supabase.from("whatsapp_messages").insert(linhas.slice(i, i + 200));
      if (error) {
        await excluirLinha("whatsapp_batches", lote.id); // não deixa lote vazio para trás
        throw new Error(error.message);
      }
    }
    return lote;
  },

  atualizarLote: (id: string, patch: Partial<Pick<WhatsappBatch, "status">>) => atualizarLinha("whatsapp_batches", id, patch),

  templates: {
    criar: (d: Pick<WhatsappTemplate, "company_id" | "name" | "category" | "body">) => inserirLinha<WhatsappTemplate>("whatsapp_templates", d),
    atualizar: (id: string, patch: Partial<Pick<WhatsappTemplate, "name" | "category" | "body" | "active">>) => atualizarLinha("whatsapp_templates", id, patch),
    excluir: (id: string) => excluirLinha("whatsapp_templates", id),
    criarPadrao: async (): Promise<void> => {
      const { error } = await supabase.rpc("seed_whatsapp_templates", { p_company: useAppStore.getState().activeCompanyId });
      if (error) throw new Error(error.message);
    },
  },
};

export interface ResultadoEnvioPesquisa {
  /** "evolution" = saiu pelo sistema; "manual" = precisa abrir o wa.me (não configurado, desconectado ou falhou). */
  via: "evolution" | "manual";
  motivoManual?: string;
}

/**
 * Tenta enviar pela Evolution; qualquer problema (desligada, desconectada, erro de rede)
 * devolve via "manual" com o motivo — o chamador abre o wa.me, como era antes.
 * Só o opt-out (LGPD) é recusa definitiva: aí lança o erro e NADA é enviado.
 */
export async function enviarPorEvolutionOuManual(a: {
  empresaId: string;
  config: WhatsappSettings | null;
  numero: string;
  texto: string;
  paciente: { id: string; full_name: string; whatsapp_optout?: boolean } | null;
  admissionId: string | null;
  contextId: string | null;
}): Promise<ResultadoEnvioPesquisa> {
  if (a.paciente?.whatsapp_optout) {
    throw new ErroWhatsapp("optout", "Este paciente pediu para não receber mensagens por WhatsApp.");
  }
  if (!envioAutomaticoDisponivel(a.config)) {
    const motivo = !a.config || !a.config.api_key_set
      ? "WhatsApp automático não configurado"
      : !a.config.enabled ? "envio automático desligado" : "WhatsApp desconectado";
    return { via: "manual", motivoManual: motivo };
  }
  try {
    await whatsapp.enviar(a.empresaId, {
      number: a.numero,
      text: a.texto,
      patientId: a.paciente?.id ?? null,
      admissionId: a.admissionId,
      recipientName: a.paciente?.full_name ?? null,
      contextType: "pesquisa_satisfacao",
      contextId: a.contextId,
    });
    return { via: "evolution" };
  } catch (erro) {
    if (erro instanceof ErroWhatsapp && erro.codigo === "optout") throw erro;
    return { via: "manual", motivoManual: erro instanceof Error ? erro.message : "falha no envio automático" };
  }
}

/**
 * Roda o lote em rodadas curtas até acabar, ser pausado/cancelado ou falhar.
 * `continuar()` é consultado entre rodadas (tela fechada/pausa do usuário interrompe).
 */
export async function executarLote(
  empresaId: string,
  batchId: string,
  aoProgresso: (p: { sent: number; failed: number; remaining: number; status: string }) => void,
  continuar: () => boolean
): Promise<{ status: string; sent: number; failed: number }> {
  let ultimo = { status: "enviando", sent: 0, failed: 0 };
  for (;;) {
    const r = await whatsapp.processarLote(empresaId, batchId, 5);
    ultimo = { status: r.status, sent: r.sent, failed: r.failed };
    aoProgresso({ sent: r.sent, failed: r.failed, remaining: r.remaining, status: r.status });
    if (r.status !== "enviando" || r.remaining === 0) break;
    if (!continuar()) break;
  }
  return ultimo;
}

/** Cria N pesquisas de uma vez (tokens gerados pelo banco) e devolve na mesma ordem das entradas. */
export async function criarPesquisasEmLote(
  companyId: string,
  templateId: string,
  itens: { admissionId: string; destino: string }[]
): Promise<{ id: string; token: string; admission_id: string | null }[]> {
  const saida: { id: string; token: string; admission_id: string | null }[] = [];
  for (let i = 0; i < itens.length; i += 200) {
    const parte = itens.slice(i, i + 200).map((x) => ({
      company_id: companyId, admission_id: x.admissionId, template_id: templateId, canal: "whatsapp", destino: x.destino,
    }));
    const { data, error } = await supabase.from("satisfaction_surveys").insert(parte).select("id, token, admission_id");
    if (error) throw new Error(error.message);
    saida.push(...((data ?? []) as { id: string; token: string; admission_id: string | null }[]));
  }
  return saida;
}
