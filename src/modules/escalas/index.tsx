import { useMemo, useState, type FormEvent } from "react";
import { dataParaIsoLocal } from "@/lib/data-local";
import { Plus } from "lucide-react";
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
import { useShifts, usePhysiotherapists, useUnits, repository } from "@/data/repository";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import type { ShiftPeriod } from "@/types/domain";

const periodoLabel: Record<ShiftPeriod, string> = { manha: "Manhã", tarde: "Tarde", noite: "Noite" };
const periodoStyle: Record<ShiftPeriod, string> = {
  manha: "bg-clinical-50 text-clinical-700",
  tarde: "bg-recovery-100 text-recovery-600",
  noite: "bg-ink-soft/10 text-ink-soft",
};

function proximaSegunda() {
  const hoje = new Date();
  const diaSemana = hoje.getDay();
  const diff = diaSemana === 0 ? -6 : 1 - diaSemana;
  const segunda = new Date(hoje);
  segunda.setDate(hoje.getDate() + diff);
  return segunda;
}

export default function Escalas() {
  const turnos = useShifts();
  const fisioterapeutas = usePhysiotherapists();
  const unidades = useUnits();

  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [fisioId, setFisioId] = useState("");
  const [unidadeId, setUnidadeId] = useState(unidades[0]?.id ?? "");
  const [periodo, setPeriodo] = useState<ShiftPeriod>("manha");

  const dias = useMemo(() => {
    const inicio = proximaSegunda();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(inicio);
      d.setDate(inicio.getDate() + i);
      return d;
    });
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const fisio = fisioterapeutas.find((f) => f.id === fisioId);
    if (!fisio) return;
    setSalvando(true);
    try {
      await repository.shifts.create({
        physiotherapist_id: fisioId,
        unit_id: unidadeId || null,
        shift_date: String(form.get("shift_date") ?? ""),
        period: periodo,
        company_id: fisio.company_id,
      });
      notificarSucesso("Turno escalado.");
      setOpen(false);
      e.currentTarget.reset();
    } catch (erro) {
      notificarErro("Não foi possível escalar o turno", erro);
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluirTurno(id: string) {
    if (!window.confirm("Remover este turno da escala?")) return;
    try {
      await repository.shifts.remove(id);
      notificarSucesso("Turno removido da escala.");
    } catch (erro) {
      notificarErro("Não foi possível remover o turno", erro);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Escalas"
        description="Escalas de trabalho dos fisioterapeutas por unidade e turno."
        actions={
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4" /> Novo turno
              </Button>
            </SheetTrigger>
            <SheetContent>
              <form className="flex h-full flex-col" onSubmit={handleSubmit}>
                <SheetHeader>
                  <SheetTitle>Novo turno</SheetTitle>
                  <SheetDescription>Escale um fisioterapeuta em uma unidade, data e período.</SheetDescription>
                </SheetHeader>
                <div className="flex flex-1 flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label>Fisioterapeuta</Label>
                    <Select value={fisioId} onValueChange={setFisioId}>
                      <SelectTrigger><SelectValue placeholder="Selecione o fisioterapeuta" /></SelectTrigger>
                      <SelectContent>
                        {fisioterapeutas.map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Unidade</Label>
                    <Select value={unidadeId} onValueChange={setUnidadeId}>
                      <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                      <SelectContent>
                        {unidades.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="shift_date">Data</Label>
                    <Input id="shift_date" name="shift_date" type="date" required />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Período</Label>
                    <div className="flex gap-1.5">
                      {(["manha", "tarde", "noite"] as ShiftPeriod[]).map((p) => (
                        <Button
                          key={p}
                          type="button"
                          size="sm"
                          variant={periodo === p ? "primary" : "secondary"}
                          onClick={() => setPeriodo(p)}
                        >
                          {periodoLabel[p]}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
                <SheetFooter>
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={salvando || !fisioId}>
                    {salvando ? "Salvando…" : "Escalar turno"}
                  </Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
        }
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 font-medium">Fisioterapeuta</th>
                {dias.map((d) => (
                  <th key={d.toISOString()} className="px-2 py-3 text-center font-medium">
                    {d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fisioterapeutas.map((f) => (
                <tr key={f.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{f.full_name}</p>
                  </td>
                  {dias.map((d) => {
                    const dataIso = dataParaIsoLocal(d);
                    const turnoDoDia = turnos.find((t) => t.physiotherapist_id === f.id && t.shift_date === dataIso);
                    return (
                      <td key={dataIso} className="px-2 py-3 text-center">
                        {turnoDoDia ? (
                          <button
                            type="button"
                            onClick={() => handleExcluirTurno(turnoDoDia.id)}
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold transition-opacity hover:opacity-70 ${periodoStyle[turnoDoDia.period]}`}
                            title={`${periodoLabel[turnoDoDia.period]} · ${unidades.find((u) => u.id === turnoDoDia.unit_id)?.name ?? ""} — clique para remover`}
                          >
                            {turnoDoDia.period[0].toUpperCase()}
                          </button>
                        ) : (
                          <span className="text-xs text-ink-soft/50">folga</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-4 text-xs text-ink-soft">
        <span className="flex items-center gap-1.5"><Badge variant="clinical">M</Badge> Manhã</span>
        <span className="flex items-center gap-1.5"><Badge variant="recovery">T</Badge> Tarde</span>
        <span className="flex items-center gap-1.5"><Badge variant="neutral">N</Badge> Noite</span>
      </div>
    </div>
  );
}
