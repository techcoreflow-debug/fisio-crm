/**
 * Radar de prioridade — ordena os pacientes internados por quem mais
 * precisa de atenção hoje, com REGRAS TRANSPARENTES: cada paciente mostra
 * os motivos que somaram pontos. Nada de caixa-preta e nada de IA aqui — o
 * fisioterapeuta e o gestor conseguem conferir e discordar da regra.
 */
import type { Admission, ClinicalEvolution, DailyProduction, FunctionalAssessment } from "@/types/domain";
import { ESCALAS, ganhoEntre } from "@/lib/escalas-funcionais";

export const LIMITES_RADAR = {
  diasSemAtendimento: 2,
  diasSemEvolucao: 3,
  diasSemAvaliacaoPrimeira: 3,
  diasAvaliacaoDesatualizada: 7,
  diasPermanenciaProlongada: 14,
  mrcFraqueza: 48,
  barthelDependenciaTotal: 20,
} as const;

export type NivelRadar = "alta" | "atencao" | "acompanhar";

export interface ItemRadar {
  admissionId: string;
  pontos: number;
  nivel: NivelRadar;
  motivos: string[];
}

export interface EntradaRadar {
  hoje: string;
  internacoes: Admission[];
  producao: DailyProduction[];
  evolucoes: ClinicalEvolution[];
  avaliacoes: FunctionalAssessment[];
}

export const REGRAS_RADAR: { regra: string; pontos: number }[] = [
  { regra: `Sem atendimento há ${LIMITES_RADAR.diasSemAtendimento} dias ou mais (ou nunca atendido)`, pontos: 3 },
  { regra: "Piora funcional na última reavaliação (escore pior que o anterior)", pontos: 3 },
  { regra: `MRC-SS abaixo de ${LIMITES_RADAR.mrcFraqueza} (fraqueza adquirida na UTI)`, pontos: 2 },
  { regra: `Barthel até ${LIMITES_RADAR.barthelDependenciaTotal} (dependência total)`, pontos: 1 },
  { regra: `Sem nenhuma avaliação funcional após ${LIMITES_RADAR.diasSemAvaliacaoPrimeira} dias de internação`, pontos: 1 },
  { regra: `Avaliação funcional desatualizada (${LIMITES_RADAR.diasAvaliacaoDesatualizada} dias ou mais)`, pontos: 1 },
  { regra: `Sem evolução clínica há ${LIMITES_RADAR.diasSemEvolucao} dias ou mais`, pontos: 1 },
  { regra: `Permanência prolongada (${LIMITES_RADAR.diasPermanenciaProlongada} dias ou mais)`, pontos: 1 },
];

function diasEntre(inicioIso: string, fimIso: string): number {
  const a = new Date(`${inicioIso.slice(0, 10)}T00:00:00`).getTime();
  const b = new Date(`${fimIso.slice(0, 10)}T00:00:00`).getTime();
  return Math.round((b - a) / 86400000);
}

function nivelPorPontos(p: number): NivelRadar | null {
  if (p >= 5) return "alta";
  if (p >= 3) return "atencao";
  if (p >= 1) return "acompanhar";
  return null;
}

export function calcularRadar(e: EntradaRadar): ItemRadar[] {
  const itens: ItemRadar[] = [];
  const L = LIMITES_RADAR;

  for (const i of e.internacoes) {
    if (i.status !== "internado") continue;
    const motivos: string[] = [];
    let pontos = 0;
    const dias = Math.max(0, diasEntre(i.admission_date, e.hoje));

    const prod = e.producao.filter((p) => p.admission_id === i.id).map((p) => p.production_date).sort();
    const ultimoAtendimento = prod[prod.length - 1];
    if (ultimoAtendimento) {
      const semAtender = diasEntre(ultimoAtendimento, e.hoje);
      if (semAtender >= L.diasSemAtendimento) {
        pontos += 3;
        motivos.push(`Sem atendimento há ${semAtender} dias`);
      }
    } else if (dias >= 1) {
      pontos += 3;
      motivos.push("Ainda sem nenhum atendimento lançado");
    }

    const avs = e.avaliacoes.filter((a) => a.admission_id === i.id);
    if (avs.length === 0) {
      if (dias >= L.diasSemAvaliacaoPrimeira) {
        pontos += 1;
        motivos.push(`Sem avaliação funcional (${dias} dias de internação)`);
      }
    } else {
      const ordenadas = [...avs].sort((a, b) => a.avaliado_em.localeCompare(b.avaliado_em));
      const ultima = ordenadas[ordenadas.length - 1];
      const defsVistas = new Set<string>();
      for (let k = ordenadas.length - 1; k >= 0; k--) {
        const atual = ordenadas[k];
        if (defsVistas.has(atual.escala)) continue;
        defsVistas.add(atual.escala);
        const def = ESCALAS[atual.escala];
        const anterior = [...ordenadas.slice(0, k)].reverse().find((x) => x.escala === atual.escala);
        if (anterior && ganhoEntre(def, anterior.score, atual.score) < 0) {
          pontos += 3;
          motivos.push(`Piora funcional em ${def.sigla}: ${anterior.score} → ${atual.score}`);
        }
        if (atual.escala === "mrc" && atual.score < L.mrcFraqueza) {
          pontos += 2;
          motivos.push(`MRC-SS ${atual.score} (< ${L.mrcFraqueza}): fraqueza adquirida na UTI`);
        }
        if (atual.escala === "barthel" && atual.score <= L.barthelDependenciaTotal) {
          pontos += 1;
          motivos.push(`Barthel ${atual.score}: dependência total`);
        }
      }
      const desde = diasEntre(ultima.avaliado_em, e.hoje);
      if (desde >= L.diasAvaliacaoDesatualizada) {
        pontos += 1;
        motivos.push(`Última avaliação funcional há ${desde} dias`);
      }
    }

    const evo = e.evolucoes.filter((x) => x.admission_id === i.id).map((x) => x.created_at.slice(0, 10)).sort();
    const ultimaEvo = evo[evo.length - 1];
    const semEvolucao = ultimaEvo ? diasEntre(ultimaEvo, e.hoje) : dias;
    if (semEvolucao >= L.diasSemEvolucao && dias >= L.diasSemEvolucao) {
      pontos += 1;
      motivos.push(ultimaEvo ? `Sem evolução há ${semEvolucao} dias` : "Nenhuma evolução registrada");
    }

    if (dias >= L.diasPermanenciaProlongada) {
      pontos += 1;
      motivos.push(`${dias} dias de internação`);
    }

    const nivel = nivelPorPontos(pontos);
    if (nivel) itens.push({ admissionId: i.id, pontos, nivel, motivos });
  }

  return itens.sort((a, b) => b.pontos - a.pontos);
}
