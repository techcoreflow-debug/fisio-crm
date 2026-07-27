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
export function useSupabaseCollection<T>(table: TableName, filtros: Record<string, string | null | undefined>): T[] {
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

    async function carregar() {
      let query = supabase.from(table).select("*");
      for (const [campo, valor] of Object.entries(filtros)) {
        if (valor === null) {
          query = query.is(campo, null);
        } else if (valor !== undefined) {
          query = query.eq(campo, valor);
        }
      }
      const { data, error } = await query;
      if (!ativo) return;
      if (error) {
        notificarErro(`Não foi possível carregar os dados (${table})`, error.message);
        return;
      }
      setLinhas((data ?? []) as T[]);
    }

    carregar();

    const canal = supabase
      .channel(`${table}:${chaveFiltro}:${idDoCanalRef.current}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => carregar())
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, chaveFiltro, filtroIncompleto]);

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
 * Conta quantas linhas de `table` referenciam `id` em `coluna` — usado
 * pelos guards de exclusão (bloquear "excluir hospital com alas
 * vinculadas" etc.) antes de mandar o delete pro Postgres.
 */
export async function contarDependentes(table: TableName, coluna: string, id: string): Promise<number> {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true }).eq(coluna, id);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function registrarAuditoria(data: {
  company_id: string;
  action: "criado" | "editado" | "excluido" | "alta" | "importado" | "desfeito";
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
