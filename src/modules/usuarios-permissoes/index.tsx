import { useState } from "react";
import { UserPlus, Users2, Pencil, Trash2, KeyRound } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useProfiles, useUnassignedProfiles, useCompanies, useRolePermissions, repository } from "@/data/repository";
import { useAuth } from "@/auth/auth-provider";
import { useAppStore } from "@/store/app-store";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import { moduleGroups } from "@/app/modules-registry";
import { permissaoPadrao, ROLE_LABEL, TODOS_OS_ROLES, type Permissao } from "@/lib/permissions";
import { supabase } from "@/lib/supabase";
import type { UserRole, Profile } from "@/types/domain";

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

  /** Chama a Edge Function pra qualquer ação (criar/excluir/trocar senha) — sempre a mesma checagem de admin e o mesmo tratamento de erro. */
  async function chamarGerenciarUsuario(body: Record<string, unknown>) {
    const { data: sessao } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("create-user", {
      body,
      headers: { Authorization: `Bearer ${sessao.session?.access_token ?? ""}` },
    });
    if (error) {
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
  }

  async function criarUsuario(email: string, password: string, fullName: string, companyId: string, role: UserRole) {
    await chamarGerenciarUsuario({ action: "create", email, password, fullName, companyId, role });
  }

  async function handleCriarUsuario(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSalvandoUsuario(true);
    try {
      await criarUsuario(
        String(form.get("email") ?? ""),
        String(form.get("password") ?? ""),
        String(form.get("full_name") ?? ""),
        empresaNovoUsuario,
        papelNovoUsuario
      );
      notificarSucesso("Usuário criado e vinculado — já pode logar direto, sem confirmar e-mail.");
      setOpenCriarUsuario(false);
      e.currentTarget.reset();
    } catch (erro) {
      notificarErro("Não foi possível criar o usuário", erro);
    } finally {
      setSalvandoUsuario(false);
    }
  }

  // --- Editar usuário existente ---
  const [openEditar, setOpenEditar] = useState(false);
  const [editando, setEditando] = useState<Profile | null>(null);
  const [nomeEditar, setNomeEditar] = useState("");
  const [papelEditar, setPapelEditar] = useState<UserRole>("fisioterapeuta");
  const [empresaEditar, setEmpresaEditar] = useState("");
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  function abrirEditar(p: Profile) {
    setEditando(p);
    setNomeEditar(p.full_name);
    setPapelEditar(p.role);
    setEmpresaEditar(p.company_id ?? "");
    setOpenEditar(true);
  }

  async function handleSalvarEdicao(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editando) return;
    setSalvandoEdicao(true);
    try {
      await repository.profiles.update(editando.id, {
        full_name: nomeEditar,
        role: papelEditar,
        company_id: empresaEditar || undefined,
      });
      notificarSucesso("Usuário atualizado.");
      setOpenEditar(false);
    } catch (erro) {
      notificarErro("Não foi possível salvar as alterações", erro);
    } finally {
      setSalvandoEdicao(false);
    }
  }

  // --- Excluir usuário ---
  async function handleExcluirUsuario(p: Profile) {
    if (!window.confirm(`Excluir "${p.full_name}" de vez? A pessoa não vai mais conseguir logar. Não pode ser desfeito.`)) return;
    try {
      await chamarGerenciarUsuario({ action: "delete", userId: p.id });
      notificarSucesso(`"${p.full_name}" excluído.`);
    } catch (erro) {
      notificarErro("Não foi possível excluir", erro);
    }
  }

  // --- Trocar senha de outro usuário ---
  const [openTrocarSenha, setOpenTrocarSenha] = useState<Profile | null>(null);
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  async function handleTrocarSenhaUsuario(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!openTrocarSenha) return;
    const form = new FormData(e.currentTarget);
    const novaSenha = String(form.get("nova_senha") ?? "");
    setSalvandoSenha(true);
    try {
      await chamarGerenciarUsuario({ action: "reset-password", userId: openTrocarSenha.id, password: novaSenha });
      notificarSucesso(`Senha de "${openTrocarSenha.full_name}" trocada.`);
      setOpenTrocarSenha(null);
    } catch (erro) {
      notificarErro("Não foi possível trocar a senha", erro);
    } finally {
      setSalvandoSenha(false);
    }
  }
  // --- Criação em lote ---
  function normalizarSemAcento(texto: string) {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  function gerarEmail(nomeCompleto: string, dominio: string) {
    const partes = normalizarSemAcento(nomeCompleto.trim()).toLowerCase().split(/\s+/).filter(Boolean);
    const primeiro = partes[0] ?? "";
    const ultimo = partes.length > 1 ? partes[partes.length - 1] : "";
    return `${primeiro}${ultimo ? "." + ultimo : ""}@${dominio}`;
  }

  const [openLote, setOpenLote] = useState(false);
  const [nomesLote, setNomesLote] = useState("");
  const [dominioLote, setDominioLote] = useState("inovarefisio.com.br");
  const [senhaLote, setSenhaLote] = useState("");
  const [empresaLote, setEmpresaLote] = useState("");
  const [papelLote, setPapelLote] = useState<UserRole>("fisioterapeuta");
  const [processandoLote, setProcessandoLote] = useState(false);
  const [resultadoLote, setResultadoLote] = useState<{ nome: string; email: string; ok: boolean; erro?: string }[]>([]);

  function abrirLote() {
    setNomesLote("");
    setSenhaLote("");
    setEmpresaLote(empresaId || empresas[0]?.id || "");
    setPapelLote("fisioterapeuta");
    setResultadoLote([]);
    setOpenLote(true);
  }

  const previaLote = nomesLote
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((nome) => ({ nome, email: gerarEmail(nome, dominioLote) }));

  async function handleCriarLote() {
    if (!empresaLote || !senhaLote || previaLote.length === 0) return;
    setProcessandoLote(true);
    const resultados: typeof resultadoLote = [];
    for (const item of previaLote) {
      try {
        await criarUsuario(item.email, senhaLote, item.nome, empresaLote, papelLote);
        resultados.push({ ...item, ok: true });
      } catch (erro) {
        resultados.push({ ...item, ok: false, erro: erro instanceof Error ? erro.message : "Erro desconhecido" });
      }
      setResultadoLote([...resultados]);
    }
    setProcessandoLote(false);
    const sucesso = resultados.filter((r) => r.ok).length;
    if (sucesso > 0) notificarSucesso(`${sucesso} de ${resultados.length} usuário(s) criado(s).`);
    if (sucesso < resultados.length) notificarErro("Alguns usuários não foram criados", "Veja o detalhe de cada um na lista.");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Usuários e Permissões"
        description="Usuários com acesso a esta empresa e seus papéis."
        actions={
          meuPerfil?.is_platform_admin ? (
            <div className="flex gap-2">
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

            <Sheet open={openLote} onOpenChange={setOpenLote}>
              <SheetTrigger asChild>
                <Button size="sm" variant="secondary" onClick={abrirLote}>
                  <Users2 className="h-4 w-4" /> Criar em lote
                </Button>
              </SheetTrigger>
              <SheetContent className="sm:max-w-lg">
                <SheetHeader>
                  <SheetTitle>Criar usuários em lote</SheetTitle>
                  <SheetDescription>
                    Um nome completo por linha — o e-mail é gerado sozinho (primeiro.último@domínio).
                  </SheetDescription>
                </SheetHeader>
                <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="nomes_lote">Nomes completos (um por linha)</Label>
                    <textarea
                      id="nomes_lote"
                      rows={6}
                      value={nomesLote}
                      onChange={(e) => setNomesLote(e.target.value)}
                      placeholder={"Thais de Oliveira Souza\nBeatriz Moura Silva\n..."}
                      className="rounded-md border border-line-strong bg-surface-raised px-3 py-2 text-sm text-ink shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-500/40"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="dominio_lote">Domínio do e-mail</Label>
                    <Input id="dominio_lote" value={dominioLote} onChange={(e) => setDominioLote(e.target.value)} placeholder="inovarefisio.com.br" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="senha_lote">Senha provisória (igual pra todos)</Label>
                    <Input id="senha_lote" value={senhaLote} onChange={(e) => setSenhaLote(e.target.value)} minLength={6} placeholder="Mínimo 6 caracteres" />
                    <p className="text-xs text-ink-soft">Cada pessoa pode trocar a própria senha depois, no menu do usuário (canto superior direito).</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label>Empresa</Label>
                      <Select value={empresaLote} onValueChange={setEmpresaLote}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {empresas.map((e) => (
                            <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Papel</Label>
                      <Select value={papelLote} onValueChange={(v) => setPapelLote(v as UserRole)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TODOS_OS_ROLES.map((r) => (
                            <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {previaLote.length > 0 && (
                    <div className="flex flex-col gap-1.5 rounded-md border border-line p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
                        Prévia ({previaLote.length})
                      </p>
                      {previaLote.map((item) => {
                        const resultado = resultadoLote.find((r) => r.nome === item.nome);
                        return (
                          <div key={item.nome} className="flex items-center justify-between text-sm">
                            <div>
                              <span className="text-ink">{item.nome}</span>
                              <span className="ml-2 font-mono text-xs text-ink-soft">{item.email}</span>
                            </div>
                            {resultado && (
                              <Badge variant={resultado.ok ? "recovery" : "critical"}>
                                {resultado.ok ? "Criado" : resultado.erro ?? "Falhou"}
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <SheetFooter>
                  <Button type="button" variant="secondary" onClick={() => setOpenLote(false)}>Fechar</Button>
                  <Button
                    onClick={handleCriarLote}
                    disabled={processandoLote || previaLote.length === 0 || !senhaLote || !empresaLote}
                  >
                    {processandoLote ? "Criando…" : `Criar ${previaLote.length} usuário(s)`}
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
            </div>
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
                  <th className="px-4 py-3 font-medium" />
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
                    <td className="px-4 py-3 text-right">
                      {meuPerfil?.is_platform_admin && !p.is_platform_admin && (
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" aria-label={`Editar ${p.full_name}`} onClick={() => abrirEditar(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label={`Trocar senha de ${p.full_name}`} onClick={() => setOpenTrocarSenha(p)}>
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          {p.id !== meuPerfil.id && (
                            <Button variant="ghost" size="icon" aria-label={`Excluir ${p.full_name}`} onClick={() => handleExcluirUsuario(p)}>
                              <Trash2 className="h-4 w-4 text-critical-400" />
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
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

      <Sheet open={openEditar} onOpenChange={setOpenEditar}>
        <SheetContent>
          <form className="flex h-full flex-col" onSubmit={handleSalvarEdicao}>
            <SheetHeader>
              <SheetTitle>Editar usuário</SheetTitle>
              <SheetDescription>{editando?.email}</SheetDescription>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nome_editar">Nome completo</Label>
                <Input id="nome_editar" value={nomeEditar} onChange={(e) => setNomeEditar(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Empresa</Label>
                <Select value={empresaEditar} onValueChange={setEmpresaEditar}>
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
                <Select value={papelEditar} onValueChange={(v) => setPapelEditar(v as UserRole)}>
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
              <Button type="button" variant="secondary" onClick={() => setOpenEditar(false)}>Cancelar</Button>
              <Button type="submit" disabled={salvandoEdicao || !nomeEditar || !empresaEditar}>
                {salvandoEdicao ? "Salvando…" : "Salvar alterações"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Dialog open={openTrocarSenha !== null} onOpenChange={(v) => !v && setOpenTrocarSenha(null)}>
        <DialogContent>
          <form onSubmit={handleTrocarSenhaUsuario}>
            <DialogHeader>
              <DialogTitle>Trocar senha</DialogTitle>
              <DialogDescription>{openTrocarSenha?.full_name} — a pessoa passa a usar essa senha no próximo login.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nova_senha">Nova senha</Label>
                <PasswordInput id="nova_senha" name="nova_senha" required minLength={6} placeholder="Mínimo 6 caracteres" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpenTrocarSenha(null)}>Cancelar</Button>
              <Button type="submit" disabled={salvandoSenha}>{salvandoSenha ? "Salvando…" : "Trocar senha"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
