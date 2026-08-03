import { useState } from "react";
import { UserPlus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useProfiles, useUnassignedProfiles, useCompanies, useRolePermissions, repository } from "@/data/repository";
import { useAuth } from "@/auth/auth-provider";
import { useAppStore } from "@/store/app-store";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import { moduleGroups } from "@/app/modules-registry";
import { permissaoPadrao, ROLE_LABEL, TODOS_OS_ROLES, type Permissao } from "@/lib/permissions";
import { supabase } from "@/lib/supabase";
import type { UserRole } from "@/types/domain";

const papelConfig: Record<UserRole, { label: string; variant: NonNullable<BadgeProps["variant"]> }> = {
  admin: { label: "Admin", variant: "critical" },
  gestor: { label: "Gestor", variant: "clinical" },
  financeiro: { label: "Financeiro", variant: "attention" },
  fisioterapeuta: { label: "Fisioterapeuta", variant: "recovery" },
  auditor: { label: "Auditor", variant: "neutral" },
};

function iniciais(nome: string) {
  const partes = nome.trim().split(" ");
  return (partes[0]?.[0] ?? "?").concat(partes[1]?.[0] ?? "").toUpperCase();
}

export default function UsuariosPermissoes() {
  const perfis = useProfiles();
  const pendentes = useUnassignedProfiles().filter((p) => !p.is_platform_admin);
  const empresas = useCompanies();
  const { profile: meuPerfil } = useAuth();
  const empresaId = useAppStore((s) => s.activeCompanyId);
  const permissoesSalvas = useRolePermissions();
  const [papelEditando, setPapelEditando] = useState<UserRole>("fisioterapeuta");

  function permissaoAtual(moduleSlug: string): Permissao {
    const linha = permissoesSalvas.find((p) => p.role === papelEditando && p.module_slug === moduleSlug);
    if (linha) return { can_view: linha.can_view, can_create: linha.can_create, can_edit: linha.can_edit, can_delete: linha.can_delete };
    return permissaoPadrao(papelEditando, moduleSlug);
  }

  async function handleTogglePermissao(moduleSlug: string, campo: keyof Permissao, valor: boolean) {
    if (!empresaId) return;
    try {
      await repository.rolePermissions.definir(empresaId, papelEditando, moduleSlug, { ...permissaoAtual(moduleSlug), [campo]: valor });
    } catch (erro) {
      notificarErro("Não foi possível salvar a permissão", erro);
    }
  }

  async function handleTrocarPapel(id: string, role: UserRole) {
    try {
      await repository.profiles.update(id, { role });
      notificarSucesso("Papel atualizado.");
    } catch (erro) {
      notificarErro("Não foi possível atualizar o papel", erro);
    }
  }

  async function handleAtribuirEmpresa(id: string, companyId: string) {
    try {
      await repository.profiles.update(id, { company_id: companyId });
      notificarSucesso("Usuário vinculado à empresa.");
    } catch (erro) {
      notificarErro("Não foi possível vincular à empresa", erro);
    }
  }

  const [openCriarUsuario, setOpenCriarUsuario] = useState(false);
  const [salvandoUsuario, setSalvandoUsuario] = useState(false);
  const [empresaNovoUsuario, setEmpresaNovoUsuario] = useState(empresas[0]?.id ?? "");
  const [papelNovoUsuario, setPapelNovoUsuario] = useState<UserRole>("fisioterapeuta");

  function abrirCriarUsuario() {
    setEmpresaNovoUsuario(empresaId || empresas[0]?.id || "");
    setPapelNovoUsuario("fisioterapeuta");
    setOpenCriarUsuario(true);
  }

  async function handleCriarUsuario(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSalvandoUsuario(true);
    try {
      const { data: sessao } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
          fullName: String(form.get("full_name") ?? ""),
          companyId: empresaNovoUsuario,
          role: papelNovoUsuario,
        },
        headers: { Authorization: `Bearer ${sessao.session?.access_token ?? ""}` },
      });
      if (error) {
        // O supabase-js só dá uma mensagem genérica ("non-2xx status
        // code") — o texto de verdade que a função devolveu fica no
        // corpo da resposta, dentro de error.context.
        let mensagem = error.message;
        try {
          const corpo = await error.context?.json();
          if (corpo?.error) mensagem = corpo.error;
        } catch {
          // resposta não veio em JSON — fica com a mensagem genérica mesmo
        }
        throw new Error(mensagem);
      }
      if (data?.error) throw new Error(data.error);
      notificarSucesso("Usuário criado e vinculado — já pode logar direto, sem confirmar e-mail.");
      setOpenCriarUsuario(false);
      e.currentTarget.reset();
    } catch (erro) {
      notificarErro("Não foi possível criar o usuário", erro);
    } finally {
      setSalvandoUsuario(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Usuários e Permissões"
        description="Usuários com acesso a esta empresa e seus papéis."
        actions={
          meuPerfil?.is_platform_admin ? (
            <Sheet open={openCriarUsuario} onOpenChange={setOpenCriarUsuario}>
              <SheetTrigger asChild>
                <Button size="sm" onClick={abrirCriarUsuario}>
                  <UserPlus className="h-4 w-4" /> Criar usuário
                </Button>
              </SheetTrigger>
              <SheetContent>
                <form className="flex h-full flex-col" onSubmit={handleCriarUsuario}>
                  <SheetHeader>
                    <SheetTitle>Criar usuário</SheetTitle>
                    <SheetDescription>
                      Já entra ativo, vinculado à empresa e papel escolhidos — sem precisar confirmar e-mail.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="flex flex-1 flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="full_name">Nome completo</Label>
                      <Input id="full_name" name="full_name" required placeholder="Ex.: Ana Paula Ferreira" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="email">E-mail</Label>
                      <Input id="email" name="email" type="email" required placeholder="ana@inovaretech.com.br" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="password">Senha provisória</Label>
                      <Input id="password" name="password" type="text" required minLength={6} placeholder="Mínimo 6 caracteres" />
                      <p className="text-xs text-ink-soft">Combine com a pessoa depois — não força troca no primeiro login.</p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Empresa</Label>
                      <Select value={empresaNovoUsuario} onValueChange={setEmpresaNovoUsuario}>
                        <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                        <SelectContent>
                          {empresas.map((e) => (
                            <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Papel</Label>
                      <Select value={papelNovoUsuario} onValueChange={(v) => setPapelNovoUsuario(v as UserRole)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TODOS_OS_ROLES.map((r) => (
                            <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <SheetFooter>
                    <Button type="button" variant="secondary" onClick={() => setOpenCriarUsuario(false)}>Cancelar</Button>
                    <Button type="submit" disabled={salvandoUsuario || !empresaNovoUsuario}>
                      {salvandoUsuario ? "Criando…" : "Criar usuário"}
                    </Button>
                  </SheetFooter>
                </form>
              </SheetContent>
            </Sheet>
          ) : undefined
        }
      />

      {meuPerfil?.is_platform_admin && pendentes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Aguardando vínculo com uma empresa</CardTitle>
            <p className="text-sm text-ink-soft mt-0.5">
              Criaram conta pelo app mas ainda não pertencem a nenhuma empresa — sem isso, não enxergam nada no sistema.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {pendentes.map((p) => (
              <div key={p.id} className="flex flex-col gap-2 rounded-md border border-line p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2.5">
                  <Avatar>
                    <AvatarFallback>{iniciais(p.full_name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-ink">{p.full_name}</p>
                    <p className="text-xs text-ink-soft">{p.email ?? "—"}</p>
                  </div>
                </div>
                <Select onValueChange={(v) => handleAtribuirEmpresa(p.id, v)}>
                  <SelectTrigger className="h-8 w-52">
                    <SelectValue placeholder="Vincular a uma empresa…" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        {perfis.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="font-medium text-ink">Nenhum usuário nesta empresa ainda</p>
            <p className="text-sm text-ink-soft">Assim que alguém criar conta vinculada a esta empresa, aparece aqui.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">Usuário</th>
                  <th className="px-4 py-3 font-medium">Papel</th>
                  <th className="px-4 py-3 font-medium">Desde</th>
                </tr>
              </thead>
              <tbody>
                {perfis.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0 hover:bg-surface-sunken/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar>
                          <AvatarFallback>{iniciais(p.full_name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-ink">{p.full_name}</p>
                          <p className="text-xs text-ink-soft">{p.email ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {p.is_platform_admin ? (
                        <Badge variant="critical">Admin InovareTech</Badge>
                      ) : meuPerfil?.is_platform_admin || meuPerfil?.id === p.id ? (
                        <Select value={p.role} onValueChange={(v) => handleTrocarPapel(p.id, v as UserRole)}>
                          <SelectTrigger className="h-8 w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(papelConfig).map(([valor, cfg]) => (
                              <SelectItem key={valor} value={valor}>{cfg.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={papelConfig[p.role].variant}>{papelConfig[p.role].label}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{new Date(p.created_at).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Permissões por papel</CardTitle>
          <p className="text-sm text-ink-soft mt-0.5">
            O que cada papel pode ver, criar, editar e excluir, módulo a módulo. Admin InovareTech sempre tem
            acesso total e não aparece aqui.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-1.5">
            {TODOS_OS_ROLES.map((r) => (
              <button
                key={r}
                onClick={() => setPapelEditando(r)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  papelEditando === r ? "bg-clinical-500 text-white" : "bg-surface-sunken text-ink-soft hover:text-ink"
                }`}
              >
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-md border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-sunken text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-2.5 font-medium">Módulo</th>
                  <th className="px-4 py-2.5 text-center font-medium">Ver</th>
                  <th className="px-4 py-2.5 text-center font-medium">Criar</th>
                  <th className="px-4 py-2.5 text-center font-medium">Editar</th>
                  <th className="px-4 py-2.5 text-center font-medium">Excluir</th>
                </tr>
              </thead>
              <tbody>
                {moduleGroups.flatMap((g) => g.modules).map((mod) => {
                  const perm = permissaoAtual(mod.slug);
                  return (
                    <tr key={mod.slug} className="border-b border-line last:border-0">
                      <td className="px-4 py-2 text-ink">{mod.label}</td>
                      {(["can_view", "can_create", "can_edit", "can_delete"] as const).map((campo) => (
                        <td key={campo} className="px-4 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={perm[campo]}
                            onChange={(e) => handleTogglePermissao(mod.slug, campo, e.target.checked)}
                            className="h-4 w-4 rounded border-line-strong accent-clinical-500"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
