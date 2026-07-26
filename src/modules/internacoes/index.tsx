import { useMemo, useState, type FormEvent } from "react";
import { Search, Plus, BedDouble, LogOut } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
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
import {
  useAdmissions,
  usePatients,
  useHospitals,
  useUnits,
  useBeds,
  useHealthInsurances,
  repository,
} from "@/data/repository";
import { notificarErro, notificarSucesso } from "@/store/toast-store";

type StatusInternacao = "internado" | "alta";

const statusConfig: Record<StatusInternacao, { label: string; variant: NonNullable<BadgeProps["variant"]> }> = {
  internado: { label: "Internado", variant: "clinical" },
  alta: { label: "Alta", variant: "neutral" },
};

function formatarData(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export default function Internacoes() {
  const internacoes = useAdmissions();
  const pacientes = usePatients();
  const hospitais = useHospitals();
  const unidades = useUnits();
  const leitos = useBeds();
  const convenios = useHealthInsurances();

  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [pacienteId, setPacienteId] = useState(pacientes[0]?.id ?? "");
  const [unidadeId, setUnidadeId] = useState(unidades[0]?.id ?? "");
  const [leitoId, setLeitoId] = useState("");
  const [convenioId, setConvenioId] = useState(convenios[0]?.id ?? "");

  const leitosLivresDaUnidade = leitos.filter((l) => l.unit_id === unidadeId && l.status === "livre");

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return internacoes;
    return internacoes.filter((i) => {
      const paciente = pacientes.find((p) => p.id === i.patient_id)?.full_name ?? "";
      return paciente.toLowerCase().includes(termo) || i.id.toLowerCase().includes(termo);
    });
  }, [busca, internacoes, pacientes]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const paciente = pacientes.find((p) => p.id === pacienteId);
    const unidade = unidades.find((u) => u.id === unidadeId);
    if (!paciente || !unidade) return;
    setSalvando(true);
    try {
      await repository.admissions.create({
        patient_id: pacienteId,
        hospital_id: unidade.hospital_id,
        unit_id: unidadeId,
        bed_id: leitoId || null,
        health_insurance_id: convenioId || null,
        admission_date: String(form.get("admission_date") ?? ""),
        company_id: paciente.company_id,
      });
      notificarSucesso("Internação registrada.");
      setOpen(false);
      setLeitoId("");
      e.currentTarget.reset();
    } catch (erro) {
      notificarErro("Não foi possível registrar a internação", erro);
    } finally {
      setSalvando(false);
    }
  }

  async function handleAltaComFeedback(id: string) {
    try {
      await handleAlta(id);
      notificarSucesso("Alta registrada. O leito foi liberado para higienização.");
    } catch (erro) {
      notificarErro("Não foi possível registrar a alta", erro);
    }
  }

  async function handleAlta(id: string) {
    await repository.admissions.discharge(id, new Date().toISOString().slice(0, 10));
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Internações"
        description="Internações ativas e encerradas, com leito, hospital, convênio e equipe responsável."
        actions={
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4" /> Nova internação
              </Button>
            </SheetTrigger>
            <SheetContent>
              <form className="flex h-full flex-col" onSubmit={handleSubmit}>
                <SheetHeader>
                  <SheetTitle>Nova internação</SheetTitle>
                  <SheetDescription>Ao escolher um leito livre, ele passa automaticamente para ocupado.</SheetDescription>
                </SheetHeader>
                <div className="flex flex-1 flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label>Paciente</Label>
                    <Select value={pacienteId} onValueChange={setPacienteId}>
                      <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
                      <SelectContent>
                        {pacientes.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Unidade</Label>
                    <Select value={unidadeId} onValueChange={(v) => { setUnidadeId(v); setLeitoId(""); }}>
                      <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                      <SelectContent>
                        {unidades.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Leito (opcional)</Label>
                    <Select value={leitoId} onValueChange={setLeitoId}>
                      <SelectTrigger><SelectValue placeholder="Selecione um leito livre" /></SelectTrigger>
                      <SelectContent>
                        {leitosLivresDaUnidade.length === 0 ? (
                          <SelectItem value="none" disabled>Nenhum leito livre nesta unidade</SelectItem>
                        ) : (
                          leitosLivresDaUnidade.map((l) => (
                            <SelectItem key={l.id} value={l.id}>{l.code}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Convênio</Label>
                    <Select value={convenioId} onValueChange={setConvenioId}>
                      <SelectTrigger><SelectValue placeholder="Selecione o convênio" /></SelectTrigger>
                      <SelectContent>
                        {convenios.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="admission_date">Data de entrada</Label>
                    <Input id="admission_date" name="admission_date" type="date" required />
                  </div>
                </div>
                <SheetFooter>
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={salvando || !pacienteId || !unidadeId}>
                    {salvando ? "Salvando…" : "Registrar internação"}
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
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por paciente ou ID…" className="pl-9" />
          </div>
          <p className="text-sm text-ink-soft">{filtradas.length} de {internacoes.length} internações</p>
        </div>

        {filtradas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <BedDouble className="h-8 w-8 text-ink-soft" />
            <p className="font-medium text-ink">Nenhuma internação encontrada</p>
            <p className="text-sm text-ink-soft">Ajuste os termos da busca ou registre uma nova internação.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">Paciente</th>
                  <th className="px-4 py-3 font-medium">Hospital / Unidade</th>
                  <th className="px-4 py-3 font-medium">Leito</th>
                  <th className="px-4 py-3 font-medium">Convênio</th>
                  <th className="px-4 py-3 font-medium">Entrada</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filtradas.map((i) => (
                  <tr key={i.id} className="border-b border-line last:border-0 hover:bg-surface-sunken/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{pacientes.find((p) => p.id === i.patient_id)?.full_name ?? "—"}</p>
                      <p className="font-mono text-xs text-ink-soft">{i.id.slice(0, 8)}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {hospitais.find((h) => h.id === i.hospital_id)?.name ?? "—"}
                      <span className="block text-xs">{unidades.find((u) => u.id === i.unit_id)?.name ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-ink-soft">{leitos.find((l) => l.id === i.bed_id)?.code ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-soft">{convenios.find((c) => c.id === i.health_insurance_id)?.name ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-soft">{formatarData(i.admission_date)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusConfig[i.status as StatusInternacao]?.variant ?? "neutral"}>
                        {statusConfig[i.status as StatusInternacao]?.label ?? i.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {i.status === "internado" && (
                        <Button variant="ghost" size="sm" onClick={() => handleAltaComFeedback(i.id)}>
                          <LogOut className="h-3.5 w-3.5" /> Dar alta
                        </Button>
                      )}
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
