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
    let timeoutDebounce: ReturnType<typeof setTimeout> | null = null;

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

    // Operações em massa (ex.: conciliação Tasy) disparam um evento de
    // Realtime POR LINHA — sem isso, uma importação de milhares de linhas
    // dispararia milhares de buscas simultâneas e sobrecarregaria o
    // navegador ("Failed to fetch"). Junta tudo que chegar num intervalo
    // curto numa única busca, feita só quando as mudanças pararem.
    function agendarRecarga() {
      if (timeoutDebounce) clearTimeout(timeoutDebounce);
      timeoutDebounce = setTimeout(carregar, 400);
    }

    carregar();

    const canal = supabase
      .channel(`${table}:${chaveFiltro}:${idDoCanalRef.current}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, agendarRecarga)
      .subscribe();

    // Rede de segurança — o Realtime pode cair silenciosamente (comum em
    // wifi de hospital) e nunca mais reconectar sozinho, sem avisar
    // ninguém: a tela fica com dado desatualizado, achando que está tudo
    // certo. Já causou lançamento sumindo de tela (não do banco — só da
    // exibição). Duas redes independentes do Realtime:
    //   1) recarrega ao voltar o foco da aba (ex.: trocou de aplicativo e voltou)
    //   2) recarrega a cada 2 minutos, mesmo sem trocar de aba
    function recarregarAoFocar() {
      if (document.visibilityState === "visible") carregar();
    }
    document.addEventListener("visibilitychange", recarregarAoFocar);
    window.addEventListener("focus", recarregarAoFocar);
    // 3) recarrega na hora, sob demanda — qualquer botão "Atualizar agora"
    // do app dispara esse evento global, e toda tela aberta recarrega.
    window.addEventListener("fisio:forcar-recarga", carregar);
    const intervalo = setInterval(carregar, 120_000);

    return () => {
      ativo = false;
      if (timeoutDebounce) clearTimeout(timeoutDebounce);
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
