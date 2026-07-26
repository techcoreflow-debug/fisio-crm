import { useMemo, useState, type FormEvent } from "react";
import { Search, Plus, Pencil, Hospital as HospitalIcon } from "lucide-react";
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
import { useHospitals, useUnits, repository } from "@/data/repository";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import { useAppStore } from "@/store/app-store";
import type { Hospital } from "@/types/domain";

export default function Hospitais() {
  const hospitais = useHospitals();
  const unidades = useUnits();
  const empresaId = useAppStore((s) => s.activeCompanyId);
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [endereco, setEndereco] = useState<EnderecoValue>(enderecoVazio);
  const [editando, setEditando] = useState<Hospital | null>(null);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return hospitais;
    return hospitais.filter(
      (h) => h.name.toLowerCase().includes(termo) || (h.city ?? "").toLowerCase().includes(termo)
    );
  }, [busca, hospitais]);

  function abrirNovo() {
    setEditando(null);
    setEndereco(enderecoVazio);
    setOpen(true);
  }

  function abrirEdicao(hospital: Hospital) {
    setEditando(hospital);
    setEndereco({
      cep: hospital.cep ?? "",
      street: hospital.street ?? "",
      neighborhood: hospital.neighborhood ?? "",
      city: hospital.city ?? "",
      state: hospital.state ?? "",
    });
    setOpen(true);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const dados = {
      name: String(form.get("name") ?? ""),
      cnpj: String(form.get("cnpj") ?? "") || null,
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
        await repository.hospitals.update(editando.id, dados);
        notificarSucesso("Hospital atualizado(a).");
      } else {
        await repository.hospitals.create(dados);
        notificarSucesso("Hospital criado(a).");
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
        title="Hospitais"
        description="Hospitais atendidos pelo grupo, com suas unidades, leitos e contratos vinculados."
        actions={
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="sm" onClick={abrirNovo}>
                <Plus className="h-4 w-4" /> Novo hospital
              </Button>
            </SheetTrigger>
            <SheetContent>
              <form key={editando?.id ?? "novo"} className="flex h-full flex-col" onSubmit={handleSubmit}>
                <SheetHeader>
                  <SheetTitle>{editando ? "Editar hospital" : "Novo hospital"}</SheetTitle>
                  <SheetDescription>Vincule o hospital a uma das empresas do grupo.</SheetDescription>
                </SheetHeader>
                <div className="flex flex-1 flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="name">Nome do hospital</Label>
                    <Input id="name" name="name" required placeholder="Ex.: Hospital São Rafael" defaultValue={editando?.name} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Input id="cnpj" name="cnpj" placeholder="00.000.000/0001-00" defaultValue={editando?.cnpj ?? ""} />
                  </div>
                  <AddressFields value={endereco} onChange={setEndereco} />
                </div>
                <SheetFooter>
                  <Button type="button" variant="secondary" onClick={() => { setOpen(false); setEndereco(enderecoVazio); }}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={salvando || !empresaId}>
                    {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Criar hospital"}
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
          <p className="text-sm text-ink-soft">{filtrados.length} de {hospitais.length} hospitais</p>
        </div>

        {filtrados.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <HospitalIcon className="h-8 w-8 text-ink-soft" />
            <p className="font-medium text-ink">Nenhum hospital encontrado</p>
            <p className="text-sm text-ink-soft">Ajuste os termos da busca ou cadastre um novo hospital.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">Hospital</th>
                  <th className="px-4 py-3 font-medium">Cidade</th>
                  <th className="px-4 py-3 font-medium">Unidades</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((h) => (
                  <tr key={h.id} className="border-b border-line last:border-0 hover:bg-surface-sunken/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{h.name}</p>
                      <p className="font-mono text-xs text-ink-soft">{h.cnpj ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{h.city ? `${h.city}, ${h.state}` : "—"}</td>
                    <td className="px-4 py-3 text-ink-soft">{unidades.filter((u) => u.hospital_id === h.id).length}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label={`Editar ${h.name}`} onClick={() => abrirEdicao(h)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <DeleteButton itemLabel={h.name} onConfirm={() => repository.hospitals.remove(h.id)} />
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
