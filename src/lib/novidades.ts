/**
 * Novidades pro sino de notificações — linguagem de usuário final, bem
 * mais curta e direta que o CHANGELOG.md (que é técnico, pra mim e pra
 * quem desenvolve). Adicionar uma entrada aqui a cada entrega com algo
 * que vale a pena avisar pra quem usa o sistema no dia a dia.
 *
 * `versao` é só um identificador (não precisa bater com APP_VERSION
 * exatamente) — o sino compara com a última versão que a pessoa já viu,
 * salva no navegador dela.
 */
export interface Novidade {
  versao: string;
  data: string; // DD/MM/AAAA
  titulo: string;
  descricao: string;
}

export const NOVIDADES: Novidade[] = [
  {
    versao: "0.40.0",
    data: "14/08/2026",
    titulo: "Transferência de internação",
    descricao:
      "Paciente foi pra UTI (de outra empresa) e vai voltar? Use \"Transferir\" em vez de dar alta — quando ele voltar, \"Retornou\" reabre a mesma internação, com o mesmo Nr. Atendimento e histórico.",
  },
  {
    versao: "0.40.0",
    data: "14/08/2026",
    titulo: "Idade e Dias de Internação",
    descricao: "Agora aparecem na listagem de Pacientes Internados e nas exportações de Produção Diária e Relatórios.",
  },
  {
    versao: "0.39.2",
    data: "11/08/2026",
    titulo: "Fisioterapeuta já consegue editar internação",
    descricao: "Corrigido o bug que impedia o fisioterapeuta lançador de editar (trocar quarto, por exemplo) uma internação já criada.",
  },
  {
    versao: "0.39.2",
    data: "11/08/2026",
    titulo: "Cobertura sobre o total do hospital",
    descricao: "Novo indicador em Impacto Assistencial: \"% dos internados do hospital que têm fisioterapia\" — lança o total geral do hospital no próprio painel.",
  },
  {
    versao: "0.38.0",
    data: "10/08/2026",
    titulo: "Mais indicadores em Impacto Assistencial",
    descricao: "Efetividade Motora × Respiratória mensal, altas (diário/mensal), distribuição por convênio e perfil por sexo.",
  },
  {
    versao: "0.36.0",
    data: "08/08/2026",
    titulo: "Pré-lançamento com 2 procedimentos",
    descricao: "O código sugerido na triagem agora pede Motora e Respiratória juntos — reduz erro de codificação na hora de lançar de verdade.",
  },
  {
    versao: "0.34.0",
    data: "08/08/2026",
    titulo: "Novo papel: Supervisor",
    descricao: "Mesmo acesso do fisioterapeuta lançador, mais visão e controle dos painéis operacionais — sem acesso a faturamento.",
  },
];

export function ultimaVersaoDeNovidade(): string {
  return NOVIDADES[0]?.versao ?? "";
}
