import { chamarEdgeFunction } from "@/lib/edge-function";

/**
 * Cliente da Edge Function `ai-assist`. A IA é sempre opcional: quando não
 * está configurada (sem deploy ou sem a chave), `iaIndisponivel` identifica
 * o caso para a tela cair no caminho manual sem assustar o usuário.
 */
export const MENSAGEM_IA_NAO_CONFIGURADA = "Necessária configuração da API de IA";

export function iaIndisponivel(erro: unknown): boolean {
  const msg = erro instanceof Error ? erro.message : String(erro);
  return (
    msg.includes("IA não configurada") ||
    msg.includes("Não foi possível conectar à função") ||
    msg.includes("is not a function") ||
    msg.includes("Failed to send a request") ||
    msg.includes("not found")
  );
}

export interface EvolucaoEstruturada {
  resumo: string;
  intercorrencias: string[];
  condutas: string[];
  metas: string[];
  escalas_citadas: { escala: "barthel" | "mrc" | "ims" | "fss_icu" | "borg"; score: number; trecho: string }[];
}

async function chamar<T>(task: string, corpo: Record<string, unknown>): Promise<T> {
  const r = await chamarEdgeFunction<{ resultado: T }>("ai-assist", { task, ...corpo });
  return r.resultado;
}

export async function estruturarEvolucao(texto: string): Promise<EvolucaoEstruturada> {
  const r = await chamar<Partial<EvolucaoEstruturada>>("estruturar_evolucao", { texto });
  const lista = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);
  return {
    resumo: String(r.resumo ?? ""),
    intercorrencias: lista(r.intercorrencias),
    condutas: lista(r.condutas),
    metas: lista(r.metas),
    escalas_citadas: Array.isArray(r.escalas_citadas)
      ? r.escalas_citadas.filter((e) => e && typeof e.score === "number" && ["barthel", "mrc", "ims", "fss_icu", "borg"].includes(e.escala))
      : [],
  };
}

export const reescreverNarrativa = (texto: string) => chamar<string>("narrativa", { texto });
export const perguntarAosDados = (pergunta: string, dados: unknown) => chamar<string>("perguntar", { pergunta, dados });
export const gerarResumoAlta = (dados: unknown) => chamar<string>("resumo_alta", { dados });
