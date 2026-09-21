import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { notificarErro } from "@/store/toast-store";
import type { Database } from "@/types/database";

type TableName = keyof Database["public"]["Tables"];

let proximoIdDeCanal = 0;

/**
 * Hook genérico: busca uma tabela filtrada e mantém em sincronia via
 * Supabase Realtime. Toda a camada de repositório é construída em cima
 * disso — um único lugar para acertar (paginação futura, cache, etc.)
 * em vez de 20 implementações repetidas.
 *
 * Reconsulta por completo a cada evento realtime da tabela (insert/update/
 * delete de qualquer linha) em vez de tentar mesclar o payload manualmente.
 * Simples e correto; o volume de dados de uma empresa não justifica a
 * complexidade de um merge incremental ainda.
 *
 * Importante: o nome do canal precisa ser único por INSTÂNCIA do hook, não
 * só por tabela+filtro. Várias telas chamam `useCompanies()` ao mesmo tempo
 * (Sidebar, Topbar, Empresas...) — se todas usassem o mesmo nome de canal,
 * o cliente do Supabase reaproveita o canal já inscrito e a segunda
 * chamada de `.on(...)` depois do `.subscribe()` derruba a aplicação
 * inteira (erro não capturado, tela em branco).
 */
/**
 * Filtro simples de coluna=valor, no formato que o Realtime do Supabase
 * aceita (só suporta UMA condição de igualdade, não várias combinadas).
 * Como quase toda tabela filtra só por company_id, isso já cobre o caso
 * comum — reduz o volume de eventos que chegam pelo canal (não só de
 * buscas feitas), já que o servidor só manda o que interessa.
 */
function construirFiltroRealtime(filtros: Record<string, string | null | undefined>): string | undefined {
  const entradas = Object.entries(filtros).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (entradas.length !== 1) return undefined;
  const [campo, valor] = entradas[0];
  return `${campo}=eq.${valor}`;
}

export function useSupabaseCollection<T>(
  table: TableName,
  filtros: Record<string, string | null | undefined>,
  ordenarPor?: string,
  ordemDecrescente = false
): T[] {
  const [linhas, setLinhas] = useState<T[]>([]);
  const chaveFiltro = JSON.stringify(filtros);
  const filtroIncompleto = Object.values(filtros).some((v) => v === undefined || v === "");
  const idDoCanalRef = useRef<number | null>(null);
  if (idDoCanalRef.current === null) {
    idDoCanalRef.current = proximoIdDeCanal++;
  }

  useEffect(() => {
    if (filtroIncompleto) {
      setLinhas([]);
      return;
    }

    let ativo = true;

    function ordenarLista(lista: T[]): T[] {
      if (!ordenarPor) return lista;
      const copia = [...lista];
      copia.sort((a, b) => {
        const va = (a as Record<string, unknown>)[ordenarPor];
        const vb = (b as Record<string, unknown>)[ordenarPor];
        if (va === vb) return 0;
        if (va === null || va === undefined) return 1;
        if (vb === null || vb === undefined) return -1;
        const cmp = va < vb ? -1 : 1;
        return ordemDecrescente ? -cmp : cmp;
      });
      return copia;
    }

    async function carregar() {
      let query = supabase.from(table).select("*");
      for (const [campo, valor] of Object.entries(filtros)) {
        if (valor === null) {
          query = query.is(campo, null);
        } else if (valor !== undefined) {
          query = query.eq(campo, valor);
        }
      }
      if (ordenarPor) {
        query = query.order(ordenarPor, { ascending: !ordemDecrescente });
      }
      const { data, error } = await query;
      if (!ativo) return;
      if (error) {
        notificarErro(`Não foi possível carregar os dados (${table})`, error.message);
        return;
      }
      setLinhas((data ?? []) as T[]);
    }

    // Aplica o payload do evento Realtime direto no estado local, sem
    // buscar a tabela de novo — é a diferença entre transferir 1 linha
    // ou a tabela inteira (já passou de 1.500 linhas em daily_production)
    // toda vez que QUALQUER pessoa lança QUALQUER procedimento em
    // QUALQUER lugar. Isso sozinho já foi o maior consumo de egress do
    // projeto. O filtro do canal (`construirFiltroRealtime`) já garante
    // que só chegam eventos da própria empresa quando o filtro é simples
    // (company_id, o caso mais comum); pra filtros compostos, confere de
    // novo aqui antes de aplicar, pra nunca misturar dado de fora do
    // filtro atual.
    function linhaPertenceAoFiltro(linha: Record<string, unknown>): boolean {
      return Object.entries(filtros).every(([campo, valor]) => {
        if (valor === undefined) return true;
        return linha[campo] === valor;
      });
    }

    function aplicarEvento(payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) {
      if (!ativo) return;
      setLinhas((atual) => {
        if (payload.eventType === "DELETE") {
          const idRemovido = payload.old?.id;
          if (idRemovido === undefined) return atual;
          return atual.filter((l) => (l as Record<string, unknown>).id !== idRemovido) as T[];
        }

        const linhaNova = payload.new as Record<string, unknown>;
        if (!linhaNova || linhaNova.id === undefined) return atual;

        // Update pode ter tirado a linha do filtro atual (ex.: mudou de
        // empresa) — se não pertence mais, remove; senão insere/atualiza.
        if (!linhaPertenceAoFiltro(linhaNova)) {
          return atual.filter((l) => (l as Record<string, unknown>).id !== linhaNova.id) as T[];
        }

        const jaExiste = atual.some((l) => (l as Record<string, unknown>).id === linhaNova.id);
        const proxima = jaExiste
          ? atual.map((l) => ((l as Record<string, unknown>).id === linhaNova.id ? (linhaNova as T) : l))
          : [...atual, linhaNova as T];
        return ordenarLista(proxima);
      });
    }

    // Importações em massa (ex.: conciliação Tasy) disparam um evento de
    // Realtime POR LINHA em rajada — aplicar cada um na hora, um a um,
    // dispara centenas de re-renderizações seguidas e pode travar a tela
    // por alguns segundos. Junta o que chegar num intervalo curto numa
    // única atualização de estado — continua sem buscar nada do banco de
    // novo (o ganho de egress continua intacto), só agrupa a aplicação.
    let eventosPendentes: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }[] = [];
    let timeoutLote: ReturnType<typeof setTimeout> | null = null;
    function agendarEvento(payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) {
      eventosPendentes.push(payload);
      if (timeoutLote) clearTimeout(timeoutLote);
      timeoutLote = setTimeout(() => {
        const lote = eventosPendentes;
        eventosPendentes = [];
        for (const evento of lote) aplicarEvento(evento);
      }, 120);
    }

    carregar();

    const filtroRealtime = construirFiltroRealtime(filtros);
    const canal = supabase
      .channel(`${table}:${chaveFiltro}:${idDoCanalRef.current}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, ...(filtroRealtime ? { filter: filtroRealtime } : {}) },
        agendarEvento
      )
      .subscribe();

    // Rede de segurança — o Realtime pode cair silenciosamente (comum em
    // wifi de hospital) e nunca mais reconectar sozinho, sem avisar
    // ninguém: a tela fica com dado desatualizado, achando que está tudo
    // certo. Já causou lançamento sumindo de tela (não do banco — só da
    // exibição). Três redes independentes do Realtime — agora bem mais
    // espaçadas, já que o Realtime normal não depende mais delas pra
    // pegar mudanças do dia a dia (só recuperar de uma queda de verdade):
    //   1) recarrega ao voltar o foco da aba
    //   2) recarrega a cada 5 minutos, mesmo sem trocar de aba
    //   3) recarrega na hora, sob demanda (botão "Atualizar agora" em
    //      qualquer tela dispara esse evento global)
    function recarregarAoFocar() {
      if (document.visibilityState === "visible") carregar();
    }
    document.addEventListener("visibilitychange", recarregarAoFocar);
    window.addEventListener("focus", recarregarAoFocar);
    window.addEventListener("fisio:forcar-recarga", carregar);
    const intervalo = setInterval(carregar, 300_000);

    return () => {
      ativo = false;
      if (timeoutLote) clearTimeout(timeoutLote);
      document.removeEventListener("visibilitychange", recarregarAoFocar);
      window.removeEventListener("focus", recarregarAoFocar);
      window.removeEventListener("fisio:forcar-recarga", carregar);
      clearInterval(intervalo);
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, chaveFiltro, filtroIncompleto, ordenarPor, ordemDecrescente]);

  return linhas;
}

/** Cria uma linha e devolve o registro criado (com id/created_at gerados pelo banco). */
export async function inserirLinha<T>(table: TableName, valores: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.from(table).insert(valores).select().single();
  if (error) throw new Error(error.message);
  return data as T;
}

export async function atualizarLinha(table: TableName, id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from(table).update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function excluirLinha(table: TableName, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Apaga TODAS as linhas de `table` pertencentes a `companyId` — usado só
 * pela limpeza de base (zona de risco). Devolve quantas linhas existiam
 * antes de apagar, pra dar feedback real de quantidade.
 */
export async function excluirLinhaPorEmpresa(table: TableName, companyId: string): Promise<number> {
  const { count, error: errorContar } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);
  if (errorContar) throw new Error(`Falha ao contar ${table}: ${errorContar.message}`);
  const total = count ?? 0;
  if (total === 0) return 0;
  const { error } = await supabase.from(table).delete().eq("company_id", companyId);
  if (error) throw new Error(`Falha ao apagar ${table}: ${error.message}`);
  return total;
}

/**
 * Conta quantas linhas de `table` referenciam `id` em `coluna` — usado
 * pelos guards de exclusão (bloquear "excluir hospital com alas
 * vinculadas" etc.) antes de mandar o delete pro Postgres.
 */
export async function contarDependentes(table: TableName, coluna: string, id: string): Promise<number> {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true }).eq(coluna, id);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Apaga todas as linhas de `table` onde `coluna = valor` — usado pra
 * exclusão "forçada" (cascata manual), quando um admin decide apagar um
 * registro mesmo com dependentes. Ao contrário de `excluirLinhaPorEmpresa`,
 * a coluna pode ser qualquer FK, não só company_id.
 */
export async function excluirLinhaPorColuna(table: TableName, coluna: string, valor: string): Promise<number> {
  const { count, error: errorContar } = await supabase.from(table).select("id", { count: "exact", head: true }).eq(coluna, valor);
  if (errorContar) throw new Error(`Falha ao contar ${table}: ${errorContar.message}`);
  const { error } = await supabase.from(table).delete().eq(coluna, valor);
  if (error) throw new Error(`Falha ao apagar ${table}: ${error.message}`);
  return count ?? 0;
}

export async function registrarAuditoria(data: {
  company_id: string;
  action: "criado" | "editado" | "excluido" | "alta" | "importado" | "desfeito" | "transferencia" | "retorno_transferencia";
  entity_type: string;
  entity_label: string;
}): Promise<void> {
  const { error } = await supabase.from("activity_log").insert(data);
  // Auditoria nunca deve travar a operação principal — se falhar, avisa
  // no console mas não interrompe o fluxo do usuário.
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[Fisio] Falha ao registrar auditoria:", error.message);
  }
}

export function emLotes<T>(itens: T[], tamanho: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) lotes.push(itens.slice(i, i + tamanho));
  return lotes;
}

/**
 * "Busca ou cria" em lote — usado pela importação Tasy pra resolver
 * hospitais/convênios/fisioterapeutas/pacientes/procedimentos a partir só
 * do nome (ou código), sem duplicar e sem uma consulta por linha.
 *
 * 1. Busca quem já existe (por company_id + campoChave, em lotes de 200
 *    valores por `.in()` pra não estourar o limite de tamanho da URL).
 * 2. Cria em lote só quem falta.
 * 3. Devolve um mapa valor → id.
 */
export async function buscarOuCriarEmLote(
  table: TableName,
  campoChave: string,
  valores: string[],
  dadosExtras: (valor: string) => Record<string, unknown>
): Promise<Map<string, string>> {
  const distintos = [...new Set(valores)].filter((v) => v && v.trim().length > 0);
  const mapa = new Map<string, string>();
  if (distintos.length === 0) return mapa;

  for (const lote of emLotes(distintos, 200)) {
    const { data, error } = await supabase.from(table).select(`id, ${campoChave}`).in(campoChave, lote);
    if (error) throw new Error(`Falha ao buscar ${table}: ${error.message}`);
    for (const linha of (data ?? []) as unknown as Record<string, unknown>[]) {
      mapa.set(String(linha[campoChave]), String(linha.id));
    }
  }

  const faltantes = distintos.filter((v) => !mapa.has(v));
  if (faltantes.length > 0) {
    for (const lote of emLotes(faltantes, 200)) {
      const paraCriar = lote.map((valor) => ({ [campoChave]: valor, ...dadosExtras(valor) }));
      const { data, error } = await supabase.from(table).insert(paraCriar).select(`id, ${campoChave}`);
      if (error) throw new Error(`Falha ao criar registros em ${table}: ${error.message}`);
      for (const linha of (data ?? []) as unknown as Record<string, unknown>[]) {
        mapa.set(String(linha[campoChave]), String(linha.id));
      }
    }
  }

  return mapa;
}
