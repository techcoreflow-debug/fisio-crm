import { useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  useReceivables,
  useContracts,
  useHospitals,
  useHealthInsurances,
  useAdmissions,
  useDailyProduction,
  useCompanies,
  repository,
} from "@/data/repository";
import { useAppStore } from "@/store/app-store";
import { notificarErro, notificarSucesso } from "@/store/toast-store";
import type { ReceivableStatus, Receivable } from "@/types/domain";

function formatarData(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarCompetencia(iso: string) {
  const [ano, mes] = iso.split("-");
  return `${mes}/${ano}`;
}

const statusConfig: Record<ReceivableStatus, { label: string; variant: NonNullable<BadgeProps["variant"]> }> = {
  pago: { label: "Pago", variant: "recovery" },
  pendente: { label: "Pendente", variant: "attention" },
  atrasado: { label: "Atrasado", variant: "critical" },
};

export default function Financeiro() {
  const recebiveis = useReceivables();
  const contratos = useContracts();
  const hospitais = useHospitals();
  const convenios = useHealthInsurances();
  const internacoes = useAdmissions();
  const producao = useDailyProduction();
  const companies = useCompanies();
  const activeCompanyId = useAppStore((s) => s.activeCompanyId);
  const empresa = companies.find((c) => c.id === activeCompanyId);
  const glosaPorProcedimento = empresa?.glosa_por_procedimento ?? false;

  const [itemGlosaManual, setItemGlosaManual] = useState<Receivable | null>(null);
  const [salvandoGlosa, setSalvandoGlosa] = useState(false);

  const competenciaAtual = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;
  const totalMesAtual = recebiveis
    .filter((r) => r.competencia === competenciaAtual)
    .reduce((acc, r) => acc + r.amount, 0);
  const emAberto = recebiveis.filter((r) => r.status !== "pago").reduce((acc, r) => acc + r.amount, 0);
  const atrasado = recebiveis.filter((r) => r.status === "atrasado").reduce((acc, r) => acc + r.amount, 0);

  function nomeContrato(contractId: string) {
    const contrato = contratos.find((c) => c.id === contractId);
    const hospital = hospitais.find((h) => h.id === contrato?.hospital_id)?.name ?? "—";
    const convenio = convenios.find((v) => v.id === contrato?.health_insurance_id)?.name ?? "—";
    return { hospital, convenio, healthInsuranceId: contrato?.health_insurance_id ?? null };
  }

  // Modo detalhado: soma as glosas lançadas por procedimento cujo convênio
  // e mês batem com esta competência. Assume um contrato ativo por par
  // hospital+convênio — se um dia existir mais de um simultâneo, a soma
  // fica por convênio (não por contrato específico).
  const glosaAutomaticaPorConvenioEMes = useMemo(() => {
    const mapa = new Map<string, number>();
    if (!glosaPorProcedimento) return mapa;
    for (const p of producao) {
      if (!p.glosado || !p.valor_glosado) continue;
      const internacao = internacoes.find((i) => i.id === p.admission_id);
      if (!internacao?.health_insurance_id) continue;
      const competenciaProducao = `${p.production_date.slice(0, 7)}-01`;
      const chave = `${internacao.health_insurance_id}:${competenciaProducao}`;
      mapa.set(chave, (mapa.get(chave) ?? 0) + p.valor_glosado);
    }
    return mapa;
  }, [glosaPorProcedimento, producao, internacoes]);

  function valorGlosadoDoRecebivel(r: Receivable): number {
    if (!glosaPorProcedimento) return r.valor_glosado;
    const info = nomeContrato(r.contract_id);
    if (!info.healthInsuranceId) return 0;
    return glosaAutomaticaPorConvenioEMes.get(`${info.healthInsuranceId}:${r.competencia}`) ?? 0;
  }

  async function handleMarcarPago(id: string) {
    try {
      await repository.receivables.markPaid(id);
      notificarSucesso("Lançamento marcado como pago.");
    } catch (erro) {
      notificarErro("Não foi possível marcar como pago", erro);
    }
  }

  async function handleSubmitGlosaManual(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!itemGlosaManual) return;
    const form = new FormData(e.currentTarget);
    const valor = Number(form.get("valor_glosado") ?? 0);
    const motivo = String(form.get("motivo_glosa") ?? "");
    setSalvandoGlosa(true);
    try {
      await repository.receivables.registrarGlosaManual(itemGlosaManual.id, valor, motivo);
      notificarSucesso("Glosa registrada.");
      setItemGlosaManual(null);
    } catch (erro) {
      notificarErro("Não foi possível registrar a glosa", erro);
    } finally {
      setSalvandoGlosa(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Financeiro"
        description={`Contas a receber por contrato, com status de pagamento e glosa rastreados de verdade — modo ${glosaPorProcedimento ? "detalhado (por procedimento)" : "por competência (manual)"}.`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-ink-soft">Previsto — competência atual</p>
            <p className="mt-1 font-display text-2xl font-semibold text-ink">
              R$ {totalMesAtual.toLocaleString("pt-BR")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-ink-soft">Em aberto (pendente + atrasado)</p>
            <p className="mt-1 font-display text-2xl font-semibold text-attention-600">
              R$ {emAberto.toLocaleString("pt-BR")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-ink-soft">Atrasado</p>
            <p className="mt-1 font-display text-2xl font-semibold text-critical-600">
              R$ {atrasado.toLocaleString("pt-BR")}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contas a receber</CardTitle>
        </CardHeader>
        {recebiveis.length === 0 ? (
          <CardContent className="py-10 text-center text-sm text-ink-soft">
            Nenhum lançamento cadastrado ainda.
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">Hospital</th>
                  <th className="px-4 py-3 font-medium">Convênio</th>
                  <th className="px-4 py-3 font-medium">Competência</th>
                  <th className="px-4 py-3 font-medium">Valor bruto</th>
                  <th className="px-4 py-3 font-medium">Glosa</th>
                  <th className="px-4 py-3 font-medium">Valor líquido</th>
                  <th className="px-4 py-3 font-medium">Vencimento</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {recebiveis
                  .slice()
                  .sort((a, b) => b.competencia.localeCompare(a.competencia))
                  .map((r) => {
                    const info = nomeContrato(r.contract_id);
                    const glosado = valorGlosadoDoRecebivel(r);
                    return (
                      <tr key={r.id} className="border-b border-line last:border-0 hover:bg-surface-sunken/60">
                        <td className="px-4 py-3 font-medium text-ink">{info.hospital}</td>
                        <td className="px-4 py-3 text-ink-soft">{info.convenio}</td>
                        <td className="px-4 py-3 text-ink-soft">{formatarCompetencia(r.competencia)}</td>
                        <td className="px-4 py-3 text-ink-soft">R$ {r.amount.toLocaleString("pt-BR")}</td>
                        <td className="px-4 py-3">
                          {glosado > 0 ? (
                            <span className="flex items-center gap-1 text-critical-600">
                              <TriangleAlert className="h-3.5 w-3.5" /> R$ {glosado.toLocaleString("pt-BR")}
                            </span>
                          ) : (
                            <span className="text-ink-soft">—</span>
                          )}
                          {!glosaPorProcedimento && (
                            <Button variant="ghost" size="sm" className="ml-1" onClick={() => setItemGlosaManual(r)}>
                              {r.valor_glosado > 0 ? "Editar" : "Registrar"}
                            </Button>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-ink">
                          R$ {(r.amount - glosado).toLocaleString("pt-BR")}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-ink-soft">{formatarData(r.due_date)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={statusConfig[r.status].variant}>{statusConfig[r.status].label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {r.status !== "pago" && (
                            <Button variant="ghost" size="sm" onClick={() => handleMarcarPago(r.id)}>
                              <CheckCircle2 className="h-3.5 w-3.5" /> Marcar como pago
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Sheet open={itemGlosaManual !== null} onOpenChange={(open) => !open && setItemGlosaManual(null)}>
        <SheetContent>
          <form className="flex h-full flex-col" onSubmit={handleSubmitGlosaManual}>
            <SheetHeader>
              <SheetTitle>Registrar glosa da competência</SheetTitle>
              <SheetDescription>
                {itemGlosaManual && `${nomeContrato(itemGlosaManual.contract_id).hospital} · ${formatarCompetencia(itemGlosaManual.competencia)}`}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="valor_glosado">Valor glosado (R$)</Label>
                <Input
                  id="valor_glosado"
                  name="valor_glosado"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  defaultValue={itemGlosaManual?.valor_glosado || ""}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="motivo_glosa">Motivo</Label>
                <textarea
                  id="motivo_glosa"
                  name="motivo_glosa"
                  rows={3}
                  defaultValue={itemGlosaManual?.motivo_glosa ?? ""}
                  className="rounded-md border border-line-strong bg-surface-raised px-3 py-2 text-sm text-ink shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-500/40"
                  placeholder="Informado pelo convênio na remessa de pagamento…"
                />
              </div>
            </div>
            <SheetFooter>
              <Button type="button" variant="secondary" onClick={() => setItemGlosaManual(null)}>Cancelar</Button>
              <Button type="submit" disabled={salvandoGlosa}>{salvandoGlosa ? "Salvando…" : "Salvar"}</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
