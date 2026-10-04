/**
 * Escalas funcionais — definição dos instrumentos, cálculo do escore e
 * classificação. Tudo aqui é função pura (sem React, sem banco), de
 * propósito: é a base de todo o resto (curva de ganho funcional, painel de
 * valor, radar de prioridade, IA) e precisa ser testável isoladamente.
 *
 * Instrumentos incluídos (todos de domínio público e amplamente usados em
 * fisioterapia hospitalar/UTI): Índice de Barthel, MRC-SS, ICU Mobility
 * Scale (IMS), FSS-ICU e Borg CR10 (dispneia/fadiga).
 *
 * ATENÇÃO CLÍNICA: os textos dos itens abaixo devem ser validados pela
 * equipe clínica responsável antes do uso oficial no hospital. O sistema
 * calcula e apresenta; a interpretação clínica é sempre do profissional.
 */

export type EscalaId = "barthel" | "mrc" | "ims" | "fss_icu" | "borg";
export type MomentoAvaliacao = "admissao" | "reavaliacao" | "alta";

export const MOMENTO_LABEL: Record<MomentoAvaliacao, string> = {
  admissao: "Admissão",
  reavaliacao: "Reavaliação",
  alta: "Alta",
};

export type TomClassificacao = "critical" | "attention" | "recovery" | "clinical" | "neutral";

export interface OpcaoItem {
  valor: number;
  label: string;
}

export interface ItemEscala {
  id: string;
  label: string;
  opcoes: OpcaoItem[];
}

export interface Classificacao {
  label: string;
  tom: TomClassificacao;
}

export interface EscalaDef {
  id: EscalaId;
  nome: string;
  sigla: string;
  descricao: string;
  min: number;
  max: number;
  /** "maior": escore maior = melhor (ex.: Barthel). "menor": escore menor = melhor (ex.: Borg). */
  melhorQuando: "maior" | "menor";
  itens: ItemEscala[];
  classificar: (score: number) => Classificacao;
}

function opcoes(...pares: [number, string][]): OpcaoItem[] {
  return pares.map(([valor, label]) => ({ valor, label }));
}

const BARTHEL_ITENS: ItemEscala[] = [
  { id: "alimentacao", label: "Alimentação", opcoes: opcoes([0, "Dependente"], [5, "Precisa de ajuda (cortar, passar manteiga)"], [10, "Independente"]) },
  { id: "banho", label: "Banho", opcoes: opcoes([0, "Dependente"], [5, "Independente"]) },
  { id: "higiene", label: "Higiene pessoal (rosto, cabelo, dentes, barba)", opcoes: opcoes([0, "Precisa de ajuda"], [5, "Independente"]) },
  { id: "vestir", label: "Vestir-se", opcoes: opcoes([0, "Dependente"], [5, "Precisa de ajuda, faz cerca de metade"], [10, "Independente"]) },
  { id: "intestino", label: "Controle intestinal", opcoes: opcoes([0, "Incontinente"], [5, "Acidente ocasional"], [10, "Continente"]) },
  { id: "bexiga", label: "Controle vesical", opcoes: opcoes([0, "Incontinente ou sondado"], [5, "Acidente ocasional"], [10, "Continente"]) },
  { id: "toalete", label: "Uso do vaso sanitário", opcoes: opcoes([0, "Dependente"], [5, "Precisa de alguma ajuda"], [10, "Independente"]) },
  {
    id: "transferencia",
    label: "Transferência cadeira ↔ cama",
    opcoes: opcoes([0, "Incapaz, sem equilíbrio sentado"], [5, "Grande ajuda (1–2 pessoas), consegue sentar"], [10, "Pequena ajuda (verbal ou física)"], [15, "Independente"]),
  },
  {
    id: "mobilidade",
    label: "Mobilidade (superfície plana)",
    opcoes: opcoes([0, "Imóvel ou caminha menos de 50 m"], [5, "Independente em cadeira de rodas (> 50 m)"], [10, "Caminha com ajuda de uma pessoa (> 50 m)"], [15, "Independente, pode usar auxiliar (> 50 m)"]),
  },
  { id: "escadas", label: "Escadas", opcoes: opcoes([0, "Incapaz"], [5, "Precisa de ajuda"], [10, "Independente"]) },
];

const MRC_OPCOES = opcoes(
  [0, "0 — Sem contração"],
  [1, "1 — Contração visível/palpável, sem movimento"],
  [2, "2 — Movimento sem vencer a gravidade"],
  [3, "3 — Vence a gravidade"],
  [4, "4 — Vence resistência moderada"],
  [5, "5 — Força normal"]
);

const MRC_ITENS: ItemEscala[] = [
  { id: "ombro_d", label: "Abdução do ombro — direito", opcoes: MRC_OPCOES },
  { id: "ombro_e", label: "Abdução do ombro — esquerdo", opcoes: MRC_OPCOES },
  { id: "cotovelo_d", label: "Flexão do cotovelo — direito", opcoes: MRC_OPCOES },
  { id: "cotovelo_e", label: "Flexão do cotovelo — esquerdo", opcoes: MRC_OPCOES },
  { id: "punho_d", label: "Extensão do punho — direito", opcoes: MRC_OPCOES },
  { id: "punho_e", label: "Extensão do punho — esquerdo", opcoes: MRC_OPCOES },
  { id: "quadril_d", label: "Flexão do quadril — direito", opcoes: MRC_OPCOES },
  { id: "quadril_e", label: "Flexão do quadril — esquerdo", opcoes: MRC_OPCOES },
  { id: "joelho_d", label: "Extensão do joelho — direito", opcoes: MRC_OPCOES },
  { id: "joelho_e", label: "Extensão do joelho — esquerdo", opcoes: MRC_OPCOES },
  { id: "tornozelo_d", label: "Dorsiflexão do tornozelo — direito", opcoes: MRC_OPCOES },
  { id: "tornozelo_e", label: "Dorsiflexão do tornozelo — esquerdo", opcoes: MRC_OPCOES },
];

const FSS_OPCOES = opcoes(
  [0, "0 — Incapaz / não testado"],
  [1, "1 — Assistência total"],
  [2, "2 — Assistência máxima"],
  [3, "3 — Assistência moderada"],
  [4, "4 — Assistência mínima"],
  [5, "5 — Supervisão"],
  [6, "6 — Independência modificada"],
  [7, "7 — Independência completa"]
);

const FSS_ITENS: ItemEscala[] = [
  { id: "rolar", label: "Rolar no leito", opcoes: FSS_OPCOES },
  { id: "supino_sentado", label: "Decúbito dorsal → sentado na beira do leito", opcoes: FSS_OPCOES },
  { id: "sentado_beira", label: "Sentar na beira do leito", opcoes: FSS_OPCOES },
  { id: "sentar_levantar", label: "Sentar → levantar", opcoes: FSS_OPCOES },
  { id: "caminhar", label: "Caminhar", opcoes: FSS_OPCOES },
];

export const ESCALAS: Record<EscalaId, EscalaDef> = {
  barthel: {
    id: "barthel",
    nome: "Índice de Barthel",
    sigla: "Barthel",
    descricao: "Independência nas atividades de vida diária (0–100).",
    min: 0,
    max: 100,
    melhorQuando: "maior",
    itens: BARTHEL_ITENS,
    classificar: (s) => {
      if (s >= 100) return { label: "Independente", tom: "recovery" };
      if (s >= 91) return { label: "Dependência leve", tom: "recovery" };
      if (s >= 61) return { label: "Dependência moderada", tom: "clinical" };
      if (s >= 21) return { label: "Dependência severa", tom: "attention" };
      return { label: "Dependência total", tom: "critical" };
    },
  },
  mrc: {
    id: "mrc",
    nome: "MRC-SS (força muscular global)",
    sigla: "MRC-SS",
    descricao: "Soma da força de 12 grupos musculares (0–60). Abaixo de 48 sugere fraqueza adquirida na UTI.",
    min: 0,
    max: 60,
    melhorQuando: "maior",
    itens: MRC_ITENS,
    classificar: (s) => {
      if (s >= 48) return { label: "Sem fraqueza significativa", tom: "recovery" };
      if (s >= 36) return { label: "Fraqueza significativa", tom: "attention" };
      return { label: "Fraqueza grave", tom: "critical" };
    },
  },
  ims: {
    id: "ims",
    nome: "ICU Mobility Scale (IMS)",
    sigla: "IMS",
    descricao: "Nível de mobilidade mais alto atingido na sessão (0–10).",
    min: 0,
    max: 10,
    melhorQuando: "maior",
    itens: [
      {
        id: "nivel",
        label: "Maior nível de mobilidade atingido",
        opcoes: opcoes(
          [0, "0 — Nada (deitado no leito)"],
          [1, "1 — Sentado no leito, exercícios no leito"],
          [2, "2 — Transferido passivamente para a poltrona"],
          [3, "3 — Sentado na beira do leito"],
          [4, "4 — Em pé"],
          [5, "5 — Transferência leito → poltrona"],
          [6, "6 — Marcha estacionária à beira do leito"],
          [7, "7 — Caminha com auxílio de 2 ou mais pessoas"],
          [8, "8 — Caminha com auxílio de 1 pessoa"],
          [9, "9 — Caminha independente com auxiliar de marcha"],
          [10, "10 — Caminha independente sem auxiliar de marcha"]
        ),
      },
    ],
    classificar: (s) => {
      if (s >= 9) return { label: "Marcha independente", tom: "recovery" };
      if (s >= 4) return { label: "Ortostatismo / marcha assistida", tom: "clinical" };
      if (s >= 1) return { label: "Mobilidade restrita ao leito/poltrona", tom: "attention" };
      return { label: "Sem mobilização", tom: "critical" };
    },
  },
  fss_icu: {
    id: "fss_icu",
    nome: "FSS-ICU (estado funcional na UTI)",
    sigla: "FSS-ICU",
    descricao: "5 tarefas, cada uma de 0 a 7 (total 0–35).",
    min: 0,
    max: 35,
    melhorQuando: "maior",
    itens: FSS_ITENS,
    // Sem pontos de corte validados universalmente: só apresenta o escore.
    classificar: (s) => ({ label: `${s}/35`, tom: "neutral" }),
  },
  borg: {
    id: "borg",
    nome: "Borg CR10 (dispneia / fadiga)",
    sigla: "Borg",
    descricao: "Percepção subjetiva de esforço ou falta de ar (0–10). Menor é melhor.",
    min: 0,
    max: 10,
    melhorQuando: "menor",
    itens: [
      {
        id: "percepcao",
        label: "Percepção do paciente",
        opcoes: opcoes(
          [0, "0 — Nenhuma"],
          [1, "1 — Muito leve"],
          [2, "2 — Leve"],
          [3, "3 — Moderada"],
          [4, "4 — Um pouco intensa"],
          [5, "5 — Intensa"],
          [6, "6"],
          [7, "7 — Muito intensa"],
          [8, "8"],
          [9, "9"],
          [10, "10 — Máxima"]
        ),
      },
    ],
    classificar: (s) => {
      if (s <= 2) return { label: "Leve", tom: "recovery" };
      if (s <= 4) return { label: "Moderada", tom: "attention" };
      return { label: "Intensa", tom: "critical" };
    },
  },
};

export const LISTA_ESCALAS: EscalaDef[] = Object.values(ESCALAS);

/** Todos os itens da escala foram respondidos com valor válido? */
export function itensCompletos(def: EscalaDef, itens: Record<string, number | undefined>): boolean {
  return def.itens.every((item) => {
    const v = itens[item.id];
    return v !== undefined && item.opcoes.some((o) => o.valor === v);
  });
}

/** Soma dos itens — `null` enquanto houver item sem resposta (nunca soma parcial). */
export function calcularScore(def: EscalaDef, itens: Record<string, number | undefined>): number | null {
  if (!itensCompletos(def, itens)) return null;
  return def.itens.reduce((acc, item) => acc + (itens[item.id] as number), 0);
}

/**
 * Variação "boa" entre duas medidas da mesma escala: positivo = melhorou.
 * Para escalas em que menor é melhor (Borg), a redução conta como ganho.
 */
export function ganhoEntre(def: EscalaDef, primeiro: number, ultimo: number): number {
  return def.melhorQuando === "maior" ? ultimo - primeiro : primeiro - ultimo;
}

/** Ganho como % da amplitude da escala — permite comparar escalas diferentes. */
export function ganhoNormalizado(def: EscalaDef, ganho: number): number {
  const amplitude = def.max - def.min;
  return amplitude === 0 ? 0 : (ganho / amplitude) * 100;
}

export interface AvaliacaoBasica {
  admission_id: string;
  escala: EscalaId;
  score: number;
  avaliado_em: string;
}

export interface GanhoInternacao {
  admission_id: string;
  escala: EscalaId;
  primeiro: number;
  ultimo: number;
  ganho: number;
  ganhoPercentual: number;
  avaliacoes: number;
}

/**
 * Ganho funcional por internação e escala: primeira vs. última avaliação
 * (por data). Só conta quem tem pelo menos 2 avaliações — com uma só não
 * há "ganho" a medir, e inventar um zero distorceria a média.
 */
export function ganhoPorInternacao(avaliacoes: AvaliacaoBasica[]): GanhoInternacao[] {
  const grupos = new Map<string, AvaliacaoBasica[]>();
  for (const a of avaliacoes) {
    const chave = `${a.admission_id}|${a.escala}`;
    const lista = grupos.get(chave);
    if (lista) lista.push(a);
    else grupos.set(chave, [a]);
  }
  const resultado: GanhoInternacao[] = [];
  for (const lista of grupos.values()) {
    if (lista.length < 2) continue;
    const ordenada = [...lista].sort((x, y) => x.avaliado_em.localeCompare(y.avaliado_em));
    const def = ESCALAS[ordenada[0].escala];
    const primeiro = ordenada[0].score;
    const ultimo = ordenada[ordenada.length - 1].score;
    const ganho = ganhoEntre(def, primeiro, ultimo);
    resultado.push({
      admission_id: ordenada[0].admission_id,
      escala: ordenada[0].escala,
      primeiro,
      ultimo,
      ganho,
      ganhoPercentual: ganhoNormalizado(def, ganho),
      avaliacoes: ordenada.length,
    });
  }
  return resultado;
}

export function mediaOuNull(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}
