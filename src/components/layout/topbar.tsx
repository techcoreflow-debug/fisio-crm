import { useState } from "react";
import { Menu, Search, Bell, ChevronsUpDown, LogOut, Settings, Moon, Sun, ShieldCheck, KeyRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/app-store";
import { useCompanies } from "@/data/repository";
import { useAuth } from "@/auth/auth-provider";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function iniciais(nome: string) {
  const partes = nome.trim().split(" ");
  return (partes[0]?.[0] ?? "?").concat(partes[1]?.[0] ?? "").toUpperCase();
}

export function Topbar() {
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const activeCompanyId = useAppStore((s) => s.activeCompanyId);
  const setActiveCompanyId = useAppStore((s) => s.setActiveCompanyId);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const companies = useCompanies();
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const activeCompany = companies.find((c) => c.id === activeCompanyId) ?? companies[0];

  async function handleSignOut() {
    await signOut();
  }

  const [openTrocarSenha, setOpenTrocarSenha] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  async function handleTrocarSenha(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const novaSenha = String(form.get("nova_senha") ?? "");
    const confirmacao = String(form.get("confirmacao") ?? "");
    if (novaSenha !== confirmacao) {
      notificarErro("As senhas não coincidem", "Digite a mesma senha nos dois campos.");
      return;
    }
    setSalvandoSenha(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) throw new Error(error.message);
      notificarSucesso("Senha alterada.");
      setOpenTrocarSenha(false);
      e.currentTarget.reset();
    } catch (erro) {
      notificarErro("Não foi possível trocar a senha", erro);
    } finally {
      setSalvandoSenha(false);
    }
  }

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-surface-raised px-4 lg:px-6">
      <button
        className="rounded-md p-1.5 text-ink-soft hover:bg-surface-sunken lg:hidden"
        onClick={() => setSidebarOpen(true)}
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Seletor de empresa — só para admin InovareTech, que opera várias
          empresas-cliente. Usuário comum vê a própria empresa, fixa. */}
      {profile?.is_platform_admin ? (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-left hover:bg-surface-sunken">
            <div className="hidden sm:block">
              <p className="text-sm font-medium leading-tight text-ink">{activeCompany?.name ?? "Selecione a empresa"}</p>
              <p className="text-xs leading-tight text-ink-soft">{activeCompany?.cnpj}</p>
            </div>
            <ChevronsUpDown className="h-4 w-4 text-ink-soft" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Trocar de empresa</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {companies.map((company) => (
              <DropdownMenuItem key={company.id} onSelect={() => setActiveCompanyId(company.id)}>
                <div>
                  <p className="text-sm text-ink">{company.name}</p>
                  <p className="text-xs text-ink-soft">{company.cnpj}</p>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="hidden sm:block">
          <p className="text-sm font-medium leading-tight text-ink">{activeCompany?.name ?? "—"}</p>
          <p className="text-xs leading-tight text-ink-soft">{activeCompany?.cnpj}</p>
        </div>
      )}

      {profile?.is_platform_admin && (
        <Badge variant="critical" className="hidden md:inline-flex">
          <ShieldCheck className="h-3 w-3" /> Admin InovareTech
        </Badge>
      )}

      <div className="relative ml-2 hidden max-w-sm flex-1 md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
        <Input
          placeholder="Busca global — em breve"
          className="pl-9"
          disabled
          title="Busca global ainda não foi implementada"
        />
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          className="rounded-md p-2 text-ink-soft hover:bg-surface-sunken"
          onClick={toggleTheme}
          aria-label="Alternar tema"
        >
          {theme === "light" ? <Moon className="h-4.5 w-4.5" /> : <Sun className="h-4.5 w-4.5" />}
        </button>
        <button
          className="rounded-md p-2 text-ink-soft hover:bg-surface-sunken"
          aria-label="Notificações"
          onClick={() =>
            notificarErro("Central de notificações ainda não implementada", "Os alertas de cada módulo (ex.: Dashboard Executivo) já são reais — isso aqui é só o sino, sem lista própria ainda.")
          }
        >
          <Bell className="h-4.5 w-4.5" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger className="ml-1">
            <Avatar>
              <AvatarFallback>{profile ? iniciais(profile.full_name) : "?"}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{profile?.full_name ?? "—"}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate("/configuracoes")}>
              <Settings className="h-4 w-4" /> Configurações
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setOpenTrocarSenha(true)}>
              <KeyRound className="h-4 w-4" /> Trocar senha
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleSignOut}>
              <LogOut className="h-4 w-4" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={openTrocarSenha} onOpenChange={setOpenTrocarSenha}>
        <DialogContent>
          <form onSubmit={handleTrocarSenha}>
            <DialogHeader>
              <DialogTitle>Trocar senha</DialogTitle>
              <DialogDescription>Vale a partir do próximo login.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nova_senha">Nova senha</Label>
                <Input id="nova_senha" name="nova_senha" type="password" required minLength={6} placeholder="Mínimo 6 caracteres" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirmacao">Confirmar nova senha</Label>
                <Input id="confirmacao" name="confirmacao" type="password" required minLength={6} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpenTrocarSenha(false)}>Cancelar</Button>
              <Button type="submit" disabled={salvandoSenha}>{salvandoSenha ? "Salvando…" : "Trocar senha"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </header>
  );
}
