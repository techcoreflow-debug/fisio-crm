import { NavLink, useLocation } from "react-router-dom";
import { allModules, hubDoModulo } from "@/app/modules-registry";
import { usePodeVerModulo } from "@/lib/use-pode-ver";
import { cn } from "@/lib/utils";

/**
 * Abas do hub da página atual (ex.: Painéis → Executivo · Dia a dia · …).
 * Não renderiza nada se a rota não pertence a um hub ou se o usuário só
 * enxerga uma aba. Cada aba é a rota real do módulo.
 */
export function HubTabs() {
  const { pathname } = useLocation();
  const podeVer = usePodeVerModulo();

  const atual = allModules.find((m) => m.path === pathname);
  const hub = atual ? hubDoModulo(atual.slug) : undefined;
  if (!hub) return null;

  const abas = hub.abas
    .map((a) => ({ ...a, modulo: allModules.find((m) => m.slug === a.slug) }))
    .filter((a) => a.modulo && podeVer(a.slug));
  if (abas.length < 2) return null;

  return (
    <nav aria-label={hub.label} className="mb-6 flex gap-1 overflow-x-auto border-b border-line print:hidden">
      {abas.map((a) => (
        <NavLink
          key={a.slug}
          to={a.modulo!.path}
          end
          className={({ isActive }) =>
            cn(
              "-mb-px shrink-0 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
              isActive ? "border-clinical-500 text-clinical-700" : "border-transparent text-ink-soft hover:text-ink"
            )
          }
        >
          {a.label}
        </NavLink>
      ))}
    </nav>
  );
}
