import { useMemo, useState, type FormEvent } from "react";
import { NotebookPen, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
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
  useClinicalEvolutions,
  useAdmissions,
  usePatients,
  usePhysiotherapists,
  useHospitals,
  useUnits,
  repository,
} from "@/data/repository";
import { notificarErro, notificarSucesso } from "@/store/toast-store";

export default function EvolucaoClinica() {
  const evolucoes = useClinicalEvolutions();
  const internacoes = useAdmissions();
  const pacientes = usePatients();
  const fisioterapeutas = usePhysiotherapists();
  const hospitais = useHospitals();
  const unidades = useUnits();

  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");
  const internacoesAtivas = internacoes.filter((i) => i.status === "internado");
  const [internacaoId, setInternacaoId] = useState(internacoesAtivas[0]?.id ?? "");
  const [fisioId, setFisioId] = useState(fisioterapeutas[0]?.id ?? "");

  function nomePaciente(admissionId: string) {
    const internacao = internacoes.find((i) => i.id === admissionId);
    return pacientes.find((p) => p.id === internacao?.patient_id)?.full_name ?? "—";
  }

  function localAtendimento(admissionId: string) {
    const internacao = internacoes.find((i) => i.id === admissionId);
    const hospital = hospitais.find((h) => h.id === internacao?.hospital_id)?.name ?? "—";
    const unidade = unidades.find((u) => u.id === internacao?.unit_id)?.name ?? "—";
    return `${hospital} · ${unidade}`;
  }

  const opcoesInternacao = useMemo(
    () =>
      internacoesAtivas.map((i) => {
        const unidade = unidades.find((u) => u.id === i.unit_id);
        const hospital = hospitais.find((h) => h.id === i.hospital_id);
        return { value: i.id, label: nomePaciente(i.id), sublabel: `${hospital?.name ?? "—"} · ${unidade?.name ?? "—"}` };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [internacoesAtivas, unidades, hospitais, pacientes]
  );

  const opcoesFisioterapeuta = useMemo(
    () => fisioterapeutas.map((f) => ({ value: f.id, label: f.full_name })),
    [fisioterapeutas]
  );

  const semEvolucaoRecente = internacoesAtivas.filter(
    (i) => !evolucoes.some((e) => e.admission_id === i.id)
  );

  const evolucoesFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const ordenadas = [...evolucoes].sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (!termo) return ordenadas;
    return ordenadas.filter((e) => nomePaciente(e.admission_id).toLowerCase().includes(termo));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, evolucoes, internacoes, pacientes]);

  function abrirNova() {
    setInternacaoId(internacoesAtivas[0]?.id ?? "");
    setFisioId(fisioterapeutas[0]?.id ?? "");
    setOpen(true);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const internacao = internacoes.find((i) => i.id === internacaoId);
    if (!internacao) return;
    setSalvando(true);
    try {
      await repository.clinicalEvolutions.create({
        admission_id: internacaoId,
        physiotherapist_id: fisioId,
        content: String(form.get("content") ?? ""),
        company_id: internacao.company_id,
      });
      notificarSucesso("Evolução registrada.");
      setOpen(false);
      e.currentTarget.reset();
    } catch (erro) {
      notificarErro("Não foi possível registrar a evolução", erro);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Evolução Clínica"
        description="Registro da evolução clínica do paciente ao longo do tratamento fisioterapêutico."
        actions={
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="sm" onClick={abrirNova}>
                <Plus className="h-4 w-4" /> Nova evolução
              </Button>
            </SheetTrigger>
            <SheetContent>
              <form className="flex h-full flex-col" onSubmit={handleSubmit}>
                <SheetHeader>
                  <SheetTitle>Nova evolução</SheetTitle>
                  <SheetDescription>Registre a evolução clínica de uma internação ativa.</SheetDescription>
                </SheetHeader>
                <div className="flex flex-1 flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label>Paciente internado</Label>
                    <Combobox
                      value={internacaoId}
                      onValueChange={setInternacaoId}
                      options={opcoesInternacao}
                      placeholder="Buscar paciente internado…"
                      searchPlaceholder="Nome do paciente ou unidade…"
                      emptyText="Nenhuma internação ativa encontrada."
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Fisioterapeuta</Label>
                    <Combobox
                      value={fisioId}
                      onValueChange={setFisioId}
                      options={opcoesFisioterapeuta}
                      placeholder="Buscar fisioterapeuta…"
                      searchPlaceholder="Nome do fisioterapeuta…"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="content">Evolução</Label>
                    <textarea
                      id="content"
                      name="content"
                      required
                      rows={5}
                      className="rounded-md border border-line-strong bg-surface-raised px-3 py-2 text-sm text-ink shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-500/40"
                      placeholder="Descreva a evolução do paciente…"
                    />
                  </div>
                </div>
                <SheetFooter>
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={salvando || !internacaoId || !fisioId}>
                    {salvando ? "Salvando…" : "Registrar evolução"}
                  </Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
        }
      />

      {semEvolucaoRecente.length > 0 && (
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <NotebookPen className="h-5 w-5 shrink-0 text-critical-400" />
            <p className="text-sm font-medium text-ink">
              {semEvolucaoRecente.length} internação(ões) ativa(s) ainda sem nenhuma evolução registrada:{" "}
              {semEvolucaoRecente.map((i) => nomePaciente(i.id)).join(", ")}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por paciente…" className="pl-9" />
      </div>

      {evolucoesFiltradas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <NotebookPen className="h-8 w-8 text-ink-soft" />
            <p className="font-medium text-ink">Nenhuma evolução encontrada</p>
            <p className="text-sm text-ink-soft">Ajuste a busca ou registre uma nova evolução.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {evolucoesFiltradas.map((e) => (
            <Card key={e.id}>
              <CardContent className="pt-5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-clinical-50 text-clinical-600">
                    <NotebookPen className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-ink">{nomePaciente(e.admission_id)}</p>
                        <p className="text-xs text-ink-soft">{localAtendimento(e.admission_id)}</p>
                      </div>
                      <Badge variant="neutral">{new Date(e.created_at).toLocaleString("pt-BR")}</Badge>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-ink-soft">{e.content}</p>
                    <p className="mt-2 text-xs text-ink-soft">
                      Registrado por {fisioterapeutas.find((f) => f.id === e.physiotherapist_id)?.full_name ?? "—"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
