import { useMemo, useState, type FormEvent } from "react";
import { Search, Plus, Pencil, MapPin } from "lucide-react";
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
import { useUnits, useHospitals, useClinics, repository } from "@/data/repository";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import type { Unit } from "@/types/domain";

export default function Unidades() {
  const unidades = useUnits();
  const hospitais = useHospitals();
  const clinicas = useClinics();
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [vinculoTipo, setVinculoTipo] = useState<"hospital" | "clinica">("hospital");
  const [vinculoId, setVinculoId] = useState("");
  const [editando, setEditando] = useState<Unit | null>(null);

  const opcoesVinculo = vinculoTipo === "hospital" ? hospitais : clinicas;

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return unidades;
    return unidades.filter((u) => u.name.toLowerCase().includes(termo));
  }, [busca, unidades]);

  function nomeVinculo(u: (typeof unidades)[number]) {
    if (u.hospital_id) return { nome: hospitais.find((h) => h.id === u.hospital_id)?.name ?? "—", tipo: "Hospital" };
    if (u.clinic_id) return { nome: clinicas.find((c) => c.id === u.clinic_id)?.name ?? "—", tipo: "Clínica" };
    return { nome: "—", tipo: "—" };
  }

  function abrirNova() {
    setEditando(null);
    setVinculoTipo("hospital");
    setVinculoId("");
    setOpen(true);
  }

  function abrirEdicao(unidade: Unit) {
    setEditando(unidade);
    if (unidade.hospital_id) {
      setVinculoTipo("hospital");
      setVinculoId(unidade.hospital_id);
    } else if (unidade.clinic_id) {
      setVinculoTipo("clinica");
      setVinculoId(unidade.clinic_id);
    }
    setOpen(true);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const vinculo = opcoesVinculo.find((v) => v.id === vinculoId);
    if (!vinculo) return;
    const dados = {
      name: String(form.get("name") ?? ""),
      hospital_id: vinculoTipo === "hospital" ? vinculoId : null,
      clinic_id: vinculoTipo === "clinica" ? vinculoId : null,
      company_id: vinculo.company_id,
    };
    setSalvando(true);
    try {
      if (editando) {
        await repository.units.update(editando.id, dados);
        notificarSucesso("Unidade atualizado(a).");
      } else {
        await repository.units.create(dados);
        notificarSucesso("Unidade criado(a).");
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
        title="Unidades"
        description="Alas/setores dentro de cada hospital onde a equipe de fisioterapia atua (ex.: UTI, Enfermaria). Também aceita vínculo com clínica, quando a empresa atender uma."
        actions={
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="sm" onClick={abrirNova}>
                <Plus className="h-4 w-4" /> Nova unidade
              </Button>
            </SheetTrigger>
            <SheetContent>
              <form key={editando?.id ?? "nova"} className="flex h-full flex-col" onSubmit={handleSubmit}>
                <SheetHeader>
                  <SheetTitle>{editando ? "Editar unidade" : "Nova unidade"}</SheetTitle>
                  <SheetDescription>Vincule a unidade a um hospital ou a uma clínica.</SheetDescription>
                </SheetHeader>
                <div className="flex flex-1 flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label>Vincular a</Label>
                    <div className="flex gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant={vinculoTipo === "hospital" ? "primary" : "secondary"}
                        onClick={() => { setVinculoTipo("hospital"); setVinculoId(""); }}
                      >
                        Hospital
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={vinculoTipo === "clinica" ? "primary" : "secondary"}
                        onClick={() => { setVinculoTipo("clinica"); setVinculoId(""); }}
                      >
                        Clínica
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>{vinculoTipo === "hospital" ? "Hospital" : "Clínica"}</Label>
                    <Select value={vinculoId} onValueChange={setVinculoId}>
                      <SelectTrigger>
                        <SelectValue placeholder={`Selecione a ${vinculoTipo === "hospital" ? "hospital" : "clínica"}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {opcoesVinculo.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="name">Nome da unidade</Label>
                    <Input id="name" name="name" required placeholder="Ex.: UTI Adulto" defaultValue={editando?.name} />
                  </div>
                </div>
                <SheetFooter>
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={salvando || !vinculoId}>
                    {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Criar unidade"}
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
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar unidade…" className="pl-9" />
          </div>
          <p className="text-sm text-ink-soft">{filtradas.length} de {unidades.length} unidades</p>
        </div>

        {filtradas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <MapPin className="h-8 w-8 text-ink-soft" />
            <p className="font-medium text-ink">Nenhuma unidade encontrada</p>
            <p className="text-sm text-ink-soft">Ajuste os termos da busca ou cadastre uma nova unidade.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">Unidade</th>
                  <th className="px-4 py-3 font-medium">Vinculada a</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filtradas.map((u) => {
                  const v = nomeVinculo(u);
                  return (
                    <tr key={u.id} className="border-b border-line last:border-0 hover:bg-surface-sunken/60">
                      <td className="px-4 py-3 font-medium text-ink">{u.name}</td>
                      <td className="px-4 py-3 text-ink-soft">
                        {v.nome}
                        <Badge variant="neutral" className="ml-2">{v.tipo}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" aria-label={`Editar ${u.name}`} onClick={() => abrirEdicao(u)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <DeleteButton itemLabel={u.name} onConfirm={() => repository.units.remove(u.id)} />
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
