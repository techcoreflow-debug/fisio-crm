import { supabase } from "@/lib/supabase";

/**
 * Chama uma Edge Function autenticada e sempre lança um erro com
 * mensagem CLARA — nunca o "Failed to send a request to the Edge
 * Function" genérico do SDK, que não diz nada útil pra quem está usando
 * o app. O SDK do Supabase joga erros bem diferentes dependendo de ONDE
 * a falha aconteceu:
 *   - a função respondeu, mas com erro (ex.: 403, 500) → dá pra ler o
 *     corpo da resposta e pegar a mensagem de verdade que a função quis
 *     mandar.
 *   - a requisição nem chegou na função (não publicada, CORS, rede) →
 *     não tem corpo nenhum pra ler; nesse caso, explica o motivo mais
 *     provável em vez de repetir o texto técnico do SDK.
 */
export async function chamarEdgeFunction<T = unknown>(nome: string, body: Record<string, unknown>): Promise<T> {
  const { data: sessao } = await supabase.auth.getSession();
  const { data, error } = await supabase.functions.invoke(nome, {
    body,
    headers: { Authorization: `Bearer ${sessao.session?.access_token ?? ""}` },
  });

  if (error) {
    // FunctionsHttpError: a função respondeu (com um status de erro) —
    // o corpo da resposta tem a mensagem de verdade.
    if (error.context) {
      try {
        const corpo = await error.context.json();
        if (corpo?.error) throw new Error(corpo.error);
      } catch (erroLeitura) {
        if (erroLeitura instanceof Error && erroLeitura.message !== error.message) throw erroLeitura;
        // corpo não veio em JSON — cai pro fallback genérico abaixo
      }
    }
    // Sem corpo de resposta pra ler = a requisição nem chegou na função.
    throw new Error(
      `Não foi possível conectar à função "${nome}" no Supabase. Confirma se ela está publicada ` +
        `(Edge Functions → ${nome} → Deploy) e se a internet está OK. (${error.message})`
    );
  }

  if (data?.error) throw new Error(data.error);
  return data as T;
}
