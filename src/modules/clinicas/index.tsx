import { useMemo, useState, type FormEvent } from "react";
import { Search, Plus, Pencil, Landmark } from "lucide-react";
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
import { AddressFields, enderecoVazio, type EnderecoValue } from "@/components/shared/address-fields";
import { DeleteButton } from "@/components/shared/delete-button";
import { useClinics, useUnits, repository } from "@/data/repository";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import { useAppStore } from "@/store/app-store";
import type { Clinic } from "@/types/domain";

export default function Clinicas() {
  const clinicas = useClinics();
  const unidades = useUnits();
  const empresaId = useAppStore((s) => s.activeCompanyId);
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [endereco, setEndereco] = useState<EnderecoValue>(enderecoVazio);
  const [editando, setEditando] = useState<Clinic | null>(null);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return clinicas;
    return clinicas.filter((c) => c.name.toLowerCase().includes(termo) || (c.city ?? "").toLowerCase().includes(termo));
  }, [busca, clinicas]);

  function abrirNova() {
    setEditando(null);
    setEndereco(enderecoVazio);
    setOpen(true);
  }

  function abrirEdicao(clinica: Clinic) {
    setEditando(clinica);
    setEndereco({
      cep: clinica.cep ?? "",
      street: clinica.street ?? "",
      neighborhood: clinica.neighborhood ?? "",
      city: clinica.city ?? "",
      state: clinica.state ?? "",
    });
    setOpen(true);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const dados = {
      name: String(form.get("name") ?? ""),
      cep: endereco.cep || null,
      street: endereco.street || null,
      neighborhood: endereco.neighborhood || null,
      city: endereco.city || null,
      state: endereco.state || null,
      company_id: empresaId,
    };
    setSalvando(true);
    try {
      if (editando) {
        await repository.clinics.update(editando.id, dados);
        notificarSucesso("Clínica atualizado(a).");
      } else {
        await repository.clinics.create(dados);
        notificarSucesso("Clínica criado(a).");
      }
      setOpen(false);
      setEndereco(enderecoVazio);
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
        title="Clínicas"
        description="Clínicas próprias ou parceiras vinculadas às empresas do grupo."
        actions={
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="sm" onClick={abrirNova}>
                <Plus className="h-4 w-4" /> Nova clínica
              </Button>
            </SheetTrigger>
            <SheetContent>
              <form key={editando?.id ?? "nova"} className="flex h-full flex-col" onSubmit={handleSubmit}>
                <SheetHeader>
                  <SheetTitle>{editando ? "Editar clínica" : "Nova clínica"}</SheetTitle>
                  <SheetDescription>Vincule a clínica a uma das empresas do grupo.</SheetDescription>
                </SheetHeader>
                <div className="flex flex-1 flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="name">Nome da clínica</Label>
                    <Input id="name" name="name" required placeholder="Ex.: FisioVida Centro" defaultValue={editando?.name} />
                  </div>
                  <AddressFields value={endereco} onChange={setEndereco} />
                </div>
                <SheetFooter>
                  <Button type="button" variant="secondary" onClick={() => { setOpen(false); setEndereco(enderecoVazio); }}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={salvando || !empresaId}>
                    {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Criar clínica"}
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
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou cidade…" className="pl-9" />
          </div>
          <p className="text-sm text-ink-soft">{filtradas.length} de {clinicas.length} clínicas</p>
        </div>

        {filtradas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Landmark className="h-8 w-8 text-ink-soft" />
            <p className="font-medium text-ink">Nenhuma clínica encontrada</p>
            <p className="text-sm text-ink-soft">Ajuste os termos da busca ou cadastre uma nova clínica.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">Clínica</th>
                  <th className="px-4 py-3 font-medium">Cidade</th>
                  <th className="px-4 py-3 font-medium">Unidades</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filtradas.map((c) => (
                  <tr key={c.id} className="border-b border-line last:border-0 hover:bg-surface-sunken/60">
                    <td className="px-4 py-3 font-medium text-ink">{c.name}</td>
                    <td className="px-4 py-3 text-ink-soft">{c.city ? `${c.city}, ${c.state}` : "—"}</td>
                    <td className="px-4 py-3 text-ink-soft">{unidades.filter((u) => u.clinic_id === c.id).length}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label={`Editar ${c.name}`} onClick={() => abrirEdicao(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <DeleteButton itemLabel={c.name} onConfirm={() => repository.clinics.remove(c.id)} />
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
