import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy, type ComponentType } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { allModules, SLUGS_LANCADOR, ROTA_PADRAO_LANCADOR } from "@/app/modules-registry";
import { AuthProvider, useAuth } from "@/auth/auth-provider";
import Login from "@/modules/auth/login";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/supabase";

// Cada módulo vira um chunk próprio, carregado sob demanda ao navegar até
// ele — evita que o usuário baixe os 25 módulos do Fisio de uma vez só.
const pageComponents: Record<string, ComponentType> = {
  "dashboard-executivo": lazy(() => import("@/modules/dashboard-executivo")),
  "dashboard-operacional": lazy(() => import("@/modules/dashboard-operacional")),
  "dashboard-financeiro": lazy(() => import("@/modules/dashboard-financeiro")),
  empresas: lazy(() => import("@/modules/empresas")),
  hospitais: lazy(() => import("@/modules/hospitais")),
  clinicas: lazy(() => import("@/modules/clinicas")),
  unidades: lazy(() => import("@/modules/unidades")),
  quartos: lazy(() => import("@/modules/quartos")),
  convenios: lazy(() => import("@/modules/convenios")),
  contratos: lazy(() => import("@/modules/contratos")),
  "centros-de-custo": lazy(() => import("@/modules/centros-de-custo")),
  equipes: lazy(() => import("@/modules/equipes")),
  pacientes: lazy(() => import("@/modules/pacientes")),
  internacoes: lazy(() => import("@/modules/internacoes")),
  leitos: lazy(() => import("@/modules/leitos")),
  escalas: lazy(() => import("@/modules/escalas")),
  fisioterapeutas: lazy(() => import("@/modules/fisioterapeutas")),
  procedimentos: lazy(() => import("@/modules/procedimentos")),
  "producao-diaria": lazy(() => import("@/modules/producao-diaria")),
  "painel-procedimentos": lazy(() => import("@/modules/painel-producao")),
  "novo-atendimento": lazy(() => import("@/modules/novo-atendimento")),
  "evolucao-clinica": lazy(() => import("@/modules/evolucao-clinica")),
  financeiro: lazy(() => import("@/modules/financeiro")),
  auditoria: lazy(() => import("@/modules/auditoria")),
  relatorios: lazy(() => import("@/modules/relatorios")),
  bi: lazy(() => import("@/modules/bi")),
  configuracoes: lazy(() => import("@/modules/configuracoes")),
  "usuarios-permissoes": lazy(() => import("@/modules/usuarios-permissoes")),
  integracoes: lazy(() => import("@/modules/integracoes")),
  "importacao-tasy": lazy(() => import("@/modules/importacao-tasy")),
};

function PageFallback() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-7 w-52 animate-pulse rounded-md bg-surface-sunken" />
      <div className="h-40 w-full animate-pulse rounded-lg bg-surface-sunken" />
      <div className="h-40 w-full animate-pulse rounded-lg bg-surface-sunken" />
    </div>
  );
}

function TelaCarregando() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <Loader2 className="h-6 w-6 animate-spin text-ink-soft" />
    </div>
  );
}

function AuthGate() {
  const { session, profile, loading, profileLoading, refreshProfile, signOut } = useAuth();

  if (loading) return <TelaCarregando />;
  if (!session) return <Login />;
  if (profileLoading) return <TelaCarregando />;

  if (!profile) {
    // Sessão criada, mas o perfil ainda não apareceu (corrida rara logo
    // após o cadastro, ou confirmação de e-mail pendente com o gatilho
    // ainda não processado). Nunca falha silenciosamente: dá a ação certa.
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface px-4 text-center">
        <p className="font-display font-semibold text-ink">Preparando seu acesso…</p>
        <p className="max-w-sm text-sm text-ink-soft">
          Se você acabou de criar a conta, confirme o e-mail primeiro. Se já confirmou, tente atualizar.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => refreshProfile()}>Atualizar</Button>
          <Button variant="ghost" size="sm" onClick={() => signOut()}>Sair</Button>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          {allModules.map((mod) => {
            const Component = pageComponents[mod.slug];
            const ehLancador = profile.role === "fisioterapeuta" && !profile.is_platform_admin;
            const bloqueado = ehLancador && !SLUGS_LANCADOR.includes(mod.slug);
            return (
              <Route
                key={mod.slug}
                path={mod.path}
                element={
                  bloqueado ? (
                    <Navigate to={ROTA_PADRAO_LANCADOR} replace />
                  ) : (
                    <Suspense fallback={<PageFallback />}>
                      <Component />
                    </Suspense>
                  )
                }
              />
            );
          })}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function TelaConfiguracaoAusente() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-surface px-4 text-center">
      <AlertTriangle className="h-8 w-8 text-critical-400" />
      <p className="font-display font-semibold text-ink">Supabase não configurado neste build</p>
      <p className="max-w-md text-sm text-ink-soft">
        Faltam <code className="rounded bg-surface-sunken px-1 py-0.5">VITE_SUPABASE_URL</code> e/ou{" "}
        <code className="rounded bg-surface-sunken px-1 py-0.5">VITE_SUPABASE_ANON_KEY</code>. Configure essas
        variáveis no provedor de deploy e refaça o build — variáveis do Vite são embutidas em tempo de build.
      </p>
    </div>
  );
}

export default function App() {
  if (!isSupabaseConfigured) return <TelaConfiguracaoAusente />;

  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
