/**
 * Painel de valor — resultado clínico + eficiência num só quadro, calculado
 * só de dado real. Quando não há base suficiente, o indicador vem `null` e
 * a tela escreve "sem dado": nunca se estima em silêncio.
 * Também gera o relatório narrativo determinístico (sem IA) a partir dos
 * mesmos números; a versão com IA (Fase C) só reescreve esse texto.
 */
import type { Admission, DailyProduction, FunctionalAssessment } from "@/types/domain";
import { ESCALAS, ganhoPorInternacao, mediaOuNull } from "@/lib/escalas-funcionais";

export interface EntradaPainelValor {
  de: string;
  ate: string;
  internacoes: Admission[];
  producao: DailyProduction[];
  avaliacoes: FunctionalAssessment[];
}

export interface PainelValor {
  altas: number;
  obitos: number;
  permanenciaMediaDias: number | null;
  ganhoFuncionalMedioPct: number | null;
  internacoesComGanho: number;
  /** % das altas do período com ≥ 2 avaliações da mesma escala (cobertura da medição). */
  coberturaAvaliacaoPct: number | null;
  internacoesNoPeriodo: number;
  reinternacoes30d: number;
  reinternacao30dPct: number | null;
  procedimentos: number;
  glosados: number;
  glosaPct: number | null;
  valorGlosado: number;
  melhorEscala: { sigla: string; ganhoPct: number; n: number } | null;
}

function diasEntre(inicio: string, fim: string): number {
  const a = new Date(`${inicio}T00:00:00`).getTime();
  const b = new Date(`${fim}T00:00:00`).getTime();
  return Math.round((b - a) / 86400000);
}

export function calcularPainelValor(e: EntradaPainelValor): PainelValor {
  const altasPeriodo = e.internacoes.filter(
    (i) => i.discharge_date && i.discharge_date >= e.de && i.discharge_date <= e.ate
  );
  const altas = altasPeriodo.filter((i) => i.discharge_type !== "obito");
  const obitos = altasPeriodo.length - altas.length;

  const permanencia = mediaOuNull(altas.map((i) => Math.max(0, diasEntre(i.admission_date, i.discharge_date as string))));

  const idsEscopo = new Set(e.internacoes.map((i) => i.id));
  const avaliacoesPeriodo = e.avaliacoes.filter((a) => idsEscopo.has(a.admission_id) && a.avaliado_em >= e.de && a.avaliado_em <= e.ate);
  const ganhos = ganhoPorInternacao(avaliacoesPeriodo.map((a) => ({ admission_id: a.admission_id, escala: a.escala, score: a.score, avaliado_em: a.avaliado_em })));
  const ganhoMedio = mediaOuNull(ganhos.map((g) => g.ganhoPercentual));
  const internacoesComGanho = new Set(ganhos.map((g) => g.admission_id)).size;

  const altasMedidas = altas.filter((i) => ganhos.some((g) => g.admission_id === i.id)).length;
  const cobertura = altas.length === 0 ? null : (altasMedidas / altas.length) * 100;

  const porEscala = new Map<string, number[]>();
  for (const g of ganhos) {
    const lista = porEscala.get(g.escala) ?? [];
    lista.push(g.ganhoPercentual);
    porEscala.set(g.escala, lista);
  }
  let melhorEscala: PainelValor["melhorEscala"] = null;
  for (const [escala, lista] of porEscala) {
    const media = mediaOuNull(lista) ?? 0;
    if (lista.length >= 2 && (melhorEscala === null || media > melhorEscala.ganhoPct)) {
      melhorEscala = { sigla: ESCALAS[escala as keyof typeof ESCALAS].sigla, ganhoPct: media, n: lista.length };
    }
  }

  // Reinternação em 30 dias: internação do período cujo paciente teve alta
  // de outra internação nos 30 dias anteriores à entrada.
  const novas = e.internacoes.filter((i) => i.admission_date >= e.de && i.admission_date <= e.ate);
  let reinternacoes = 0;
  for (const nova of novas) {
    const reinternou = e.internacoes.some(
      (anterior) =>
        anterior.id !== nova.id &&
        anterior.patient_id === nova.patient_id &&
        anterior.discharge_date &&
        anterior.discharge_type !== "obito" &&
        anterior.discharge_date <= nova.admission_date &&
        diasEntre(anterior.discharge_date, nova.admission_date) <= 30
    );
    if (reinternou) reinternacoes++;
  }

  const producaoPeriodo = e.producao.filter(
    (p) => p.production_date >= e.de && p.production_date <= e.ate && (p.admission_id === null || idsEscopo.has(p.admission_id))
  );
  const glosados = producaoPeriodo.filter((p) => p.glosado);

  return {
    altas: altas.length,
    obitos,
    permanenciaMediaDias: permanencia,
    ganhoFuncionalMedioPct: ganhoMedio,
    internacoesComGanho,
    coberturaAvaliacaoPct: cobertura,
    internacoesNoPeriodo: novas.length,
    reinternacoes30d: reinternacoes,
    reinternacao30dPct: novas.length === 0 ? null : (reinternacoes / novas.length) * 100,
    procedimentos: producaoPeriodo.length,
    glosados: glosados.length,
    glosaPct: producaoPeriodo.length === 0 ? null : (glosados.length / producaoPeriodo.length) * 100,
    valorGlosado: glosados.reduce((acc, p) => acc + (p.valor_glosado ?? 0), 0),
    melhorEscala,
  };
}

const fmt1 = (v: number) => (Math.round(v * 10) / 10).toLocaleString("pt-BR");
const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Relatório narrativo determinístico: cada frase só existe se houver número real por trás. */
export function narrativaPainelValor(p: PainelValor, rotuloPeriodo: string): string {
  const frases: string[] = [];
  frases.push(
    p.altas === 0
      ? `No período ${rotuloPeriodo} não houve altas hospitalares registradas${p.obitos > 0 ? ` (${p.obitos} óbito(s))` : ""}.`
      : `No período ${rotuloPeriodo} foram registradas ${p.altas} alta(s) hospitalar(es)${p.obitos > 0 ? ` e ${p.obitos} óbito(s)` : ""}, ${p.procedimentos} procedimento(s) lançado(s).`
  );
  if (p.permanenciaMediaDias !== null) frases.push(`A permanência média das altas foi de ${fmt1(p.permanenciaMediaDias)} dia(s).`);
  if (p.ganhoFuncionalMedioPct !== null) {
    frases.push(
      `Entre ${p.internacoesComGanho} internação(ões) com pelo menos duas avaliações funcionais, o ganho médio foi de ${p.ganhoFuncionalMedioPct >= 0 ? "+" : ""}${fmt1(p.ganhoFuncionalMedioPct)}% da amplitude da escala` +
        (p.melhorEscala ? `, com destaque para ${p.melhorEscala.sigla} (${p.melhorEscala.ganhoPct >= 0 ? "+" : ""}${fmt1(p.melhorEscala.ganhoPct)}%, ${p.melhorEscala.n} medições).` : ".")
    );
    if (p.coberturaAvaliacaoPct !== null) frases.push(`${fmt1(p.coberturaAvaliacaoPct)}% das altas do período têm ganho funcional mensurável.`);
  } else {
    frases.push("Ainda não há reavaliações funcionais suficientes no período para medir ganho funcional.");
  }
  if (p.reinternacao30dPct !== null) {
    frases.push(`Reinternações em até 30 dias: ${p.reinternacoes30d} de ${p.internacoesNoPeriodo} internação(ões) do período (${fmt1(p.reinternacao30dPct)}%).`);
  }
  if (p.glosaPct !== null) {
    frases.push(`Glosa: ${p.glosados} de ${p.procedimentos} procedimento(s) (${fmt1(p.glosaPct)}%)${p.valorGlosado > 0 ? `, ${fmtBRL(p.valorGlosado)} glosados` : ""}.`);
  }
  return frases.join(" ");
}
