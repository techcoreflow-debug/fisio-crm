import { NavLink } from "react-router-dom";
import { Activity, X } from "lucide-react";
import { moduleGroups } from "@/app/modules-registry";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";

function SidebarContent() {
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-clinical-500 text-white">
            <Activity className="h-4.5 w-4.5" />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight text-ink">inovare.fisio</span>
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
        {moduleGroups.map((group) => (
          <div key={group.id} className="mb-4">
            <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-soft/70">
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.modules.map((mod) => (
                <NavLink
                  key={mod.slug}
                  to={mod.path}
                  end={mod.path === "/"}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-clinical-50 text-clinical-700"
                        : "text-ink-soft hover:bg-surface-sunken hover:text-ink"
                    )
                  }
                >
                  <mod.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{mod.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}

export function Sidebar() {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);

  return (
    <>
      {/* Desktop */}
      <aside className="hidden w-64 shrink-0 border-r border-line bg-surface-raised lg:block">
        <SidebarContent />
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
