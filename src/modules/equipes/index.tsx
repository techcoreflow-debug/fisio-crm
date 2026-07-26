import { useState, type FormEvent } from "react";
import { Plus, Pencil, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";
import { DeleteButton } from "@/components/shared/delete-button";
import { useTeams, usePhysiotherapists, repository } from "@/data/repository";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import { useAppStore } from "@/store/app-store";
import type { Team } from "@/types/domain";

export default function Equipes() {
  const equipes = useTeams();
  const fisioterapeutas = usePhysiotherapists();
  const empresaId = useAppStore((s) => s.activeCompanyId);
  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState<Team | null>(null);

  function abrirNovo() {
    setEditando(null);
    setOpen(true);
  }

  function abrirEdicao(equipe: Team) {
    setEditando(equipe);
    setOpen(true);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const dados = { name: String(form.get("name") ?? ""), company_id: empresaId };
    setSalvando(true);
    try {
      if (editando) {
        await repository.teams.update(editando.id, dados);
        notificarSucesso("Equipe atualizado(a).");
      } else {
        await repository.teams.create(dados);
        notificarSucesso("Equipe criado(a).");
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
        title="Equipes"
        description="Equipes de fisioterapeutas, usadas em escalas e organização assistencial."
        actions={
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="sm" onClick={abrirNovo}>
                <Plus className="h-4 w-4" /> Nova equipe
              </Button>
            </SheetTrigger>
            <SheetContent>
              <form key={editando?.id ?? "novo"} className="flex h-full flex-col" onSubmit={handleSubmit}>
                <SheetHeader>
                  <SheetTitle>{editando ? "Editar equipe" : "Nova equipe"}</SheetTitle>
                  <SheetDescription>Cadastre uma equipe para uma empresa do grupo.</SheetDescription>
                </SheetHeader>
                <div className="flex flex-1 flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="name">Nome da equipe</Label>
                    <Input id="name" name="name" required placeholder="Ex.: Equipe UTI" defaultValue={editando?.name} />
                  </div>
                </div>
                <SheetFooter>
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={salvando || !empresaId}>{salvando ? "Salvando…" : editando ? "Salvar alterações" : "Criar equipe"}</Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
        }
      />

      <Card>
        {equipes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Users className="h-8 w-8 text-ink-soft" />
            <p className="font-medium text-ink">Nenhuma equipe cadastrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">Equipe</th>
                  <th className="px-4 py-3 font-medium">Fisioterapeutas</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {equipes.map((eq) => (
                  <tr key={eq.id} className="border-b border-line last:border-0 hover:bg-surface-sunken/60">
                    <td className="px-4 py-3 font-medium text-ink">{eq.name}</td>
                    <td className="px-4 py-3 text-ink-soft">{fisioterapeutas.filter((f) => f.team_id === eq.id).length}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label={`Editar ${eq.name}`} onClick={() => abrirEdicao(eq)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <DeleteButton itemLabel={eq.name} onConfirm={() => repository.teams.remove(eq.id)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
