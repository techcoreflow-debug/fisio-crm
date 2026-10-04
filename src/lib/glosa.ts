/**
 * Prevenção de glosa — checagens ANTES do faturamento, só com regras
 * universais que dá para verificar nos dados que o sistema já tem. Regras
 * específicas de cada convênio ficam para quando existir cadastro delas
 * (ver backlog): aqui nada é presumido sobre um convênio em particular.
 *
 * Também traz a projeção do mês: linear sobre a produção real, sempre
 * rotulada como ESTIMATIVA e com a premissa à mostra.
 */
import type { Admission, BillingEntry, DailyProduction, HealthInsurance } from "@/types/domain";

/** Acima disso, muitos procedimentos/dia numa internação merece conferência (ajustável aqui). */
export const LIMITE_PROCEDIMENTOS_DIA = 4;

export type RegraGlosa = "duplicidade" | "frequencia_diaria" | "fora_da_internacao" | "sem_diagnostico" | "sem_convenio" | "sem_procedimento" | "limite_convenio";

export const REGRAS_GLOSA: Record<RegraGlosa, { titulo: string; explicacao: string; gravidade: "alta" | "media" }> = {
  duplicidade: {
    titulo: "Possível duplicidade",
    explicacao: "Mesma internação, mesmo procedimento, mesma data e mesmo horário lançados mais de uma vez.",
    gravidade: "alta",
  },
  fora_da_internacao: {
    titulo: "Lançamento fora da internação",
    explicacao: "Data do procedimento antes da entrada, depois da alta, ou lançamento sem internação vinculada.",
    gravidade: "alta",
  },
  sem_procedimento: {
    titulo: "Sem procedimento informado",
    explicacao: "Lançamento sem procedimento do catálogo — não há o que faturar.",
    gravidade: "alta",
  },
  frequencia_diaria: {
    titulo: "Frequência diária alta",
    explicacao: `Mais de ${LIMITE_PROCEDIMENTOS_DIA} procedimentos no mesmo dia na mesma internação (limite ajustável).`,
    gravidade: "media",
  },
  sem_diagnostico: {
    titulo: "Internação sem diagnóstico",
    explicacao: "Auditorias costumam glosar atendimentos sem diagnóstico que justifique a terapia.",
    gravidade: "media",
  },
  limite_convenio: {
    titulo: "Acima do limite do convênio",
    explicacao: "Procedimentos além do máximo cadastrado para o convênio (por dia ou por internação) — veja Cadastros → Convênios.",
    gravidade: "alta",
  },
  sem_convenio: {
    titulo: "Internação sem convênio",
    explicacao: "Sem convênio vinculado não há a quem faturar o atendimento.",
    gravidade: "media",
  },
};

export interface AlertaGlosa {
  regra: RegraGlosa;
  /** Lançamentos de produção envolvidos (ou, nas regras por internação, os do período). */
  producaoIds: string[];
  admissionId: string | null;
  /** Texto específico: o que exatamente disparou a regra. */
  detalhe: string;
}

export interface EntradaGlosa {
  de: string;
  ate: string;
  producao: DailyProduction[];
  internacoes: Admission[];
  /** Regras cadastradas por convênio (opcional): sem elas, valem só as regras gerais. */
  convenios?: HealthInsurance[];
}

function fmtData(iso: string) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

export function verificarGlosa(e: EntradaGlosa): AlertaGlosa[] {
  const alertas: AlertaGlosa[] = [];
  const periodo = e.producao.filter((p) => p.production_date >= e.de && p.production_date <= e.ate);
  const adm = new Map(e.internacoes.map((i) => [i.id, i]));

  // Duplicidade exata
  const grupos = new Map<string, DailyProduction[]>();
  for (const p of periodo) {
    if (!p.admission_id || !p.procedure_id) continue;
    const chave = `${p.admission_id}|${p.procedure_id}|${p.production_date}|${(p.production_time ?? "").slice(0, 5)}`;
    const lista = grupos.get(chave) ?? [];
    lista.push(p);
    grupos.set(chave, lista);
  }
  for (const lista of grupos.values()) {
    if (lista.length > 1) {
      alertas.push({
        regra: "duplicidade",
        producaoIds: lista.map((p) => p.id),
        admissionId: lista[0].admission_id,
        detalhe: `${lista.length} lançamentos idênticos em ${fmtData(lista[0].production_date)} ${(lista[0].production_time ?? "").slice(0, 5)}`,
      });
    }
  }

  // Frequência diária por internação
  const porDia = new Map<string, DailyProduction[]>();
  for (const p of periodo) {
    if (!p.admission_id) continue;
    const chave = `${p.admission_id}|${p.production_date}`;
    const lista = porDia.get(chave) ?? [];
    lista.push(p);
    porDia.set(chave, lista);
  }
  const convenioDe = (admissionId: string | null) => {
    const i = admissionId ? adm.get(admissionId) : undefined;
    return i?.health_insurance_id ? (e.convenios ?? []).find((c) => c.id === i.health_insurance_id) : undefined;
  };
  for (const lista of porDia.values()) {
    const conv = convenioDe(lista[0].admission_id);
    if (conv?.max_procedimentos_dia) {
      if (lista.length > conv.max_procedimentos_dia) {
        alertas.push({
          regra: "limite_convenio",
          producaoIds: lista.map((p) => p.id),
          admissionId: lista[0].admission_id,
          detalhe: `${lista.length} procedimentos em ${fmtData(lista[0].production_date)} — ${conv.name} permite ${conv.max_procedimentos_dia}/dia`,
        });
      }
    } else if (lista.length > LIMITE_PROCEDIMENTOS_DIA) {
      alertas.push({
        regra: "frequencia_diaria",
        producaoIds: lista.map((p) => p.id),
        admissionId: lista[0].admission_id,
        detalhe: `${lista.length} procedimentos em ${fmtData(lista[0].production_date)}`,
      });
    }
  }

  // Teto por internação: conta TODA a produção da internação até o fim do período.
  const totalPorInternacao = new Map<string, number>();
  for (const p of e.producao) {
    if (p.admission_id && p.production_date <= e.ate) totalPorInternacao.set(p.admission_id, (totalPorInternacao.get(p.admission_id) ?? 0) + 1);
  }
  const idsPeriodo = new Set(periodo.map((p) => p.admission_id).filter((x): x is string => !!x));
  for (const id of idsPeriodo) {
    const conv = convenioDe(id);
    const total = totalPorInternacao.get(id) ?? 0;
    if (conv?.max_procedimentos_internacao && total > conv.max_procedimentos_internacao) {
      alertas.push({
        regra: "limite_convenio",
        producaoIds: periodo.filter((p) => p.admission_id === id).map((p) => p.id),
        admissionId: id,
        detalhe: `${total} procedimentos na internação — ${conv.name} autoriza ${conv.max_procedimentos_internacao}`,
      });
    }
  }

  // Por lançamento: fora da internação e sem procedimento
  for (const p of periodo) {
    if (!p.procedure_id) {
      alertas.push({ regra: "sem_procedimento", producaoIds: [p.id], admissionId: p.admission_id, detalhe: `Lançamento de ${fmtData(p.production_date)} sem procedimento` });
    }
    if (!p.admission_id) {
      alertas.push({ regra: "fora_da_internacao", producaoIds: [p.id], admissionId: null, detalhe: `Lançamento de ${fmtData(p.production_date)} sem internação vinculada` });
      continue;
    }
    const i = adm.get(p.admission_id);
    if (!i) continue;
    if (p.production_date < i.admission_date) {
      alertas.push({ regra: "fora_da_internacao", producaoIds: [p.id], admissionId: i.id, detalhe: `${fmtData(p.production_date)} é anterior à entrada (${fmtData(i.admission_date)})` });
    } else if (i.discharge_date && p.production_date > i.discharge_date) {
      alertas.push({ regra: "fora_da_internacao", producaoIds: [p.id], admissionId: i.id, detalhe: `${fmtData(p.production_date)} é posterior à alta (${fmtData(i.discharge_date)})` });
    }
  }

  // Por internação com produção no período: diagnóstico e convênio
  const idsComProducao = new Set(periodo.map((p) => p.admission_id).filter((x): x is string => !!x));
  for (const id of idsComProducao) {
    const i = adm.get(id);
    if (!i) continue;
    const ids = periodo.filter((p) => p.admission_id === id).map((p) => p.id);
    const exige = convenioDe(id)?.exige_diagnostico ?? true;
    if (exige && (!i.diagnostico || !i.diagnostico.trim())) {
      alertas.push({ regra: "sem_diagnostico", producaoIds: ids, admissionId: id, detalhe: `${ids.length} lançamento(s) no período sem diagnóstico na internação` });
    }
    if (!i.health_insurance_id) {
      alertas.push({ regra: "sem_convenio", producaoIds: ids, admissionId: id, detalhe: `${ids.length} lançamento(s) no período sem convênio na internação` });
    }
  }

  return alertas.sort((a, b) => Number(REGRAS_GLOSA[b.regra].gravidade === "alta") - Number(REGRAS_GLOSA[a.regra].gravidade === "alta"));
}

export interface ProjecaoMes {
  mes: string;
  diasDecorridos: number;
  diasNoMes: number;
  lancadoAteHoje: number;
  projecaoProcedimentos: number | null;
  /** Valor por procedimento lançado no mês anterior (repasse ÷ lançados) — referência, não promessa. */
  valorPorProcedimentoMesAnterior: number | null;
  projecaoValor: number | null;
}

/** Projeção linear do mês corrente. Com menos de 3 dias decorridos não projeta (amostra pequena demais). */
export function projetarMes(hojeIso: string, producao: DailyProduction[], billing: BillingEntry[]): ProjecaoMes {
  const mes = hojeIso.slice(0, 7);
  const [ano, mm] = mes.split("-").map(Number);
  const diasNoMes = new Date(ano, mm, 0).getDate();
  const diasDecorridos = Number(hojeIso.slice(8, 10));
  const lancadoAteHoje = producao.filter((p) => p.production_date.startsWith(mes) && p.production_date <= hojeIso).length;

  const projecaoProcedimentos = diasDecorridos >= 3 && lancadoAteHoje > 0 ? Math.round((lancadoAteHoje / diasDecorridos) * diasNoMes) : null;

  const anterior = mm === 1 ? `${ano - 1}-12` : `${ano}-${String(mm - 1).padStart(2, "0")}`;
  const lancadoAnterior = producao.filter((p) => p.production_date.startsWith(anterior)).length;
  const repasseAnterior = billing.filter((b) => b.competencia.startsWith(anterior)).reduce((acc, b) => acc + b.valor_repasse, 0);
  const valorPorProc = lancadoAnterior > 0 && repasseAnterior > 0 ? repasseAnterior / lancadoAnterior : null;

  return {
    mes,
    diasDecorridos,
    diasNoMes,
    lancadoAteHoje,
    projecaoProcedimentos,
    valorPorProcedimentoMesAnterior: valorPorProc,
    projecaoValor: projecaoProcedimentos !== null && valorPorProc !== null ? projecaoProcedimentos * valorPorProc : null,
  };
}
