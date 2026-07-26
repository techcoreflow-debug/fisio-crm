import { useState, type FormEvent } from "react";
import { Plus, Pencil, Wallet } from "lucide-react";
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
import { useCostCenters, useContracts, repository } from "@/data/repository";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import { useAppStore } from "@/store/app-store";
import type { CostCenter } from "@/types/domain";

export default function CentrosDeCusto() {
  const centros = useCostCenters();
  const contratos = useContracts();
  const empresaId = useAppStore((s) => s.activeCompanyId);
  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState<CostCenter | null>(null);

  function abrirNovo() {
    setEditando(null);
    setOpen(true);
  }

  function abrirEdicao(centro: CostCenter) {
    setEditando(centro);
    setOpen(true);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const dados = { name: String(form.get("name") ?? ""), company_id: empresaId };
    setSalvando(true);
    try {
      if (editando) {
        await repository.costCenters.update(editando.id, dados);
        notificarSucesso("Centro de custo atualizado(a).");
      } else {
        await repository.costCenters.create(dados);
        notificarSucesso("Centro de custo criado(a).");
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
        title="Centros de Custo"
        description="Centros de custo usados para organizar contratos e o financeiro por área."
        actions={
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="sm" onClick={abrirNovo}>
                <Plus className="h-4 w-4" /> Novo centro de custo
              </Button>
            </SheetTrigger>
            <SheetContent>
              <form key={editando?.id ?? "novo"} className="flex h-full flex-col" onSubmit={handleSubmit}>
                <SheetHeader>
                  <SheetTitle>{editando ? "Editar centro de custo" : "Novo centro de custo"}</SheetTitle>
                  <SheetDescription>Cadastre um centro de custo para uma empresa do grupo.</SheetDescription>
                </SheetHeader>
                <div className="flex flex-1 flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="name">Nome do centro de custo</Label>
                    <Input id="name" name="name" required placeholder="Ex.: Assistencial — UTI" defaultValue={editando?.name} />
                  </div>
                </div>
                <SheetFooter>
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={salvando || !empresaId}>{salvando ? "Salvando…" : editando ? "Salvar alterações" : "Criar centro de custo"}</Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
        }
      />

      <Card>
        {centros.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Wallet className="h-8 w-8 text-ink-soft" />
            <p className="font-medium text-ink">Nenhum centro de custo cadastrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">Centro de custo</th>
                  <th className="px-4 py-3 font-medium">Contratos</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {centros.map((c) => (
                  <tr key={c.id} className="border-b border-line last:border-0 hover:bg-surface-sunken/60">
                    <td className="px-4 py-3 font-medium text-ink">{c.name}</td>
                    <td className="px-4 py-3 text-ink-soft">{contratos.filter((ct) => ct.cost_center_id === c.id).length}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label={`Editar ${c.name}`} onClick={() => abrirEdicao(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <DeleteButton itemLabel={c.name} onConfirm={() => repository.costCenters.remove(c.id)} />
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
