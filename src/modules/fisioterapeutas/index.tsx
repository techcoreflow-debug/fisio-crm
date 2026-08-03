import { useMemo, useState, type FormEvent } from "react";
import { Search, Plus, Pencil, UserRound } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Combobox } from "@/components/ui/combobox";
import { GoniometerGauge } from "@/components/shared/goniometer-gauge";
import { DeleteButton } from "@/components/shared/delete-button";
import { usePhysiotherapists, useTeams, useProfiles, repository } from "@/data/repository";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import { useAppStore } from "@/store/app-store";
import type { Physiotherapist } from "@/types/domain";

function iniciais(nome: string) {
  const partes = nome.split(" ");
  return (partes[0][0] + (partes[1]?.[0] ?? "")).toUpperCase();
}

export default function Fisioterapeutas() {
  const fisioterapeutas = usePhysiotherapists();
  const equipes = useTeams();
  const perfis = useProfiles();
  const empresaId = useAppStore((s) => s.activeCompanyId);
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [equipeId, setEquipeId] = useState("");
  const [usuarioId, setUsuarioId] = useState("");
  const [editando, setEditando] = useState<Physiotherapist | null>(null);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return fisioterapeutas;
    return fisioterapeutas.filter((f) => f.full_name.toLowerCase().includes(termo));
  }, [busca, fisioterapeutas]);

  function abrirNovo() {
    setEditando(null);
    setEquipeId("");
    setUsuarioId("");
    setOpen(true);
  }

  function abrirEdicao(fisio: Physiotherapist) {
    setEditando(fisio);
    setEquipeId(fisio.team_id ?? "");
    setUsuarioId(fisio.user_id ?? "");
    setOpen(true);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const dados = {
      full_name: String(form.get("full_name") ?? ""),
      professional_registry: String(form.get("professional_registry") ?? "") || null,
      team_id: equipeId || null,
      user_id: usuarioId || null,
      company_id: empresaId,
    };
    setSalvando(true);
    try {
      if (editando) {
        await repository.physiotherapists.update(editando.id, dados);
        notificarSucesso("Fisioterapeuta atualizado(a).");
      } else {
        await repository.physiotherapists.create(dados);
        notificarSucesso("Fisioterapeuta criado(a).");
      }
      setOpen(false);
      setEditando(null);
    } catch (erro) {
      notificarErro(editando ? "Não foi possível salvar as alterações" : "Não foi possível criar", erro);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Fisioterapeutas"
        description="Equipe assistencial, registro profissional e vínculo com as empresas do grupo."
        actions={
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="sm" onClick={abrirNovo}>
                <Plus className="h-4 w-4" /> Novo fisioterapeuta
              </Button>
            </SheetTrigger>
            <SheetContent>
              <form key={editando?.id ?? "novo"} className="flex h-full flex-col" onSubmit={handleSubmit}>
                <SheetHeader>
                  <SheetTitle>{editando ? "Editar fisioterapeuta" : "Novo fisioterapeuta"}</SheetTitle>
                  <SheetDescription>Cadastre um profissional e vincule à empresa correta.</SheetDescription>
                </SheetHeader>
                <div className="flex flex-1 flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="full_name">Nome completo</Label>
                    <Input id="full_name" name="full_name" required placeholder="Ex.: Ana Beatriz Correia" defaultValue={editando?.full_name} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="professional_registry">Registro profissional (Crefito)</Label>
                    <Input id="professional_registry" name="professional_registry" placeholder="CREFITO-3/00000-F" defaultValue={editando?.professional_registry ?? ""} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Equipe (opcional)</Label>
                    <Select value={equipeId} onValueChange={setEquipeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a equipe" />
                      </SelectTrigger>
                      <SelectContent>
                        {equipes.map((eq) => (
                          <SelectItem key={eq.id} value={eq.id}>
                            {eq.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5 rounded-md border border-clinical-300 bg-clinical-50 p-3">
                    <Label>Usuário vinculado (login)</Label>
                    <Combobox
                      value={usuarioId}
                      onValueChange={setUsuarioId}
                      options={perfis
                        .filter((p) => !fisioterapeutas.some((f) => f.user_id === p.id && f.id !== editando?.id))
                        .map((p) => ({ value: p.id, label: p.full_name, sublabel: p.email ?? undefined }))}
                      placeholder="Buscar usuário…"
                      searchPlaceholder="Nome ou e-mail…"
                      emptyText="Nenhum usuário disponível — crie o login em Usuários e Permissões primeiro."
                    />
                    <p className="text-xs text-ink-soft">
                      É esse vínculo que faz Minha Fila e o modo tablet funcionarem pra essa pessoa. Sem ele, ela
                      não vê a própria fila ao logar.
                    </p>
                  </div>
                </div>
                <SheetFooter>
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={salvando || !empresaId}>
                    {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Criar fisioterapeuta"}
                  </Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
        }
      />

      <Card>
        <div className="flex flex-col gap-4 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome…" className="pl-9" />
          </div>
          <p className="text-sm text-ink-soft">{filtrados.length} de {fisioterapeutas.length} fisioterapeutas</p>
        </div>

        {filtrados.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <UserRound className="h-8 w-8 text-ink-soft" />
            <p className="font-medium text-ink">Nenhum fisioterapeuta encontrado</p>
            <p className="text-sm text-ink-soft">Ajuste os termos da busca ou cadastre um novo profissional.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">Fisioterapeuta</th>
                  <th className="px-4 py-3 font-medium">Equipe</th>
                  <th className="px-4 py-3 font-medium">Login</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((f) => (
                  <tr key={f.id} className="border-b border-line last:border-0 hover:bg-surface-sunken/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar>
                          <AvatarFallback>{iniciais(f.full_name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-ink">{f.full_name}</p>
                          <p className="font-mono text-xs text-ink-soft">{f.professional_registry ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{equipes.find((eq) => eq.id === f.team_id)?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      {f.user_id ? (
                        <Badge variant="recovery">Vinculado</Badge>
                      ) : (
                        <Badge variant="attention">Sem login</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label={`Editar ${f.full_name}`} onClick={() => abrirEdicao(f)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <DeleteButton itemLabel={f.full_name} onConfirm={() => repository.physiotherapists.remove(f.id)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex flex-col items-center gap-4 p-6 sm:flex-row sm:justify-around">
          <CardContent className="p-0">
            <GoniometerGauge value={78} label="Produtividade média da equipe" sublabel="Calculado a partir da produção diária" tone="clinical" />
          </CardContent>
          <CardContent className="p-0">
            <GoniometerGauge value={94} label="Cobertura de escala" sublabel="Turnos preenchidos" tone="recovery" />
          </CardContent>
        </div>
      </Card>
    </div>
  );
}
