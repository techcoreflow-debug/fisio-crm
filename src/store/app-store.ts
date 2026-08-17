import { create } from "zustand";

function lerRecolhidaSalva(): boolean {
  try {
    return localStorage.getItem("fisio:sidebar-recolhida") === "1";
  } catch {
    return false;
  }
}

/**
 * Modo de exibição — "tablet" (enxuto, sem sidebar, navegação por ícones
 * embaixo) ou "desktop" (layout padrão, com sidebar). Antes só o
 * fisioterapeuta tinha essa opção; agora vale pra qualquer papel — a
 * mesma pessoa pode usar tablet no plantão e PC no escritório, então
 * isso fica salvo por APARELHO (localStorage), não por conta.
 */
function lerModoExibicaoSalvo(): "tablet" | "desktop" | null {
  try {
    const salvo = localStorage.getItem("fisio:modo-exibicao");
    if (salvo === "tablet" || salvo === "desktop") return salvo;
    // Compatibilidade com a versão antiga (só existia pra fisioterapeuta)
    const antigo = localStorage.getItem("fisio:modo-exibicao-fisio");
    if (antigo === "desktop" || antigo === "tablet") return antigo;
    return null;
  } catch {
    return null;
  }
}

interface AppState {
  activeCompanyId: string;
  setActiveCompanyId: (id: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  /** Recolher a sidebar pra ícones só, no desktop — preferência que persiste entre sessões. */
  sidebarRecolhida: boolean;
  toggleSidebarRecolhida: () => void;
  /** Vale pra qualquer papel — "tablet" ou "desktop". null = nunca escolheu (usa o padrão do papel). */
  modoExibicao: "tablet" | "desktop" | null;
  setModoExibicao: (modo: "tablet" | "desktop") => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeCompanyId: "",
  setActiveCompanyId: (id) => set({ activeCompanyId: id }),
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  sidebarRecolhida: lerRecolhidaSalva(),
  toggleSidebarRecolhida: () =>
    set((s) => {
      const next = !s.sidebarRecolhida;
      try {
        localStorage.setItem("fisio:sidebar-recolhida", next ? "1" : "0");
      } catch {
        // sessionStorage/localStorage indisponível — só não persiste entre sessões
      }
      return { sidebarRecolhida: next };
    }),
  modoExibicao: lerModoExibicaoSalvo(),
  setModoExibicao: (modo) => {
    try {
      localStorage.setItem("fisio:modo-exibicao", modo);
    } catch {
      // sem persistência nesse aparelho, tudo bem — só volta ao padrão na próxima sessão
    }
    set({ modoExibicao: modo });
  },
  theme: "light",
  toggleTheme: () =>
    set((s) => {
      const next = s.theme === "light" ? "dark" : "light";
      document.documentElement.classList.toggle("dark", next === "dark");
      return { theme: next };
    }),
}));
