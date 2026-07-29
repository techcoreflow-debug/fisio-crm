import { useMemo, useState, type FormEvent } from "react";
import { Search, Plus, Pencil, DoorClosed } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
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
import { useRooms, useUnits, useHospitals, useBeds, repository } from "@/data/repository";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import type { Room } from "@/types/domain";

export default function Quartos() {
  const quartos = useRooms();
  const unidades = useUnits();
  const hospitais = useHospitals();
  const leitos = useBeds();

  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [unidadeId, setUnidadeId] = useState(unidades[0]?.id ?? "");
  const [editando, setEditando] = useState<Room | null>(null);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return quartos;
    return quartos.filter((q) => q.code.toLowerCase().includes(termo));
  }, [busca, quartos]);

  function nomeUnidade(unitId: string) {
    const unidade = unidades.find((u) => u.id === unitId);
    const hospital = hospitais.find((h) => h.id === unidade?.hospital_id);
    return { unidade: unidade?.name ?? "—", hospital: hospital?.name ?? "—" };
  }

  function abrirNovo() {
    setEditando(null);
    setUnidadeId(unidades[0]?.id ?? "");
    setOpen(true);
  }

  function abrirEdicao(quarto: Room) {
    setEditando(quarto);
    setUnidadeId(quarto.unit_id);
    setOpen(true);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const unidade = unidades.find((u) => u.id === unidadeId);
    if (!unidade) {
      notificarErro("Não foi possível salvar", "Selecione uma ala/unidade válida.");
      return;
    }
    const dados = {
      code: String(form.get("code") ?? ""),
      unit_id: unidadeId,
      company_id: unidade.company_id,
    };
    setSalvando(true);
    try {
      if (editando) {
        await repository.rooms.update(editando.id, dados);
        notificarSucesso("Quarto atualizado.");
      } else {
        await repository.rooms.create(dados);
        notificarSucesso("Quarto criado.");
      }
      setOpen(false);
      setEditando(null);
    } catch (erro) {
      notificarErro(editando ? "Não foi possível salvar as alterações" : "Não foi possível criar o quarto", erro);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Quartos"
        description="Quartos dentro de cada ala/unidade do hospital. Um quarto pode ter mais de um leito (enfermaria compartilhada) ou apenas um (apartamento)."
        actions={
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="sm" onClick={abrirNovo}>
                <Plus className="h-4 w-4" /> Novo quarto
              </Button>
            </SheetTrigger>
            <SheetContent>
              <form key={editando?.id ?? "novo"} className="flex h-full flex-col" onSubmit={handleSubmit}>
                <SheetHeader>
                  <SheetTitle>{editando ? "Editar quarto" : "Novo quarto"}</SheetTitle>
                  <SheetDescription>Vincule o quarto a uma ala/unidade de um hospital.</SheetDescription>
                </SheetHeader>
                <div className="flex flex-1 flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label>Ala / Unidade</Label>
                    <Select value={unidadeId} onValueChange={setUnidadeId}>
                      <SelectTrigger><SelectValue placeholder="Selecione a ala/unidade" /></SelectTrigger>
                      <SelectContent>
                        {unidades.map((u) => {
                          const h = hospitais.find((hh) => hh.id === u.hospital_id);
                          return (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name}{h ? ` · ${h.name}` : ""}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="code">Identificação do quarto</Label>
                    <Input id="code" name="code" required placeholder="Ex.: Quarto 203 ou Box 4" defaultValue={editando?.code} />
                  </div>
                </div>
                <SheetFooter>
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={salvando || !unidadeId}>
                    {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Criar quarto"}
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
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar quarto…" className="pl-9" />
          </div>
          <p className="text-sm text-ink-soft">{filtrados.length} de {quartos.length} quartos</p>
        </div>

        {filtrados.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <DoorClosed className="h-8 w-8 text-ink-soft" />
            <p className="font-medium text-ink">Nenhum quarto encontrado</p>
            <p className="text-sm text-ink-soft">Ajuste os termos da busca ou cadastre um novo quarto.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">Quarto</th>
                  <th className="px-4 py-3 font-medium">Ala / Hospital</th>
                  <th className="px-4 py-3 font-medium">Leitos</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((q) => {
                  const loc = nomeUnidade(q.unit_id);
                  const qtdLeitos = leitos.filter((l) => l.room_id === q.id).length;
                  return (
                    <tr key={q.id} className="border-b border-line last:border-0 hover:bg-surface-sunken/60">
                      <td className="px-4 py-3 font-medium text-ink">{q.code}</td>
                      <td className="px-4 py-3 text-ink-soft">
                        {loc.unidade}
                        <Badge variant="neutral" className="ml-2">{loc.hospital}</Badge>
                      </td>
                      <td className="px-4 py-3 text-ink-soft">
                        {qtdLeitos === 0 ? "Nenhum leito" : `${qtdLeitos} leito${qtdLeitos === 1 ? "" : "s"}`}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" aria-label={`Editar ${q.code}`} onClick={() => abrirEdicao(q)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <DeleteButton itemLabel={q.code} onConfirm={() => repository.rooms.remove(q.id)} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
