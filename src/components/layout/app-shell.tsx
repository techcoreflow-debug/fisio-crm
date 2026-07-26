import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Toaster } from "@/components/shared/toaster";
import { useAuth } from "@/auth/auth-provider";
import { useAppStore } from "@/store/app-store";

export function AppShell() {
  const { profile } = useAuth();
  const setActiveCompanyId = useAppStore((s) => s.setActiveCompanyId);

  // Usuário comum: a empresa ativa é sempre a dele, travada — não existe
  // seletor pra ele trocar. Admin da InovareTech: fica livre para escolher
  // (ver Topbar), então não mexemos na empresa ativa aqui.
  useEffect(() => {
    if (profile && !profile.is_platform_admin && profile.company_id) {
      setActiveCompanyId(profile.company_id);
    }
  }, [profile, setActiveCompanyId]);

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
