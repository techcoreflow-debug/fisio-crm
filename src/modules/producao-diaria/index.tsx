import { useMemo, useState, type FormEvent } from "react";
import { Search, Plus, ClipboardList } from "lucide-react";
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
import {
  useDailyProduction,
  useAdmissions,
  usePatients,
  usePhysiotherapists,
  useProcedures,
  repository,
} from "@/data/repository";
import { notificarErro, notificarSucesso } from "@/store/toast-store";

export default function ProducaoDiaria() {
  const producao = useDailyProduction();
  const internacoes = useAdmissions();
  const pacientes = usePatients();
  const fisioterapeutas = usePhysiotherapists();
  const procedimentos = useProcedures();

  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [internacaoId, setInternacaoId] = useState(internacoes[0]?.id ?? "");
  const [fisioId, setFisioId] = useState(fisioterapeutas[0]?.id ?? "");
  const [procedimentoId, setProcedimentoId] = useState(procedimentos[0]?.id ?? "");

  function nomePaciente(admissionId: string | null) {
    const internacao = internacoes.find((i) => i.id === admissionId);
    return pacientes.find((p) => p.id === internacao?.patient_id)?.full_name ?? "—";
  }

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return producao;
    return producao.filter((p) => {
      const fisio = fisioterapeutas.find((f) => f.id === p.physiotherapist_id)?.full_name ?? "";
      return nomePaciente(p.admission_id).toLowerCase().includes(termo) || fisio.toLowerCase().includes(termo);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, producao, fisioterapeutas]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const internacao = internacoes.find((i) => i.id === internacaoId);
    if (!internacao) return;
    setSalvando(true);
    try {
      await repository.dailyProduction.create({
        admission_id: internacaoId,
        physiotherapist_id: fisioId,
        procedure_id: procedimentoId,
        production_date: String(form.get("production_date") ?? ""),
        source: "manual",
        company_id: internacao.company_id,
      });
      notificarSucesso("Produção lançada. Fica pendente de conferência.");
      setOpen(false);
      e.currentTarget.reset();
    } catch (erro) {
      notificarErro("Não foi possível lançar a produção", erro);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Produção Diária"
        description="Lançamento e conferência da produção assistencial diária, manual ou importada do Tasy."
        actions={
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4" /> Lançar produção
              </Button>
            </SheetTrigger>
            <SheetContent>
              <form className="flex h-full flex-col" onSubmit={handleSubmit}>
                <SheetHeader>
                  <SheetTitle>Lançar produção</SheetTitle>
                  <SheetDescription>Lançamento manual — fica marcado como pendente de conferência.</SheetDescription>
                </SheetHeader>
                <div className="flex flex-1 flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label>Internação</Label>
                    <Select value={internacaoId} onValueChange={setInternacaoId}>
                      <SelectTrigger><SelectValue placeholder="Selecione a internação" /></SelectTrigger>
                      <SelectContent>
                        {internacoes.map((i) => (
                          <SelectItem key={i.id} value={i.id}>{nomePaciente(i.id)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
                    <Label>Procedimento</Label>
                    <Select value={procedimentoId} onValueChange={setProcedimentoId}>
                      <SelectTrigger><SelectValue placeholder="Selecione o procedimento" /></SelectTrigger>
                      <SelectContent>
                        {procedimentos.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="production_date">Data</Label>
                    <Input id="production_date" name="production_date" type="date" required />
                  </div>
                </div>
                <SheetFooter>
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={salvando || !internacaoId || !fisioId || !procedimentoId}>
                    {salvando ? "Salvando…" : "Lançar produção"}
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
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por paciente ou fisioterapeuta…" className="pl-9" />
          </div>
          <p className="text-sm text-ink-soft">{filtrados.length} de {producao.length} lançamentos</p>
        </div>

        {filtrados.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <ClipboardList className="h-8 w-8 text-ink-soft" />
            <p className="font-medium text-ink">Nenhum lançamento encontrado</p>
            <p className="text-sm text-ink-soft">Ajuste os termos da busca ou lance uma nova produção.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Paciente</th>
                  <th className="px-4 py-3 font-medium">Procedimento</th>
                  <th className="px-4 py-3 font-medium">Fisioterapeuta</th>
                  <th className="px-4 py-3 font-medium">Origem</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0 hover:bg-surface-sunken/60">
                    <td className="px-4 py-3 font-mono text-xs text-ink-soft">{p.production_date}</td>
                    <td className="px-4 py-3 font-medium text-ink">{nomePaciente(p.admission_id)}</td>
                    <td className="px-4 py-3 text-ink-soft">{procedimentos.find((pr) => pr.id === p.procedure_id)?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-soft">{fisioterapeutas.find((f) => f.id === p.physiotherapist_id)?.full_name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={p.source === "tasy" ? "clinical" : "neutral"}>
                        {p.source === "tasy" ? "Tasy" : "Manual"}
                      </Badge>
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
