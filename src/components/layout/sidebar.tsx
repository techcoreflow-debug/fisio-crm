import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Activity, X, ChevronDown, ChevronsLeft, ChevronsRight } from "lucide-react";
import { moduleGroups } from "@/app/modules-registry";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { useAuth } from "@/auth/auth-provider";
import { useRolePermissions } from "@/data/repository";
import { permissaoPadrao } from "@/lib/permissions";

function SidebarContent({ recolhida = false }: { recolhida?: boolean }) {
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const sidebarRecolhida = useAppStore((s) => s.sidebarRecolhida);
  const toggleSidebarRecolhida = useAppStore((s) => s.toggleSidebarRecolhida);
  const { profile } = useAuth();
  const location = useLocation();
  const permissoes = useRolePermissions();

  function podeVer(slug: string) {
    if (!profile) return false;
    if (profile.is_platform_admin) return true;
    const linha = permissoes.find((p) => p.role === profile.role && p.module_slug === slug);
    return linha ? linha.can_view : permissaoPadrao(profile.role, slug).can_view;
  }

  const grupos = moduleGroups
    .map((g) => ({ ...g, modules: g.modules.filter((m) => podeVer(m.slug)) }))
    .filter((g) => g.modules.length > 0);

  const [recolhidos, setRecolhidos] = useState<Set<string>>(
    () => new Set(grupos.filter((g) => g.recolhidoPorPadrao).map((g) => g.id))
  );

  function toggleGrupo(id: string) {
    setRecolhidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex items-center px-5 py-5", recolhida ? "justify-center" : "justify-between")}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-clinical-500 text-white">
            <Activity className="h-4.5 w-4.5" />
          </div>
          {!recolhida && <span className="font-display text-lg font-semibold tracking-tight text-ink">inovare.fisio</span>}
        </div>
        <button
          className="rounded-md p-1.5 text-ink-soft hover:bg-surface-sunken lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Fechar menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {grupos.map((group) => {
          // Nunca esconde a rota que a pessoa está vendo agora, mesmo que
          // o grupo esteja marcado como recolhido por padrão.
          const temRotaAtiva = group.modules.some((m) => m.path === location.pathname);
          const expandido = temRotaAtiva || !recolhidos.has(group.id);

          return (
            <div key={group.id} className="mb-4">
              {!recolhida && (
                <button
                  onClick={() => toggleGrupo(group.id)}
                  className="flex w-full items-center justify-between px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-soft/70 hover:text-ink-soft"
                >
                  {group.label}
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !expandido && "-rotate-90")} />
                </button>
              )}
              {(recolhida || expandido) && (
                <div className="flex flex-col gap-0.5">
                  {group.modules.map((mod) => (
                    <NavLink
                      key={mod.slug}
                      to={mod.path}
                      end={mod.path === "/"}
                      onClick={() => setSidebarOpen(false)}
                      title={recolhida ? mod.label : undefined}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                          recolhida && "justify-center",
                          isActive
                            ? "bg-clinical-50 text-clinical-700"
                            : "text-ink-soft hover:bg-surface-sunken hover:text-ink"
                        )
                      }
                    >
                      <mod.icon className="h-4 w-4 shrink-0" />
                      {!recolhida && <span className="truncate">{mod.label}</span>}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <button
        onClick={toggleSidebarRecolhida}
        className="hidden items-center justify-center gap-2 border-t border-line py-3 text-xs font-medium text-ink-soft hover:bg-surface-sunken hover:text-ink lg:flex"
      >
        {sidebarRecolhida ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Recolher menu</>}
      </button>
    </div>
  );
}

export function Sidebar() {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const sidebarRecolhida = useAppStore((s) => s.sidebarRecolhida);

  return (
    <>
      {/* Desktop */}
      <aside className={cn("hidden shrink-0 border-r border-line bg-surface-raised transition-all lg:block", sidebarRecolhida ? "w-16" : "w-64")}>
        <SidebarContent recolhida={sidebarRecolhida} />
      </aside>

      {/* Mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-surface-raised shadow-xl">
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  );
}
