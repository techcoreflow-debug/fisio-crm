/**
 * Parser do relatório "Produtividade Médica" exportado pelo Tasy.
 *
 * O arquivo tem extensão .xls mas na prática é texto simples separado por
 * TAB (confirmado em arquivo real fornecido pelo cliente) — não é um
 * binário Excel. Layout observado:
 *
 *   Produtividade Médica              ← título, repete a cada página impressa
 *   (linha em branco)
 *   De: dd/mm/aaaa até dd/mm/aaaa     ← período do relatório
 *   Hospital <nome>                   ← hospital, repete a cada página
 *   <NOME DO FISIOTERAPEUTA>          ← sempre a linha seguinte ao hospital
 *   <NOME DO CONVÊNIO>                ← marca o início de uma seção
 *   Data Procedimento | Nr. Atend. | Beneficiário | Grau Partic. | Código | Procedimento | Qtde.
 *   <linha de dado> ...
 *   Total(N)
 *   N
 *   <próximo convênio ou nova página>
 *   Impresso em: ... Página N ... C1010     ← rodapé de página, ignorado
 *   Procedimentos por Convênio               ← resumo final, para de ler aqui
 *
 * As colunas mudam de posição entre seções (às vezes há uma coluna A vazia
 * antes de "Data Procedimento", às vezes não) — por isso o parser ignora
 * células vazias e trabalha só com a SEQUÊNCIA de valores não-vazios de
 * cada linha, nunca índice fixo de coluna.
 */

const COLUNAS_CABECALHO = ["Data Procedimento", "Nr. Atend.", "Beneficiário", "Grau Partic.", "Código", "Procedimento", "Qtde."];
const MARCA_FIM_DETALHE = "Procedimentos por Convênio";
const REGEX_DATA_HORA = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/;

export interface TasyParsedRow {
  linha: number;
  hospitalNome: string;
  fisioterapeutaNome: string;
  convenioNome: string;
  pacienteNome: string;
  referenciaExterna: string; // Nr. Atend. — identifica a internação
  procedimentoCodigo: string;
  procedimentoNome: string;
  grauParticipacao: string;
  quantidade: number;
  dataHoraISO: string; // timestamp completo
  dataProducao: string; // YYYY-MM-DD, para daily_production.production_date
}

export interface TasyParseResult {
  linhas: TasyParsedRow[];
  avisos: string[];
  periodoTexto: string | null;
}

function tokensNaoVazios(linhaBruta: string): string[] {
  return linhaBruta.split("\t").map((c) => c.trim()).filter((c) => c.length > 0);
}

function paraIso(dataHora: string): { iso: string; data: string } | null {
  const m = REGEX_DATA_HORA.exec(dataHora);
  if (!m) return null;
  const [, dia, mes, ano, hora, minuto] = m;
  const data = `${ano}-${mes}-${dia}`;
  const iso = `${ano}-${mes}-${dia}T${hora ?? "00"}:${minuto ?? "00"}:00`;
  return { iso, data };
}

export function parseTasyReport(texto: string): TasyParseResult {
  const linhasArquivo = texto.split(/\r?\n/);
  const linhas: TasyParsedRow[] = [];
  const avisos: string[] = [];

  let hospitalAtual = "";
  let fisioAtual = "";
  let convenioAtual = "";
  let periodoTexto: string | null = null;
  let esperandoNomeFisio = false;
  let leituraEncerrada = false;

  for (let i = 0; i < linhasArquivo.length; i++) {
    if (leituraEncerrada) break;

    const tokens = tokensNaoVazios(linhasArquivo[i]);
    if (tokens.length === 0) continue;

    // Linha de dado: 7 colunas com a primeira sendo uma data válida.
    if (tokens.length === 7 && REGEX_DATA_HORA.test(tokens[0]) && tokens[0] !== COLUNAS_CABECALHO[0]) {
      const convertido = paraIso(tokens[0]);
      if (!convertido) {
        avisos.push(`Linha ${i + 1}: data "${tokens[0]}" não reconhecida, ignorada.`);
        continue;
      }
      if (!convenioAtual || !fisioAtual || !hospitalAtual) {
        avisos.push(`Linha ${i + 1}: dado encontrado antes de identificar hospital/fisioterapeuta/convênio — ignorada.`);
        continue;
      }
      linhas.push({
        linha: i + 1,
        hospitalNome: hospitalAtual,
        fisioterapeutaNome: fisioAtual,
        convenioNome: convenioAtual,
        pacienteNome: tokens[2],
        referenciaExterna: tokens[1],
        procedimentoCodigo: tokens[4],
        procedimentoNome: tokens[5],
        grauParticipacao: tokens[3],
        quantidade: Number.parseInt(tokens[6], 10) || 1,
        dataHoraISO: convertido.iso,
        dataProducao: convertido.data,
      });
      continue;
    }

    // Linha de cabeçalho de coluna — apenas confirma que dados seguem.
    if (tokens.length === 7 && tokens[0] === COLUNAS_CABECALHO[0]) {
      continue;
    }

    // Daqui pra baixo, linhas de uma única célula (marcadores de seção).
    if (tokens.length !== 1) {
      avisos.push(`Linha ${i + 1}: formato inesperado (${tokens.length} colunas), ignorada: ${tokens.join(" | ").slice(0, 80)}`);
      continue;
    }

    const valor = tokens[0];

    if (valor === MARCA_FIM_DETALHE) {
      leituraEncerrada = true;
      break;
    }
    if (valor === "Produtividade Médica") continue;
    if (valor.startsWith("De:") && valor.includes("até")) {
      periodoTexto = valor.replace(/^De:\s*/, "");
      continue;
    }
    if (valor.startsWith("Impresso em")) continue;
    if (/^Total\(\d+\)$/.test(valor)) continue;
    if (/^\d+$/.test(valor)) continue; // linha do total isolado, ex.: "46"

    if (valor.startsWith("Hospital ")) {
      hospitalAtual = valor.replace(/^Hospital\s+/, "").trim();
      esperandoNomeFisio = true;
      continue;
    }

    if (esperandoNomeFisio) {
      fisioAtual = valor;
      esperandoNomeFisio = false;
      continue;
    }

    // Não é nenhum dos marcadores conhecidos → é o nome do convênio.
    convenioAtual = valor;
  }

  return { linhas, avisos, periodoTexto };
}

/** Resumo agregado — usado na tela de prévia antes de confirmar a importação. */
export interface TasyImportSummary {
  totalLinhas: number;
  hospitais: Set<string>;
  convenios: Set<string>;
  fisioterapeutas: Set<string>;
  pacientes: Set<string>;
  procedimentos: Set<string>;
  internacoes: Set<string>;
  /** Mesmo código de procedimento com descrições diferentes no arquivo —
   *  usamos a primeira descrição encontrada como nome canônico; o resto
   *  fica só registrado no raw_data da linha, nunca escondido. */
  codigosComDescricaoDivergente: Map<string, string[]>;
}

export function resumirImportacao(linhas: TasyParsedRow[]): TasyImportSummary {
  const procedimentoNomesPorCodigo = new Map<string, Set<string>>();
  for (const l of linhas) {
    const atual = procedimentoNomesPorCodigo.get(l.procedimentoCodigo) ?? new Set<string>();
    atual.add(l.procedimentoNome);
    procedimentoNomesPorCodigo.set(l.procedimentoCodigo, atual);
  }
  const codigosComDescricaoDivergente = new Map<string, string[]>();
  for (const [codigo, nomes] of procedimentoNomesPorCodigo) {
    if (nomes.size > 1) codigosComDescricaoDivergente.set(codigo, [...nomes]);
  }

  return {
    totalLinhas: linhas.length,
    hospitais: new Set(linhas.map((l) => l.hospitalNome)),
    convenios: new Set(linhas.map((l) => l.convenioNome)),
    fisioterapeutas: new Set(linhas.map((l) => l.fisioterapeutaNome)),
    pacientes: new Set(linhas.map((l) => l.pacienteNome)),
    procedimentos: new Set(linhas.map((l) => `${l.procedimentoCodigo} ${l.procedimentoNome}`)),
    internacoes: new Set(linhas.map((l) => l.referenciaExterna)),
    codigosComDescricaoDivergente,
  };
}
