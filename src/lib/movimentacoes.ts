// Feed de "últimas movimentações" (sino): monta, a partir de dados reais,
// uma linha do tempo única de eventos da operação — nova internação,
// mudança de unidade, transferência, retorno, alta, óbito e alta desfeita.
// Sem tabela nova: junta admissions + admission_unit_history + activity_log.
// Limitação conhecida: o activity_log não guarda QUEM fez a ação.
import type { ActivityLog, Admission, AdmissionUnitHistory, Hospital, Patient, Unit } from "@/types/domain";

export type TipoMovimentacao =
  | "internacao"
  | "lote_internacoes"
  | "mudanca_unidade"
  | "transferencia"
  | "retorno"
  | "alta"
  | "obito"
  | "alta_externa"
  | "alta_desfeita";

export interface Movimentacao {
  id: string;
  /** ISO — usado para ordenar e para "novo desde a última vez". */
  quando: string;
  tipo: TipoMovimentacao;
  titulo: string;
  detalhe: string;
  tom: "neutral" | "recovery" | "attention" | "critical";
}

export interface EntradaMovimentacoes {
  internacoes: Admission[];
  historico: AdmissionUnitHistory[];
  atividades: ActivityLog[];
  pacientes: Patient[];
  unidades: Unit[];
  hospitais: Hospital[];
}

export const LIMITE_MOVIMENTACOES = 50;
/** Internações criadas de uma vez (importação) viram uma linha só a partir deste número, no mesmo minuto. */
const MINIMO_PARA_AGRUPAR = 4;

export function montarMovimentacoes(e: EntradaMovimentacoes): Movimentacao[] {
  const pacientePorId = new Map(e.pacientes.map((p) => [p.id, p.full_name]));
  const unidadePorId = new Map(e.unidades.map((u) => [u.id, u.name]));
  const hospitalPorId = new Map(e.hospitais.map((h) => [h.id, h.name]));
  const internacaoPorId = new Map(e.internacoes.map((i) => [i.id, i]));
  const internacaoPorPrefixo = new Map(e.internacoes.map((i) => [i.id.slice(0, 8), i]));

  const nomeDe = (i: Admission | undefined) => (i ? pacientePorId.get(i.patient_id) ?? "Paciente" : "Paciente");
  const unidadeDe = (id: string | null) => (id ? unidadePorId.get(id) ?? null : null);
  const hospitalDe = (i: Admission | undefined) => (i?.hospital_id ? hospitalPorId.get(i.hospital_id) ?? null : null);
  const juntar = (...partes: (string | null | undefined)[]) => partes.filter(Boolean).join(" · ");

  const itens: Movimentacao[] = [];

  // 1) Novas internações — agrupa rajadas (importação) por minuto.
  const porMinuto = new Map<string, Admission[]>();
  for (const i of e.internacoes) {
    if (!i.created_at) continue;
    const chave = i.created_at.slice(0, 16);
    const lista = porMinuto.get(chave);
    if (lista) lista.push(i);
    else porMinuto.set(chave, [i]);
  }
  for (const [chave, lista] of porMinuto) {
    if (lista.length >= MINIMO_PARA_AGRUPAR) {
      const maisRecente = lista.reduce((a, b) => (a.created_at > b.created_at ? a : b));
      itens.push({
        id: `lote-${chave}`,
        quando: maisRecente.created_at,
        tipo: "lote_internacoes",
        titulo: `${lista.length} internações registradas de uma vez`,
        detalhe: "Provavelmente uma importação do Tasy.",
        tom: "neutral",
      });
      continue;
    }
    for (const i of lista) {
      itens.push({
        id: `int-${i.id}`,
        quando: i.created_at,
        tipo: "internacao",
        titulo: "Nova internação",
        detalhe: juntar(nomeDe(i), hospitalDe(i), unidadeDe(i.unit_id)),
        tom: "neutral",
      });
    }
  }

  // 2) Movimentações de unidade (mudança, transferência, retorno, alta na UTI externa).
  for (const h of e.historico) {
    const internacao = internacaoPorId.get(h.admission_id);
    const paciente = nomeDe(internacao);
    const origem = unidadeDe(h.unidade_origem_id);
    const destino = unidadeDe(h.unidade_destino_id);
    if (h.tipo === "mudanca_unidade") {
      itens.push({
        id: `hist-${h.id}`,
        quando: h.ocorrido_em,
        tipo: "mudanca_unidade",
        titulo: "Mudança de unidade",
        detalhe: juntar(paciente, origem && destino ? `${origem} → ${destino}` : destino ?? origem),
        tom: "neutral",
      });
    } else if (h.tipo === "transferencia_externa") {
      itens.push({
        id: `hist-${h.id}`,
        quando: h.ocorrido_em,
        tipo: "transferencia",
        titulo: "Transferência",
        detalhe: juntar(paciente, `para ${h.destino_externo ?? destino ?? "destino não informado"}`),
        tom: "attention",
      });
    } else if (h.tipo === "retorno_transferencia") {
      itens.push({
        id: `hist-${h.id}`,
        quando: h.ocorrido_em,
        tipo: "retorno",
        titulo: "Retorno da transferência",
        detalhe: juntar(paciente, destino),
        tom: "recovery",
      });
    } else if (h.tipo === "alta_externa") {
      const obito = (h.motivo ?? "").toLowerCase().includes("óbito");
      itens.push({
        id: `hist-${h.id}`,
        quando: h.ocorrido_em,
        tipo: "alta_externa",
        titulo: obito ? "Óbito na UTI externa" : "Alta na UTI externa",
        detalhe: juntar(paciente, h.destino_externo),
        tom: obito ? "critical" : "attention",
      });
    }
  }

  // 3) Altas e altas desfeitas, vindas do activity_log (o texto guarda só o início do id da internação).
  for (const a of e.atividades) {
    if (a.entity_type !== "Internação") continue;
    if (a.action !== "alta" && a.action !== "quebra_de_alta") continue;
    // A alta feita na UTI externa já aparece pelo histórico de unidade.
    if (a.action === "alta" && a.entity_label.includes("UTI externa")) continue;
    const prefixo = a.entity_label.match(/^Internação ([0-9a-f]{8})/)?.[1];
    const internacao = prefixo ? internacaoPorPrefixo.get(prefixo) : undefined;
    const paciente = nomeDe(internacao);
    if (a.action === "quebra_de_alta") {
      itens.push({
        id: `log-${a.id}`,
        quando: a.created_at,
        tipo: "alta_desfeita",
        titulo: "Alta desfeita",
        detalhe: juntar(paciente, hospitalDe(internacao)),
        tom: "attention",
      });
    } else {
      const obito = internacao?.discharge_type === "obito";
      itens.push({
        id: `log-${a.id}`,
        quando: a.created_at,
        tipo: obito ? "obito" : "alta",
        titulo: obito ? "Óbito" : "Alta hospitalar",
        detalhe: juntar(paciente, hospitalDe(internacao)),
        tom: obito ? "critical" : "recovery",
      });
    }
  }

  return itens.sort((a, b) => (a.quando < b.quando ? 1 : a.quando > b.quando ? -1 : 0)).slice(0, LIMITE_MOVIMENTACOES);
}

/** "agora", "há 5 min", "há 3 h", "ontem 14:30" ou "07/10 14:30" — referência injetável para teste. */
export function tempoRelativo(iso: string, agora: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const min = Math.floor((agora.getTime() - d.getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `há ${horas} h`;
  const hhmm = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const ontem = new Date(agora);
  ontem.setDate(ontem.getDate() - 1);
  if (d.toDateString() === ontem.toDateString()) return `ontem ${hhmm}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${hhmm}`;
}
