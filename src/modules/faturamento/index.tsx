import { useMemo, useState, type FormEvent } from "react";
import { Plus, Wallet, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { DeleteButton } from "@/components/shared/delete-button";
import {
  useBillingEntries,
  useAdmissions,
  usePatients,
  useHospitals,
  useProcedures,
  repository,
} from "@/data/repository";
import { useAppStore } from "@/store/app-store";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import { hojeLocalIso } from "@/lib/data-local";

export default function Faturamento() {
  const entradas = useBillingEntries();
  const internacoes = useAdmissions();
  const pacientes = usePatients();
  const hospitais = useHospitals();
  const procedimentos = useProcedures();
  const empresaId = useAppStore((s) => s.activeCompanyId);

  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [internacaoId, setInternacaoId] = useState("");
  const [procedimentoId, setProcedimentoId] = useState("");

  function nomePaciente(admissionId: string) {
    const internacao = internacoes.find((i) => i.id === admissionId);
    return pacientes.find((p) => p.id === internacao?.patient_id)?.full_name ?? "—";
  }

  const opcoesInternacao = useMemo(
    () =>
      internacoes.map((i) => ({
        value: i.id,
        label: nomePaciente(i.id),
        sublabel: `Nr. Atend. ${i.external_reference ?? "—"} · ${hospitais.find((h) => h.id === i.hospital_id)?.name ?? "—"}`,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [internacoes, hospitais, pacientes]
  );
  const opcoesProcedimento = useMemo(
    () => procedimentos.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}`, sublabel: p.category ?? undefined })),
    [procedimentos]
  );

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const ordenadas = [...entradas].sort((a, b) => b.data_atendimento.localeCompare(a.data_atendimento));
    if (!termo) return ordenadas;
    return ordenadas.filter((e) => {
      const internacao = internacoes.find((i) => i.id === e.admission_id);
      return (
        nomePaciente(e.admission_id).toLowerCase().includes(termo) ||
        (internacao?.external_reference ?? "").toLowerCase().includes(termo)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, entradas, internacoes, pacientes]);

  const totalRepasse = filtradas.reduce((acc, e) => acc + e.valor_repasse, 0);
  const totalGlosado = filtradas.reduce((acc, e) => acc + e.valor_glosado, 0);

  function abrirNovo() {
    setInternacaoId("");
    setProcedimentoId("");
    setOpen(true);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!empresaId || !internacaoId) return;
    const form = new FormData(e.currentTarget);
    setSalvando(true);
    try {
      const dataAtendimento = String(form.get("data_atendimento") ?? "");
      await repository.billingEntries.create({
        admission_id: internacaoId,
        procedure_id: procedimentoId || null,
        competencia: `${dataAtendimento.slice(0, 7)}-01`,
        data_atendimento: dataAtendimento,
        quantidade: Number(form.get("quantidade") ?? 1),
        valor_repasse: Number(form.get("valor_repasse") ?? 0),
        valor_glosado: Number(form.get("valor_glosado") ?? 0),
        company_id: empresaId,
      });
      notificarSucesso("Lançamento de repasse registrado.");
      setOpen(false);
    } catch (erro) {
      notificarErro("Não foi possível registrar o lançamento", erro);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Faturamento"
        description="Lançamento manual do relatório de repasse (o que o hospital de fato pagou) — ponte até a importação automática ficar disponível. Mesma chave: Nr. Atendimento + procedimento + data."
        actions={
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="sm" onClick={abrirNovo}>
                <Plus className="h-4 w-4" /> Novo lançamento
              </Button>
            </SheetTrigger>
            <SheetContent>
              <form className="flex h-full flex-col" onSubmit={handleSubmit}>
                <SheetHeader>
                  <SheetTitle>Novo lançamento de repasse</SheetTitle>
                  <SheetDescription>Um lançamento por linha do relatório de repasse do convênio/hospital.</SheetDescription>
                </SheetHeader>
                <div className="flex flex-1 flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label>Internação (Nr. Atendimento)</Label>
                    <Combobox
                      value={internacaoId}
                      onValueChange={setInternacaoId}
                      options={opcoesInternacao}
                      placeholder="Buscar paciente ou Nr. Atendimento…"
                      searchPlaceholder="Nome do paciente ou Nr. Atendimento…"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Procedimento</Label>
                    <Combobox
                      value={procedimentoId}
                      onValueChange={setProcedimentoId}
                      options={opcoesProcedimento}
                      placeholder="Buscar procedimento…"
                      searchPlaceholder="Nome, código ou categoria…"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="data_atendimento">Data do atendimento</Label>
                      <Input id="data_atendimento" name="data_atendimento" type="date" required defaultValue={hojeLocalIso()} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="quantidade">Quantidade</Label>
                      <Input id="quantidade" name="quantidade" type="number" min="1" step="1" required defaultValue="1" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="valor_repasse">Valor repasse (R$)</Label>
                      <Input id="valor_repasse" name="valor_repasse" type="number" min="0" step="0.01" required placeholder="0,00" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="valor_glosado">Valor glosado (R$)</Label>
                      <Input id="valor_glosado" name="valor_glosado" type="number" min="0" step="0.01" defaultValue="0" />
                    </div>
                  </div>
                </div>
                <SheetFooter>
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={salvando || !internacaoId}>
                    {salvando ? "Salvando…" : "Registrar lançamento"}
                  </Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-recovery-100 text-recovery-600">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-soft">Total repasse (filtro atual)</p>
              <p className="font-display text-2xl font-semibold text-recovery-600">R$ {totalRepasse.toLocaleString("pt-BR")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-critical-100 text-critical-600">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-soft">Total glosado (filtro atual)</p>
              <p className="font-display text-2xl font-semibold text-critical-600">R$ {totalGlosado.toLocaleString("pt-BR")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por paciente ou Nr. Atendimento…" className="pl-9" />
      </div>

      <Card>
        {filtradas.length === 0 ? (
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <Wallet className="h-8 w-8 text-ink-soft" />
            <p className="font-medium text-ink">Nenhum lançamento de repasse ainda</p>
            <p className="text-sm text-ink-soft">Registre o que veio no relatório de repasse do hospital/convênio.</p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Nr. Atendimento</th>
                  <th className="px-4 py-3 font-medium">Paciente</th>
                  <th className="px-4 py-3 font-medium">Procedimento</th>
                  <th className="px-4 py-3 font-medium">Qtd</th>
                  <th className="px-4 py-3 font-medium">Repasse</th>
                  <th className="px-4 py-3 font-medium">Glosado</th>
                  <th className="px-4 py-3 font-medium">Origem</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filtradas.map((e) => {
                  const internacao = internacoes.find((i) => i.id === e.admission_id);
                  const proc = procedimentos.find((p) => p.id === e.procedure_id);
                  return (
                    <tr key={e.id} className="border-b border-line last:border-0 hover:bg-surface-sunken/60">
                      <td className="px-4 py-3 font-mono text-xs text-ink-soft">{e.data_atendimento.split("-").reverse().join("/")}</td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-soft">{internacao?.external_reference ?? "—"}</td>
                      <td className="px-4 py-3 font-medium text-ink">{nomePaciente(e.admission_id)}</td>
                      <td className="px-4 py-3 text-ink-soft">
                        {proc ? <><span className="font-mono text-xs">{proc.code}</span> {proc.name}</> : "—"}
                      </td>
                      <td className="px-4 py-3 text-ink-soft">{e.quantidade}</td>
                      <td className="px-4 py-3 font-medium text-recovery-600">R$ {e.valor_repasse.toLocaleString("pt-BR")}</td>
                      <td className="px-4 py-3 text-ink-soft">{e.valor_glosado > 0 ? `R$ ${e.valor_glosado.toLocaleString("pt-BR")}` : "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant={e.origem === "manual" ? "neutral" : "clinical"}>
                          {e.origem === "manual" ? "Manual" : "Importado"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DeleteButton itemLabel="lançamento" onConfirm={() => repository.billingEntries.remove(e.id)} />
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
