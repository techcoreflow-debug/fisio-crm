import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { notificarErro } from "@/store/toast-store";
import type { Profile } from "@/types/domain";

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  /** true enquanto existe sessão mas o perfil ainda não carregou/foi criado pelo gatilho */
  profileLoading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  async function loadProfile(userId: string, primeiraVez: boolean) {
    // Só mostra a tela cheia de carregamento na PRIMEIRA vez que buscamos o
    // perfil desta sessão. Depois disso, qualquer recarregamento (ex.:
    // refresh automático de token do Supabase ao voltar de ALT+TAB) busca
    // em segundo plano, sem desmontar a tela — é exatamente isso que fazia
    // formulários abertos e digitação perdida some sozinhos ao trocar de
    // janela e voltar.
    if (primeiraVez) setProfileLoading(true);
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) {
      // Nunca falha em silêncio: se travar aqui de novo, o toast vai dizer
      // exatamente por quê (RLS, permissão, rede) em vez de só ficar preso
      // na tela de "preparando acesso".
      notificarErro("Não foi possível carregar seu perfil", error.message);
      if (primeiraVez) setProfile(null);
    } else if (data) {
      setProfile(data as Profile);
    } else if (primeiraVez) {
      // Sessão existe mas não há linha em profiles para este usuário —
      // normalmente o gatilho de cadastro cuida disso; se aparecer, é
      // sinal de que o perfil precisa ser criado manualmente.
      setProfile(null);
    }
    if (primeiraVez) setProfileLoading(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadProfile(data.session.user.id, true);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (!newSession) {
        setProfile(null);
        return;
      }
      // TOKEN_REFRESHED dispara sozinho ao voltar o foco da aba — o perfil
      // não muda nesse evento, então não precisa (e não deve) recarregar
      // como se fosse um novo login.
      if (event === "TOKEN_REFRESHED") return;
      loadProfile(newSession.user.id, event === "SIGNED_IN" || event === "INITIAL_SESSION");
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signInWithPassword(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string, fullName: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function refreshProfile() {
    if (session) await loadProfile(session.user.id, true);
  }

  return (
    <AuthContext.Provider
      value={{ session, profile, loading, profileLoading, signInWithPassword, signUp, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
