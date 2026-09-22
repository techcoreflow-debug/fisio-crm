import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy, useEffect, useState, type ComponentType } from "react";
import { Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { allModules, ROTA_PADRAO_LANCADOR } from "@/app/modules-registry";
import { AuthProvider, useAuth } from "@/auth/auth-provider";
import { useRolePermissions } from "@/data/repository";
import { permissaoPadrao } from "@/lib/permissions";
import { Toaster } from "@/components/shared/toaster";
import Login from "@/modules/auth/login";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
const PesquisaPublica = lazy(() => import("@/modules/pesquisa-satisfacao/publica"));

// Cada módulo vira um chunk próprio, carregado sob demanda ao navegar até
// ele — evita que o usuário baixe os 25 módulos do Fisio de uma vez só.
const pageComponents: Record<string, ComponentType> = {
  "dashboard-executivo": lazy(() => import("@/modules/dashboard-executivo")),
  "painel-gestor": lazy(() => import("@/modules/painel-gestor")),
  "impacto-assistencial": lazy(() => import("@/modules/impacto-assistencial")),
  "dashboard-operacional": lazy(() => import("@/modules/dashboard-operacional")),
  "dashboard-financeiro": lazy(() => import("@/modules/dashboard-financeiro")),
  faturamento: lazy(() => import("@/modules/faturamento")),
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
  fechamento: lazy(() => import("@/modules/fechamento")),
  "novo-atendimento": lazy(() => import("@/modules/novo-atendimento")),
  "minha-fila": lazy(() => import("@/modules/minha-fila")),
  "evolucao-clinica": lazy(() => import("@/modules/evolucao-clinica")),
  financeiro: lazy(() => import("@/modules/financeiro")),
  auditoria: lazy(() => import("@/modules/auditoria")),
  diagnostico: lazy(() => import("@/modules/diagnostico")),
  "pesquisa-satisfacao": lazy(() => import("@/modules/pesquisa-satisfacao")),
  "desempenho-fila": lazy(() => import("@/modules/desempenho-fila")),
  relatorios: lazy(() => import("@/modules/relatorios")),
  bi: lazy(() => import("@/modules/bi")),
  configuracoes: lazy(() => import("@/modules/configuracoes")),
  "usuarios-permissoes": lazy(() => import("@/modules/usuarios-permissoes")),
  integracoes: lazy(() => import("@/modules/integracoes")),
  "importacao-tasy": lazy(() => import("@/modules/importacao-tasy")),
};

function PageFallback() {
  // Esqueleto que já sugere o formato real da tela (título + cabeçalho,
  // fileira de KPIs, lista) em vez de dois blocos genéricos — reduz o
  // "flash" entre trocar de módulo e o conteúdo real aparecer.
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="h-6 w-56 animate-pulse rounded-md bg-surface-sunken" />
        <div className="h-3.5 w-80 animate-pulse rounded-md bg-surface-sunken/70" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-surface-sunken" style={{ animationDelay: `${i * 75}ms` }} />
        ))}
      </div>
      <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface-raised p-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-surface-sunken" style={{ animationDelay: `${i * 60}ms` }} />
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="h-3.5 w-1/3 animate-pulse rounded bg-surface-sunken" style={{ animationDelay: `${i * 60}ms` }} />
              <div className="h-3 w-2/3 animate-pulse rounded bg-surface-sunken/70" style={{ animationDelay: `${i * 60}ms` }} />
            </div>
          </div>
        ))}
      </div>
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
  const permissoes = useRolePermissions();
  const [somenteRisco, setSomenteRisco] = useState<boolean | null>(null);

  // Sem perfil no fisio: confere se a conta é do inovare.risco (mesmo
  // login, autorização separada) antes de mostrar o erro genérico —
  // conta criada só pra risco não deve parecer "conta quebrada" no fisio.
  useEffect(() => {
    if (!session || profile) {
      setSomenteRisco(null);
      return;
    }
    supabase
      .from("risco_profiles")
      .select("id")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => setSomenteRisco(!!data));
  }, [session, profile]);

  if (loading) return <TelaCarregando />;
  if (!session) return <Login />;
  if (profileLoading) return <TelaCarregando />;

  if (!profile) {
    if (somenteRisco) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface px-4 text-center">
          <p className="font-display font-semibold text-ink">Essa conta é do inovare.risco</p>
          <p className="max-w-sm text-sm text-ink-soft">
            Seu login funciona, mas essa conta não tem acesso ao inovare.fisio — só ao inovare.risco.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => window.open("https://risco.inovaretech.com", "_blank", "noopener,noreferrer")}>
              <ExternalLink className="h-4 w-4" /> Ir para inovare.risco
            </Button>
            <Button variant="ghost" size="sm" onClick={() => signOut()}>Sair</Button>
          </div>
        </div>
      );
    }
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

  const perfil = profile;
  function podeVer(slug: string) {
    if (perfil.is_platform_admin) return true;
    const linha = permissoes.find((p) => p.role === perfil.role && p.module_slug === slug);
    return linha ? linha.can_view : permissaoPadrao(perfil.role, slug).can_view;
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        {allModules.map((mod) => {
          const Component = pageComponents[mod.slug];
          const bloqueado = !podeVer(mod.slug);
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
    <BrowserRouter>
      <Routes>
        {/* Rota pública — paciente/família responde sem login, por link com token. */}
        <Route
          path="/pesquisa/:token"
          element={
            <Suspense fallback={<PageFallback />}>
              <PesquisaPublica />
            </Suspense>
          }
        />
        <Route
          path="/*"
          element={
            <AuthProvider>
              <AuthGate />
              <Toaster />
            </AuthProvider>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
