import { useState } from "react";
import { Menu, Search, ChevronsUpDown, LogOut, Settings, Moon, Sun, ShieldCheck, KeyRound, Tablet, ExternalLink, Rows3, Rows4 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/app-store";
import { useCompanies } from "@/data/repository";
import { useAuth } from "@/auth/auth-provider";
import { supabase } from "@/lib/supabase";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SinoNovidades } from "@/components/shared/sino-novidades";
import { iniciais } from "@/lib/iniciais";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Topbar() {
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const activeCompanyId = useAppStore((s) => s.activeCompanyId);
  const setActiveCompanyId = useAppStore((s) => s.setActiveCompanyId);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const setModoExibicao = useAppStore((s) => s.setModoExibicao);
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const densidade = useAppStore((s) => s.densidade);
  const toggleDensidade = useAppStore((s) => s.toggleDensidade);
  const companies = useCompanies();
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [openTrocarSenha, setOpenTrocarSenha] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  const activeCompany = companies.find((c) => c.id === activeCompanyId) ?? companies[0];

  async function handleSignOut() {
    await signOut();
  }

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
      if (error) throw error;
      notificarSucesso("Senha alterada.");
      setOpenTrocarSenha(false);
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

      <button
        type="button"
        onClick={() => setCommandPaletteOpen(true)}
        className="relative ml-2 hidden max-w-sm flex-1 items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-left text-sm text-ink-soft hover:border-line-strong hover:bg-surface-sunken md:flex"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">Buscar paciente, nº Tasy, leito…</span>
        <span className="flex shrink-0 gap-1">
          <kbd className="rounded border border-line bg-surface-raised px-1.5 py-0.5 font-mono text-[10px]">⌘</kbd>
          <kbd className="rounded border border-line bg-surface-raised px-1.5 py-0.5 font-mono text-[10px]">K</kbd>
        </span>
      </button>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          className="rounded-md p-2 text-ink-soft hover:bg-surface-sunken"
          onClick={toggleDensidade}
          aria-label={densidade === "confortavel" ? "Usar densidade compacta" : "Usar densidade confortável"}
          title={densidade === "confortavel" ? "Densidade: confortável (clique pra compacta)" : "Densidade: compacta (clique pra confortável)"}
        >
          {densidade === "confortavel" ? <Rows3 className="h-4.5 w-4.5" /> : <Rows4 className="h-4.5 w-4.5" />}
        </button>
        <button
          className="rounded-md p-2 text-ink-soft hover:bg-surface-sunken"
          onClick={toggleTheme}
          aria-label="Alternar tema"
        >
          {theme === "light" ? <Moon className="h-4.5 w-4.5" /> : <Sun className="h-4.5 w-4.5" />}
        </button>
        <SinoNovidades />
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
            <DropdownMenuItem onSelect={() => setModoExibicao("tablet")}>
              <Tablet className="h-4 w-4" /> Usar layout tablet
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => window.open("https://risco.inovaretech.com", "_blank", "noopener,noreferrer")}>
              <ExternalLink className="h-4 w-4" /> Ir para inovare.risco
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
              <DialogDescription>Escolha uma nova senha pra sua conta.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nova_senha">Nova senha</Label>
                <PasswordInput id="nova_senha" name="nova_senha" required minLength={6} placeholder="Mínimo 6 caracteres" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirmacao">Confirmar nova senha</Label>
                <PasswordInput id="confirmacao" name="confirmacao" required minLength={6} />
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
