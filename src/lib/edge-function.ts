import { supabase } from "@/lib/supabase";

/**
 * Chama uma Edge Function autenticada e sempre lança um erro com
 * mensagem CLARA — nunca o "Failed to send a request to the Edge
 * Function" genérico do SDK, que não diz nada útil pra quem está usando
 * o app.
 */
export async function chamarEdgeFunction<T = unknown>(nome: string, body: Record<string, unknown>): Promise<T> {
  const { data: sessao } = await supabase.auth.getSession();
  const { data, error } = await supabase.functions.invoke(nome, {
    body,
    headers: { Authorization: `Bearer ${sessao.session?.access_token ?? ""}` },
  });

  if (error) {
    if (error.context) {
      try {
        const corpo = await error.context.json();
        if (corpo?.error) throw new Error(corpo.error);
      } catch (erroLeitura) {
        if (erroLeitura instanceof Error && erroLeitura.message !== error.message) throw erroLeitura;
      }
    }
    throw new Error(
      `Não foi possível conectar à função "${nome}" no Supabase. Confirma se ela está publicada ` +
        `(Edge Functions → ${nome} → Deploy) e se a internet está OK. (${error.message})`
    );
  }

  if (data?.error) throw new Error(data.error);
  return data as T;
}
