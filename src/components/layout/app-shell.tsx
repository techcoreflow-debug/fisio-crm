import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Toaster } from "@/components/shared/toaster";
import { useAuth } from "@/auth/auth-provider";
import { useAppStore } from "@/store/app-store";
import { useCompanies } from "@/data/repository";

export function AppShell() {
  const { profile } = useAuth();
  const activeCompanyId = useAppStore((s) => s.activeCompanyId);
  const setActiveCompanyId = useAppStore((s) => s.setActiveCompanyId);
  const companies = useCompanies();

  useEffect(() => {
    if (!profile) return;

    if (profile.is_platform_admin) {
      // Admin InovareTech escolhe livremente — mas precisa de uma seleção
      // válida de partida, senão "" (ou um id de empresa que não existe
      // mais) faz toda consulta filtrada por empresa vir vazia em silêncio.
      const atualAindaExiste = companies.some((c) => c.id === activeCompanyId);
      if (!atualAindaExiste && companies.length > 0) {
        setActiveCompanyId(companies[0].id);
      }
    } else if (profile.company_id && profile.company_id !== activeCompanyId) {
      // Usuário comum: a empresa ativa é sempre a dele, travada — não
      // existe seletor pra ele trocar.
      setActiveCompanyId(profile.company_id);
    }
  }, [profile, companies, activeCompanyId, setActiveCompanyId]);

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
