// Regras puras do WhatsApp (Evolution): telefone, modelos com variáveis e
// estimativa de lote. Sem rede e sem React — testável isolado.

/** DDD + número → "55DDDNÚMERO". Devolve null se não for um celular/fixo brasileiro plausível. */
export function normalizarTelefone(bruto: string | null | undefined): string | null {
  const d = String(bruto ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return "55" + d;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d;
  return null;
}

/** "(18) 99999-0000" a partir de qualquer formato válido; devolve o original se não reconhecer. */
export function formatarTelefone(bruto: string | null | undefined): string {
  const n = normalizarTelefone(bruto);
  if (!n) return bruto ?? "";
  const local = n.slice(2);
  const ddd = local.slice(0, 2);
  const resto = local.slice(2);
  const corte = resto.length === 9 ? 5 : 4;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

export const VARIAVEIS_TEMPLATE = [
  { chave: "primeiro_nome", descricao: "Primeiro nome do paciente" },
  { chave: "nome", descricao: "Nome completo do paciente" },
  { chave: "empresa", descricao: "Nome da sua empresa" },
  { chave: "hospital", descricao: "Hospital da internação" },
  { chave: "data_alta", descricao: "Data da alta (dd/mm/aaaa)" },
  { chave: "link", descricao: "Link da pesquisa de satisfação" },
] as const;

export type VariaveisTemplate = Partial<Record<(typeof VARIAVEIS_TEMPLATE)[number]["chave"], string>>;

/** Troca {{variavel}} pelo valor. Variável sem valor fica visível ({{x}}) para o erro não passar despercebido. */
export function renderizarTemplate(corpo: string, valores: VariaveisTemplate): string {
  return corpo.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (inteiro, chave: string) => {
    const v = (valores as Record<string, string | undefined>)[chave.toLowerCase()];
    return v && v.trim() ? v : inteiro;
  });
}

/** Remove {{variavel}} que ficou sem valor, para nunca mandar "{{hospital}}" cru ao paciente. */
export function limparVariaveisPendentes(texto: string): string {
  return texto.replace(/\{\{\s*[a-z_]+\s*\}\}/gi, "").replace(/[ \t]{2,}/g, " ").replace(/\s+([,.!?])/g, "$1").trim();
}

/** Variáveis do modelo que continuam sem valor depois de preencher (ex.: {{link}} esquecido). */
export function variaveisPendentes(texto: string): string[] {
  return Array.from(new Set(Array.from(texto.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)).map((m) => m[1].toLowerCase())));
}

/** Estimativa honesta do tempo de um lote, usando o intervalo médio configurado entre mensagens. */
export function estimarDuracaoLote(total: number, delayMinS: number, delayMaxS: number): string {
  if (total <= 1) return "menos de 1 minuto";
  const medio = (delayMinS + delayMaxS) / 2;
  const segundos = (total - 1) * (medio + 2); // ~2 s de envio por mensagem
  const min = Math.ceil(segundos / 60);
  if (min < 60) return `cerca de ${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto ? `cerca de ${h} h ${resto} min` : `cerca de ${h} h`;
}

export const ROTULO_ESTADO_CONEXAO: Record<string, string> = {
  open: "Conectado",
  connecting: "Aguardando leitura do QR",
  close: "Desconectado",
  nao_criada: "Instância ainda não criada",
};

export function rotuloEstadoConexao(estado: string | null | undefined): string {
  if (!estado) return "Não verificado";
  return ROTULO_ESTADO_CONEXAO[estado] ?? estado;
}

export function primeiroNome(nomeCompleto: string | null | undefined): string {
  return (nomeCompleto ?? "").trim().split(/\s+/)[0] ?? "";
}
