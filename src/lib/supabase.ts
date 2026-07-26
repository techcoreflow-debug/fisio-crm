import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * true só quando as duas variáveis existem E a URL é válida. Usado pelo
 * App para decidir entre renderizar o app normalmente ou uma tela de erro
 * clara — nunca deixamos a tela ficar em branco sem explicação.
 */
export let isSupabaseConfigured = false;

function criarCliente() {
  if (!supabaseUrl || !supabaseAnonKey) {
    // eslint-disable-next-line no-console
    console.error(
      "[Fisio] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY não configuradas neste build. " +
        "Em produção (Cloudflare Pages), configure em Settings → Environment variables e refaça o deploy — " +
        "variáveis do Vite são embutidas no build, adicionar depois não tem efeito sem rebuildar."
    );
    return createClient<Database>("https://placeholder.supabase.co", "placeholder-key");
  }

  try {
    const client = createClient<Database>(supabaseUrl, supabaseAnonKey);
    isSupabaseConfigured = true;
    return client;
  } catch (erro) {
    // eslint-disable-next-line no-console
    console.error("[Fisio] VITE_SUPABASE_URL inválida:", supabaseUrl, erro);
    return createClient<Database>("https://placeholder.supabase.co", "placeholder-key");
  }
}

export const supabase = criarCliente();
