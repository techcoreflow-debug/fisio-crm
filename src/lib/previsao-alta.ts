/**
 * Previsão de alta — ESTIMATIVA estatística simples e transparente:
 * mediana de permanência das altas hospitalares anteriores (mesmo
 * diagnóstico, se houver base; senão mesma unidade). Não é modelo
 * preditivo clínico: não conhece a gravidade do paciente. Sem base mínima
 * de casos, devolve `null` ("sem dado") em vez de chutar.
 */
import type { Admission } from "@/types/domain";

export const MIN_CASOS_PREVISAO = 5;

export interface PrevisaoAlta {
  admissionId: string;
  medianaDias: number;
  casos: number;
  base: "diagnóstico" | "unidade";
  /** Data estimada (YYYY-MM-DD) = entrada + mediana. */
  dataEstimada: string;
  /** Dias já passados além da mediana (0 se ainda dentro do esperado). */
  diasAlemDaMediana: number;
  diasInternado: number;
}

function ms(iso: string) {
  return new Date(`${iso}T00:00:00`).getTime();
}
function dias(a: string, b: string) {
  return Math.round((ms(b) - ms(a)) / 86400000);
}
function adicionar(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
export function mediana(valores: number[]): number {
  const o = [...valores].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}
const norm = (t: string | null) => (t ?? "").trim().toLowerCase();

export function preverAlta(internacao: Admission, todas: Admission[], hojeIso: string): PrevisaoAlta | null {
  if (internacao.status !== "internado") return null;
  const concluidas = todas.filter(
    (a) => a.id !== internacao.id && a.discharge_date && a.discharge_type !== "obito" && a.discharge_date >= a.admission_date
  );
  const permanencia = (a: Admission) => dias(a.admission_date, a.discharge_date as string);

  const mesmoDiag = norm(internacao.diagnostico)
    ? concluidas.filter((a) => norm(a.diagnostico) === norm(internacao.diagnostico))
    : [];
  const mesmaUnidade = internacao.unit_id ? concluidas.filter((a) => a.unit_id === internacao.unit_id) : [];

  let base: PrevisaoAlta["base"];
  let amostra: Admission[];
  if (mesmoDiag.length >= MIN_CASOS_PREVISAO) {
    base = "diagnóstico";
    amostra = mesmoDiag;
  } else if (mesmaUnidade.length >= MIN_CASOS_PREVISAO) {
    base = "unidade";
    amostra = mesmaUnidade;
  } else {
    return null;
  }

  const med = Math.round(mediana(amostra.map(permanencia)));
  const diasInternado = Math.max(0, dias(internacao.admission_date, hojeIso));
  return {
    admissionId: internacao.id,
    medianaDias: med,
    casos: amostra.length,
    base,
    dataEstimada: adicionar(internacao.admission_date, med),
    diasAlemDaMediana: Math.max(0, diasInternado - med),
    diasInternado,
  };
}

export function preverAltas(internacoes: Admission[], hojeIso: string): PrevisaoAlta[] {
  return internacoes
    .map((i) => preverAlta(i, internacoes, hojeIso))
    .filter((p): p is PrevisaoAlta => p !== null)
    .sort((a, b) => a.dataEstimada.localeCompare(b.dataEstimada));
}
