import { useMemo, useState, type FormEvent } from "react";
import { Search, Plus, Pencil, HeartHandshake } from "lucide-react";
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
import { useHealthInsurances, useContracts, repository } from "@/data/repository";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import { useAppStore } from "@/store/app-store";
import type { HealthInsurance } from "@/types/domain";

export default function Convenios() {
  const convenios = useHealthInsurances();
  const contratos = useContracts();
  const empresaId = useAppStore((s) => s.activeCompanyId);
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState<HealthInsurance | null>(null);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return convenios;
    return convenios.filter((c) => c.name.toLowerCase().includes(termo));
  }, [busca, convenios]);

  function abrirNovo() {
    setEditando(null);
    setOpen(true);
  }

  function abrirEdicao(convenio: HealthInsurance) {
    setEditando(convenio);
    setOpen(true);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const dados = {
      name: String(form.get("name") ?? ""),
      ans_code: String(form.get("ans_code") ?? "") || null,
      company_id: empresaId,
    };
    setSalvando(true);
    try {
      if (editando) {
        await repository.healthInsurances.update(editando.id, dados);
        notificarSucesso("Convênio atualizado(a).");
      } else {
        await repository.healthInsurances.create(dados);
        notificarSucesso("Convênio criado(a).");
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
        title="Convênios"
        description="Convênios e operadoras, com tabelas de procedimentos e regras de faturamento por contrato."
        actions={
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="sm" onClick={abrirNovo}>
                <Plus className="h-4 w-4" /> Novo convênio
              </Button>
            </SheetTrigger>
            <SheetContent>
              <form key={editando?.id ?? "novo"} className="flex h-full flex-col" onSubmit={handleSubmit}>
                <SheetHeader>
                  <SheetTitle>{editando ? "Editar convênio" : "Novo convênio"}</SheetTitle>
                  <SheetDescription>Cadastre um convênio/operadora para uma empresa do grupo.</SheetDescription>
                </SheetHeader>
                <div className="flex flex-1 flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="name">Nome do convênio</Label>
                    <Input id="name" name="name" required placeholder="Ex.: Unimed" defaultValue={editando?.name} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ans_code">Código ANS</Label>
                    <Input id="ans_code" name="ans_code" placeholder="Ex.: 326305" defaultValue={editando?.ans_code ?? ""} />
                  </div>
                </div>
                <SheetFooter>
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={salvando || !empresaId}>
                    {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Criar convênio"}
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
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar convênio…" className="pl-9" />
          </div>
          <p className="text-sm text-ink-soft">{filtrados.length} de {convenios.length} convênios</p>
        </div>

        {filtrados.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <HeartHandshake className="h-8 w-8 text-ink-soft" />
            <p className="font-medium text-ink">Nenhum convênio encontrado</p>
            <p className="text-sm text-ink-soft">Ajuste os termos da busca ou cadastre um novo convênio.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">Convênio</th>
                  <th className="px-4 py-3 font-medium">Código ANS</th>
                  <th className="px-4 py-3 font-medium">Contratos</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr key={c.id} className="border-b border-line last:border-0 hover:bg-surface-sunken/60">
                    <td className="px-4 py-3 font-medium text-ink">{c.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-soft">{c.ans_code ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-soft">{contratos.filter((ct) => ct.health_insurance_id === c.id).length}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label={`Editar ${c.name}`} onClick={() => abrirEdicao(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <DeleteButton itemLabel={c.name} onConfirm={() => repository.healthInsurances.remove(c.id)} />
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
