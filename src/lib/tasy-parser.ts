/**
 * Parser do relatório "Produtividade Médica" exportado pelo Tasy.
 *
 * Dois formatos observados na prática, mesma estrutura de relatório:
 *
 *   Modelo 1 (.xls que na prática é texto simples separado por TAB):
 *   confirmado em arquivo real fornecido pelo cliente, testado em produção.
 *
 *   Modelo 2 (.csv separado por vírgula, formato de impressão):
 *   enviado pela Dra. Monika Trevisan — várias páginas impressas, cada
 *   uma repetindo cabeçalho/rodapé. Detalhe real observado: o Tasy dela
 *   exporta com os acentos corrompidos (ex.: "M?dica" no lugar de
 *   "Médica", "?" no lugar de qualquer vogal acentuada) — por isso todo
 *   marcador de texto é comparado de forma tolerante a acento (ver
 *   `normalizarMarcador`), nunca por igualdade exata.
 *
 * Layout (igual nos dois modelos, só muda o separador de coluna):
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
const REGEX_DATA_HORA = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/;

/**
 * Remove acento (á→a, é→e...) e deixa minúsculo — usado só pra comparar
 * marcadores SEM acento nenhum na versão corrompida (ex.: "Hospital",
 * "Impresso em"). Pra marcadores que TÊM letra acentuada (ex.: "Médica",
 * "Convênio"), usar as constantes RE_* abaixo — elas tratam "?" como
 * curinga de "qualquer caractere", porque simplesmente apagar o "?"
 * (como uma normalização ingênua faria) perde uma letra e nunca mais
 * bate com a palavra original ("M?dica" sem o "?" vira "Mdica", que
 * nunca é igual a "Medica").
 */
function normalizarMarcador(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// "." no lugar da letra acentuada — casa tanto a letra certa quanto um
// "?" de corrupção de acento, sem perder a contagem de caracteres.
const RE_PRODUTIVIDADE_MEDICA = /^produtividade\s*m.dica$/i;
const RE_FIM_DETALHE = /^procedimentos\s*por\s*conv.nio$/i;
const RE_IMPRESSO_EM = /^impresso\s*em/i;
const RE_DE_ATE = /^de:\s*\d{2}\/\d{2}\/\d{4}\s*at.\s*\d{2}\/\d{2}\/\d{4}/i;

/** Divide uma linha de CSV respeitando aspas — vírgula dentro de aspas não conta como separador. */
function dividirLinhaCsv(linha: string): string[] {
  const campos: string[] = [];
  let atual = "";
  let dentroDeAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      dentroDeAspas = !dentroDeAspas;
    } else if (c === "," && !dentroDeAspas) {
      campos.push(atual);
      atual = "";
    } else {
      atual += c;
    }
  }
  campos.push(atual);
  return campos;
}

export type ModeloArquivoTasy = "tab" | "csv";

/** Detecta automaticamente se o arquivo é TAB (Modelo 1) ou CSV (Modelo 2), pela primeira linha não-vazia. */
export function detectarModeloTasy(texto: string): ModeloArquivoTasy {
  const primeiraLinha = texto.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
  return primeiraLinha.includes("\t") ? "tab" : "csv";
}

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

function tokensNaoVazios(linhaBruta: string, modelo: ModeloArquivoTasy): string[] {
  const campos = modelo === "tab" ? linhaBruta.split("\t") : dividirLinhaCsv(linhaBruta);
  return campos.map((c) => c.trim()).filter((c) => c.length > 0);
}

function paraIso(dataHora: string): { iso: string; data: string } | null {
  const m = REGEX_DATA_HORA.exec(dataHora);
  if (!m) return null;
  const [, dia, mes, ano, hora, minuto] = m;
  const data = `${ano}-${mes}-${dia}`;
  const iso = `${ano}-${mes}-${dia}T${hora ?? "00"}:${minuto ?? "00"}:00`;
  return { iso, data };
}

export function parseTasyReport(texto: string, modelo?: ModeloArquivoTasy): TasyParseResult {
  const modeloEfetivo = modelo ?? detectarModeloTasy(texto);
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

    const tokens = tokensNaoVazios(linhasArquivo[i], modeloEfetivo);
    if (tokens.length === 0) continue;

    // Linha de dado: a primeira coluna é uma data válida. Normalmente 7
    // colunas — mas o export do Tasy às vezes tem vírgula SEM ASPAS
    // dentro da descrição do procedimento (confirmado em arquivo real),
    // o que quebra ela em colunas a mais. Sempre que sobrar coluna além
    // das 7 esperadas, junta tudo entre "código" e "quantidade" (a
    // última coluna) de volta numa descrição só.
    if (tokens.length >= 7 && REGEX_DATA_HORA.test(tokens[0]) && normalizarMarcador(tokens[0]) !== normalizarMarcador(COLUNAS_CABECALHO[0])) {
      const convertido = paraIso(tokens[0]);
      if (!convertido) {
        avisos.push(`Linha ${i + 1}: data "${tokens[0]}" não reconhecida, ignorada.`);
        continue;
      }
      if (!convenioAtual || !fisioAtual || !hospitalAtual) {
        avisos.push(`Linha ${i + 1}: dado encontrado antes de identificar hospital/fisioterapeuta/convênio — ignorada.`);
        continue;
      }
      const procedimentoNomeJunto = tokens.slice(5, tokens.length - 1).join(", ");
      if (tokens.length > 7) {
        avisos.push(`Linha ${i + 1}: descrição do procedimento tinha vírgula sem aspas no arquivo original — colunas rejuntadas automaticamente.`);
      }
      linhas.push({
        linha: i + 1,
        hospitalNome: hospitalAtual,
        fisioterapeutaNome: fisioAtual,
        convenioNome: convenioAtual,
        pacienteNome: tokens[2],
        referenciaExterna: tokens[1],
        procedimentoCodigo: tokens[4],
        procedimentoNome: procedimentoNomeJunto,
        grauParticipacao: tokens[3],
        quantidade: Number.parseInt(tokens[tokens.length - 1], 10) || 1,
        dataHoraISO: convertido.iso,
        dataProducao: convertido.data,
      });
      continue;
    }

    // Linha de cabeçalho de coluna — apenas confirma que dados seguem.
    if (tokens.length === 7 && normalizarMarcador(tokens[0]) === normalizarMarcador(COLUNAS_CABECALHO[0])) {
      continue;
    }

    // Rodapé de página — às vezes vem como 1 coluna só, às vezes o
    // Tasy separa "Impresso em: ...", "Página N" e o código do relatório
    // em colunas diferentes (confirmado em arquivo real). Detecta sempre
    // pela primeira coluna, não pela quantidade de colunas da linha.
    if (RE_IMPRESSO_EM.test(tokens[0].trim())) continue;

    // Daqui pra baixo, linhas de uma única célula (marcadores de seção).
    if (tokens.length !== 1) {
      avisos.push(`Linha ${i + 1}: formato inesperado (${tokens.length} colunas), ignorada: ${tokens.join(" | ").slice(0, 80)}`);
      continue;
    }

    const valor = tokens[0];
    const valorNormalizado = normalizarMarcador(valor);

    if (RE_FIM_DETALHE.test(valor.trim())) {
      leituraEncerrada = true;
      break;
    }
    if (RE_PRODUTIVIDADE_MEDICA.test(valor.trim())) continue;
    if (RE_DE_ATE.test(valor.trim())) {
      periodoTexto = valor.replace(/^De:\s*/i, "");
      continue;
    }
    if (/^total\(\d+\)$/.test(valorNormalizado)) continue;
    if (/^\d+$/.test(valor)) continue; // linha do total isolado, ex.: "46"

    if (valorNormalizado.startsWith("hospital ")) {
      hospitalAtual = valor.replace(/^hospital\s+/i, "").trim();
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
