/**
 * Jornada do paciente — junta, em ordem cronológica, tudo que aconteceu em
 * uma internação: entrada, mudanças de unidade/transferências, evoluções,
 * procedimentos (agrupados por dia), avaliações funcionais e a alta.
 * Função pura: o módulo só renderiza, e o mesmo resultado serve de base
 * para o resumo de alta e a IA (Fase C).
 */
import type {
  Admission,
  AdmissionUnitHistory,
  ClinicalEvolution,
  DailyProduction,
  FunctionalAssessment,
  Procedure,
} from "@/types/domain";
import { ESCALAS, MOMENTO_LABEL } from "@/lib/escalas-funcionais";

export type TipoEventoJornada = "internacao" | "unidade" | "evolucao" | "procedimento" | "avaliacao" | "alta";

export interface EventoJornada {
  id: string;
  tipo: TipoEventoJornada;
  quando: number;
  titulo: string;
  detalhe?: string;
}

export interface EntradaJornada {
  internacao: Admission;
  historico: AdmissionUnitHistory[];
  evolucoes: ClinicalEvolution[];
  producao: DailyProduction[];
  avaliacoes: FunctionalAssessment[];
  procedimentos: Procedure[];
  /** Resolve id → nome legível do local (hospital · unidade). */
  nomeLocal: (hospitalId: string | null, unitId: string | null) => string;
}

function ms(valor: string): number {
  const t = new Date(valor).getTime();
  return Number.isNaN(t) ? 0 : t;
}

const ROTULO_MOVIMENTO: Record<AdmissionUnitHistory["tipo"], string> = {
  mudanca_unidade: "Mudança de unidade",
  transferencia_externa: "Transferência",
  retorno_transferencia: "Retorno de transferência",
};

export function montarJornada(e: EntradaJornada): EventoJornada[] {
  const eventos: EventoJornada[] = [];
  const { internacao } = e;

  eventos.push({
    id: `int-${internacao.id}`,
    tipo: "internacao",
    quando: ms(`${internacao.admission_date}T${(internacao.admission_time || "00:00").slice(0, 5)}`),
    titulo: "Internação",
    detalhe: [e.nomeLocal(internacao.hospital_id, internacao.unit_id), internacao.diagnostico].filter(Boolean).join(" · "),
  });

  for (const h of e.historico) {
    const origem = e.nomeLocal(h.hospital_origem_id, h.unidade_origem_id);
    const destino = h.destino_externo ?? e.nomeLocal(h.hospital_destino_id, h.unidade_destino_id);
    eventos.push({
      id: `mov-${h.id}`,
      tipo: "unidade",
      quando: ms(h.ocorrido_em),
      titulo: ROTULO_MOVIMENTO[h.tipo],
      detalhe: `${origem} → ${destino}${h.motivo ? ` · ${h.motivo}` : ""}`,
    });
  }

  for (const ev of e.evolucoes) {
    const texto = ev.content.trim();
    eventos.push({
      id: `evo-${ev.id}`,
      tipo: "evolucao",
      quando: ms(ev.created_at),
      titulo: "Evolução clínica",
      detalhe: texto.length > 220 ? `${texto.slice(0, 220)}…` : texto,
    });
  }

  // Procedimentos: um evento por dia, para a linha do tempo não virar uma
  // lista de centenas de linhas em internações longas.
  const porDia = new Map<string, DailyProduction[]>();
  for (const p of e.producao) {
    const lista = porDia.get(p.production_date) ?? [];
    lista.push(p);
    porDia.set(p.production_date, lista);
  }
  for (const [dia, lista] of porDia) {
    const nomes = lista.map((p) => e.procedimentos.find((x) => x.id === p.procedure_id)?.name ?? "Procedimento");
    const horaMax = lista.map((p) => (p.production_time || "00:00").slice(0, 5)).sort().pop() ?? "00:00";
    eventos.push({
      id: `proc-${dia}`,
      tipo: "procedimento",
      quando: ms(`${dia}T${horaMax}`),
      titulo: `${lista.length} procedimento${lista.length > 1 ? "s" : ""}`,
      detalhe: Array.from(new Set(nomes)).join(", "),
    });
  }

  for (const a of e.avaliacoes) {
    const def = ESCALAS[a.escala];
    eventos.push({
      id: `ava-${a.id}`,
      tipo: "avaliacao",
      quando: ms(`${a.avaliado_em}T12:00`),
      titulo: `${def.sigla} — ${MOMENTO_LABEL[a.momento]}`,
      detalhe: `${a.score}/${def.max} · ${def.classificar(a.score).label}`,
    });
  }

  if (internacao.discharge_at || internacao.discharge_date) {
    eventos.push({
      id: `alta-${internacao.id}`,
      tipo: "alta",
      quando: ms(internacao.discharge_at ?? `${internacao.discharge_date}T23:59`),
      titulo: internacao.discharge_type === "obito" ? "Óbito" : "Alta hospitalar",
    });
  }

  return eventos.sort((a, b) => a.quando - b.quando);
}

/** Dias entre a internação e a alta (ou hoje, se ainda internado). */
export function diasDeInternacao(internacao: Admission, agora = Date.now()): number {
  const inicio = ms(`${internacao.admission_date}T00:00`);
  const fim = internacao.discharge_date ? ms(`${internacao.discharge_date}T00:00`) : agora;
  return Math.max(0, Math.round((fim - inicio) / 86400000));
}
