import { create } from "zustand";

function lerRecolhidaSalva(): boolean {
  try {
    return localStorage.getItem("fisio:sidebar-recolhida") === "1";
  } catch {
    return false;
  }
}

/**
 * Modo de exibição do fisioterapeuta (lançador) — "tablet" (enxuto, sem
 * sidebar) ou "desktop" (layout padrão, igual os outros papéis). A
 * mesma pessoa pode usar tablet no plantão e PC no escritório, então
 * isso fica salvo por APARELHO (localStorage), não por conta — trocar
 * num não afeta o outro.
 */
function lerModoExibicaoFisioSalvo(): "tablet" | "desktop" {
  try {
    return localStorage.getItem("fisio:modo-exibicao-fisio") === "desktop" ? "desktop" : "tablet";
  } catch {
    return "tablet";
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
  /** Só usado pelo perfil fisioterapeuta — "tablet" (padrão) ou "desktop". */
  modoExibicaoFisio: "tablet" | "desktop";
  setModoExibicaoFisio: (modo: "tablet" | "desktop") => void;
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
  modoExibicaoFisio: lerModoExibicaoFisioSalvo(),
  setModoExibicaoFisio: (modo) => {
    try {
      localStorage.setItem("fisio:modo-exibicao-fisio", modo);
    } catch {
      // sem persistência nesse aparelho, tudo bem — só volta ao padrão na próxima sessão
    }
    set({ modoExibicaoFisio: modo });
  },
  theme: "light",
  toggleTheme: () =>
    set((s) => {
      const next = s.theme === "light" ? "dark" : "light";
      document.documentElement.classList.toggle("dark", next === "dark");
      return { theme: next };
    }),
}));
