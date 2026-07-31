import { NavLink } from "react-router-dom";
import { Activity, LogOut } from "lucide-react";
import { moduleGroups } from "@/app/modules-registry";
import { cn } from "@/lib/utils";
import { useAuth } from "@/auth/auth-provider";
import { useRolePermissions } from "@/data/repository";
import { permissaoPadrao } from "@/lib/permissions";

/**
 * Shell dedicado pro perfil fisioterapeuta (lançador) em tablet: sem
 * sidebar (ocuparia largura demais em retrato), navegação inferior com
 * ícones grandes — o padrão de app de celular/tablet que a equipe já
 * conhece de usar no dia a dia, bem diferente do shell "denso" de
 * desktop que faz sentido pra quem administra o sistema inteiro.
 */
const ROTULO_CURTO: Record<string, string> = {
  "minha-fila": "Fila",
  "novo-atendimento": "Lançar",
  pacientes: "Pacientes",
  internacoes: "Internados",
  "producao-diaria": "Produção",
};

export function TabletShell({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const permissoes = useRolePermissions();

  function podeVer(slug: string) {
    if (!profile) return false;
    const linha = permissoes.find((p) => p.role === profile.role && p.module_slug === slug);
    return linha ? linha.can_view : permissaoPadrao(profile.role, slug).can_view;
  }

  const abas = moduleGroups
    .flatMap((g) => g.modules)
    .filter((m) => podeVer(m.slug));

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface">
      <header className="flex items-center justify-between border-b border-line bg-surface-raised px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-clinical-500 text-white">
            <Activity className="h-4.5 w-4.5" />
          </div>
          <span className="font-display text-base font-semibold tracking-tight text-ink">inovare.fisio</span>
        </div>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-ink-soft hover:bg-surface-sunken"
          aria-label="Sair"
        >
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-5 pb-24">
        <div className="mx-auto max-w-3xl">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface-raised pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        <div className="mx-auto flex max-w-3xl">
          {abas.map((mod) => (
            <NavLink
              key={mod.slug}
              to={mod.path}
              className={({ isActive }) =>
                cn(
                  "flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
                  isActive ? "text-clinical-600" : "text-ink-soft"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <mod.icon className={cn("h-6 w-6", isActive && "text-clinical-600")} />
                  {ROTULO_CURTO[mod.slug] ?? mod.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
