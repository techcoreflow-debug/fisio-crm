import { useMemo, useState, type FormEvent } from "react";
import { Search, Plus, ClipboardList, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { Paginacao, usarPaginacao } from "@/components/shared/paginacao";
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
  useCompanies,
  useUnits,
  useHospitals,
  repository,
} from "@/data/repository";
import { useAppStore } from "@/store/app-store";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import type { DailyProduction } from "@/types/domain";

export default function ProducaoDiaria() {
  const producao = useDailyProduction();
  const internacoes = useAdmissions();
  const pacientes = usePatients();
  const fisioterapeutas = usePhysiotherapists();
  const procedimentos = useProcedures();
  const unidades = useUnits();
  const hospitais = useHospitals();

  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [internacaoId, setInternacaoId] = useState(internacoes.find((i) => i.status === "internado")?.id ?? "");
  const [fisioId, setFisioId] = useState(fisioterapeutas[0]?.id ?? "");
  const [procedimentoId, setProcedimentoId] = useState(procedimentos[0]?.id ?? "");

  const companies = useCompanies();
  const activeCompanyId = useAppStore((s) => s.activeCompanyId);
  const empresa = companies.find((c) => c.id === activeCompanyId);
  const glosaPorProcedimento = empresa?.glosa_por_procedimento ?? false;

  const [itemGlosa, setItemGlosa] = useState<DailyProduction | null>(null);
  const [salvandoGlosa, setSalvandoGlosa] = useState(false);

  async function handleSubmitGlosa(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!itemGlosa) return;
    const form = new FormData(e.currentTarget);
    const valor = Number(form.get("valor_glosado") ?? 0);
    const motivo = String(form.get("motivo_glosa") ?? "");
    setSalvandoGlosa(true);
    try {
      await repository.dailyProduction.registrarGlosa(itemGlosa.id, valor, motivo);
      notificarSucesso("Glosa registrada.");
      setItemGlosa(null);
    } catch (erro) {
      notificarErro("Não foi possível registrar a glosa", erro);
    } finally {
      setSalvandoGlosa(false);
    }
  }

  async function handleRemoverGlosa(id: string) {
    try {
      await repository.dailyProduction.removerGlosa(id);
      notificarSucesso("Glosa removida.");
    } catch (erro) {
      notificarErro("Não foi possível remover a glosa", erro);
    }
  }

  function nomePaciente(admissionId: string | null) {
    const internacao = internacoes.find((i) => i.id === admissionId);
    return pacientes.find((p) => p.id === internacao?.patient_id)?.full_name ?? "—";
  }

  // Só internações ATIVAS — não faz sentido lançar procedimento numa
  // internação que já teve alta. Isso, junto da busca do Combobox, é o
  // que resolve o problema real: lista enorme sem filtro, com risco de
  // escolher por engano um paciente que já saiu.
  const opcoesInternacao = useMemo(() => {
    return internacoes
      .filter((i) => i.status === "internado")
      .map((i) => {
        const unidade = unidades.find((u) => u.id === i.unit_id);
        const hospital = hospitais.find((h) => h.id === i.hospital_id);
        return {
          value: i.id,
          label: nomePaciente(i.id),
          sublabel: `${hospital?.name ?? "—"} · ${unidade?.name ?? "—"}`,
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internacoes, unidades, hospitais, pacientes]);

  const opcoesFisioterapeuta = useMemo(
    () => fisioterapeutas.map((f) => ({ value: f.id, label: f.full_name })),
    [fisioterapeutas]
  );

  const opcoesProcedimento = useMemo(
    () => procedimentos.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}`, sublabel: p.category ?? undefined })),
    [procedimentos]
  );

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return producao;
    return producao.filter((p) => {
      const fisio = fisioterapeutas.find((f) => f.id === p.physiotherapist_id)?.full_name ?? "";
      return nomePaciente(p.admission_id).toLowerCase().includes(termo) || fisio.toLowerCase().includes(termo);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, producao, fisioterapeutas]);

  const { pagina: paginaAtual, totalPaginas, paginaValida } = usarPaginacao(filtrados, 25, pagina);

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
        production_time: String(form.get("production_time") ?? "") || "08:00",
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
                    <Label>Procedimento</Label>
                    <Combobox
                      value={procedimentoId}
                      onValueChange={setProcedimentoId}
                      options={opcoesProcedimento}
                      placeholder="Buscar procedimento…"
                      searchPlaceholder="Nome ou categoria…"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="production_date">Data</Label>
                      <Input id="production_date" name="production_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="production_time">Horário</Label>
                      <Input id="production_time" name="production_time" type="time" required defaultValue={new Date().toTimeString().slice(0, 5)} />
                    </div>
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
            <Input value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} placeholder="Buscar por paciente ou fisioterapeuta…" className="pl-9" />
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
                  <th className="px-4 py-3 font-medium">Conciliação</th>
                  {glosaPorProcedimento && <th className="px-4 py-3 font-medium">Glosa</th>}
                </tr>
              </thead>
              <tbody>
                {paginaAtual.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0 hover:bg-surface-sunken/60">
                    <td className="px-4 py-3 font-mono text-xs text-ink-soft">{p.production_date.split("-").reverse().join("/")} {p.production_time?.slice(0, 5)}</td>
                    <td className="px-4 py-3 font-medium text-ink">{nomePaciente(p.admission_id)}</td>
                    <td className="px-4 py-3 text-ink-soft">
                      {(() => {
                        const proc = procedimentos.find((pr) => pr.id === p.procedure_id);
                        return proc ? <><span className="font-mono text-xs">{proc.code}</span> {proc.name}</> : "—";
                      })()}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{fisioterapeutas.find((f) => f.id === p.physiotherapist_id)?.full_name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={p.confirmado_tasy ? "recovery" : "neutral"}>
                        {p.confirmado_tasy ? "Confirmado" : "Não confirmado"}
                      </Badge>
                    </td>
                    {glosaPorProcedimento && (
                      <td className="px-4 py-3">
                        {p.glosado ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="critical">
                              <TriangleAlert className="h-3 w-3" /> R$ {(p.valor_glosado ?? 0).toLocaleString("pt-BR")}
                            </Badge>
                            <Button variant="ghost" size="sm" onClick={() => handleRemoverGlosa(p.id)}>
                              Remover
                            </Button>
                          </div>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => setItemGlosa(p)}>
                            Registrar glosa
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Paginacao
          paginaAtual={paginaValida}
          totalPaginas={totalPaginas}
          onChange={setPagina}
          totalItens={filtrados.length}
          itensPorPagina={25}
        />
      </Card>

      <Sheet open={itemGlosa !== null} onOpenChange={(open) => !open && setItemGlosa(null)}>
        <SheetContent>
          <form className="flex h-full flex-col" onSubmit={handleSubmitGlosa}>
            <SheetHeader>
              <SheetTitle>Registrar glosa</SheetTitle>
              <SheetDescription>
                {itemGlosa && `${nomePaciente(itemGlosa.admission_id)} · ${procedimentos.find((pr) => pr.id === itemGlosa.procedure_id)?.name ?? "—"}`}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="valor_glosado">Valor glosado (R$)</Label>
                <Input id="valor_glosado" name="valor_glosado" type="number" step="0.01" min="0.01" required placeholder="Ex.: 42.50" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="motivo_glosa">Motivo</Label>
                <textarea
                  id="motivo_glosa"
                  name="motivo_glosa"
                  rows={3}
                  className="rounded-md border border-line-strong bg-surface-raised px-3 py-2 text-sm text-ink shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-500/40"
                  placeholder="Ex.: Divergência de código, falta de autorização…"
                />
              </div>
            </div>
            <SheetFooter>
              <Button type="button" variant="secondary" onClick={() => setItemGlosa(null)}>Cancelar</Button>
              <Button type="submit" disabled={salvandoGlosa}>{salvandoGlosa ? "Salvando…" : "Registrar"}</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
