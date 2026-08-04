import { create } from "zustand";

function lerRecolhidaSalva(): boolean {
  try {
    return localStorage.getItem("fisio:sidebar-recolhida") === "1";
  } catch {
    return false;
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
  theme: "light",
  toggleTheme: () =>
    set((s) => {
      const next = s.theme === "light" ? "dark" : "light";
      document.documentElement.classList.toggle("dark", next === "dark");
      return { theme: next };
    }),
}));
